/**
 * Buy Spell command
 *
 * Handles purchasing a spell from the spell offer at a conquered Mage Tower:
 * - Costs 7 influence points
 * - Removes the spell from the offer
 * - Adds the spell to the top of the player's deed deck
 * - Replenishes the offer from the spell deck
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { ActiveModifier } from "../../types/modifiers.js";
import type { CardId, GameEvent } from "@mage-knight/shared";
import {
  CARD_GAINED,
  CARD_GAIN_SOURCE_OFFER,
  OFFER_CARD_TAKEN,
  OFFER_TYPE_SPELLS,
  OFFER_REFRESHED,
} from "@mage-knight/shared";
import { SPELL_PURCHASE_COST } from "../../data/siteProperties.js";
import {
  getActiveInteractionBonus,
  getActiveInteractionBonusModifierIds,
} from "../rules/unitRecruitment.js";
import { applyChangeReputation, applyGainFame } from "../effects/atomicEffects.js";

export const BUY_SPELL_COMMAND = "BUY_SPELL" as const;

export interface BuySpellCommandParams {
  readonly playerId: string;
  readonly cardId: CardId;
}

/**
 * Remove a spell from the offer and replenish from deck
 */
function removeSpellAndReplenish(
  offers: GameState["offers"],
  decks: GameState["decks"],
  cardId: CardId
): { offers: GameState["offers"]; decks: GameState["decks"]; replenished: boolean } {
  // Remove from offer
  const newCards = offers.spells.cards.filter((id) => id !== cardId);

  // Replenish from deck if available
  const spellDeck = decks.spells;
  const newCard = spellDeck[0];

  if (newCard !== undefined) {
    // Add top card from deck to offer
    const remainingDeck = spellDeck.slice(1);

    return {
      offers: {
        ...offers,
        spells: { cards: [...newCards, newCard] },
      },
      decks: {
        ...decks,
        spells: remainingDeck,
      },
      replenished: true,
    };
  }

  return {
    offers: {
      ...offers,
      spells: { cards: newCards },
    },
    decks,
    replenished: false,
  };
}

export function createBuySpellCommand(params: BuySpellCommandParams): Command {
  // Store previous state for undo
  let previousOffers: GameState["offers"] | null = null;
  let previousDecks: GameState["decks"] | null = null;
  let previousDeck: readonly CardId[] = [];
  let previousInfluencePoints = 0;
  let previousHasTakenAction = false;
  let previousFame = 0;
  let previousReputation = 0;
  let previousPendingLevelUps: readonly number[] = [];
  let previousActiveModifiers: readonly ActiveModifier[] = [];

  return {
    type: BUY_SPELL_COMMAND,
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
      previousHasTakenAction = player.hasTakenActionThisTurn;
      previousFame = player.fame;
      previousReputation = player.reputation;
      previousPendingLevelUps = player.pendingLevelUps;
      previousActiveModifiers = state.activeModifiers;

      // Consume influence and add spell to top of deed deck (per game rules)
      const updatedPlayer = {
        ...player,
        influencePoints: player.influencePoints - SPELL_PURCHASE_COST,
        deck: [params.cardId, ...player.deck],
        hasTakenActionThisTurn: true,
      };

      const players = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      // Remove spell from offer and replenish
      const { offers, decks, replenished } = removeSpellAndReplenish(
        state.offers,
        state.decks,
        params.cardId
      );

      let updatedState: GameState = { ...state, players, offers, decks };

      // Check for active interaction bonus (Noble Manners)
      // Consumed on first interaction — only triggers once
      const interactionBonus = getActiveInteractionBonus(updatedState, params.playerId);
      if (interactionBonus) {
        const modifierIds = getActiveInteractionBonusModifierIds(updatedState, params.playerId);

        // Remove the interaction bonus modifiers (consumed)
        updatedState = {
          ...updatedState,
          activeModifiers: updatedState.activeModifiers.filter(
            (m) => !modifierIds.includes(m.id)
          ),
        };

        const ibPlayerIndex = updatedState.players.findIndex(
          (p) => p.id === params.playerId
        );
        const ibPlayer = updatedState.players[ibPlayerIndex];
        if (ibPlayer) {
          if (interactionBonus.fame > 0) {
            const fameResult = applyGainFame(
              updatedState,
              ibPlayerIndex,
              ibPlayer,
              interactionBonus.fame,
            );
            updatedState = fameResult.state;
          }

          if (interactionBonus.reputation !== 0) {
            const repPlayer = updatedState.players[ibPlayerIndex];
            if (repPlayer) {
              const repResult = applyChangeReputation(
                updatedState,
                ibPlayerIndex,
                repPlayer,
                interactionBonus.reputation,
              );
              updatedState = repResult.state;
            }
          }
        }
      }

      const events: GameEvent[] = [
        {
          type: CARD_GAINED,
          playerId: params.playerId,
          cardId: params.cardId,
          source: CARD_GAIN_SOURCE_OFFER,
        },
        {
          type: OFFER_CARD_TAKEN,
          offerType: OFFER_TYPE_SPELLS,
          cardId: params.cardId,
        },
      ];

      if (replenished) {
        events.push({
          type: OFFER_REFRESHED,
          offerType: OFFER_TYPE_SPELLS,
        });
      }

      return {
        state: updatedState,
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
        hasTakenActionThisTurn: previousHasTakenAction,
        fame: previousFame,
        reputation: previousReputation,
        pendingLevelUps: previousPendingLevelUps,
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
          activeModifiers: previousActiveModifiers,
        },
        events: [],
      };
    },
  };
}
