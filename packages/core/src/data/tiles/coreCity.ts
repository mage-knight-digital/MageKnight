/**
 * Base game city core tile definitions (Core 5-8)
 *
 * Brown back city tiles from the base game.
 * Data verified against tile images from the unofficial Mage Knight wiki.
 */

import {
  TERRAIN_DESERT,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
  TERRAIN_PLAINS,
  TERRAIN_SWAMP,
  TERRAIN_WASTELAND,
} from "@mage-knight/shared";
import { TileId, SiteType, RampagingEnemyType } from "../../types/map.js";
import {
  CITY_COLOR_BLUE,
  CITY_COLOR_GREEN,
  CITY_COLOR_RED,
  CITY_COLOR_WHITE,
  MINE_COLOR_RED,
} from "../../types/mapConstants.js";
import { TILE_TYPE_CORE } from "../tileConstants.js";
import { LOCAL_HEX } from "./hexPositions.js";
import { hex, type TileDefinition } from "./types.js";

/**
 * Base game city core tiles (Core 5-8)
 */
export const CORE_CITY_TILES: Record<
  | typeof TileId.Core5GreenCity
  | typeof TileId.Core6BlueCity
  | typeof TileId.Core7WhiteCity
  | typeof TileId.Core8RedCity,
  TileDefinition
> = {
  // Core 5 - Green City
  [TileId.Core5GreenCity]: {
    id: TileId.Core5GreenCity,
    type: TILE_TYPE_CORE,
    hasCity: true,
    cityColor: CITY_COLOR_GREEN,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_PLAINS, SiteType.City),
      hex(LOCAL_HEX.NE, TERRAIN_SWAMP, SiteType.Village),
      hex(LOCAL_HEX.E, TERRAIN_SWAMP, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.SE, TERRAIN_SWAMP),
      hex(LOCAL_HEX.SW, TERRAIN_FOREST, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.W, TERRAIN_LAKE),
      hex(LOCAL_HEX.NW, TERRAIN_FOREST, SiteType.MagicalGlade),
    ],
  },

  // Core 6 - Blue City
  [TileId.Core6BlueCity]: {
    id: TileId.Core6BlueCity,
    type: TILE_TYPE_CORE,
    hasCity: true,
    cityColor: CITY_COLOR_BLUE,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_PLAINS, SiteType.City),
      hex(LOCAL_HEX.NE, TERRAIN_PLAINS, SiteType.Monastery),
      hex(LOCAL_HEX.E, TERRAIN_LAKE),
      hex(LOCAL_HEX.SE, TERRAIN_LAKE),
      hex(LOCAL_HEX.SW, TERRAIN_HILLS),
      hex(LOCAL_HEX.W, TERRAIN_MOUNTAIN, null, { rampaging: RampagingEnemyType.Draconum }),
      hex(LOCAL_HEX.NW, TERRAIN_FOREST),
    ],
  },

  // Core 7 - White City
  [TileId.Core7WhiteCity]: {
    id: TileId.Core7WhiteCity,
    type: TILE_TYPE_CORE,
    hasCity: true,
    cityColor: CITY_COLOR_WHITE,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_PLAINS, SiteType.City),
      hex(LOCAL_HEX.NE, TERRAIN_PLAINS),
      hex(LOCAL_HEX.E, TERRAIN_FOREST),
      hex(LOCAL_HEX.SE, TERRAIN_LAKE, null, { rampaging: RampagingEnemyType.Draconum }),
      hex(LOCAL_HEX.SW, TERRAIN_LAKE),
      hex(LOCAL_HEX.W, TERRAIN_WASTELAND, SiteType.Keep),
      hex(LOCAL_HEX.NW, TERRAIN_WASTELAND, SiteType.SpawningGrounds),
    ],
  },

  // Core 8 - Red City
  [TileId.Core8RedCity]: {
    id: TileId.Core8RedCity,
    type: TILE_TYPE_CORE,
    hasCity: true,
    cityColor: CITY_COLOR_RED,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_WASTELAND, SiteType.City),
      hex(LOCAL_HEX.NE, TERRAIN_HILLS, SiteType.Mine, { mineColor: MINE_COLOR_RED }),
      hex(LOCAL_HEX.E, TERRAIN_DESERT),
      hex(LOCAL_HEX.SE, TERRAIN_DESERT, null, { rampaging: RampagingEnemyType.Draconum }),
      hex(LOCAL_HEX.SW, TERRAIN_WASTELAND),
      hex(LOCAL_HEX.W, TERRAIN_WASTELAND, null, { rampaging: RampagingEnemyType.Draconum }),
      hex(LOCAL_HEX.NW, TERRAIN_DESERT, SiteType.AncientRuins),
    ],
  },
};
