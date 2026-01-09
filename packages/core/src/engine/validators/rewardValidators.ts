/**
 * Reward selection validators
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, CardId } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  SELECT_REWARD_ACTION,
  END_TURN_ACTION,
  SITE_REWARD_SPELL,
  SITE_REWARD_ARTIFACT,
  SITE_REWARD_ADVANCED_ACTION,
} from "@mage-knight/shared";
import {
  PLAYER_NOT_FOUND,
  NO_PENDING_REWARDS,
  INVALID_REWARD_INDEX,
  CARD_NOT_IN_OFFER,
  PENDING_REWARDS_NOT_RESOLVED,
} from "./validationCodes.js";

/**
 * Player must have pending rewards to select one.
 */
export function validateHasPendingRewards(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== SELECT_REWARD_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.pendingRewards.length === 0) {
    return invalid(NO_PENDING_REWARDS, "No pending rewards to select");
  }

  return valid();
}

/**
 * The reward index must be valid.
 */
export function validateRewardIndex(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== SELECT_REWARD_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const { rewardIndex } = action;
  if (rewardIndex < 0 || rewardIndex >= player.pendingRewards.length) {
    return invalid(
      INVALID_REWARD_INDEX,
      `Invalid reward index: ${rewardIndex}. Have ${player.pendingRewards.length} pending rewards.`
    );
  }

  return valid();
}

/**
 * The selected card must be in the appropriate offer for the reward type.
 */
export function validateCardInOffer(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== SELECT_REWARD_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const { cardId, rewardIndex } = action;
  const typedCardId = cardId as CardId;
  const reward = player.pendingRewards[rewardIndex];
  if (!reward) return valid(); // Let other validators catch this

  switch (reward.type) {
    case SITE_REWARD_SPELL: {
      const spellOffer = state.offers.spells.cards;
      if (!spellOffer.includes(typedCardId)) {
        return invalid(CARD_NOT_IN_OFFER, "Selected card is not in the spell offer");
      }
      break;
    }

    case SITE_REWARD_ARTIFACT: {
      const artifactDeck = state.decks.artifacts;
      if (!artifactDeck.includes(typedCardId)) {
        return invalid(CARD_NOT_IN_OFFER, "Selected card is not available in the artifact deck");
      }
      break;
    }

    case SITE_REWARD_ADVANCED_ACTION: {
      const aaOffer = state.offers.advancedActions.cards;
      if (!aaOffer.includes(typedCardId)) {
        return invalid(
          CARD_NOT_IN_OFFER,
          "Selected card is not in the advanced action offer"
        );
      }
      break;
    }

    default:
      // Other reward types (fame, crystals) should not use SELECT_REWARD
      return invalid(
        INVALID_REWARD_INDEX,
        `Cannot select a card for reward type: ${reward.type}`
      );
  }

  return valid();
}

/**
 * Player cannot end turn if they have pending rewards.
 * This ensures rewards are resolved before the turn ends.
 */
export function validateNoPendingRewards(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== END_TURN_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.pendingRewards.length > 0) {
    return invalid(
      PENDING_REWARDS_NOT_RESOLVED,
      `You must select your pending rewards before ending your turn (${player.pendingRewards.length} remaining)`
    );
  }

  return valid();
}
