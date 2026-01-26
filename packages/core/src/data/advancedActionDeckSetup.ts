/**
 * Advanced Action deck setup utilities for Mage Knight
 *
 * Creates and shuffles the advanced action deck based on scenario configuration.
 * Populates the initial advanced action offer.
 */

import type { CardId } from "@mage-knight/shared";
import type { RngState } from "../utils/rng.js";
import { shuffleWithRng } from "../utils/rng.js";
import { getAllAdvancedActionCardIds } from "./advancedActions/index.js";
import type { CardOffer } from "../types/offers.js";

/**
 * Result of advanced action deck and offer initialization
 */
export interface AdvancedActionDeckSetupResult {
  readonly advancedActionDeck: readonly CardId[];
  readonly advancedActionOffer: readonly CardId[];
  readonly rng: RngState;
}

/**
 * Result of refreshing a card offer (Advanced Actions or Spells)
 */
export interface CardOfferRefreshResult {
  readonly offer: CardOffer;
  readonly deck: readonly CardId[];
}

/**
 * Advanced action offer size (always 3 visible per rulebook)
 */
const ADVANCED_ACTION_OFFER_SIZE = 3;

/**
 * Build the advanced action deck from card definitions.
 * Each advanced action appears once in the deck.
 */
function buildAdvancedActionDeck(): CardId[] {
  return getAllAdvancedActionCardIds();
}

/**
 * Create advanced action deck and populate the initial offer.
 *
 * Per the rulebook:
 * - Shuffle the Advanced Action deck
 * - Deal 3 cards face up as the Advanced Action offer
 * - When an AA is taken, slide cards down and deal new card from deck
 *
 * @param rng - Seeded RNG state
 * @returns AA deck (remaining), initial offer, and updated RNG state
 */
export function createAdvancedActionDeckAndOffer(rng: RngState): AdvancedActionDeckSetupResult {
  // Build and shuffle advanced action deck
  const deck = buildAdvancedActionDeck();
  const { result: shuffledDeck, rng: newRng } = shuffleWithRng(deck, rng);

  // Draw initial offer (3 advanced actions)
  const advancedActionOffer = shuffledDeck.slice(0, ADVANCED_ACTION_OFFER_SIZE);
  const remainingDeck = shuffledDeck.slice(ADVANCED_ACTION_OFFER_SIZE);

  return {
    advancedActionDeck: remainingDeck,
    advancedActionOffer,
    rng: newRng,
  };
}

/**
 * Refresh the Advanced Action offer at the end of a round.
 *
 * Per the rulebook:
 * "Remove the lowest position card in the offer and put it on the bottom of the deck.
 * Move each other card down one position in the offer, then draw a new card from the
 * deck and add it to the top position."
 *
 * In our CardOffer structure:
 * - index 0 = top (newest)
 * - last index = bottom (oldest, to be removed)
 *
 * @param currentOffer - Current Advanced Action offer
 * @param deck - Current Advanced Action deck
 * @returns Updated offer and deck
 */
export function refreshAdvancedActionOffer(
  currentOffer: CardOffer,
  deck: readonly CardId[]
): CardOfferRefreshResult {
  // If offer is empty, no-op
  if (currentOffer.cards.length === 0) {
    return { offer: currentOffer, deck };
  }

  // Remove bottom card (last index) from offer
  const bottomCard = currentOffer.cards[currentOffer.cards.length - 1];
  const remainingOfferCards = currentOffer.cards.slice(0, -1);

  // Put removed card on bottom of deck
  const deckWithBottom =
    bottomCard !== undefined ? [...deck, bottomCard] : [...deck];

  // Draw top card from deck (if available)
  if (deckWithBottom.length === 0) {
    // No cards in deck - offer shrinks by one
    return {
      offer: { cards: remainingOfferCards },
      deck: [],
    };
  }

  const [drawnCard, ...remainingDeck] = deckWithBottom;

  // Insert drawn card at top (index 0) of offer
  const newOfferCards =
    drawnCard !== undefined
      ? [drawnCard, ...remainingOfferCards]
      : remainingOfferCards;

  return {
    offer: { cards: newOfferCards },
    deck: remainingDeck,
  };
}
