/**
 * Movement effect detection functions.
 *
 * Functions to detect move and influence effects in cards.
 */

import type { CardEffect } from "../../../types/cards.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_NOOP,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_DISCARD_COST,
  EFFECT_PURE_MAGIC,
  EFFECT_POWER_OF_CRYSTALS_POWERED,
} from "../../../types/effectTypes.js";

/**
 * Check if an effect provides move points.
 */
export function effectHasMove(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
    case EFFECT_PURE_MAGIC: // Pure Magic can provide Move (via green mana)
    case EFFECT_POWER_OF_CRYSTALS_POWERED:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasMove(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasMove(eff));

    case EFFECT_CONDITIONAL:
      return effectHasMove(effect.thenEffect) ||
        (effect.elseEffect ? effectHasMove(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasMove(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasMove(next)
          )
        : effectHasMove(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect provides ONLY move points (no other combat-relevant effects).
 * Used to determine if a card's combat-filtered effect needs move to be useful.
 */
export function effectIsMoveOnly(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
      return true;

    case EFFECT_NOOP:
      return true;

    case EFFECT_COMPOUND:
      return effect.effects.every(eff => effectIsMoveOnly(eff));

    case EFFECT_CONDITIONAL:
      return effectIsMoveOnly(effect.thenEffect) &&
        (!effect.elseEffect || effectIsMoveOnly(effect.elseEffect));

    case EFFECT_CHOICE:
      return effect.options.every(opt => effectIsMoveOnly(opt));

    default:
      return false;
  }
}

/**
 * Check if an effect provides ONLY influence points (no other combat-relevant effects).
 * Used to determine if a card's combat-filtered effect needs influence to be useful.
 */
export function effectIsInfluenceOnly(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_INFLUENCE:
      return true;

    case EFFECT_NOOP:
      return true;

    case EFFECT_COMPOUND:
      return effect.effects.every(eff => effectIsInfluenceOnly(eff));

    case EFFECT_CONDITIONAL:
      return effectIsInfluenceOnly(effect.thenEffect) &&
        (!effect.elseEffect || effectIsInfluenceOnly(effect.elseEffect));

    case EFFECT_CHOICE:
      return effect.options.every(opt => effectIsInfluenceOnly(opt));

    default:
      return false;
  }
}

/**
 * Check if an effect provides influence points.
 */
export function effectHasInfluence(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_INFLUENCE:
    case EFFECT_PURE_MAGIC: // Pure Magic can provide Influence (via white mana)
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasInfluence(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasInfluence(eff));

    case EFFECT_CONDITIONAL:
      return effectHasInfluence(effect.thenEffect) ||
        (effect.elseEffect ? effectHasInfluence(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasInfluence(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasInfluence(next)
          )
        : effectHasInfluence(effect.thenEffect);

    default:
      return false;
  }
}
