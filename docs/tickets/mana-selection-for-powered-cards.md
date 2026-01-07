# Ticket: Mana Selection for Powered Card Play

**Created:** January 2025
**Updated:** January 2025
**Priority:** ~~High~~ Low (core issue fixed)
**Complexity:** Medium
**Affects:** Combat UI, Card play system, Mana system
**Status:** Partially Complete

---

## Problem Statement

~~The UI currently shows "Powered" options for cards even when the player has no way to pay the mana cost.~~

**FIXED:** Powered options now only show when player has available mana (crystals, mana source dice, or pure mana tokens).

**Remaining work:** Add UI for selecting which mana source to use when playing powered cards.

---

## What Was Fixed

### Core Issue (RESOLVED)

- `getPlayableCardsForCombat()` now checks `canPayForMana()` before setting `canPlayPowered: true`
- `getManaOptions()` implemented and wired into `validActions.mana`
- Powered options only appear when player can actually pay for them

### Implementation Details

```typescript
// packages/core/src/engine/validActions/mana.ts
export function canPayForMana(state: GameState, player: Player, requiredColor: ManaColor): boolean {
  // Check pure mana tokens in play area
  // Check crystals (can be converted to their color)
  // Check mana source dice (if player hasn't used source this turn)
  // Handle gold/black wildcard mana
}
```

### Tests Added

- Unit tests in `playableCards.test.ts`:
  - "should allow Swiftness powered for ranged attack when mana is available"
  - "should NOT allow Swiftness powered when no mana is available"
  - "should not allow powered block without mana"

- E2E test in `combat.spec.ts`:
  - "seed 123 - powered option should NOT show without mana available"

---

## Remaining Work

### Phase 2: Mana Source Selection UI (NOT STARTED)

Currently, when a player has mana available and plays a powered card, the system needs a way to know WHICH mana source to consume:
- A die from the mana source?
- A crystal?
- A pure mana token from the play area?

**Options:**

1. **Auto-select** - Use crystals first, then pure mana, then dice (simplest)
2. **Sub-menu** - When clicking powered option, show sub-menu to select source
3. **Pre-selection** - Player clicks mana source first, then plays card

### Phase 3: Mana Consumption

When playing a powered card:
1. Include `manaSource: { type, id/color }` in action
2. Engine validates and consumes the mana
3. Update player state (remove crystal, mark die as used, etc.)

---

## Acceptance Criteria

- [x] `getManaOptions()` implemented and wired into `validActions.mana`
- [ ] Combat overlay shows available mana dice (UI enhancement)
- [ ] Player can select which mana source to use for powered play
- [x] Powered options only show when player can pay for them
- [ ] Playing powered card consumes selected mana
- [ ] E2E test passes (powered Swiftness can be played when mana available)

---

## Related Issues

- Event log not visible during combat modal (separate UI issue)
- Combat accumulator values not displayed (block/attack accumulated)

---

## Notes

We chose the "strict" approach after all - checking mana availability upfront rather than the "select mana first" flow. This is simpler because:
- No need for "pending mana" state
- Powered options just don't appear if you can't pay
- Matches how digital games typically handle resource costs
