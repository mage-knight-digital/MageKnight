/**
 * Discard for attack validators (Sword of Justice)
 *
 * Validates RESOLVE_DISCARD_FOR_ATTACK actions for the Sword of Justice
 * basic effect, which allows discarding any number of non-wound cards
 * to gain attack.
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { RESOLVE_DISCARD_FOR_ATTACK_ACTION } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  DISCARD_FOR_ATTACK_REQUIRED,
  DISCARD_FOR_ATTACK_CARD_NOT_ELIGIBLE,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { getCardsEligibleForDiscardForAttack } from "../effects/swordOfJusticeEffects.js";

/**
 * Validate that the player has a pending discard-for-attack state
 */
export const validateHasPendingDiscardForAttack: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid("PLAYER_NOT_FOUND", "Player not found");
  }

  if (!player.pendingDiscardForAttack) {
    return invalid(
      DISCARD_FOR_ATTACK_REQUIRED,
      "No pending discard-for-attack to resolve"
    );
  }

  return valid();
};

/**
 * Validate the discard-for-attack selection
 */
export const validateDiscardForAttackSelection: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_DISCARD_FOR_ATTACK_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid("PLAYER_NOT_FOUND", "Player not found");
  }

  if (!player.pendingDiscardForAttack) {
    return valid(); // Let the other validator handle this
  }

  const cardIds = action.cardIds;

  // Empty selection is always valid (discard 0 cards, gain 0 attack)
  if (cardIds.length === 0) {
    return valid();
  }

  // Check all cards are eligible (non-wound, in hand)
  const eligibleCards = getCardsEligibleForDiscardForAttack(player.hand);
  for (const cardId of cardIds) {
    if (!eligibleCards.includes(cardId)) {
      return invalid(
        DISCARD_FOR_ATTACK_CARD_NOT_ELIGIBLE,
        `Card ${cardId} is not eligible for discard-for-attack (must be non-wound and in hand)`
      );
    }
  }

  return valid();
};
