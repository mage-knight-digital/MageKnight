# Ticket: Mana System Gaps and Rule Alignment

**Created:** January 2025
**Updated:** January 2025
**Priority:** Low
**Complexity:** Medium
**Status:** In Progress
**Affects:** Core engine, shared actions, client UI, rules fidelity
**Authoritative:** No

---

## Summary

Most mana flow is implemented, but crystal overflow handling, standalone mana actions, and combat UI visibility are inconsistent or missing. Some rules around crystal overflow conflict within the rulebook and need a decision.

## Problem Statement

Mana core mechanics work, but several edge cases and rule-alignment gaps remain. These gaps can produce illegal crystal counts, omit optional mana actions, or hide combat mana options from the player.

## Current Behavior

- **Mana Draw / Mana Pull** powered effects are implemented via `EFFECT_MANA_DRAW_POWERED` and `manaDrawEffects.ts`.
- **Crystallize** is implemented via `effects/crystallize.ts` and `EFFECT_CONVERT_MANA_TO_CRYSTAL`.
- **Crystal gain** in several paths does not enforce the 3-per-color limit or overflow behavior:
  - `applyGainCrystal()` in `packages/core/src/engine/effects/atomicEffects.ts`.
  - Crystal roll rewards in `packages/core/src/engine/helpers/rewards/handlers.ts`.
  - Crystallize resolution in `packages/core/src/engine/effects/crystallize.ts`.
- **Mine rewards** explicitly skip crystal gain if already at 3 (`packages/core/src/engine/commands/endTurn/siteChecks.ts`).
- **Standalone mana actions** exist in `packages/shared/src/actions.ts` but are not wired in core.
- **Combat UI** does not surface available mana options even though `validActions.mana` is populated.

## Expected Behavior

- Crystal gains should respect the 3-per-color limit and follow a clear overflow rule.
- Optional mana actions (use die, convert crystal) should be available if required by cards or player choice.
- Combat UI should display available mana sources consistently with non-combat UI.

## Scope

### In Scope
- Decide and implement crystal overflow behavior (cap vs overflow-to-token).
- Wire standalone mana actions (if still desired) through validators and commands.
- Surface mana source UI during combat.

### Out of Scope
- Reworking mana rules beyond alignment with the rulebook.
- Large UI redesigns for combat overlay.

## Proposed Approach

1. **Crystal overflow rule**: Align gain logic across effects and rewards. If overflow-to-token is adopted, implement in `applyGainCrystal()` and reward handlers; if not, cap and document exception for mines.
2. **Standalone mana actions**: Add validators/commands for `USE_MANA_DIE_ACTION` and `CONVERT_CRYSTAL_ACTION` if these are needed for gameplay flexibility.
3. **Combat UI**: Reuse `ManaSourcePanel` or add a compact display to the combat overlay.

## Implementation Notes

- Relevant files:
  - `packages/core/src/engine/effects/atomicEffects.ts`
  - `packages/core/src/engine/helpers/rewards/handlers.ts`
  - `packages/core/src/engine/effects/crystallize.ts`
  - `packages/core/src/engine/validators/index.ts`
  - `packages/core/src/engine/commands/index.ts`
  - `packages/client/src/components/Combat/CombatOverlay.tsx`
- Rulebook references:
  - General gain rule: `docs/rules/rulebook.md` ("Gain" effects: crystal overflow becomes mana token).
  - Mine reward sections also state "nothing happens" if at 3 crystals.

## Acceptance Criteria

- [ ] Crystal gains are consistent across effects and rewards and never exceed 3-per-color unless explicitly allowed.
- [ ] Overflow behavior is documented and implemented (token conversion or cap).
- [ ] Standalone mana actions are either implemented or explicitly removed from shared actions.
- [ ] Combat UI shows available mana sources.

## Test Plan

### Manual
1. Gain a 4th crystal via effect; verify overflow behavior matches decision.
2. Use Mana Draw / Mana Pull powered effects; verify tokens and source dice behavior.
3. Enter combat and confirm mana source visibility.

### Automated (optional)
- Unit tests for crystal overflow in `effects/atomicEffects` and `rewards/handlers`.

## Open Questions

- The rulebook has conflicting guidance: "Gain" effects say overflow becomes a mana token, while mine rewards say no gain when at 3. Which rule should the implementation follow?
