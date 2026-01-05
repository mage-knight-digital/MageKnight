/**
 * Helper functions for creating card effects
 *
 * These functions provide a convenient DSL for defining card effects,
 * especially conditional effects based on game state.
 */

import type {
  CardEffect,
  ConditionalEffect,
  GainMoveEffect,
  GainInfluenceEffect,
  GainAttackEffect,
  GainBlockEffect,
  GainHealingEffect,
  CompoundEffect,
  ChoiceEffect,
} from "../types/cards.js";
import type { EffectCondition } from "../types/conditions.js";
import type { CombatPhase } from "../types/combat.js";
import type { Terrain, ManaColor, Element } from "@mage-knight/shared";
import {
  TIME_OF_DAY_NIGHT,
  TIME_OF_DAY_DAY,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import {
  EFFECT_CONDITIONAL,
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../types/effectTypes.js";
import {
  CONDITION_TIME_OF_DAY,
  CONDITION_IN_PHASE,
  CONDITION_ON_TERRAIN,
  CONDITION_IN_COMBAT,
  CONDITION_BLOCKED_SUCCESSFULLY,
  CONDITION_ENEMY_DEFEATED_THIS_COMBAT,
  CONDITION_MANA_USED_THIS_TURN,
  CONDITION_HAS_WOUNDS_IN_HAND,
} from "../types/conditions.js";

// === Basic Effect Helpers ===

export function move(amount: number): GainMoveEffect {
  return { type: EFFECT_GAIN_MOVE, amount };
}

export function influence(amount: number): GainInfluenceEffect {
  return { type: EFFECT_GAIN_INFLUENCE, amount };
}

export function attack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_MELEE };
}

export function block(amount: number): GainBlockEffect {
  return { type: EFFECT_GAIN_BLOCK, amount };
}

export function heal(amount: number): GainHealingEffect {
  return { type: EFFECT_GAIN_HEALING, amount };
}

export function compound(effects: CardEffect[]): CompoundEffect {
  return { type: EFFECT_COMPOUND, effects };
}

export function choice(options: CardEffect[]): ChoiceEffect {
  return { type: EFFECT_CHOICE, options };
}

// === Elemental Attack Helpers ===

export function rangedAttack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_RANGED };
}

export function siegeAttack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_SIEGE };
}

export function fireAttack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_MELEE, element: ELEMENT_FIRE };
}

export function iceAttack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_MELEE, element: ELEMENT_ICE };
}

export function fireRangedAttack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_RANGED, element: ELEMENT_FIRE };
}

export function iceRangedAttack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_RANGED, element: ELEMENT_ICE };
}

export function fireSiegeAttack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_SIEGE, element: ELEMENT_FIRE };
}

export function iceSiegeAttack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_SIEGE, element: ELEMENT_ICE };
}

/**
 * Generic attack with element and combat type
 */
export function attackWithElement(
  amount: number,
  element: Element,
  combatType: typeof COMBAT_TYPE_MELEE | typeof COMBAT_TYPE_RANGED | typeof COMBAT_TYPE_SIEGE = COMBAT_TYPE_MELEE
): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType, element };
}

// === Elemental Block Helpers ===

export function fireBlock(amount: number): GainBlockEffect {
  return { type: EFFECT_GAIN_BLOCK, amount, element: ELEMENT_FIRE };
}

export function iceBlock(amount: number): GainBlockEffect {
  return { type: EFFECT_GAIN_BLOCK, amount, element: ELEMENT_ICE };
}

/**
 * Generic block with element
 */
export function blockWithElement(amount: number, element: Element): GainBlockEffect {
  return { type: EFFECT_GAIN_BLOCK, amount, element };
}

// === Cold Fire Helpers ===

export function coldFireAttack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_MELEE, element: ELEMENT_COLD_FIRE };
}

export function coldFireRangedAttack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_RANGED, element: ELEMENT_COLD_FIRE };
}

export function coldFireSiegeAttack(amount: number): GainAttackEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_SIEGE, element: ELEMENT_COLD_FIRE };
}

export function coldFireBlock(amount: number): GainBlockEffect {
  return { type: EFFECT_GAIN_BLOCK, amount, element: ELEMENT_COLD_FIRE };
}

// === Conditional Effect Helpers ===

/**
 * Create a conditional effect
 */
export function conditional(
  condition: EffectCondition,
  thenEffect: CardEffect,
  elseEffect?: CardEffect
): ConditionalEffect {
  // Build base conditional without elseEffect
  const base = {
    type: EFFECT_CONDITIONAL,
    condition,
    thenEffect,
  } as const;

  // Only add elseEffect if defined (exactOptionalPropertyTypes compliance)
  if (elseEffect !== undefined) {
    return { ...base, elseEffect };
  }
  return base;
}

/**
 * Effect that applies only at night
 */
export function ifNight(
  thenEffect: CardEffect,
  elseEffect?: CardEffect
): ConditionalEffect {
  return conditional(
    { type: CONDITION_TIME_OF_DAY, time: TIME_OF_DAY_NIGHT },
    thenEffect,
    elseEffect
  );
}

/**
 * Effect that applies only during day
 */
export function ifDay(
  thenEffect: CardEffect,
  elseEffect?: CardEffect
): ConditionalEffect {
  return conditional(
    { type: CONDITION_TIME_OF_DAY, time: TIME_OF_DAY_DAY },
    thenEffect,
    elseEffect
  );
}

/**
 * Effect that applies only during specific combat phases
 */
export function ifInPhase(
  phases: CombatPhase[],
  thenEffect: CardEffect,
  elseEffect?: CardEffect
): ConditionalEffect {
  return conditional(
    { type: CONDITION_IN_PHASE, phases },
    thenEffect,
    elseEffect
  );
}

/**
 * Effect that applies only when on specific terrain
 * Supports single terrain or array of terrains (OR logic)
 */
export function ifOnTerrain(
  terrain: Terrain | readonly Terrain[],
  thenEffect: CardEffect,
  elseEffect?: CardEffect
): ConditionalEffect {
  // If array with single item, unwrap it
  const terrainValue = Array.isArray(terrain) && terrain.length === 1 ? terrain[0] : terrain;
  return conditional(
    { type: CONDITION_ON_TERRAIN, terrain: terrainValue as Terrain | readonly Terrain[] },
    thenEffect,
    elseEffect
  );
}

/**
 * Effect that applies only when in combat
 */
export function ifInCombat(
  thenEffect: CardEffect,
  elseEffect?: CardEffect
): ConditionalEffect {
  return conditional({ type: CONDITION_IN_COMBAT }, thenEffect, elseEffect);
}

/**
 * Effect that applies only when all damage was blocked this phase
 */
export function ifBlockedSuccessfully(
  thenEffect: CardEffect,
  elseEffect?: CardEffect
): ConditionalEffect {
  return conditional(
    { type: CONDITION_BLOCKED_SUCCESSFULLY },
    thenEffect,
    elseEffect
  );
}

/**
 * Effect that applies only when an enemy has been defeated this combat
 */
export function ifEnemyDefeated(
  thenEffect: CardEffect,
  elseEffect?: CardEffect
): ConditionalEffect {
  return conditional(
    { type: CONDITION_ENEMY_DEFEATED_THIS_COMBAT },
    thenEffect,
    elseEffect
  );
}

/**
 * Effect that applies only when mana of a specific color (or any mana) was used this turn
 */
export function ifManaUsed(
  thenEffect: CardEffect,
  elseEffect?: CardEffect,
  color?: ManaColor
): ConditionalEffect {
  // Build condition with or without color (exactOptionalPropertyTypes compliance)
  const condition =
    color !== undefined
      ? { type: CONDITION_MANA_USED_THIS_TURN, color } as const
      : { type: CONDITION_MANA_USED_THIS_TURN } as const;

  return conditional(condition, thenEffect, elseEffect);
}

/**
 * Effect that applies only when the player has wounds in hand
 */
export function ifHasWoundsInHand(
  thenEffect: CardEffect,
  elseEffect?: CardEffect
): ConditionalEffect {
  return conditional(
    { type: CONDITION_HAS_WOUNDS_IN_HAND },
    thenEffect,
    elseEffect
  );
}
