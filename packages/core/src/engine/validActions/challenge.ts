/**
 * Challenge action options.
 *
 * Computes valid hexes containing rampaging enemies that a player can challenge
 * from an adjacent position.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { ChallengeOptions } from "@mage-knight/shared";
import { mustAnnounceEndOfRound } from "./helpers.js";
import { getChallengeableRampagingHexes } from "../rules/challenge.js";

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
  // Must announce end of round before taking other actions
  if (mustAnnounceEndOfRound(state, player)) {
    return undefined;
  }

  const targetHexes = getChallengeableRampagingHexes(state, player);

  // Return undefined if no valid targets
  if (targetHexes.length === 0) {
    return undefined;
  }

  return {
    canChallenge: true,
    targetHexes,
  };
}
