# Ticket: Unit Combat Integration

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Status:** In Progress
**Affects:** Combat system, units UI
**Authoritative:** Yes

---

## Summary

Core unit combat logic exists (activation validation, command, damage assignment), and the UI shows owned units. Remaining gaps are combat UI for activating units and completing special abilities.

## Problem Statement

Units can be recruited and their combat effects are implemented in the engine, but players do not yet have a combat UI to activate unit abilities or assign damage through the UI.

## Current Behavior

- Unit activation is implemented server-side (`activateUnitCommand`, `validActions/units/activation.ts`).
- Damage assignment supports units (`assignDamageCommand.ts`).
- Owned units UI exists (`FloatingUnitCarousel`).
- No combat UI for activating units or selecting damage assignments.

## Expected Behavior

- Players can activate unit abilities during combat.
- Players can assign damage to units via UI.
- Special unit abilities are supported (mana generation, etc.).

## Scope

### In Scope
- Combat UI for unit activation.
- Damage assignment UI for unit targets.
- Special ability handling for units that require custom flows.

### Out of Scope
- Non-combat unit management beyond existing UI.

## Proposed Approach

- Surface `validActions.units` in combat overlay.
- Add UI affordances to activate unit abilities and choose damage targets.
- Implement any remaining special unit abilities.

## Implementation Notes

- Core logic: `packages/core/src/engine/commands/units/activateUnitCommand.ts`
- Combat damage: `packages/core/src/engine/commands/combat/assignDamageCommand.ts`
- UI: `packages/client/src/components/Hand/FloatingUnitCarousel.tsx`

## Acceptance Criteria

- [ ] Unit abilities can be activated in combat via UI.
- [ ] Damage can be assigned to units via UI.
- [ ] Special unit abilities are implemented where needed.

## Test Plan

### Manual
1. Recruit a unit and enter combat.
2. Activate its ability and verify combat accumulator changes.
3. Assign damage to a unit and verify wound/destroy logic.

## Open Questions

- Which UI pattern should be used for unit activation in combat (radial menu vs inline buttons)?
