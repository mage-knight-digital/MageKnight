/**
 * Shared rampaging challenge rules.
 *
 * These helpers are used by both validators and ValidActions computation
 * to prevent rule drift.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { HexCoord } from "@mage-knight/shared";
import { getAllNeighbors, hexKey } from "@mage-knight/shared";

/**
 * Check whether a player can initiate challenge flow this turn.
 * This does not include "must announce end of round" gating, which is handled
 * in higher-level turn validators/valid-actions helpers.
 */
export function canChallengeRampaging(
  state: GameState,
  player: Player
): boolean {
  if (!player.position) {
    return false;
  }

  if (player.isResting) {
    return false;
  }

  if (player.hasTakenActionThisTurn) {
    return false;
  }

  if (state.combat !== null) {
    return false;
  }

  if (player.hasCombattedThisTurn) {
    return false;
  }

  return true;
}

/**
 * Check if two coordinates are adjacent on the hex grid.
 */
export function isChallengeTargetAdjacent(
  source: HexCoord,
  target: HexCoord
): boolean {
  const dq = target.q - source.q;
  const dr = target.r - source.r;

  const adjacentOffsets = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];

  return adjacentOffsets.some((offset) => offset.q === dq && offset.r === dr);
}

/**
 * Check if a hex contains challengeable rampaging enemies.
 */
export function hasChallengeableRampagingEnemiesAtHex(
  state: GameState,
  targetHex: HexCoord
): boolean {
  const hex = state.map.hexes[hexKey(targetHex)];
  if (!hex) {
    return false;
  }

  return hex.rampagingEnemies.length > 0 && hex.enemies.length > 0;
}

/**
 * Get all adjacent rampaging-enemy hexes the player can currently challenge.
 */
export function getChallengeableRampagingHexes(
  state: GameState,
  player: Player
): HexCoord[] {
  if (!canChallengeRampaging(state, player) || !player.position) {
    return [];
  }

  const neighbors = getAllNeighbors(player.position);
  const targetHexes: HexCoord[] = [];

  for (const neighbor of neighbors) {
    if (hasChallengeableRampagingEnemiesAtHex(state, neighbor)) {
      targetHexes.push(neighbor);
    }
  }

  return targetHexes;
}
