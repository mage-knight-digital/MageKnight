# Ticket: Enemy Visibility and Combat Undo

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Status:** In Progress
**Affects:** Combat undo, map state, movement reveal
**Authoritative:** No

---

## Summary

Enemy visibility tracking is already implemented, but combat undo is still overly restrictive for some commands. Align reversibility with whether new information is revealed.

## Problem Statement

Some combat commands remain irreversible even when no hidden information is revealed. This is stricter than necessary and impacts undo UX.

## Current Behavior

- `HexEnemy` already tracks `isRevealed` (`packages/core/src/types/map.ts`).
- Enemies are revealed when a player becomes adjacent during day (`packages/core/src/engine/commands/moveCommand.ts`).
- `enterCombatCommand` is reversible and implements undo (`packages/core/src/engine/commands/combat/enterCombatCommand.ts`).
- Several combat phase commands are still irreversible (`declareBlockCommand`, `declareAttackCommand`, `assignDamageCommand`, `endCombatPhaseCommand`).

## Expected Behavior

- Combat commands should be reversible unless they end combat or reveal hidden info.
- Undo should be allowed for in-combat decisions that don’t expose new info.

## Scope

### In Scope
- Reassess `isReversible` on combat phase commands.
- Ensure combat end remains irreversible.

### Out of Scope
- Redesigning enemy visibility rules (already implemented).

## Proposed Approach

- Keep `enterCombatCommand` reversible.
- Flip `isReversible` to true for `declareBlock`, `declareAttack`, and `assignDamage`.
- Keep `endCombatPhaseCommand` reversible for phase transitions but not for combat completion.

## Implementation Notes

- Files:
  - `packages/core/src/engine/commands/combat/declareBlockCommand.ts`
  - `packages/core/src/engine/commands/combat/declareAttackCommand.ts`
  - `packages/core/src/engine/commands/combat/assignDamageCommand.ts`
  - `packages/core/src/engine/commands/combat/endCombatPhaseCommand.ts`
- Visibility logic already lives in `packages/core/src/engine/helpers/enemyHelpers.ts` and `packages/core/src/engine/commands/moveCommand.ts`.

## Acceptance Criteria

- [ ] Block/attack/damage commands are reversible when combat is ongoing.
- [ ] Ending combat remains irreversible.
- [ ] No regressions in combat flow or undo behavior.

## Test Plan

### Manual
1. Enter combat and assign block/attack/damage; undo each step.
2. End combat; undo should be unavailable.

## Open Questions

- Should phase transitions be reversible after any damage is assigned?
