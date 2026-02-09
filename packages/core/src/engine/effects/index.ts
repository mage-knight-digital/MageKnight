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
  applyGainBowResolvedAttack,
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
  handleReadyAllUnits,
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

// Heal all units effects (Banner of Fortitude powered)
export {
  handleHealAllUnits,
  registerHealAllUnitsEffects,
} from "./healAllUnitsEffects.js";

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
export {
  resolveTerrainBasedBlock,
  resolveSelectHexForCostReduction,
  resolveSelectTerrainForCostReduction,
  registerTerrainEffects,
} from "./terrainEffects.js";

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

// Energy Flow effects
export {
  handleEnergyFlow,
  resolveEnergyFlowTarget,
  applyEnergyFlowToUnit,
  registerEnergyFlowEffects,
} from "./energyFlowEffects.js";

// Mana Meltdown / Mana Radiance effects (interactive red spell)
export {
  handleManaMeltdown,
  resolveManaMeltdownChoice,
  handleManaRadiance,
  resolveManaRadianceColor,
  registerManaMeltdownEffects,
} from "./manaMeltdownEffects.js";

// Ready units budget effects (Restoration/Rebirth spell)
export {
  registerReadyUnitsBudgetEffects,
} from "./readyUnitsBudgetEffects.js";

// Wound activating unit effects (Utem Swordsmen self-wound)
export {
  applyWoundActivatingUnit,
  registerWoundActivatingUnitEffects,
} from "./woundActivatingUnitEffects.js";

// Altem Mages effects (Cold Fire Attack/Block with mana scaling)
export {
  registerAltemMagesEffects,
} from "./altemMagesEffects.js";

// Pure Magic effects (mana-color-driven effect selection)
export {
  registerPureMagicEffects,
} from "./pureMagicEffects.js";

// Heroic Tale effects (recruitment bonus modifier)
export {
  registerHeroicTaleEffects,
} from "./heroicTaleEffects.js";

// Noble Manners effects (interaction bonus modifier)
export {
  registerNobleMannersBonusEffects,
} from "./nobleMannersBonusEffects.js";

// Free recruit effects (Banner of Command, Call to Glory)
export {
  handleFreeRecruit,
  resolveFreeRecruitTarget,
  applyFreeRecruit,
  registerFreeRecruitEffects,
  resetFreeRecruitInstanceCounter,
} from "./freeRecruitEffects.js";

// Sacrifice effects (Offering powered spell)
export {
  handleSacrifice,
  resolveSacrifice,
  registerSacrificeEffects,
} from "./sacrificeEffects.js";

// Call to Arms effects (borrow unit ability from offer)
export {
  registerCallToArmsEffects,
} from "./callToArmsEffects.js";

// Mana Bolt effects (blue spell, mana-color-driven attack)
export {
  registerManaBoltEffects,
} from "./manaBoltEffects.js";

// Mana Claim / Mana Curse effects (interactive blue spell)
export {
  handleManaClaim,
  resolveManaClaimDie,
  resolveManaClaimMode,
  handleManaCurse,
  checkManaCurseWound,
  grantManaClaimSustainedToken,
  resetManaCurseWoundTracking,
  registerManaClaimEffects,
} from "./manaClaimEffects.js";

// Wings of Night effects (multi-target skip-attack with move cost)
export {
  registerWingsOfNightEffects,
} from "./wingsOfNightEffects.js";

// Crystal Mastery effects (crystal duplication + spent crystal return)
export {
  handleCrystalMasteryBasic,
  handleCrystalMasteryPowered,
  returnSpentCrystals,
  registerCrystalMasteryEffects,
} from "./crystalMasteryEffects.js";

// Power of Crystals effects
export {
  handlePowerOfCrystalsBasic,
  handlePowerOfCrystalsPowered,
  registerPowerOfCrystalsEffects,
} from "./powerOfCrystalsEffects.js";

// Possess enemy effects (Charm/Possess spell powered effect)
export {
  registerPossessEffects,
} from "./possessEffects.js";

// Horn of Wrath effects (die rolling with wound risk)
export {
  registerHornOfWrathEffects,
} from "./hornOfWrathEffects.js";

// Maximal Effect effects (throw away action card and multiply its effect)
export {
  getCardsEligibleForMaximalEffect,
  handleMaximalEffectEffect,
  registerMaximalEffectEffects,
} from "./maximalEffectEffects.js";

// Magic Talent effects (spell offer interaction)
export {
  registerMagicTalentEffects,
} from "./magicTalentEffects.js";

// Blood of Ancients effects (wound cost + AA offer interaction)
export {
  registerBloodOfAncientsEffects,
} from "./bloodOfAncientsEffects.js";

// Hand limit bonus effects (Temporal Portal)
export {
  applyHandLimitBonus,
  registerHandLimitBonusEffects,
} from "./handLimitBonusEffects.js";

// Tome of All Spells effects (discard card, cast spell from offer for free)
export {
  registerTomeOfAllSpellsEffects,
} from "./tomeOfAllSpellsEffects.js";

// Circlet of Proficiency effects (borrow/acquire skills from common offer)
export {
  registerCircletOfProficiencyEffects,
} from "./circletOfProficiencyEffects.js";

// Mysterious Box effects (artifact reveal and polymorphic artifact use)
export {
  registerMysteriousBoxEffects,
} from "./mysteriousBoxEffects.js";

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
