/**
 * USE_MANA_DIE command
 *
 * Takes a die from the mana source and adds a mana token of the chosen color.
 * The die is marked as taken by the player.
 *
 * @module commands/useManaDieCommand
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, ManaToken } from "../../types/player.js";
import type { ManaColor } from "@mage-knight/shared";
import type { SourceDieId } from "../../types/mana.js";
import {
  MANA_TOKEN_SOURCE_DIE,
  MANA_DIE_TAKEN,
} from "@mage-knight/shared";
import type { GameEvent } from "@mage-knight/shared";

export const USE_MANA_DIE_COMMAND = "USE_MANA_DIE" as const;

export interface UseManaDieCommandParams {
  readonly playerId: string;
  readonly dieId: string;
  readonly color: ManaColor;
}

export function createUseManaDieCommand(
  params: UseManaDieCommandParams
): Command {
  return {
    type: USE_MANA_DIE_COMMAND,
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
        source: MANA_TOKEN_SOURCE_DIE,
      };

      // Check if this is a Mana Steal stored die
      const storedDie = player.tacticState.storedManaDie;
      if (storedDie && storedDie.dieId === params.dieId) {
        // Using the stored die from Mana Steal
        const updatedPlayer: Player = {
          ...player,
          pureMana: [...player.pureMana, newToken],
          tacticState: {
            ...player.tacticState,
            manaStealUsedThisTurn: true,
          },
        };

        const players = [...state.players];
        players[playerIndex] = updatedPlayer;

        const events: GameEvent[] = [
          {
            type: MANA_DIE_TAKEN,
            playerId: params.playerId,
            dieId: params.dieId,
            color: params.color,
          },
        ];

        return { state: { ...state, players }, events };
      }

      // Normal source die
      const updatedDice = state.source.dice.map((d) =>
        d.id === params.dieId
          ? { ...d, takenByPlayerId: params.playerId }
          : d
      );

      const updatedPlayer: Player = {
        ...player,
        usedManaFromSource: true,
        usedDieIds: [...player.usedDieIds, params.dieId as SourceDieId],
        pureMana: [...player.pureMana, newToken],
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      const events: GameEvent[] = [
        {
          type: MANA_DIE_TAKEN,
          playerId: params.playerId,
          dieId: params.dieId,
          color: params.color,
        },
      ];

      return {
        state: {
          ...state,
          players,
          source: { ...state.source, dice: updatedDice },
        },
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

      const player = state.players[playerIndex]!;

      // Check if this was a Mana Steal stored die
      const storedDie = player.tacticState.storedManaDie;
      if (storedDie && storedDie.dieId === params.dieId) {
        // Remove the token and un-mark the stored die
        const tokenIndex = player.pureMana.findIndex(
          (t) => t.color === params.color && t.source === MANA_TOKEN_SOURCE_DIE
        );
        const newPureMana = [...player.pureMana];
        if (tokenIndex !== -1) {
          newPureMana.splice(tokenIndex, 1);
        }

        const updatedPlayer: Player = {
          ...player,
          pureMana: newPureMana,
          tacticState: {
            ...player.tacticState,
            manaStealUsedThisTurn: false,
          },
        };

        const players = [...state.players];
        players[playerIndex] = updatedPlayer;

        return { state: { ...state, players }, events: [] };
      }

      // Normal die: un-take it from source
      const updatedDice = state.source.dice.map((d) =>
        d.id === params.dieId
          ? { ...d, takenByPlayerId: null }
          : d
      );

      // Remove the token
      const tokenIndex = player.pureMana.findIndex(
        (t) => t.color === params.color && t.source === MANA_TOKEN_SOURCE_DIE
      );
      const newPureMana = [...player.pureMana];
      if (tokenIndex !== -1) {
        newPureMana.splice(tokenIndex, 1);
      }

      // Remove die from usedDieIds
      const newUsedDieIds = [...player.usedDieIds];
      const dieIndex = newUsedDieIds.indexOf(params.dieId as SourceDieId);
      if (dieIndex !== -1) {
        newUsedDieIds.splice(dieIndex, 1);
      }

      const updatedPlayer: Player = {
        ...player,
        usedManaFromSource: newUsedDieIds.length > 0,
        usedDieIds: newUsedDieIds,
        pureMana: newPureMana,
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: {
          ...state,
          players,
          source: { ...state.source, dice: updatedDice },
        },
        events: [],
      };
    },
  };
}
