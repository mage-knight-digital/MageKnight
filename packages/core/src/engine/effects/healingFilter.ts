/**
 * Healing effect filtering for combat.
 *
 * Removes healing sub-effects from compound/choice effects when in combat.
 */

import type { CardEffect } from "../../types/cards.js";
import {
  EFFECT_GAIN_HEALING,
  EFFECT_HEAL_UNIT,
  EFFECT_ENERGY_FLOW,
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_DISCARD_COST,
  EFFECT_NOOP,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
} from "../../types/effectTypes.js";
import type { ScalableBaseEffect } from "../../types/cards.js";

export function filterHealingEffectsForCombat(effect: CardEffect): CardEffect | null {
  switch (effect.type) {
    case EFFECT_GAIN_HEALING:
    case EFFECT_HEAL_UNIT:
    case EFFECT_ENERGY_FLOW:
      return null;

    case EFFECT_COMPOUND: {
      const filteredEffects = effect.effects
        .map((subEffect) => filterHealingEffectsForCombat(subEffect))
        .filter((subEffect): subEffect is CardEffect => subEffect !== null);

      if (filteredEffects.length === 0) {
        return null;
      }

      return { ...effect, effects: filteredEffects };
    }

    case EFFECT_CHOICE: {
      const filteredOptions = effect.options
        .map((option) => filterHealingEffectsForCombat(option))
        .filter((option): option is CardEffect => option !== null);

      if (filteredOptions.length === 0) {
        return null;
      }

      return { ...effect, options: filteredOptions };
    }

    case EFFECT_CONDITIONAL: {
      const filteredThen = filterHealingEffectsForCombat(effect.thenEffect);
      const filteredElse = effect.elseEffect
        ? filterHealingEffectsForCombat(effect.elseEffect)
        : null;

      if (!filteredThen && !filteredElse) {
        return null;
      }

      return {
        ...effect,
        thenEffect: filteredThen ?? { type: EFFECT_NOOP },
        ...(effect.elseEffect
          ? { elseEffect: filteredElse ?? { type: EFFECT_NOOP } }
          : {}),
      };
    }

    case EFFECT_SCALING: {
      const filteredBase = filterHealingEffectsForCombat(effect.baseEffect);
      if (!filteredBase || !isScalableBaseEffect(filteredBase)) {
        return null;
      }

      return { ...effect, baseEffect: filteredBase };
    }

    case EFFECT_DISCARD_COST: {
      const filteredThen = filterHealingEffectsForCombat(effect.thenEffect);
      if (!filteredThen) {
        return null;
      }

      return { ...effect, thenEffect: filteredThen };
    }

    default:
      return effect;
  }
}

function isScalableBaseEffect(effect: CardEffect): effect is ScalableBaseEffect {
  switch (effect.type) {
    case EFFECT_GAIN_ATTACK:
    case EFFECT_GAIN_BLOCK:
    case EFFECT_GAIN_MOVE:
    case EFFECT_GAIN_INFLUENCE:
      return true;
    default:
      return false;
  }
}
