/**
 * Validators for EXPLORE action
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, HexDirection } from "@mage-knight/shared";
import { EXPLORE_ACTION } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  NOT_ON_MAP,
  NOT_ON_EDGE,
  INVALID_DIRECTION,
  NOT_ENOUGH_MOVE_POINTS,
  NO_TILES_AVAILABLE,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { isEdgeHex, getValidExploreDirections } from "../explore/index.js";

/**
 * Extract explore direction from action (type guard helper)
 */
function getExploreDirection(action: PlayerAction): HexDirection | null {
  if (action.type === EXPLORE_ACTION && "direction" in action) {
    return action.direction;
  }
  return null;
}

/**
 * Player must be on the map
 */
export function validatePlayerOnMapForExplore(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player?.position) {
    return invalid(NOT_ON_MAP, "Player is not on the map");
  }

  return valid();
}

/**
 * Player must be on a hex at the edge of the map
 */
export function validateOnEdgeHex(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player?.position) {
    return invalid(NOT_ON_MAP, "Player is not on the map");
  }

  if (!isEdgeHex(state, player.position)) {
    return invalid(NOT_ON_EDGE, "Must be on edge of revealed map to explore");
  }

  return valid();
}

/**
 * Direction must lead to unrevealed area
 */
export function validateExploreDirection(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const player = state.players.find((p) => p.id === playerId);
  const direction = getExploreDirection(action);

  if (!player?.position || !direction) {
    return invalid(NOT_ON_MAP, "Invalid explore action");
  }

  const validDirections = getValidExploreDirections(state, player.position);
  if (!validDirections.includes(direction)) {
    return invalid(
      INVALID_DIRECTION,
      "Cannot explore in that direction - area already revealed"
    );
  }

  return valid();
}

/**
 * Player must have enough move points (2 from safe space)
 */
export function validateExploreMoveCost(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  // SIMPLE: Always costs 2 for now
  // FUTURE: Cost equals terrain cost if exploring from dangerous space
  const cost = 2;

  if (player.movePoints < cost) {
    return invalid(
      NOT_ENOUGH_MOVE_POINTS,
      `Need ${cost} move points to explore, have ${player.movePoints}`
    );
  }

  return valid();
}

/**
 * Must have tiles available to draw
 */
export function validateTilesAvailable(
  state: GameState,
  _playerId: string,
  _action: PlayerAction
): ValidationResult {
  // SIMPLE: Check if any tiles remain in either deck
  // FUTURE: Check appropriate deck based on position
  if (
    state.map.tileDeck.countryside.length === 0 &&
    state.map.tileDeck.core.length === 0
  ) {
    return invalid(NO_TILES_AVAILABLE, "No tiles remaining to explore");
  }

  return valid();
}
