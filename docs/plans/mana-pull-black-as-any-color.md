# Plan: Mana Pull Basic Effect - "Black Die as Any Color"

## Feature Description

The Mana Pull basic effect says:
> "You can use one additional mana die from the Source this turn. **If that die is black, use it to produce mana of any color.**"

This is different from Mana Draw's basic effect which only grants the extra die usage without any color conversion.

## Current State

- Both Mana Draw and Mana Pull basic effects use `grantExtraSourceDie()` which applies the `RULE_EXTRA_SOURCE_DIE` modifier
- The comment in `basicActions.ts` notes: "Black as any color" bonus not yet modeled
- The modifier system already has `RULE_BLACK_AS_GOLD` and `RULE_GOLD_AS_BLACK` but not "black as any color"

## Approach: Compound Effect with New Rule

### Key Insight
The Mana Pull basic effect is really **two** effects applied together:
1. Use 1 additional mana die from the Source (same as Mana Draw)
2. Black dice can be used as any basic color this turn (new modifier)

### Implementation Steps

#### Step 1: Add new rule constant
In `modifierConstants.ts`:
```typescript
export const RULE_BLACK_AS_ANY_COLOR = "black_as_any_color" as const;
```

#### Step 2: Update RuleOverrideModifier type
In `modifiers.ts`, add to the rule union:
```typescript
| typeof RULE_BLACK_AS_ANY_COLOR
```

#### Step 3: Create compound effect helper
In `basicActions.ts`:
```typescript
function grantExtraSourceDieWithBlackAsAnyColor(): CardEffect {
  return {
    type: EFFECT_COMPOUND,
    effects: [
      grantExtraSourceDie(),
      {
        type: EFFECT_APPLY_MODIFIER,
        modifier: {
          type: EFFECT_RULE_OVERRIDE,
          rule: RULE_BLACK_AS_ANY_COLOR,
        },
        duration: DURATION_TURN,
      },
    ],
  };
}
```

#### Step 4: Update Mana Pull card definition
```typescript
[CARD_ARYTHEA_MANA_PULL]: {
  // ...
  basicEffect: grantExtraSourceDieWithBlackAsAnyColor(),
  // ...
}
```

#### Step 5: Update mana validation to check for this rule
In `manaValidators.ts`, update `validateManaAvailable` for the `MANA_SOURCE_DIE` case:
- When checking die color match, if `RULE_BLACK_AS_ANY_COLOR` is active and the die is black, allow any basic color

In `canPayForMana` in `mana.ts`:
- When checking black dice, if `RULE_BLACK_AS_ANY_COLOR` is active, black dice can produce any basic color

#### Step 6: Add tests
Test cases:
1. Mana Pull basic effect applies both modifiers
2. With RULE_BLACK_AS_ANY_COLOR active:
   - Black die can be used to power a card that needs red/blue/green/white
   - The black die's "color" in action can be specified as any basic color
3. Without the rule active:
   - Black die can only produce black mana (existing behavior)

## Files to Modify

1. `packages/core/src/types/modifierConstants.ts` - Add `RULE_BLACK_AS_ANY_COLOR`
2. `packages/core/src/types/modifiers.ts` - Add to `RuleOverrideModifier["rule"]` union
3. `packages/core/src/data/basicActions.ts` - Create compound effect helper, update Mana Pull
4. `packages/core/src/engine/validators/manaValidators.ts` - Check new rule when validating die color
5. `packages/core/src/engine/validActions/mana.ts` - Update `canPayForMana` to consider the rule
6. Test file for the new behavior

## Considerations

- This rule is turn-scoped, so it only applies during the turn Mana Pull is played
- The rule applies to the **extra** die usage granted by Mana Pull, but mechanically it applies to all black dice during that turn (which is fine since you typically only use one or two dice per turn anyway)
- Time of day doesn't affect this - black dice are normally depleted during day, but if one were somehow available, this rule would let it produce any color

## Alternatives Considered

1. **Track which specific die the rule applies to**: More complex, requires tracking the specific die ID. The card doesn't actually restrict this to "that die" in a mechanical sense - it's flavor text. Simpler to just let all black dice become wild for the turn.

2. **Use RULE_BLACK_AS_GOLD**: Not quite right because gold is also wild but has different time-of-day restrictions. "Black as any color" is more direct.

3. **Custom effect type**: Overkill - the modifier system already handles this pattern with RuleOverrideModifier.
