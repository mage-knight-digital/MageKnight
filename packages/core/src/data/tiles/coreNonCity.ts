/**
 * Base game non-city core tile definitions (Core 1-4)
 *
 * Brown back tiles without cities from the base game.
 * Data verified against tile images from the unofficial Mage Knight wiki.
 */

import {
  TERRAIN_DESERT,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
  TERRAIN_SWAMP,
  TERRAIN_WASTELAND,
} from "@mage-knight/shared";
import { TileId, SiteType, RampagingEnemyType } from "../../types/map.js";
import {
  MINE_COLOR_BLUE,
  MINE_COLOR_GREEN,
  MINE_COLOR_WHITE,
} from "../../types/mapConstants.js";
import { TILE_TYPE_CORE } from "../tileConstants.js";
import { LOCAL_HEX } from "./hexPositions.js";
import { hex, type TileDefinition } from "./types.js";

/**
 * Base game non-city core tiles (Core 1-4)
 */
export const CORE_NON_CITY_TILES: Record<
  typeof TileId.Core1 | typeof TileId.Core2 | typeof TileId.Core3 | typeof TileId.Core4,
  TileDefinition
> = {
  // Core 1 - Monastery, Tomb, Spawning Grounds
  [TileId.Core1]: {
    id: TileId.Core1,
    type: TILE_TYPE_CORE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_DESERT, SiteType.Monastery),
      hex(LOCAL_HEX.NE, TERRAIN_DESERT, SiteType.Tomb),
      hex(LOCAL_HEX.E, TERRAIN_DESERT),
      hex(LOCAL_HEX.SE, TERRAIN_DESERT),
      hex(LOCAL_HEX.SW, TERRAIN_HILLS),
      hex(LOCAL_HEX.W, TERRAIN_HILLS, SiteType.SpawningGrounds),
      hex(LOCAL_HEX.NW, TERRAIN_MOUNTAIN),
    ],
  },

  // Core 2 - Mage Tower, Ancient Ruins, Mine (green), Draconum
  [TileId.Core2]: {
    id: TileId.Core2,
    type: TILE_TYPE_CORE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_LAKE),
      hex(LOCAL_HEX.NE, TERRAIN_WASTELAND, SiteType.AncientRuins),
      hex(LOCAL_HEX.E, TERRAIN_HILLS, SiteType.Mine, { mineColor: MINE_COLOR_GREEN }),
      hex(LOCAL_HEX.SE, TERRAIN_SWAMP, null, { rampaging: RampagingEnemyType.Draconum }),
      hex(LOCAL_HEX.SW, TERRAIN_SWAMP, SiteType.MageTower),
      hex(LOCAL_HEX.W, TERRAIN_FOREST),
      hex(LOCAL_HEX.NW, TERRAIN_LAKE),
    ],
  },

  // Core 3 - Mage Tower, Ancient Ruins, Tomb, Mine (white)
  [TileId.Core3]: {
    id: TileId.Core3,
    type: TILE_TYPE_CORE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_WASTELAND),
      hex(LOCAL_HEX.NE, TERRAIN_WASTELAND, SiteType.AncientRuins),
      hex(LOCAL_HEX.E, TERRAIN_HILLS, SiteType.MageTower),
      hex(LOCAL_HEX.SE, TERRAIN_WASTELAND),
      hex(LOCAL_HEX.SW, TERRAIN_HILLS, SiteType.Mine, { mineColor: MINE_COLOR_WHITE }),
      hex(LOCAL_HEX.W, TERRAIN_WASTELAND, SiteType.Tomb),
      hex(LOCAL_HEX.NW, TERRAIN_MOUNTAIN),
    ],
  },

  // Core 4 - Keep, Ancient Ruins, Mine (blue), Draconum
  [TileId.Core4]: {
    id: TileId.Core4,
    type: TILE_TYPE_CORE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_MOUNTAIN, null, { rampaging: RampagingEnemyType.Draconum }),
      hex(LOCAL_HEX.NE, TERRAIN_HILLS),
      hex(LOCAL_HEX.E, TERRAIN_HILLS, SiteType.Keep),
      hex(LOCAL_HEX.SE, TERRAIN_WASTELAND),
      hex(LOCAL_HEX.SW, TERRAIN_WASTELAND, SiteType.AncientRuins),
      hex(LOCAL_HEX.W, TERRAIN_WASTELAND),
      hex(LOCAL_HEX.NW, TERRAIN_WASTELAND, SiteType.Mine, { mineColor: MINE_COLOR_BLUE }),
    ],
  },
};
