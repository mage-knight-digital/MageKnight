/**
 * Hand limit helper functions for calculating effective hand limits
 *
 * Keep bonus: +X where X = number of keeps owned (if on/adjacent to any owned keep)
 */

import type { GameState } from "../../state/GameState.js";
import { SiteType } from "../../types/map.js";
import { hexKey, getAllNeighbors } from "@mage-knight/shared";

/**
 * Count how many keeps a player owns anywhere on the map.
 */
export function countOwnedKeeps(state: GameState, playerId: string): number {
  let count = 0;

  for (const hex of Object.values(state.map.hexes)) {
    if (hex.site?.type === SiteType.Keep && hex.site.owner === playerId) {
      count++;
    }
  }

  return count;
}

/**
 * Check if player is on or adjacent to any keep they own.
 */
export function isNearOwnedKeep(state: GameState, playerId: string): boolean {
  const player = state.players.find((p) => p.id === playerId);
  if (!player?.position) return false;

  // Check current hex
  const currentHex = state.map.hexes[hexKey(player.position)];
  if (
    currentHex?.site?.type === SiteType.Keep &&
    currentHex.site.owner === playerId
  ) {
    return true;
  }

  // Check adjacent hexes
  const adjacentCoords = getAllNeighbors(player.position);
  for (const coord of adjacentCoords) {
    const hex = state.map.hexes[hexKey(coord)];
    if (hex?.site?.type === SiteType.Keep && hex.site.owner === playerId) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate effective hand limit for a player.
 * Base hand limit + keep bonus (if on/adjacent to owned keep).
 */
export function getEffectiveHandLimit(
  state: GameState,
  playerId: string
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 5; // Default

  let handLimit = player.handLimit;

  // Keep bonus: +X where X = number of keeps owned (if on/adjacent to any owned keep)
  if (isNearOwnedKeep(state, playerId)) {
    handLimit += countOwnedKeeps(state, playerId);
  }

  // Future: Add city hand limit bonus
  // - +1 if near a conquered city where you have any shields
  // - +2 if near a conquered city where you are the leader
  // Note: Keep and city bonuses are NOT cumulative - use the higher bonus only

  return handLimit;
}
