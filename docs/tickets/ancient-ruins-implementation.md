# Ticket: Ancient Ruins Site Implementation

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Medium-High
**Status:** Not Started
**Affects:** Core engine, shared types, map state, rules fidelity
**Authoritative:** Yes

---

## Summary

Implement Ancient Ruins using yellow tokens per `docs/reference/sites.md`, replacing the current night-only brown enemy placeholder.

## Problem Statement

Ancient Ruins currently behave like a simplified night-only monster den. This is incorrect per the rulebook, which uses yellow tokens that can represent altars or specific enemy/reward packages with day/night visibility rules.

## Current Behavior

- Site defenders at reveal: 1 brown enemy at night, none during day (`packages/core/src/engine/helpers/enemyHelpers.ts`).
- Entering ruins: draws/fights a brown enemy at night; day entry with no enemies auto-conquers (`packages/core/src/engine/commands/enterSiteCommand.ts`, `packages/core/src/engine/validators/siteValidators.ts`).
- No yellow token pool, no altar tribute action, no token-specific rewards.

## Expected Behavior

- Ancient Ruins use yellow tokens to determine altar vs enemy encounters.
- Tokens are face up during day, face down during night; night tokens reveal on entry or next day.
- Altar: pay 3 mana of the token color to gain 7 Fame and conquer the site.
- Enemies: fight enemies listed on the token; on victory, gain the token-specific reward and conquer the site.

## Scope

### In Scope
- Yellow token definitions and pool management.
- Hex state for ruins tokens (visibility + token id).
- Enter-site logic for altar vs enemy tokens.
- Rewards for token-specific outcomes.
- Token reveal rules for day/night.

### Out of Scope
- Lost Legion yellow tokens (design should be extensible).
- UI polish beyond exposing the token state.

## Proposed Approach

1. **Shared definitions**: Add `RuinsToken` types and base-game token set (4 altar + 4 enemy) in `packages/shared`.
2. **Core pools**: Add draw/discard piles and helpers for yellow tokens.
3. **Map state**: Track `ruinsToken` on hex with `isRevealed`.
4. **Explore flow**: Update `enterSiteCommand` to branch on token type and apply altar tribute or token enemies.
5. **Rewards**: Use existing `SiteReward` types for artifact/spell/advanced action/crystals/fame.
6. **Visibility**: Reveal on day, hide on night until entry or next day.

## Implementation Notes

- Touch points:
  - `packages/shared/src/ruinsTokens.ts` (new)
  - `packages/core/src/types/map.ts` (add ruins token state)
  - `packages/core/src/engine/helpers/ruinsTokenHelpers.ts` (new)
  - `packages/core/src/engine/commands/enterSiteCommand.ts`
  - `packages/core/src/engine/validators/siteValidators.ts`
- Ensure `EnemyId` mapping for token-defined enemies, not brown token draw.
- Reconcile conquest flow so altar tribute is a valid action (not combat).

## Acceptance Criteria

- [ ] Ruins use yellow tokens, not brown enemy tokens, for both day and night.
- [ ] Day/night reveal rules match `docs/reference/sites.md`.
- [ ] Altar tribute spends 3 mana of the token color and grants 7 Fame.
- [ ] Enemy tokens spawn the correct enemies and rewards.

## Test Plan

### Manual
1. Reveal Ancient Ruins during day; confirm token is face up and visible.
2. Reveal Ancient Ruins during night; confirm token is face down until entry or day.
3. Enter altar ruins; pay mana and gain 7 Fame; site is conquered.
4. Enter enemy ruins; resolve combat; reward matches token; conquest on victory.

### Automated (optional)
- Add unit tests for token draw/reshuffle and visibility rules.
- Update `enemiesOnMap`/`enterSite` tests to cover ruins token cases.

## Open Questions

- Should altar tribute be a separate player action type or handled inside enter-site?
- How should UI display face-down ruins tokens to players at night?
