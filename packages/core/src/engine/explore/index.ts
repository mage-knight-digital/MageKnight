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
  for (const dir of HEX_DIRECTIONS) {
    const adjacent = getNeighbor(coord, dir);
    const key = hexKey(adjacent);
    if (!state.map.hexes[key]) {
      return true; // At least one adjacent hex is unrevealed
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

/**
 * Calculate where to place a new tile when exploring in a direction.
 *
 * SIMPLE VERSION: Place tile center at a fixed offset (2 hexes in explore direction).
 * This is a simplification; real placement depends on tile geometry and the
 * specific hex being explored from within the current tile.
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
  // For now, simple offset - tile center goes 2 hexes in the explore direction
  // This places the new tile's edge hexes adjacent to the explored edge
  const adjacent = getNeighbor(fromHex, direction);
  return getNeighbor(adjacent, direction);
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
