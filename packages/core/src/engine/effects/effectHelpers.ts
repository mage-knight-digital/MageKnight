/**
 * Effect Helper Functions
 *
 * Shared utilities for effect resolution modules.
 *
 * @module effects/effectHelpers
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { getPlayerIndexByIdOrThrow } from "../helpers/playerHelpers.js";

/**
 * Get player index and player object from state and playerId.
 * Helper to bridge between registry signature and internal function signatures.
 *
 * @param state - Current game state
 * @param playerId - ID of the player
 * @returns Object containing playerIndex and player object
 * @throws Error if player not found
 */
export function getPlayerContext(
  state: GameState,
  playerId: string
): { playerIndex: number; player: Player } {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }
  return { playerIndex, player };
}
