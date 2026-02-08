/**
 * Offers Command Factories
 *
 * Factory functions that translate offer-related PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/offers
 *
 * @remarks Factories in this module:
 * - createBuySpellCommandFromAction - Buy a spell from the spell offer
 * - createLearnAdvancedActionCommandFromAction - Learn an advanced action
 * - createSelectRewardCommandFromAction - Select a reward from pending rewards
 */

import type { CommandFactory } from "./types.js";
import type { PlayerAction, CardId, SkillId, UnitId } from "@mage-knight/shared";
import {
  BUY_SPELL_ACTION,
  LEARN_ADVANCED_ACTION_ACTION,
  SELECT_REWARD_ACTION,
  CHOOSE_LEVEL_UP_REWARDS_ACTION,
} from "@mage-knight/shared";
import { createBuySpellCommand } from "../buySpellCommand.js";
import { createLearnAdvancedActionCommand } from "../learnAdvancedActionCommand.js";
import { createSelectRewardCommand } from "../selectRewardCommand.js";
import { createChooseLevelUpRewardsCommand } from "../chooseLevelUpRewardsCommand.js";

/**
 * Helper to get buy spell params from action.
 */
function getBuySpellParams(action: PlayerAction): { cardId: CardId } | null {
  if (action.type === BUY_SPELL_ACTION && "cardId" in action) {
    return { cardId: action.cardId };
  }
  return null;
}

/**
 * Helper to get learn advanced action params from action.
 */
function getLearnAdvancedActionParams(
  action: PlayerAction
): { cardId: CardId; fromMonastery: boolean; fromLearning?: boolean } | null {
  if (
    action.type === LEARN_ADVANCED_ACTION_ACTION &&
    "cardId" in action &&
    "fromMonastery" in action
  ) {
    return {
      cardId: action.cardId,
      fromMonastery: action.fromMonastery,
      fromLearning: action.fromLearning,
    };
  }
  return null;
}

/**
 * Buy spell command factory.
 * Creates a command to buy a spell from the spell offer.
 */
export const createBuySpellCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  const params = getBuySpellParams(action);
  if (!params) return null;
  return createBuySpellCommand({
    playerId,
    cardId: params.cardId,
  });
};

/**
 * Learn advanced action command factory.
 * Creates a command to learn an advanced action from the offer or monastery.
 */
export const createLearnAdvancedActionCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  const params = getLearnAdvancedActionParams(action);
  if (!params) return null;
  return createLearnAdvancedActionCommand({
    playerId,
    cardId: params.cardId,
    fromMonastery: params.fromMonastery,
    fromLearning: params.fromLearning,
  });
};

/**
 * Select reward command factory.
 * Creates a command to select a reward from pending rewards.
 */
export const createSelectRewardCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== SELECT_REWARD_ACTION) return null;
  return createSelectRewardCommand({
    playerId,
    cardId: action.cardId,
    rewardIndex: action.rewardIndex,
    unitId: action.unitId as UnitId | undefined,
    disbandUnitInstanceId: action.disbandUnitInstanceId,
  });
};

/**
 * Choose level up rewards command factory.
 * Creates a command to select skill and advanced action for level up.
 */
export const createChooseLevelUpRewardsCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== CHOOSE_LEVEL_UP_REWARDS_ACTION) return null;
  return createChooseLevelUpRewardsCommand({
    playerId,
    level: action.level,
    skillChoice: {
      fromCommonPool: action.skillChoice.fromCommonPool,
      skillId: action.skillChoice.skillId as SkillId,
    },
    advancedActionId: action.advancedActionId as CardId,
  });
};
