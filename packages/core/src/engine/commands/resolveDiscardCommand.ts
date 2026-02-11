/**
 * Resolve Discard Cost Command
 *
 * Handles player resolution of a pending discard cost (e.g., Improvisation).
 * When a card effect requires discarding cards as a cost before gaining
 * the benefit, this command processes the player's card selection.
 *
 * Flow:
 * 1. Card played creates pendingDiscard state via EFFECT_DISCARD_COST
 * 2. Player sends RESOLVE_DISCARD action with selected cardIds (or empty to skip if optional)
 * 3. This command validates selection, moves cards to discard, clears pendingDiscard
 * 4. Resolves the thenEffect to apply the card's benefit
 *
 * This command is reversible since it's part of normal card play flow.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId } from "@mage-knight/shared";
import { createCardDiscardedEvent } from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import { RESOLVE_DISCARD_COMMAND } from "./commandTypes.js";
import { resolveEffect } from "../effects/index.js";
import { getCardsEligibleForDiscardCost } from "../effects/discardEffects.js";
import { getActionCardColor } from "../helpers/cardColor.js";
import {
  getChoiceOptionsFromEffect,
  applyChoiceOutcome,
  buildChoiceRequiredEvent,
} from "./choice/choiceResolution.js";

export { RESOLVE_DISCARD_COMMAND };

export interface ResolveDiscardCommandParams {
  readonly playerId: string;
  /** Card IDs to discard. Length must match pendingDiscard.count, or be empty if skipping (when optional). */
  readonly cardIds: readonly CardId[];
}

export function createResolveDiscardCommand(
  params: ResolveDiscardCommandParams
): Command {
  // Store previous state for undo
  let previousPendingDiscard: Player["pendingDiscard"] = null;
  let previousHand: readonly CardId[] = [];
  let previousDiscard: readonly CardId[] = [];
  let previousPlayedCardFromHandThisTurn = false;

  return {
    type: RESOLVE_DISCARD_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Part of normal card play flow

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

      if (!player.pendingDiscard) {
        throw new Error("No pending discard cost to resolve");
      }

      const pendingDiscard = player.pendingDiscard;

      // Store for undo
      previousPendingDiscard = pendingDiscard;
      previousHand = player.hand;
      previousDiscard = player.discard;
      previousPlayedCardFromHandThisTurn = player.playedCardFromHandThisTurn;

      const events: GameEvent[] = [];

      // Check if player is skipping (empty cardIds with optional discard)
      if (params.cardIds.length === 0) {
        if (!pendingDiscard.optional) {
          throw new Error(
            "Cannot skip discard: discard is required (not optional)"
          );
        }

        // Clear pending discard and don't resolve thenEffect (skipped the cost)
        const updatedPlayer: Player = {
          ...player,
          pendingDiscard: null,
        };

        const newState: GameState = {
          ...state,
          players: state.players.map((p, i) =>
            i === playerIndex ? updatedPlayer : p
          ),
        };

        return {
          state: newState,
          events: [],
        };
      }

      // Validate card count
      if (params.cardIds.length !== pendingDiscard.count) {
        throw new Error(
          `Expected ${pendingDiscard.count} card(s) to discard, got ${params.cardIds.length}`
        );
      }

      // Validate all cards are eligible
      const eligibleCards = getCardsEligibleForDiscardCost(
        player.hand,
        pendingDiscard.filterWounds,
        pendingDiscard.colorMatters ?? false,
        pendingDiscard.allowNoColor ?? false
      );
      for (const cardId of params.cardIds) {
        if (!eligibleCards.includes(cardId)) {
          throw new Error(
            `Card ${cardId} is not eligible for discard (either not in hand or filtered out)`
          );
        }
      }

      // Move cards from hand to discard pile
      const updatedHand = [...player.hand];
      const discardedCards: CardId[] = [];

      for (const cardId of params.cardIds) {
        const index = updatedHand.indexOf(cardId);
        if (index === -1) {
          throw new Error(`Card ${cardId} not found in hand`);
        }
        updatedHand.splice(index, 1);
        discardedCards.push(cardId);

        // Emit discard event for each card
        events.push(createCardDiscardedEvent(params.playerId, cardId));
      }

      const updatedDiscardPile = [...player.discard, ...discardedCards];

      // Clear pending discard
      const updatedPlayer: Player = {
        ...player,
        hand: updatedHand,
        discard: updatedDiscardPile,
        pendingDiscard: null,
        playedCardFromHandThisTurn:
          player.playedCardFromHandThisTurn ||
          pendingDiscard.satisfiesMinimumTurnRequirementOnResolve === true,
      };

      let newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
      };

      // Now resolve the thenEffect since the cost was paid
      let thenEffect = pendingDiscard.thenEffect;
      if (pendingDiscard.colorMatters) {
        if (params.cardIds.length !== 1) {
          throw new Error("DiscardCostEffect with colorMatters requires exactly one discarded card");
        }
        const discardedCardId = params.cardIds[0];
        if (!discardedCardId) {
          throw new Error("Expected a discarded card ID");
        }
        const color = getActionCardColor(discardedCardId);
        if (!color) {
          if (pendingDiscard.allowNoColor) {
            // Card has no action color (artifact/spell) — discard happens but no effect
            return {
              state: newState,
              events,
            };
          }
          throw new Error(`Discarded card ${discardedCardId} is not a valid action card color`);
        }
        const colorEffect = pendingDiscard.thenEffectByColor?.[color];
        if (!colorEffect) {
          throw new Error(`No color-matched effect defined for ${color}`);
        }
        thenEffect = colorEffect;
      }

      const effectResult = resolveEffect(
        newState,
        params.playerId,
        thenEffect,
        pendingDiscard.sourceCardId
      );

      newState = effectResult.state;

      // Handle case where thenEffect requires a choice (e.g., Druidic Staff blue effect)
      if (effectResult.requiresChoice) {
        const choiceInfo = getChoiceOptionsFromEffect(effectResult, thenEffect);
        if (choiceInfo) {
          const source = {
            cardId: pendingDiscard.sourceCardId,
            skillId: null,
            unitInstanceId: null,
          };

          const choiceResult = applyChoiceOutcome({
            state: newState,
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
        state: newState,
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

      // Restore previous state
      const restoredPlayer: Player = {
        ...player,
        hand: previousHand,
        discard: previousDiscard,
        pendingDiscard: previousPendingDiscard,
        playedCardFromHandThisTurn: previousPlayedCardFromHandThisTurn,
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
