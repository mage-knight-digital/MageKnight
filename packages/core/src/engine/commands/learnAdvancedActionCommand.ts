/**
 * Learn Advanced Action command
 *
 * Handles learning an advanced action:
 * - Monastery AA: Bought at non-burned Monastery for 6 influence
 * - Regular AA: Gained as level-up reward (consumes pending reward)
 *
 * Both cases:
 * - Removes the AA from the offer
 * - Adds the AA to the top of the player's deed deck
 * - Replenishes the offer from the deck (regular offer only)
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { CardId, GameEvent, SiteReward } from "@mage-knight/shared";
import {
  ADVANCED_ACTION_GAINED,
  OFFER_CARD_TAKEN,
  OFFER_TYPE_ADVANCED_ACTIONS,
  OFFER_REFRESHED,
  SITE_REWARD_ADVANCED_ACTION,
} from "@mage-knight/shared";
import { MONASTERY_AA_PURCHASE_COST } from "../../data/siteProperties.js";

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

/**
 * Remove the first AA reward from pending rewards
 */
function consumeAAReward(
  pendingRewards: readonly SiteReward[]
): readonly SiteReward[] {
  const rewardIndex = pendingRewards.findIndex(
    (r) => r.type === SITE_REWARD_ADVANCED_ACTION
  );
  if (rewardIndex === -1) {
    return pendingRewards;
  }
  return [
    ...pendingRewards.slice(0, rewardIndex),
    ...pendingRewards.slice(rewardIndex + 1),
  ];
}

export function createLearnAdvancedActionCommand(
  params: LearnAdvancedActionCommandParams
): Command {
  // Store previous state for undo
  let previousOffers: GameState["offers"] | null = null;
  let previousDecks: GameState["decks"] | null = null;
  let previousDeck: readonly CardId[] = [];
  let previousInfluencePoints = 0;
  let previousPendingRewards: readonly SiteReward[] = [];
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
      previousDeck = player.deck;
      previousInfluencePoints = player.influencePoints;
      previousPendingRewards = player.pendingRewards;
      previousHasTakenAction = player.hasTakenActionThisTurn;

      // Base update: add AA to top of deed deck (per game rules)
      let updatedPlayer = {
        ...player,
        deck: [params.cardId, ...player.deck],
        hasTakenActionThisTurn: true,
      };

      if (params.fromMonastery) {
        // Monastery AA: consume influence
        updatedPlayer = {
          ...updatedPlayer,
          influencePoints: player.influencePoints - MONASTERY_AA_PURCHASE_COST,
        };
      } else {
        // Level-up AA: consume pending reward
        updatedPlayer = {
          ...updatedPlayer,
          pendingRewards: consumeAAReward(player.pendingRewards),
        };
      }

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
        deck: previousDeck,
        influencePoints: previousInfluencePoints,
        pendingRewards: previousPendingRewards,
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
