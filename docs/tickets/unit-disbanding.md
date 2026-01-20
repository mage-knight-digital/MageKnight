# Ticket: Unit disbanding on recruitment at command limit

**Created:** July 2024
**Updated:** September 2025
**Priority:** Medium
**Complexity:** Medium
**Status:** Not Started
**Affects:** Core engine recruitment flow, shared actions/events, unit offer UI
**Authoritative:** Yes

---

## Summary

Recruitment currently fails when a player is at their command limit, but the rulebook requires players to disband an existing unit to make room. We need to allow recruitment at the command limit by forcing a disband choice during the recruit flow.

## Problem Statement

The rules explicitly allow recruitment at the command limit if the player disbands a unit. Today, command slots block recruitment entirely, which prevents legal gameplay and misleads the UI about why recruitment is unavailable.

## Current Behavior

- `packages/core/src/engine/validActions/units/recruitment.ts` sets `canAfford` to `false` when command tokens are full.
- `packages/core/src/engine/validators/units/recruitmentValidators.ts` returns `NO_COMMAND_SLOTS` if `player.units.length >= player.commandTokens`.
- `packages/core/src/engine/commands/units/recruitUnitCommand.ts` only adds the recruited unit and has no disband step.
- `packages/shared/src/actions.ts` defines `DISBAND_UNIT_ACTION`, but no core command/validator implements it.

## Expected Behavior

When a player recruits at the command limit, the UI should prompt them to disband an existing unit. The server should validate and apply the disband before adding the newly recruited unit.

## Scope

### In Scope
- Allow recruitment offers even when command slots are full.
- Require disband selection as part of recruitment when at the command limit.
- Permanently remove the disbanded unit from the player.

### Out of Scope
- Disbanding for combat rewards (rulebook line 868).
- Banner discard handling (not implemented).
- Freeform disbanding outside recruitment.

## Proposed Approach

- Add a `requiresDisband` flag to recruitable unit options when command slots are full.
- Extend the recruitment action/command to include the disbanded unit instance ID, or use a pending choice flow that forces a disband selection before completing recruitment.
- Relax command-slot validation to allow recruitment if a disband is provided or pending.

## Implementation Notes

- Update `packages/core/src/engine/validActions/units/recruitment.ts` to compute `requiresDisband` and allow `canAfford` based on influence only.
- Add `disbandUnitInstanceId?: string` to `RecruitUnitAction` (or introduce a pending choice and a follow-up `DISBAND_UNIT_ACTION`).
- Implement server-side validation for disband targets and ownership.
- Update `packages/core/src/engine/commands/units/recruitUnitCommand.ts` to remove the disbanded unit before adding the new one.
- Wire the client offer UI (`packages/client/src/components/Offers/UnitOfferPanel.tsx` or equivalent) to collect the disband choice.

## Acceptance Criteria

- [ ] Recruitment is available at the command limit when the player has enough influence.
- [ ] Recruiting at the command limit requires selecting a unit to disband.
- [ ] Disbanded units are removed from the player and not returned to any deck.

## Test Plan

### Manual
1. Fill command tokens, open a recruitment site, and verify recruitment is offered with a disband requirement.
2. Recruit a unit, select one to disband, and confirm the roster updates correctly.

### Automated (optional)
- Unit test for recruit validation when command slots are full and disband is provided.

## Open Questions

- Should the disband be a separate `DISBAND_UNIT_ACTION` or a field on `RECRUIT_UNIT_ACTION`?
- Do we need a generic pending-choice flow for disbanding (reused later for rewards)?
