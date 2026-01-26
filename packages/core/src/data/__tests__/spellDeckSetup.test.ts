/**
 * Spell deck setup tests
 */

import { describe, it, expect } from "vitest";
import { createSpellDeckAndOffer, refreshSpellOffer } from "../spellDeckSetup.js";
import { createRng } from "../../utils/rng.js";
import type { CardId } from "@mage-knight/shared";
import type { CardOffer } from "../../types/offers.js";

describe("createSpellDeckAndOffer", () => {
  it("should create spell deck and offer with 3 visible cards", () => {
    const rng = createRng(12345);

    const result = createSpellDeckAndOffer(rng);

    // Offer should have 3 cards
    expect(result.spellOffer.length).toBe(3);

    // Deck should have remaining cards
    expect(result.spellDeck.length).toBeGreaterThan(0);
  });

  it("should return deterministic results with same seed", () => {
    const rng1 = createRng(99999);
    const rng2 = createRng(99999);

    const result1 = createSpellDeckAndOffer(rng1);
    const result2 = createSpellDeckAndOffer(rng2);

    expect(result1.spellOffer).toEqual(result2.spellOffer);
    expect(result1.spellDeck).toEqual(result2.spellDeck);
  });
});

describe("refreshSpellOffer", () => {
  it("should remove bottom card and add new card at top", () => {
    // Create offer with known cards
    const offer: CardOffer = {
      cards: ["spell_a" as CardId, "spell_b" as CardId, "spell_c" as CardId],
    };
    const deck: readonly CardId[] = ["spell_d" as CardId, "spell_e" as CardId];

    const result = refreshSpellOffer(offer, deck);

    // New card (spell_d) should be at top (index 0)
    expect(result.offer.cards[0]).toBe("spell_d");

    // Original top cards should have shifted down
    expect(result.offer.cards[1]).toBe("spell_a");
    expect(result.offer.cards[2]).toBe("spell_b");

    // Bottom card (spell_c) should be removed from offer
    expect(result.offer.cards).not.toContain("spell_c");

    // Deck should have remaining cards + bottom card at end
    expect(result.deck).toEqual(["spell_e", "spell_c"]);
  });

  it("should return unchanged if offer is empty", () => {
    const offer: CardOffer = { cards: [] };
    const deck: readonly CardId[] = ["spell_a" as CardId];

    const result = refreshSpellOffer(offer, deck);

    expect(result.offer).toBe(offer);
    expect(result.deck).toBe(deck);
  });

  it("should handle empty deck by cycling bottom card to top", () => {
    const offer: CardOffer = {
      cards: ["spell_a" as CardId, "spell_b" as CardId, "spell_c" as CardId],
    };
    const deck: readonly CardId[] = [];

    const result = refreshSpellOffer(offer, deck);

    // Bottom card goes to deck bottom, then is drawn to top
    expect(result.offer.cards[0]).toBe("spell_c");
    expect(result.offer.cards[1]).toBe("spell_a");
    expect(result.offer.cards[2]).toBe("spell_b");
    expect(result.deck.length).toBe(0);
  });

  it("should handle offer with single card and empty deck", () => {
    const offer: CardOffer = { cards: ["spell_a" as CardId] };
    const deck: readonly CardId[] = [];

    const result = refreshSpellOffer(offer, deck);

    // Same card cycles from bottom to top
    expect(result.offer.cards).toEqual(["spell_a"]);
    expect(result.deck.length).toBe(0);
  });

  it("should maintain offer size when deck has cards", () => {
    const rng = createRng(12345);
    const initial = createSpellDeckAndOffer(rng);

    const offer: CardOffer = { cards: initial.spellOffer };
    const result = refreshSpellOffer(offer, initial.spellDeck);

    expect(result.offer.cards.length).toBe(3);
  });

  it("should put bottom card at end of deck", () => {
    const offer: CardOffer = {
      cards: ["spell_a" as CardId, "spell_b" as CardId, "spell_c" as CardId],
    };
    const deck: readonly CardId[] = [
      "spell_d" as CardId,
      "spell_e" as CardId,
      "spell_f" as CardId,
    ];

    const result = refreshSpellOffer(offer, deck);

    // spell_c (bottom of offer) should now be at the end of deck
    expect(result.deck[result.deck.length - 1]).toBe("spell_c");
  });
});
