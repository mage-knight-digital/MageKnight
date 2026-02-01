/**
 * Choice effect handling for card plays
 *
 * Handles the logic for presenting and resolving choice effects,
 * including filtering resolvable options and auto-resolving single choices.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CardId } from "@mage-knight/shared";
import type { GameEvent } from "@mage-knight/shared";
import {
  CARD_PLAYED,
  CHOICE_REQUIRED,
} from "@mage-knight/shared";
import { EFFECT_CHOICE } from "../../../types/effectTypes.js";
import type { CardEffect, ChoiceEffect } from "../../../types/cards.js";
import { resolveEffect, isEffectResolvable, describeEffect } from "../../effects/index.js";
import type { EffectResolutionResult } from "../../effects/index.js";

/**
 * Result of handling a choice effect
 */
export interface ChoiceHandlingResult {
  readonly state: GameState;
  readonly events: GameEvent[];
  /** The effect that was actually resolved (for undo tracking) */
  readonly resolvedEffect?: CardEffect;
}

/**
 * Determine the choice options from an effect resolution result.
 * Returns the options array, or null if this isn't a choice scenario.
 */
export function getChoiceOptions(
  effectResult: EffectResolutionResult,
  effectToApply: CardEffect
): readonly CardEffect[] | null {
  if (effectResult.dynamicChoiceOptions) {
    // Dynamic choices from effects like EFFECT_CARD_BOOST
    return effectResult.dynamicChoiceOptions;
  }

  if (effectToApply.type === EFFECT_CHOICE) {
    // Static choice effect
    const choiceEffect = effectToApply as ChoiceEffect;
    return choiceEffect.options;
  }

  return null;
}

/**
 * Filter choice options to only those that are currently resolvable.
 */
export function filterResolvableOptions(
  state: GameState,
  playerId: string,
  options: readonly CardEffect[]
): readonly CardEffect[] {
  return options.filter((opt) => isEffectResolvable(state, playerId, opt));
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
  state: GameState,
  playerId: string,
  playerIndex: number,
  cardId: CardId,
  isPowered: boolean,
  effectResult: EffectResolutionResult,
  choiceOptions: readonly CardEffect[]
): ChoiceHandlingResult {
  // Filter options to only include resolvable ones
  const resolvableOptions = filterResolvableOptions(state, playerId, choiceOptions);

  // If no options are resolvable, skip the choice entirely
  if (resolvableOptions.length === 0) {
    return {
      state: effectResult.state,
      events: [createCardPlayedEvent(playerId, cardId, isPowered, "No available options")],
    };
  }

  // If only one option is resolvable, auto-resolve it
  if (resolvableOptions.length === 1) {
    const singleOption = resolvableOptions[0];
    if (!singleOption) {
      throw new Error("Expected single resolvable option");
    }

    const autoResolveResult = resolveEffect(state, playerId, singleOption);
    return {
      state: autoResolveResult.state,
      events: [createCardPlayedEvent(playerId, cardId, isPowered, autoResolveResult.description)],
      resolvedEffect: singleOption,
    };
  }

  // Multiple options available - present choice to player
  const player = effectResult.state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  const playerWithChoice: Player = {
    ...player,
    pendingChoice: {
      cardId,
      skillId: null,
      unitInstanceId: null,
      options: resolvableOptions,
    },
  };

  // Update state with pending choice
  const playersWithChoice = [...effectResult.state.players];
  playersWithChoice[playerIndex] = playerWithChoice;

  return {
    state: { ...effectResult.state, players: playersWithChoice },
    events: [
      createCardPlayedEvent(playerId, cardId, isPowered, "Choice required"),
      {
        type: CHOICE_REQUIRED,
        playerId,
        cardId,
        skillId: null,
        options: resolvableOptions.map((opt) => describeEffect(opt)),
      },
    ],
  };
}
