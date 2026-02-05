/**
 * Effect detection module.
 *
 * Re-exports all effect detection functions from rules for card playability analysis.
 * These rules are shared between validators and validActions to prevent drift.
 */

// Re-export all effect detection functions from rules
export {
  // Combat effects
  effectHasRangedOrSiege,
  effectHasBlock,
  effectHasAttack,
  // Movement effects
  effectHasMove,
  effectHasInfluence,
  // Resource effects
  effectHasHeal,
  effectHasDraw,
  effectHasModifier,
  effectHasManaGain,
  // Special effects
  effectHasManaDrawPowered,
  effectHasCrystal,
  effectHasCardBoost,
  effectHasEnemyTargeting,
  // Utility
  effectIsUtility,
} from "../../../rules/effectDetection/index.js";
