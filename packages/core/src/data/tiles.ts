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

import type { Terrain, HexCoord } from "@mage-knight/shared";
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
import {
  TileId,
  SiteType,
  RampagingEnemyType,
  type HexState,
  type Site,
  type MineColor,
} from "../types/map.js";
import {
  CITY_COLOR_RED,
  CITY_COLOR_BLUE,
  CITY_COLOR_GREEN,
  CITY_COLOR_WHITE,
  MINE_COLOR_BLUE,
  MINE_COLOR_WHITE,
  MINE_COLOR_RED,
  MINE_COLOR_GREEN,
} from "../types/mapConstants.js";
import {
  TILE_TYPE_CORE,
  TILE_TYPE_COUNTRYSIDE,
  TILE_TYPE_STARTING,
} from "./tileConstants.js";

// ============================================================================
// Local hex position constants (relative to tile center)
// ============================================================================

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

/** Type representing valid local hex positions */
export type LocalHexPosition = (typeof LOCAL_HEX)[keyof typeof LOCAL_HEX];

// Hex definition within a tile template (before placement)
export interface LocalHex {
  readonly localQ: number;
  readonly localR: number;
  readonly terrain: Terrain;
  readonly site: SiteType | null;
  readonly mineColor?: MineColor;
  readonly rampaging?: RampagingEnemyType;
}

// Tile type
export type TileType =
  | typeof TILE_TYPE_STARTING
  | typeof TILE_TYPE_COUNTRYSIDE
  | typeof TILE_TYPE_CORE;

// Full tile definition
export interface TileDefinition {
  readonly id: TileId;
  readonly type: TileType;
  readonly hexes: readonly LocalHex[];
  readonly hasCity: boolean;
  readonly cityColor?: typeof CITY_COLOR_RED | typeof CITY_COLOR_BLUE | typeof CITY_COLOR_GREEN | typeof CITY_COLOR_WHITE;
}

// Helper to create a local hex
function hex(
  position: LocalHexPosition,
  terrain: Terrain,
  site: SiteType | null = null,
  extra?: { mineColor?: MineColor; rampaging?: RampagingEnemyType }
): LocalHex {
  return { localQ: position.q, localR: position.r, terrain, site, ...extra };
}

/**
 * Complete tile definitions for Mage Knight
 * Verified against official tile images
 */
export const TILE_DEFINITIONS: Record<TileId, TileDefinition> = {
  // ============================================================================
  // STARTING TILES (Portal)
  // ============================================================================

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
      hex(LOCAL_HEX.CENTER, TERRAIN_PLAINS, SiteType.Portal),
      hex(LOCAL_HEX.NE, TERRAIN_FOREST),
      hex(LOCAL_HEX.E, TERRAIN_PLAINS),
      hex(LOCAL_HEX.SE, TERRAIN_PLAINS),
      hex(LOCAL_HEX.SW, TERRAIN_MOUNTAIN),
      hex(LOCAL_HEX.W, TERRAIN_LAKE),
      hex(LOCAL_HEX.NW, TERRAIN_PLAINS),
    ],
  },

  // ============================================================================
  // COUNTRYSIDE TILES (Green back) - Base Game
  // ============================================================================

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

  // ============================================================================
  // COUNTRYSIDE TILES (Green back) - Lost Legion Expansion
  // ============================================================================

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
      hex(LOCAL_HEX.SE, TERRAIN_FOREST, SiteType.DeepMine, { mineColor: MINE_COLOR_BLUE }), // Deep mine: green/blue
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
      hex(LOCAL_HEX.W, TERRAIN_DESERT, SiteType.DeepMine), // Deep mine: red/white
      hex(LOCAL_HEX.NW, TERRAIN_DESERT),
    ],
  },

  // ============================================================================
  // CORE TILES (Brown back) - Non-city - Base Game
  // ============================================================================

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

  // ============================================================================
  // CORE TILES (Brown back) - City Tiles - Base Game
  // ============================================================================

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

  // ============================================================================
  // CORE TILES (Brown back) - Lost Legion Expansion
  // ============================================================================

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
      hex(LOCAL_HEX.NW, TERRAIN_WASTELAND, SiteType.DeepMine), // Deep mine: all 4 colors
    ],
  },

  // ============================================================================
  // SPECIAL TILES - Lost Legion Expansion
  // ============================================================================

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

/**
 * Place a tile on the map at the given world coordinates.
 * Converts local hex coordinates to world coordinates.
 */
export function placeTile(tileId: TileId, centerCoord: HexCoord): HexState[] {
  const definition = TILE_DEFINITIONS[tileId];
  if (!definition) {
    throw new Error(`Unknown tile: ${tileId}`);
  }

  return definition.hexes.map((localHex) => {
    // Convert local coords to world coords by adding to center
    const worldCoord: HexCoord = {
      q: centerCoord.q + localHex.localQ,
      r: centerCoord.r + localHex.localR,
    };

    // Create site if one exists on this hex
    const site: Site | null = localHex.site
      ? {
          type: localHex.site,
          owner: null,
          isConquered: false,
          isBurned: false,
          // City color from tile definition
          ...(localHex.site === SiteType.City &&
            definition.cityColor && { cityColor: definition.cityColor }),
          // Mine color from hex definition
          ...(localHex.site === SiteType.Mine &&
            localHex.mineColor && { mineColor: localHex.mineColor }),
        }
      : null;

    // Rampaging enemies from hex definition
    const rampagingEnemies: RampagingEnemyType[] = localHex.rampaging
      ? [localHex.rampaging]
      : [];

    return {
      coord: worldCoord,
      terrain: localHex.terrain,
      tileId,
      site,
      rampagingEnemies,
      enemies: [],
      shieldTokens: [],
    };
  });
}

/**
 * Get all tile IDs of a specific type
 */
export function getTilesByType(type: TileType): TileId[] {
  return Object.values(TILE_DEFINITIONS)
    .filter((def) => def.type === type)
    .map((def) => def.id);
}

/**
 * Get all base game tiles (excludes expansion content)
 */
export function getBaseGameTiles(): TileId[] {
  const expansionTiles = [
    TileId.Countryside12,
    TileId.Countryside13,
    TileId.Countryside14,
    TileId.Core9,
    TileId.Core10,
    TileId.CoreVolkare,
  ];
  return Object.keys(TILE_DEFINITIONS).filter(
    (id) => !expansionTiles.includes(id as TileId)
  ) as TileId[];
}

/**
 * Get all Lost Legion expansion tiles
 */
export function getExpansionTiles(): TileId[] {
  return [
    TileId.Countryside12,
    TileId.Countryside13,
    TileId.Countryside14,
    TileId.Core9,
    TileId.Core10,
    TileId.CoreVolkare,
  ];
}
