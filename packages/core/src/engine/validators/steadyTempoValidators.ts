/**
 * Validators for Steady Tempo deck placement action
 */

import type { Validator } from "./types.js";
import { invalid, valid } from "./types.js";
import {
  STEADY_TEMPO_PLACEMENT_REQUIRED,
  STEADY_TEMPO_CANNOT_PLACE_BASIC,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import type { ResolveSteadyTempoAction } from "@mage-knight/shared";

/**
 * Validate that player has pending Steady Tempo deck placement
 */
export const validateHasPendingSteadyTempo: Validator = (
  state,
  playerId,
  _action
) => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingSteadyTempoDeckPlacement) {
    return invalid(
      STEADY_TEMPO_PLACEMENT_REQUIRED,
      "No pending Steady Tempo deck placement"
    );
  }

  return valid();
};

/**
 * Validate that the Steady Tempo placement choice is valid.
 * Basic version requires a non-empty deck to place on bottom.
 */
export const validateSteadyTempoChoice: Validator = (
  state,
  playerId,
  actionInput
) => {
  const action = actionInput as ResolveSteadyTempoAction;
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  // If not placing, always valid
  if (!action.place) {
    return valid();
  }

  // Basic version: deck must not be empty to place on bottom
  if (
    player.pendingSteadyTempoDeckPlacement?.version === "basic" &&
    player.deck.length === 0
  ) {
    return invalid(
      STEADY_TEMPO_CANNOT_PLACE_BASIC,
      "Cannot place Steady Tempo on bottom of empty deck (basic version)"
    );
  }

  return valid();
};
