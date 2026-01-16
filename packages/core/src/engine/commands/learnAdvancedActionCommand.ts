/**
 * Learn Advanced Action command
 *
 * Handles learning an advanced action from the offer:
 * - Removes the advanced action from the offer (regular or monastery)
 * - Adds the advanced action to the player's discard pile
 * - Replenishes the offer from the deck (regular offer only)
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { CardId, GameEvent } from "@mage-knight/shared";
import {
  ADVANCED_ACTION_GAINED,
  OFFER_CARD_TAKEN,
  OFFER_TYPE_ADVANCED_ACTIONS,
  OFFER_REFRESHED,
} from "@mage-knight/shared";

export const LEARN_ADVANCED_ACTION_COMMAND = "LEARN_ADVANCED_ACTION" as const;

export interface LearnAdvancedActionCommandParams {
  readonly playerId: string;
  readonly cardId: CardId;
  readonly fromMonastery: boolean;
}

/**
 * Remove an advanced action from the regular offer and replenish from deck
 */
function removeAAAndReplenish(
  offers: GameState["offers"],
  decks: GameState["decks"],
  cardId: CardId
): { offers: GameState["offers"]; decks: GameState["decks"]; replenished: boolean } {
  // Remove from offer
  const newCards = offers.advancedActions.cards.filter((id) => id !== cardId);

  // Replenish from deck if available
  const aaDeck = decks.advancedActions;
  const newCard = aaDeck[0];

  if (newCard !== undefined) {
    // Add top card from deck to offer
    const remainingDeck = aaDeck.slice(1);

    return {
      offers: {
        ...offers,
        advancedActions: { cards: [...newCards, newCard] },
      },
      decks: {
        ...decks,
        advancedActions: remainingDeck,
      },
      replenished: true,
    };
  }

  return {
    offers: {
      ...offers,
      advancedActions: { cards: newCards },
    },
    decks,
    replenished: false,
  };
}

/**
 * Remove an advanced action from the monastery offer (no replenishment)
 */
function removeAAFromMonastery(
  offers: GameState["offers"],
  cardId: CardId
): GameState["offers"] {
  return {
    ...offers,
    monasteryAdvancedActions: offers.monasteryAdvancedActions.filter(
      (id) => id !== cardId
    ),
  };
}

export function createLearnAdvancedActionCommand(
  params: LearnAdvancedActionCommandParams
): Command {
  // Store previous state for undo
  let previousOffers: GameState["offers"] | null = null;
  let previousDecks: GameState["decks"] | null = null;
  let previousDiscard: readonly CardId[] = [];
  let previousHasTakenAction = false;

  return {
    type: LEARN_ADVANCED_ACTION_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Store previous state for undo
      previousOffers = state.offers;
      previousDecks = state.decks;
      previousDiscard = player.discard;
      previousHasTakenAction = player.hasTakenActionThisTurn;

      // Add advanced action to discard pile
      const updatedPlayer = {
        ...player,
        discard: [...player.discard, params.cardId],
        hasTakenActionThisTurn: true,
      };

      const players = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      let updatedOffers: GameState["offers"];
      let updatedDecks: GameState["decks"] = state.decks;
      let replenished = false;

      if (params.fromMonastery) {
        // Remove from monastery offer (no replenishment)
        updatedOffers = removeAAFromMonastery(state.offers, params.cardId);
      } else {
        // Remove from regular offer and replenish
        const result = removeAAAndReplenish(
          state.offers,
          state.decks,
          params.cardId
        );
        updatedOffers = result.offers;
        updatedDecks = result.decks;
        replenished = result.replenished;
      }

      const events: GameEvent[] = [
        {
          type: ADVANCED_ACTION_GAINED,
          playerId: params.playerId,
          cardId: params.cardId,
        },
        {
          type: OFFER_CARD_TAKEN,
          offerType: OFFER_TYPE_ADVANCED_ACTIONS,
          cardId: params.cardId,
        },
      ];

      if (replenished) {
        events.push({
          type: OFFER_REFRESHED,
          offerType: OFFER_TYPE_ADVANCED_ACTIONS,
        });
      }

      return {
        state: {
          ...state,
          players,
          offers: updatedOffers,
          decks: updatedDecks,
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

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Restore player state
      const updatedPlayer = {
        ...player,
        discard: previousDiscard,
        hasTakenActionThisTurn: previousHasTakenAction,
      };

      const players = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      return {
        state: {
          ...state,
          players,
          offers: previousOffers ?? state.offers,
          decks: previousDecks ?? state.decks,
        },
        events: [],
      };
    },
  };
}
