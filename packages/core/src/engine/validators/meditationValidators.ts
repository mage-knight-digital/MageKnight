/**
 * Validators for Meditation spell resolve action
 */

import type { Validator } from "./types.js";
import { invalid, valid } from "./types.js";
import {
  MEDITATION_PENDING_REQUIRED,
  MEDITATION_INVALID_CARD_SELECTION,
  MEDITATION_INVALID_PHASE,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import type { ResolveMeditationAction } from "@mage-knight/shared";

/**
 * Validate that player has pending Meditation state
 */
export const validateHasPendingMeditation: Validator = (
  state,
  playerId,
  _action
) => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingMeditation) {
    return invalid(
      MEDITATION_PENDING_REQUIRED,
      "No pending Meditation to resolve"
    );
  }

  return valid();
};

/**
 * Validate the Meditation choice based on current phase.
 * Phase 1 (select_cards): selectedCardIds must be valid cards in discard, correct count
 * Phase 2 (place_cards): placeOnTop must be defined (boolean)
 */
export const validateMeditationChoice: Validator = (
  state,
  playerId,
  actionInput
) => {
  const action = actionInput as ResolveMeditationAction;
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const pending = player.pendingMeditation;
  if (!pending) {
    return invalid(MEDITATION_PENDING_REQUIRED, "No pending Meditation");
  }

  if (pending.phase === "select_cards") {
    // Phase 1: validate card selection (powered mode only)
    if (!action.selectedCardIds || action.selectedCardIds.length === 0) {
      return invalid(
        MEDITATION_INVALID_CARD_SELECTION,
        "Must select cards from discard"
      );
    }

    const selectCount = Math.min(2, player.discard.length);
    if (action.selectedCardIds.length !== selectCount) {
      return invalid(
        MEDITATION_INVALID_CARD_SELECTION,
        `Must select exactly ${selectCount} card(s)`
      );
    }

    // Verify all selected cards are in discard
    for (const cardId of action.selectedCardIds) {
      if (!player.discard.includes(cardId)) {
        return invalid(
          MEDITATION_INVALID_CARD_SELECTION,
          `Card ${cardId} not in discard pile`
        );
      }
    }

    return valid();
  }

  if (pending.phase === "place_cards") {
    // Phase 2: validate placement choice
    if (action.placeOnTop === undefined) {
      return invalid(
        MEDITATION_INVALID_PHASE,
        "Must choose top or bottom placement"
      );
    }

    return valid();
  }

  return invalid(MEDITATION_INVALID_PHASE, "Invalid meditation phase");
};
