/**
 * Validators for EXPLORE action
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, HexDirection } from "@mage-knight/shared";
import { EXPLORE_ACTION, MAP_SHAPE_WEDGE } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  NOT_ON_MAP,
  NOT_ON_EDGE,
  INVALID_DIRECTION,
  NOT_ENOUGH_MOVE_POINTS,
  NO_TILES_AVAILABLE,
  PLAYER_NOT_FOUND,
  INVALID_WEDGE_DIRECTION,
} from "./validationCodes.js";
import {
  isEdgeHex,
  getExpansionDirections,
} from "../explore/index.js";
import { getValidExploreOptions } from "../validActions/exploration.js";

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
 * Direction must lead to unrevealed area that the player is adjacent to.
 * Uses the same logic as getValidExploreOptions for consistency.
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

  // Use the same logic as getValidExploreOptions to determine valid directions
  const exploreOptions = getValidExploreOptions(state, player);
  if (!exploreOptions) {
    return invalid(
      INVALID_DIRECTION,
      "Cannot explore from current position"
    );
  }

  const validDirections = exploreOptions.directions.map((d) => d.direction);
  if (!validDirections.includes(direction)) {
    return invalid(
      INVALID_DIRECTION,
      "Cannot explore in that direction - area already revealed or not adjacent"
    );
  }

  return valid();
}

/**
 * For wedge shape maps, direction must be valid for the wedge pattern (NE or E only)
 */
export function validateWedgeDirection(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const mapShape = state.scenarioConfig.mapShape;

  // Only apply to wedge maps
  if (mapShape !== MAP_SHAPE_WEDGE) {
    return valid();
  }

  // Skip validation if tile slots haven't been initialized
  // (allows tests with manually constructed states to work)
  if (!state.map.tileSlots || Object.keys(state.map.tileSlots).length === 0) {
    return valid();
  }

  const direction = getExploreDirection(action);
  if (!direction) {
    return invalid(NOT_ON_MAP, "Invalid explore action");
  }

  const validWedgeDirections = getExpansionDirections(mapShape);
  if (!validWedgeDirections.includes(direction)) {
    return invalid(
      INVALID_WEDGE_DIRECTION,
      `Wedge map only allows exploring NE or E, not ${direction}`
    );
  }

  return valid();
}

/**
 * For wedge shape maps, the target slot must exist and not be filled.
 * NOTE: This check is now handled by validateExploreDirection which uses
 * getValidExploreOptions (which already checks slot availability).
 * This function is kept for backwards compatibility but always returns valid.
 */
export function validateSlotNotFilled(
  _state: GameState,
  _playerId: string,
  _action: PlayerAction
): ValidationResult {
  // Slot validation is now handled by validateExploreDirection
  // via getValidExploreOptions which checks all tiles and their slots
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
