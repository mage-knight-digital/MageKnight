# Ticket: Mana Selection for Powered Card Play

**Created:** January 2025
**Updated:** January 2025
**Priority:** Low
**Complexity:** Medium
**Status:** Mostly Complete
**Affects:** Card play, mana UI, combat UX
**Authoritative:** No

---

## Summary

Powered play gating is fixed and mana selection UI exists for action cards and spells. Remaining work is mostly combat UI visibility and polish, not core logic.

## Problem Statement

Previously, powered options appeared without available mana. That is fixed. The remaining concern was selecting a mana source; the current UI supports this via a card action menu and a radial selector for spells.

## Current Behavior

- Powered options only show if mana is available (`packages/core/src/engine/validActions/mana.ts`).
- Action cards use `CardActionMenu` with available mana sources (crystals, tokens, dice) (`packages/client/src/components/Hand/PlayerHand.tsx`).
- Spells use a two-step mana source selection (black then color) via a radial menu (`packages/client/src/components/Hand/PlayerHand.tsx`).
- Mana sources are consumed by `playCardCommand` when `manaSource`/`manaSources` is provided.

## Expected Behavior

- Mana selection works for powered plays in both combat and non-combat contexts.
- UI exposes available sources during combat as needed.

## Scope

### In Scope
- Ensure combat overlays show/allow mana selection consistently.
- Verify powered play flow for spells and action cards.

### Out of Scope
- Redesigning the entire hand UI.

## Proposed Approach

- Confirm combat overlay access to hand menu/radial selection and mana source visibility.
- Add or adjust combat UI if sources are not visible during combat.

## Implementation Notes

- Core validation: `packages/core/src/engine/validActions/mana.ts`
- UI selection: `packages/client/src/components/Hand/PlayerHand.tsx`
- Powered play consumption: `packages/core/src/engine/commands/playCardCommand.ts`

## Acceptance Criteria

- [x] Powered options only appear when mana is available.
- [x] Player can select a mana source for action cards.
- [x] Player can select both sources for powered spells.
- [ ] Combat UI clearly exposes mana source options if needed.

## Test Plan

### Manual
1. Play a powered action card and select a mana source.
2. Play a powered spell and select black + color mana.
3. Verify mana sources are consumed.

## Open Questions

- Do we need explicit combat-only mana source UI, or is the hand menu sufficient?
