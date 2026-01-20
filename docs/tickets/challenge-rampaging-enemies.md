# Ticket: Challenge Rampaging Enemies Action

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Status:** Not Started
**Affects:** Combat system, valid actions, movement rules
**Authoritative:** Yes

---

## Summary

Players should be able to voluntarily challenge adjacent rampaging enemies as a turn action. This is not currently available.

## Problem Statement

The engine supports rampaging enemy provocation via movement and blocks entering rampaging hexes, but it does not allow the voluntary “challenge from adjacent” action described in the rulebook.

## Current Behavior

- Rampaging provocation is supported via movement (`packages/core/src/engine/commands/moveCommand.ts`).
- Entering a rampaging hex is blocked (`packages/core/src/engine/validators/movementValidators.ts`).
- No action exists to challenge from adjacent; no valid action or command is defined.

## Expected Behavior

- If adjacent to rampaging enemies, the player can choose to challenge one or more of them as their action.
- Challenged rampaging enemies join combat and are not required for conquest.

## Scope

### In Scope
- Add a challenge action type and valid action discovery.
- Add a command to start combat (or add enemies to existing combat).

### Out of Scope
- UI polish beyond basic action wiring.

## Proposed Approach

- Introduce `CHALLENGE_RAMPAGING_ACTION` with target hex selection.
- Compute valid challenge targets from adjacent hexes with `rampagingEnemies` markers.
- Command should either start combat or append to existing combat started by assault/provocation.

## Implementation Notes

- Rulebook references: `docs/rules/rulebook.md` lines ~412, ~600.
- Expected touch points:
  - `packages/shared/src/actions.ts`
  - `packages/shared/src/types/validActions.ts`
  - `packages/core/src/engine/validActions/*`
  - `packages/core/src/engine/commands/*`

## Acceptance Criteria

- [ ] Player can challenge adjacent rampaging enemies as an action.
- [ ] Multiple adjacent rampaging enemies can be selected.
- [ ] Challenged enemies are not required for conquest.

## Test Plan

### Manual
1. Stand adjacent to rampaging enemy and challenge it; combat starts.
2. Stand adjacent to multiple rampaging enemies and select one or more.

## Open Questions

- Should challenging be allowed after a combat has already been triggered this turn (assault/provocation)?
