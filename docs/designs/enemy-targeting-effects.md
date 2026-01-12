# Design: Enemy-Targeting Card Effects

## Overview

This design enables card effects that target specific enemies in combat, supporting spells like Tremor, Chill, and Whirlwind. The design leverages existing patterns (choice system, modifier system) while fixing gaps in the current implementation.

## Target Cards

| Card | Basic Effect | Powered Effect |
|------|--------------|----------------|
| **Tremor** | Target enemy gets Armor -3, OR all enemies get Armor -2 | Target enemy gets Armor -4, OR all enemies get Armor -3 |
| **Chill** | Target enemy does not attack and gets Armor -3 | Target enemy is defeated (Lethal Chill) |
| **Whirlwind** | Target enemy does not attack | Target enemy is defeated (Tornado) |

## Design Decisions

### Consensus from Multi-AI Analysis (Claude, Gemini, GPT)

1. **Reuse existing choice flow** - No new action types needed. Use `dynamicChoiceOptions` + `RESOLVE_CHOICE_ACTION`
2. **New modifier for "doesn't attack"** - Track via modifier system with `DURATION_COMBAT`
3. **Use `EFFECT_CHOICE` for "one OR all"** - Tremor's choice uses existing choice effect pattern
4. **Leverage existing scopes** - `SCOPE_ONE_ENEMY` and `SCOPE_ALL_ENEMIES` already exist

### Critical Gaps to Fix

1. **`EFFECT_APPLY_MODIFIER` hardcodes `scope: self`** - Must extend to accept `scope` parameter
2. **Combat doesn't use effective stats** - `getEffectiveEnemyArmor()` exists but isn't used in combat resolution
3. **`getCombatOptions` lacks GameState** - Can't query modifiers without it

---

## New Types

### Effect Constants

```typescript
// packages/core/src/types/effectTypes.ts

export const EFFECT_SELECT_COMBAT_ENEMY = "select_combat_enemy" as const;
export const EFFECT_RESOLVE_COMBAT_ENEMY_TARGET = "resolve_combat_enemy_target" as const;
```

### Effect Interfaces

```typescript
// packages/core/src/types/cards.ts

/**
 * Entry effect for targeting an enemy in combat.
 * Generates dynamicChoiceOptions with one option per eligible enemy.
 */
export interface SelectCombatEnemyEffect {
  readonly type: typeof EFFECT_SELECT_COMBAT_ENEMY;
  /** Template defining what happens to the selected enemy */
  readonly template: CombatEnemyTargetTemplate;
  /** Include defeated enemies as valid targets (default: false) */
  readonly includeDefeated?: boolean;
}

/**
 * Internal effect generated as a choice option.
 * Applies the template to the specific enemy.
 */
export interface ResolveCombatEnemyTargetEffect {
  readonly type: typeof EFFECT_RESOLVE_COMBAT_ENEMY_TARGET;
  readonly enemyInstanceId: string;
  /** Stored for UI display without needing state lookup */
  readonly enemyName: string;
  readonly template: CombatEnemyTargetTemplate;
}

/**
 * Declarative template for enemy-targeted effects.
 * Cleaner than nesting full CardEffect trees.
 */
export interface CombatEnemyTargetTemplate {
  /** Modifiers to apply to the target enemy */
  readonly modifiers?: readonly {
    readonly modifier: ModifierEffect;
    readonly duration: ModifierDuration;
    readonly description?: string;
  }[];
  /** If true, defeat the enemy immediately (for powered versions) */
  readonly defeat?: boolean;
}
```

### Modifier Constants

```typescript
// packages/core/src/types/modifierConstants.ts

export const EFFECT_ENEMY_SKIP_ATTACK = "enemy_skip_attack" as const;
```

### Modifier Interface

```typescript
// packages/core/src/types/modifiers.ts

/**
 * Enemy does not attack this combat.
 * Applied with SCOPE_ONE_ENEMY and DURATION_COMBAT.
 */
export interface EnemySkipAttackModifier {
  readonly type: typeof EFFECT_ENEMY_SKIP_ATTACK;
}

// Add to ModifierEffect union
export type ModifierEffect =
  | ... existing ...
  | EnemySkipAttackModifier;
```

---

## Extended Types (Fixing Gaps)

### ApplyModifierEffect with Scope

```typescript
// packages/core/src/types/cards.ts

export interface ApplyModifierEffect {
  readonly type: typeof EFFECT_APPLY_MODIFIER;
  readonly modifier: ModifierEffect;
  readonly duration: ModifierDuration;
  readonly scope?: ModifierScope;  // NEW - defaults to SCOPE_SELF
  readonly description?: string;
}
```

---

## Effect Resolution

### EFFECT_SELECT_COMBAT_ENEMY

```typescript
// packages/core/src/engine/effects/resolveEffect.ts

case EFFECT_SELECT_COMBAT_ENEMY: {
  // Gate 1: Must be in combat
  if (!state.combat) {
    return { state, description: "Not in combat" };
  }

  // Get eligible enemies
  const eligibleEnemies = state.combat.enemies.filter(
    e => effect.includeDefeated || !e.isDefeated
  );

  if (eligibleEnemies.length === 0) {
    return { state, description: "No valid enemy targets" };
  }

  // Generate choice options - one per enemy
  const choiceOptions: ResolveCombatEnemyTargetEffect[] = eligibleEnemies.map(enemy => ({
    type: EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
    enemyInstanceId: enemy.instanceId,
    enemyName: enemy.definition.name,
    template: effect.template,
  }));

  return {
    state,
    description: "Select an enemy to target",
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}
```

### EFFECT_RESOLVE_COMBAT_ENEMY_TARGET

```typescript
case EFFECT_RESOLVE_COMBAT_ENEMY_TARGET: {
  if (!state.combat) {
    return { state, description: "Not in combat" };
  }

  const enemy = state.combat.enemies.find(
    e => e.instanceId === effect.enemyInstanceId
  );
  if (!enemy) {
    return { state, description: "Enemy not found" };
  }

  let currentState = state;
  const descriptions: string[] = [];

  // Apply modifiers from template
  if (effect.template.modifiers) {
    for (const mod of effect.template.modifiers) {
      currentState = addModifier(currentState, {
        source: { type: SOURCE_CARD, cardId: sourceCardId as CardId, playerId },
        duration: mod.duration,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: effect.enemyInstanceId },
        effect: mod.modifier,
        createdAtRound: currentState.round,
        createdByPlayerId: playerId,
      });
      if (mod.description) {
        descriptions.push(mod.description);
      }
    }
  }

  // Handle defeat
  if (effect.template.defeat) {
    // Mark enemy defeated, award fame (similar to declareAttackCommand)
    const enemyIndex = currentState.combat!.enemies.findIndex(
      e => e.instanceId === effect.enemyInstanceId
    );
    if (enemyIndex >= 0) {
      const updatedEnemies = [...currentState.combat!.enemies];
      updatedEnemies[enemyIndex] = { ...updatedEnemies[enemyIndex], isDefeated: true };

      const fameValue = enemy.definition.fame;
      const player = getPlayer(currentState, playerId);
      const newFame = player.fame + fameValue;

      currentState = {
        ...currentState,
        combat: { ...currentState.combat!, enemies: updatedEnemies },
        players: currentState.players.map(p =>
          p.id === playerId ? { ...p, fame: newFame } : p
        ),
      };
      descriptions.push(`Defeated ${effect.enemyName} (+${fameValue} fame)`);
    }
  }

  return {
    state: currentState,
    description: descriptions.join("; ") || `Targeted ${effect.enemyName}`,
  };
}
```

### isEffectResolvable

```typescript
case EFFECT_SELECT_COMBAT_ENEMY: {
  if (!state.combat) return false;
  const eligible = state.combat.enemies.filter(
    e => effect.includeDefeated || !e.isDefeated
  );
  return eligible.length > 0;
}

case EFFECT_RESOLVE_COMBAT_ENEMY_TARGET: {
  if (!state.combat) return false;
  const enemy = state.combat.enemies.find(
    e => e.instanceId === effect.enemyInstanceId
  );
  return enemy != null && (effect.template.defeat ? true : !enemy.isDefeated);
}
```

---

## Modifier Query Helper

```typescript
// packages/core/src/engine/modifiers.ts

/**
 * Returns true if the enemy attacks this combat (no skip-attack modifier).
 */
export function doesEnemyAttackThisCombat(state: GameState, enemyId: string): boolean {
  const modifiers = getModifiersForEnemy(state, enemyId);
  return !modifiers.some(m => m.effect.type === EFFECT_ENEMY_SKIP_ATTACK);
}
```

---

## Combat Integration

### Fix getCombatOptions to use GameState

```typescript
// packages/core/src/engine/validActions/combat.ts

// Change signature:
export function getCombatOptions(
  combat: CombatState,
  state: GameState  // NEW - needed for modifier queries
): CombatOptions

// In attack options - use effective armor:
const effectiveArmor = getEffectiveEnemyArmor(
  state,
  enemy.instanceId,
  enemy.definition.armor,
  resistanceCount
);

// In block options - filter out non-attacking enemies:
const attackingEnemies = combat.enemies.filter(
  e => !e.isDefeated && doesEnemyAttackThisCombat(state, e.instanceId)
);

// In damage assignment - exclude non-attacking enemies:
const enemiesRequiringAssignment = combat.enemies.filter(
  e => !e.isDefeated && !e.isBlocked && doesEnemyAttackThisCombat(state, e.instanceId)
);
```

### Fix DECLARE_ATTACK to use effective armor

```typescript
// packages/core/src/engine/commands/combat/declareAttackCommand.ts

// Replace:
const requiredAttack = enemy.definition.armor;

// With:
const effectiveArmor = getEffectiveEnemyArmor(
  state,
  enemy.instanceId,
  enemy.definition.armor,
  resistanceCount
);
const requiredAttack = effectiveArmor;
```

---

## Card Definitions

### Tremor / Earthquake

```typescript
// packages/core/src/data/spells.ts

const TREMOR: DeedCard = {
  id: CARD_TREMOR,
  name: "Tremor",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CARD_CATEGORY_COMBAT],
  poweredBy: [MANA_RED],

  // Basic: Target -3 OR all -2
  basicEffect: {
    type: EFFECT_CHOICE,
    options: [
      {
        type: EFFECT_SELECT_COMBAT_ENEMY,
        template: {
          modifiers: [{
            modifier: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -3, minimum: 1 },
            duration: DURATION_COMBAT,
            description: "Target enemy gets Armor -3",
          }],
        },
      },
      {
        type: EFFECT_APPLY_MODIFIER,
        scope: { type: SCOPE_ALL_ENEMIES },
        duration: DURATION_COMBAT,
        modifier: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -2, minimum: 1 },
        description: "All enemies get Armor -2",
      },
    ],
  },

  // Powered (Earthquake): Target -4 OR all -3
  poweredEffect: {
    type: EFFECT_CHOICE,
    options: [
      {
        type: EFFECT_SELECT_COMBAT_ENEMY,
        template: {
          modifiers: [{
            modifier: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -4, minimum: 1 },
            duration: DURATION_COMBAT,
            description: "Target enemy gets Armor -4",
          }],
        },
      },
      {
        type: EFFECT_APPLY_MODIFIER,
        scope: { type: SCOPE_ALL_ENEMIES },
        duration: DURATION_COMBAT,
        modifier: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -3, minimum: 1 },
        description: "All enemies get Armor -3",
      },
    ],
  },

  sidewaysValue: 1,
};
```

### Chill / Lethal Chill

```typescript
const CHILL: DeedCard = {
  id: CARD_CHILL,
  name: "Chill",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CARD_CATEGORY_COMBAT],
  poweredBy: [MANA_BLUE],

  // Basic: Target doesn't attack + Armor -3
  basicEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    template: {
      modifiers: [
        {
          modifier: { type: EFFECT_ENEMY_SKIP_ATTACK },
          duration: DURATION_COMBAT,
          description: "Target enemy does not attack",
        },
        {
          modifier: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -3, minimum: 1 },
          duration: DURATION_COMBAT,
          description: "Target enemy gets Armor -3",
        },
      ],
    },
  },

  // Powered (Lethal Chill): Defeat target
  poweredEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    template: { defeat: true },
  },

  sidewaysValue: 1,
};
```

### Whirlwind / Tornado

```typescript
const WHIRLWIND: DeedCard = {
  id: CARD_WHIRLWIND,
  name: "Whirlwind",
  cardType: DEED_CARD_TYPE_SPELL,
  categories: [CARD_CATEGORY_COMBAT],
  poweredBy: [MANA_GREEN],

  // Basic: Target doesn't attack
  basicEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    template: {
      modifiers: [{
        modifier: { type: EFFECT_ENEMY_SKIP_ATTACK },
        duration: DURATION_COMBAT,
        description: "Target enemy does not attack",
      }],
    },
  },

  // Powered (Tornado): Defeat target
  poweredEffect: {
    type: EFFECT_SELECT_COMBAT_ENEMY,
    template: { defeat: true },
  },

  sidewaysValue: 1,
};
```

---

## Implementation Checklist

### Phase 1: Core Types
- [ ] Add `EFFECT_SELECT_COMBAT_ENEMY` to `effectTypes.ts`
- [ ] Add `EFFECT_RESOLVE_COMBAT_ENEMY_TARGET` to `effectTypes.ts`
- [ ] Add `EFFECT_ENEMY_SKIP_ATTACK` to `modifierConstants.ts`
- [ ] Add `SelectCombatEnemyEffect` interface to `cards.ts`
- [ ] Add `ResolveCombatEnemyTargetEffect` interface to `cards.ts`
- [ ] Add `CombatEnemyTargetTemplate` interface to `cards.ts`
- [ ] Add `EnemySkipAttackModifier` interface to `modifiers.ts`
- [ ] Update `CardEffect` union in `cards.ts`
- [ ] Update `ModifierEffect` union in `modifiers.ts`

### Phase 2: Fix Existing Gaps
- [ ] Extend `ApplyModifierEffect` to accept `scope` parameter
- [ ] Update `applyModifierEffect()` to use `effect.scope ?? { type: SCOPE_SELF }`
- [ ] Update `getCombatOptions()` signature to take `GameState`
- [ ] Update all callers of `getCombatOptions()`

### Phase 3: Effect Resolution
- [ ] Add `EFFECT_SELECT_COMBAT_ENEMY` case to `isEffectResolvable()`
- [ ] Add `EFFECT_RESOLVE_COMBAT_ENEMY_TARGET` case to `isEffectResolvable()`
- [ ] Add `EFFECT_SELECT_COMBAT_ENEMY` case to `resolveEffect()`
- [ ] Add `EFFECT_RESOLVE_COMBAT_ENEMY_TARGET` case to `resolveEffect()`
- [ ] Add descriptions to `describeEffect()`

### Phase 4: Modifier System
- [ ] Add `doesEnemyAttackThisCombat()` helper to `modifiers.ts`
- [ ] Export from modifiers index

### Phase 5: Combat Integration
- [ ] Update `getCombatOptions()` to use effective armor for attack options
- [ ] Update `getCombatOptions()` to filter non-attacking enemies from block options
- [ ] Update `getCombatOptions()` to filter non-attacking enemies from damage assignment
- [ ] Update `declareAttackCommand` to use `getEffectiveEnemyArmor()`
- [ ] Update `combatValidators` to exclude skip-attack enemies

### Phase 6: Card Playability
- [ ] Add `effectHasEnemyTargeting()` helper
- [ ] Update `getCardPlayabilityForPhase()` to allow enemy-targeting in combat

### Phase 7: Card Definitions
- [ ] Add `CARD_TREMOR`, `CARD_CHILL`, `CARD_WHIRLWIND` to `cardIds.ts`
- [ ] Add Tremor spell definition to `spells.ts`
- [ ] Add Chill spell definition to `spells.ts`
- [ ] Add Whirlwind spell definition to `spells.ts`
- [ ] Register in spell exports

### Phase 8: Tests
- [ ] Test enemy targeting generates correct choice options
- [ ] Test "skip attack" modifier prevents block/damage assignment
- [ ] Test powered versions defeat enemies correctly
- [ ] Test Tremor "one or all" choice works
- [ ] Test armor modifiers apply correctly in combat
- [ ] Test with multiple enemies

---

## Future Extensions

This system supports:
- **Multi-targeting**: "Choose up to 2 enemies" (extend template with `maxTargets`)
- **Conditional targeting**: "If enemy has Brutal..." (add `filter` to template)
- **Ranged targeting**: "Target enemy at any range" (add `ignoreRange` flag)
- **Other stat mods**: "Enemy Attack -2" (already supported via `EFFECT_ENEMY_STAT`)
