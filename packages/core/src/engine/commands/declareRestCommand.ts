/**
 * DECLARE_REST command - enters the resting state
 *
 * Per FAQ p.30: "When you Rest, you don't declare which kind of Rest you're doing
 * (Standard Rest or Slow Recovery): you merely announce that you're Resting."
 *
 * Resting is a STATE where:
 * - Movement is blocked
 * - Combat initiation is blocked
 * - Interaction is blocked
 * - Card play is still allowed (healing, special effects, influence for AAs)
 *
 * The player must complete the rest with COMPLETE_REST action before ending turn.
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { GameEvent } from "@mage-knight/shared";
import { REST_DECLARED, REST_DECLARE_UNDONE } from "@mage-knight/shared";

export const DECLARE_REST_COMMAND = "DECLARE_REST" as const;

export interface DeclareRestCommandParams {
  readonly playerId: string;
}

export function createDeclareRestCommand(
  params: DeclareRestCommandParams
): Command {
  return {
    type: DECLARE_REST_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Can undo rest declaration before completing

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Enter resting state and mark action taken
      // Per rulebook: resting uses the action phase (no more action phase activities)
      const updatedPlayer: Player = {
        ...player,
        isResting: true,
        hasTakenActionThisTurn: true, // Rest uses the action phase
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      const events: GameEvent[] = [
        {
          type: REST_DECLARED,
          playerId: params.playerId,
        },
      ];

      return {
        state: { ...state, players },
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Exit resting state and restore action availability
      const updatedPlayer: Player = {
        ...player,
        isResting: false,
        hasTakenActionThisTurn: false,
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: { ...state, players },
        events: [
          {
            type: REST_DECLARE_UNDONE,
            playerId: params.playerId,
          },
        ],
      };
    },
  };
}
