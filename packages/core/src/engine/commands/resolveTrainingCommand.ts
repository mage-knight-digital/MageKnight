/**
 * Resolve Training Command
 *
 * Handles player resolution of a pending Training effect.
 * Two-phase resolution:
 *
 * Phase 1 (select_card): Player selects an action card to throw away.
 *   - Card is permanently removed from the game (added to removedCards)
 *   - Determines card color and filters matching AA offer cards
 *   - Transitions to phase 2 (select_from_offer)
 *
 * Phase 2 (select_from_offer): Player selects an AA from the offer.
 *   - Basic: AA goes to discard pile
 *   - Powered: AA goes to hand
 *   - Selected card removed from offer, offer replenished from deck
 *   - Pending state cleared
 *
 * This command is reversible since it's part of normal card play flow.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId, BasicManaColor } from "@mage-knight/shared";
import { CARD_DESTROYED, CARD_GAINED, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import type { Player, PendingTraining } from "../../types/player.js";
import type { BasicCardColor } from "../../types/effectTypes.js";
import { RESOLVE_TRAINING_COMMAND } from "./commandTypes.js";
import { getCardsEligibleForTraining } from "../effects/trainingEffects.js";
import { getActionCardColor } from "../helpers/cardColor.js";
import { getCard } from "../helpers/cardLookup.js";

export { RESOLVE_TRAINING_COMMAND };

export interface ResolveTrainingCommandParams {
  readonly playerId: string;
  /** Card ID: action card to throw away (phase 1) or AA from offer to gain (phase 2) */
  readonly cardId: CardId;
}

export function createResolveTrainingCommand(
  params: ResolveTrainingCommandParams
): Command {
  // Store previous state for undo
  let previousPendingTraining: PendingTraining | null = null;
  let previousHand: readonly CardId[] = [];
  let previousDiscard: readonly CardId[] = [];
  let previousRemovedCards: readonly CardId[] = [];
  let previousOfferCards: readonly CardId[] = [];
  let previousDeck: readonly CardId[] = [];
  let previousPhase: "select_card" | "select_from_offer" = "select_card";

  return {
    type: RESOLVE_TRAINING_COMMAND,
    playerId: params.playerId,
    isReversible: true,

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

      if (!player.pendingTraining) {
        throw new Error("No pending Training to resolve");
      }

      const pending = player.pendingTraining;
      previousPhase = pending.phase;

      if (pending.phase === "select_card") {
        return executePhase1(state, player, playerIndex, pending);
      } else {
        return executePhase2(state, player, playerIndex, pending);
      }
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

      if (previousPhase === "select_card") {
        // Undo phase 1: restore hand, removedCards, and pending state
        const restoredPlayer: Player = {
          ...player,
          hand: previousHand,
          removedCards: previousRemovedCards,
          pendingTraining: previousPendingTraining,
        };

        return {
          state: {
            ...state,
            players: state.players.map((p, i) =>
              i === playerIndex ? restoredPlayer : p
            ),
          },
          events: [],
        };
      } else {
        // Undo phase 2: restore hand, discard, offer, deck, and pending state
        const restoredPlayer: Player = {
          ...player,
          hand: previousHand,
          discard: previousDiscard,
          pendingTraining: previousPendingTraining,
        };

        return {
          state: {
            ...state,
            players: state.players.map((p, i) =>
              i === playerIndex ? restoredPlayer : p
            ),
            offers: {
              ...state.offers,
              advancedActions: { cards: previousOfferCards },
            },
            decks: {
              ...state.decks,
              advancedActions: previousDeck,
            },
          },
          events: [],
        };
      }
    },
  };

  // ============================================================================
  // PHASE 1: Select action card to throw away
  // ============================================================================

  function executePhase1(
    state: GameState,
    player: Player,
    playerIndex: number,
    pending: PendingTraining
  ): CommandResult {
    // Store for undo
    previousPendingTraining = pending;
    previousHand = player.hand;
    previousRemovedCards = player.removedCards;

    const events: GameEvent[] = [];

    // Validate card is eligible
    const eligibleCards = getCardsEligibleForTraining(player.hand, pending.sourceCardId);
    if (!eligibleCards.includes(params.cardId)) {
      throw new Error(
        `Card ${params.cardId} is not eligible for Training (must be an action card in hand, not the Training card itself)`
      );
    }

    // Remove card from hand
    const updatedHand = [...player.hand];
    const cardIndex = updatedHand.indexOf(params.cardId);
    if (cardIndex === -1) {
      throw new Error(`Card ${params.cardId} not found in hand`);
    }
    updatedHand.splice(cardIndex, 1);

    // Add to removedCards (permanent removal - throw away)
    const updatedRemovedCards = [...player.removedCards, params.cardId];

    // Emit card destroyed event
    events.push({
      type: CARD_DESTROYED,
      playerId: params.playerId,
      cardId: params.cardId,
    });

    // Get the action card color
    const cardColor = getActionCardColor(params.cardId);
    if (!cardColor) {
      throw new Error(`Card ${params.cardId} has no color (not an action card)`);
    }

    // Find matching AA cards in the offer
    const availableOfferCards = getMatchingAAOfferCards(state, cardColor);

    // If no matching cards in offer, clear pending (nothing to gain)
    if (availableOfferCards.length === 0) {
      const updatedPlayer: Player = {
        ...player,
        hand: updatedHand,
        removedCards: updatedRemovedCards,
        pendingTraining: null,
      };

      return {
        state: {
          ...state,
          players: state.players.map((p, i) =>
            i === playerIndex ? updatedPlayer : p
          ),
        },
        events,
      };
    }

    // Transition to phase 2
    const updatedPending: PendingTraining = {
      ...pending,
      phase: "select_from_offer",
      thrownCardColor: cardColor,
      availableOfferCards,
    };

    const updatedPlayer: Player = {
      ...player,
      hand: updatedHand,
      removedCards: updatedRemovedCards,
      pendingTraining: updatedPending,
    };

    return {
      state: {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
      },
      events,
    };
  }

  // ============================================================================
  // PHASE 2: Select AA from offer
  // ============================================================================

  function executePhase2(
    state: GameState,
    player: Player,
    playerIndex: number,
    pending: PendingTraining
  ): CommandResult {
    // Store for undo
    previousPendingTraining = pending;
    previousHand = player.hand;
    previousDiscard = player.discard;

    const events: GameEvent[] = [];
    const selectedCardId = params.cardId;

    // Validate card is in the available offer cards
    if (!pending.availableOfferCards.includes(selectedCardId)) {
      throw new Error(
        `Card ${selectedCardId} is not available in the AA offer for Training`
      );
    }

    const aaOffer = state.offers.advancedActions.cards;
    const offerIndex = aaOffer.indexOf(selectedCardId);
    if (offerIndex === -1) {
      throw new Error("Selected card not in advanced action offer");
    }

    // Store for undo
    previousOfferCards = aaOffer;
    previousDeck = state.decks.advancedActions;

    // Remove from offer
    const newOffer = [
      ...aaOffer.slice(0, offerIndex),
      ...aaOffer.slice(offerIndex + 1),
    ];

    // Replenish from deck if available
    let newDeck = state.decks.advancedActions;
    let finalOffer = newOffer;
    if (newDeck.length > 0) {
      const newCard = newDeck[0];
      if (newCard) {
        finalOffer = [...newOffer, newCard];
        newDeck = newDeck.slice(1);
      }
    }

    // Basic: AA to discard pile, Powered: AA to hand
    let updatedPlayer: Player;
    if (pending.mode === "basic") {
      updatedPlayer = {
        ...player,
        discard: [...player.discard, selectedCardId],
        pendingTraining: null,
      };
    } else {
      updatedPlayer = {
        ...player,
        hand: [...player.hand, selectedCardId],
        pendingTraining: null,
      };
    }

    events.push({
      type: CARD_GAINED,
      playerId: params.playerId,
      cardId: selectedCardId,
    });

    return {
      state: {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
        offers: {
          ...state.offers,
          advancedActions: { cards: finalOffer },
        },
        decks: {
          ...state.decks,
          advancedActions: newDeck,
        },
      },
      events,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get matching AA cards from the offer based on the thrown card's color.
 * Dual-color AAs match if EITHER color matches.
 */
function getMatchingAAOfferCards(
  state: GameState,
  cardColor: BasicCardColor
): CardId[] {
  return state.offers.advancedActions.cards.filter((cardId) => {
    const aaColor = getActionCardColor(cardId);
    if (aaColor === cardColor) return true;
    // Check if it's a dual-color card powered by this color
    return isDualColorMatch(cardId, cardColor);
  });
}

/**
 * Check if a card is a dual-color AA that matches via its secondary color.
 */
function isDualColorMatch(cardId: CardId, targetColor: BasicCardColor): boolean {
  const card = getCard(cardId);
  if (!card) return false;

  const manaColor = cardColorToManaColor(targetColor);
  return card.poweredBy.includes(manaColor);
}

/**
 * Convert card color to mana color.
 */
function cardColorToManaColor(cardColor: BasicCardColor): BasicManaColor {
  switch (cardColor) {
    case "red":
      return MANA_RED;
    case "blue":
      return MANA_BLUE;
    case "green":
      return MANA_GREEN;
    case "white":
      return MANA_WHITE;
    default:
      throw new Error(`Unknown card color: ${cardColor}`);
  }
}
