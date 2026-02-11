/**
 * Validators for EXPLORE action
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, HexDirection } from "@mage-knight/shared";
import { EXPLORE_ACTION, MAP_SHAPE_WEDGE, MAP_SHAPE_OPEN_3, MAP_SHAPE_OPEN_4, MAP_SHAPE_OPEN_5, hexKey } from "@mage-knight/shared";
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
  CORE_TILE_ON_COASTLINE,
  COLUMN_LIMIT_EXCEEDED,
} from "./validationCodes.js";
import {
  getExpansionDirections,
  TILE_PLACEMENT_OFFSETS,
} from "../explore/index.js";
import { isCoastlineSlot, getColumnRangeForShape } from "../explore/tileGrid.js";
import { getValidExploreOptions } from "../validActions/exploration.js";
import { peekNextTileType } from "../../data/tileDeckSetup.js";
import { TILE_TYPE_CORE } from "../../data/tileConstants.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { getEffectiveExploreCost } from "../modifiers/index.js";
import { isPlayerNearExploreEdge } from "../rules/exploration.js";

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
  const player = getPlayerById(state, playerId);
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
  const player = getPlayerById(state, playerId);
  if (!player?.position) {
    return invalid(NOT_ON_MAP, "Player is not on the map");
  }

  if (!isPlayerNearExploreEdge(state, player)) {
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
  const player = getPlayerById(state, playerId);
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
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const cost = getEffectiveExploreCost(state, playerId);

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

/**
 * For wedge maps, core tiles cannot be placed on coastline slots.
 *
 * Per rulebook: "Core (brown) tiles cannot be added to the coastline.
 * (i.e. to the leftmost and rightmost lane of tiles)."
 *
 * This validator:
 * 1. Only applies to wedge maps with initialized tile slots
 * 2. Checks if the next tile to be drawn is a core tile
 * 3. Checks if the target slot is a coastline slot
 * 4. Rejects the placement if both conditions are true
 */
export function validateCoreNotOnCoastline(
  state: GameState,
  _playerId: string,
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

  // Check the next tile type - if not core, no restriction applies
  const nextTileType = peekNextTileType(state.map.tileDeck);
  if (nextTileType !== TILE_TYPE_CORE) {
    return valid();
  }

  // Extract direction and fromTileCoord from action
  const direction = getExploreDirection(action);
  if (!direction) {
    return invalid(NOT_ON_MAP, "Invalid explore action");
  }

  // Get the source tile coordinate from action
  // The action should have fromTileCoord to specify which tile we're exploring from
  let fromTileCoord: { q: number; r: number } | undefined;
  if (action.type === EXPLORE_ACTION && "fromTileCoord" in action) {
    fromTileCoord = action.fromTileCoord as { q: number; r: number };
  }

  // If no fromTileCoord, try to compute target from tiles in state
  // This handles cases where action doesn't include fromTileCoord
  if (!fromTileCoord) {
    // Use the first tile as default (simplified - usually starting tile)
    if (state.map.tiles.length > 0 && state.map.tiles[0]) {
      fromTileCoord = state.map.tiles[0].centerCoord;
    } else {
      // No tiles placed yet, can't determine target
      return valid();
    }
  }

  // Calculate target slot coordinates
  const offset = TILE_PLACEMENT_OFFSETS[direction];
  const targetCoord = {
    q: fromTileCoord.q + offset.q,
    r: fromTileCoord.r + offset.r,
  };

  // Check if target is a coastline slot
  if (isCoastlineSlot(targetCoord, state.map.tileSlots)) {
    return invalid(
      CORE_TILE_ON_COASTLINE,
      "Core tiles cannot be placed on coastline (leftmost/rightmost slots)"
    );
  }

  return valid();
}

/**
 * For Open maps with column limits (Open 3, 4, 5), validate that the
 * target slot is within the allowed column range.
 *
 * Column ranges:
 * - Open 3: columns -1 to +1 (symmetric)
 * - Open 4: columns -1 to +2 (asymmetric, leans right)
 * - Open 5: columns -2 to +2 (symmetric)
 */
export function validateColumnLimit(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const mapShape = state.scenarioConfig.mapShape;

  // Only apply to Open 3, 4, 5 maps
  if (
    mapShape !== MAP_SHAPE_OPEN_3 &&
    mapShape !== MAP_SHAPE_OPEN_4 &&
    mapShape !== MAP_SHAPE_OPEN_5
  ) {
    return valid();
  }

  // Skip if tile slots haven't been initialized
  if (!state.map.tileSlots || Object.keys(state.map.tileSlots).length === 0) {
    return valid();
  }

  const direction = getExploreDirection(action);
  if (!direction) {
    return invalid(NOT_ON_MAP, "Invalid explore action");
  }

  // Get the source tile coordinate from action
  let fromTileCoord: { q: number; r: number } | undefined;
  if (action.type === EXPLORE_ACTION && "fromTileCoord" in action) {
    fromTileCoord = action.fromTileCoord as { q: number; r: number };
  }

  if (!fromTileCoord) {
    // Use the first tile as default
    if (state.map.tiles.length > 0 && state.map.tiles[0]) {
      fromTileCoord = state.map.tiles[0].centerCoord;
    } else {
      return valid();
    }
  }

  // Calculate target slot coordinates
  const offset = TILE_PLACEMENT_OFFSETS[direction];
  const targetCoord = {
    q: fromTileCoord.q + offset.q,
    r: fromTileCoord.r + offset.r,
  };

  // Get the target slot to check its column
  const targetKey = hexKey(targetCoord);
  const targetSlot = state.map.tileSlots[targetKey];

  if (!targetSlot) {
    // Slot doesn't exist in the pre-generated grid, which means
    // it's outside the valid area for this map shape
    const columnRange = getColumnRangeForShape(mapShape);
    if (columnRange) {
      return invalid(
        COLUMN_LIMIT_EXCEEDED,
        `Cannot explore beyond column limit (${columnRange.minColumn} to ${columnRange.maxColumn})`
      );
    }
    return valid();
  }

  // Check if the slot's column is within the allowed range
  const columnRange = getColumnRangeForShape(mapShape);
  if (columnRange) {
    if (
      targetSlot.column < columnRange.minColumn ||
      targetSlot.column > columnRange.maxColumn
    ) {
      return invalid(
        COLUMN_LIMIT_EXCEEDED,
        `Cannot explore beyond column limit (${columnRange.minColumn} to ${columnRange.maxColumn})`
      );
    }
  }

  return valid();
}
