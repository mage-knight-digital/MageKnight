/**
 * Lost Legion expansion core tile definitions (Core 9-10, Volkare's Camp)
 *
 * Brown back tiles from the Lost Legion expansion.
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
import { TILE_TYPE_CORE } from "../tileConstants.js";
import { LOCAL_HEX } from "./hexPositions.js";
import { hex, type TileDefinition } from "./types.js";

/**
 * Lost Legion expansion core tiles (Core 9-10, Volkare's Camp)
 */
export const CORE_EXPANSION_TILES: Record<
  typeof TileId.Core9 | typeof TileId.Core10 | typeof TileId.CoreVolkare,
  TileDefinition
> = {
  // Core 9 - Mage Tower, Labyrinth, Refugee Camp, Draconum
  // Walls: CENTER walled to W, SW, SE; SE walled to NE, NW; SW walled to NE; W walled to E, NE; NW walled to SW
  [TileId.Core9]: {
    id: TileId.Core9,
    type: TILE_TYPE_CORE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_PLAINS, null, { rampaging: RampagingEnemyType.Draconum }),
      hex(LOCAL_HEX.NE, TERRAIN_HILLS, SiteType.MageTower),
      hex(LOCAL_HEX.E, TERRAIN_MOUNTAIN),
      hex(LOCAL_HEX.SE, TERRAIN_DESERT, SiteType.RefugeeCamp),
      hex(LOCAL_HEX.SW, TERRAIN_DESERT),
      hex(LOCAL_HEX.W, TERRAIN_WASTELAND),
      hex(LOCAL_HEX.NW, TERRAIN_HILLS, SiteType.Labyrinth),
    ],
  },

  // Core 10 - Deep Mine (all 4 colors), Labyrinth, Keep, Orc Marauders
  // Walls: W walled (keep fortified)
  [TileId.Core10]: {
    id: TileId.Core10,
    type: TILE_TYPE_CORE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_WASTELAND),
      hex(LOCAL_HEX.NE, TERRAIN_LAKE),
      hex(LOCAL_HEX.E, TERRAIN_FOREST, SiteType.Labyrinth),
      hex(LOCAL_HEX.SE, TERRAIN_HILLS, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.SW, TERRAIN_HILLS, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.W, TERRAIN_FOREST, SiteType.Keep),
      hex(LOCAL_HEX.NW, TERRAIN_WASTELAND, SiteType.DeepMine, {
        deepMineColors: [MINE_COLOR_RED, MINE_COLOR_BLUE, MINE_COLOR_GREEN, MINE_COLOR_WHITE],
      }),
    ],
  },

  // Volkare's Camp
  // Walls: CENTER walled (camp fortified); SE walled (village fortified)
  [TileId.CoreVolkare]: {
    id: TileId.CoreVolkare,
    type: TILE_TYPE_CORE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_PLAINS, SiteType.VolkaresCamp),
      hex(LOCAL_HEX.NE, TERRAIN_MOUNTAIN),
      hex(LOCAL_HEX.E, TERRAIN_WASTELAND, null, { rampaging: RampagingEnemyType.Draconum }),
      hex(LOCAL_HEX.SE, TERRAIN_DESERT, SiteType.Village),
      hex(LOCAL_HEX.SW, TERRAIN_HILLS),
      hex(LOCAL_HEX.W, TERRAIN_LAKE),
      hex(LOCAL_HEX.NW, TERRAIN_FOREST, null, { rampaging: RampagingEnemyType.OrcMarauder }),
    ],
  },
};
