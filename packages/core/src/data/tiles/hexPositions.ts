/**
 * Local hex position constants (relative to tile center)
 *
 * Each tile is a 7-hex symmetric "flower" cluster. Coordinates are relative to the tile center (0,0).
 * This symmetric shape allows tiles to connect with exactly 3 adjacent hex pairs along edges.
 *
 * Layout reference (pointy-top hex orientation):
 *
 *        NW(0,-1)  NE(1,-1)
 *     W(-1,0)  C(0,0)  E(1,0)
 *        SW(-1,1)  SE(0,1)
 *
 * Axial offsets from center:
 *   NW: (0, -1), NE: (1, -1)
 *   W: (-1, 0), E: (1, 0)
 *   SW: (-1, 1), SE: (0, 1)
 *
 * When tiles connect, they do NOT share hexes but have 3 adjacent hex pairs.
 * Tile placement offsets for 3-edge connections (from explore/index.ts):
 *   E: (3, -1), W: (-3, 1), NE: (2, -3), SW: (-2, 3), NW: (-1, -2), SE: (1, 2)
 */

/**
 * Local hex positions within a 7-hex tile "flower" pattern.
 * These are the only valid positions for hexes within a tile.
 */
export const LOCAL_HEX = {
  CENTER: { q: 0, r: 0 },
  NE: { q: 1, r: -1 },
  E: { q: 1, r: 0 },
  SE: { q: 0, r: 1 },
  SW: { q: -1, r: 1 },
  W: { q: -1, r: 0 },
  NW: { q: 0, r: -1 },
} as const;
