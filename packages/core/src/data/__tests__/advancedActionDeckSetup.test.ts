/**
 * Advanced Action deck setup tests
 */

import { describe, it, expect } from "vitest";
import {
  createAdvancedActionDeckAndOffer,
  refreshAdvancedActionOffer,
} from "../advancedActionDeckSetup.js";
import { createRng } from "../../utils/rng.js";
import type { CardId } from "@mage-knight/shared";
import type { CardOffer } from "../../types/offers.js";

describe("createAdvancedActionDeckAndOffer", () => {
  it("should create AA deck and offer with 3 visible cards", () => {
    const rng = createRng(12345);

    const result = createAdvancedActionDeckAndOffer(rng);

    // Offer should have 3 cards
    expect(result.advancedActionOffer.length).toBe(3);

    // Deck should have remaining cards
    expect(result.advancedActionDeck.length).toBeGreaterThan(0);
  });

  it("should return deterministic results with same seed", () => {
    const rng1 = createRng(99999);
    const rng2 = createRng(99999);

    const result1 = createAdvancedActionDeckAndOffer(rng1);
    const result2 = createAdvancedActionDeckAndOffer(rng2);

    expect(result1.advancedActionOffer).toEqual(result2.advancedActionOffer);
    expect(result1.advancedActionDeck).toEqual(result2.advancedActionDeck);
  });
});

describe("refreshAdvancedActionOffer", () => {
  it("should remove bottom card and add new card at top", () => {
    // Create offer with known cards
    const offer: CardOffer = {
      cards: ["card_a" as CardId, "card_b" as CardId, "card_c" as CardId],
    };
    const deck: readonly CardId[] = ["card_d" as CardId, "card_e" as CardId];

    const result = refreshAdvancedActionOffer(offer, deck);

    // New card (card_d) should be at top (index 0)
    expect(result.offer.cards[0]).toBe("card_d");

    // Original top cards should have shifted down
    expect(result.offer.cards[1]).toBe("card_a");
    expect(result.offer.cards[2]).toBe("card_b");

    // Bottom card (card_c) should be removed from offer
    expect(result.offer.cards).not.toContain("card_c");

    // Deck should have remaining cards + bottom card at end
    expect(result.deck).toEqual(["card_e", "card_c"]);
  });

  it("should return unchanged if offer is empty", () => {
    const offer: CardOffer = { cards: [] };
    const deck: readonly CardId[] = ["card_a" as CardId];

    const result = refreshAdvancedActionOffer(offer, deck);

    expect(result.offer).toBe(offer);
    expect(result.deck).toBe(deck);
  });

  it("should handle empty deck by cycling bottom card to top", () => {
    const offer: CardOffer = {
      cards: ["card_a" as CardId, "card_b" as CardId, "card_c" as CardId],
    };
    const deck: readonly CardId[] = [];

    const result = refreshAdvancedActionOffer(offer, deck);

    // Bottom card goes to deck bottom, then is drawn to top
    expect(result.offer.cards[0]).toBe("card_c");
    expect(result.offer.cards[1]).toBe("card_a");
    expect(result.offer.cards[2]).toBe("card_b");
    expect(result.deck.length).toBe(0);
  });

  it("should handle offer with single card and empty deck", () => {
    const offer: CardOffer = { cards: ["card_a" as CardId] };
    const deck: readonly CardId[] = [];

    const result = refreshAdvancedActionOffer(offer, deck);

    // Same card cycles from bottom to top
    expect(result.offer.cards).toEqual(["card_a"]);
    expect(result.deck.length).toBe(0);
  });

  it("should maintain offer size when deck has cards", () => {
    const rng = createRng(12345);
    const initial = createAdvancedActionDeckAndOffer(rng);

    const offer: CardOffer = { cards: initial.advancedActionOffer };
    const result = refreshAdvancedActionOffer(offer, initial.advancedActionDeck);

    expect(result.offer.cards.length).toBe(3);
  });

  it("should put bottom card at end of deck", () => {
    const offer: CardOffer = {
      cards: ["card_a" as CardId, "card_b" as CardId, "card_c" as CardId],
    };
    const deck: readonly CardId[] = [
      "card_d" as CardId,
      "card_e" as CardId,
      "card_f" as CardId,
    ];

    const result = refreshAdvancedActionOffer(offer, deck);

    // card_c (bottom of offer) should now be at the end of deck
    expect(result.deck[result.deck.length - 1]).toBe("card_c");
  });
});
