/**
 * Validators for Crystal Joy reclaim action
 */

import type { Validator } from "./types.js";
import { invalid, valid } from "./types.js";
import {
  CRYSTAL_JOY_RECLAIM_REQUIRED,
  CRYSTAL_JOY_CARD_NOT_IN_DISCARD,
  CRYSTAL_JOY_CARD_NOT_ELIGIBLE,
  PLAYER_NOT_FOUND,
  CARD_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { getCard } from "../validActions/cards/index.js";
import { isCardEligibleForReclaim } from "../rules/crystalJoyReclaim.js";
import type { ResolveCrystalJoyReclaimAction } from "@mage-knight/shared";

/**
 * Validate that player has pending Crystal Joy reclaim
 */
export const validateHasPendingCrystalJoyReclaim: Validator = (
  state,
  playerId,
  _action
) => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingCrystalJoyReclaim) {
    return invalid(
      CRYSTAL_JOY_RECLAIM_REQUIRED,
      "No pending Crystal Joy reclaim"
    );
  }

  return valid();
};

/**
 * Validate that the selected card is in discard pile and eligible for reclaim
 */
export const validateCrystalJoyReclaimCard: Validator = (
  state,
  playerId,
  actionInput
) => {
  const action = actionInput as ResolveCrystalJoyReclaimAction;
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  // If no cardId provided, player is skipping - always valid
  if (!action.cardId) {
    return valid();
  }

  // Verify card is in discard pile
  if (!player.discard.includes(action.cardId)) {
    return invalid(
      CRYSTAL_JOY_CARD_NOT_IN_DISCARD,
      `Card ${action.cardId} not in discard pile`
    );
  }

  // Verify card is eligible based on version
  if (!player.pendingCrystalJoyReclaim) {
    return invalid(
      CRYSTAL_JOY_RECLAIM_REQUIRED,
      "No pending Crystal Joy reclaim"
    );
  }

  const card = getCard(action.cardId);
  if (!card) {
    return invalid(CARD_NOT_FOUND, `Card not found: ${action.cardId}`);
  }

  if (
    !isCardEligibleForReclaim(card, player.pendingCrystalJoyReclaim.version)
  ) {
    return invalid(
      CRYSTAL_JOY_CARD_NOT_ELIGIBLE,
      `Card ${action.cardId} not eligible for ${player.pendingCrystalJoyReclaim.version} Crystal Joy reclaim`
    );
  }

  return valid();
};
