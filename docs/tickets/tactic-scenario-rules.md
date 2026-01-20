# Ticket: Scenario-Specific Tactic Rules

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Status:** Partially Complete
**Affects:** Tactics selection, scenario config, round flow
**Authoritative:** Yes

---

## Summary

Scenario config already supports tactic removal and dummy order. Solo-style removal (`all_used`) and dummy selection after humans are implemented. Co-op vote removal and dummy-before-humans are not yet implemented.

## Problem Statement

The tactics system supports some scenario-specific rules but not all. Co-op voting to remove a single used tactic and dummy-first selection remain unimplemented.

## Current Behavior

- Scenario config includes `tacticRemovalMode` and `dummyTacticOrder` (`packages/shared/src/scenarios.ts`).
- End-round removes all used tactics when `TACTIC_REMOVAL_ALL_USED` is set (`packages/core/src/engine/commands/endRoundCommand.ts`).
- Dummy tactic selection after humans is implemented in `selectTacticCommand` when `DUMMY_TACTIC_AFTER_HUMANS`.
- `TACTIC_REMOVAL_VOTE_ONE` and `DUMMY_TACTIC_BEFORE_HUMANS` are not implemented.

## Expected Behavior

- Co-op mode should allow players to vote to remove one used tactic at round end.
- Dummy-first selection should be supported when configured.

## Scope

### In Scope
- Implement vote-one tactic removal flow.
- Implement dummy-first tactic selection.

### Out of Scope
- Redesigning tactic selection UI.

## Proposed Approach

- Add a round phase for tactic removal voting in co-op.
- Extend `selectTacticCommand` to handle dummy-first selection when configured.

## Implementation Notes

- `packages/shared/src/scenarios.ts`
- `packages/core/src/engine/commands/selectTacticCommand.ts`
- `packages/core/src/engine/commands/endRoundCommand.ts`

## Acceptance Criteria

- [ ] Co-op vote removes one used tactic per round.
- [ ] Dummy-first selection works when configured.
- [x] All-used removal works for solo configurations.

## Test Plan

### Manual
1. Run solo scenario with removal mode `all_used` and verify tactics disappear.
2. Run co-op config and verify vote phase triggers and removes one tactic.

## Open Questions

- How should the vote UI be presented in the client?
