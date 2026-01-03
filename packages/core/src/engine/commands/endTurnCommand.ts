/**
 * End turn command - handles ending a player's turn
 *
 * This command is irreversible and:
 * - Clears the command stack (no more undo)
 * - Expires "turn" duration modifiers
 * - Resets turn state (hasMovedThisTurn, hasTakenActionThisTurn, movePoints, etc.)
 * - Advances to next player (or next round if everyone has gone)
 *
 * Note: Card handling (moving cards from play area to discard) is skipped for now.
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { GameEvent } from "@mage-knight/shared";
import { TURN_ENDED, ROUND_ENDED } from "@mage-knight/shared";
import { expireModifiers } from "../modifiers.js";
import { EXPIRATION_TURN_END } from "../modifierConstants.js";
import { END_TURN_COMMAND } from "./commandTypes.js";

export { END_TURN_COMMAND };

export interface EndTurnCommandParams {
  readonly playerId: string;
}

export function createEndTurnCommand(params: EndTurnCommandParams): Command {
  return {
    type: END_TURN_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Ending turn is irreversible

    execute(state: GameState): CommandResult {
      // Find current player
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Reset current player's turn state
      const currentPlayer = state.players[playerIndex];
      if (!currentPlayer) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }
      const resetPlayer: Player = {
        ...currentPlayer,
        movePoints: 0,
        influencePoints: 0,
        hasMovedThisTurn: false,
        hasTakenActionThisTurn: false,
        playArea: [],
        pureMana: [],
        usedManaFromSource: false,
      };

      const updatedPlayers: Player[] = [...state.players];
      updatedPlayers[playerIndex] = resetPlayer;

      // Expire turn-duration modifiers
      let newState = expireModifiers(
        { ...state, players: updatedPlayers },
        { type: EXPIRATION_TURN_END, playerId: params.playerId }
      );

      // Advance to next player
      const nextPlayerIndex =
        (state.currentPlayerIndex + 1) % state.turnOrder.length;
      const isNewRound =
        nextPlayerIndex === 0 && state.currentPlayerIndex !== 0;

      const nextPlayerId = state.turnOrder[nextPlayerIndex] ?? null;

      newState = {
        ...newState,
        currentPlayerIndex: nextPlayerIndex,
      };

      // Give next player their starting move points (TEMPORARY - should come from cards)
      if (nextPlayerId) {
        const nextPlayerIdx = newState.players.findIndex(
          (p) => p.id === nextPlayerId
        );
        if (nextPlayerIdx !== -1) {
          const nextPlayer = newState.players[nextPlayerIdx];
          if (nextPlayer) {
            const updatedNextPlayer: Player = {
              ...nextPlayer,
              movePoints: 4, // TEMPORARY
            };
            const players: Player[] = [...newState.players];
            players[nextPlayerIdx] = updatedNextPlayer;
            newState = { ...newState, players };
          }
        }
      }

      const events: GameEvent[] = [
        {
          type: TURN_ENDED,
          playerId: params.playerId,
          nextPlayerId,
        },
      ];

      // Add ROUND_ENDED event if transitioning rounds
      if (isNewRound) {
        events.push({
          type: ROUND_ENDED,
          round: state.round,
        });
      }

      return { state: newState, events };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo END_TURN");
    },
  };
}
