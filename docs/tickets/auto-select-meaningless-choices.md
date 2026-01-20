# Ticket: Auto-Select Meaningless Choices

**Created:** January 2025
**Updated:** January 2025
**Priority:** Low
**Complexity:** Medium
**Status:** Not Started
**Affects:** Core engine, choice resolution UX
**Authoritative:** No

---

## Summary

Reduce unnecessary clicks by auto-selecting choices that are strictly dominated (e.g., Tremor with only one enemy).

## Problem Statement

The choice system only auto-resolves when there is exactly one resolvable option. Some choices are still forced even when one option is objectively better given current combat context.

## Current Behavior

- Choice chaining auto-resolves only when a single option remains (`packages/core/src/engine/commands/resolveChoiceCommand.ts`).
- Tremor produces a two-option choice: target one enemy vs all enemies, even when only one enemy exists (`packages/core/src/data/spells.ts`).
- Enemy selection itself already auto-resolves when only one enemy is eligible (`packages/core/src/engine/effects/combatEffects.ts`).

## Expected Behavior

- When a choice is strictly dominated given state, auto-select the best option.
- Example: With one enemy, Tremor should auto-pick “target enemy -3/-4” instead of prompting a choice.

## Scope

### In Scope
- Auto-select logic for clearly dominated combat choices (starting with Tremor pattern).
- Keep existing “single resolvable option” auto-resolve.

### Out of Scope
- General-purpose semantic optimizer for all effects (unless needed later).

## Proposed Approach

- Add a narrow, explicit detector for the “target one vs all” pattern when only one enemy is present.
- Alternatively, annotate choice effects with metadata to allow auto-selection rules.

## Implementation Notes

- Potential touch points:
  - `packages/core/src/engine/commands/resolveChoiceCommand.ts`
  - `packages/core/src/types/cards.ts` (if adding metadata)

## Acceptance Criteria

- [ ] Tremor with one enemy auto-resolves to the single-target option.
- [ ] Tremor with 2+ enemies still presents the choice.
- [ ] Existing single-option auto-resolve behavior remains unchanged.

## Test Plan

### Manual
1. Enter combat with one enemy.
2. Play Tremor; confirm no choice prompt for target-vs-all.

### Automated (optional)
- Add tests around choice resolution for the Tremor pattern.

## Open Questions

- Should auto-select apply only to specific cards (e.g., Tremor) or be generalized via metadata?
