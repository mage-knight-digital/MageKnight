# Design: Tactic Card Effects Implementation

## Overview

This document consolidates the best approaches from three independent design reviews (Claude, GPT, Gemini) for implementing tactic card effects in the Mage Knight game engine.

## Architecture Principles

1. **Immutable state updates** following existing patterns
2. **Server-side `validActions` as single source of truth**
3. **Secret information via `toClientState()` filtering** (not events)
4. **Seeded RNG for determinism**
5. **Command + validator pipeline** (`MageKnightEngine.processAction()` → validators → commands)

## New State Types

### Player State Extensions

Add to `packages/core/src/types/player.ts`:

```typescript
// Tactic-specific persistent state (survives across turns within a round)
export interface TacticState {
  // Mana Steal (Day 3): stored die from source
  readonly storedManaDie?: {
    readonly dieId: SourceDieId;
    readonly color: ManaColor;
  };

  // Sparing Power (Night 6): cards stored under the tactic
  readonly sparingPowerStored?: readonly CardId[];

  // The Right Moment (Day 6): extra turn queued
  readonly extraTurnPending?: boolean;

  // Mana Search (Night 3): used this turn flag
  readonly manaSearchUsedThisTurn?: boolean;
}

// Pending tactic decision (blocks other actions until resolved)
export type PendingTacticDecision =
  | { readonly type: "rethink"; readonly maxCards: 3 }
  | { readonly type: "mana_steal_pick_die" }
  | { readonly type: "preparation_pick_card"; readonly deckSnapshot: readonly CardId[] }
  | { readonly type: "midnight_meditation"; readonly maxCards: 5 }
  | { readonly type: "sparing_power_choice" };

export interface Player {
  // ... existing fields ...
  readonly tacticState: TacticState;
  readonly pendingTacticDecision: PendingTacticDecision | null;

  // Flag for "before turn" tactic handling
  readonly beforeTurnTacticPending: boolean;
}
```

### ValidActions Extension

Add to `packages/shared/src/validActions.ts`:

```typescript
export interface TacticEffectsOptions {
  // Activated tactics available to use
  readonly canActivate?: {
    readonly theRightMoment?: boolean;  // Day 6
    readonly longNight?: boolean;        // Night 2
    readonly midnightMeditation?: boolean; // Night 4
  };

  // Mana Search reroll available
  readonly canRerollSourceDice?: {
    readonly maxDice: 2;
    readonly mustPickDepletedFirst: boolean;
    readonly availableDice: readonly SourceDieId[];
  };

  // Pending decision that must be resolved
  readonly pendingDecision?: {
    readonly type: PendingTacticDecision["type"];
    // For preparation: visible deck cards (only sent to owning player)
    readonly deckSnapshot?: readonly CardId[];
    // For rethink/midnight_meditation: max selectable cards
    readonly maxCards?: number;
  };

  // Before-turn decision required (blocks other actions)
  readonly beforeTurnRequired?: {
    readonly tacticId: TacticId;
  };
}

export interface ValidActions {
  // ... existing fields ...
  readonly tacticEffects?: TacticEffectsOptions;
}
```

## New Actions

Add to `packages/shared/src/actions.ts`:

```typescript
// Activate a flip-to-use tactic
export const ACTIVATE_TACTIC_ACTION = "activate_tactic" as const;
export interface ActivateTacticAction {
  readonly type: typeof ACTIVATE_TACTIC_ACTION;
  readonly tacticId: TacticId;
}

// Resolve a pending tactic decision
export const RESOLVE_TACTIC_DECISION_ACTION = "resolve_tactic_decision" as const;
export interface ResolveTacticDecisionAction {
  readonly type: typeof RESOLVE_TACTIC_DECISION_ACTION;
  readonly decision: ResolveTacticDecisionPayload;
}

export type ResolveTacticDecisionPayload =
  | { readonly type: "rethink"; readonly cardIds: readonly CardId[] }
  | { readonly type: "mana_steal_pick_die"; readonly dieId: SourceDieId }
  | { readonly type: "preparation_pick_card"; readonly cardId: CardId }
  | { readonly type: "midnight_meditation"; readonly cardIds: readonly CardId[] }
  | { readonly type: "sparing_power_choice"; readonly choice: "stash" | "take" };

// Mana Search reroll action
export const REROLL_SOURCE_DICE_ACTION = "reroll_source_dice" as const;
export interface RerollSourceDiceAction {
  readonly type: typeof REROLL_SOURCE_DICE_ACTION;
  readonly dieIds: readonly SourceDieId[];
}
```

## New Events

Add to `packages/shared/src/events.ts`:

```typescript
export const TACTIC_ACTIVATED_EVENT = "tactic_activated" as const;
export interface TacticActivatedEvent {
  readonly type: typeof TACTIC_ACTIVATED_EVENT;
  readonly playerId: string;
  readonly tacticId: TacticId;
}

export const TACTIC_DECISION_RESOLVED_EVENT = "tactic_decision_resolved" as const;
export interface TacticDecisionResolvedEvent {
  readonly type: typeof TACTIC_DECISION_RESOLVED_EVENT;
  readonly playerId: string;
  readonly decisionType: PendingTacticDecision["type"];
}

export const SOURCE_DICE_REROLLED_EVENT = "source_dice_rerolled" as const;
export interface SourceDiceRerolledEvent {
  readonly type: typeof SOURCE_DICE_REROLLED_EVENT;
  readonly playerId: string;
  readonly dieIds: readonly SourceDieId[];
}
```

## Effect-by-Effect Implementation

### No-Effect Tactics
- **Early Bird (Day 1)**: Turn order only
- **From the Dusk (Night 1)**: Turn order only

### On-Pick Effects

#### Great Start (Day 5) - Draw 2 cards
**Complexity**: Simple
**Implementation**: Execute directly in `selectTacticCommand.ts`

```typescript
if (tacticId === TACTIC_GREAT_START) {
  // Draw 2 cards
  const { cards, newDeck, newDiscard, rng: rng2 } = drawCards(
    player.deck,
    player.discard,
    2,
    state.rng
  );
  updatedPlayer = {
    ...updatedPlayer,
    hand: [...updatedPlayer.hand, ...cards],
    deck: newDeck,
    discard: newDiscard,
  };
  updatedRng = rng2;
  events.push({ type: CARDS_DRAWN_EVENT, playerId, count: cards.length });
}
```

#### Rethink (Day 2) - Discard up to 3, shuffle discard, draw that many
**Complexity**: Medium (requires player choice)
**Implementation**:
1. On select: Set `pendingTacticDecision = { type: "rethink", maxCards: 3 }`
2. Block advancing to next selector until resolved
3. Resolve: Discard chosen cards → shuffle discard into deck → draw N

#### Mana Steal (Day 3) - Take a basic die from source
**Complexity**: High (requires die selection + special mana source)
**Implementation**:
1. On select: Set `pendingTacticDecision = { type: "mana_steal_pick_die" }`
2. Resolve: Store die in `tacticState.storedManaDie`, mark die as taken
3. Update `getManaOptions()` to include stored die as valid source
4. When used: Reroll die and return to source immediately

#### Preparation (Night 5) - Search deck for any card
**Complexity**: High (requires secret deck view)
**Implementation**:
1. On select: Set `pendingTacticDecision = { type: "preparation_pick_card", deckSnapshot: [...deck] }`
2. In `toClientState()`: Only send `deckSnapshot` to owning player
3. Resolve: Remove chosen card from deck → add to hand → shuffle deck

### Ongoing Effects

#### Planning (Day 4) - Draw as if hand limit +1
**Complexity**: Simple
**Implementation**: Modify `endTurnCommand.ts` draw calculation

```typescript
function getEndTurnDrawLimit(state: GameState, player: Player): number {
  let limit = getEffectiveHandLimit(state, player.id);

  // Planning: +1 if hand size >= 2 before drawing
  if (player.selectedTacticId === TACTIC_PLANNING && player.hand.length >= 2) {
    limit += 1;
  }

  return limit;
}
```

#### Mana Search (Night 3) - Reroll up to 2 source dice once per turn
**Complexity**: Medium
**Implementation**:
1. Track `tacticState.manaSearchUsedThisTurn` (reset at turn start)
2. Add `REROLL_SOURCE_DICE_ACTION` with validation:
   - Player has Mana Search tactic
   - Not used this turn
   - Haven't used source mana yet this turn
   - Must pick gold/depleted dice first if available
3. Execute: Reroll selected dice, set `manaSearchUsedThisTurn = true`

### Activated Effects (Flip to Use)

#### The Right Moment (Day 6) - Take another turn
**Complexity**: Medium
**Implementation**:
1. Action: `ACTIVATE_TACTIC_ACTION { tacticId: TACTIC_THE_RIGHT_MOMENT }`
2. Validation: Not flipped, not last turn of round
3. Execute: Set `tacticFlipped = true`, `tacticState.extraTurnPending = true`
4. In `endTurnCommand.ts`: If `extraTurnPending`, don't advance `currentPlayerIndex`

#### Long Night (Night 2) - Shuffle discard, put 3 random cards in deck
**Complexity**: Medium
**Implementation**:
1. Validation: Deck empty, discard non-empty, not flipped
2. Execute:
   - Shuffle discard with seeded RNG
   - Take first 3 cards as new deck
   - Remaining become discard (or empty)
   - Set `tacticFlipped = true`

#### Midnight Meditation (Night 4) - Shuffle up to 5 cards into deck, draw that many
**Complexity**: Medium (requires card selection)
**Implementation**:
1. Only available at turn start (before any action taken)
2. Action triggers `pendingTacticDecision = { type: "midnight_meditation", maxCards: 5 }`
3. Resolve: Shuffle chosen cards into deck → draw same count → flip

#### Sparing Power (Night 6) - Stash or take stored cards
**Complexity**: High (mandatory before-turn decision)
**Implementation**:
1. At turn start: Set `beforeTurnTacticPending = true`
2. Set `pendingTacticDecision = { type: "sparing_power_choice" }`
3. Resolve "stash": Move `deck[0]` to `tacticState.sparingPowerStored`
4. Resolve "take": Move stored cards to hand, flip tactic
5. In `toClientState()`: Only expose `storedCount`, not actual card IDs

## Turn Lifecycle Integration

### Turn Start Hook

When a player's turn begins (from `endTurnCommand` or after tactics phase):

```typescript
function applyTurnStartEffects(state: GameState, playerId: string): GameState {
  let newState = state;
  const player = getPlayer(state, playerId);

  // Reset per-turn flags
  newState = updatePlayer(newState, playerId, p => ({
    ...p,
    tacticState: {
      ...p.tacticState,
      manaSearchUsedThisTurn: false,
    },
  }));

  // Check for mandatory before-turn effects
  if (player.selectedTacticId === TACTIC_SPARING_POWER && !player.tacticFlipped) {
    newState = updatePlayer(newState, playerId, p => ({
      ...p,
      beforeTurnTacticPending: true,
      pendingTacticDecision: { type: "sparing_power_choice" },
    }));
  }

  return newState;
}
```

### ValidActions Gating

When `pendingTacticDecision` or `beforeTurnTacticPending` is set:
- Block all normal actions (move, play card, attack, etc.)
- Only allow `RESOLVE_TACTIC_DECISION_ACTION`

### End of Round Cleanup

In `endRoundCommand.ts`:

```typescript
function clearTacticState(player: Player): Player {
  return {
    ...player,
    tacticState: {},  // Reset all tactic state
    pendingTacticDecision: null,
    beforeTurnTacticPending: false,
    // tacticFlipped and selectedTacticId already cleared by existing logic
  };
}
```

## Secret Information Handling

### toClientState() Filtering

In `packages/server/src/toClientState.ts`:

```typescript
function filterPendingTacticDecision(
  decision: PendingTacticDecision | null,
  isOwner: boolean
): Partial<PendingTacticDecision> | null {
  if (!decision) return null;

  // Preparation deck snapshot only visible to owner
  if (decision.type === "preparation_pick_card") {
    return isOwner ? decision : { type: decision.type };
  }

  return decision;
}

function filterTacticState(
  tacticState: TacticState,
  isOwner: boolean
): Partial<TacticState> {
  const filtered = { ...tacticState };

  // Sparing Power stored cards: only show count to all
  if (filtered.sparingPowerStored) {
    return {
      ...filtered,
      sparingPowerStoredCount: filtered.sparingPowerStored.length,
      sparingPowerStored: undefined,  // Hide actual cards
    };
  }

  return filtered;
}
```

## Edge Cases

### "Last Turn of Round" Detection

For The Right Moment validation:

```typescript
function isLastTurnOfRound(state: GameState): boolean {
  return (
    state.endOfRoundAnnouncedBy !== null ||
    state.scenarioEndTriggered === true
  );
}
```

### Mana Search "Must Pick Gold/Depleted First"

```typescript
function validateManaSearchDice(
  state: GameState,
  selectedDiceIds: SourceDieId[]
): boolean {
  const source = state.source;
  const restrictedDice = source.dice.filter(d =>
    d.isDepleted || d.color === MANA_COLOR_GOLD
  );

  // If restricted dice exist and player selected fewer than all of them,
  // all selected must be from restricted set
  if (restrictedDice.length > 0 && selectedDiceIds.length < restrictedDice.length) {
    return selectedDiceIds.every(id =>
      restrictedDice.some(d => d.id === id)
    );
  }

  return true;
}
```

### Empty Deck for Preparation

If deck is empty when Preparation is selected:
- Shuffle discard into deck first (standard deck refresh)
- Then proceed with search

### Sparing Power with Empty Deck

If player chooses "stash" but deck is empty:
- Disallow the "stash" choice (only "take" available)
- Or: Auto-flip and take (if no cards stored yet, this is a no-op)

## Implementation Order

1. ✅ **Foundation** (required for all tactics):
   - Add `TacticState` and `pendingTacticDecision` to Player type
   - Add `tacticEffects` to ValidActions
   - Add new action/event types
   - Update `createInitialPlayer()` with default values

2. ✅ **Simple On-Pick** - Great Start:
   - Direct execution in `selectTacticCommand`
   - Validates on-pick flow

3. ✅ **Simple Ongoing** - Planning:
   - Modify `endTurnCommand` draw calculation
   - No new actions needed

4. ✅ **Simple Activated** - The Right Moment:
   - `ACTIVATE_TACTIC_ACTION` + command
   - Turn order mutation in `endTurnCommand`

5. ✅ **Medium Activated** - Long Night:
   - Deck/discard manipulation with seeded RNG
   - Validates activated flow

6. **Complex On-Pick** - Rethink:
   - `pendingTacticDecision` pattern
   - Multi-card selection
   - Shuffle + draw

7. **Medium Ongoing** - Mana Search:
   - New reroll action
   - Per-turn tracking
   - Priority validation (gold/depleted first)

8. **Complex Before-Turn** - Sparing Power:
   - `beforeTurnTacticPending` gating
   - Hidden card storage
   - Multiple-turn accumulation

9. **Complex On-Pick** - Mana Steal:
   - Die storage on player
   - Special mana source integration
   - Return-on-use logic

10. **Complex On-Pick with Secrets** - Preparation:
    - Secret deck view
    - `toClientState()` filtering
    - Search + shuffle

11. **Complex Before-Turn** - Midnight Meditation:
    - Turn-start optional activation
    - Multi-card selection
    - Shuffle + draw

## Testing Strategy

### Unit Tests

For each tactic, test in `packages/core/src/engine/__tests__/`:

```typescript
describe("Great Start tactic", () => {
  it("draws 2 cards when selected", () => {
    const state = createTestState({
      phase: ROUND_PHASE_TACTICS,
      player: { hand: [], deck: ["card1", "card2", "card3"] }
    });

    const result = processAction(state, {
      type: SELECT_TACTIC_ACTION,
      tacticId: TACTIC_GREAT_START,
    });

    expect(result.state.players[0].hand).toHaveLength(2);
    expect(result.state.players[0].deck).toHaveLength(1);
  });
});
```

### Integration Tests

Test full round cycles:
- Tactics selection with on-pick effects
- Multiple turns with ongoing effects
- Round end clearing tactic state

### RNG Determinism

All shuffle/reroll operations must use seeded RNG:
```typescript
it("produces deterministic results with same seed", () => {
  const state1 = createTestState({ seed: 12345 });
  const state2 = createTestState({ seed: 12345 });

  const result1 = processRethink(state1, ["card1", "card2"]);
  const result2 = processRethink(state2, ["card1", "card2"]);

  expect(result1.state.players[0].hand).toEqual(result2.state.players[0].hand);
});
```

## Open Questions

1. **Midnight Meditation timing**: Must it be the very first action, or just "before combat"? Current design: first action only.

2. **Sparing Power visibility**: Can the owning player see their stored cards? Rules say "face down". Current design: No, only count visible.

3. **Preparation deck order**: Should UI show searchable cards in order or shuffled display? Current design: Show in order (player sees deck order).

4. **Long Night card placement**: Rules say "3 random cards back into deck". Current design: After shuffle, first 3 become new deck.
