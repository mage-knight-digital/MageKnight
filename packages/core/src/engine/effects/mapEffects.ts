/**
 * Map-related effect handlers
 *
 * Handles effects that reveal tiles, enemies, or other map elements.
 * Used by skills like Scouting, Intelligence, etc.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { HexState, HexEnemy } from "../../types/map.js";
import type { RevealTilesEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { HexCoord } from "@mage-knight/shared";
import {
  hexKey,
  REVEAL_TILE_TYPE_ENEMY,
  REVEAL_TILE_TYPE_GARRISON,
  REVEAL_TILE_TYPE_ALL,
} from "@mage-knight/shared";

/**
 * Calculate the distance between two hexes using axial coordinates.
 * Uses the cube distance formula for hex grids.
 */
function getHexDistance(a: HexCoord, b: HexCoord): number {
  const dq = Math.abs(a.q - b.q);
  const dr = Math.abs(a.r - b.r);
  const ds = Math.abs(-a.q - a.r - (-b.q - b.r));
  return (dq + dr + ds) / 2;
}

/**
 * Get hexes within a certain distance from a position.
 */
function getHexesWithinDistance(
  state: GameState,
  position: HexCoord,
  distance: number
): HexState[] {
  const hexes: HexState[] = [];
  for (const hex of Object.values(state.map.hexes)) {
    const dist = getHexDistance(position, hex.coord);
    if (dist <= distance) {
      hexes.push(hex);
    }
  }
  return hexes;
}

/**
 * Check if a hex has unrevealed enemies (garrisons).
 */
function hasUnrevealedEnemies(hex: HexState): boolean {
  return hex.enemies.some((e) => !e.isRevealed);
}

/**
 * Handle the EFFECT_REVEAL_TILES entry point.
 * Reveals map elements within the specified distance.
 */
export function handleRevealTiles(
  state: GameState,
  player: Player,
  effect: RevealTilesEffect
): EffectResolutionResult {
  // Player must be on the map
  if (player.position === null) {
    return {
      state,
      description: "Cannot reveal tiles - not yet on map",
    };
  }

  const nearbyHexes = getHexesWithinDistance(state, player.position, effect.distance);

  // Determine what to reveal based on tileType
  const tileType = effect.tileType ?? REVEAL_TILE_TYPE_ALL;
  let revealedCount = 0;
  const updatedHexes = { ...state.map.hexes };

  for (const hex of nearbyHexes) {
    const key = hexKey(hex.coord);
    let hexUpdated = false;

    // Reveal enemies (garrisons)
    if ((tileType === REVEAL_TILE_TYPE_ENEMY || tileType === REVEAL_TILE_TYPE_GARRISON || tileType === REVEAL_TILE_TYPE_ALL) &&
        hasUnrevealedEnemies(hex)) {
      const revealedEnemies: HexEnemy[] = hex.enemies.map((e) => ({
        ...e,
        isRevealed: true,
      }));
      updatedHexes[key] = {
        ...hex,
        enemies: revealedEnemies,
      };
      hexUpdated = true;
      revealedCount += hex.enemies.filter((e) => !e.isRevealed).length;
    }

    // Note: Tile revealing itself is handled differently (via explore command)
    // This effect is primarily for revealing hidden information like garrisons

    if (hexUpdated) {
      // Update hex reference for next iteration
      hex.enemies.forEach(() => {});
    }
  }

  if (revealedCount === 0) {
    return {
      state,
      description: "Nothing to reveal",
    };
  }

  const updatedMap = {
    ...state.map,
    hexes: updatedHexes,
  };

  return {
    state: { ...state, map: updatedMap },
    description: `Revealed ${revealedCount} enemy token(s)`,
  };
}
