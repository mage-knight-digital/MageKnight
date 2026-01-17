/**
 * Base game countryside tile definitions (Countryside 1-11)
 *
 * Green back tiles from the base game.
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
  MINE_COLOR_BLUE,
  MINE_COLOR_GREEN,
  MINE_COLOR_RED,
  MINE_COLOR_WHITE,
} from "../../types/mapConstants.js";
import { TILE_TYPE_COUNTRYSIDE } from "../tileConstants.js";
import { LOCAL_HEX } from "./hexPositions.js";
import { hex, type TileDefinition } from "./types.js";

/**
 * Base game countryside tile definitions (Countryside 1-11)
 */
export const COUNTRYSIDE_BASE_TILES: Record<
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
  | typeof TileId.Countryside11,
  TileDefinition
> = {
  // Countryside 1 - Magical Glade, Village, Orc Marauders
  [TileId.Countryside1]: {
    id: TileId.Countryside1,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_FOREST, SiteType.MagicalGlade),
      hex(LOCAL_HEX.NE, TERRAIN_LAKE),
      hex(LOCAL_HEX.E, TERRAIN_PLAINS, SiteType.Village),
      hex(LOCAL_HEX.SE, TERRAIN_PLAINS),
      hex(LOCAL_HEX.SW, TERRAIN_PLAINS),
      hex(LOCAL_HEX.W, TERRAIN_FOREST),
      hex(LOCAL_HEX.NW, TERRAIN_FOREST, null, { rampaging: RampagingEnemyType.OrcMarauder }),
    ],
  },

  // Countryside 2 - Hills center, Magical Glade, Village, Mine (green), Orc Marauders
  [TileId.Countryside2]: {
    id: TileId.Countryside2,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_HILLS),
      hex(LOCAL_HEX.NE, TERRAIN_FOREST, SiteType.MagicalGlade),
      hex(LOCAL_HEX.E, TERRAIN_PLAINS, SiteType.Village),
      hex(LOCAL_HEX.SE, TERRAIN_PLAINS),
      hex(LOCAL_HEX.SW, TERRAIN_HILLS, SiteType.Mine, { mineColor: MINE_COLOR_GREEN }),
      hex(LOCAL_HEX.W, TERRAIN_PLAINS),
      hex(LOCAL_HEX.NW, TERRAIN_HILLS, null, { rampaging: RampagingEnemyType.OrcMarauder }),
    ],
  },

  // Countryside 3 - Forest center, Keep, Village, Mine (white)
  [TileId.Countryside3]: {
    id: TileId.Countryside3,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_FOREST),
      hex(LOCAL_HEX.NE, TERRAIN_HILLS, SiteType.Keep),
      hex(LOCAL_HEX.E, TERRAIN_HILLS),
      hex(LOCAL_HEX.SE, TERRAIN_HILLS, SiteType.Mine, { mineColor: MINE_COLOR_WHITE }),
      hex(LOCAL_HEX.SW, TERRAIN_PLAINS, SiteType.Village),
      hex(LOCAL_HEX.W, TERRAIN_PLAINS),
      hex(LOCAL_HEX.NW, TERRAIN_PLAINS),
    ],
  },

  // Countryside 4 - Mage Tower, Village, Mountain, Orc Marauders
  [TileId.Countryside4]: {
    id: TileId.Countryside4,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_DESERT, SiteType.MageTower),
      hex(LOCAL_HEX.NE, TERRAIN_DESERT),
      hex(LOCAL_HEX.E, TERRAIN_MOUNTAIN),
      hex(LOCAL_HEX.SE, TERRAIN_PLAINS, SiteType.Village),
      hex(LOCAL_HEX.SW, TERRAIN_PLAINS),
      hex(LOCAL_HEX.W, TERRAIN_HILLS, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.NW, TERRAIN_DESERT),
    ],
  },

  // Countryside 5 - Monastery, Mine (blue), Magical Glade, Orc Marauders
  [TileId.Countryside5]: {
    id: TileId.Countryside5,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_LAKE),
      hex(LOCAL_HEX.NE, TERRAIN_PLAINS, SiteType.Monastery),
      hex(LOCAL_HEX.E, TERRAIN_PLAINS, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.SE, TERRAIN_HILLS, SiteType.Mine, { mineColor: MINE_COLOR_BLUE }),
      hex(LOCAL_HEX.SW, TERRAIN_FOREST),
      hex(LOCAL_HEX.W, TERRAIN_FOREST, SiteType.MagicalGlade),
      hex(LOCAL_HEX.NW, TERRAIN_FOREST),
    ],
  },

  // Countryside 6 - Mine (red), Monster Den, Orc Marauders
  [TileId.Countryside6]: {
    id: TileId.Countryside6,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_HILLS, SiteType.Mine, { mineColor: MINE_COLOR_RED }),
      hex(LOCAL_HEX.NE, TERRAIN_FOREST),
      hex(LOCAL_HEX.E, TERRAIN_PLAINS),
      hex(LOCAL_HEX.SE, TERRAIN_FOREST, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.SW, TERRAIN_HILLS),
      hex(LOCAL_HEX.W, TERRAIN_HILLS, SiteType.MonsterDen),
      hex(LOCAL_HEX.NW, TERRAIN_MOUNTAIN),
    ],
  },

  // Countryside 7 - Monastery, Tomb, Magical Glade, Orc Marauders
  [TileId.Countryside7]: {
    id: TileId.Countryside7,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_SWAMP),
      hex(LOCAL_HEX.NE, TERRAIN_FOREST, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.E, TERRAIN_FOREST, SiteType.MagicalGlade),
      hex(LOCAL_HEX.SE, TERRAIN_PLAINS, SiteType.Tomb),
      hex(LOCAL_HEX.SW, TERRAIN_PLAINS),
      hex(LOCAL_HEX.W, TERRAIN_PLAINS, SiteType.Monastery),
      hex(LOCAL_HEX.NW, TERRAIN_LAKE),
    ],
  },

  // Countryside 8 - Ancient Ruins, Village, Magical Glade, Orc Marauders
  [TileId.Countryside8]: {
    id: TileId.Countryside8,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_SWAMP, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.NE, TERRAIN_FOREST, SiteType.AncientRuins),
      hex(LOCAL_HEX.E, TERRAIN_PLAINS),
      hex(LOCAL_HEX.SE, TERRAIN_SWAMP, SiteType.Village),
      hex(LOCAL_HEX.SW, TERRAIN_SWAMP),
      hex(LOCAL_HEX.W, TERRAIN_FOREST),
      hex(LOCAL_HEX.NW, TERRAIN_FOREST, SiteType.MagicalGlade),
    ],
  },

  // Countryside 9 - Keep, Mage Tower, Tomb
  [TileId.Countryside9]: {
    id: TileId.Countryside9,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_MOUNTAIN),
      hex(LOCAL_HEX.NE, TERRAIN_MOUNTAIN),
      hex(LOCAL_HEX.E, TERRAIN_WASTELAND, SiteType.Keep),
      hex(LOCAL_HEX.SE, TERRAIN_PLAINS),
      hex(LOCAL_HEX.SW, TERRAIN_WASTELAND, SiteType.MageTower),
      hex(LOCAL_HEX.W, TERRAIN_PLAINS),
      hex(LOCAL_HEX.NW, TERRAIN_WASTELAND, SiteType.Tomb),
    ],
  },

  // Countryside 10 - Keep, Ancient Ruins, Monster Den
  [TileId.Countryside10]: {
    id: TileId.Countryside10,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_MOUNTAIN),
      hex(LOCAL_HEX.NE, TERRAIN_FOREST),
      hex(LOCAL_HEX.E, TERRAIN_PLAINS),
      hex(LOCAL_HEX.SE, TERRAIN_HILLS, SiteType.AncientRuins),
      hex(LOCAL_HEX.SW, TERRAIN_HILLS, SiteType.Keep),
      hex(LOCAL_HEX.W, TERRAIN_HILLS),
      hex(LOCAL_HEX.NW, TERRAIN_HILLS, SiteType.MonsterDen),
    ],
  },

  // Countryside 11 - Mage Tower, Ancient Ruins, Orc Marauders
  [TileId.Countryside11]: {
    id: TileId.Countryside11,
    type: TILE_TYPE_COUNTRYSIDE,
    hasCity: false,
    hexes: [
      hex(LOCAL_HEX.CENTER, TERRAIN_PLAINS, SiteType.MageTower),
      hex(LOCAL_HEX.NE, TERRAIN_LAKE),
      hex(LOCAL_HEX.E, TERRAIN_LAKE),
      hex(LOCAL_HEX.SE, TERRAIN_HILLS, null, { rampaging: RampagingEnemyType.OrcMarauder }),
      hex(LOCAL_HEX.SW, TERRAIN_LAKE),
      hex(LOCAL_HEX.W, TERRAIN_PLAINS, SiteType.AncientRuins),
      hex(LOCAL_HEX.NW, TERRAIN_HILLS),
    ],
  },
};
