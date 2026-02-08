/**
 * Hand limit helper functions for calculating effective hand limits
 *
 * Keep bonus: +X where X = number of keeps owned (if on/adjacent to any owned keep)
 * Planning tactic: +1 if hand size >= 2 before drawing
 */

import type { GameState } from "../../state/GameState.js";
import { SiteType } from "../../types/map.js";
import { STARTING_HAND_LIMIT, hexKey, getAllNeighbors, TACTIC_PLANNING } from "@mage-knight/shared";
import { getPlayerById } from "./playerHelpers.js";

const PLANNING_MIN_HAND_SIZE_BEFORE_DRAW_FOR_BONUS = 2;
const PLANNING_HAND_LIMIT_BONUS = 1;

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
  const player = getPlayerById(state, playerId);
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
  const player = getPlayerById(state, playerId);
  if (!player) return STARTING_HAND_LIMIT; // Fallback

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

/**
 * Calculate effective hand limit for end-of-turn draw.
 * Includes base hand limit + keep bonus + Planning tactic bonus.
 *
 * Planning (Day 4): At end of turn, if hand size before drawing >= 2, draw as if hand limit +1
 */
export function getEndTurnDrawLimit(
  state: GameState,
  playerId: string,
  currentHandSize: number
): number {
  let limit = getEffectiveHandLimit(state, playerId);

  // Planning tactic: +1 if hand size >= 2 before drawing
  const player = getPlayerById(state, playerId);
  if (
    player?.selectedTactic === TACTIC_PLANNING &&
    currentHandSize >= PLANNING_MIN_HAND_SIZE_BEFORE_DRAW_FOR_BONUS
  ) {
    limit += PLANNING_HAND_LIMIT_BONUS;
  }

  // Meditation/Trance spell: +2 on next draw
  if (player?.meditationHandLimitBonus) {
    limit += player.meditationHandLimitBonus;
  }

  return limit;
}
