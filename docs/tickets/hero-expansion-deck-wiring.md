# Ticket: Hero Expansion Deck Wiring

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Status:** Not Started
**Affects:** Hero selection, starting decks, scenario config
**Authoritative:** Yes

---

## Summary

Expansion-aware hero availability and starting deck composition are not yet wired to `ScenarioConfig.enabledExpansions`.

## Problem Statement

Hero definitions include expansion heroes and mention expansion-only replacements, but the selection and deck building logic do not yet respect `enabledExpansions`.

## Current Behavior

- `HEROES` includes expansion heroes and base-game decks with single unique replacements (`packages/core/src/types/hero.ts`).
- TODO comments note that Lost Legion replacements and hero selection gating are not wired.
- Scenario configs include `enabledExpansions` but no selection validation uses it (`packages/shared/src/scenarios.ts`, `packages/core/src/data/scenarios/*`).

## Expected Behavior

- Expansion heroes only available when their expansion is enabled.
- Base heroes receive expansion-specific replacements when those expansions are enabled.

## Scope

### In Scope
- Add helpers for available heroes and expansion-aware deck building.
- Validate hero selection against enabled expansions.

### Out of Scope
- Fine-grained component toggles beyond `enabledExpansions`.

## Proposed Approach

- Add `getAvailableHeroes(enabledExpansions)`.
- Add `getStartingDeckForHero(hero, enabledExpansions)` using replacement rules.
- Use these in player creation and hero selection validation.

## Implementation Notes

- `packages/core/src/types/hero.ts` (deck building)
- `packages/shared/src/scenarios.ts` (expansion list)
- Player initialization and hero selection flow

## Acceptance Criteria

- [ ] Expansion heroes are unavailable unless the expansion is enabled.
- [ ] Base heroes receive expansion-specific card replacements when enabled.

## Test Plan

### Manual
1. Start scenario with no expansions; expansion heroes unavailable.
2. Enable Lost Legion; Wolfhawk appears and base heroes receive second replacements.

## Open Questions

- Should expansion-specific base hero replacements be optional independently of the expansion toggle?
