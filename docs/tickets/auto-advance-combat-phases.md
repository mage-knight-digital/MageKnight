# Ticket: Auto-Advance Combat Phases When All Enemies Defeated

**Created:** January 2025
**Updated:** January 2025
**Priority:** Low
**Complexity:** Low
**Status:** Not Started
**Affects:** Combat flow, client UX
**Authoritative:** No

---

## Summary

When all enemies are defeated during Ranged/Siege, the player still needs to click through empty phases. Consider auto-advancing or a single “Finish Combat” action.

## Problem Statement

Combat phases currently advance only via manual `END_COMBAT_PHASE_ACTION`. There is no server-side auto-skip when all enemies are defeated, so the player must click through Block/Damage/Attack even when nothing remains.

## Current Behavior

- Phase changes occur only via `END_COMBAT_PHASE_ACTION` (`packages/core/src/engine/commands/combat/endCombatPhaseCommand.ts`).
- UI presents a phase rail button; player must click through remaining phases.

## Expected Behavior

- When all enemies are already defeated, remaining phases should be auto-skipped or collapsed into a single “Finish Combat” action.

## Scope

### In Scope
- Reduce redundant clicks after all enemies are defeated.

### Out of Scope
- Changes to combat resolution logic or rewards.

## Proposed Approach

- Option A: Server-side auto-advance to combat end when all enemies are defeated.
- Option B: Client-side auto-click through phases (less ideal).
- Option C: Add a dedicated “Finish Combat” action when all enemies are defeated.

## Implementation Notes

- Server hook: `packages/core/src/engine/commands/combat/endCombatPhaseCommand.ts`.
- Client hook: `packages/client/src/components/Combat/VerticalPhaseRail.tsx` and `packages/client/src/components/Combat/CombatOverlay.tsx`.

## Acceptance Criteria

- [ ] Defeating all enemies in Ranged/Siege ends combat with minimal clicks.
- [ ] Player can still delay if they want to play more cards before ending.

## Test Plan

### Manual
1. Defeat all enemies during Ranged/Siege.
2. Verify combat ends immediately or with a single “Finish Combat” click.

## Open Questions

- Should players be allowed to linger to play optional effects after enemies are defeated?
