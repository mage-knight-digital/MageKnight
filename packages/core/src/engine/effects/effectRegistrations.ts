/**
 * Effect Registrations Coordinator
 *
 * Coordinates registration of all effect handlers with the central registry.
 * Each effect module provides its own registration function.
 *
 * @module effects/effectRegistrations
 *
 * @remarks
 * This module acts as the central point where all effect registrations are triggered.
 * The actual handler implementations live in their respective modules.
 */

import type { EffectHandler } from "./effectRegistry.js";

// Registration functions from each module
import { registerAtomicEffects } from "./atomicEffects.js";
import { registerCompoundEffects } from "./compound.js";
import { registerChoiceEffects } from "./choice.js";
import { registerCrystallizeEffects } from "./crystallize.js";
import { registerCardBoostEffects } from "./cardBoostResolvers.js";
import { registerCombatEffects } from "./combatEffects.js";
import { registerManaDrawEffects } from "./manaDrawEffects.js";
import { registerUnitEffects } from "./unitEffects.js";
import { registerHealUnitEffects } from "./healUnitEffects.js";
import { registerDiscardEffects } from "./discardEffects.js";
import { registerMapEffects } from "./mapEffects.js";
import { registerManaPaymentEffects } from "./manaPaymentEffects.js";
import { registerTerrainEffects } from "./terrainEffects.js";
import { registerSwordOfJusticeEffects } from "./swordOfJusticeEffects.js";
import { registerAttackFameEffects } from "./attackFameEffects.js";
import { registerPolarizeEffects } from "./polarizeEffects.js";
import { registerRitualOfPainEffects } from "./ritualOfPainEffects.js";
import { registerDiscardForCrystalEffects } from "./discardForCrystalEffects.js";
import { registerRuthlessCoercionEffects } from "./ruthlessCoercionEffects.js";
import { registerEnergyFlowEffects } from "./energyFlowEffects.js";
import { registerCureEffects } from "./cureEffects.js";
import { registerInvocationEffects } from "./invocationEffects.js";
import { registerReadyUnitsBudgetEffects } from "./readyUnitsBudgetEffects.js";
import { registerWoundActivatingUnitEffects } from "./woundActivatingUnitEffects.js";
import { registerManaMeltdownEffects } from "./manaMeltdownEffects.js";
import { registerAltemMagesEffects } from "./altemMagesEffects.js";
import { registerPureMagicEffects } from "./pureMagicEffects.js";
import { registerHeroicTaleEffects } from "./heroicTaleEffects.js";
import { registerNobleMannersBonusEffects } from "./nobleMannersBonusEffects.js";
import { registerFreeRecruitEffects } from "./freeRecruitEffects.js";
import { registerSacrificeEffects } from "./sacrificeEffects.js";
import { registerCallToArmsEffects } from "./callToArmsEffects.js";
import { registerManaClaimEffects } from "./manaClaimEffects.js";
import { registerManaBoltEffects } from "./manaBoltEffects.js";
import { registerMindReadEffects } from "./mindReadEffects.js";
import { registerBannerProtectionEffects } from "./bannerProtectionEffects.js";
import { registerHealAllUnitsEffects } from "./healAllUnitsEffects.js";
import { registerWingsOfNightEffects } from "./wingsOfNightEffects.js";
import { registerDecomposeEffects } from "./decomposeEffects.js";
import { registerCrystalMasteryEffects } from "./crystalMasteryEffects.js";
import { registerPossessEffects } from "./possessEffects.js";
import { registerManaStormEffects } from "./manaStormEffects.js";
import { registerSourceOpeningEffects } from "./sourceOpeningEffects.js";
import { registerHornOfWrathEffects } from "./hornOfWrathEffects.js";
import { registerMaximalEffectEffects } from "./maximalEffectEffects.js";
import { registerEndlessGemPouchEffects } from "./endlessGemPouchEffects.js";
import { registerBookOfWisdomEffects } from "./bookOfWisdomEffects.js";

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the registry with a reference to the main resolver.
 * This is called from index.ts to break the circular dependency.
 *
 * @param resolver - The main resolveEffect function
 */
export function initializeRegistry(resolver: EffectHandler): void {
  registerAllEffects(resolver);
}

// ============================================================================
// REGISTRATION COORDINATOR
// ============================================================================

/**
 * Register all effect handlers by calling each module's registration function.
 *
 * @param resolver - The main resolveEffect function for recursive resolution
 */
function registerAllEffects(resolver: EffectHandler): void {
  // Atomic effects (GainMove, GainAttack, GainBlock, etc.)
  registerAtomicEffects();

  // Compound effects (Compound, Conditional, Scaling)
  registerCompoundEffects(resolver);

  // Choice effects
  registerChoiceEffects();

  // Crystallize effects (ConvertManaToCrystal, CrystallizeColor)
  registerCrystallizeEffects(resolver);

  // Card boost effects (CardBoost, ResolveBoostTarget)
  registerCardBoostEffects(resolver);

  // Combat enemy targeting effects (pass resolver for bundled effect support)
  registerCombatEffects(resolver);

  // Mana draw effects (ManaDrawPowered, ManaDrawPickDie, ManaDrawSetColor)
  registerManaDrawEffects();

  // Unit effects (ReadyUnit)
  registerUnitEffects();

  // Heal unit effects
  registerHealUnitEffects();

  // Discard effects
  registerDiscardEffects();

  // Map effects (RevealTiles)
  registerMapEffects();

  // Mana payment effects
  registerManaPaymentEffects();

  // Terrain-based effects
  registerTerrainEffects();

  // Sword of Justice effects (DiscardForAttack, FamePerEnemyDefeated)
  registerSwordOfJusticeEffects();

  // Attack-based fame tracking effects (Axe Throw)
  registerAttackFameEffects();

  // Polarize mana effects (Arythea's Polarization skill)
  registerPolarizeEffects();

  // Ritual of Pain effects (Arythea)
  registerRitualOfPainEffects();

  // Discard-for-crystal effects (Savage Harvesting)
  registerDiscardForCrystalEffects();

  // Ruthless Coercion effects (recruit discount, ready for influence)
  registerRuthlessCoercionEffects();

  // Energy Flow effects (ready unit + spend opponent units)
  registerEnergyFlowEffects();

  // Cure / Disease effects (white spell)
  registerCureEffects();

  // Invocation effects (Arythea's Invocation skill)
  registerInvocationEffects();

  // Ready units budget effects (Restoration/Rebirth spell)
  registerReadyUnitsBudgetEffects();

  // Wound activating unit effects (Utem Swordsmen self-wound)
  registerWoundActivatingUnitEffects();

  // Mana Meltdown / Mana Radiance effects (interactive red spell)
  registerManaMeltdownEffects();

  // Altem Mages effects (Cold Fire Attack/Block with mana scaling)
  registerAltemMagesEffects();

  // Pure Magic effects (mana-color-driven effect selection)
  registerPureMagicEffects();

  // Heroic Tale effects (recruitment bonus modifier)
  registerHeroicTaleEffects();

  // Noble Manners effects (interaction bonus modifier)
  registerNobleMannersBonusEffects();

  // Free recruit effects (Banner of Command, Call to Glory)
  registerFreeRecruitEffects();

  // Sacrifice effects (Offering powered spell)
  registerSacrificeEffects();

  // Call to Arms effects (borrow unit ability from offer)
  registerCallToArmsEffects(resolver);

  // Mana Claim / Mana Curse effects (interactive blue spell)
  registerManaClaimEffects();

  // Mana Bolt effects (blue spell, mana-color-driven attack)
  registerManaBoltEffects();

  // Mind Read / Mind Steal effects (interactive white spell)
  registerMindReadEffects();

  // Banner of Protection effects (activate powered flag)
  registerBannerProtectionEffects();

  // Heal all units effects (Banner of Fortitude powered)
  registerHealAllUnitsEffects();

  // Wings of Night effects (multi-target skip-attack with move cost)
  registerWingsOfNightEffects();

  // Decompose effects (throw away action card for crystals)
  registerDecomposeEffects();

  // Crystal Mastery effects (crystal duplication + spent crystal return)
  registerCrystalMasteryEffects();

  // Possess enemy effects (Charm/Possess spell powered effect)
  registerPossessEffects(resolver);

  // Mana Storm effects (source die manipulation + modifiers)
  registerManaStormEffects();

  // Source Opening effects (Goldyx interactive skill - reroll a Source die)
  registerSourceOpeningEffects();

  // Horn of Wrath effects (die rolling with wound risk)
  registerHornOfWrathEffects();

  // Maximal Effect effects (throw away action card and multiply its effect)
  registerMaximalEffectEffects();

  // Endless Gem Pouch effects (crystal rolling with gold choice and black fame)
  registerEndlessGemPouchEffects();

  // Book of Wisdom effects (throw away action card, gain from offer)
  registerBookOfWisdomEffects();
}
