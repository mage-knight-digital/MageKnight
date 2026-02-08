/**
 * Decompose validators
 *
 * Validates RESOLVE_DECOMPOSE actions for the Decompose advanced action card,
 * which requires throwing away an action card from hand to gain crystals.
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { RESOLVE_DECOMPOSE_ACTION } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  DECOMPOSE_REQUIRED,
  DECOMPOSE_CARD_NOT_ELIGIBLE,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { getCardsEligibleForDecompose } from "../effects/decomposeEffects.js";

/**
 * Validate that the player has a pending decompose state
 */
export const validateHasPendingDecompose: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingDecompose) {
    return invalid(
      DECOMPOSE_REQUIRED,
      "No pending decompose to resolve"
    );
  }

  return valid();
};

/**
 * Validate the decompose card selection
 */
export const validateDecomposeSelection: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_DECOMPOSE_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingDecompose) {
    return valid(); // Let the other validator handle this
  }

  const cardId = action.cardId;

  // Check card is eligible (action card, in hand, not the Decompose card itself)
  const eligibleCards = getCardsEligibleForDecompose(player.hand, player.pendingDecompose.sourceCardId);
  if (!eligibleCards.includes(cardId)) {
    return invalid(
      DECOMPOSE_CARD_NOT_ELIGIBLE,
      `Card ${cardId} is not eligible for Decompose (must be an action card in hand, not the Decompose card itself)`
    );
  }

  return valid();
};
