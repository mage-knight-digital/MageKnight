/**
 * Adjacency validation for exploration.
 *
 * Per the rulebook: "You can only reveal new tiles if you occupy a space
 * adjacent to a position where a new tile can be added."
 *
 * This means the player must be on a hex that is directly adjacent (shares an edge)
 * with a hex that would be part of the new tile being placed.
 *
 * Each tile is a 7-hex flower pattern: center + 6 surrounding hexes.
 * When tiles connect, they share 3 adjacent hex pairs along their edges.
 */

import type { HexCoord, HexDirection } from "@mage-knight/shared";
import { getNeighbor, HEX_DIRECTIONS } from "@mage-knight/shared";
import { TILE_PLACEMENT_OFFSETS } from "./tileGrid.js";

/**
 * The 7 hex offsets that make up a tile (center + 6 neighbors).
 */
const TILE_HEX_OFFSETS: HexCoord[] = [
  { q: 0, r: 0 }, // Center
  { q: 1, r: -1 }, // NE
  { q: 1, r: 0 }, // E
  { q: 0, r: 1 }, // SE
  { q: -1, r: 1 }, // SW
  { q: -1, r: 0 }, // W
  { q: 0, r: -1 }, // NW
];

/**
 * Get all hexes that would be part of a tile placed at the given center.
 */
export function getTileHexes(tileCenter: HexCoord): HexCoord[] {
  return TILE_HEX_OFFSETS.map((offset) => ({
    q: tileCenter.q + offset.q,
    r: tileCenter.r + offset.r,
  }));
}

/**
 * Check if two hexes are adjacent (share an edge).
 */
export function areHexesAdjacent(a: HexCoord, b: HexCoord): boolean {
  for (const dir of HEX_DIRECTIONS) {
    const neighbor = getNeighbor(a, dir);
    if (neighbor.q === b.q && neighbor.r === b.r) {
      return true;
    }
  }
  return false;
}

/**
 * Calculate the distance between two hexes using axial coordinates.
 * Uses the cube distance formula for hex grids.
 */
function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = Math.abs(a.q - b.q);
  const dr = Math.abs(a.r - b.r);
  const ds = Math.abs(-a.q - a.r - (-b.q - b.r));
  return (dq + dr + ds) / 2;
}

/**
 * Check if two hexes are within the given distance of each other.
 */
export function areHexesWithinDistance(a: HexCoord, b: HexCoord, maxDistance: number): boolean {
  return hexDistance(a, b) <= maxDistance;
}

/**
 * Check if a player position can explore in a given direction from their current tile.
 *
 * The player must be on a hex that is directly adjacent to at least one hex
 * of the potential new tile.
 *
 * @param playerPos - The player's current hex position
 * @param currentTileCenter - The center of the tile the player is on
 * @param direction - The direction to explore (E, NE, etc.)
 * @param maxDistance - Maximum hex distance for explore eligibility (default 1 = adjacent)
 * @returns true if the player can explore in that direction from their position
 */
export function canExploreFromPosition(
  playerPos: HexCoord,
  currentTileCenter: HexCoord,
  direction: HexDirection,
  maxDistance: number = 1
): boolean {
  const offset = TILE_PLACEMENT_OFFSETS[direction];

  // Calculate where the new tile would be placed
  const newTileCenter: HexCoord = {
    q: currentTileCenter.q + offset.q,
    r: currentTileCenter.r + offset.r,
  };

  // Get all hexes that would be part of the new tile
  const newTileHexes = getTileHexes(newTileCenter);

  // Check if the player is within maxDistance of ANY of the new tile's hexes
  for (const newHex of newTileHexes) {
    if (maxDistance === 1) {
      if (areHexesAdjacent(playerPos, newHex)) {
        return true;
      }
    } else {
      if (areHexesWithinDistance(playerPos, newHex, maxDistance)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get valid explore directions for a player based on their exact position.
 *
 * This checks both:
 * 1. The tile has an unfilled adjacent slot in that direction
 * 2. The player is adjacent to where the new tile would be placed
 *
 * @param playerPos - The player's current hex position
 * @param currentTileCenter - The center of the tile the player is on
 * @param availableDirections - Directions that have unfilled slots (from getValidExploreDirectionsForShape)
 * @returns Directions the player can actually explore from their position
 */
export function getExploreDirectionsFromPosition(
  playerPos: HexCoord,
  currentTileCenter: HexCoord,
  availableDirections: HexDirection[]
): HexDirection[] {
  return availableDirections.filter((dir) =>
    canExploreFromPosition(playerPos, currentTileCenter, dir)
  );
}

/**
 * For a given direction, get the hexes on the CURRENT tile that are adjacent
 * to the new tile that would be placed in that direction.
 *
 * These are the "gateway hexes" from which a player can explore in that direction.
 */
export function getGatewayHexesForDirection(
  currentTileCenter: HexCoord,
  direction: HexDirection
): HexCoord[] {
  const offset = TILE_PLACEMENT_OFFSETS[direction];

  const newTileCenter: HexCoord = {
    q: currentTileCenter.q + offset.q,
    r: currentTileCenter.r + offset.r,
  };

  const currentTileHexes = getTileHexes(currentTileCenter);
  const newTileHexes = getTileHexes(newTileCenter);

  // Find all hexes on current tile that are adjacent to any hex on new tile
  const gatewayHexes: HexCoord[] = [];

  for (const currentHex of currentTileHexes) {
    for (const newHex of newTileHexes) {
      if (areHexesAdjacent(currentHex, newHex)) {
        // Check if we already added this hex
        const alreadyAdded = gatewayHexes.some(
          (h) => h.q === currentHex.q && h.r === currentHex.r
        );
        if (!alreadyAdded) {
          gatewayHexes.push(currentHex);
        }
        break; // Move to next currentHex
      }
    }
  }

  return gatewayHexes;
}
