/**
 * CONVERT_CRYSTAL command
 *
 * Converts a crystal to a mana token of the same color.
 * The crystal is decremented and a token is added to pureMana.
 *
 * @module commands/convertCrystalCommand
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, ManaToken } from "../../types/player.js";
import type { BasicManaColor } from "@mage-knight/shared";
import {
  MANA_TOKEN_SOURCE_CRYSTAL,
  CRYSTAL_USED,
} from "@mage-knight/shared";
import type { GameEvent } from "@mage-knight/shared";

export const CONVERT_CRYSTAL_COMMAND = "CONVERT_CRYSTAL" as const;

export interface ConvertCrystalCommandParams {
  readonly playerId: string;
  readonly color: BasicManaColor;
}

export function createConvertCrystalCommand(
  params: ConvertCrystalCommandParams
): Command {
  return {
    type: CONVERT_CRYSTAL_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex]!;

      const newToken: ManaToken = {
        color: params.color,
        source: MANA_TOKEN_SOURCE_CRYSTAL,
      };

      const updatedPlayer: Player = {
        ...player,
        crystals: {
          ...player.crystals,
          [params.color]: player.crystals[params.color] - 1,
        },
        pureMana: [...player.pureMana, newToken],
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      const events: GameEvent[] = [
        {
          type: CRYSTAL_USED,
          playerId: params.playerId,
          color: params.color,
        },
      ];

      return { state: { ...state, players }, events };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex]!;

      // Remove the token
      const tokenIndex = player.pureMana.findIndex(
        (t) =>
          t.color === params.color && t.source === MANA_TOKEN_SOURCE_CRYSTAL
      );
      const newPureMana = [...player.pureMana];
      if (tokenIndex !== -1) {
        newPureMana.splice(tokenIndex, 1);
      }

      // Restore the crystal
      const updatedPlayer: Player = {
        ...player,
        crystals: {
          ...player.crystals,
          [params.color]: player.crystals[params.color] + 1,
        },
        pureMana: newPureMana,
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      return { state: { ...state, players }, events: [] };
    },
  };
}
