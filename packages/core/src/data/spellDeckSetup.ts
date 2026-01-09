/**
 * Spell deck setup utilities for Mage Knight
 *
 * Creates and shuffles the spell deck based on scenario configuration.
 * Populates the initial spell offer.
 */

import type { CardId } from "@mage-knight/shared";
import type { RngState } from "../utils/rng.js";
import { shuffleWithRng } from "../utils/rng.js";
import { getAllSpellCardIds } from "./spells.js";

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
