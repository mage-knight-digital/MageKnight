/**
 * Rewards validators routing - SELECT_REWARD, RESOLVE_GLADE_WOUND, RESOLVE_DEEP_MINE, CHOOSE_LEVEL_UP_REWARDS
 */

import type { ValidatorRegistry } from "./types.js";
import {
  SELECT_REWARD_ACTION,
  RESOLVE_GLADE_WOUND_ACTION,
  RESOLVE_DEEP_MINE_ACTION,
  CHOOSE_LEVEL_UP_REWARDS_ACTION,
} from "@mage-knight/shared";

import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
} from "../turnValidators.js";

import {
  validateHasPendingRewards,
  validateRewardIndex,
  validateCardInOffer,
} from "../rewardValidators.js";

import {
  validateHasPendingGladeChoice,
  validateGladeWoundChoice,
} from "../gladeValidators.js";

import {
  validateHasPendingDeepMineChoice,
  validateDeepMineColorChoice,
} from "../deepMineValidators.js";

import {
  validateHasPendingLevelUpRewards,
  validateLevelInPendingRewards,
  validateSkillAvailable,
  validateSkillNotAlreadyOwned,
  validateAAInLevelUpOffer,
} from "../levelUpValidators.js";

export const rewardValidatorRegistry: ValidatorRegistry = {
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
  [CHOOSE_LEVEL_UP_REWARDS_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingLevelUpRewards,
    validateLevelInPendingRewards,
    validateSkillAvailable,
    validateSkillNotAlreadyOwned,
    validateAAInLevelUpOffer,
  ],
};
