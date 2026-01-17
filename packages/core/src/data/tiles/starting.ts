/**
 * Starting tile definitions (Portal tiles)
 *
 * These tiles serve as starting locations for players at the beginning of the game.
 * Data verified against tile images from the unofficial Mage Knight wiki.
 */

import {
  TERRAIN_FOREST,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
  TERRAIN_PLAINS,
} from "@mage-knight/shared";
import { TileId, SiteType } from "../../types/map.js";
import { TILE_TYPE_STARTING } from "../tileConstants.js";
import { LOCAL_HEX } from "./hexPositions.js";
import { hex, type TileDefinition } from "./types.js";

/**
 * Starting tile definitions
 * Portal A and Portal B - Coastal starting tiles
 */
export const STARTING_TILES: Record<
  typeof TileId.StartingTileA | typeof TileId.StartingTileB,
  TileDefinition
> = {
  // Portal A - Coastal starting tile
  [TileId.StartingTileA]: {
    id: TileId.StartingTileA,
    type: TILE_TYPE_STARTING,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_PLAINS, SiteType.Portal),
      hex(LOCAL_HEX.NW, TERRAIN_PLAINS),
      hex(LOCAL_HEX.NE, TERRAIN_FOREST),
      hex(LOCAL_HEX.W, TERRAIN_LAKE),
      hex(LOCAL_HEX.E, TERRAIN_PLAINS),
      hex(LOCAL_HEX.SW, TERRAIN_LAKE),
      hex(LOCAL_HEX.SE, TERRAIN_MOUNTAIN),
    ],
  },

  // Portal B - Alternate coastal starting tile
  [TileId.StartingTileB]: {
    id: TileId.StartingTileB,
    type: TILE_TYPE_STARTING,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.NE, TERRAIN_FOREST),
      hex(LOCAL_HEX.E, TERRAIN_PLAINS),
      hex(LOCAL_HEX.SE, TERRAIN_PLAINS),
      hex(LOCAL_HEX.SW, TERRAIN_MOUNTAIN),
      hex(LOCAL_HEX.W, TERRAIN_LAKE),
      hex(LOCAL_HEX.NW, TERRAIN_PLAINS),
      hex(LOCAL_HEX.CENTER, TERRAIN_PLAINS, SiteType.Portal),
    ],
  },
};
