/**
 * Map-related effect handlers
 *
 * Handles effects that reveal tiles, enemies, or other map elements.
 * Used by skills like Scouting, Intelligence, etc.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { HexState, HexEnemy } from "../../types/map.js";
import type { RevealTilesEffect, ScoutPeekEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { HexCoord } from "@mage-knight/shared";
import {
  hexKey,
  UNIT_SCOUTS,
  REVEAL_TILE_TYPE_ENEMY,
  REVEAL_TILE_TYPE_GARRISON,
  REVEAL_TILE_TYPE_ALL,
} from "@mage-knight/shared";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { EFFECT_REVEAL_TILES, EFFECT_SCOUT_PEEK } from "../../types/effectTypes.js";
import { addModifier } from "../modifiers/index.js";
import { DURATION_TURN, EFFECT_SCOUT_FAME_BONUS, SCOPE_SELF, SOURCE_UNIT } from "../../types/modifierConstants.js";
import { getEnemyIdFromToken } from "../helpers/enemy/tokenId.js";

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

/**
 * Handle the EFFECT_SCOUT_PEEK effect (Scouts unit ability).
 * Reveals face-down enemy tokens within the specified distance.
 * Also creates a ScoutFameBonus modifier tracking newly revealed enemies
 * for +1 fame bonus when defeated this turn.
 */
export function handleScoutPeek(
  state: GameState,
  player: Player,
  effect: ScoutPeekEffect
): EffectResolutionResult {
  // Player must be on the map
  if (player.position === null) {
    return {
      state,
      description: "Cannot scout - not yet on map",
    };
  }

  const nearbyHexes = getHexesWithinDistance(state, player.position, effect.distance);

  // Find and reveal unrevealed enemies, tracking their enemy definition IDs.
  // We track enemyId (from getEnemyIdFromToken) rather than tokenId because
  // combat enemies use instanceId (enemy_0, enemy_1) which doesn't match tokenId.
  // Using enemyId lets us match defeated combat enemies by their definition ID.
  const revealedEnemyIds: string[] = [];
  let revealedCount = 0;
  const updatedHexes = { ...state.map.hexes };

  for (const hex of nearbyHexes) {
    if (!hasUnrevealedEnemies(hex)) continue;

    const key = hexKey(hex.coord);
    const revealedEnemies: HexEnemy[] = hex.enemies.map((e) => {
      if (!e.isRevealed) {
        revealedEnemyIds.push(getEnemyIdFromToken(e.tokenId));
        revealedCount++;
        return { ...e, isRevealed: true };
      }
      return e;
    });
    updatedHexes[key] = { ...hex, enemies: revealedEnemies };
  }

  if (revealedCount === 0) {
    return {
      state,
      description: "No hidden tokens nearby to scout",
    };
  }

  let updatedState: GameState = {
    ...state,
    map: { ...state.map, hexes: updatedHexes },
  };

  // Find unit index for modifier source
  const playerIndex = updatedState.players.findIndex((p) => p.id === player.id);
  const unitIndex = playerIndex >= 0
    ? updatedState.players[playerIndex]!.units.findIndex((u) => u.unitId === UNIT_SCOUTS)
    : -1;

  // Add ScoutFameBonus modifier to track revealed enemies
  updatedState = addModifier(updatedState, {
    source: { type: SOURCE_UNIT, unitIndex: Math.max(unitIndex, 0), playerId: player.id },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_SCOUT_FAME_BONUS,
      revealedEnemyIds,
      fame: effect.fame,
    },
    createdAtRound: updatedState.currentRound,
    createdByPlayerId: player.id,
  });

  return {
    state: updatedState,
    description: `Scouted ${revealedCount} enemy token(s)`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all map effect handlers with the effect registry.
 * Called during effect system initialization.
 */
export function registerMapEffects(): void {
  registerEffect(EFFECT_REVEAL_TILES, (state, playerId, effect) => {
    const { player } = getPlayerContext(state, playerId);
    return handleRevealTiles(state, player, effect as RevealTilesEffect);
  });

  registerEffect(EFFECT_SCOUT_PEEK, (state, playerId, effect) => {
    const { player } = getPlayerContext(state, playerId);
    return handleScoutPeek(state, player, effect as ScoutPeekEffect);
  });
}
