/**
 * Resource effect detection functions.
 *
 * Functions to detect healing, card draw, modifier, and mana gain effects.
 */

import type { CardEffect } from "../../../types/cards.js";
import {
  EFFECT_GAIN_HEALING,
  EFFECT_HEAL_UNIT,
  EFFECT_ENERGY_FLOW,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_DISCARD_COST,
} from "../../../types/effectTypes.js";
import { DURATION_COMBAT } from "../../../types/modifierConstants.js";

/**
 * Check if an effect provides healing.
 */
export function effectHasHeal(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_HEALING:
    case EFFECT_HEAL_UNIT:
    case EFFECT_ENERGY_FLOW:
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
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasHeal(next)
          )
        : effectHasHeal(effect.thenEffect);

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
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasDraw(next)
          )
        : effectHasDraw(effect.thenEffect);

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
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasModifier(next)
          )
        : effectHasModifier(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect applies a modifier that is useful outside of combat.
 *
 * DURATION_COMBAT modifiers (e.g., Cold Toughness block bonus, Agility
 * move→attack conversion) are only meaningful during combat, so they
 * should not make a card appear playable on a normal turn.
 */
export function effectHasNonCombatModifier(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_APPLY_MODIFIER:
      return effect.duration !== DURATION_COMBAT;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasNonCombatModifier(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasNonCombatModifier(eff));

    case EFFECT_CONDITIONAL:
      return effectHasNonCombatModifier(effect.thenEffect) ||
        (effect.elseEffect ? effectHasNonCombatModifier(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasNonCombatModifier(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasNonCombatModifier(next)
          )
        : effectHasNonCombatModifier(effect.thenEffect);

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
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasManaGain(next)
          )
        : effectHasManaGain(effect.thenEffect);

    default:
      return false;
  }
}
