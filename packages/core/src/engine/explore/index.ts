/**
 * Explore helpers for tile placement
 *
 * CURRENT IMPLEMENTATION (simple):
 * - Place tile at fixed offset based on explore direction
 * - Rotation 0 always
 * - Draw from a single tile pool
 * - No terrain matching validation
 *
 * FUTURE: Tile placement will need to handle:
 *
 * 1. Terrain matching - coastlines must connect
 *    - Each hex edge has a terrain type (land, water, coast)
 *    - Adjacent edges must be compatible
 *    - We'll need: getEdgeTerrains(tile, rotation) and validatePlacement(tile, position, rotation, existingMap)
 *
 * 2. Rotation selection
 *    - Tiles can be placed at 0, 60, 120, 180, 240, 300 degrees
 *    - We'll need: findValidRotations(tile, position, existingMap) returns Rotation[]
 *    - For now: always use rotation 0
 *
 * 3. Placement position
 *    - Based on which hex edge player is exploring from
 *    - Tile center goes in a specific spot relative to the explored edge
 *    - We'll need: calculateTilePlacement(fromHex, direction) returns HexCoord
 *    - For now: place at a fixed offset from explored hex
 *
 * 4. Wedge/corridor shape (scenario-dependent)
 *    - Some scenarios restrict which directions can be explored
 *    - We'll need: isValidExploreDirection(scenario, fromHex, direction)
 *    - For now: allow any direction
 *
 * 5. Tile deck management
 *    - Countryside tiles (green back) near start
 *    - Core tiles (brown back) further out
 *    - City tiles placed specifically
 *    - We'll need: getTileDeck(distanceFromStart) and drawTile(deck)
 *    - For now: use a simple tile queue or random selection
 */

import type { HexCoord, HexDirection } from "@mage-knight/shared";
import { hexKey, getNeighbor, HEX_DIRECTIONS } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";

/**
 * Check if a hex is on the edge of the revealed map
 * (has at least one unrevealed adjacent hex)
 */
export function isEdgeHex(state: GameState, coord: HexCoord): boolean {
  return isNearEdge(state, coord, 1);
}

/**
 * Check if a hex is within the given distance of the edge of the revealed map.
 * At distance 1, this is equivalent to isEdgeHex (adjacent to unrevealed hex).
 * At distance 2, the hex can be one hex further from the map edge.
 */
export function isNearEdge(state: GameState, coord: HexCoord, maxDistance: number): boolean {
  if (maxDistance <= 1) {
    // Optimized path for standard adjacency check
    for (const dir of HEX_DIRECTIONS) {
      const adjacent = getNeighbor(coord, dir);
      const key = hexKey(adjacent);
      if (!state.map.hexes[key]) {
        return true;
      }
    }
    return false;
  }

  // For extended distance, check all hexes within maxDistance
  // A hex is "near edge" if there exists an unrevealed hex within maxDistance
  for (let dq = -maxDistance; dq <= maxDistance; dq++) {
    for (let dr = Math.max(-maxDistance, -dq - maxDistance); dr <= Math.min(maxDistance, -dq + maxDistance); dr++) {
      if (dq === 0 && dr === 0) continue;
      const target: HexCoord = { q: coord.q + dq, r: coord.r + dr };
      const key = hexKey(target);
      if (!state.map.hexes[key]) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get valid explore directions from a hex
 * (directions with no revealed tile)
 */
export function getValidExploreDirections(
  state: GameState,
  coord: HexCoord
): HexDirection[] {
  return HEX_DIRECTIONS.filter((dir) => {
    const adjacent = getNeighbor(coord, dir);
    const key = hexKey(adjacent);
    return !state.map.hexes[key]; // Direction is valid if no hex exists there
  });
}

import { TILE_PLACEMENT_OFFSETS } from "./tileGrid.js";

/**
 * Calculate where to place a new tile when exploring in a direction.
 *
 * Each tile has a center hex plus 6 surrounding hexes (radius 1).
 * Tiles connect with 3 adjacent hex pairs along their edges, not by sharing hexes.
 * The offsets are direction-specific to achieve proper 3-edge connections.
 *
 * FUTURE: This will need to account for:
 * - Which hex on the current tile the player is on
 * - The shape of the new tile being placed
 * - Proper alignment so hexes connect correctly
 */
export function calculateTilePlacement(
  fromHex: HexCoord,
  direction: HexDirection
): HexCoord {
  const offset = TILE_PLACEMENT_OFFSETS[direction];
  if (!offset) {
    throw new Error(`Invalid direction: ${direction}`);
  }
  return {
    q: fromHex.q + offset.q,
    r: fromHex.r + offset.r,
  };
}

// FUTURE: Terrain matching validation
// export function findValidRotations(
//   tileId: TileId,
//   position: HexCoord,
//   existingMap: Record<string, HexState>
// ): number[] {
//   // Check each rotation (0, 60, 120, 180, 240, 300)
//   // For each, verify edge terrains match adjacent revealed hexes
//   // Return list of valid rotations
// }

// FUTURE: Determine tile deck based on distance
// export function getTileDeckType(position: HexCoord): "countryside" | "core" {
//   // Calculate distance from origin
//   // Return appropriate deck type
// }

// Re-export tile grid system
export {
  TILE_PLACEMENT_OFFSETS,
  getDirectionFromOffset,
  getExpansionDirections,
  generateWedgeSlots,
  generateTileSlots,
  isSlotAdjacentToFilled,
  getValidExploreDirectionsForShape,
  findTileCenterForHex,
  getExplorableSlotsFromTile,
} from "./tileGrid.js";

// Re-export adjacency helpers
export {
  canExploreFromPosition,
  getExploreDirectionsFromPosition,
  getGatewayHexesForDirection,
  getTileHexes,
  areHexesAdjacent,
  areHexesWithinDistance,
} from "./adjacency.js";
