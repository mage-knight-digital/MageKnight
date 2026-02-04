/**
 * Magical Glade wound choice validators
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import {
  RESOLVE_GLADE_WOUND_ACTION,
  GLADE_WOUND_CHOICE_HAND,
  GLADE_WOUND_CHOICE_DISCARD,
  CARD_WOUND,
} from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  GLADE_WOUND_CHOICE_REQUIRED,
  GLADE_WOUND_NO_WOUNDS_IN_HAND,
  GLADE_WOUND_NO_WOUNDS_IN_DISCARD,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";

/**
 * Validate that the player has a pending glade wound choice
 */
export const validateHasPendingGladeChoice: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingGladeWoundChoice) {
    return invalid(GLADE_WOUND_CHOICE_REQUIRED, "No pending glade wound choice");
  }

  return valid();
};

/**
 * Validate that the chosen wound source has wounds
 */
export const validateGladeWoundChoice: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_GLADE_WOUND_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (action.choice === GLADE_WOUND_CHOICE_HAND) {
    const hasWoundInHand = player.hand.some((c) => c === CARD_WOUND);
    if (!hasWoundInHand) {
      return invalid(GLADE_WOUND_NO_WOUNDS_IN_HAND, "No wounds in hand to discard");
    }
  }

  if (action.choice === GLADE_WOUND_CHOICE_DISCARD) {
    const hasWoundInDiscard = player.discard.some((c) => c === CARD_WOUND);
    if (!hasWoundInDiscard) {
      return invalid(GLADE_WOUND_NO_WOUNDS_IN_DISCARD, "No wounds in discard pile to discard");
    }
  }

  return valid();
};
