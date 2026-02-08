/**
 * Tests for dummy player offer gains at end of round
 */

import { describe, it, expect } from "vitest";
import { processDummyOfferGains } from "../commands/endRound/dummyOfferGains.js";
import type { DummyPlayer } from "../../types/dummyPlayer.js";
import type { CardOffer } from "../../types/offers.js";
import type { CardId } from "@mage-knight/shared";
import {
  DUMMY_GAINED_CARD,
  DUMMY_GAINED_CRYSTAL,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  CARD_RAGE,
  CARD_MARCH,
  CARD_SWIFTNESS,
  CARD_FIREBALL,
  CARD_SNOWSTORM,
  CARD_RESTORATION,
  CARD_WHIRLWIND,
} from "@mage-knight/shared";

function createTestDummy(overrides: Partial<DummyPlayer> = {}): DummyPlayer {
  return {
    heroId: "arythea" as DummyPlayer["heroId"],
    deck: [],
    discard: [],
    crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
    precomputedTurns: [],
    currentTurnIndex: 0,
    ...overrides,
  };
}

describe("processDummyOfferGains", () => {
  describe("Advanced Action offer", () => {
    it("should extract the bottom AA card and add to dummy discard", () => {
      const dummy = createTestDummy();
      const aaOffer: CardOffer = {
        cards: [CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS] as readonly CardId[],
      };
      const spellOffer: CardOffer = { cards: [] };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      expect(result.dummyPlayer.discard).toEqual([CARD_SWIFTNESS]);
      expect(result.advancedActionOffer.cards).toEqual([CARD_RAGE, CARD_MARCH]);
    });

    it("should emit DUMMY_GAINED_CARD event", () => {
      const dummy = createTestDummy();
      const aaOffer: CardOffer = {
        cards: [CARD_RAGE, CARD_MARCH] as readonly CardId[],
      };
      const spellOffer: CardOffer = { cards: [] };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DUMMY_GAINED_CARD,
          cardId: CARD_MARCH,
        })
      );
    });

    it("should handle empty AA offer gracefully", () => {
      const dummy = createTestDummy();
      const aaOffer: CardOffer = { cards: [] };
      const spellOffer: CardOffer = { cards: [] };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      expect(result.dummyPlayer.discard).toEqual([]);
      expect(result.advancedActionOffer.cards).toEqual([]);
      expect(result.events).not.toContainEqual(
        expect.objectContaining({ type: DUMMY_GAINED_CARD })
      );
    });

    it("should handle single-card AA offer", () => {
      const dummy = createTestDummy();
      const aaOffer: CardOffer = {
        cards: [CARD_RAGE] as readonly CardId[],
      };
      const spellOffer: CardOffer = { cards: [] };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      expect(result.dummyPlayer.discard).toEqual([CARD_RAGE]);
      expect(result.advancedActionOffer.cards).toEqual([]);
    });
  });

  describe("Spell offer crystal gain", () => {
    it("should gain a red crystal from a red spell", () => {
      const dummy = createTestDummy();
      const aaOffer: CardOffer = { cards: [] };
      const spellOffer: CardOffer = {
        cards: [CARD_SNOWSTORM, CARD_FIREBALL] as readonly CardId[], // bottom is red
      };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      expect(result.dummyPlayer.crystals[MANA_RED]).toBe(1);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DUMMY_GAINED_CRYSTAL,
          color: MANA_RED,
        })
      );
    });

    it("should gain a blue crystal from a blue spell", () => {
      const dummy = createTestDummy();
      const aaOffer: CardOffer = { cards: [] };
      const spellOffer: CardOffer = {
        cards: [CARD_FIREBALL, CARD_SNOWSTORM] as readonly CardId[], // bottom is blue
      };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      expect(result.dummyPlayer.crystals[MANA_BLUE]).toBe(1);
    });

    it("should gain a green crystal from a green spell", () => {
      const dummy = createTestDummy();
      const aaOffer: CardOffer = { cards: [] };
      const spellOffer: CardOffer = {
        cards: [CARD_FIREBALL, CARD_RESTORATION] as readonly CardId[], // Restoration is green
      };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      expect(result.dummyPlayer.crystals[MANA_GREEN]).toBe(1);
    });

    it("should gain a white crystal from a white spell", () => {
      const dummy = createTestDummy();
      const aaOffer: CardOffer = { cards: [] };
      const spellOffer: CardOffer = {
        cards: [CARD_FIREBALL, CARD_WHIRLWIND] as readonly CardId[], // Whirlwind is white
      };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      expect(result.dummyPlayer.crystals[MANA_WHITE]).toBe(1);
    });

    it("should accumulate crystals beyond 3 (no cap)", () => {
      const dummy = createTestDummy({
        crystals: { [MANA_RED]: 5, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
      });
      const aaOffer: CardOffer = { cards: [] };
      const spellOffer: CardOffer = {
        cards: [CARD_SNOWSTORM, CARD_FIREBALL] as readonly CardId[],
      };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      expect(result.dummyPlayer.crystals[MANA_RED]).toBe(6);
    });

    it("should handle empty spell offer gracefully", () => {
      const dummy = createTestDummy();
      const aaOffer: CardOffer = { cards: [] };
      const spellOffer: CardOffer = { cards: [] };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      expect(result.dummyPlayer.crystals[MANA_RED]).toBe(0);
      expect(result.events).not.toContainEqual(
        expect.objectContaining({ type: DUMMY_GAINED_CRYSTAL })
      );
    });

    it("should not modify spell offer (normal refresh handles it)", () => {
      const dummy = createTestDummy();
      const aaOffer: CardOffer = { cards: [] };
      const spellOffer: CardOffer = {
        cards: [CARD_FIREBALL, CARD_SNOWSTORM] as readonly CardId[],
      };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      // Spell offer is returned as-is (not modified by this function)
      expect(result.spellOffer.cards).toEqual(spellOffer.cards);
    });
  });

  describe("combined AA and spell", () => {
    it("should process both AA and spell gains in one call", () => {
      const dummy = createTestDummy();
      const aaOffer: CardOffer = {
        cards: [CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS] as readonly CardId[],
      };
      const spellOffer: CardOffer = {
        cards: [CARD_SNOWSTORM, CARD_FIREBALL] as readonly CardId[],
      };

      const result = processDummyOfferGains(dummy, aaOffer, spellOffer);

      // AA gain
      expect(result.dummyPlayer.discard).toEqual([CARD_SWIFTNESS]);
      expect(result.advancedActionOffer.cards).toEqual([CARD_RAGE, CARD_MARCH]);
      // Crystal gain
      expect(result.dummyPlayer.crystals[MANA_RED]).toBe(1);
      // Both events
      expect(result.events).toHaveLength(2);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: DUMMY_GAINED_CARD })
      );
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: DUMMY_GAINED_CRYSTAL })
      );
    });
  });
});
