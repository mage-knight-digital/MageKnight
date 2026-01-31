/**
 * Player lookup helper functions for game engine operations
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";

/**
 * Get a player by ID, throwing an error if not found.
 * Use this in commands where the player must exist.
 */
export function getPlayerByIdOrThrow(
  state: GameState,
  playerId: string
): Player {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }
  return player;
}

/**
 * Get a player's index by ID, throwing an error if not found.
 * Use this when you need to update the player in state.
 */
export function getPlayerIndexByIdOrThrow(
  state: GameState,
  playerId: string
): number {
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1) {
    throw new Error(`Player not found: ${playerId}`);
  }
  return index;
}

/**
 * Get a player by ID, returning null if not found.
 * Use this when the player might not exist and you need to handle that case.
 */
export function getPlayerById(
  state: GameState,
  playerId: string
): Player | null {
  return state.players.find((p) => p.id === playerId) ?? null;
}

/**
 * Get a player's index by ID, returning -1 if not found.
 * Use this when you need to check existence before proceeding.
 */
export function getPlayerIndexById(
  state: GameState,
  playerId: string
): number {
  return state.players.findIndex((p) => p.id === playerId);
}
