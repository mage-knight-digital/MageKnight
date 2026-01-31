/**
 * Effect helper functions for spell definitions
 *
 * These helpers create common effect patterns used across spell cards.
 */

import type { CardEffect } from "../../types/cards.js";
import {
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_CHOICE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import { ELEMENT_FIRE, ELEMENT_ICE } from "../../types/modifierConstants.js";

export function fireRangedAttack(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_ATTACK,
    amount,
    combatType: COMBAT_TYPE_RANGED,
    element: ELEMENT_FIRE,
  };
}

export function fireSiegeAttack(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_ATTACK,
    amount,
    combatType: COMBAT_TYPE_SIEGE,
    element: ELEMENT_FIRE,
  };
}

export function fireAttack(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_ATTACK,
    amount,
    combatType: COMBAT_TYPE_MELEE,
    element: ELEMENT_FIRE,
  };
}

export function fireBlock(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_BLOCK,
    amount,
    element: ELEMENT_FIRE,
  };
}

export function iceRangedAttack(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_ATTACK,
    amount,
    combatType: COMBAT_TYPE_RANGED,
    element: ELEMENT_ICE,
  };
}

export function iceSiegeAttack(amount: number): CardEffect {
  return {
    type: EFFECT_GAIN_ATTACK,
    amount,
    combatType: COMBAT_TYPE_SIEGE,
    element: ELEMENT_ICE,
  };
}

export function heal(amount: number): CardEffect {
  return { type: EFFECT_GAIN_HEALING, amount };
}

export function choice(options: readonly CardEffect[]): CardEffect {
  return { type: EFFECT_CHOICE, options };
}
