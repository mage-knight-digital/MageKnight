# Ticket: Show enemy armor reduction in UI

**Created:** January 2025
**Updated:** September 2025
**Priority:** Medium
**Complexity:** Low
**Status:** Not Started
**Affects:** Client combat UI, server client-state mapping
**Authoritative:** No

---

## Summary

When effects like Tremor reduce enemy armor, the UI still displays the base armor value. We should surface effective armor in the combat UI so players can see active debuffs without inferring from attack requirements.

## Problem Statement

Armor reduction is applied in combat resolution, but the UI only shows base armor. This creates confusion and forces players to cross-check the attack button or memorize the effect.

## Current Behavior

- `packages/server/src/index.ts` sends `ClientCombatEnemy.armor` using `enemy.definition.armor` only.
- `packages/core/src/engine/modifiers.ts` computes effective armor via `getEffectiveEnemyArmor`, but the result is not surfaced to the client.
- The UI relies on `EnemyCard` base armor display with no debuff indicator.

## Expected Behavior

When enemy armor is reduced, the UI should show the effective armor and optionally the base armor in a secondary/struck-through format.

## Scope

### In Scope
- Add an effective armor value to the client combat state.
- Update the enemy card UI to display reduced armor with a clear visual cue.

### Out of Scope
- Redesigning the entire combat card layout.
- Visual effects for other modifiers not related to armor.

## Proposed Approach

- Compute effective armor on the server using existing modifier logic and include it in `ClientCombatEnemy`.
- In the client, compare base vs effective armor and show a reduced indicator (strike-through or arrow).

## Implementation Notes

- Add `effectiveArmor` to `packages/shared/src/types/clientState.ts` `ClientCombatEnemy`.
- Update `packages/server/src/index.ts` `toClientCombatState` to call `getEffectiveEnemyArmor` and include it.
- Adjust `packages/client/src/components/Combat/EnemyCard.tsx` to display reduced armor when `effectiveArmor < armor`.

## Acceptance Criteria

- [ ] Enemy cards show reduced armor when modifiers are active.
- [ ] Base armor remains visible (strike-through or secondary display).
- [ ] No change for enemies without armor reduction.

## Test Plan

### Manual
1. Start combat, apply an armor-reduction effect (e.g., Tremor).
2. Verify the enemy card shows the reduced armor value.

### Automated (optional)
- UI snapshot/unit test for `EnemyCard` when `effectiveArmor < armor`.

## Open Questions

- Preferred UI treatment for reduced armor (arrow vs strike-through)?
