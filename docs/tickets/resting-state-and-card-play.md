# Ticket: Resting as State with Card Play Allowed

**Created:** January 2026
**Updated:**
**Priority:** High
**Complexity:** High
**Status:** Not Started
**Affects:** Turn management, rest mechanics, action validation, card system
**Authoritative:** Yes

---

## Summary

The current REST implementation is an atomic action that requires choosing the rest type (Standard/Slow Recovery) upfront. Per the rulebook, resting is a **state** where players can still play certain cards before choosing how to complete the rest. The implementation needs a fundamental redesign.

## Problem Statement

### Current Implementation (Incorrect)

REST is a single atomic action with parameters:
- `restType: RestType` (STANDARD or SLOW_RECOVERY) — chosen upfront
- `discardCardIds: readonly CardId[]` — cards to discard

This is incorrect per the FAQ (Resting Q1 A1, p.30):
> "When you Rest, you don't declare which kind of Rest you're doing (Standard Rest or Slow Recovery): you merely announce that you're Resting."

### What Resting Actually Allows

Per FAQ S3 (p.30): "Resting doesn't prevent you from playing cards: it merely prevents you from Moving, Fighting, Interacting, or doing anything 'as your Action'."

**While resting, you CAN:**
- Play Special Effects and Healing cards (Tranquility, etc.)
- Use Crystallize to use your once-per-turn die from the SOURCE
- Play Learning or Training to gain Advanced Action cards
- Play non-wound cards sideways for Influence
- Use Gem Rings to gain crystals or mana tokens
- Use many Skills and Units
- Gain benefits of the space you're on (Magical Glade, Mine)

**While resting, you CANNOT:**
- Move (no Movement Phase)
- Fight/initiate combat
- Interact with locals (e.g., buying healing at a Monastery)
- Do anything "as your Action" (Action Phase activities)

### Rest Completion

At any point during rest, the player completes the rest by EITHER:
1. **Standard Rest**: Discard 1 non-wound card + any number of wounds
2. **Slow Recovery**: Reveal hand showing only wounds, discard 1 wound

The choice depends on hand composition **at the moment of completion**, not at rest declaration.

### Special Case: Healing All Wounds

Per FAQ Q2 A2: If you heal all wounds during rest (e.g., using HERBALIST), you've completed a valid Slow Recovery even with nothing left to discard.

## Current Behavior

- REST is atomic: choose type and discards in one action (`restCommand.ts`)
- `restType` is a required parameter chosen upfront
- No ability to play cards between declaring rest and completing it
- No `isResting` state flag exists
- After rest completes, no restrictions on movement/combat/interaction

Key files:
- `packages/core/src/engine/commands/restCommand.ts` — atomic rest action
- `packages/core/src/engine/validators/restValidators.ts` — validates discard rules

## Expected Behavior

1. Player declares "I am resting" → enters `isResting: true` state
2. While `isResting`:
   - Movement actions blocked
   - Combat initiation blocked
   - Interaction actions blocked
   - "Action Phase" activities blocked
   - Card play still allowed (special effects, healing, influence for AAs)
   - Skill use still allowed (many skills)
   - Site passive benefits still apply
3. Player completes rest via discard action (Standard or Slow Recovery based on current hand)
4. After rest completion, only END_TURN should be valid (no more actions this turn)

## Scope

### In Scope

- Add `isResting: boolean` to Player state
- Create DECLARE_REST action that enters resting state
- Create COMPLETE_REST action for the discard step
- Add validators to block movement/combat/interaction while resting
- Determine which card plays are valid during rest vs blocked
- Handle special case of no wounds left to discard

### Out of Scope

- Minimum turn requirement (separate ticket: `mandatory-card-play-per-turn.md`)
- General turn phase structure (separate ticket: turn-structure-and-phases.md)

## Proposed Approach

### Phase 1: Resting State

1. Add `isResting: boolean` to `Player` type (default `false`)
2. Create `DECLARE_REST` action and command:
   - Sets `isResting = true`
   - Sets `hasTakenActionThisTurn = true` (no action phase)
   - No discard yet
3. Reset `isResting = false` in `playerReset.ts` at turn start

### Phase 2: Rest Restrictions

4. Add `validateNotResting` validator for:
   - MOVE_ACTION
   - ENTER_SITE_ACTION (combat initiation)
   - ENTER_COMBAT_ACTION
   - INTERACT_ACTION
   - Other "Action Phase" activities

5. Cards should still be playable while resting:
   - Need to identify which cards are "Special Effects" vs "Action Phase"
   - May need `playTiming` metadata on cards (see turn-structure ticket)

### Phase 3: Rest Completion

6. Create `COMPLETE_REST` action:
   - Validates based on current hand state (not pre-declared type)
   - If hand has non-wounds: Standard Rest (1 non-wound + any wounds)
   - If hand has only wounds: Slow Recovery (1 wound)
   - If hand is empty (healed all wounds): Slow Recovery with no discard
7. After COMPLETE_REST, player should END_TURN

### Phase 4: Undo Support

8. UNDO after DECLARE_REST should restore `isResting = false`
9. UNDO after COMPLETE_REST should restore to resting state (cards back in hand)

## Implementation Notes

### Files to Modify

- `packages/core/src/types/player.ts` — add `isResting`
- `packages/shared/src/types/playerActions.ts` — add DECLARE_REST, COMPLETE_REST
- `packages/core/src/engine/commands/restCommand.ts` — split into declare/complete
- `packages/core/src/engine/validators/restValidators.ts` — update for new flow
- `packages/core/src/engine/validators/turnValidators.ts` — add rest state checks
- `packages/core/src/engine/validActions/*.ts` — add rest checks

### New Actions

```typescript
// Declare intent to rest (enters resting state)
interface DeclareRestAction {
  type: "DECLARE_REST";
}

// Complete the rest (discard cards)
interface CompleteRestAction {
  type: "COMPLETE_REST";
  discardCardIds: readonly CardId[];
}
```

### New Validation Codes

- `CANNOT_MOVE_WHILE_RESTING`
- `CANNOT_FIGHT_WHILE_RESTING`
- `CANNOT_INTERACT_WHILE_RESTING`
- `MUST_COMPLETE_REST` — if trying to END_TURN while still in resting state
- `ALREADY_RESTING` — if trying to DECLARE_REST twice

## Acceptance Criteria

- [ ] Player can declare rest without choosing type upfront
- [ ] While resting, movement is blocked
- [ ] While resting, combat initiation is blocked
- [ ] While resting, interaction is blocked
- [ ] While resting, healing cards can still be played
- [ ] While resting, special effect cards can still be played
- [ ] Rest type is determined at completion based on current hand
- [ ] If all wounds healed during rest, Slow Recovery with no discard is valid
- [ ] UNDO works correctly for both declare and complete phases

## Test Plan

### Manual

1. Declare rest with hand of 4 wounds + Tranquility
2. Play Tranquility to heal 1 wound
3. Complete rest as Slow Recovery (only wounds remain)
4. Verify discard goes to discard pile (not healed)

5. Declare rest, try to move — should be blocked
6. Declare rest, try to enter combat — should be blocked
7. Declare rest, UNDO — should restore non-resting state

### Automated

- Expand `packages/core/src/engine/__tests__/rest.test.ts` with state-based tests

## Open Questions

1. **Card timing metadata**: How do we identify which cards are "Special Effects" playable during rest vs "Action Phase" cards? May need to coordinate with turn-structure ticket.

2. **Skill restrictions during rest**: The FAQ says "you can use many Skills and Units" — need to enumerate which skills are blocked during rest (those that count as "your Action").

3. **Site benefits**: Magical Glade wound discard is "End-of-Turn step" so allowed. What about other site benefits?

4. **Influence during rest**: FAQ says you can "play non-wound cards sideways for Influence" to gain AAs. This is interesting — you're playing a card for influence, not taking an action. Need to ensure this works.

## Rulebook References

- Resting Q1 A1, p.30: "When you Rest, you don't declare which kind of Rest you're doing (Standard Rest or Slow Recovery): you merely announce that you're Resting."
- Resting S3, p.30: "Resting doesn't prevent you from playing cards..."
- Resting S4, p.30: Movement restriction when only wounds in hand
- Resting S5, p.30: Monastery healing blocked, Magical Glade allowed
- Resting Q2 A2, p.30: Special case of healing all wounds during rest
