/**
 * Tile Grid System for Mage Knight
 *
 * Defines valid tile slot positions based on map shape (wedge, open, etc.).
 * Tiles connect with 3 adjacent hex edges using direction-specific offsets.
 *
 * For WEDGE shape (First Reconnaissance):
 * - Tiles expand via NE and E directions only
 * - Row 0: 1 slot (starting tile)
 * - Row 1: 2 slots
 * - Row 2: 3 slots
 * - Row N: N+1 slots
 *
 * The wedge forms a triangular corridor expanding "northward" (NE/E).
 */

import type { HexCoord, MapShape, HexDirection } from "@mage-knight/shared";
import { MAP_SHAPE_WEDGE, MAP_SHAPE_OPEN, hexKey, TILE_PLACEMENT_OFFSETS, HEX_DIRECTIONS } from "@mage-knight/shared";
import type { TileSlot } from "../../types/map.js";

// Re-export TILE_PLACEMENT_OFFSETS from shared for backwards compatibility
export { TILE_PLACEMENT_OFFSETS };

/**
 * Reverse mapping: given a tile position offset, what direction was it?
 */
export function getDirectionFromOffset(
  from: HexCoord,
  to: HexCoord
): HexDirection | null {
  const dq = to.q - from.q;
  const dr = to.r - from.r;

  for (const dir of HEX_DIRECTIONS) {
    const offset = TILE_PLACEMENT_OFFSETS[dir];
    if (offset.q === dq && offset.r === dr) {
      return dir;
    }
  }
  return null;
}

/**
 * Get the directions that expand the map for a given map shape.
 */
export function getExpansionDirections(mapShape: MapShape): HexDirection[] {
  switch (mapShape) {
    case MAP_SHAPE_WEDGE:
      // Wedge expands via NE and E only (rightward triangle)
      return ["NE", "E"];
    case MAP_SHAPE_OPEN:
      // Open map allows all directions
      return ["NE", "E", "SE", "SW", "W", "NW"];
    default:
      return ["NE", "E", "SE", "SW", "W", "NW"];
  }
}

/**
 * Generate all valid tile slots for a wedge-shaped map up to a given number of rows.
 *
 * The wedge starts at (0,0) and expands via NE and E directions.
 * Each row has (row + 1) slots.
 */
export function generateWedgeSlots(maxRows: number): Map<string, TileSlot> {
  const slots = new Map<string, TileSlot>();

  // Row 0: Starting tile at origin
  slots.set(hexKey({ q: 0, r: 0 }), {
    coord: { q: 0, r: 0 },
    row: 0,
    filled: false,
  });

  const expandDirs: HexDirection[] = ["NE", "E"];

  // Generate slots for each row
  for (let row = 0; row < maxRows; row++) {
    const currentRowSlots = [...slots.values()].filter((s) => s.row === row);

    for (const slot of currentRowSlots) {
      for (const dir of expandDirs) {
        const offset = TILE_PLACEMENT_OFFSETS[dir];

        const newCoord: HexCoord = {
          q: slot.coord.q + offset.q,
          r: slot.coord.r + offset.r,
        };
        const key = hexKey(newCoord);

        if (!slots.has(key)) {
          slots.set(key, {
            coord: newCoord,
            row: row + 1,
            filled: false,
          });
        }
      }
    }
  }

  return slots;
}

/**
 * Generate tile slots based on map shape and scenario configuration.
 *
 * @param mapShape - The map shape from scenario config
 * @param totalTiles - Total number of tiles in the scenario (determines max rows)
 */
export function generateTileSlots(
  mapShape: MapShape,
  totalTiles: number
): Map<string, TileSlot> {
  switch (mapShape) {
    case MAP_SHAPE_WEDGE: {
      // Calculate max rows needed for the total number of tiles
      // Wedge has 1 + 2 + 3 + ... + n = n(n+1)/2 slots
      // We need enough rows so sum >= totalTiles
      let maxRows = 0;
      let totalSlots = 0;
      while (totalSlots < totalTiles) {
        maxRows++;
        totalSlots += maxRows;
      }
      return generateWedgeSlots(maxRows);
    }
    case MAP_SHAPE_OPEN:
      // Open map: no predefined slots, tiles can go anywhere adjacent
      // Return empty map - validation will check adjacency dynamically
      return new Map();
    default:
      return new Map();
  }
}

/**
 * Check if a tile slot is adjacent to any filled slot.
 * A slot is adjacent if there's a tile placement direction between them.
 */
export function isSlotAdjacentToFilled(
  targetCoord: HexCoord,
  filledSlots: Set<string>
): boolean {
  // Check all 6 directions
  for (const offset of Object.values(TILE_PLACEMENT_OFFSETS)) {
    const adjacentCoord: HexCoord = {
      q: targetCoord.q - offset.q,
      r: targetCoord.r - offset.r,
    };
    if (filledSlots.has(hexKey(adjacentCoord))) {
      return true;
    }
  }
  return false;
}

/**
 * Get valid explore directions from a hex position given the map shape.
 *
 * For wedge shape: only allow NE and E directions that lead to unfilled slots.
 * For open shape: allow any direction to unrevealed area.
 */
export function getValidExploreDirectionsForShape(
  fromTileCenter: HexCoord,
  mapShape: MapShape,
  slots: Map<string, TileSlot>
): HexDirection[] {
  const expansionDirs = getExpansionDirections(mapShape);
  const validDirs: HexDirection[] = [];

  for (const dir of expansionDirs) {
    const offset = TILE_PLACEMENT_OFFSETS[dir];

    const targetCoord: HexCoord = {
      q: fromTileCenter.q + offset.q,
      r: fromTileCenter.r + offset.r,
    };
    const key = hexKey(targetCoord);

    if (mapShape === MAP_SHAPE_WEDGE) {
      // For wedge: slot must exist and be unfilled
      const slot = slots.get(key);
      if (slot && !slot.filled) {
        validDirs.push(dir);
      }
    } else {
      // For open: any adjacent empty position is valid
      // (We'd need to check if there's already a tile there)
      validDirs.push(dir);
    }
  }

  return validDirs;
}

/**
 * Find which tile a hex belongs to.
 * Returns the tile center coordinate, or null if hex is not on any tile.
 */
export function findTileCenterForHex(
  hexCoord: HexCoord,
  tileCenters: HexCoord[]
): HexCoord | null {
  // Tile hexes are at center + offsets: (0,0), (1,-1), (1,0), (0,1), (-1,1), (-1,0), (0,-1)
  const tileHexOffsets = [
    { q: 0, r: 0 },
    { q: 1, r: -1 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: -1, r: 1 },
    { q: -1, r: 0 },
    { q: 0, r: -1 },
  ];

  for (const center of tileCenters) {
    for (const offset of tileHexOffsets) {
      if (
        hexCoord.q === center.q + offset.q &&
        hexCoord.r === center.r + offset.r
      ) {
        return center;
      }
    }
  }

  return null;
}

/**
 * Get the adjacent empty slots that can be explored from a tile.
 */
export function getExplorableSlotsFromTile(
  tileCenter: HexCoord,
  mapShape: MapShape,
  slots: Map<string, TileSlot>
): TileSlot[] {
  const validDirs = getValidExploreDirectionsForShape(
    tileCenter,
    mapShape,
    slots
  );
  const explorableSlots: TileSlot[] = [];

  for (const dir of validDirs) {
    const offset = TILE_PLACEMENT_OFFSETS[dir];

    const targetCoord: HexCoord = {
      q: tileCenter.q + offset.q,
      r: tileCenter.r + offset.r,
    };
    const key = hexKey(targetCoord);
    const slot = slots.get(key);

    if (slot && !slot.filled) {
      explorableSlots.push(slot);
    }
  }

  return explorableSlots;
}

/**
 * Check if a tile slot is a coastline slot in a wedge map.
 *
 * Coastline slots are the leftmost and rightmost positions in each row.
 * In wedge maps, core (brown) tiles cannot be placed on coastline slots.
 *
 * Row 0 (single slot at origin): Not considered coastline (no restriction applies)
 * Row N (N >= 1): First and last slots (by q coordinate) are coastline
 *
 * @param targetCoord - Coordinates of the slot to check
 * @param allSlots - Record or Map of all tile slots in the wedge (keyed by hexKey)
 * @returns true if slot is on the coastline (left or right edge of its row)
 */
export function isCoastlineSlot(
  targetCoord: HexCoord,
  allSlots: Record<string, TileSlot> | Map<string, TileSlot>
): boolean {
  const targetKey = hexKey(targetCoord);

  // Convert to iterable values based on input type
  const slotsIterable =
    allSlots instanceof Map ? allSlots.values() : Object.values(allSlots);

  // Find the target slot to get its row
  let targetSlot: TileSlot | undefined;
  const slotsArray: TileSlot[] = [];

  for (const slot of slotsIterable) {
    slotsArray.push(slot);
    if (hexKey(slot.coord) === targetKey) {
      targetSlot = slot;
    }
  }

  if (!targetSlot) {
    return false; // Slot not found, fail-safe
  }

  // Row 0 has no coastline concept (single starting slot)
  if (targetSlot.row === 0) {
    return false;
  }

  // Get all slots in the same row
  const rowSlots = slotsArray.filter((s) => s.row === targetSlot.row);

  if (rowSlots.length <= 1) {
    return false; // Single slot in row, not coastline
  }

  // Find min and max q coordinates in this row
  const qValues = rowSlots.map((s) => s.coord.q);
  const minQ = Math.min(...qValues);
  const maxQ = Math.max(...qValues);

  // Slot is coastline if it's at min or max q
  return targetCoord.q === minQ || targetCoord.q === maxQ;
}
