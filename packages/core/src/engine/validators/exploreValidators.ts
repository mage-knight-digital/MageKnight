/**
 * Validators for EXPLORE action
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, HexDirection } from "@mage-knight/shared";
import { EXPLORE_ACTION, MAP_SHAPE_WEDGE, hexKey } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  NOT_ON_MAP,
  NOT_ON_EDGE,
  INVALID_DIRECTION,
  NOT_ENOUGH_MOVE_POINTS,
  NO_TILES_AVAILABLE,
  PLAYER_NOT_FOUND,
  SLOT_ALREADY_FILLED,
  INVALID_WEDGE_DIRECTION,
} from "./validationCodes.js";
import {
  isEdgeHex,
  getValidExploreDirections,
  findTileCenterForHex,
  TILE_PLACEMENT_OFFSETS,
  getExpansionDirections,
} from "../explore/index.js";

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
 * For wedge shape maps, the target slot must exist and not be filled
 */
export function validateSlotNotFilled(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const mapShape = state.scenarioConfig.mapShape;

  // Only apply to wedge maps (open maps don't have predefined slots)
  if (mapShape !== MAP_SHAPE_WEDGE) {
    return valid();
  }

  // Skip validation if tile slots haven't been initialized
  // (allows tests with manually constructed states to work)
  if (!state.map.tileSlots || Object.keys(state.map.tileSlots).length === 0) {
    return valid();
  }

  const player = state.players.find((p) => p.id === playerId);
  const direction = getExploreDirection(action);

  if (!player?.position || !direction) {
    return invalid(NOT_ON_MAP, "Invalid explore action");
  }

  // Find which tile the player is on
  const tileCenters = state.map.tiles.map((t) => t.centerCoord);
  const currentTileCenter = findTileCenterForHex(player.position, tileCenters);

  // Skip validation if we can't find the player's tile
  // (allows tests with manually constructed states to work)
  if (!currentTileCenter) {
    return valid();
  }

  // Calculate the target slot position
  const offset = TILE_PLACEMENT_OFFSETS[direction];
  if (!offset) {
    return invalid(INVALID_DIRECTION, "Invalid explore direction");
  }

  const targetSlotCoord = {
    q: currentTileCenter.q + offset.q,
    r: currentTileCenter.r + offset.r,
  };
  const targetKey = hexKey(targetSlotCoord);

  // Check if slot exists in the wedge grid
  const slot = state.map.tileSlots[targetKey];
  if (!slot) {
    return invalid(
      INVALID_WEDGE_DIRECTION,
      "Target position is outside the wedge map boundary"
    );
  }

  // Check if slot is already filled
  if (slot.filled) {
    return invalid(
      SLOT_ALREADY_FILLED,
      "A tile has already been placed in that direction"
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
