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
  RESOLVE_DISCARD_ACTION,
  RESOLVE_DISCARD_FOR_ATTACK_ACTION,
  RESOLVE_DISCARD_FOR_CRYSTAL_ACTION,
  RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION,
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
  [RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingArtifactColorChoice,
    validateArtifactCrystalColorSelection,
  ],
};
