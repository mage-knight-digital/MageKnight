/**
 * Resolve choice command - resolves a pending choice effect
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, PendingChoice } from "../../types/player.js";
import type { CardEffect, ChoiceEffect } from "../../types/cards.js";
import type { ChoiceResolvedEvent, ChoiceRequiredEvent } from "@mage-knight/shared";
import {
  CHOICE_REQUIRED,
  CHOICE_RESOLVED,
} from "@mage-knight/shared";
import { resolveEffect, reverseEffect, isEffectResolvable, describeEffect } from "../effects/index.js";
import { RESOLVE_CHOICE_COMMAND } from "./commandTypes.js";
import { EFFECT_CHOICE } from "../../types/effectTypes.js";
import {
  captureUndoContext,
  applyUndoContext,
  type EffectUndoContext,
} from "../effects/effectUndoContext.js";

/**
 * Helper to create a ChoiceResolvedEvent with proper optional properties
 */
function makeChoiceResolvedEvent(
  playerId: string,
  chosenIndex: number,
  effect: string,
  pendingChoice: PendingChoice
): ChoiceResolvedEvent {
  const base: ChoiceResolvedEvent = {
    type: CHOICE_RESOLVED,
    playerId,
    chosenIndex,
    effect,
  };
  if (pendingChoice.cardId) {
    return { ...base, cardId: pendingChoice.cardId };
  }
  if (pendingChoice.sourceSkillId) {
    return { ...base, skillId: pendingChoice.sourceSkillId };
  }
  return base;
}

/**
 * Helper to create a ChoiceRequiredEvent with proper optional properties
 */
function makeChoiceRequiredEvent(
  playerId: string,
  options: readonly string[],
  pendingChoice: PendingChoice
): ChoiceRequiredEvent {
  const base: ChoiceRequiredEvent = {
    type: CHOICE_REQUIRED,
    playerId,
    options,
  };
  if (pendingChoice.cardId) {
    return { ...base, cardId: pendingChoice.cardId };
  }
  if (pendingChoice.sourceSkillId) {
    return { ...base, skillId: pendingChoice.sourceSkillId };
  }
  return base;
}

/**
 * Helper to create a new PendingChoice with proper optional properties
 */
function makePendingChoice(
  options: readonly CardEffect[],
  previousChoice: PendingChoice
): PendingChoice {
  const base: PendingChoice = { options };
  if (previousChoice.cardId) {
    return { ...base, cardId: previousChoice.cardId };
  }
  if (previousChoice.sourceSkillId) {
    return { ...base, sourceSkillId: previousChoice.sourceSkillId };
  }
  return base;
}

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
  // Closure to store undo context for effects that need special handling
  let effectUndoContext: EffectUndoContext | null = null;

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

      // Capture undo context BEFORE applying the effect
      // This stores state we'll need to restore during undo
      effectUndoContext = captureUndoContext(state, chosenEffect);

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
              makeChoiceResolvedEvent(
                params.playerId,
                params.choiceIndex,
                effectResult.description,
                player.pendingChoice
              ),
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
              makeChoiceResolvedEvent(
                params.playerId,
                params.choiceIndex,
                "No available options",
                player.pendingChoice
              ),
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
              makeChoiceResolvedEvent(
                params.playerId,
                params.choiceIndex,
                autoResolveResult.description,
                player.pendingChoice
              ),
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

        const newPendingChoice = makePendingChoice(resolvableOptions, player.pendingChoice);
        const playerWithNewChoice: Player = {
          ...updatedPlayer,
          pendingChoice: newPendingChoice,
        };

        const playersWithNewChoice = [...effectResult.state.players];
        playersWithNewChoice[updatedPlayerIdx] = playerWithNewChoice;

        return {
          state: { ...effectResult.state, players: playersWithNewChoice },
          events: [
            makeChoiceResolvedEvent(
              params.playerId,
              params.choiceIndex,
              effectResult.description,
              player.pendingChoice
            ),
            makeChoiceRequiredEvent(
              params.playerId,
              resolvableOptions.map((opt) => describeEffect(opt)),
              newPendingChoice
            ),
          ],
        };
      }

      return {
        state: effectResult.state,
        events: [
          makeChoiceResolvedEvent(
            params.playerId,
            params.choiceIndex,
            effectResult.description,
            player.pendingChoice
          ),
        ],
      };
    },

    undo(state: GameState): CommandResult {
      // First, apply the captured undo context if we have one
      // This handles non-player state changes (e.g., restoring source dice)
      let currentState = state;
      if (effectUndoContext) {
        currentState = applyUndoContext(state, params.playerId, effectUndoContext);
      }

      const playerIndex = currentState.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = currentState.players[playerIndex];
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

      // Reverse the effect if one was applied (for player-only state changes)
      // Skip this if we already handled it via effectUndoContext
      if (chosenEffect && !effectUndoContext) {
        updatedPlayer = reverseEffect(updatedPlayer, chosenEffect);
      }

      const players = [...currentState.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: { ...currentState, players },
        events: [
          makeChoiceRequiredEvent(
            params.playerId,
            params.previousPendingChoice.options.map((opt) => describeEffect(opt)),
            params.previousPendingChoice
          ),
        ],
      };
    },
  };
}
