/**
 * Deep Mine crystal color choice validators
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { RESOLVE_DEEP_MINE_ACTION } from "@mage-knight/shared";
import { mineColorToBasicManaColor } from "../../types/map.js";
import { valid, invalid } from "./types.js";
import {
  DEEP_MINE_CHOICE_REQUIRED,
  DEEP_MINE_INVALID_COLOR,
} from "./validationCodes.js";

/**
 * Validate that the player has a pending deep mine choice
 */
export const validateHasPendingDeepMineChoice: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid("PLAYER_NOT_FOUND", "Player not found");
  }

  if (!player.pendingDeepMineChoice) {
    return invalid(DEEP_MINE_CHOICE_REQUIRED, "No pending deep mine choice");
  }

  return valid();
};

/**
 * Validate that the chosen color is one of the available options
 */
export const validateDeepMineColorChoice: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_DEEP_MINE_ACTION) {
    return valid();
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid("PLAYER_NOT_FOUND", "Player not found");
  }

  if (!player.pendingDeepMineChoice) {
    return invalid(DEEP_MINE_CHOICE_REQUIRED, "No pending deep mine choice");
  }

  // Convert the available mine colors to basic mana colors for comparison
  const availableColors = player.pendingDeepMineChoice.map(mineColorToBasicManaColor);
  if (!availableColors.includes(action.color)) {
    return invalid(
      DEEP_MINE_INVALID_COLOR,
      `Invalid color choice: ${action.color}. Available: ${availableColors.join(", ")}`
    );
  }

  return valid();
};
