/**
 * Tile deck setup utilities for Mage Knight
 *
 * Creates and shuffles tile decks based on scenario configuration.
 * Handles the distinction between countryside and core tiles,
 * and properly places city tiles at the bottom of the core deck.
 */

import type { ScenarioConfig } from "@mage-knight/shared";
import type { TileDeck } from "../types/map.js";
import type { RngState } from "../utils/rng.js";
import { shuffleWithRng } from "../utils/rng.js";
import { TileId } from "../types/map.js";
import { TILE_DEFINITIONS } from "./tiles.js";

/**
 * Get all base game countryside tile IDs (no expansion content)
 */
function getBaseCountrysideTiles(): TileId[] {
  return [
    TileId.Countryside1,
    TileId.Countryside2,
    TileId.Countryside3,
    TileId.Countryside4,
    TileId.Countryside5,
    TileId.Countryside6,
    TileId.Countryside7,
    TileId.Countryside8,
    TileId.Countryside9,
    TileId.Countryside10,
    TileId.Countryside11,
  ];
}

/**
 * Get all base game non-city core tile IDs
 */
function getBaseNonCityCoreTiles(): TileId[] {
  return [TileId.Core1, TileId.Core2, TileId.Core3, TileId.Core4];
}

/**
 * Get all base game city tile IDs
 */
function getBaseCityTiles(): TileId[] {
  return [
    TileId.Core5GreenCity,
    TileId.Core6BlueCity,
    TileId.Core7WhiteCity,
    TileId.Core8RedCity,
  ];
}

export interface TileDeckSetupResult {
  readonly tileDeck: TileDeck;
  readonly rng: RngState;
}

/**
 * Create a tile deck based on scenario configuration.
 *
 * Per the rulebook:
 * 1. Shuffle countryside tiles, take the required number
 * 2. Shuffle non-city core tiles, take the required number
 * 3. Shuffle city tiles, take one, place at bottom of core deck
 *
 * @param config - Scenario configuration with tile counts
 * @param rng - Seeded RNG state
 * @returns The configured tile deck and updated RNG state
 */
export function createTileDeck(
  config: ScenarioConfig,
  rng: RngState
): TileDeckSetupResult {
  // Step 1: Shuffle and select countryside tiles
  const allCountryside = getBaseCountrysideTiles();
  const { result: shuffledCountryside, rng: rng1 } = shuffleWithRng(
    allCountryside,
    rng
  );
  const countrysideTiles = shuffledCountryside.slice(
    0,
    config.countrysideTileCount
  );

  // Step 2: Shuffle and select non-city core tiles
  const allNonCityCore = getBaseNonCityCoreTiles();
  const { result: shuffledNonCityCore, rng: rng2 } = shuffleWithRng(
    allNonCityCore,
    rng1
  );
  const nonCityCoreTiles = shuffledNonCityCore.slice(0, config.coreTileCount);

  // Step 3: Shuffle city tiles and take one (placed at bottom of core deck)
  const allCities = getBaseCityTiles();
  const { result: shuffledCities, rng: rng3 } = shuffleWithRng(allCities, rng2);
  const cityTiles = shuffledCities.slice(0, config.cityTileCount);

  // Core deck: non-city core tiles on top, city tiles at bottom
  // When drawing, we draw from the front (index 0), so city is last
  const coreDeck = [...nonCityCoreTiles, ...cityTiles];

  return {
    tileDeck: {
      countryside: countrysideTiles,
      core: coreDeck,
    },
    rng: rng3,
  };
}

/**
 * Draw a tile from the deck.
 * Draws from countryside first, then core (per rulebook rules).
 *
 * @returns The drawn tile ID and updated deck, or null if no tiles remain
 */
export function drawTileFromDeck(
  deck: TileDeck
): { tileId: TileId; updatedDeck: TileDeck } | null {
  // Draw from countryside first
  if (deck.countryside.length > 0) {
    const [tileId, ...rest] = deck.countryside;
    if (tileId === undefined) return null;
    return {
      tileId,
      updatedDeck: {
        countryside: rest,
        core: deck.core,
      },
    };
  }

  // Then draw from core
  if (deck.core.length > 0) {
    const [tileId, ...rest] = deck.core;
    if (tileId === undefined) return null;
    return {
      tileId,
      updatedDeck: {
        countryside: deck.countryside,
        core: rest,
      },
    };
  }

  return null;
}

/**
 * Get the total number of tiles remaining in the deck
 */
export function getTotalTilesRemaining(deck: TileDeck): number {
  return deck.countryside.length + deck.core.length;
}

/**
 * Check if a tile is a city tile
 */
export function isCityTile(tileId: TileId): boolean {
  const definition = TILE_DEFINITIONS[tileId];
  return definition?.hasCity ?? false;
}
