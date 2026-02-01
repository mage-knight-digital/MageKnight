/**
 * Resource effect detection functions.
 *
 * Functions to detect healing, card draw, modifier, and mana gain effects.
 */

import type { CardEffect } from "../../../../types/cards.js";
import {
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_DISCARD_COST,
} from "../../../../types/effectTypes.js";

/**
 * Check if an effect provides healing.
 */
export function effectHasHeal(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_HEALING:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasHeal(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasHeal(eff));

    case EFFECT_CONDITIONAL:
      return effectHasHeal(effect.thenEffect) ||
        (effect.elseEffect ? effectHasHeal(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasHeal(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effectHasHeal(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect draws cards.
 */
export function effectHasDraw(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_DRAW_CARDS:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasDraw(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasDraw(eff));

    case EFFECT_CONDITIONAL:
      return effectHasDraw(effect.thenEffect) ||
        (effect.elseEffect ? effectHasDraw(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasDraw(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effectHasDraw(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect applies a modifier (e.g., Mana Draw's extra source die).
 */
export function effectHasModifier(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_APPLY_MODIFIER:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasModifier(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasModifier(eff));

    case EFFECT_CONDITIONAL:
      return effectHasModifier(effect.thenEffect) ||
        (effect.elseEffect ? effectHasModifier(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasModifier(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effectHasModifier(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect gains mana tokens (e.g., Concentration).
 */
export function effectHasManaGain(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_MANA:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasManaGain(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasManaGain(eff));

    case EFFECT_CONDITIONAL:
      return effectHasManaGain(effect.thenEffect) ||
        (effect.elseEffect ? effectHasManaGain(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasManaGain(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effectHasManaGain(effect.thenEffect);

    default:
      return false;
  }
}
