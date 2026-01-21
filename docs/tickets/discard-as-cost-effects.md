# Ticket: Discard-as-Cost Effect System

**Created:** January 2025
**Updated:**
**Priority:** Medium
**Complexity:** High
**Status:** Not Started
**Affects:** core/effects, core/commands, shared/actions, shared/clientState, client/Hand, client/Overlays
**Authoritative:** Yes

---

## Summary

Cards like Improvisation require discarding a card as a cost before gaining their effect. This mechanic is currently unimplemented—the cards give their benefits for free. We need a new effect type, player state, action, and UI to support discard-as-cost patterns.

## Problem Statement

Several cards in Mage Knight require discarding a card from hand as a cost:
- **Improvisation** (basic action): Discard a card → Move/Influence/Attack/Block 3 (or 5 powered)
- **Ritual Attack** (advanced action): Throw away a card → color-dependent attack
- **Druidic Staff** (artifact): Discard a card → color-dependent effect
- **Tome of All Spells** (artifact): Discard a card → use spell of same color

Currently, Improvisation just grants the choice without requiring a discard (comment in code: "Note: Discard cost not modeled"). This makes the card significantly overpowered.

Additionally, some cards have **optional** discard ("You MAY discard...") vs **mandatory** discard. Both patterns need support.

## Current Behavior

- `packages/core/src/data/basicActions/red.ts:61-73`: Improvisation defined with just a ChoiceEffect
- No `EFFECT_DISCARD_COST` or similar effect type exists
- No `pendingDiscard` state on player
- No `DISCARD_FOR_COST` action type
- Hand card clicks only open the play menu; no mode for "select to discard"

## Expected Behavior

1. Playing Improvisation creates a `pendingDiscard` state requiring the player to select a card from hand
2. Valid actions show only `DISCARD_FOR_COST` (for each eligible card) and `UNDO`
3. After discarding, the follow-up effect (choice of move/influence/attack/block) resolves
4. UI clearly indicates the player must select a card to discard
5. Optional discard effects also show a "Skip" option

## Scope

### In Scope
- New effect type `EFFECT_DISCARD_COST` with `count`, `optional`, and `thenEffect` properties
- New player state `pendingDiscard` to track discard requirements
- New action `DISCARD_FOR_COST` to submit the discard selection
- Validators for the discard action
- Valid actions computation when pendingDiscard is active
- Client UI for discard selection (clear visual indication, works during combat)
- Support for both mandatory and optional discard patterns
- Undo support for the original card play

### Out of Scope
- Cards that scale based on number of cards discarded (separate scaling pattern)
- "Throw away" semantics (remove from game vs discard pile) - use same mechanic, different handler
- Discard selection from locations other than hand (e.g., from discard pile)
- Color-dependent follow-up effects (e.g., Ritual Attack) - separate enhancement to `thenEffect`

## Proposed Approach

### Phase 1: Core Engine (2-3 files)

**1. Effect Type Definition**

```typescript
// packages/core/src/types/effectTypes.ts
export const EFFECT_DISCARD_COST = "discard_cost" as const;

// packages/core/src/types/cards.ts
export interface DiscardCostEffect {
  type: typeof EFFECT_DISCARD_COST;
  count: number;           // How many cards to discard (usually 1)
  optional: boolean;       // true = MAY discard, false = MUST discard
  thenEffect: CardEffect;  // Effect to resolve after discarding
  // Future: colorMatters?: boolean for Ritual Attack style
}
```

**2. Pending State**

```typescript
// packages/core/src/types/player.ts
export interface PendingDiscard {
  cardPlayed: CardId;      // The card that triggered this (for display)
  count: number;           // How many cards still need to be discarded
  optional: boolean;       // Can player skip?
  thenEffect: CardEffect;  // What resolves after discarding
}

// Add to Player
pendingDiscard: PendingDiscard | null;
```

**3. Action Type**

```typescript
// packages/shared/src/actions.ts
export const DISCARD_FOR_COST_ACTION = "DISCARD_FOR_COST" as const;

export interface DiscardForCostAction {
  type: typeof DISCARD_FOR_COST_ACTION;
  cardId: CardId;  // Card from hand to discard
}

export const SKIP_DISCARD_ACTION = "SKIP_DISCARD" as const;

export interface SkipDiscardAction {
  type: typeof SKIP_DISCARD_ACTION;
}
```

**4. Effect Resolution**

When `resolveEffect` encounters `EFFECT_DISCARD_COST`:
- Do NOT immediately resolve `thenEffect`
- Set `player.pendingDiscard` with the discard requirements
- Return (effect resolution pauses)

When `DISCARD_FOR_COST` action is processed:
- Validate card is in hand (not a wound, unless allowed)
- Move card to discard pile
- Decrement `pendingDiscard.count`
- If count reaches 0, clear `pendingDiscard` and resolve `thenEffect`

**5. Valid Actions**

When `player.pendingDiscard` is set:
- Include `DISCARD_FOR_COST` for each eligible card in hand
- Include `UNDO` (if original play was reversible)
- If `optional`, include `SKIP_DISCARD`
- Exclude all other actions (movement, card play, etc.)

### Phase 2: Client State (1-2 files)

**1. ClientPlayer Extension**

```typescript
// packages/shared/src/types/clientState.ts
export interface ClientPendingDiscard {
  cardPlayed: CardId;
  count: number;
  optional: boolean;
}

// Add to ClientPlayer
readonly pendingDiscard: ClientPendingDiscard | null;
```

**2. Server Filtering**

`toClientState()` includes `pendingDiscard` in the filtered player state.

### Phase 3: Client UI (new component)

**UI Design Decision: Overlay vs In-Hand**

Given the constraints (combat overlay already occupies space above hand), recommend a **dedicated selection overlay** that:
- Appears as a semi-transparent modal layer
- Shows cards from hand in a horizontal row with clear selection affordance
- Displays instruction: "Select a card to discard" (or "Select a card to discard (optional)")
- Has clear "Skip" button if optional
- Center shows the card that triggered this (Improvisation)
- Escape key triggers Undo

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              [Improvisation card image]                     │
│           "Select a card to discard"                        │
│                                                             │
│    ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐       │
│    │ Card │  │ Card │  │ Card │  │ Card │  │ Card │       │
│    │  1   │  │  2   │  │  3   │  │  4   │  │  5   │       │
│    └──────┘  └──────┘  └──────┘  └──────┘  └──────┘       │
│                                                             │
│                    [Skip]  [Undo]                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Component**: `packages/client/src/components/Overlays/DiscardSelection.tsx`

Similar structure to `ChoiceSelection.tsx`:
- Register as overlay to block other interactions
- Handle Escape for Undo
- Send `DISCARD_FOR_COST` action on card click
- Cards displayed using existing `getCardSpriteStyle` utility

**Alternative (simpler but less polished)**: Modify hand to have a "discard mode":
- When `pendingDiscard` is set, hand cards get a special glow
- A floating banner appears: "Click a card to discard"
- Clicking sends `DISCARD_FOR_COST` instead of opening menu
- Pro: Less new code
- Con: May conflict with combat overlay, less focused UX

### Phase 4: Update Card Definitions

```typescript
// packages/core/src/data/basicActions/red.ts
export const IMPROVISATION: DeedCard = {
  id: CARD_IMPROVISATION,
  name: "Improvisation",
  // ...
  basicEffect: {
    type: EFFECT_DISCARD_COST,
    count: 1,
    optional: false,
    thenEffect: choice(move(3), influence(3), attack(3), block(3)),
  },
  poweredEffect: {
    type: EFFECT_DISCARD_COST,
    count: 1,
    optional: false,
    thenEffect: choice(move(5), influence(5), attack(5), block(5)),
  },
  // ...
};
```

## Implementation Notes

### Files to Create
- `packages/client/src/components/Overlays/DiscardSelection.tsx`
- `packages/client/src/components/Overlays/DiscardSelection.css`

### Files to Modify
- `packages/core/src/types/effectTypes.ts` - Add EFFECT_DISCARD_COST constant
- `packages/core/src/types/cards.ts` - Add DiscardCostEffect interface
- `packages/core/src/types/player.ts` - Add PendingDiscard interface, add to Player
- `packages/core/src/engine/effects/index.ts` - Handle EFFECT_DISCARD_COST in resolveEffect
- `packages/core/src/engine/validActions/index.ts` - Compute valid actions for pendingDiscard
- `packages/shared/src/actions.ts` - Add DISCARD_FOR_COST_ACTION, SKIP_DISCARD_ACTION
- `packages/shared/src/types/clientState.ts` - Add ClientPendingDiscard
- `packages/server/src/index.ts` - Filter pendingDiscard in toClientState
- `packages/core/src/data/basicActions/red.ts` - Update IMPROVISATION definition
- `packages/client/src/App.tsx` - Render DiscardSelection overlay

### Edge Cases
- **Wounds in hand**: Generally cannot be discarded for cost (check card rules)
- **Last card**: If the card played IS the only card, can't discard it (it's already played)
- **During combat**: UI must work alongside CombatOverlay
- **Undo after partial discard**: If count > 1, track partial progress for undo

## Acceptance Criteria

- [ ] Playing Improvisation (basic) requires discarding a card first
- [ ] Playing Improvisation (powered) requires discarding a card first
- [ ] After discarding, the choice of Move/Influence/Attack/Block appears
- [ ] Undo from discard selection undoes the Improvisation play
- [ ] Valid actions during pendingDiscard exclude movement, other card plays
- [ ] UI clearly shows which card triggered the discard requirement
- [ ] UI works correctly during combat (doesn't conflict with combat overlay)
- [ ] Optional discard effects (when added) show Skip option
- [ ] Cannot discard Wound cards (standard rule)

## Test Plan

### Manual
1. Start game, get Improvisation in hand with other cards
2. Play Improvisation (basic)
3. Verify discard selection UI appears
4. Select a card to discard
5. Verify choice overlay (Move 3/Influence 3/Attack 3/Block 3) appears
6. Select Move 3
7. Verify move points gained
8. Repeat with powered play

### Combat Flow
1. Enter combat with Improvisation in hand
2. Play Improvisation
3. Verify discard UI works alongside combat overlay
4. Select Attack option
5. Verify attack added to combat accumulator

### Undo Flow
1. Play Improvisation
2. At discard selection, press Escape or click Undo
3. Verify Improvisation returns to hand, turn state restored

### Automated
- `packages/core/src/engine/__tests__/discardCost.test.ts`:
  - Effect creates pendingDiscard state
  - Valid actions correct during pendingDiscard
  - DISCARD_FOR_COST action resolves properly
  - Undo restores state correctly
  - Cannot discard wounds

## Open Questions

1. **Wound discard**: Are there any cards that allow discarding wounds for cost? (Assume no for now)

2. **Color-dependent effects**: Ritual Attack's effect depends on the color of the discarded card. Should `DiscardCostEffect` include a `colorMatters` flag that passes the discarded card's color to `thenEffect`? Or handle this as a separate effect type?

3. **"Throw away" vs "Discard"**: Some cards say "throw away" (remove from game) vs "discard" (to discard pile). Should this be a flag on the effect, or a separate effect type?

4. **Multiple discards**: Are there cards requiring discarding 2+ cards? (Verify before assuming count > 1 is needed)

5. **Sideways discard**: If a card is played sideways as mana for Improvisation's powered effect, then we need to discard a DIFFERENT card. Is this handled correctly? (The played card is consumed, remaining hand is the pool to discard from - should work naturally)

## Related Work

- `docs/status.md:608`: Lists "Discard-as-cost scaling" as unimplemented pattern
- Ritual Attack, Druidic Staff, Tome of All Spells will need similar treatment
- Consider extracting helper: `discardCost(count, optional, thenEffect)` for card definitions
