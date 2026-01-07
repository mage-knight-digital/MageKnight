# Ticket: Turn Structure, Phase Enforcement & Card Timing

**Created:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Affects:** Turn management, Action validation, Card system

---

## Problem Statement

The current turn structure implementation is loose and doesn't fully enforce Mage Knight's turn rules. While combat phase filtering works correctly, the normal turn flow lacks proper phase separation between Movement and Action, and there's no enforcement of "one action per turn" or "rest as exclusive turn choice."

Additionally, cards lack timing metadata to distinguish "special effects" (playable anytime) from regular cards.

---

## Mage Knight Turn Rules Reference

### Turn Options (Choose ONE at Turn Start)

**Option A: Regular Turn (Movement → Action)**
1. **Movement Phase (optional)**: Move, play movement cards, reveal tiles
2. **Action Phase (at most ONE action)**: Mandatory OR voluntary action

**Option B: Resting (NO movement, NO action)**
- Discard cards to recover
- Cannot move, cannot initiate combat, cannot interact

### Critical Rules
- One action per turn - mandatory OR voluntary, never both
- Movement must come first - cannot move after taking an action
- Unspent Move/Influence points are lost when action phase starts
- "Special effects" can be played anytime during your turn

---

## Current State

### What's Implemented

| Feature | Location | Status |
|---------|----------|--------|
| Turn state tracking | `core/src/types/player.ts:150-159` | ✅ `hasMovedThisTurn`, `hasTakenActionThisTurn`, `movePoints` |
| Move-after-action prevention | `validActions/movement.ts:34-37` | ✅ Prevents movement once action taken |
| Combat phase card filtering | `validActions/cards.ts:66-112` | ✅ Ranged/siege → Block → Attack phases |
| Rest types defined | `shared/src/actions.ts:46-59` | ✅ Standard vs slow_recovery |
| Rest validation | `validActions/turn.ts:79-125` | ✅ Checks for wounds, empty hand |
| Card types | `core/src/types/cards.ts:27-39` | ✅ basic_action, advanced_action, spell, artifact, wound |

### What's Missing

#### 1. No Explicit Turn Phase State

**Current:** Boolean flags (`hasMovedThisTurn`, `hasTakenActionThisTurn`)
**Problem:** Can't enforce strict Movement → Action ordering

```typescript
// Current in Player type
hasMovedThisTurn: boolean;
hasTakenActionThisTurn: boolean;

// Missing: Explicit phase tracking
// turnPhase: 'movement' | 'action' | 'ended'
```

#### 2. No "One Action Per Turn" Enforcement

`hasTakenActionThisTurn` is only set by:
- `enterSiteCommand.ts:126`
- `interactCommand.ts:112`
- `restCommand.ts:86`

**Missing:** Playing cards that count as "actions" should also set this flag (e.g., attacking an enemy, using certain abilities).

#### 3. Rest Not Exclusive Turn Choice

**Current:** Rest is just another action option available alongside card play
**Expected:** Rest chosen at turn start should block ALL other options

**Problem scenario (currently possible):**
1. Player plays a movement card
2. Player moves
3. Player chooses to rest
4. This is illegal in Mage Knight!

#### 4. No Card Timing Metadata

**Current card structure:**
```typescript
interface DeedCard {
  readonly cardType: DeedCardType;  // basic_action, advanced_action, spell, etc.
  readonly basicEffect: CardEffect;
  readonly poweredEffect: CardEffect;
  readonly sidewaysValue: number;
  // NO timing information
}
```

**Missing fields:**
```typescript
// When can this card be played?
readonly playTiming: CardPlayTiming;

type CardPlayTiming =
  | 'normal_turn'      // Only during normal turn, not combat
  | 'combat_only'      // Only during combat
  | 'anytime'          // Anytime during your turn (special effects)
  | 'movement_phase'   // Only during movement
  | 'action_phase';    // Only during action phase
```

---

## Expected Behavior

### Turn Flow

```
Turn Start
    │
    ├─► Player chooses REST
    │       - Set turnMode = 'resting'
    │       - Block all card play, movement
    │       - Only allow discard selection → confirm rest
    │       - Turn ends
    │
    └─► Player chooses REGULAR TURN (implicit/default)
            │
            ├─► MOVEMENT PHASE
            │       - Can: Play move cards, move, reveal tiles, use skills
            │       - Cannot: Take actions (interact, combat, etc.)
            │       - Ends when: Player explicitly ends phase OR takes an action
            │
            └─► ACTION PHASE
                    - Can: Take ONE action (interact, combat, explore, do nothing)
                    - Cannot: Move, play movement cards
                    - Turn ends after action completes
```

### Valid Actions by Phase

| Phase | Valid Actions |
|-------|---------------|
| **Movement Phase** | Play move cards, move, reveal tiles, play special effects, heal, convert crystals |
| **Action Phase** | One of: interact, enter combat, explore site, burn monastery, do nothing |
| **Rest Turn** | Discard cards only, then turn ends |
| **Anytime** | Special effect cards, healing (except in combat), crystal conversion |

---

## Proposed Solution

### Step 1: Add Turn Phase Tracking

**File:** `packages/core/src/types/player.ts`

```typescript
// New constants (or add to shared/src/stateConstants.ts)
export const TURN_PHASE_MOVEMENT = 'movement' as const;
export const TURN_PHASE_ACTION = 'action' as const;
export const TURN_PHASE_ENDED = 'ended' as const;
export const TURN_PHASE_RESTING = 'resting' as const;

export type TurnPhase =
  | typeof TURN_PHASE_MOVEMENT
  | typeof TURN_PHASE_ACTION
  | typeof TURN_PHASE_ENDED
  | typeof TURN_PHASE_RESTING;

// In Player type
interface Player {
  // ...existing fields...
  readonly turnPhase: TurnPhase;  // NEW: Replace boolean flags
  readonly movePointsSpentThisPhase: number;  // Track for phase transition
}
```

### Step 2: Add Card Timing Field

**File:** `packages/core/src/types/cards.ts`

```typescript
// New constants
export const CARD_TIMING_NORMAL = 'normal' as const;
export const CARD_TIMING_COMBAT_ONLY = 'combat_only' as const;
export const CARD_TIMING_ANYTIME = 'anytime' as const;
export const CARD_TIMING_SPECIAL = 'special' as const;

export type CardPlayTiming =
  | typeof CARD_TIMING_NORMAL
  | typeof CARD_TIMING_COMBAT_ONLY
  | typeof CARD_TIMING_ANYTIME
  | typeof CARD_TIMING_SPECIAL;

interface DeedCard {
  // ...existing fields...
  readonly playTiming: CardPlayTiming;  // NEW
}
```

### Step 3: Enforce Phase Transitions

**File:** `packages/core/src/engine/validActions/index.ts`

```typescript
function computeNormalTurnOptions(state: GameState, player: Player): ValidActions {
  const turnPhase = player.turnPhase;

  if (turnPhase === TURN_PHASE_RESTING) {
    // Only allow rest-related actions
    return {
      turn: { canEndTurn: false, canRest: getRestOptions(state, player) },
      cards: [],  // No card play during rest
      movement: undefined,
      // ...
    };
  }

  if (turnPhase === TURN_PHASE_MOVEMENT) {
    return {
      movement: getMovementOptions(state, player),
      cards: getCardsForMovementPhase(state, player),  // Only move/special cards
      turn: { canEndMovementPhase: true, canRest: getRestOptions(state, player) },
      // Actions NOT available during movement phase
      sites: undefined,
      // ...
    };
  }

  if (turnPhase === TURN_PHASE_ACTION) {
    return {
      movement: undefined,  // No movement during action phase
      cards: getCardsForActionPhase(state, player),
      sites: getSiteInteractionOptions(state, player),
      turn: { canEndTurn: true, canDoNothing: true },
      // ...
    };
  }

  return emptyActions();
}
```

### Step 4: Filter Cards by Timing

**File:** `packages/core/src/engine/validActions/cards.ts`

```typescript
function getCardsForMovementPhase(state: GameState, player: Player): PlayableCard[] {
  return player.hand.filter(card => {
    const cardDef = getCardDefinition(card);

    // During movement phase, can play:
    // - Cards with move effects (basic or powered)
    // - Cards marked as 'anytime' or 'special'
    return hasMovementEffect(cardDef) ||
           cardDef.playTiming === CARD_TIMING_ANYTIME ||
           cardDef.playTiming === CARD_TIMING_SPECIAL;
  });
}

function getCardsForActionPhase(state: GameState, player: Player): PlayableCard[] {
  return player.hand.filter(card => {
    const cardDef = getCardDefinition(card);

    // During action phase, can play action cards and special cards
    // But NOT movement cards (unless sideways for influence)
    return cardDef.playTiming !== CARD_TIMING_COMBAT_ONLY;
  });
}
```

### Step 5: Update Rest Logic

**File:** `packages/core/src/engine/commands/restCommand.ts`

```typescript
// Rest should:
// 1. Set turnPhase to RESTING immediately when chosen
// 2. Block all other actions until rest completes
// 3. End turn after discard selection

export function handleRestAction(state: GameState, action: RestAction): GameState {
  // Validate: Can only rest at turn start (no cards played, no movement)
  if (player.turnPhase !== TURN_PHASE_MOVEMENT || player.hasMovedThisTurn) {
    throw new Error('Can only rest at the start of turn before moving');
  }

  // Set phase to resting
  return updatePlayer(state, playerId, {
    turnPhase: TURN_PHASE_RESTING,
  });
}
```

---

## Testing Plan

### New Test File: `turn-phases.test.ts`

```typescript
describe('Turn Phase Enforcement', () => {
  describe('movement phase', () => {
    it('should start turn in movement phase');
    it('should allow playing movement cards during movement phase');
    it('should allow special effect cards during movement phase');
    it('should NOT allow action cards during movement phase');
    it('should transition to action phase when player chooses to end movement');
    it('should transition to action phase when player initiates an action');
  });

  describe('action phase', () => {
    it('should NOT allow movement during action phase');
    it('should NOT allow movement cards during action phase');
    it('should allow ONE action during action phase');
    it('should end turn after action completes');
    it('should allow "do nothing" as a valid action');
  });

  describe('rest', () => {
    it('should only allow rest at turn start');
    it('should NOT allow rest after playing a card');
    it('should NOT allow rest after moving');
    it('should block all actions while in resting phase');
    it('should end turn after rest discard completes');
  });

  describe('card timing', () => {
    it('should mark healing cards as anytime');
    it('should mark combat-only cards appropriately');
    it('should filter playable cards by current phase');
  });
});
```

---

## Migration Notes

### Breaking Changes

- `Player.hasMovedThisTurn` and `Player.hasTakenActionThisTurn` replaced by `Player.turnPhase`
- All code accessing these boolean flags needs updating
- Card definitions need new `playTiming` field

### Search for Affected Code

```bash
# Find all references to turn state flags
grep -r "hasMovedThisTurn" packages/
grep -r "hasTakenActionThisTurn" packages/

# Find card definitions
grep -r "cardType:" packages/core/src/data/
```

### Card Data Migration

All card definitions in `packages/core/src/data/` need `playTiming` added:

```typescript
// Example: basicActions.ts
export const RAGE: DeedCard = {
  id: CARD_ID_RAGE,
  name: 'Rage',
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  playTiming: CARD_TIMING_NORMAL,  // NEW FIELD
  // ...
};

// Example: A healing card
export const TRANQUILITY: DeedCard = {
  id: CARD_ID_TRANQUILITY,
  name: 'Tranquility',
  cardType: DEED_CARD_TYPE_BASIC_ACTION,
  playTiming: CARD_TIMING_ANYTIME,  // Can heal anytime
  // ...
};
```

---

## Related Files

**Types:**
- `packages/shared/src/stateConstants.ts` - Phase constants
- `packages/core/src/types/player.ts` - Player turn state
- `packages/core/src/types/cards.ts` - Card definitions

**Validation:**
- `packages/core/src/engine/validActions/index.ts` - Main action computation
- `packages/core/src/engine/validActions/cards.ts` - Card filtering
- `packages/core/src/engine/validActions/movement.ts` - Movement validation
- `packages/core/src/engine/validActions/turn.ts` - Turn/rest options

**Commands:**
- `packages/core/src/engine/commands/restCommand.ts` - Rest handling
- `packages/core/src/engine/commands/playCardCommand.ts` - Card play handling

**Card Data:**
- `packages/core/src/data/basicActions.ts`
- `packages/core/src/data/advancedActions.ts`
- `packages/core/src/data/spells.ts`
- `packages/core/src/data/artifacts.ts`

---

## Acceptance Criteria

- [ ] `TurnPhase` type added with movement/action/ended/resting states
- [ ] `Player.turnPhase` replaces boolean flags
- [ ] Movement only allowed during movement phase
- [ ] Actions only allowed during action phase
- [ ] Phase transitions enforced (movement → action, never reverse)
- [ ] Rest is turn-start-only decision that blocks other actions
- [ ] `CardPlayTiming` type added to card definitions
- [ ] All card definitions have `playTiming` field
- [ ] Cards filtered by timing in `validActions/cards.ts`
- [ ] "Do nothing" available as explicit action choice
- [ ] All existing tests still pass
- [ ] New turn phase tests pass
