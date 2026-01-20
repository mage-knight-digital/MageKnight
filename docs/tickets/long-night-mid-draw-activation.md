# Ticket: Long Night Mid-Draw Activation

**Created:** January 2025
**Updated:** January 2025
**Priority:** Low
**Complexity:** Low-Medium
**Status:** Backlog
**Affects:** End-of-turn draw flow, tactic activation
**Authoritative:** Yes

---

## Summary

Long Night should be usable when the deck empties mid-draw at end of turn, per rulebook. Current draw logic stops immediately and does not offer the tactic.

## Problem Statement

`processCardFlow` stops drawing when the deck empties and does not allow mid-draw activation of Long Night, which deviates from the rulebook.

## Current Behavior

- End-of-turn draw stops when deck empties (`packages/core/src/engine/commands/endTurn/cardFlow.ts`).
- Long Night is activatable only as a normal tactic action and requires an empty deck (`packages/core/src/engine/commands/activateTacticCommand.ts`).

## Expected Behavior

- If the deck empties while drawing, the player can activate Long Night immediately and continue drawing.

## Scope

### In Scope
- Add a mid-draw interrupt path to offer Long Night activation.
- Resume drawing after activation.

### Out of Scope
- Changes to Long Night’s core effect.

## Proposed Approach

- Refactor `processCardFlow` to return a pending decision when deck empties mid-draw and Long Night is available.
- Resume drawing after tactic resolution.

## Implementation Notes

- Rulebook reference: `docs/rules/rulebook.md` (Long Night note after line ~894).
- Files:
  - `packages/core/src/engine/commands/endTurn/cardFlow.ts`
  - `packages/core/src/engine/commands/activateTacticCommand.ts`
  - UI to prompt tactic activation during draw

## Acceptance Criteria

- [ ] When deck empties mid-draw, Long Night can be activated immediately.
- [ ] After activation, drawing continues to the hand limit.

## Test Plan

### Manual
1. End turn with deck smaller than draw requirement and Long Night selected.
2. Confirm activation prompt during draw and continued draw after activation.

## Open Questions

- Should the prompt appear automatically or require explicit player action?
