/**
 * Core tile definitions (Brown back)
 *
 * Re-exports all core tiles from non-city, city, and expansion modules.
 */

import { TileId } from "../../types/map.js";
import type { TileDefinition } from "./types.js";
import { CORE_NON_CITY_TILES } from "./coreNonCity.js";
import { CORE_CITY_TILES } from "./coreCity.js";
import { CORE_EXPANSION_TILES } from "./coreExpansion.js";

// Re-export individual tile sets
export { CORE_NON_CITY_TILES } from "./coreNonCity.js";
export { CORE_CITY_TILES } from "./coreCity.js";
export { CORE_EXPANSION_TILES } from "./coreExpansion.js";

/**
 * All core tiles (base game + expansion)
 */
export const CORE_TILES: Record<
  | typeof TileId.Core1
  | typeof TileId.Core2
  | typeof TileId.Core3
  | typeof TileId.Core4
  | typeof TileId.Core5GreenCity
  | typeof TileId.Core6BlueCity
  | typeof TileId.Core7WhiteCity
  | typeof TileId.Core8RedCity
  | typeof TileId.Core9
  | typeof TileId.Core10
  | typeof TileId.CoreVolkare,
  TileDefinition
> = {
  ...CORE_NON_CITY_TILES,
  ...CORE_CITY_TILES,
  ...CORE_EXPANSION_TILES,
};
