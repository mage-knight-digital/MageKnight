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

/**
 * Result of advanced action deck and offer initialization
 */
export interface AdvancedActionDeckSetupResult {
  readonly advancedActionDeck: readonly CardId[];
  readonly advancedActionOffer: readonly CardId[];
  readonly rng: RngState;
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
