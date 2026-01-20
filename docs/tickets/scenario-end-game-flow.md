# Ticket: Scenario End and Game End Flow Validation

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Status:** Needs Review
**Affects:** Game lifecycle, UI state
**Authoritative:** Yes

---

## Summary

Scenario end vs game end flow appears mostly correct in core logic, but UI and action restrictions during final turns need review.

## Problem Statement

After `SCENARIO_END_TRIGGERED`, players can still act, which should be valid (final turns). The question is whether any actions should be restricted and whether the UI communicates final turn state clearly.

## Current Behavior

- Scenario end triggered on city reveal (First Recon) in `exploreCommand`.
- `finalTurnsRemaining` is set to player count, and decremented on each end turn.
- `endRoundCommand` ends the game immediately if the round ends during final turns.
- Client state includes `scenarioEndTriggered`.

## Expected Behavior

- Triggering player completes the current turn.
- All players get exactly one final turn (per scenario rules).
- Game ends when final turns are exhausted, or round ends during final turns.

## Scope

### In Scope
- Verify action validity during final turns (should remain normal).
- Ensure UI communicates “final turns remaining.”

### Out of Scope
- Adding new scenario end triggers beyond current scenarios.

## Proposed Approach

- Add UI indicators based on `scenarioEndTriggered` and `finalTurnsRemaining`.
- Add tests for final-turn action allowance and game-end action blocking.

## Implementation Notes

- `packages/core/src/engine/commands/exploreCommand.ts`
- `packages/core/src/engine/commands/endTurn/turnAdvancement.ts`
- `packages/core/src/engine/commands/endRoundCommand.ts`
- `packages/shared/src/types/clientState.ts`

## Acceptance Criteria

- [ ] Final turns are handled correctly for solo and multiplayer.
- [ ] UI indicates final turns remaining.
- [ ] Actions are blocked after `gameEnded`.

## Test Plan

### Automated (optional)
- Add tests for action allowance during final turns.
- Add tests that reject actions after `gameEnded`.

## Open Questions

- Should any actions be restricted during final turns beyond normal rules?
