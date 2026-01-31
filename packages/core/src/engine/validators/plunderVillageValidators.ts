/**
 * Plunder village validators
 *
 * Validators for the plunder village action.
 */

import type { ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { PLUNDER_VILLAGE_ACTION, hexKey } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import { NOT_AT_VILLAGE, ALREADY_PLUNDERED, ALREADY_ACTED, ALREADY_MOVED } from "./validationCodes.js";
import { SiteType } from "../../types/map.js";
import { getPlayerById } from "../helpers/playerHelpers.js";

/**
 * Must be at a village site
 */
export function validateAtVillage(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLUNDER_VILLAGE_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player?.position) {
    return invalid(NOT_AT_VILLAGE, "You are not at a village");
  }

  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site || hex.site.type !== SiteType.Village) {
    return invalid(NOT_AT_VILLAGE, "You are not at a village");
  }

  return valid();
}

/**
 * Plundering is a "before turn" action - must not have taken any action yet
 */
export function validateBeforeTurnForPlunder(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLUNDER_VILLAGE_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return valid();

  if (player.hasTakenActionThisTurn) {
    return invalid(ALREADY_ACTED, "Cannot plunder after taking an action - plundering must be done before your turn");
  }

  if (player.hasMovedThisTurn) {
    return invalid(ALREADY_MOVED, "Cannot plunder after moving - plundering must be done before your turn");
  }

  return valid();
}

/**
 * Can only plunder once per turn
 */
export function validateNotAlreadyPlundered(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLUNDER_VILLAGE_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return valid();

  if (player.hasPlunderedThisTurn) {
    return invalid(ALREADY_PLUNDERED, "You can only plunder once per turn");
  }

  return valid();
}
