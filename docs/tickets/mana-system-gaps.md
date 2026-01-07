# Ticket: Mana System Implementation Gaps

**Created:** January 2025
**Updated:** January 2025
**Priority:** Low
**Complexity:** Low-Medium
**Status:** Mostly Complete

---

## Overview

The mana system is **largely complete** on both server and client.

**COMPLETED:**
- ✅ Server-side mana validation and consumption
- ✅ Client auto-selects mana source when playing powered cards
- ✅ Powered options only show when player can afford them

---

## What's Working

### Server-Side (Complete)

#### Mana Dice (Source)
- [x] Creation: `playerCount + 2` dice with basic color constraint
- [x] Once-per-turn limit enforced via `usedManaFromSource` flag
- [x] Die rerolling at end of turn
- [x] Gold depleted at NIGHT, Black depleted at DAY
- [x] Track `takenByPlayerId` on each die
- [x] Dungeon/tomb override for black mana during day

#### Mana Tokens (Pure Mana)
- [x] Storage in `player.pureMana` array
- [x] Cleanup at end of turn (reset to empty)
- [x] Track source (die/card/skill/site)
- [x] Consumption when powering cards

#### Crystals
- [x] Storage in `player.crystals` (red/blue/green/white)
- [x] Consumption when powering cards
- [x] Restoration on undo

#### Powering Cards
- [x] Full validation chain in `manaValidators.ts`
- [x] Consumption logic in `playCardCommand.ts`
- [x] Gold mana as wildcard (day only)
- [x] Black mana for spells only (night/dungeon)
- [x] Color matching validation
- [x] `manaUsedThisTurn` tracking for conditional effects

### Client-Side (Complete)

#### Mana Source Auto-Selection (DONE)
- [x] `findAvailableManaSource()` in `PlayerHand.tsx`
- [x] Priority: crystal > token > die > gold wildcard
- [x] Sends `manaSource` in `PlayCardAction` when `powered: true`

#### Validation Integration (DONE)
- [x] `canPayForMana()` checks before showing powered option
- [x] Powered options hidden when player can't afford them
- [x] E2E tests verify behavior

---

## Remaining Gaps (Low Priority)

### 1. Crystal Overflow Rule

When gaining a 4th crystal of a color, it should become a mana token instead.

**Current:** Not implemented - likely just silently caps at 3
**Expected:** Overflow to `pureMana` array as a token

**Files to modify:**
- Whatever handles gaining crystals (not yet implemented - no cards do this)

---

### 2. Standalone Mana Actions

These actions are **defined in shared** but **not wired in core**:

```typescript
// packages/shared/src/actions.ts
USE_MANA_DIE_ACTION    // Take a die from source independently
CONVERT_CRYSTAL_ACTION // Convert crystal to mana token independently
```

**Current:** Not needed - mana usage is integrated into card powering
**Future:** May be useful for:
- Spell casting that costs mana
- "Bank" mana before deciding what to do with it

**Files to modify (if needed):**
- `packages/core/src/engine/validators/index.ts` - register validators
- `packages/core/src/engine/commands/index.ts` - create command handlers

---

### 3. Cards That Generate Mana

Some cards have placeholder effects that should generate mana tokens:

- **Mana Draw** - Should give pure mana of chosen basic color
- **Crystallize** - Should convert mana to crystal (or vice versa)

**Current:** `drawCards(0)` placeholder effects
**Files:** Card definitions in `packages/core/src/data/basicActions.ts`

---

### 4. Mana Source UI During Combat

Show available mana dice visually in combat overlay.

**Current:** `validActions.mana` is populated with available dice/crystals during combat
**Missing:** No UI component displays this in combat

**Note:** The main `ManaSourcePanel` exists in `App.tsx` but is only visible outside combat.
Could add it to the combat overlay or show crystals/dice inline.

---

## Test Coverage

Existing tests in `packages/core/src/engine/__tests__/manaPowering.test.ts`:
- Die usage and consumption
- Crystal consumption
- Token consumption
- Gold/black wildcard behavior
- Dungeon/tomb rules
- Color mismatch validation
- Time-of-day restrictions

Unit tests in `packages/core/src/engine/__tests__/playableCards.test.ts`:
- Powered options require mana availability
- Cards hidden when mana not available

E2E tests in `packages/client/e2e/combat.spec.ts`:
- Powered option hidden without mana
- Mana source integration check

**Missing tests:**
- Crystal overflow to token

---

## Related Files

**Server (complete):**
- `packages/core/src/engine/mana/manaSource.ts`
- `packages/core/src/engine/validators/manaValidators.ts`
- `packages/core/src/engine/commands/playCardCommand.ts`
- `packages/core/src/engine/validActions/mana.ts`
- `packages/core/src/engine/validActions/cards.ts`

**Client (complete):**
- `packages/client/src/components/Hand/PlayerHand.tsx` - `findAvailableManaSource()`

**Types:**
- `packages/shared/src/actions.ts` - `ManaSourceInfo`, `PlayCardAction`
- `packages/shared/src/types/validActions.ts` - `ManaOptions`
