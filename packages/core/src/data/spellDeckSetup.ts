/**
 * Spell deck setup utilities for Mage Knight
 *
 * Creates and shuffles the spell deck based on scenario configuration.
 * Populates the initial spell offer.
 */

import type { CardId } from "@mage-knight/shared";
import type { RngState } from "../utils/rng.js";
import { shuffleWithRng } from "../utils/rng.js";
import { getAllSpellCardIds } from "./spells/index.js";
import type { CardOffer } from "../types/offers.js";
import type { CardOfferRefreshResult } from "./advancedActionDeckSetup.js";

/**
 * Result of spell deck and offer initialization
 */
export interface SpellDeckSetupResult {
  readonly spellDeck: readonly CardId[];
  readonly spellOffer: readonly CardId[];
  readonly rng: RngState;
}

/**
 * Spell offer size (always 3 visible spells per rulebook)
 */
const SPELL_OFFER_SIZE = 3;

/**
 * Build the spell deck from spell definitions.
 * Each spell appears once in the deck.
 */
function buildSpellDeck(): CardId[] {
  return getAllSpellCardIds();
}

/**
 * Create spell deck and populate the initial spell offer.
 *
 * Per the rulebook:
 * - Shuffle the Spell deck
 * - Deal 3 cards face up as the Spell offer
 * - When a spell is taken, slide cards down and deal new card from deck
 *
 * @param rng - Seeded RNG state
 * @returns Spell deck (remaining), initial offer, and updated RNG state
 */
export function createSpellDeckAndOffer(rng: RngState): SpellDeckSetupResult {
  // Build and shuffle spell deck
  const deck = buildSpellDeck();
  const { result: shuffledDeck, rng: newRng } = shuffleWithRng(deck, rng);

  // Draw initial offer (3 spells)
  const spellOffer = shuffledDeck.slice(0, SPELL_OFFER_SIZE);
  const remainingDeck = shuffledDeck.slice(SPELL_OFFER_SIZE);

  return {
    spellDeck: remainingDeck,
    spellOffer,
    rng: newRng,
  };
}

/**
 * Refresh the Spell offer at the end of a round.
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
 * @param currentOffer - Current Spell offer
 * @param deck - Current Spell deck
 * @returns Updated offer and deck
 */
export function refreshSpellOffer(
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
