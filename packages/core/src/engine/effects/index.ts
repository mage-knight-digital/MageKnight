/**
 * Effect Resolution Module
 *
 * This module provides the complete effect resolution system for the
 * Mage Knight game engine. Effects are the primary mechanism for
 * applying card abilities to game state.
 *
 * ## Architecture
 *
 * Effects are organized into category-based modules for better discoverability
 * and maintainability. Each module contains resolver functions for related
 * effect types:
 *
 * | Module | Effects |
 * |--------|---------|
 * | `atomicEffects.ts` | Re-exports from focused atomic modules (see below) |
 * | `atomicCombatEffects.ts` | GainAttack, GainBlock |
 * | `atomicResourceEffects.ts` | GainMove, GainInfluence, GainMana, GainCrystal |
 * | `atomicProgressionEffects.ts` | GainFame, ChangeReputation |
 * | `atomicCardEffects.ts` | DrawCards, GainHealing, TakeWound |
 * | `atomicModifierEffects.ts` | ApplyModifier |
 * | `atomicHelpers.ts` | Shared utilities (updatePlayer, updateElementalValue) |
 * | `compound.ts` | Compound, Conditional, Scaling |
 * | `choice.ts` | Choice |
 * | `crystallize.ts` | ConvertManaToCrystal, CrystallizeColor |
 * | `cardBoostResolvers.ts` | CardBoost, ResolveBoostTarget |
 * | `combatEffects.ts` | SelectCombatEnemy, ResolveCombatEnemyTarget |
 * | `manaDrawEffects.ts` | ManaDrawPowered, ManaDrawPickDie, ManaDrawSetColor |
 * | `unitEffects.ts` | ReadyUnit |
 * | `reverse.ts` | reverseEffect (for undo) |
 * | `resolvability.ts` | isEffectResolvable |
 *
 * ## Effect Registry
 *
 * Effects are registered in `effectRegistrations.ts` using a Map-based dispatch
 * system. This allows new effects to be added without modifying this central file.
 *
 * ## Main Entry Point
 *
 * The `resolveEffect` function is the main dispatcher that routes each
 * effect type to its appropriate handler via the registry.
 *
 * ## Usage Examples
 *
 * ### Resolving an Effect
 * ```typescript
 * import { resolveEffect } from './effects';
 *
 * const result = resolveEffect(state, playerId, effect, sourceCardId);
 * if (result.requiresChoice) {
 *   // Store pending choice, wait for player selection
 * } else {
 *   // Use result.state as the new game state
 * }
 * ```
 *
 * ### Checking Resolvability
 * ```typescript
 * import { isEffectResolvable } from './effects';
 *
 * const validOptions = effect.options.filter(opt =>
 *   isEffectResolvable(state, playerId, opt)
 * );
 * ```
 *
 * ### Reversing for Undo
 * ```typescript
 * import { reverseEffect } from './effects';
 *
 * const restoredPlayer = reverseEffect(player, effect);
 * ```
 *
 * @module effects
 */

// ============================================================================
// RE-EXPORT ALL MODULES
// ============================================================================

// Types
export * from "./types.js";

// Effect registry
export {
  registerEffect,
  getEffectHandler,
  hasEffectHandler,
  type EffectHandler,
  type EffectType,
} from "./effectRegistry.js";

// Resolvability checks
export * from "./resolvability.js";

// Healing filters (combat)
export { filterHealingEffectsForCombat } from "./healingFilter.js";

// Atomic effects (gain move, attack, etc.)
export {
  updatePlayer,
  updateElementalValue,
  elementToPropertyKey,
  applyGainMove,
  applyGainInfluence,
  applyGainMana,
  applyGainAttack,
  applyGainBlock,
  applyGainHealing,
  applyDrawCards,
  applyChangeReputation,
  applyGainFame,
  applyGainCrystal,
  applyTakeWound,
  applyModifierEffect,
  MIN_REPUTATION,
  MAX_REPUTATION,
  registerAtomicEffects,
} from "./atomicEffects.js";

// Compound effect resolution
export {
  resolveCompoundEffect,
  resolveCompoundEffectList,
  resolveConditionalEffect,
  resolveScalingEffect,
  registerCompoundEffects,
  type EffectResolver,
} from "./compound.js";

// Choice effect resolution
export { resolveChoiceEffect, registerChoiceEffects } from "./choice.js";

// Crystallize effects
export {
  resolveConvertManaToCrystal,
  resolveCrystallizeColor,
  registerCrystallizeEffects,
} from "./crystallize.js";

// Card boost effects
export {
  resolveCardBoostEffect,
  resolveBoostTargetEffect,
  registerCardBoostEffects,
} from "./cardBoostResolvers.js";
export { addBonusToEffect } from "./cardBoostEffects.js";

// Combat enemy targeting effects
export {
  resolveSelectCombatEnemy,
  resolveCombatEnemyTarget,
  registerCombatEffects,
} from "./combatEffects.js";

// Mana draw effects
export {
  handleManaDrawPowered,
  handleManaDrawPickDie,
  applyManaDrawSetColor,
  registerManaDrawEffects,
} from "./manaDrawEffects.js";

// Unit effects
export {
  handleReadyUnit,
  getSpentUnitsAtOrBelowLevel,
  registerUnitEffects,
} from "./unitEffects.js";

// Heal unit effects
export {
  handleHealUnit,
  getWoundedUnitsAtOrBelowLevel,
  applyHealUnit,
  registerHealUnitEffects,
} from "./healUnitEffects.js";

// Discard effects
export {
  handleDiscardCard,
  getDiscardableCards,
  applyDiscardCard,
  registerDiscardEffects,
} from "./discardEffects.js";

// Map effects
export { handleRevealTiles, registerMapEffects } from "./mapEffects.js";

// Mana payment effects
export {
  handlePayMana,
  getPayableManaColors,
  applyPayMana,
  registerManaPaymentEffects,
} from "./manaPaymentEffects.js";

// Terrain-based effects
export { resolveTerrainBasedBlock, registerTerrainEffects } from "./terrainEffects.js";

// Sword of Justice effects
export {
  handleDiscardForAttack,
  handleFamePerEnemyDefeated,
  getCardsEligibleForDiscardForAttack,
  registerSwordOfJusticeEffects,
} from "./swordOfJusticeEffects.js";

// Polarize mana effects (Arythea's Polarization skill)
export {
  resolvePolarizeMana,
  registerPolarizeEffects,
} from "./polarizeEffects.js";

// Discard-for-crystal effects (Savage Harvesting)
export {
  handleDiscardForCrystalEffect,
  getCardsEligibleForDiscardForCrystal,
  registerDiscardForCrystalEffects,
} from "./discardForCrystalEffects.js";

// Effect helpers
export { getPlayerContext } from "./effectHelpers.js";

// Effect reversal (for undo)
export { reverseEffect } from "./reverse.js";

// Effect description
export { describeEffect } from "./describeEffect.js";

// ============================================================================
// IMPORTS FOR MAIN RESOLVER
// ============================================================================

import type { GameState } from "../../state/GameState.js";
import type { CardEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { getEffectHandler } from "./effectRegistry.js";
import { initializeRegistry } from "./effectRegistrations.js";

// ============================================================================
// MAIN EFFECT RESOLVER
// ============================================================================

/**
 * Resolves a card effect by dispatching to the appropriate handler from the registry.
 *
 * This is the main entry point for effect resolution. It uses the effect registry
 * to look up the appropriate handler for each effect type.
 *
 * @param state - Current game state
 * @param playerId - ID of the player resolving the effect
 * @param effect - The effect to resolve
 * @param sourceCardId - Optional ID of the card that triggered this effect
 * @returns Resolution result with updated state and metadata
 *
 * @example Basic usage
 * ```typescript
 * const result = resolveEffect(state, "player1", effect);
 * if (result.requiresChoice) {
 *   // Handle pending choice
 * } else {
 *   state = result.state;
 * }
 * ```
 */
export function resolveEffect(
  state: GameState,
  playerId: string,
  effect: CardEffect,
  sourceCardId?: string
): EffectResolutionResult {
  // Look up the handler from the registry
  const handler = getEffectHandler(effect.type);

  if (handler) {
    return handler(state, playerId, effect, sourceCardId);
  }

  // Unknown effect type — log and continue
  return {
    state,
    description: `Unhandled effect type: ${effect.type}`,
  };
}

// ============================================================================
// INITIALIZE REGISTRY
// ============================================================================

// Initialize the registry with the resolveEffect function.
// This breaks the circular dependency between index.ts and effectRegistrations.ts.
initializeRegistry(resolveEffect);
