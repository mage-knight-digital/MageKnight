/**
 * Discard for crystal validators (Savage Harvesting)
 *
 * Validates RESOLVE_DISCARD_FOR_CRYSTAL and RESOLVE_ARTIFACT_CRYSTAL_COLOR actions
 * for the Savage Harvesting card, which allows discarding a non-wound card
 * to gain a crystal matching the card's color (or choosing color for artifacts).
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, BasicManaColor } from "@mage-knight/shared";
import {
  RESOLVE_DISCARD_FOR_CRYSTAL_ACTION,
  RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  DISCARD_FOR_CRYSTAL_REQUIRED,
  DISCARD_FOR_CRYSTAL_CARD_NOT_ELIGIBLE,
  DISCARD_FOR_CRYSTAL_CANNOT_SKIP,
  ARTIFACT_CRYSTAL_COLOR_REQUIRED,
  ARTIFACT_CRYSTAL_INVALID_COLOR,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { getCardsEligibleForDiscardForCrystal } from "../effects/discardForCrystalEffects.js";

const VALID_CRYSTAL_COLORS: readonly BasicManaColor[] = [
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
];

/**
 * Validate that the player has a pending discard-for-crystal state
 */
export const validateHasPendingDiscardForCrystal: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingDiscardForCrystal) {
    return invalid(
      DISCARD_FOR_CRYSTAL_REQUIRED,
      "No pending discard-for-crystal to resolve"
    );
  }

  return valid();
};

/**
 * Validate the discard-for-crystal card selection
 */
export const validateDiscardForCrystalSelection: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_DISCARD_FOR_CRYSTAL_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingDiscardForCrystal) {
    return valid(); // Let the other validator handle this
  }

  const cardId = action.cardId;

  // Handle skip (null cardId)
  if (cardId === null) {
    if (!player.pendingDiscardForCrystal.optional) {
      return invalid(
        DISCARD_FOR_CRYSTAL_CANNOT_SKIP,
        "Cannot skip discard: discard is required (not optional)"
      );
    }
    return valid();
  }

  // Check card is eligible (non-wound, in hand)
  const eligibleCards = getCardsEligibleForDiscardForCrystal(player.hand);
  if (!eligibleCards.includes(cardId)) {
    return invalid(
      DISCARD_FOR_CRYSTAL_CARD_NOT_ELIGIBLE,
      `Card ${cardId} is not eligible for discard-for-crystal (must be non-wound and in hand)`
    );
  }

  return valid();
};

/**
 * Validate that the player has a pending color choice for artifact discard
 */
export const validateHasPendingArtifactColorChoice: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingDiscardForCrystal?.awaitingColorChoice) {
    return invalid(
      ARTIFACT_CRYSTAL_COLOR_REQUIRED,
      "No pending artifact crystal color choice to resolve"
    );
  }

  return valid();
};

/**
 * Validate the artifact crystal color selection
 */
export const validateArtifactCrystalColorSelection: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingDiscardForCrystal?.awaitingColorChoice) {
    return valid(); // Let the other validator handle this
  }

  const color = action.color;

  // Validate the color is a valid basic mana color
  if (!VALID_CRYSTAL_COLORS.includes(color)) {
    return invalid(
      ARTIFACT_CRYSTAL_INVALID_COLOR,
      `Invalid crystal color: ${color}. Must be red, blue, green, or white.`
    );
  }

  return valid();
};
