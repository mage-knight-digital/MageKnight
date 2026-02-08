/**
 * Book of Wisdom validators
 *
 * Validates RESOLVE_BOOK_OF_WISDOM actions for the Book of Wisdom artifact,
 * which requires throwing away an action card from hand and then selecting
 * a matching card from the offer.
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { RESOLVE_BOOK_OF_WISDOM_ACTION } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  BOOK_OF_WISDOM_REQUIRED,
  BOOK_OF_WISDOM_CARD_NOT_ELIGIBLE,
  BOOK_OF_WISDOM_CARD_NOT_IN_OFFER,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { getCardsEligibleForBookOfWisdom } from "../effects/bookOfWisdomEffects.js";

/**
 * Validate that the player has a pending Book of Wisdom state
 */
export const validateHasPendingBookOfWisdom: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingBookOfWisdom) {
    return invalid(
      BOOK_OF_WISDOM_REQUIRED,
      "No pending Book of Wisdom to resolve"
    );
  }

  return valid();
};

/**
 * Validate the Book of Wisdom card selection (both phases)
 */
export const validateBookOfWisdomSelection: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_BOOK_OF_WISDOM_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingBookOfWisdom) {
    return valid(); // Let the other validator handle this
  }

  const pending = player.pendingBookOfWisdom;
  const cardId = action.cardId;

  if (pending.phase === "select_card") {
    // Phase 1: validate card is eligible action card in hand
    const eligibleCards = getCardsEligibleForBookOfWisdom(player.hand, pending.sourceCardId);
    if (!eligibleCards.includes(cardId)) {
      return invalid(
        BOOK_OF_WISDOM_CARD_NOT_ELIGIBLE,
        `Card ${cardId} is not eligible for Book of Wisdom (must be an action card in hand, not the Book of Wisdom card itself)`
      );
    }
  } else {
    // Phase 2: validate card is in the available offer cards
    if (!pending.availableOfferCards.includes(cardId)) {
      return invalid(
        BOOK_OF_WISDOM_CARD_NOT_IN_OFFER,
        `Card ${cardId} is not available in the offer for Book of Wisdom`
      );
    }
  }

  return valid();
};
