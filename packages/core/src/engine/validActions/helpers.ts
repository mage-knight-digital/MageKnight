/**
 * Helper functions for computing valid actions.
 *
 * These are reusable utilities for checking phase, turn, and player state.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import {
  GAME_PHASE_ROUND,
  ROUND_PHASE_PLAYER_TURNS,
  ROUND_PHASE_TACTICS_SELECTION,
} from "@mage-knight/shared";
import {
  NOT_YOUR_TURN,
  WRONG_PHASE,
  PLAYER_NOT_FOUND,
} from "../validators/validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import {
  mustAnnounceEndOfRoundAtTurnStart,
  mustForfeitTurnAfterRoundAnnouncement,
  isActivePlayer,
} from "../rules/turnStructure.js";

/**
 * Check if a player can act in the current game state.
 * Returns { canAct: true } or { canAct: false, reason: string }.
 */
export function checkCanAct(
  state: GameState,
  playerId: string
): { canAct: true; player: Player } | { canAct: false; reason: string } {
  // Find the player
  const player = getPlayerById(state, playerId);
  if (!player) {
    return { canAct: false, reason: PLAYER_NOT_FOUND };
  }

  // Check game phase
  if (state.phase !== GAME_PHASE_ROUND) {
    return { canAct: false, reason: WRONG_PHASE };
  }

  // Phase-aware active player check (works for both tactics selection and player turns)
  if (!isActivePlayer(state, playerId)) {
    return { canAct: false, reason: NOT_YOUR_TURN };
  }

  return { canAct: true, player };
}

/**
 * Check if player is in combat.
 */
export function isInCombat(state: GameState): boolean {
  return state.combat !== null;
}

/**
 * Check if player has a pending choice that must be resolved.
 */
export function hasPendingChoice(player: Player): boolean {
  return player.pendingChoice !== null;
}

/**
 * Check if player is on the map.
 */
export function isOnMap(player: Player): boolean {
  return player.position !== null;
}

/**
 * Get the current player ID from turn order.
 */
export function getCurrentPlayerId(state: GameState): string | null {
  if (state.roundPhase === ROUND_PHASE_TACTICS_SELECTION) {
    return state.currentTacticSelector;
  }
  return state.turnOrder[state.currentPlayerIndex] ?? null;
}

/**
 * Check if it's the tactics selection phase.
 */
export function isTacticsPhase(state: GameState): boolean {
  return (
    state.phase === GAME_PHASE_ROUND &&
    state.roundPhase === ROUND_PHASE_TACTICS_SELECTION
  );
}

/**
 * Check if it's the player turns phase.
 */
export function isPlayerTurnsPhase(state: GameState): boolean {
  return (
    state.phase === GAME_PHASE_ROUND &&
    state.roundPhase === ROUND_PHASE_PLAYER_TURNS
  );
}

/**
 * Check if turn-start rules force the player to pass instead of taking normal actions.
 *
 * - Must announce when deck+hand are empty and no announcement exists.
 * - Must forfeit when another player already announced and deck+hand are empty.
 */
export function mustAnnounceEndOfRound(
  state: GameState,
  player: Player
): boolean {
  return (
    mustAnnounceEndOfRoundAtTurnStart(state, player) ||
    mustForfeitTurnAfterRoundAnnouncement(state, player)
  );
}

/**
 * Build the reason string for why a player can't act.
 */
export function getCannotActReason(
  state: GameState,
  playerId: string
): string | undefined {
  const result = checkCanAct(state, playerId);
  if (result.canAct) {
    return undefined;
  }
  return result.reason;
}
