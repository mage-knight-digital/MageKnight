/**
 * Choice effect handling for card plays
 *
 * Handles the logic for presenting and resolving choice effects,
 * including filtering resolvable options and auto-resolving single choices.
 */

import type { GameState } from "../../../state/GameState.js";
import type { CardId } from "@mage-knight/shared";
import type { GameEvent } from "@mage-knight/shared";
import { CARD_PLAYED } from "@mage-knight/shared";
import { EFFECT_COMPOUND } from "../../../types/effectTypes.js";
import type { CardEffect, CompoundEffect } from "../../../types/cards.js";
import { resolveEffect } from "../../effects/index.js";
import type { EffectResolutionResult } from "../../effects/index.js";
import {
  applyChoiceOutcome,
  buildChoiceRequiredEvent,
  getChoiceOptionsFromEffect,
  type ChoiceHandlingResult,
  type ChoiceOptionsResult,
  type PendingChoiceSource,
} from "../choice/choiceResolution.js";

/**
 * Determine the choice options from an effect resolution result.
 * Returns the options array, or null if this isn't a choice scenario.
 */
export function getChoiceOptions(
  effectResult: EffectResolutionResult,
  effectToApply: CardEffect
): ChoiceOptionsResult | null {
  return getChoiceOptionsFromEffect(effectResult, effectToApply);
}

/**
 * Create a CARD_PLAYED event for the given card.
 */
function createCardPlayedEvent(
  playerId: string,
  cardId: CardId,
  isPowered: boolean,
  effectDescription: string
): GameEvent {
  return {
    type: CARD_PLAYED,
    playerId,
    cardId,
    powered: isPowered,
    sideways: false,
    effect: effectDescription,
  };
}

/**
 * Handle a choice effect by filtering options and either auto-resolving
 * or presenting the choice to the player.
 */
export function handleChoiceEffect(
  playerId: string,
  playerIndex: number,
  cardId: CardId,
  isPowered: boolean,
  effectResult: EffectResolutionResult,
  choiceInfo: ChoiceOptionsResult
): ChoiceHandlingResult {
  const source: PendingChoiceSource = {
    cardId,
    skillId: null,
    unitInstanceId: null,
  };

  const resolveRemainingEffects = (
    currentState: GameState,
    remainingEffects: readonly CardEffect[] | undefined,
    description: string
  ): ChoiceHandlingResult => {
    if (!remainingEffects || remainingEffects.length === 0) {
      return {
        state: currentState,
        events: [createCardPlayedEvent(playerId, cardId, isPowered, description)],
      };
    }

    const compoundEffect: CompoundEffect = {
      type: EFFECT_COMPOUND,
      effects: remainingEffects,
    };
    const compoundResult = resolveEffect(currentState, playerId, compoundEffect);

    if (compoundResult.requiresChoice) {
      const nextChoiceInfo = getChoiceOptionsFromEffect(
        compoundResult,
        compoundEffect
      );
      if (nextChoiceInfo) {
        return applyChoiceOutcome({
          state: compoundResult.state,
          playerId,
          playerIndex,
          options: nextChoiceInfo.options,
          source,
          remainingEffects: nextChoiceInfo.remainingEffects,
          resolveEffect: (state, id, effect) => resolveEffect(state, id, effect),
          handlers: {
            onNoOptions: (state) =>
              resolveRemainingEffects(
                state,
                nextChoiceInfo.remainingEffects,
                description
              ),
            onAutoResolved: (autoResult) =>
              resolveRemainingEffects(
                autoResult.state,
                nextChoiceInfo.remainingEffects,
                description
              ),
            onPendingChoice: (stateWithChoice, options) => ({
              state: stateWithChoice,
              events: [
                createCardPlayedEvent(
                  playerId,
                  cardId,
                  isPowered,
                  "Choice required"
                ),
                buildChoiceRequiredEvent(playerId, source, options),
              ],
            }),
          },
        });
      }
    }

    return {
      state: compoundResult.state,
      events: [createCardPlayedEvent(playerId, cardId, isPowered, description)],
    };
  };

  return applyChoiceOutcome({
    state: effectResult.state,
    playerId,
    playerIndex,
    options: choiceInfo.options,
    source,
    remainingEffects: choiceInfo.remainingEffects,
    resolveEffect: (state, id, effect) => resolveEffect(state, id, effect),
    handlers: {
      onNoOptions: (state) =>
        resolveRemainingEffects(state, choiceInfo.remainingEffects, "No available options"),
      onAutoResolved: (autoResult) =>
        resolveRemainingEffects(
          autoResult.state,
          choiceInfo.remainingEffects,
          autoResult.description
        ),
      onPendingChoice: (stateWithChoice, options) => ({
        state: stateWithChoice,
        events: [
          createCardPlayedEvent(playerId, cardId, isPowered, "Choice required"),
          buildChoiceRequiredEvent(playerId, source, options),
        ],
      }),
    },
  });
}
