/**
 * Announce End of Round command
 *
 * When a player's deck is empty, they can announce the end of the round.
 * All other players get one final turn, then the round ends.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { END_OF_ROUND_ANNOUNCED } from "@mage-knight/shared";
import { ANNOUNCE_END_OF_ROUND_COMMAND } from "./commandTypes.js";

export { ANNOUNCE_END_OF_ROUND_COMMAND };

export interface AnnounceEndOfRoundCommandParams {
  readonly playerId: string;
}

export function createAnnounceEndOfRoundCommand(
  params: AnnounceEndOfRoundCommandParams
): Command {
  return {
    type: ANNOUNCE_END_OF_ROUND_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Cannot undo announcing end of round

    execute(state: GameState): CommandResult {
      // All OTHER players get one final turn
      const otherPlayerIds = state.players
        .filter((p) => p.id !== params.playerId)
        .map((p) => p.id);

      // Mark the announcing player as having taken their action
      // (they forfeit their turn to announce)
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const updatedPlayers: Player[] = [...state.players];
      const currentPlayer = updatedPlayers[playerIndex];
      if (currentPlayer) {
        updatedPlayers[playerIndex] = {
          ...currentPlayer,
          hasTakenActionThisTurn: true,
        };
      }

      return {
        state: {
          ...state,
          players: updatedPlayers,
          endOfRoundAnnouncedBy: params.playerId,
          playersWithFinalTurn: otherPlayerIds,
        },
        events: [
          {
            type: END_OF_ROUND_ANNOUNCED,
            playerId: params.playerId,
          },
        ],
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo ANNOUNCE_END_OF_ROUND");
    },
  };
}
