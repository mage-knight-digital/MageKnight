# Ticket: Walls (Lost Legion)

**Created:** January 2025
**Updated:** September 2025
**Priority:** Medium
**Complexity:** High
**Status:** Not Started
**Affects:** Map data model, movement, combat fortification, provocation, UI
**Authoritative:** Yes

---

## Summary

Lost Legion introduces walls on tile edges that add movement cost, block provocation, and modify combat fortification. The current engine has no wall data model or gameplay logic for walls.

## Problem Statement

Wall rules affect core movement and combat calculations, but tiles only contain wall information as comments. Without a wall model, movement costs and provocation are wrong for Lost Legion maps.

## Current Behavior

- Wall locations exist only as comments in tile data (`packages/core/src/data/tiles/countrysideExpansion.ts`, `packages/core/src/data/tiles/coreExpansion.ts`).
- No `HexState` or tile definition stores wall edges.
- Movement and provocation ignore walls.

## Expected Behavior

- Walls are stored as edge data on hexes.
- Crossing a wall costs +1 Move and cannot be negated by terrain discounts.
- Walls block provocation across that edge.
- Walls increase fortification in combat (including double-fortified when crossing a wall into a fortified site).
- UI renders wall edges on the map.

## Scope

### In Scope
- Introduce a wall data model in tile definitions and hex state.
- Update movement cost, provocation, and combat fortification to respect walls.
- Render walls on the map UI.

### Out of Scope
- Full Lost Legion scenario rules.
- Volkare AI behavior (separate ticket).

## Proposed Approach

- Add a `walls` field to tile definitions and expand it into per-hex wall edges during tile placement.
- Add helpers like `hasWallBetween(from, to)` and `getWallCost(from, to)`.
- Update movement cost and provocation checks to use the wall helpers.
- Extend combat fortification calculations to treat walls as fortification (including double fortified).
- Render walls on client hexes based on the per-hex wall edge list.

## Implementation Notes

- Data model updates:
  - `packages/core/src/data/tiles/*` (define wall segments).
  - `packages/core/src/types/map.ts` or equivalent for `HexState.walls`.
- Gameplay logic updates:
  - Movement cost calculation (likely in `packages/core/src/engine/commands/moveCommand.ts` or helpers).
  - Provocation checks (move validator/command).
  - Combat fortification checks (combat helpers or valid-actions).
- Client rendering:
  - Map hex UI component (likely `packages/client/src/components/Map` or `HexGrid`).

## Acceptance Criteria

- [ ] Wall edges are stored on hex state after tile placement.
- [ ] Crossing a wall costs +1 Move and ignores terrain discounts.
- [ ] Walls block provocation across that edge.
- [ ] Combat across a wall treats enemies as fortified (and double-fortified if already fortified).
- [ ] Map UI renders wall segments.

## Test Plan

### Manual
1. Place a Lost Legion tile with walls and confirm wall edges render.
2. Move across a wall and confirm +1 cost applies.
3. Move adjacent to a rampaging enemy across a wall and confirm no provocation.

### Automated (optional)
- Unit tests for `hasWallBetween` and wall movement cost.

## Open Questions

- What is the exact mechanical meaning of “double fortified” in Lost Legion rules?
- Do walls only exist within a single tile or can they exist across tile boundaries?
