/**
 * Resolve choice command - resolves a pending choice effect
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, PendingChoice } from "../../types/player.js";
import {
  CHOICE_REQUIRED,
  CHOICE_RESOLVED,
} from "@mage-knight/shared";
import { resolveEffect, reverseEffect } from "../effects/resolveEffect.js";
import { describeEffect } from "../effects/describeEffect.js";
import { RESOLVE_CHOICE_COMMAND } from "./commandTypes.js";

export { RESOLVE_CHOICE_COMMAND };

export interface ResolveChoiceCommandParams {
  readonly playerId: string;
  readonly choiceIndex: number;
  readonly previousPendingChoice: PendingChoice; // For undo
}

/**
 * Create a resolve choice command.
 *
 * This command resolves a pending choice by applying the chosen effect
 * and clearing the pending choice state.
 */
export function createResolveChoiceCommand(
  params: ResolveChoiceCommandParams
): Command {
  return {
    type: RESOLVE_CHOICE_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Can undo resolving a choice

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

      if (!player.pendingChoice) {
        throw new Error("No pending choice to resolve");
      }

      const chosenEffect = player.pendingChoice.options[params.choiceIndex];
      if (!chosenEffect) {
        throw new Error(`Invalid choice index: ${params.choiceIndex}`);
      }

      // Clear pending choice
      const playerWithoutChoice: Player = {
        ...player,
        pendingChoice: null,
      };

      const players = [...state.players];
      players[playerIndex] = playerWithoutChoice;

      const stateWithoutChoice: GameState = { ...state, players };

      // Resolve the chosen effect
      const effectResult = resolveEffect(
        stateWithoutChoice,
        params.playerId,
        chosenEffect
      );

      return {
        state: effectResult.state,
        events: [
          {
            type: CHOICE_RESOLVED,
            playerId: params.playerId,
            cardId: player.pendingChoice.cardId,
            chosenIndex: params.choiceIndex,
            effect: effectResult.description,
          },
        ],
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

      const chosenEffect =
        params.previousPendingChoice.options[params.choiceIndex];

      // Restore pending choice
      let updatedPlayer: Player = {
        ...player,
        pendingChoice: params.previousPendingChoice,
      };

      // Reverse the effect if one was applied
      if (chosenEffect) {
        updatedPlayer = reverseEffect(updatedPlayer, chosenEffect);
      }

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: { ...state, players },
        events: [
          {
            // Re-emit choice required event
            type: CHOICE_REQUIRED,
            playerId: params.playerId,
            cardId: params.previousPendingChoice.cardId,
            options: params.previousPendingChoice.options.map((opt) =>
              describeEffect(opt)
            ),
          },
        ],
      };
    },
  };
}
