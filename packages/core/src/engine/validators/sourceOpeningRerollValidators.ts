/**
 * Validators for Source Opening reroll choice action (FAQ S3)
 */

import type { Validator } from "./types.js";
import { invalid, valid } from "./types.js";
import {
  SOURCE_OPENING_REROLL_CHOICE_REQUIRED,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";

/**
 * Validate that player has pending Source Opening reroll choice
 */
export const validateHasPendingSourceOpeningReroll: Validator = (
  state,
  playerId,
  _action
) => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingSourceOpeningRerollChoice) {
    return invalid(
      SOURCE_OPENING_REROLL_CHOICE_REQUIRED,
      "No pending Source Opening reroll choice"
    );
  }

  return valid();
};
