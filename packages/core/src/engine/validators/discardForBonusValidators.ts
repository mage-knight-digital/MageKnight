/**
 * Discard for bonus validators (Stout Resolve)
 *
 * Validates RESOLVE_DISCARD_FOR_BONUS actions for the Stout Resolve card,
 * which allows optionally discarding cards to increase a chosen effect.
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { RESOLVE_DISCARD_FOR_BONUS_ACTION, CARD_WOUND } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  DISCARD_FOR_BONUS_REQUIRED,
  DISCARD_FOR_BONUS_CARD_NOT_ELIGIBLE,
  DISCARD_FOR_BONUS_TOO_MANY_WOUNDS,
  DISCARD_FOR_BONUS_TOO_MANY_CARDS,
  DISCARD_FOR_BONUS_INVALID_CHOICE,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { getCardsEligibleForDiscardForBonus } from "../effects/stoutResolveEffects.js";

/**
 * Validate that the player has a pending discard-for-bonus state
 */
export const validateHasPendingDiscardForBonus: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingDiscardForBonus) {
    return invalid(
      DISCARD_FOR_BONUS_REQUIRED,
      "No pending discard-for-bonus to resolve"
    );
  }

  return valid();
};

/**
 * Validate the discard-for-bonus selection
 */
export const validateDiscardForBonusSelection: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_DISCARD_FOR_BONUS_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingDiscardForBonus) {
    return valid(); // Let the other validator handle this
  }

  const { cardIds, choiceIndex } = action;
  const pendingState = player.pendingDiscardForBonus;

  // Validate choice index
  if (choiceIndex < 0 || choiceIndex >= pendingState.choiceOptions.length) {
    return invalid(
      DISCARD_FOR_BONUS_INVALID_CHOICE,
      `Invalid choice index: ${choiceIndex}`
    );
  }

  // Empty selection is always valid (discard 0 cards, gain 0 bonus)
  if (cardIds.length === 0) {
    return valid();
  }

  // Validate max discards
  if (cardIds.length > pendingState.maxDiscards) {
    return invalid(
      DISCARD_FOR_BONUS_TOO_MANY_CARDS,
      `Cannot discard more than ${pendingState.maxDiscards} cards`
    );
  }

  // Check all cards are eligible
  const eligibleCards = getCardsEligibleForDiscardForBonus(
    player.hand,
    pendingState.discardFilter
  );
  for (const cardId of cardIds) {
    if (!eligibleCards.includes(cardId)) {
      return invalid(
        DISCARD_FOR_BONUS_CARD_NOT_ELIGIBLE,
        `Card ${cardId} is not eligible for discard-for-bonus`
      );
    }
  }

  // Validate max 1 wound for "any_max_one_wound" filter
  if (pendingState.discardFilter === "any_max_one_wound") {
    const woundCount = cardIds.filter((id) => id === CARD_WOUND).length;
    if (woundCount > 1) {
      return invalid(
        DISCARD_FOR_BONUS_TOO_MANY_WOUNDS,
        "Cannot discard more than 1 wound"
      );
    }
  }

  return valid();
};
