/**
 * Resolve Maximal Effect Command
 *
 * Handles player resolution of a pending Maximal Effect (Maximal Effect advanced action).
 * When the player selects an action card to throw away:
 * - Card is permanently removed from the game (added to removedCards)
 * - Basic mode: the target card's basic effect is resolved 3 times
 * - Powered mode: the target card's powered effect is resolved 2 times (for free)
 *
 * The multiple uses are aggregated by wrapping N copies of the effect in a CompoundEffect
 * which the existing effect resolver handles (including mid-resolution choices).
 *
 * Flow:
 * 1. Card played creates pendingMaximalEffect via EFFECT_MAXIMAL_EFFECT
 * 2. Player sends RESOLVE_MAXIMAL_EFFECT action with selected cardId
 * 3. Card is removed from hand → added to removedCards (permanent)
 * 4. Target card's effect is resolved multiplier times via CompoundEffect
 *
 * This command is NOT reversible since the effect resolution may involve
 * conditionals, choices, or other state-dependent logic.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId } from "@mage-knight/shared";
import type { Player, PendingMaximalEffect } from "../../types/player.js";
import type { CardEffect, CompoundEffect } from "../../types/cards.js";
import { CARD_DESTROYED } from "@mage-knight/shared";
import { EFFECT_COMPOUND } from "../../types/effectTypes.js";
import { RESOLVE_MAXIMAL_EFFECT_COMMAND } from "./commandTypes.js";
import { getCardsEligibleForMaximalEffect } from "../effects/maximalEffectEffects.js";
import { getCard } from "../helpers/cardLookup.js";
import { resolveEffect } from "../effects/index.js";
import {
  getChoiceOptionsFromEffect,
  applyChoiceOutcome,
  buildChoiceRequiredEvent,
} from "./choice/choiceResolution.js";

export { RESOLVE_MAXIMAL_EFFECT_COMMAND };

export interface ResolveMaximalEffectCommandParams {
  readonly playerId: string;
  /** Card ID of the action card to throw away */
  readonly cardId: CardId;
}

export function createResolveMaximalEffectCommand(
  params: ResolveMaximalEffectCommandParams
): Command {
  // Store previous state for undo
  let previousPendingMaximalEffect: PendingMaximalEffect | null = null;
  let previousHand: readonly CardId[] = [];
  let previousRemovedCards: readonly CardId[] = [];
  let previousPlayerSnapshot: Player | null = null;

  return {
    type: RESOLVE_MAXIMAL_EFFECT_COMMAND,
    playerId: params.playerId,
    // Not reversible: effect resolution may involve conditionals/choices
    isReversible: false,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      if (!player.pendingMaximalEffect) {
        throw new Error("No pending Maximal Effect to resolve");
      }

      const pending = player.pendingMaximalEffect;

      // Store for undo
      previousPendingMaximalEffect = pending;
      previousHand = player.hand;
      previousRemovedCards = player.removedCards;
      previousPlayerSnapshot = player;

      const events: GameEvent[] = [];

      // Validate card is eligible
      const eligibleCards = getCardsEligibleForMaximalEffect(
        player.hand,
        pending.sourceCardId
      );
      if (!eligibleCards.includes(params.cardId)) {
        throw new Error(
          `Card ${params.cardId} is not eligible for Maximal Effect (must be an action card in hand, not the Maximal Effect card itself)`
        );
      }

      // Look up the target card's definition
      const targetCard = getCard(params.cardId);
      if (!targetCard) {
        throw new Error(`Card definition not found for ${params.cardId}`);
      }

      // Get the appropriate effect based on effectKind
      const targetEffect: CardEffect =
        pending.effectKind === "basic"
          ? targetCard.basicEffect
          : targetCard.poweredEffect;

      // Remove card from hand
      const updatedHand = [...player.hand];
      const cardIndex = updatedHand.indexOf(params.cardId);
      if (cardIndex === -1) {
        throw new Error(`Card ${params.cardId} not found in hand`);
      }
      updatedHand.splice(cardIndex, 1);

      // Add to removedCards (permanent removal - throw away)
      const updatedRemovedCards = [...player.removedCards, params.cardId];

      // Emit card destroyed event (permanent removal)
      events.push({
        type: CARD_DESTROYED,
        playerId: params.playerId,
        cardId: params.cardId,
      });

      // Clear pending state and update hand/removedCards
      const updatedPlayer: Player = {
        ...player,
        hand: updatedHand,
        removedCards: updatedRemovedCards,
        pendingMaximalEffect: null,
      };

      let updatedState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
      };

      // Build compound effect: N copies of the target effect
      const multipliedEffects: CardEffect[] = Array.from(
        { length: pending.multiplier },
        () => targetEffect
      );
      const compoundEffect: CompoundEffect = {
        type: EFFECT_COMPOUND,
        effects: multipliedEffects,
      };

      // Resolve the compound effect
      // sourceCardId is the thrown-away card (for color-based effects like Fire/Ice)
      const result = resolveEffect(
        updatedState,
        params.playerId,
        compoundEffect,
        params.cardId
      );

      // Handle case where the target effect requires a choice (e.g., Rage basic = choice(attack, block))
      if (result.requiresChoice) {
        const choiceInfo = getChoiceOptionsFromEffect(result, compoundEffect);
        if (choiceInfo) {
          const source = {
            cardId: pending.sourceCardId,
            skillId: null,
            unitInstanceId: null,
          };

          const choiceResult = applyChoiceOutcome({
            state: result.state,
            playerId: params.playerId,
            playerIndex,
            options: choiceInfo.options,
            source,
            remainingEffects: choiceInfo.remainingEffects,
            resolveEffect: (s, id, effect) => resolveEffect(s, id, effect),
            handlers: {
              onNoOptions: (s) => ({
                state: s,
                events,
              }),
              onAutoResolved: (autoResult) => ({
                state: autoResult.state,
                events,
              }),
              onPendingChoice: (stateWithChoice, options) => ({
                state: stateWithChoice,
                events: [
                  ...events,
                  buildChoiceRequiredEvent(params.playerId, source, options),
                ],
              }),
            },
          });

          return {
            state: choiceResult.state,
            events: choiceResult.events,
          };
        }
      }

      return {
        state: result.state,
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      // Restore the full player snapshot since effect resolution may have
      // changed many fields (attack, block, move, mana, etc.)
      const restoredPlayer: Player = previousPlayerSnapshot ?? {
        ...player,
        hand: previousHand,
        removedCards: previousRemovedCards,
        pendingMaximalEffect: previousPendingMaximalEffect,
      };

      const newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? restoredPlayer : p
        ),
      };

      return {
        state: newState,
        events: [],
      };
    },
  };
}
