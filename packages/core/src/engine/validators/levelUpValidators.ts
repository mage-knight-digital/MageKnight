/**
 * Level Up Reward Validators
 *
 * Validates the CHOOSE_LEVEL_UP_REWARDS_ACTION and checks for
 * pending level up rewards blocking other actions.
 *
 * @module validators/levelUpValidators
 */

import type { Validator } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  NO_PENDING_LEVEL_UP_REWARDS,
  INVALID_LEVEL_UP_LEVEL,
  SKILL_NOT_AVAILABLE,
  SKILL_ALREADY_OWNED,
  AA_NOT_IN_OFFER,
  LEVEL_UP_REWARDS_PENDING,
} from "./validationCodes.js";
import { CHOOSE_LEVEL_UP_REWARDS_ACTION, type SkillId, type CardId } from "@mage-knight/shared";
import { getPlayerById } from "../helpers/playerHelpers.js";

/**
 * Validates that the player has pending level up rewards.
 * Used for CHOOSE_LEVEL_UP_REWARDS_ACTION.
 */
export const validateHasPendingLevelUpRewards: Validator = (
  state,
  playerId,
  _action
) => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return valid(); // Let other validators catch this
  }

  if (player.pendingLevelUpRewards.length === 0) {
    return invalid(
      NO_PENDING_LEVEL_UP_REWARDS,
      "No pending level up rewards to select"
    );
  }

  return valid();
};

/**
 * Validates that the level in the action is in the pending rewards.
 */
export const validateLevelInPendingRewards: Validator = (
  state,
  playerId,
  action
) => {
  if (action.type !== CHOOSE_LEVEL_UP_REWARDS_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return valid();
  }

  const pendingReward = player.pendingLevelUpRewards.find(
    (r) => r.level === action.level
  );

  if (!pendingReward) {
    return invalid(
      INVALID_LEVEL_UP_LEVEL,
      `Level ${action.level} is not in pending level up rewards`
    );
  }

  return valid();
};

/**
 * Validates that the selected skill is available (from drawn skills or common pool).
 */
export const validateSkillAvailable: Validator = (state, playerId, action) => {
  if (action.type !== CHOOSE_LEVEL_UP_REWARDS_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return valid();
  }

  const { skillChoice } = action;
  const skillId = skillChoice.skillId as SkillId;

  if (skillChoice.fromCommonPool) {
    // Must be in common pool
    if (!state.offers.commonSkills.includes(skillId)) {
      return invalid(
        SKILL_NOT_AVAILABLE,
        `Skill ${skillId} is not in the common pool`
      );
    }
  } else {
    // Must be in drawn skills for this level
    const pendingReward = player.pendingLevelUpRewards.find(
      (r) => r.level === action.level
    );
    if (!pendingReward || !pendingReward.drawnSkills.includes(skillId)) {
      return invalid(
        SKILL_NOT_AVAILABLE,
        `Skill ${skillId} was not drawn for this level up`
      );
    }
  }

  return valid();
};

/**
 * Validates that the player doesn't already own the selected skill.
 */
export const validateSkillNotAlreadyOwned: Validator = (
  state,
  playerId,
  action
) => {
  if (action.type !== CHOOSE_LEVEL_UP_REWARDS_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return valid();
  }

  const skillId = action.skillChoice.skillId as SkillId;

  if (player.skills.includes(skillId)) {
    return invalid(
      SKILL_ALREADY_OWNED,
      `You already have the skill ${skillId}`
    );
  }

  return valid();
};

/**
 * Validates that the selected advanced action is in the offer.
 */
export const validateAAInLevelUpOffer: Validator = (state, _playerId, action) => {
  if (action.type !== CHOOSE_LEVEL_UP_REWARDS_ACTION) {
    return valid();
  }

  const cardId = action.advancedActionId as CardId;

  if (!state.offers.advancedActions.cards.includes(cardId)) {
    return invalid(
      AA_NOT_IN_OFFER,
      `Advanced action ${cardId} is not in the offer`
    );
  }

  return valid();
};

/**
 * Validates that the player does NOT have pending level up rewards.
 * Used to block other actions when level up rewards need to be selected.
 */
export const validateNoPendingLevelUpRewards: Validator = (
  state,
  playerId,
  _action
) => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return valid();
  }

  if (player.pendingLevelUpRewards.length > 0) {
    return invalid(
      LEVEL_UP_REWARDS_PENDING,
      "You must select your level up rewards first"
    );
  }

  return valid();
};
