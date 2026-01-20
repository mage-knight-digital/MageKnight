# Ticket: Turn Structure, Phase Enforcement, and Card Timing

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Status:** Not Started
**Affects:** Turn management, action validation, card system
**Authoritative:** Yes

---

## Summary

The engine does not fully enforce Mage Knight’s turn structure (movement → one action or rest), and card timing rules are only partially represented. This ticket aligns turn phases and action gating with the rulebook.

## Problem Statement

Current turn state is tracked with booleans and does not prevent illegal sequences (e.g., rest after movement) or enforce a single action per turn. The rulebook also distinguishes “special effects” that can be played anytime, but the card model does not encode timing metadata.

## Current Behavior

- Turn tracking uses `hasMovedThisTurn` and `hasTakenActionThisTurn` (`packages/core/src/types/player.ts`).
- Movement is blocked after `hasTakenActionThisTurn` (`packages/core/src/engine/validActions/movement.ts`).
- Some actions set `hasTakenActionThisTurn` (enter site, interact, rest, recruit, etc.).
- Card timing is only partially enforced via combat phase checks (`validActions/cards.ts`, `resolvability.ts`) and helper effects like `ifInPhase` for combat.
- Rest is validated only by card discard rules and the “already acted” check (`packages/core/src/engine/validators/restValidators.ts`).

## Expected Behavior

- Players choose either **Regular Turn** (movement then one action) or **Resting** (no movement, no action).
- Movement cannot occur after an action; unspent Move/Influence is lost when action starts.
- “Special effects” and healing can be played at any time on the player’s turn (except during combat or end-of-turn), while movement and influence effects are expected to be used during their phases.

## Scope

### In Scope
- Explicit turn phase tracking (movement/action/resting/ended).
- Enforce one-action-per-turn and rest as exclusive choice.
- Add card timing metadata to distinguish special/anytime/combat-only effects.

### Out of Scope
- Rewriting combat phase logic (already handled).
- Changing individual card effects unless required for timing metadata.

## Proposed Approach

1. **Turn phase state**: Replace or augment boolean flags with `turnPhase` enum in player state.
2. **Phase gating**: Update `validActions` and action validators to enforce movement-before-action and rest exclusivity.
3. **Card timing metadata**: Add `playTiming` to card definitions and enforce in card validation and resolvability.

## Implementation Notes

- Files to touch:
  - `packages/core/src/types/player.ts`
  - `packages/shared/src/types/clientState.ts`
  - `packages/core/src/engine/validActions/*`
  - `packages/core/src/engine/validators/*`
  - `packages/core/src/types/cards.ts`
- Rulebook reference: `docs/rules/rulebook.md` → “A Player’s Turn” and phase ordering.

## Acceptance Criteria

- [ ] Turn phase is explicit and enforced; illegal sequences are rejected.
- [ ] Rest cannot be chosen after movement or action.
- [ ] One action per turn is enforced consistently across action types.
- [ ] Card timing metadata exists and is enforced in validation.

## Test Plan

### Manual
1. Attempt movement after taking an action; should be blocked.
2. Attempt rest after moving; should be blocked.
3. Attempt two actions in one turn; second should be blocked.
4. Verify special effects remain playable anytime during turn, not during combat/end-of-turn.

### Automated (optional)
- Add unit tests to `validActions` and `validators` for phase gating.

## Open Questions

- Which existing card effects should be tagged as “anytime” vs “movement/action only”?
