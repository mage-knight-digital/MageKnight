/**
 * Atomic Effect Handlers
 *
 * This module provides pure leaf functions that directly transform game state
 * without recursing back into resolveEffect. These handle direct state changes:
 *
 * | Module | Effects |
 * |--------|---------|
 * | `atomicCombatEffects.ts` | GainAttack, GainBlock |
 * | `atomicResourceEffects.ts` | GainMove, GainInfluence, GainMana, GainCrystal |
 * | `atomicProgressionEffects.ts` | GainFame, ChangeReputation |
 * | `atomicCardEffects.ts` | DrawCards, GainHealing, TakeWound |
 * | `atomicModifierEffects.ts` | ApplyModifier |
 * | `atomicHelpers.ts` | Shared utilities (updatePlayer, updateElementalValue) |
 *
 * @module effects/atomicEffects
 */

// ============================================================================
// SHARED HELPERS
// ============================================================================

export {
  updatePlayer,
  updateElementalValue,
  elementToPropertyKey,
} from "./atomicHelpers.js";

// ============================================================================
// COMBAT EFFECTS
// ============================================================================

export {
  applyGainAttack,
  applyGainBlock,
} from "./atomicCombatEffects.js";

// ============================================================================
// RESOURCE EFFECTS
// ============================================================================

export {
  applyGainMove,
  applyGainInfluence,
  applyGainMana,
  applyGainCrystal,
} from "./atomicResourceEffects.js";

// ============================================================================
// PROGRESSION EFFECTS
// ============================================================================

export {
  applyChangeReputation,
  applyGainFame,
  MIN_REPUTATION,
  MAX_REPUTATION,
} from "./atomicProgressionEffects.js";

// ============================================================================
// CARD EFFECTS
// ============================================================================

export {
  applyDrawCards,
  applyGainHealing,
  applyTakeWound,
} from "./atomicCardEffects.js";

// ============================================================================
// MODIFIER EFFECTS
// ============================================================================

export {
  applyModifierEffect,
} from "./atomicModifierEffects.js";
