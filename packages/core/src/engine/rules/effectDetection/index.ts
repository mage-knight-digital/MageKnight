/**
 * Effect detection module.
 *
 * Re-exports all effect detection functions for card playability analysis.
 * These rules are shared between validators and validActions to prevent drift.
 */

import type { CardEffect } from "../../../types/cards.js";

// Combat effects
export {
  effectHasRangedOrSiege,
  effectHasBlock,
  effectHasAttack,
} from "./combatEffects.js";

// Movement effects
export {
  effectHasMove,
  effectIsMoveOnly,
  effectHasInfluence,
} from "./movementEffects.js";

// Resource effects
export {
  effectHasHeal,
  effectHasDraw,
  effectHasModifier,
  effectHasManaGain,
} from "./resourceEffects.js";

// Special effects
export {
  effectHasManaDrawPowered,
  effectHasCrystal,
  effectHasCardBoost,
  effectHasEnemyTargeting,
} from "./specialEffects.js";

// Import for use in effectIsUtility
import { effectHasDraw, effectHasModifier, effectHasManaGain } from "./resourceEffects.js";
import { effectHasManaDrawPowered, effectHasCrystal, effectHasCardBoost, effectHasEnemyTargeting } from "./specialEffects.js";

/**
 * Check if an effect is a "utility" effect that can be played during any combat phase.
 * These include mana generation, card draws, modifiers, card boost, and enemy-targeting spells.
 */
export function effectIsUtility(effect: CardEffect): boolean {
  return (
    effectHasManaGain(effect) ||
    effectHasDraw(effect) ||
    effectHasModifier(effect) ||
    effectHasManaDrawPowered(effect) ||
    effectHasCardBoost(effect) ||
    effectHasCrystal(effect) ||
    effectHasEnemyTargeting(effect)
  );
}
