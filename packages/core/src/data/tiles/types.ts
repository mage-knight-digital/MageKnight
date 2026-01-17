/**
 * Type definitions for tile system
 */

import type { Terrain } from "@mage-knight/shared";
import type { TileId, SiteType, MineColor, RampagingEnemyType } from "../../types/map.js";
import {
  CITY_COLOR_BLUE,
  CITY_COLOR_GREEN,
  CITY_COLOR_RED,
  CITY_COLOR_WHITE,
} from "../../types/mapConstants.js";
import {
  TILE_TYPE_CORE,
  TILE_TYPE_COUNTRYSIDE,
  TILE_TYPE_STARTING,
} from "../tileConstants.js";
import { LOCAL_HEX } from "./hexPositions.js";

/** City color type */
export type CityColor =
  | typeof CITY_COLOR_RED
  | typeof CITY_COLOR_BLUE
  | typeof CITY_COLOR_GREEN
  | typeof CITY_COLOR_WHITE;

/** Type representing valid local hex positions */
export type LocalHexPosition = (typeof LOCAL_HEX)[keyof typeof LOCAL_HEX];

/** Hex definition within a tile template (before placement) */
export interface LocalHex {
  readonly localQ: number;
  readonly localR: number;
  readonly terrain: Terrain;
  readonly site: SiteType | null;
  readonly mineColor?: MineColor;
  readonly deepMineColors?: readonly MineColor[]; // For deep mines: player chooses from these colors
  readonly rampaging?: RampagingEnemyType;
}

/** Tile type */
export type TileType =
  | typeof TILE_TYPE_STARTING
  | typeof TILE_TYPE_COUNTRYSIDE
  | typeof TILE_TYPE_CORE;

/** Full tile definition */
export interface TileDefinition {
  readonly id: TileId;
  readonly type: TileType;
  readonly hexes: readonly LocalHex[];
  readonly hasCity: boolean;
  readonly cityColor?: CityColor;
}

/**
 * Helper to create a local hex definition
 */
export function hex(
  position: LocalHexPosition,
  terrain: Terrain,
  site: SiteType | null = null,
  extra?: { mineColor?: MineColor; deepMineColors?: MineColor[]; rampaging?: RampagingEnemyType }
): LocalHex {
  return { localQ: position.q, localR: position.r, terrain, site, ...extra };
}
