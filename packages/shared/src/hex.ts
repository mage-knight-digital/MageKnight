/**
 * Hex coordinate types using axial coordinates (q, r)
 */

export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

export type HexDirection =
  | "NE" // q+1, r-1
  | "E" // q+1, r+0
  | "SE" // q+0, r+1
  | "SW" // q-1, r+1
  | "W" // q-1, r+0
  | "NW"; // q+0, r-1

export const HEX_DIRECTIONS: readonly HexDirection[] = [
  "NE",
  "E",
  "SE",
  "SW",
  "W",
  "NW",
] as const;

const DIRECTION_OFFSETS: Record<HexDirection, HexCoord> = {
  NE: { q: 1, r: -1 },
  E: { q: 1, r: 0 },
  SE: { q: 0, r: 1 },
  SW: { q: -1, r: 1 },
  W: { q: -1, r: 0 },
  NW: { q: 0, r: -1 },
};

export function hexKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

export function getNeighbor(coord: HexCoord, direction: HexDirection): HexCoord {
  const offset = DIRECTION_OFFSETS[direction];
  return {
    q: coord.q + offset.q,
    r: coord.r + offset.r,
  };
}

export function getAllNeighbors(coord: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((dir) => getNeighbor(coord, dir));
}

// ============================================================================
// Tile placement geometry
// ============================================================================

/**
 * Direction-specific offsets for tile placement.
 * These position tile centers so they connect with exactly 3 adjacent hex pairs.
 * Used for calculating where new tiles will be placed when exploring.
 */
export const TILE_PLACEMENT_OFFSETS: Record<HexDirection, HexCoord> = {
  E: { q: 3, r: -1 },
  NE: { q: 2, r: -3 },
  NW: { q: -1, r: -2 },
  W: { q: -3, r: 1 },
  SW: { q: -2, r: 3 },
  SE: { q: 1, r: 2 },
};

/**
 * Offsets for the 7 hexes that make up a tile (flower pattern).
 */
export const TILE_HEX_OFFSETS: readonly HexCoord[] = [
  { q: 0, r: 0 }, // center
  { q: 1, r: -1 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
];

/**
 * Find which tile a hex belongs to.
 * Returns the tile center coordinate, or null if hex is not on any tile.
 */
export function findTileCenterForHex(
  hexCoord: HexCoord,
  tileCenters: readonly HexCoord[]
): HexCoord | null {
  for (const center of tileCenters) {
    for (const offset of TILE_HEX_OFFSETS) {
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
 * Calculate where a new tile would be placed when exploring in a direction.
 * Takes the current tile center and returns the new tile's center position.
 */
export function calculateTilePlacementPosition(
  fromTileCenter: HexCoord,
  direction: HexDirection
): HexCoord {
  const offset = TILE_PLACEMENT_OFFSETS[direction];
  return {
    q: fromTileCenter.q + offset.q,
    r: fromTileCenter.r + offset.r,
  };
}
