/**
 * Decline plunder command - player declines to plunder a village at turn start
 *
 * This is part of the turn-start lifecycle: when a player begins their turn
 * on a village, they must decide whether to plunder before taking any other action.
 * This command handles the "no" decision.
 *
 * This action is NOT reversible - once declined, the player proceeds with their turn.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { DECLINE_PLUNDER_COMMAND } from "./commandTypes.js";

export { DECLINE_PLUNDER_COMMAND };

export interface DeclinePlunderCommandParams {
  readonly playerId: string;
}

export function createDeclinePlunderCommand(
  params: DeclinePlunderCommandParams
): Command {
  return {
    type: DECLINE_PLUNDER_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Turn-start decision, no going back

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex((p) => p.id === params.playerId);
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      const updatedPlayer: Player = {
        ...player,
        pendingPlunderDecision: false,
      };

      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      return {
        state: { ...state, players: updatedPlayers },
        events: [],
      };
    },

    undo(state: GameState): CommandResult {
      // Not reversible, but provide a no-op undo for safety
      return { state, events: [] };
    },
  };
}
