/**
 * Special effect detection functions.
 *
 * Functions to detect mana draw powered, crystal, card boost,
 * and enemy targeting effects.
 */

import type { CardEffect } from "../../../types/cards.js";
import {
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_POWER_OF_CRYSTALS_BASIC,
  EFFECT_CARD_BOOST,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_WINGS_OF_NIGHT,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_DISCARD_COST,
} from "../../../types/effectTypes.js";

/**
 * Check if an effect is the Mana Draw powered effect (take dice, set colors, gain mana).
 */
export function effectHasManaDrawPowered(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_MANA_DRAW_POWERED:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasManaDrawPowered(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasManaDrawPowered(eff));

    case EFFECT_CONDITIONAL:
      return effectHasManaDrawPowered(effect.thenEffect) ||
        (effect.elseEffect ? effectHasManaDrawPowered(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasManaDrawPowered(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasManaDrawPowered(next)
          )
        : effectHasManaDrawPowered(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect involves crystal manipulation (gain crystal or convert mana to crystal).
 */
export function effectHasCrystal(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_CRYSTAL:
    case EFFECT_CONVERT_MANA_TO_CRYSTAL:
    case EFFECT_POWER_OF_CRYSTALS_BASIC:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasCrystal(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasCrystal(eff));

    case EFFECT_CONDITIONAL:
      return effectHasCrystal(effect.thenEffect) ||
        (effect.elseEffect ? effectHasCrystal(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasCrystal(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasCrystal(next)
          )
        : effectHasCrystal(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect is a card boost effect (Concentration, Will Focus).
 */
export function effectHasCardBoost(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_CARD_BOOST:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasCardBoost(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasCardBoost(eff));

    case EFFECT_CONDITIONAL:
      return effectHasCardBoost(effect.thenEffect) ||
        (effect.elseEffect ? effectHasCardBoost(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasCardBoost(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasCardBoost(next)
          )
        : effectHasCardBoost(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect has enemy targeting (e.g., Tremor, Chill, Whirlwind).
 */
export function effectHasEnemyTargeting(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_SELECT_COMBAT_ENEMY:
    case EFFECT_WINGS_OF_NIGHT:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasEnemyTargeting(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasEnemyTargeting(eff));

    case EFFECT_CONDITIONAL:
      return effectHasEnemyTargeting(effect.thenEffect) ||
        (effect.elseEffect ? effectHasEnemyTargeting(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasEnemyTargeting(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasEnemyTargeting(next)
          )
        : effectHasEnemyTargeting(effect.thenEffect);

    default:
      return false;
  }
}
