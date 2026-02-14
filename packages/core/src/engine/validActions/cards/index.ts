/**
 * Card playability module.
 *
 * This module determines which cards in a player's hand can be played
 * and how (basic, powered, or sideways) based on the current game state.
 */

// Re-export combat playability
export { getPlayableCardsForCombat } from "./combat.js";

// Re-export normal turn playability
export { getPlayableCardsForNormalTurn } from "./normalTurn.js";

// Re-export effect detection functions (for use by other modules if needed)
export {
  effectHasRangedOrSiege,
  effectHasBlock,
  effectHasAttack,
  effectHasMove,
  effectHasInfluence,
  effectHasHeal,
  effectHasDraw,
  effectHasModifier,
  effectHasManaGain,
  effectHasManaDrawPowered,
  effectHasCrystal,
  effectHasCardBoost,
  effectHasEnemyTargeting,
  effectIsUtility,
} from "./effectDetection/index.js";

// Re-export mana payment functions (for use by other modules if needed)
export { canPayForSpellBasic, findPayableManaColor } from "./manaPayment.js";

// Re-export unified card playability evaluation
export {
  evaluateCardPlayability,
  evaluateHandPlayability,
  buildPlayContext,
  buildCombatPlayContext,
  type PlayContext,
  type EffectPlayability,
  type CardPlayabilityResult,
} from "./cardPlayability.js";
export { toPlayableCard } from "./playableCardBuilder.js";

// Re-export card lookup for backward compatibility (implementation lives in helpers to avoid circular deps)
export { getCard } from "../../helpers/cardLookup.js";
