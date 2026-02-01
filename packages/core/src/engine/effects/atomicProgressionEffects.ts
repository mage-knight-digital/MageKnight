/**
 * Atomic progression effect handlers
 *
 * Handles effects that modify player progression:
 * - ChangeReputation (reputation track, -7 to +7)
 * - GainFame (fame points, triggers level ups)
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { EffectResolutionResult } from "./types.js";
import { MIN_REPUTATION, MAX_REPUTATION, getLevelsCrossed } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";

// Re-export reputation bounds for use in reverseEffect
export { MIN_REPUTATION, MAX_REPUTATION };

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * Apply a ChangeReputation effect - modifies reputation on the track.
 *
 * Reputation is clamped to the valid range (-7 to +7).
 * Reputation affects influence costs when interacting with locals.
 */
export function applyChangeReputation(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  // Clamp to -7 to +7 range
  const newReputation = Math.max(
    MIN_REPUTATION,
    Math.min(MAX_REPUTATION, player.reputation + amount)
  );

  const updatedPlayer: Player = {
    ...player,
    reputation: newReputation,
  };

  const direction = amount >= 0 ? "Gained" : "Lost";
  const absAmount = Math.abs(amount);

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `${direction} ${absAmount} Reputation`,
  };
}

/**
 * Apply a GainFame effect - adds fame points and queues level ups.
 *
 * When fame crosses level thresholds, pending level ups are queued
 * for the player to resolve (choosing skills or advanced actions).
 */
export function applyGainFame(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  const newFame = player.fame + amount;
  const levelsCrossed = getLevelsCrossed(player.fame, newFame);

  const updatedPlayer: Player = {
    ...player,
    fame: newFame,
    pendingLevelUps: [...player.pendingLevelUps, ...levelsCrossed],
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} Fame`,
  };
}
