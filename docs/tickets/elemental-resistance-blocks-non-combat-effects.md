# Ticket: Elemental Resistance Blocks Non-Attack/Block Effects

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Status:** Not Started
**Affects:** Combat system, effect resolution, card effects, unit abilities
**Authoritative:** Yes

---

## Summary

Elemental resistances (Fire/Ice) should completely negate non-Attack/Block effects from cards or abilities of the matching element. Currently, resistances only halve Attack damage - they don't block other targeting effects like armor reduction, paralysis, or debuffs.

## Problem Statement

From the rulebook:

> a. When using a red card, or a Unit ability that costs red mana to activate, any effect, other than Attack or Block effects, have no effect when targeting enemies with Fire resistance.
>
> b. When using a blue card, or a Unit ability that costs blue mana to activate, any effect, other than Attack or Block effects, have no effect when targeting enemies with Ice resistance.

This means:
- **Ice Shield** (blue card) reducing armor → blocked by Ice resistance
- **Tremor** reducing armor (if cast with fire mana) → blocked by Fire resistance
- Fire/Ice Attack damage → still works, just halved (current behavior is correct)
- Fire/Ice Block → unaffected by resistance (current behavior is correct)

This is a significant feature gap. Players might not realize their armor reduction or debuff effects are being completely negated.

## Current Behavior

The resistance system (`packages/core/src/engine/combat/elementalCalc.ts`) only handles:
- `isAttackResisted()` - halves attack damage
- `isBlockEfficient()` - determines block efficiency

There is no mechanism to:
1. Track the "source element" of non-combat effects
2. Check if a target enemy resists that element
3. Completely negate effects based on resistance

Effects that target enemies (like armor reduction) are resolved without checking elemental resistance.

Key files:
- `packages/core/src/engine/combat/elementalCalc.ts` - Current resistance logic
- `packages/core/src/engine/effects/combatEffects.ts` - Enemy targeting effects
- `packages/core/src/types/effectTypes.ts` - Effect type definitions

## Expected Behavior

### Effect Resolution

When resolving an effect that targets an enemy:

1. Determine the effect's "source element":
   - Card color (red = Fire, blue = Ice)
   - Unit ability activation cost (red mana = Fire, blue mana = Ice)
   - Spell color

2. Check if target enemy has matching resistance:
   - Fire resistance blocks effects from red cards/fire-mana abilities
   - Ice resistance blocks effects from blue cards/ice-mana abilities

3. If resisted:
   - **Attack/Block effects**: Apply normally (resistance halves damage, already implemented)
   - **All other effects**: Completely negated, no effect applied

### Examples

| Source | Effect | Target Resistance | Result |
|--------|--------|-------------------|--------|
| Ice Shield (blue) | Reduce armor by 3 | Ice | **Blocked** - no armor reduction |
| Ice Shield (blue) | Block 3 Ice | Ice | Works - block is not negated |
| Ice Storm (blue spell) | Attack 5 Ice | Ice | Works - attack halved to 2 |
| Tremor (fire mana) | Reduce armor | Fire | **Blocked** - no armor reduction |
| Fireball (red) | Attack 5 Fire | Fire | Works - attack halved to 2 |
| Path Finding (green) | Reduce armor | Ice | Works - green has no elemental association |

### UI Feedback

When an effect is blocked by resistance:
- Show feedback to player that effect was negated
- Event: `EFFECT_BLOCKED_BY_RESISTANCE` with source element and target enemy

## Scope

### In Scope
- Add source element tracking to effect resolution
- Add resistance check for non-Attack/Block effects targeting enemies
- Implement complete negation for resisted non-combat effects
- Add event for blocked effects
- Unit ability mana cost determines element for activation effects

### Out of Scope
- Changing Attack/Block resistance behavior (already correct)
- Cold Fire resistance interactions for non-combat effects (needs clarification)
- UI design for blocked effect feedback (separate ticket)

## Proposed Approach

### Phase 1: Effect Source Element

Add optional `sourceElement` to effect context:

```typescript
interface EffectResolutionContext {
  // ... existing fields
  sourceElement?: Element; // FIRE, ICE, or undefined for colorless
}
```

Populate based on:
- Card being played (infer from card color/poweredBy)
- Unit ability activation (from mana cost)

### Phase 2: Resistance Check Helper

Add to `elementalCalc.ts`:

```typescript
/**
 * Check if a non-Attack/Block effect is blocked by resistance.
 * Returns true if the effect should be completely negated.
 */
export function isEffectBlockedByResistance(
  sourceElement: Element | undefined,
  targetResistances: Resistances
): boolean {
  if (!sourceElement) return false;

  switch (sourceElement) {
    case ELEMENT_FIRE:
      return targetResistances.fire;
    case ELEMENT_ICE:
      return targetResistances.ice;
    default:
      return false;
  }
}
```

### Phase 3: Effect Resolution Integration

In `combatEffects.ts` and relevant resolvers:
- Before applying enemy-targeting effects (armor reduction, debuffs, etc.)
- Check `isEffectBlockedByResistance()`
- If blocked, emit event and skip effect application

### Phase 4: Card Element Inference

Create helper to determine card's element:

```typescript
function getCardElement(card: Card): Element | undefined {
  // Check powered mana color
  if (card.poweredBy?.includes(MANA_RED)) return ELEMENT_FIRE;
  if (card.poweredBy?.includes(MANA_BLUE)) return ELEMENT_ICE;
  // Or check card type color
  // Return undefined for colorless/green/white cards
}
```

## Implementation Notes

### Affected Effect Types

Effects that target enemies and should check resistance:
- Armor reduction (Ice Shield, Frost Bridge powered, etc.)
- Any future debuff effects (paralysis, weaken, etc.)
- Any effect with `EnemyTarget` that isn't Attack/Block

### Attack/Block Exemption

The rule explicitly exempts Attack and Block effects. These effect types should bypass the resistance check and continue to use the existing halving logic.

### Unit Abilities

Unit abilities activated with colored mana inherit that element:
- Activate with red mana → Fire element for resistance check
- Activate with blue mana → Ice element for resistance check
- Free abilities or no mana cost → No elemental association

### Edge Cases

- **Multi-target effects**: Check resistance per-enemy, some may be blocked while others apply
- **Compound effects**: Attack portion works (halved), non-attack portion blocked
- **Cold Fire**: Rulebook doesn't clarify - assume blocked only if BOTH resistances present (consistent with attack rules)

## Acceptance Criteria

- [ ] Blue card non-Attack/Block effects are blocked by Ice resistance
- [ ] Red card non-Attack/Block effects are blocked by Fire resistance
- [ ] Attack effects from colored cards still work (just halved)
- [ ] Block effects are unaffected by resistance
- [ ] Unit abilities inherit element from activation mana cost
- [ ] Colorless/green/white cards unaffected by resistance
- [ ] Event emitted when effect is blocked by resistance
- [ ] Multi-target effects check resistance per enemy

## Test Plan

### Manual
1. Play Ice Shield against enemy with Ice resistance
2. Verify block works normally
3. Verify armor reduction is completely blocked (when implemented)

### Automated
- Unit test: `isEffectBlockedByResistance` returns true for matching element/resistance
- Unit test: `isEffectBlockedByResistance` returns false for Attack effects
- Unit test: `isEffectBlockedByResistance` returns false for colorless sources
- Unit test: `getCardElement` correctly identifies card elements
- Integration test: Armor reduction blocked by matching resistance
- Integration test: Armor reduction applies when no matching resistance

## Open Questions

- Does Cold Fire count as both Fire AND Ice for non-combat effect blocking? (Assume yes, consistent with attack resistance rules)
- Should there be a validation warning when player tries to use resisted effect? (Probably - prevents wasted cards)
- How should this interact with effects that target multiple enemies with different resistances?

## Related Tickets

- `show-enemy-armor-reduction.md` - UI for armor reduction (depends on armor reduction working)
- Future: Armor reduction implementation ticket
- Future: Paralysis/debuff implementation ticket
