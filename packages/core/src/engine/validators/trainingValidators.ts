/**
 * Training validators
 *
 * Validates RESOLVE_TRAINING actions for the Training advanced action card,
 * which requires throwing away an action card from hand and then selecting
 * a matching AA from the offer.
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { RESOLVE_TRAINING_ACTION } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  TRAINING_REQUIRED,
  TRAINING_CARD_NOT_ELIGIBLE,
  TRAINING_CARD_NOT_IN_OFFER,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { getCardsEligibleForTraining } from "../effects/trainingEffects.js";

/**
 * Validate that the player has a pending Training state
 */
export const validateHasPendingTraining: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingTraining) {
    return invalid(
      TRAINING_REQUIRED,
      "No pending Training to resolve"
    );
  }

  return valid();
};

/**
 * Validate the Training card selection (both phases)
 */
export const validateTrainingSelection: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_TRAINING_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingTraining) {
    return valid(); // Let the other validator handle this
  }

  const pending = player.pendingTraining;
  const cardId = action.cardId;

  if (pending.phase === "select_card") {
    // Phase 1: validate card is eligible action card in hand
    const eligibleCards = getCardsEligibleForTraining(player.hand, pending.sourceCardId);
    if (!eligibleCards.includes(cardId)) {
      return invalid(
        TRAINING_CARD_NOT_ELIGIBLE,
        `Card ${cardId} is not eligible for Training (must be an action card in hand, not the Training card itself)`
      );
    }
  } else {
    // Phase 2: validate card is in the available offer cards
    if (!pending.availableOfferCards.includes(cardId)) {
      return invalid(
        TRAINING_CARD_NOT_IN_OFFER,
        `Card ${cardId} is not available in the AA offer for Training`
      );
    }
  }

  return valid();
};
