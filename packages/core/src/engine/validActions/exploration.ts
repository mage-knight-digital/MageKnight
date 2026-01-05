/**
 * Exploration action options.
 *
 * Computes valid directions a player can explore, respecting map shape constraints.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { ExploreOptions, ExploreDirection } from "@mage-knight/shared";
import type { HexDirection } from "@mage-knight/shared";
import { MAP_SHAPE_WEDGE, hexKey } from "@mage-knight/shared";
import {
  isEdgeHex,
  getValidExploreDirections as getUnrevealedDirections,
  findTileCenterForHex,
  TILE_PLACEMENT_OFFSETS,
  getExpansionDirections,
} from "../explore/index.js";

/** Exploration costs 2 move points from a safe space */
const EXPLORE_COST = 2;

/**
 * Get valid explore directions for a player.
 *
 * Returns directions the player can explore, with slot indices for wedge maps.
 * Checks:
 * - Player is on the map
 * - Player is on an edge hex (has unrevealed neighbors)
 * - Player has enough move points (2)
 * - Tiles are available to draw
 * - For wedge maps: direction leads to valid unfilled slot
 */
export function getValidExploreOptions(
  state: GameState,
  player: Player
): ExploreOptions | undefined {
  // Must be on the map
  if (!player.position) {
    return undefined;
  }

  // Can't explore after taking an action
  if (player.hasTakenActionThisTurn) {
    return undefined;
  }

  // Must have enough move points
  if (player.movePoints < EXPLORE_COST) {
    return undefined;
  }

  // Must have tiles available
  if (
    state.map.tileDeck.countryside.length === 0 &&
    state.map.tileDeck.core.length === 0
  ) {
    return undefined;
  }

  // Must be on an edge hex
  if (!isEdgeHex(state, player.position)) {
    return undefined;
  }

  const mapShape = state.scenarioConfig.mapShape;

  // Get directions that lead to unrevealed hexes
  const unrevealedDirections = getUnrevealedDirections(state, player.position);

  if (unrevealedDirections.length === 0) {
    return undefined;
  }

  // For wedge maps, apply additional constraints
  if (mapShape === MAP_SHAPE_WEDGE) {
    return getWedgeExploreOptions(state, player, unrevealedDirections);
  }

  // For open maps, all unrevealed directions are valid
  const directions: ExploreDirection[] = unrevealedDirections.map((dir) => ({
    direction: dir,
  }));

  if (directions.length === 0) {
    return undefined;
  }

  return { directions };
}

/**
 * Get explore options for wedge-shaped maps.
 *
 * Wedge maps only allow NE and E directions, and only to unfilled slots.
 */
function getWedgeExploreOptions(
  state: GameState,
  player: Player,
  unrevealedDirections: HexDirection[]
): ExploreOptions | undefined {
  // Must have position (caller should have checked, but be defensive)
  if (!player.position) {
    return undefined;
  }

  // Skip if tile slots aren't initialized (test state)
  if (!state.map.tileSlots || Object.keys(state.map.tileSlots).length === 0) {
    // Fall back to unrevealed directions filtered by wedge expansion
    const wedgeDirections = getExpansionDirections(MAP_SHAPE_WEDGE);
    const validDirs = unrevealedDirections.filter((dir) =>
      wedgeDirections.includes(dir)
    );

    if (validDirs.length === 0) {
      return undefined;
    }

    return {
      directions: validDirs.map((dir) => ({ direction: dir })),
    };
  }

  // Find which tile the player is on
  const tileCenters = state.map.tiles.map((t) => t.centerCoord);
  const currentTileCenter = findTileCenterForHex(player.position, tileCenters);

  if (!currentTileCenter) {
    return undefined;
  }

  // Get valid wedge directions (NE, E)
  const wedgeDirections = getExpansionDirections(MAP_SHAPE_WEDGE);

  // Filter to directions that:
  // 1. Lead to unrevealed area
  // 2. Are valid wedge directions
  // 3. Lead to an unfilled slot
  const directions: ExploreDirection[] = [];

  for (const dir of unrevealedDirections) {
    // Must be a wedge expansion direction
    if (!wedgeDirections.includes(dir)) continue;

    // Calculate target slot position
    const offset = TILE_PLACEMENT_OFFSETS[dir];
    if (!offset) continue;

    const targetSlotCoord = {
      q: currentTileCenter.q + offset.q,
      r: currentTileCenter.r + offset.r,
    };
    const targetKey = hexKey(targetSlotCoord);

    // Check if slot exists and is unfilled
    const slot = state.map.tileSlots[targetKey];
    if (!slot) continue;
    if (slot.filled) continue;

    directions.push({
      direction: dir as HexDirection,
      slotIndex: slot.row, // Use row as slot index for ordering
    });
  }

  if (directions.length === 0) {
    return undefined;
  }

  return { directions };
}
