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
import { MAP_SHAPE_WEDGE, MAP_SHAPE_OPEN, MAP_SHAPE_OPEN_3, MAP_SHAPE_OPEN_4, MAP_SHAPE_OPEN_5, MAP_SHAPE_CONFIGS, hexKey, TILE_PLACEMENT_OFFSETS, HEX_DIRECTIONS } from "@mage-knight/shared";
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
  const config = MAP_SHAPE_CONFIGS[mapShape];
  return [...config.expansionDirections];
}

/**
 * Generate all valid tile slots for a wedge-shaped map up to a given number of rows.
 *
 * The wedge starts at (0,0) and expands via NE and E directions.
 * Each row has (row + 1) slots.
 *
 * Column assignment for wedge:
 * - Row 0: column 0 (center)
 * - Row N: columns range from 0 to N (leftmost NE path = 0, rightmost E path = N)
 */
export function generateWedgeSlots(maxRows: number): Map<string, TileSlot> {
  const slots = new Map<string, TileSlot>();

  // Row 0: Starting tile at origin, column 0
  slots.set(hexKey({ q: 0, r: 0 }), {
    coord: { q: 0, r: 0 },
    row: 0,
    column: 0,
    filled: false,
  });

  // Track column index for each slot to propagate to children
  const slotColumns = new Map<string, number>();
  slotColumns.set(hexKey({ q: 0, r: 0 }), 0);

  // Generate slots for each row
  for (let row = 0; row < maxRows; row++) {
    const currentRowSlots = [...slots.values()].filter((s) => s.row === row);

    for (const slot of currentRowSlots) {
      const parentColumn = slotColumns.get(hexKey(slot.coord)) ?? 0;

      // NE direction: keeps same column index
      const neOffset = TILE_PLACEMENT_OFFSETS["NE"];
      const neCoord: HexCoord = {
        q: slot.coord.q + neOffset.q,
        r: slot.coord.r + neOffset.r,
      };
      const neKey = hexKey(neCoord);
      if (!slots.has(neKey)) {
        slots.set(neKey, {
          coord: neCoord,
          row: row + 1,
          column: parentColumn,
          filled: false,
        });
        slotColumns.set(neKey, parentColumn);
      }

      // E direction: increments column index
      const eOffset = TILE_PLACEMENT_OFFSETS["E"];
      const eCoord: HexCoord = {
        q: slot.coord.q + eOffset.q,
        r: slot.coord.r + eOffset.r,
      };
      const eKey = hexKey(eCoord);
      if (!slots.has(eKey)) {
        slots.set(eKey, {
          coord: eCoord,
          row: row + 1,
          column: parentColumn + 1,
          filled: false,
        });
        slotColumns.set(eKey, parentColumn + 1);
      }
    }
  }

  return slots;
}

/**
 * Get the maximum columns for an open map shape.
 */
export function getMaxColumnsForShape(
  mapShape: MapShape
): { maxColumns: number; asymmetric: boolean } {
  switch (mapShape) {
    case MAP_SHAPE_OPEN_3:
      return { maxColumns: 3, asymmetric: false };
    case MAP_SHAPE_OPEN_4:
      return { maxColumns: 4, asymmetric: true }; // Asymmetric: leans right
    case MAP_SHAPE_OPEN_5:
      return { maxColumns: 5, asymmetric: false };
    default:
      return { maxColumns: 0, asymmetric: false }; // No column limits for wedge/open
  }
}

/**
 * Get the column range for an open map shape.
 *
 * Open maps have column limits that form a diamond/kite pattern:
 * - Open 3: columns -1, 0, +1 (symmetric)
 * - Open 4: columns -1, 0, +1, +2 (asymmetric, leans right)
 * - Open 5: columns -2, -1, 0, +1, +2 (symmetric)
 */
export function getColumnRangeForShape(
  mapShape: MapShape
): { minColumn: number; maxColumn: number } | null {
  switch (mapShape) {
    case MAP_SHAPE_OPEN_3:
      return { minColumn: -1, maxColumn: 1 };
    case MAP_SHAPE_OPEN_4:
      return { minColumn: -1, maxColumn: 2 }; // Asymmetric right
    case MAP_SHAPE_OPEN_5:
      return { minColumn: -2, maxColumn: 2 };
    default:
      return null; // No column limits
  }
}

/**
 * Check if a column is valid for the given map shape.
 */
export function isColumnValid(column: number, mapShape: MapShape): boolean {
  const range = getColumnRangeForShape(mapShape);
  if (!range) {
    return true; // No column limits for this shape
  }
  return column >= range.minColumn && column <= range.maxColumn;
}

/**
 * Generate tile slots for an open map shape.
 *
 * Open maps form a diamond/kite pattern:
 * - Start at origin (row 0, column 0) with Starting Tile B
 * - Initial tiles placed in 3 directions: NE, E, SE (row 1)
 * - Expansion in all 6 directions is allowed, but constrained by column limits
 * - Column is determined by the net lateral movement from center
 *
 * The column value represents lateral position:
 * - NE direction: column stays same
 * - E direction: column +1
 * - SE direction: column +1
 * - SW direction: column -1
 * - W direction: column -1
 * - NW direction: column stays same
 *
 * Coastline break: The edges taper based on row. At higher rows,
 * the column limits narrow to form the diamond/kite shape.
 *
 * @param totalTiles - Total number of tiles in the scenario
 * @param maxColumns - Maximum columns (3, 4, or 5)
 * @param asymmetric - If true, columns are asymmetric (leans right for Open 4)
 */
export function generateOpenSlots(
  totalTiles: number,
  maxColumns: number,
  asymmetric: boolean = false
): Map<string, TileSlot> {
  const slots = new Map<string, TileSlot>();

  // For now, we don't pre-generate all slots for open maps.
  // Instead, slots are created dynamically as tiles are explored.
  // Column limits are enforced by validators.
  // This matches the existing pattern where MAP_SHAPE_OPEN returns empty slots.

  // However, we do create the starting slot at origin
  slots.set(hexKey({ q: 0, r: 0 }), {
    coord: { q: 0, r: 0 },
    row: 0,
    column: 0,
    filled: false,
  });

  // For open maps with column limits (OPEN_3, OPEN_4, OPEN_5),
  // we'll pre-generate the diamond pattern to know valid slots.

  if (maxColumns === 0) {
    // Generic OPEN shape - no predefined slots
    return slots;
  }

  // Determine column range based on maxColumns and asymmetry
  let minColumn: number;
  let maxColumn: number;

  if (asymmetric) {
    // Open 4: -1 to +2 (4 columns, leaning right)
    minColumn = -1;
    maxColumn = maxColumns - 2; // For 4 columns: maxColumn = 2
  } else {
    // Symmetric: centered around 0
    const halfWidth = Math.floor(maxColumns / 2);
    minColumn = -halfWidth;
    maxColumn = halfWidth;
  }

  // Track slots by coordinate with their column values
  const slotColumns = new Map<string, number>();
  slotColumns.set(hexKey({ q: 0, r: 0 }), 0);

  // Calculate how many "rows" of expansion we need
  // For open maps, rows expand in multiple directions
  // We need enough rows to cover totalTiles
  const maxRows = Math.ceil(Math.sqrt(totalTiles * 2));

  // Column delta based on direction:
  // For a kite/diamond shape, we want:
  // - E and SE move you right (column +1)
  // - W and NW move you left (column -1)
  // - NE and SW keep you in same column (moving "up" or "down" the kite)

  // Generate slots using BFS expansion from origin
  const queue: Array<{ coord: HexCoord; row: number; column: number }> = [];
  queue.push({ coord: { q: 0, r: 0 }, row: 0, column: 0 });

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const currentKey = hexKey(current.coord);

    // Skip if already processed
    if (slots.has(currentKey) && currentKey !== hexKey({ q: 0, r: 0 })) {
      continue;
    }

    // Expand in all 6 directions
    for (const dir of HEX_DIRECTIONS) {
      const offset = TILE_PLACEMENT_OFFSETS[dir];
      const newCoord: HexCoord = {
        q: current.coord.q + offset.q,
        r: current.coord.r + offset.r,
      };
      const newKey = hexKey(newCoord);

      // Skip if already generated
      if (slots.has(newKey)) continue;

      // Calculate new column based on direction
      let columnDelta: number;
      switch (dir) {
        case "E":
        case "SE":
          columnDelta = 1;
          break;
        case "W":
        case "NW":
          columnDelta = -1;
          break;
        case "NE":
        case "SW":
        default:
          columnDelta = 0;
          break;
      }

      const newColumn = current.column + columnDelta;
      const newRow = current.row + 1;

      // Check column limits
      if (newColumn < minColumn || newColumn > maxColumn) {
        continue; // Outside column bounds
      }

      // Check row limit
      if (newRow > maxRows) {
        continue;
      }

      // Apply coastline break: taper the columns at higher rows
      // Diamond shape: at row r, the valid column range shrinks
      // For a symmetric diamond with maxColumns = 5:
      // - Row 0: only column 0
      // - Row 1: columns -1, 0, 1
      // - Row 2: columns -2, -1, 0, 1, 2 (max width)
      // - Row 3+: width stays at max, then tapers back
      // But this depends on the specific shape definition.
      // For now, let's use a simpler model: columns are valid if within range.

      // Add the slot
      slots.set(newKey, {
        coord: newCoord,
        row: newRow,
        column: newColumn,
        filled: false,
      });
      slotColumns.set(newKey, newColumn);

      // Add to queue for further expansion
      queue.push({ coord: newCoord, row: newRow, column: newColumn });
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
    case MAP_SHAPE_OPEN_3:
      return generateOpenSlots(totalTiles, 3, false);
    case MAP_SHAPE_OPEN_4:
      return generateOpenSlots(totalTiles, 4, true); // Asymmetric
    case MAP_SHAPE_OPEN_5:
      return generateOpenSlots(totalTiles, 5, false);
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
