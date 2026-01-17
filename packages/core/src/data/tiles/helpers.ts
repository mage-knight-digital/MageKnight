/**
 * Tile helper functions
 *
 * Functions for placing tiles on the map and querying tile definitions.
 */

import type { HexCoord } from "@mage-knight/shared";
import { TileId, SiteType, type HexState, type Site, type RampagingEnemyType } from "../../types/map.js";
import type { TileType, TileDefinition } from "./types.js";
import { STARTING_TILES } from "./starting.js";
import { COUNTRYSIDE_TILES } from "./countryside.js";
import { CORE_TILES } from "./core.js";

/**
 * Complete tile definitions for Mage Knight
 * Aggregated from all category modules
 */
export const TILE_DEFINITIONS: Record<TileId, TileDefinition> = {
  ...STARTING_TILES,
  ...COUNTRYSIDE_TILES,
  ...CORE_TILES,
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
          // Mine color from hex definition (regular mines)
          ...(localHex.site === SiteType.Mine &&
            localHex.mineColor && { mineColor: localHex.mineColor }),
          // Deep mine colors from hex definition (player chooses)
          ...(localHex.site === SiteType.DeepMine &&
            localHex.deepMineColors && { deepMineColors: localHex.deepMineColors }),
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
