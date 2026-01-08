/**
 * Resolve choice command - resolves a pending choice effect
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, PendingChoice } from "../../types/player.js";
import type { CardEffect, ChoiceEffect } from "../../types/cards.js";
import {
  CHOICE_REQUIRED,
  CHOICE_RESOLVED,
} from "@mage-knight/shared";
import { resolveEffect, reverseEffect, isEffectResolvable } from "../effects/resolveEffect.js";
import { describeEffect } from "../effects/describeEffect.js";
import { RESOLVE_CHOICE_COMMAND } from "./commandTypes.js";
import { EFFECT_CHOICE } from "../../types/effectTypes.js";

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

      // Check if the resolved effect itself requires a choice (choice chaining)
      if (effectResult.requiresChoice) {
        // Determine the new choice options
        let newChoiceOptions: readonly CardEffect[];

        if (effectResult.dynamicChoiceOptions) {
          // Dynamic choices from effects like EFFECT_CARD_BOOST
          newChoiceOptions = effectResult.dynamicChoiceOptions;
        } else if (chosenEffect.type === EFFECT_CHOICE) {
          // Nested static choice
          const choiceEffect = chosenEffect as ChoiceEffect;
          newChoiceOptions = choiceEffect.options;
        } else {
          // Shouldn't happen, but handle gracefully
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
        }

        // Filter to resolvable options
        const resolvableOptions = newChoiceOptions.filter((opt) =>
          isEffectResolvable(effectResult.state, params.playerId, opt)
        );

        // If no options resolvable, just return the current state
        if (resolvableOptions.length === 0) {
          return {
            state: effectResult.state,
            events: [
              {
                type: CHOICE_RESOLVED,
                playerId: params.playerId,
                cardId: player.pendingChoice.cardId,
                chosenIndex: params.choiceIndex,
                effect: "No available options",
              },
            ],
          };
        }

        // If only one option, auto-resolve it
        if (resolvableOptions.length === 1) {
          const singleOption = resolvableOptions[0];
          if (!singleOption) {
            throw new Error("Expected single resolvable option");
          }
          const autoResolveResult = resolveEffect(
            effectResult.state,
            params.playerId,
            singleOption
          );
          return {
            state: autoResolveResult.state,
            events: [
              {
                type: CHOICE_RESOLVED,
                playerId: params.playerId,
                cardId: player.pendingChoice.cardId,
                chosenIndex: params.choiceIndex,
                effect: autoResolveResult.description,
              },
            ],
          };
        }

        // Multiple options - set up new pending choice (choice chaining)
        const updatedPlayerIdx = effectResult.state.players.findIndex(
          (p) => p.id === params.playerId
        );
        const updatedPlayer = effectResult.state.players[updatedPlayerIdx];
        if (!updatedPlayer) {
          throw new Error("Player not found after effect resolution");
        }

        const playerWithNewChoice: Player = {
          ...updatedPlayer,
          pendingChoice: {
            cardId: player.pendingChoice.cardId, // Keep original card ID for context
            options: resolvableOptions,
          },
        };

        const playersWithNewChoice = [...effectResult.state.players];
        playersWithNewChoice[updatedPlayerIdx] = playerWithNewChoice;

        return {
          state: { ...effectResult.state, players: playersWithNewChoice },
          events: [
            {
              type: CHOICE_RESOLVED,
              playerId: params.playerId,
              cardId: player.pendingChoice.cardId,
              chosenIndex: params.choiceIndex,
              effect: effectResult.description,
            },
            {
              type: CHOICE_REQUIRED,
              playerId: params.playerId,
              cardId: player.pendingChoice.cardId,
              options: resolvableOptions.map((opt) => describeEffect(opt)),
            },
          ],
        };
      }

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
