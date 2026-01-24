/**
 * Challenge action options.
 *
 * Computes valid hexes containing rampaging enemies that a player can challenge
 * from an adjacent position.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { ChallengeOptions, HexCoord } from "@mage-knight/shared";
import { getAllNeighbors, hexKey } from "@mage-knight/shared";
import { isInCombat } from "./helpers.js";

/**
 * Get challenge options for a player.
 *
 * Returns adjacent hexes containing rampaging enemies that can be challenged.
 * Returns undefined if:
 * - Player is not on the map
 * - Player is already in combat
 * - Player has already completed combat this turn
 * - No adjacent hexes have rampaging enemies
 */
export function getChallengeOptions(
  state: GameState,
  player: Player
): ChallengeOptions | undefined {
  // Must be on the map
  if (!player.position) {
    return undefined;
  }

  // Can't challenge if already in combat
  if (isInCombat(state)) {
    return undefined;
  }

  // Can't challenge if already fought this turn (one combat per turn rule)
  if (player.hasCombattedThisTurn) {
    return undefined;
  }

  // Find adjacent hexes with rampaging enemies
  const targetHexes: HexCoord[] = [];
  const neighbors = getAllNeighbors(player.position);

  for (const neighborCoord of neighbors) {
    const key = hexKey(neighborCoord);
    const hex = state.map.hexes[key];

    // Skip if hex doesn't exist
    if (!hex) continue;

    // Check if hex has rampaging enemies that can be challenged
    // rampagingEnemies array indicates enemies that ARRIVED as rampaging (can be challenged)
    // enemies array contains the actual enemy tokens to fight
    if (hex.rampagingEnemies.length > 0 && hex.enemies.length > 0) {
      targetHexes.push(neighborCoord);
    }
  }

  // Return undefined if no valid targets
  if (targetHexes.length === 0) {
    return undefined;
  }

  return {
    canChallenge: true,
    targetHexes,
  };
}
