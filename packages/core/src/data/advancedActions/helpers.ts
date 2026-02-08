/**
 * Effect Helper Functions for Advanced Action Cards
 *
 * These factory functions simplify the creation of CardEffect objects
 * used in advanced action card definitions. They provide a concise,
 * readable syntax for defining card effects.
 *
 * @module data/advancedActions/helpers
 *
 * @example
 * ```typescript
 * import { attack, block, choice, compound } from "./helpers.js";
 *
 * // Simple attack effect
 * const basicEffect = attack(3);
 *
 * // Choice between attack and block
 * const flexibleEffect = choice(attack(4), block(4));
 *
 * // Compound effect with reputation change
 * const intimidateEffect = compound(choice(influence(4), attack(3)), changeReputation(-1));
 * ```
 */

import type { CardEffect, ConditionalEffect } from "../../types/cards.js";
import {
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_GAIN_MANA,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  EFFECT_CHANGE_REPUTATION,
  EFFECT_TAKE_WOUND,
  EFFECT_NOOP,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_MAXIMAL_EFFECT,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  type CombatType,
} from "../../types/effectTypes.js";
import type { BasicManaColor, Element } from "@mage-knight/shared";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
} from "@mage-knight/shared";
import { ELEMENT_FIRE, ELEMENT_ICE } from "../../types/modifierConstants.js";
import { CONDITION_IN_COMBAT } from "../../types/conditions.js";

export { discardCost, discardCostByColor, readyUnit } from "../basicActions/helpers.js";

/**
 * Creates a crystal gain effect for the specified color.
 *
 * @param color - The basic mana color of the crystal to gain
 * @returns A GainCrystalEffect
 */
export function gainCrystal(color: BasicManaColor): CardEffect {
  return { type: EFFECT_GAIN_CRYSTAL, color };
}

/**
 * Creates a melee attack effect.
 *
 * @param amount - The attack value
 * @returns A GainAttackEffect with melee combat type
 */
export function attack(amount: number): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_MELEE };
}

/**
 * Creates a melee attack effect with an elemental type.
 *
 * @param amount - The attack value
 * @param element - The element (fire or ice)
 * @returns A GainAttackEffect with melee combat type and element
 */
export function attackWithElement(
  amount: number,
  element: Element,
  combatType: CombatType = COMBAT_TYPE_MELEE
): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType, element };
}

/**
 * Creates a ranged attack effect.
 *
 * @param amount - The attack value
 * @returns A GainAttackEffect with ranged combat type
 */
export function rangedAttack(amount: number): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_RANGED };
}

/**
 * Creates a ranged attack effect with an elemental type.
 *
 * @param amount - The attack value
 * @param element - The element (fire or ice)
 * @returns A GainAttackEffect with ranged combat type and element
 */
export function rangedAttackWithElement(
  amount: number,
  element: typeof ELEMENT_FIRE | typeof ELEMENT_ICE
): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_RANGED, element };
}

/**
 * Creates a siege attack effect.
 *
 * @param amount - The attack value
 * @returns A GainAttackEffect with siege combat type
 */
export function siegeAttack(amount: number): CardEffect {
  return { type: EFFECT_GAIN_ATTACK, amount, combatType: COMBAT_TYPE_SIEGE };
}

/**
 * Creates a block effect.
 *
 * @param amount - The block value
 * @returns A GainBlockEffect
 */
export function block(amount: number): CardEffect {
  return { type: EFFECT_GAIN_BLOCK, amount };
}

/**
 * Creates a block effect with an elemental type.
 *
 * @param amount - The block value
 * @param element - The element (ice or fire)
 * @returns A GainBlockEffect with element
 */
export function blockWithElement(
  amount: number,
  element: typeof ELEMENT_ICE | typeof ELEMENT_FIRE
): CardEffect {
  return { type: EFFECT_GAIN_BLOCK, amount, element };
}

/**
 * Creates a movement effect.
 *
 * @param amount - The move points
 * @returns A GainMoveEffect
 */
export function move(amount: number): CardEffect {
  return { type: EFFECT_GAIN_MOVE, amount };
}

/**
 * Creates an influence effect.
 *
 * @param amount - The influence points
 * @returns A GainInfluenceEffect
 */
export function influence(amount: number): CardEffect {
  return { type: EFFECT_GAIN_INFLUENCE, amount };
}

/**
 * Creates a healing effect.
 *
 * @param amount - The healing points
 * @returns A GainHealingEffect
 */
export function heal(amount: number): CardEffect {
  return { type: EFFECT_GAIN_HEALING, amount };
}

/**
 * Creates a choice effect allowing player to pick one of several options.
 *
 * @param options - The effect options to choose from
 * @returns A ChoiceEffect
 */
export function choice(...options: CardEffect[]): CardEffect {
  return { type: EFFECT_CHOICE, options };
}

/**
 * Creates a compound effect that executes multiple effects in sequence.
 *
 * @param effects - The effects to execute
 * @returns A CompoundEffect
 */
export function compound(...effects: CardEffect[]): CardEffect {
  return { type: EFFECT_COMPOUND, effects };
}

/**
 * Creates a reputation change effect.
 *
 * @param amount - The reputation change (positive = gain, negative = lose)
 * @returns A ChangeReputationEffect
 */
export function changeReputation(amount: number): CardEffect {
  return { type: EFFECT_CHANGE_REPUTATION, amount };
}

/**
 * Creates a take wound effect.
 *
 * @param amount - The number of wounds to take (usually 1)
 * @returns A TakeWoundEffect
 */
export function takeWound(amount: number): CardEffect {
  return { type: EFFECT_TAKE_WOUND, amount };
}

/**
 * Creates a conditional effect that branches on whether the player is in combat.
 *
 * @param thenEffect - Effect when in combat
 * @param elseEffect - Effect when not in combat
 * @returns A ConditionalEffect with an in-combat condition
 */
export function ifInCombat(
  thenEffect: CardEffect,
  elseEffect?: CardEffect
): ConditionalEffect {
  const base = {
    type: EFFECT_CONDITIONAL,
    condition: { type: CONDITION_IN_COMBAT },
    thenEffect,
  } as const;

  if (elseEffect !== undefined) {
    return { ...base, elseEffect };
  }
  return base;
}

/**
 * Creates a choice effect for gaining a mana token of any color (including non-basic).
 *
 * @returns A ChoiceEffect with all 6 mana color options
 */
export function gainManaAnyColor(): CardEffect {
  return {
    type: EFFECT_CHOICE,
    options: [
      { type: EFFECT_GAIN_MANA, color: MANA_RED },
      { type: EFFECT_GAIN_MANA, color: MANA_BLUE },
      { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
      { type: EFFECT_GAIN_MANA, color: MANA_WHITE },
      { type: EFFECT_GAIN_MANA, color: MANA_GOLD },
      { type: EFFECT_GAIN_MANA, color: MANA_BLACK },
    ],
  };
}

/**
 * Creates a noop effect (skip/done/no additional effect).
 *
 * @returns A NoopEffect
 */
export function noop(): CardEffect {
  return { type: EFFECT_NOOP };
}

/**
 * Creates a convert-mana-to-crystal effect.
 * Player chooses a basic mana token to convert to a crystal of the same color.
 *
 * @returns A ConvertManaToCrystalEffect
 */
export function convertManaToCrystal(): CardEffect {
  return { type: EFFECT_CONVERT_MANA_TO_CRYSTAL };
}

/**
 * Creates a Maximal Effect effect that throws away an action card and
 * uses its effect multiple times.
 *
 * @param effectKind - "basic" uses the target card's basic effect, "powered" uses the stronger effect
 * @param multiplier - How many times to repeat the effect
 * @returns A MaximalEffectEffect
 */
export function maximalEffect(effectKind: "basic" | "powered", multiplier: number): CardEffect {
  return { type: EFFECT_MAXIMAL_EFFECT, effectKind, multiplier };
}

// Re-export element constants for convenience
export { ELEMENT_FIRE, ELEMENT_ICE, ELEMENT_COLD_FIRE } from "../../types/modifierConstants.js";
