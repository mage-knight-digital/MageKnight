/**
 * Validators for Banner of Protection wound removal action
 */

import type { Validator } from "./types.js";
import { invalid, valid } from "./types.js";
import {
  BANNER_PROTECTION_CHOICE_REQUIRED,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";

/**
 * Validate that player has pending Banner of Protection wound removal choice
 */
export const validateHasPendingBannerProtection: Validator = (
  state,
  playerId,
  _action
) => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingBannerProtectionChoice) {
    return invalid(
      BANNER_PROTECTION_CHOICE_REQUIRED,
      "No pending Banner of Protection wound removal choice"
    );
  }

  return valid();
};
