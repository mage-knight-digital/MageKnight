/**
 * Resolve choice command - resolves a pending choice effect
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, PendingChoice } from "../../types/player.js";
import type { CompoundEffect } from "../../types/cards.js";
import type { ActiveModifier } from "../../types/modifiers.js";
import {
  CHOICE_REQUIRED,
  CHOICE_RESOLVED,
} from "@mage-knight/shared";
import { resolveEffect, reverseEffect, describeEffect } from "../effects/index.js";
import { RESOLVE_CHOICE_COMMAND } from "./commandTypes.js";
import { EFFECT_COMPOUND } from "../../types/effectTypes.js";
import {
  captureUndoContext,
  applyUndoContext,
  type EffectUndoContext,
} from "../effects/effectUndoContext.js";
import { consumeMovementCardBonus, getModifiersForPlayer } from "../modifiers/index.js";
import { EFFECT_MOVEMENT_CARD_BONUS } from "../../types/modifierConstants.js";
import {
  applyChoiceOutcome,
  buildChoiceRequiredEvent,
  getChoiceOptionsFromEffect,
  type PendingChoiceSource,
} from "./choice/choiceResolution.js";

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
  // Store movement bonus application for undo
  let movementBonusAppliedAmount = 0;
  let movementBonusModifiersSnapshot: readonly ActiveModifier[] | null = null;

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

      const movePointsBefore = player.movePoints;
      const movementBonusAlreadyApplied = player.pendingChoice.movementBonusApplied === true;
      const sourceCardId = player.pendingChoice.cardId;
      const movementBonusModifierIdsBefore = new Set(
        getModifiersForPlayer(state, params.playerId)
          .filter((m) => m.effect.type === EFFECT_MOVEMENT_CARD_BONUS)
          .map((m) => m.id)
      );

      const chosenEffect = player.pendingChoice.options[params.choiceIndex];
      if (!chosenEffect) {
        throw new Error(`Invalid choice index: ${params.choiceIndex}`);
      }

      const source: PendingChoiceSource = {
        cardId: player.pendingChoice.cardId,
        skillId: player.pendingChoice.skillId,
        unitInstanceId: player.pendingChoice.unitInstanceId,
      };

      const buildChoiceResolvedEvent = (effect: string) => ({
        type: CHOICE_RESOLVED,
        playerId: params.playerId,
        cardId: player.pendingChoice.cardId,
        skillId: player.pendingChoice.skillId,
        chosenIndex: params.choiceIndex,
        effect,
      });

      const finalizeResult = (result: CommandResult): CommandResult => {
        let finalState = result.state;
        let bonusAppliedThisStep = 0;

        if (sourceCardId && !movementBonusAlreadyApplied) {
          const playerAfter = finalState.players[playerIndex];
          const movePointsAfter = playerAfter?.movePoints ?? movePointsBefore;
          if (movePointsAfter > movePointsBefore) {
            if (movementBonusModifierIdsBefore.size === 0) {
              // No movement bonus modifiers were active before this choice resolution.
            } else {
              const modifiersSnapshot = finalState.activeModifiers;
              const bonusResult = consumeMovementCardBonus(
                finalState,
                params.playerId,
                movementBonusModifierIdsBefore
              );
              if (bonusResult.bonus > 0 && playerAfter) {
                movementBonusAppliedAmount = bonusResult.bonus;
                movementBonusModifiersSnapshot = modifiersSnapshot;
                bonusAppliedThisStep = bonusResult.bonus;

                const updatedPlayerWithBonus: Player = {
                  ...playerAfter,
                  movePoints: playerAfter.movePoints + bonusResult.bonus,
                };

                const updatedPlayers = [...bonusResult.state.players];
                updatedPlayers[playerIndex] = updatedPlayerWithBonus;
                finalState = { ...bonusResult.state, players: updatedPlayers };
              } else {
                finalState = bonusResult.state;
              }
            }
          }
        }

        const movementBonusApplied = movementBonusAlreadyApplied || bonusAppliedThisStep > 0;
        const updatedPlayerIndex = finalState.players.findIndex(
          (p) => p.id === params.playerId
        );
        const updatedPlayer = finalState.players[updatedPlayerIndex];
        if (sourceCardId && updatedPlayer?.pendingChoice) {
          if (updatedPlayer.pendingChoice.movementBonusApplied !== movementBonusApplied) {
            const updatedPendingChoice: PendingChoice = {
              ...updatedPlayer.pendingChoice,
              movementBonusApplied,
            };
            const updatedPlayers = [...finalState.players];
            updatedPlayers[updatedPlayerIndex] = {
              ...updatedPlayer,
              pendingChoice: updatedPendingChoice,
            };
            finalState = { ...finalState, players: updatedPlayers };
          }
        }

        return { ...result, state: finalState };
      };

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
        const choiceInfo = getChoiceOptionsFromEffect(effectResult, chosenEffect);
        if (!choiceInfo) {
          return finalizeResult({
            state: effectResult.state,
            events: [buildChoiceResolvedEvent(effectResult.description)],
          });
        }

        const choiceResult = applyChoiceOutcome({
          state: effectResult.state,
          playerId: params.playerId,
          playerIndex,
          options: choiceInfo.options,
          source,
          remainingEffects: choiceInfo.remainingEffects,
          resolveEffect: (state, id, effect) => resolveEffect(state, id, effect),
          handlers: {
            onNoOptions: (state) => ({
              state,
              events: [buildChoiceResolvedEvent("No available options")],
            }),
            onAutoResolved: (autoResult) => ({
              state: autoResult.state,
              events: [buildChoiceResolvedEvent(autoResult.description)],
            }),
            onPendingChoice: (stateWithChoice, options) => ({
              state: stateWithChoice,
              events: [
                buildChoiceResolvedEvent(effectResult.description),
                buildChoiceRequiredEvent(params.playerId, source, options),
              ],
            }),
          },
        });

        return finalizeResult(choiceResult);
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
          const choiceInfo = getChoiceOptionsFromEffect(
            remainingResult,
            compoundEffect
          );

          if (choiceInfo) {
            const choiceResult = applyChoiceOutcome({
              state: remainingResult.state,
              playerId: params.playerId,
              playerIndex,
              options: choiceInfo.options,
              source,
              remainingEffects: choiceInfo.remainingEffects,
              resolveEffect: (state, id, effect) => resolveEffect(state, id, effect),
              handlers: {
                onNoOptions: (state) => ({
                  state,
                  events: [buildChoiceResolvedEvent(effectResult.description)],
                }),
                onAutoResolved: (autoResult) => {
                  if (
                    choiceInfo.remainingEffects &&
                    choiceInfo.remainingEffects.length > 0
                  ) {
                    const nextCompound: CompoundEffect = {
                      type: EFFECT_COMPOUND,
                      effects: choiceInfo.remainingEffects,
                    };
                    const nextResult = resolveEffect(
                      autoResult.state,
                      params.playerId,
                      nextCompound
                    );
                    return {
                      state: nextResult.state,
                      events: [buildChoiceResolvedEvent(effectResult.description)],
                    };
                  }

                  return {
                    state: autoResult.state,
                    events: [buildChoiceResolvedEvent(effectResult.description)],
                  };
                },
                onPendingChoice: (stateWithChoice, options) => ({
                  state: stateWithChoice,
                  events: [
                    buildChoiceResolvedEvent(effectResult.description),
                    buildChoiceRequiredEvent(params.playerId, source, options),
                  ],
                }),
              },
            });

            return finalizeResult(choiceResult);
          }
        }

        // Remaining effects completed without another choice
        return finalizeResult({
          state: remainingResult.state,
          events: [buildChoiceResolvedEvent(effectResult.description)],
        });
      }

      return finalizeResult({
        state: effectResult.state,
        events: [buildChoiceResolvedEvent(effectResult.description)],
      });
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
      if (movementBonusAppliedAmount > 0) {
        updatedPlayer = {
          ...updatedPlayer,
          movePoints: updatedPlayer.movePoints - movementBonusAppliedAmount,
        };
      }

      const players = [...currentState.players];
      players[playerIndex] = updatedPlayer;
      const stateWithModifiers =
        movementBonusAppliedAmount > 0 && movementBonusModifiersSnapshot
          ? { ...currentState, activeModifiers: movementBonusModifiersSnapshot }
          : currentState;

      return {
        state: { ...stateWithModifiers, players },
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
