# Ticket: Restrict Healing Effects During Combat

**Created:** January 2026
**Updated:** January 2026
**Priority:** Medium
**Complexity:** Medium
**Status:** Not Started
**Affects:** Card data model, combat system, card validation, effect resolution
**Authoritative:** Yes

---

## Summary

Cards with healing effects can currently be played during combat, violating the rulebook rule that healing cannot be done during combat. The restriction is based on the **hand symbol** (healing icon) on cards, with nuanced rules depending on whether a card has only the hand symbol or multiple symbols.

## Problem Statement

The rulebook states: "Players can heal any time during their turn, **except during combat**."

From the FAQ (S3):
> "The Rejuvenate card has a hand symbol in the upper left corner (and only a hand symbol), so even its 'non-healing' effects are prohibited during Combat."

This means:
1. **Cards with ONLY the hand symbol**: ALL effects blocked during combat (even non-healing parts like unit readying)
2. **Cards with hand symbol + other symbols**: Only the healing portion is blocked; other effects still work
3. **Spells can have different categories per effect**: e.g., Cure (basic) is healing, Disease (powered) is attack

**Note:** Healing *points* are already correctly cleared on combat entry (commit `f549c81`).

## Current Behavior

- Cards track `categories` at the card level only, not per-effect
- `effectIsUtility()` includes `effectHasHeal()`, allowing healing during combat
- All healing cards can use basic/powered effects during combat

## Expected Behavior

### Cards with ONLY healing category
- **Tranquility**: Block basic AND powered during combat
- **Regeneration**: Block basic AND powered during combat (even unit readying part)
- **Restoration spell**: Block basic AND powered during combat

### Cards with healing + other categories
- **Refreshing Walk** (movement + healing):
  - Basic "Move 2 and Heal 1" → During combat, only Move 2 applies
  - Powered "Move 4 and Heal 2" → During combat, only Move 4 applies
- **Power of Crystals** (movement + healing + special):
  - Powered `choice(move(4), heal(2))` → During combat, heal option removed from choice

### Spells with per-effect categories
- **Cure/Disease**: Basic (Cure) is healing category, Powered (Disease) is attack category
  - During combat: Block basic (Cure), allow powered (Disease)

### All healing cards
- CAN still play sideways for +1 attack/block during combat

## Scope

### In Scope
- Add per-effect categories to card data model (at minimum for spells)
- Block effects based on per-effect categories during combat
- Filter healing sub-effects from compound/choice effects during combat
- Remove `effectHasHeal` from `effectIsUtility()`
- Update affected card definitions

### Out of Scope
- Changes to healing points clearing (already implemented)
- Changes to non-combat healing behavior
- Skills with hand symbol (e.g., Inspiration) - separate ticket if needed

## Proposed Approach

### Phase 1: Data Model Change

Add optional per-effect category fields to `DeedCard`:

```typescript
interface DeedCard {
  // ... existing fields
  categories: CardCategory[];  // Card-level categories (keep for backwards compat)
  basicEffectCategory?: CardCategory;   // Override for basic effect
  poweredEffectCategory?: CardCategory; // Override for powered effect
}
```

For most cards, use card-level `categories`. For spells like Cure/Disease, specify per-effect categories.

### Phase 2: Valid Actions Logic

In `getCardPlayabilityForPhase()`:

```typescript
function getEffectCategory(card: DeedCard, effectType: 'basic' | 'powered'): CardCategory[] {
  // Use per-effect category if specified, otherwise fall back to card categories
  if (effectType === 'basic' && card.basicEffectCategory) {
    return [card.basicEffectCategory];
  }
  if (effectType === 'powered' && card.poweredEffectCategory) {
    return [card.poweredEffectCategory];
  }
  return card.categories;
}

function isHealingOnlyEffect(categories: CardCategory[]): boolean {
  return categories.length === 1 && categories[0] === CARD_CATEGORY_HEALING;
}

function hasHealingCategory(categories: CardCategory[]): boolean {
  return categories.includes(CARD_CATEGORY_HEALING);
}
```

Then for each combat phase:
- If `isHealingOnlyEffect(getEffectCategory(card, 'basic'))` → `canPlayBasic: false`
- If `isHealingOnlyEffect(getEffectCategory(card, 'powered'))` → `canPlayPowered: false`
- If has healing + other categories → allow play, but filter healing in resolution

### Phase 3: Effect Resolution Filtering

For cards with healing + other categories (like Refreshing Walk), filter healing sub-effects during combat:

- `CompoundEffect`: Filter out healing sub-effects, execute remaining
- `ChoiceEffect`: Filter out healing options from choices

```typescript
function filterHealingEffects(effect: CardEffect, inCombat: boolean): CardEffect | null {
  if (!inCombat) return effect;

  if (effect.type === EFFECT_HEAL) return null;

  if (effect.type === EFFECT_COMPOUND) {
    const filtered = effect.effects
      .map(e => filterHealingEffects(e, true))
      .filter(Boolean);
    return filtered.length > 0 ? { ...effect, effects: filtered } : null;
  }

  if (effect.type === EFFECT_CHOICE) {
    const filtered = effect.options
      .map(e => filterHealingEffects(e, true))
      .filter(Boolean);
    return filtered.length > 0 ? { ...effect, options: filtered } : null;
  }

  return effect;
}
```

## Implementation Notes

### Files to Modify

| File | Change |
|------|--------|
| `core/src/types/cards.ts` | Add `basicEffectCategory?` and `poweredEffectCategory?` to `DeedCard` |
| `core/src/data/spells.ts` | Add per-effect categories to Cure/Disease and similar spells |
| `core/src/engine/validActions/cards/combat.ts` | Check per-effect categories, block healing-only effects |
| `core/src/engine/validActions/cards/effectDetection/index.ts` | Remove `effectHasHeal` from `effectIsUtility` |
| `core/src/engine/effects/` | Add filtering for healing sub-effects during combat |

### Card Data Updates

```typescript
// Cure/Disease spell
{
  id: CARD_CURE,
  categories: [CARD_CATEGORY_HEALING, CARD_CATEGORY_COMBAT], // Card has both
  basicEffectCategory: CARD_CATEGORY_HEALING,  // Cure is healing
  poweredEffectCategory: CARD_CATEGORY_COMBAT, // Disease is attack
  basicEffect: heal(3),
  poweredEffect: poisonAttack(5),
}
```

## Acceptance Criteria

### Healing-only cards
- [ ] Tranquility: basic/powered blocked during combat, sideways allowed
- [ ] Regeneration: basic/powered blocked during combat, sideways allowed
- [ ] Restoration spell: basic/powered blocked during combat

### Mixed-category cards
- [ ] Refreshing Walk: playable during combat, but only Move portion applies (Heal filtered out)
- [ ] Power of Crystals powered: heal option removed from choice during combat

### Per-effect category spells
- [ ] Cure/Disease: basic (Cure) blocked during combat, powered (Disease) allowed

### General
- [ ] Non-healing cards work normally during combat
- [ ] All healing cards work normally outside combat

## Test Plan

### Automated
Create `core/src/engine/__tests__/healingDuringCombat.test.ts`:

1. **Healing-only cards blocked**
   - Tranquility basic/powered blocked during all combat phases
   - Tranquility sideways allowed during block/attack phases
   - Regeneration blocked (no sideways value = not playable at all)

2. **Mixed-category cards filtered**
   - Refreshing Walk playable during combat
   - Refreshing Walk effect grants Move but not Heal during combat
   - Power of Crystals powered choice excludes heal option during combat

3. **Per-effect category spells**
   - Cure/Disease: basic blocked, powered allowed during combat

4. **Non-healing cards unaffected**
   - Rage, March, etc. work normally

### Manual
1. Get Tranquility and Refreshing Walk in hand
2. Enter combat
3. Verify Tranquility shows only sideways option
4. Verify Refreshing Walk shows basic/powered options
5. Play Refreshing Walk, verify only movement is gained (no healing)

## Open Questions

- [ ] Should we add per-effect categories to all cards proactively, or only spells that need it?
- [ ] Are there other skills/abilities with the hand symbol that need similar treatment?

## Related

- Commit `f549c81`: Healing points cleared on combat entry
- Ticket `turn-structure-and-phases.md`: Broader turn structure rules
- Test file `healingPointsCombat.test.ts`: Tests for healing points clearing
