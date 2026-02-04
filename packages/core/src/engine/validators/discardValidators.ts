/**
 * Discard as cost validators
 *
 * Validates RESOLVE_DISCARD actions for cards that require discarding
 * a card as a cost before gaining their benefit (e.g., Improvisation).
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { RESOLVE_DISCARD_ACTION } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  DISCARD_COST_REQUIRED,
  DISCARD_COST_INVALID_COUNT,
  DISCARD_COST_CARD_NOT_ELIGIBLE,
  DISCARD_COST_CANNOT_SKIP,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { getCardsEligibleForDiscardCost } from "../effects/discardEffects.js";

/**
 * Validate that the player has a pending discard cost
 */
export const validateHasPendingDiscard: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid("PLAYER_NOT_FOUND", "Player not found");
  }

  if (!player.pendingDiscard) {
    return invalid(DISCARD_COST_REQUIRED, "No pending discard cost to resolve");
  }

  return valid();
};

/**
 * Validate the discard action selection
 */
export const validateDiscardSelection: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_DISCARD_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid("PLAYER_NOT_FOUND", "Player not found");
  }

  if (!player.pendingDiscard) {
    return valid(); // Let the other validator handle this
  }

  const { count, optional, filterWounds, colorMatters } = player.pendingDiscard;
  const cardIds = action.cardIds;

  // If skipping (empty cardIds), must be optional
  if (cardIds.length === 0) {
    if (!optional) {
      return invalid(
        DISCARD_COST_CANNOT_SKIP,
        "Cannot skip: discard is required (not optional)"
      );
    }
    return valid();
  }

  // Check card count matches
  if (cardIds.length !== count) {
    return invalid(
      DISCARD_COST_INVALID_COUNT,
      `Expected ${count} card(s) to discard, got ${cardIds.length}`
    );
  }

  // Check all cards are eligible
  const eligibleCards = getCardsEligibleForDiscardCost(
    player.hand,
    filterWounds,
    colorMatters ?? false
  );
  for (const cardId of cardIds) {
    if (!eligibleCards.includes(cardId)) {
      return invalid(
        DISCARD_COST_CARD_NOT_ELIGIBLE,
        `Card ${cardId} is not eligible for discard`
      );
    }
  }

  return valid();
};
