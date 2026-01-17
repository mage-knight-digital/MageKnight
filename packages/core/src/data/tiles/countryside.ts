/**
 * Countryside tile definitions (Green back)
 *
 * Re-exports all countryside tiles from base game and expansion modules.
 */

import { TileId } from "../../types/map.js";
import type { TileDefinition } from "./types.js";
import { COUNTRYSIDE_BASE_TILES } from "./countrysideBase.js";
import { COUNTRYSIDE_EXPANSION_TILES } from "./countrysideExpansion.js";

// Re-export individual tile sets
export { COUNTRYSIDE_BASE_TILES } from "./countrysideBase.js";
export { COUNTRYSIDE_EXPANSION_TILES } from "./countrysideExpansion.js";

/**
 * All countryside tiles (base game + expansion)
 */
export const COUNTRYSIDE_TILES: Record<
  | typeof TileId.Countryside1
  | typeof TileId.Countryside2
  | typeof TileId.Countryside3
  | typeof TileId.Countryside4
  | typeof TileId.Countryside5
  | typeof TileId.Countryside6
  | typeof TileId.Countryside7
  | typeof TileId.Countryside8
  | typeof TileId.Countryside9
  | typeof TileId.Countryside10
  | typeof TileId.Countryside11
  | typeof TileId.Countryside12
  | typeof TileId.Countryside13
  | typeof TileId.Countryside14,
  TileDefinition
> = {
  ...COUNTRYSIDE_BASE_TILES,
  ...COUNTRYSIDE_EXPANSION_TILES,
};
