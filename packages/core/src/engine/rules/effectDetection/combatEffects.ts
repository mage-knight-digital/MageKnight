/**
 * Combat effect detection functions.
 *
 * Functions to detect attack, block, ranged, and siege effects in cards.
 */

import type { CardEffect } from "../../../types/cards.js";
import {
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_TERRAIN_BASED_BLOCK,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_DISCARD_COST,
  EFFECT_PURE_MAGIC,
  EFFECT_MANA_BOLT,
} from "../../../types/effectTypes.js";
import {
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "@mage-knight/shared";
import { effectHasEnemyTargeting } from "./specialEffects.js";
import { effectHasModifier } from "./resourceEffects.js";

/**
 * Check if an effect provides ranged or siege attack.
 */
export function effectHasRangedOrSiege(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_ATTACK:
      return effect.combatType === COMBAT_TYPE_RANGED || effect.combatType === COMBAT_TYPE_SIEGE;

    case EFFECT_MANA_BOLT: // Mana Bolt can provide Ranged (white) or Siege (green)
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasRangedOrSiege(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasRangedOrSiege(eff));

    case EFFECT_CONDITIONAL:
      return effectHasRangedOrSiege(effect.thenEffect) ||
        (effect.elseEffect ? effectHasRangedOrSiege(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasRangedOrSiege(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasRangedOrSiege(next)
          )
        : effectHasRangedOrSiege(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect provides block.
 */
export function effectHasBlock(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_BLOCK:
    case EFFECT_TERRAIN_BASED_BLOCK:
    case EFFECT_PURE_MAGIC: // Pure Magic can provide Block (via blue mana)
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasBlock(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasBlock(eff));

    case EFFECT_CONDITIONAL:
      return effectHasBlock(effect.thenEffect) ||
        (effect.elseEffect ? effectHasBlock(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasBlock(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasBlock(next)
          )
        : effectHasBlock(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect's attack components are exclusively ranged (no siege, no melee).
 * Returns true only for effects that provide ranged attack with no siege alternative.
 * Used to determine if a card is unusable when all enemies are fortified.
 */
export function effectIsRangedOnlyAttack(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_ATTACK:
      return effect.combatType === COMBAT_TYPE_RANGED;

    case EFFECT_CHOICE:
      // All options must be ranged-only (no siege escape hatch)
      return effect.options.every(opt => effectIsRangedOnlyAttack(opt));

    case EFFECT_COMPOUND:
      // Compounds with enemy targeting or modifiers (e.g., Expose removes
      // fortification) aren't purely ranged attacks — the non-attack sub-effects
      // provide independent value even against fortified enemies
      if (effectHasEnemyTargeting(effect) || effectHasModifier(effect)) return false;
      // Has ranged attack AND no siege/melee attack anywhere
      return effect.effects.some(eff => effectIsRangedOnlyAttack(eff)) &&
        !effect.effects.some(eff => effectHasSiegeAttack(eff));

    case EFFECT_CONDITIONAL:
      return effectIsRangedOnlyAttack(effect.thenEffect) &&
        (!effect.elseEffect || effectIsRangedOnlyAttack(effect.elseEffect));

    case EFFECT_SCALING:
      return effectIsRangedOnlyAttack(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).every((next) =>
            effectIsRangedOnlyAttack(next)
          )
        : effectIsRangedOnlyAttack(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect provides siege attack anywhere in its tree.
 */
function effectHasSiegeAttack(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_ATTACK:
      return effect.combatType === COMBAT_TYPE_SIEGE;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasSiegeAttack(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasSiegeAttack(eff));

    case EFFECT_CONDITIONAL:
      return effectHasSiegeAttack(effect.thenEffect) ||
        (effect.elseEffect ? effectHasSiegeAttack(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasSiegeAttack(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasSiegeAttack(next)
          )
        : effectHasSiegeAttack(effect.thenEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect provides any attack (melee, ranged, or siege).
 */
export function effectHasAttack(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_ATTACK:
    case EFFECT_PURE_MAGIC: // Pure Magic can provide Attack (via red mana)
    case EFFECT_MANA_BOLT: // Mana Bolt always provides Attack (all colors → attack)
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasAttack(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasAttack(eff));

    case EFFECT_CONDITIONAL:
      return effectHasAttack(effect.thenEffect) ||
        (effect.elseEffect ? effectHasAttack(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasAttack(effect.baseEffect);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).some((next) =>
            effectHasAttack(next)
          )
        : effectHasAttack(effect.thenEffect);

    default:
      return false;
  }
}
