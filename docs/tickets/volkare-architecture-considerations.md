# Ticket: Volkare architecture considerations

**Created:** July 2024
**Updated:** September 2025
**Priority:** Low
**Complexity:** High
**Status:** Not Started
**Affects:** Core turn system, combat model, movement validation
**Authoritative:** No

---

## Summary

Volkare (Lost Legion) introduces a non-player turn actor with its own rules and movement. The current engine assumes every turn actor is a full `Player`, so we need architecture hooks to support a lightweight, non-player actor.

## Problem Statement

The existing engine and validators are player-centric (turn order, movement, combat resolution). Volkare requires a different rule set (ignores terrain, has its own deck interpretation, initiates combat), which cannot be expressed cleanly with the current `Player` model alone.

## Current Behavior

- Turn validation and command execution assume `playerId` refers to a `Player` in state.
- Combat state does not track initiator/defender identity beyond the player.
- Movement validators check `player.movePoints` and terrain costs.

## Expected Behavior

Engine systems should be extensible to include a non-player turn actor with custom movement and combat rules, without breaking existing player flows.

## Scope

### In Scope
- Define an architectural plan for supporting a non-player turn actor.
- Identify engine modules that need abstraction (turn validation, combat participants, movement checks).

### Out of Scope
- Full Volkare rules implementation.
- New UI components or content for Lost Legion.

## Proposed Approach

- Introduce an `ActorId`/`TurnActor` concept that can represent either a player or a special entity (e.g., `"volkare"`).
- Add optional combat metadata (initiator/defender) so combat can be initiated by non-player actors.
- Allow movement validation to be bypassed or replaced for non-player actors.

## Implementation Notes

- Consider adding a `VolkareState` to `GameState` when the expansion is enabled.
- `packages/core/src/engine/validators/turnValidators.ts` should validate actors, not just players.
- `packages/core/src/types/combat.ts` should allow initiator/defender references beyond player IDs.

## Acceptance Criteria

- [ ] Turn validation can accept a non-player actor ID without throwing.
- [ ] Combat state can record a non-player initiator/defender.
- [ ] Movement validation can be bypassed or replaced for a non-player actor.

## Test Plan

### Manual
1. Stub a non-player actor and verify turn sequencing can include it.
2. Trigger a combat initiated by the non-player actor and ensure combat state persists.

### Automated (optional)
- Unit test for turn validation supporting a non-player actor.

## Open Questions

- Do we want a generic `Actor` abstraction now, or only add it when implementing Volkare?
- Should non-player actors reuse the same command pipeline or have a separate AI action executor?
