/**
 * Tile definitions for Mage Knight
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
 *
 * Data verified against tile images from the unofficial Mage Knight wiki.
 */

// Types and interfaces
export type { LocalHex, LocalHexPosition, TileType, TileDefinition } from "./types.js";
export { hex } from "./types.js";

// Hex position constants
export { LOCAL_HEX } from "./hexPositions.js";

// Tile definitions by category
export { STARTING_TILES } from "./starting.js";
export {
  COUNTRYSIDE_TILES,
  COUNTRYSIDE_BASE_TILES,
  COUNTRYSIDE_EXPANSION_TILES,
} from "./countryside.js";
export {
  CORE_TILES,
  CORE_NON_CITY_TILES,
  CORE_CITY_TILES,
  CORE_EXPANSION_TILES,
} from "./core.js";

// Aggregated tile definitions and helper functions
export {
  TILE_DEFINITIONS,
  placeTile,
  getTilesByType,
  getBaseGameTiles,
  getExpansionTiles,
} from "./helpers.js";
