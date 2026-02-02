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
import { resolveEffect, reverseEffect, isEffectResolvable, describeEffect } from "../effects/index.js";
import { RESOLVE_CHOICE_COMMAND } from "./commandTypes.js";
import { EFFECT_CHOICE, EFFECT_COMPOUND } from "../../types/effectTypes.js";
import type { CompoundEffect, ChoiceEffect as ChoiceEffectType } from "../../types/cards.js";
import {
  captureUndoContext,
  applyUndoContext,
  type EffectUndoContext,
} from "../effects/effectUndoContext.js";

export { RESOLVE_CHOICE_COMMAND };

export interface ResolveChoiceCommandParams {
  readonly playerId: string;
  readonly choiceIndex: number;
  readonly previousPendingChoice: PendingChoice; // For undo
}

/**
 * Extract choice options and remaining effects from a list of effects.
 * Used when continuing compound effect resolution.
 */
function extractChoiceFromEffects(
  effects: readonly CardEffect[]
): { options: readonly CardEffect[]; remainingEffects?: readonly CardEffect[] } | null {
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    if (effect && effect.type === EFFECT_CHOICE) {
      const choiceEffect = effect as ChoiceEffectType;
      const remainingEffects = effects.slice(i + 1);
      if (remainingEffects.length > 0) {
        return {
          options: choiceEffect.options,
          remainingEffects,
        };
      }
      return {
        options: choiceEffect.options,
      };
    }
  }
  return null;
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
              {
                type: CHOICE_RESOLVED,
                playerId: params.playerId,
                cardId: player.pendingChoice.cardId,
                skillId: player.pendingChoice.skillId,
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
                skillId: player.pendingChoice.skillId,
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
                skillId: player.pendingChoice.skillId,
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
            skillId: player.pendingChoice.skillId, // Keep original skill ID for context
            unitInstanceId: player.pendingChoice.unitInstanceId, // Keep original unit ID for context
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
              skillId: player.pendingChoice.skillId,
              chosenIndex: params.choiceIndex,
              effect: effectResult.description,
            },
            {
              type: CHOICE_REQUIRED,
              playerId: params.playerId,
              cardId: player.pendingChoice.cardId,
              skillId: player.pendingChoice.skillId,
              options: resolvableOptions.map((opt) => describeEffect(opt)),
            },
          ],
        };
      }

      // Check if there are remaining effects to continue resolving
      const remainingEffects = player.pendingChoice.remainingEffects;
      if (remainingEffects && remainingEffects.length > 0) {
        // Continue resolving the remaining effects from the compound
        const compoundEffect: CompoundEffect = {
          type: EFFECT_COMPOUND,
          effects: remainingEffects,
        };

        const remainingResult = resolveEffect(
          effectResult.state,
          params.playerId,
          compoundEffect
        );

        // Check if the remaining effects require a choice
        if (remainingResult.requiresChoice) {
          const choiceInfo = extractChoiceFromEffects(remainingEffects);

          if (choiceInfo) {
            // Filter to resolvable options
            const resolvableOptions = choiceInfo.options.filter((opt) =>
              isEffectResolvable(remainingResult.state, params.playerId, opt)
            );

            // If no options resolvable, just return the current state
            if (resolvableOptions.length === 0) {
              return {
                state: remainingResult.state,
                events: [
                  {
                    type: CHOICE_RESOLVED,
                    playerId: params.playerId,
                    cardId: player.pendingChoice.cardId,
                    skillId: player.pendingChoice.skillId,
                    chosenIndex: params.choiceIndex,
                    effect: effectResult.description,
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
                remainingResult.state,
                params.playerId,
                singleOption
              );

              // Check if there are more remaining effects after this choice
              if (choiceInfo.remainingEffects && choiceInfo.remainingEffects.length > 0) {
                const nextCompound: CompoundEffect = {
                  type: EFFECT_COMPOUND,
                  effects: choiceInfo.remainingEffects,
                };
                const nextResult = resolveEffect(
                  autoResolveResult.state,
                  params.playerId,
                  nextCompound
                );
                return {
                  state: nextResult.state,
                  events: [
                    {
                      type: CHOICE_RESOLVED,
                      playerId: params.playerId,
                      cardId: player.pendingChoice.cardId,
                      skillId: player.pendingChoice.skillId,
                      chosenIndex: params.choiceIndex,
                      effect: effectResult.description,
                    },
                  ],
                };
              }

              return {
                state: autoResolveResult.state,
                events: [
                  {
                    type: CHOICE_RESOLVED,
                    playerId: params.playerId,
                    cardId: player.pendingChoice.cardId,
                    skillId: player.pendingChoice.skillId,
                    chosenIndex: params.choiceIndex,
                    effect: effectResult.description,
                  },
                ],
              };
            }

            // Multiple options - set up new pending choice
            const updatedPlayerIdx = remainingResult.state.players.findIndex(
              (p) => p.id === params.playerId
            );
            const updatedPlayer = remainingResult.state.players[updatedPlayerIdx];
            if (!updatedPlayer) {
              throw new Error("Player not found after effect resolution");
            }

            const newPendingChoice: PendingChoice = {
              cardId: player.pendingChoice.cardId,
              skillId: player.pendingChoice.skillId,
              unitInstanceId: player.pendingChoice.unitInstanceId,
              options: resolvableOptions,
              ...(choiceInfo.remainingEffects && { remainingEffects: choiceInfo.remainingEffects }),
            };

            const playerWithNewChoice: Player = {
              ...updatedPlayer,
              pendingChoice: newPendingChoice,
            };

            const playersWithNewChoice = [...remainingResult.state.players];
            playersWithNewChoice[updatedPlayerIdx] = playerWithNewChoice;

            return {
              state: { ...remainingResult.state, players: playersWithNewChoice },
              events: [
                {
                  type: CHOICE_RESOLVED,
                  playerId: params.playerId,
                  cardId: player.pendingChoice.cardId,
                  skillId: player.pendingChoice.skillId,
                  chosenIndex: params.choiceIndex,
                  effect: effectResult.description,
                },
                {
                  type: CHOICE_REQUIRED,
                  playerId: params.playerId,
                  cardId: player.pendingChoice.cardId,
                  skillId: player.pendingChoice.skillId,
                  options: resolvableOptions.map((opt) => describeEffect(opt)),
                },
              ],
            };
          }
        }

        // Remaining effects completed without another choice
        return {
          state: remainingResult.state,
          events: [
            {
              type: CHOICE_RESOLVED,
              playerId: params.playerId,
              cardId: player.pendingChoice.cardId,
              skillId: player.pendingChoice.skillId,
              chosenIndex: params.choiceIndex,
              effect: effectResult.description,
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
            skillId: player.pendingChoice.skillId,
            chosenIndex: params.choiceIndex,
            effect: effectResult.description,
          },
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
          {
            // Re-emit choice required event
            type: CHOICE_REQUIRED,
            playerId: params.playerId,
            cardId: params.previousPendingChoice.cardId,
            skillId: params.previousPendingChoice.skillId,
            options: params.previousPendingChoice.options.map((opt) =>
              describeEffect(opt)
            ),
          },
        ],
      };
    },
  };
}
