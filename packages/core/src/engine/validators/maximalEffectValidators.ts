/**
 * Maximal Effect validators
 *
 * Validates RESOLVE_MAXIMAL_EFFECT actions for the Maximal Effect advanced action card,
 * which requires throwing away an action card from hand to multiply its effect.
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { RESOLVE_MAXIMAL_EFFECT_ACTION } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  MAXIMAL_EFFECT_REQUIRED,
  MAXIMAL_EFFECT_CARD_NOT_ELIGIBLE,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { getCardsEligibleForMaximalEffect } from "../effects/maximalEffectEffects.js";

/**
 * Validate that the player has a pending maximal effect state
 */
export const validateHasPendingMaximalEffect: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingMaximalEffect) {
    return invalid(
      MAXIMAL_EFFECT_REQUIRED,
      "No pending Maximal Effect to resolve"
    );
  }

  return valid();
};

/**
 * Validate the maximal effect card selection
 */
export const validateMaximalEffectSelection: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_MAXIMAL_EFFECT_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingMaximalEffect) {
    return valid(); // Let the other validator handle this
  }

  const cardId = action.cardId;

  // Check card is eligible (action card, in hand, not the Maximal Effect card itself)
  const eligibleCards = getCardsEligibleForMaximalEffect(player.hand, player.pendingMaximalEffect.sourceCardId);
  if (!eligibleCards.includes(cardId)) {
    return invalid(
      MAXIMAL_EFFECT_CARD_NOT_ELIGIBLE,
      `Card ${cardId} is not eligible for Maximal Effect (must be an action card in hand, not the Maximal Effect card itself)`
    );
  }

  return valid();
};
