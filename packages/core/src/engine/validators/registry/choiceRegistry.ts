/**
 * Choice/resolution action validator registry
 * Handles RESOLVE_CHOICE_ACTION, SELECT_REWARD_ACTION, RESOLVE_GLADE_WOUND_ACTION, RESOLVE_DEEP_MINE_ACTION, RESOLVE_DISCARD_ACTION, RESOLVE_DISCARD_FOR_ATTACK_ACTION, RESOLVE_DISCARD_FOR_CRYSTAL_ACTION, RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION
 */

import type { Validator } from "../types.js";
import {
  RESOLVE_CHOICE_ACTION,
  SELECT_REWARD_ACTION,
  RESOLVE_GLADE_WOUND_ACTION,
  RESOLVE_DEEP_MINE_ACTION,
  RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION,
  RESOLVE_STEADY_TEMPO_ACTION,
  RESOLVE_MEDITATION_ACTION,
  RESOLVE_DISCARD_ACTION,
  RESOLVE_DISCARD_FOR_ATTACK_ACTION,
  RESOLVE_DISCARD_FOR_CRYSTAL_ACTION,
  RESOLVE_DECOMPOSE_ACTION,
  RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION,
  RESOLVE_HEX_COST_REDUCTION_ACTION,
  RESOLVE_TERRAIN_COST_REDUCTION_ACTION,
  RESOLVE_UNIT_MAINTENANCE_ACTION,
  RESOLVE_BANNER_PROTECTION_ACTION,
  RESOLVE_SOURCE_OPENING_REROLL_ACTION,
} from "@mage-knight/shared";

// Turn validators
import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
} from "../turnValidators.js";

// Choice validators
import {
  validateHasPendingChoice,
  validateChoiceIndex,
} from "../choiceValidators.js";

// Reward validators
import {
  validateHasPendingRewards,
  validateRewardIndex,
  validateCardInOffer,
} from "../rewardValidators.js";

// Glade validators
import {
  validateHasPendingGladeChoice,
  validateGladeWoundChoice,
} from "../gladeValidators.js";

// Deep mine validators
import {
  validateHasPendingDeepMineChoice,
  validateDeepMineColorChoice,
} from "../deepMineValidators.js";

// Discard cost validators
import {
  validateHasPendingDiscard,
  validateDiscardSelection,
} from "../discardValidators.js";

// Discard for attack validators (Sword of Justice)
import {
  validateHasPendingDiscardForAttack,
  validateDiscardForAttackSelection,
} from "../discardForAttackValidators.js";

// Discard for crystal validators (Savage Harvesting)
import {
  validateHasPendingDiscardForCrystal,
  validateDiscardForCrystalSelection,
  validateHasPendingArtifactColorChoice,
  validateArtifactCrystalColorSelection,
} from "../discardForCrystalValidators.js";

// Decompose validators
import {
  validateHasPendingDecompose,
  validateDecomposeSelection,
} from "../decomposeValidators.js";

// Crystal Joy validators
import {
  validateHasPendingCrystalJoyReclaim,
  validateCrystalJoyReclaimCard,
} from "../crystalJoyReclaimValidators.js";

// Steady Tempo validators
import {
  validateHasPendingSteadyTempo,
  validateSteadyTempoChoice,
} from "../steadyTempoValidators.js";

// Terrain cost reduction validators (Druidic Paths)
import {
  validateHasPendingHexCostReduction,
  validateHexCostReductionCoordinate,
  validateHasPendingTerrainCostReduction,
  validateTerrainCostReductionTerrain,
} from "../terrainCostReductionValidators.js";

// Unit maintenance validators (Magic Familiars)
import {
  validateHasPendingUnitMaintenance,
  validateUnitMaintenanceChoice,
} from "../unitMaintenanceValidators.js";

// Banner of Protection validators
import {
  validateHasPendingBannerProtection,
} from "../bannerProtectionValidators.js";

// Source Opening reroll validators
import {
  validateHasPendingSourceOpeningReroll,
} from "../sourceOpeningRerollValidators.js";

// Meditation validators
import {
  validateHasPendingMeditation,
  validateMeditationChoice,
} from "../meditationValidators.js";

export const choiceRegistry: Record<string, Validator[]> = {
  [RESOLVE_CHOICE_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingChoice,
    validateChoiceIndex,
  ],
  [SELECT_REWARD_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateHasPendingRewards,
    validateRewardIndex,
    validateCardInOffer,
  ],
  [RESOLVE_GLADE_WOUND_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingGladeChoice,
    validateGladeWoundChoice,
  ],
  [RESOLVE_DEEP_MINE_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingDeepMineChoice,
    validateDeepMineColorChoice,
  ],
  [RESOLVE_DISCARD_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingDiscard,
    validateDiscardSelection,
  ],
  [RESOLVE_DISCARD_FOR_ATTACK_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingDiscardForAttack,
    validateDiscardForAttackSelection,
  ],
  [RESOLVE_DISCARD_FOR_CRYSTAL_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingDiscardForCrystal,
    validateDiscardForCrystalSelection,
  ],
  [RESOLVE_DECOMPOSE_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingDecompose,
    validateDecomposeSelection,
  ],
  [RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingArtifactColorChoice,
    validateArtifactCrystalColorSelection,
  ],
  [RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingCrystalJoyReclaim,
    validateCrystalJoyReclaimCard,
  ],
  [RESOLVE_STEADY_TEMPO_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingSteadyTempo,
    validateSteadyTempoChoice,
  ],
  [RESOLVE_HEX_COST_REDUCTION_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingHexCostReduction,
    validateHexCostReductionCoordinate,
  ],
  [RESOLVE_TERRAIN_COST_REDUCTION_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingTerrainCostReduction,
    validateTerrainCostReductionTerrain,
  ],
  [RESOLVE_UNIT_MAINTENANCE_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingUnitMaintenance,
    validateUnitMaintenanceChoice,
  ],
  [RESOLVE_BANNER_PROTECTION_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingBannerProtection,
  ],
  [RESOLVE_SOURCE_OPENING_REROLL_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingSourceOpeningReroll,
  ],
  [RESOLVE_MEDITATION_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingMeditation,
    validateMeditationChoice,
  ],
};
