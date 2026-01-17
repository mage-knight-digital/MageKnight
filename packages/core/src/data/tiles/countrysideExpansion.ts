/**
 * Lost Legion expansion countryside tile definitions (Countryside 12-14)
 *
 * Green back tiles from the Lost Legion expansion.
 * Data verified against tile images from the unofficial Mage Knight wiki.
 */

import {
  TERRAIN_DESERT,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
  TERRAIN_PLAINS,
  TERRAIN_WASTELAND,
} from "@mage-knight/shared";
import { TileId, SiteType, RampagingEnemyType } from "../../types/map.js";
import {
  MINE_COLOR_BLUE,
  MINE_COLOR_GREEN,
  MINE_COLOR_RED,
  MINE_COLOR_WHITE,
} from "../../types/mapConstants.js";
import { TILE_TYPE_COUNTRYSIDE } from "../tileConstants.js";
import { LOCAL_HEX } from "./hexPositions.js";
import { hex, type TileDefinition } from "./types.js";

/**
 * Lost Legion expansion countryside tile definitions (Countryside 12-14)
 */
export const COUNTRYSIDE_EXPANSION_TILES: Record<
  typeof TileId.Countryside12 | typeof TileId.Countryside13 | typeof TileId.Countryside14,
  TileDefinition
> = {
  // Countryside 12 - Monastery, Maze, Refugee Camp, Orc Marauders
  // Walls: CENTER walled to E, SW, W
  [TileId.Countryside12]: {
    id: TileId.Countryside12,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_PLAINS, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.NE, TERRAIN_WASTELAND),
      hex(LOCAL_HEX.E, TERRAIN_HILLS, SiteType.Monastery),
      hex(LOCAL_HEX.SE, TERRAIN_MOUNTAIN),
      hex(LOCAL_HEX.SW, TERRAIN_PLAINS, SiteType.Maze),
      hex(LOCAL_HEX.W, TERRAIN_HILLS, SiteType.RefugeeCamp),
      hex(LOCAL_HEX.NW, TERRAIN_MOUNTAIN),
    ],
  },

  // Countryside 13 - Mage Tower, Deep Mine (green/blue), Magical Glade, Orc Marauders
  // Walls: CENTER walled to NE; NE walled to E, SE; NW walled to E
  [TileId.Countryside13]: {
    id: TileId.Countryside13,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_FOREST, SiteType.MageTower),
      hex(LOCAL_HEX.NE, TERRAIN_HILLS, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.E, TERRAIN_LAKE),
      hex(LOCAL_HEX.SE, TERRAIN_FOREST, SiteType.DeepMine, { deepMineColors: [MINE_COLOR_GREEN, MINE_COLOR_BLUE] }),
      hex(LOCAL_HEX.SW, TERRAIN_PLAINS),
      hex(LOCAL_HEX.W, TERRAIN_WASTELAND, SiteType.MagicalGlade),
      hex(LOCAL_HEX.NW, TERRAIN_FOREST),
    ],
  },

  // Countryside 14 - Keep, Maze, Village, Deep Mine (red/white)
  // Walls: NE walled to SW
  [TileId.Countryside14]: {
    id: TileId.Countryside14,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_PLAINS),
      hex(LOCAL_HEX.NE, TERRAIN_PLAINS, SiteType.Keep),
      hex(LOCAL_HEX.E, TERRAIN_WASTELAND, SiteType.Maze),
      hex(LOCAL_HEX.SE, TERRAIN_HILLS, SiteType.Village),
      hex(LOCAL_HEX.SW, TERRAIN_PLAINS),
      hex(LOCAL_HEX.W, TERRAIN_DESERT, SiteType.DeepMine, { deepMineColors: [MINE_COLOR_RED, MINE_COLOR_WHITE] }),
      hex(LOCAL_HEX.NW, TERRAIN_DESERT),
    ],
  },
};
