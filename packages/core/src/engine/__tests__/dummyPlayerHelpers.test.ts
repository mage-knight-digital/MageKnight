/**
 * Tests for dummy player helper functions
 */

import { describe, it, expect } from "vitest";
import {
  selectDummyHero,
  createDummyPlayer,
  precomputeDummyTurns,
  computeDummyTurnRange,
  executeDummyTurn,
  resetDummyForNewRound,
} from "../helpers/dummyPlayerHelpers.js";
import { Hero, HEROES } from "../../types/hero.js";
import { createRng } from "../../utils/rng.js";
import type { DummyPlayer } from "../../types/dummyPlayer.js";
import type { CardId, BasicManaColor } from "@mage-knight/shared";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  CARD_RAGE,
  CARD_MARCH,
  CARD_SWIFTNESS,
  CARD_STAMINA,
  CARD_DETERMINATION,
  CARD_TRANQUILITY,
  CARD_PROMISE,
  CARD_CRYSTALLIZE,
  CARD_IMPROVISATION,
} from "@mage-knight/shared";

describe("dummyPlayerHelpers", () => {
  const rng = createRng(42);

  describe("selectDummyHero", () => {
    it("should select a hero not in the used list", () => {
      const usedHeroes = [Hero.Arythea, Hero.Tovak];
      const { heroId } = selectDummyHero(usedHeroes, rng);

      expect(usedHeroes).not.toContain(heroId);
      expect(Object.values(Hero)).toContain(heroId);
    });

    it("should return a valid hero when only one is available", () => {
      const allExceptGoldyx = Object.values(Hero).filter(
        (h) => h !== Hero.Goldyx
      );
      const { heroId } = selectDummyHero(allExceptGoldyx, rng);

      expect(heroId).toBe(Hero.Goldyx);
    });

    it("should thread RNG state correctly", () => {
      const { rng: rng1 } = selectDummyHero([], rng);
      const { rng: rng2 } = selectDummyHero([], rng);

      // Same starting RNG produces same output RNG
      expect(rng1).toEqual(rng2);
    });
  });

  describe("createDummyPlayer", () => {
    it("should create a dummy player with 16 cards in the deck", () => {
      const { dummyPlayer } = createDummyPlayer(Hero.Arythea, rng);

      expect(dummyPlayer.heroId).toBe(Hero.Arythea);
      expect(dummyPlayer.deck.length).toBe(16);
      expect(dummyPlayer.discard).toEqual([]);
    });

    it("should initialize crystals from hero definition", () => {
      // Arythea: [red, red, white]
      const { dummyPlayer } = createDummyPlayer(Hero.Arythea, rng);

      expect(dummyPlayer.crystals[MANA_RED]).toBe(2);
      expect(dummyPlayer.crystals[MANA_WHITE]).toBe(1);
      expect(dummyPlayer.crystals[MANA_BLUE]).toBe(0);
      expect(dummyPlayer.crystals[MANA_GREEN]).toBe(0);
    });

    it("should initialize crystals correctly for Goldyx (blue, blue, white)", () => {
      const { dummyPlayer } = createDummyPlayer(Hero.Goldyx, rng);

      expect(dummyPlayer.crystals[MANA_BLUE]).toBe(2);
      expect(dummyPlayer.crystals[MANA_WHITE]).toBe(1);
      expect(dummyPlayer.crystals[MANA_RED]).toBe(0);
      expect(dummyPlayer.crystals[MANA_GREEN]).toBe(0);
    });

    it("should shuffle the deck (not match original order)", () => {
      // Run with multiple seeds to find one that shuffles differently
      const hero = HEROES[Hero.Arythea];
      let foundDifferent = false;
      for (let seed = 0; seed < 10; seed++) {
        const { dummyPlayer } = createDummyPlayer(Hero.Arythea, createRng(seed));
        const isIdentical = dummyPlayer.deck.every(
          (card, i) => card === hero.startingCards[i]
        );
        if (!isIdentical) {
          foundDifferent = true;
          break;
        }
      }
      expect(foundDifferent).toBe(true);
    });

    it("should pre-compute turns for the first round", () => {
      const { dummyPlayer } = createDummyPlayer(Hero.Arythea, rng);

      expect(dummyPlayer.precomputedTurns.length).toBeGreaterThan(0);
      expect(dummyPlayer.currentTurnIndex).toBe(0);
    });

    it("should thread RNG through shuffle", () => {
      const { rng: rng1 } = createDummyPlayer(Hero.Arythea, rng);
      const { rng: rng2 } = createDummyPlayer(Hero.Arythea, rng);

      expect(rng1).toEqual(rng2);
    });
  });

  describe("precomputeDummyTurns", () => {
    it("should flip 3 cards per turn with no crystal match", () => {
      // Use colorless cards to avoid crystal matches
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
        ] as readonly CardId[],
        discard: [],
        crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
        precomputedTurns: [],
        currentTurnIndex: 0,
      };

      const turns = precomputeDummyTurns(dummy);

      expect(turns).toHaveLength(2);
      expect(turns[0]!.cardsFlipped).toBe(3);
      expect(turns[0]!.bonusFlipped).toBe(0);
      expect(turns[0]!.matchedColor).toBeNull();
      expect(turns[0]!.deckRemainingAfter).toBe(3);
      expect(turns[1]!.cardsFlipped).toBe(3);
      expect(turns[1]!.deckRemainingAfter).toBe(0);
    });

    it("should flip bonus cards when last card color matches crystal", () => {
      // Rage is red, dummy has 2 red crystals
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_RAGE, // 3rd card is red → matches 2 red crystals
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
        ] as readonly CardId[],
        discard: [],
        crystals: { [MANA_RED]: 2, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
        precomputedTurns: [],
        currentTurnIndex: 0,
      };

      const turns = precomputeDummyTurns(dummy);

      expect(turns[0]!.cardsFlipped).toBe(3);
      expect(turns[0]!.bonusFlipped).toBe(2); // 2 red crystals → 2 bonus
      expect(turns[0]!.matchedColor).toBe(MANA_RED);
      expect(turns[0]!.deckRemainingAfter).toBe(4); // 9 - 3 - 2 = 4
    });

    it("should handle partial last turn when deck is not divisible by 3", () => {
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
        ] as readonly CardId[],
        discard: [],
        crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
        precomputedTurns: [],
        currentTurnIndex: 0,
      };

      const turns = precomputeDummyTurns(dummy);

      expect(turns).toHaveLength(2);
      expect(turns[0]!.cardsFlipped).toBe(3);
      expect(turns[1]!.cardsFlipped).toBe(1); // Only 1 card left
      expect(turns[1]!.deckRemainingAfter).toBe(0);
    });

    it("should return empty array for empty deck", () => {
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [],
        discard: [],
        crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
        precomputedTurns: [],
        currentTurnIndex: 0,
      };

      const turns = precomputeDummyTurns(dummy);
      expect(turns).toHaveLength(0);
    });

    it("should limit bonus flips to remaining cards", () => {
      // Red card at position 3, but only 1 card remains after the 3 base flips
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_RAGE, // red → 5 crystal match, but only 1 card left
          CARD_CRYSTALLIZE, // only this one card remains for bonus
        ] as readonly CardId[],
        discard: [],
        crystals: { [MANA_RED]: 5, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
        precomputedTurns: [],
        currentTurnIndex: 0,
      };

      const turns = precomputeDummyTurns(dummy);

      expect(turns[0]!.bonusFlipped).toBe(1); // Limited to 1 remaining card, not 5
      expect(turns[0]!.deckRemainingAfter).toBe(0);
    });

    it("should not match colorless cards (Crystallize, Improvisation)", () => {
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [
          CARD_RAGE,
          CARD_RAGE,
          CARD_CRYSTALLIZE, // last card is colorless
          CARD_RAGE,
          CARD_RAGE,
          CARD_RAGE,
        ] as readonly CardId[],
        discard: [],
        crystals: { [MANA_RED]: 3, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
        precomputedTurns: [],
        currentTurnIndex: 0,
      };

      const turns = precomputeDummyTurns(dummy);

      expect(turns[0]!.bonusFlipped).toBe(0);
      expect(turns[0]!.matchedColor).toBeNull();
    });

    it("should match green cards with green crystals", () => {
      // Tranquility is green
      const dummy: DummyPlayer = {
        heroId: Hero.Norowas,
        deck: [
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_TRANQUILITY, // green
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_CRYSTALLIZE,
        ] as readonly CardId[],
        discard: [],
        crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 2, [MANA_WHITE]: 0 },
        precomputedTurns: [],
        currentTurnIndex: 0,
      };

      const turns = precomputeDummyTurns(dummy);
      expect(turns[0]!.matchedColor).toBe(MANA_GREEN);
      expect(turns[0]!.bonusFlipped).toBe(2);
    });

    it("should match white cards with white crystals (Swiftness)", () => {
      // Swiftness is white
      const dummy: DummyPlayer = {
        heroId: Hero.Goldyx,
        deck: [
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_SWIFTNESS, // white
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_CRYSTALLIZE,
        ] as readonly CardId[],
        discard: [],
        crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 1 },
        precomputedTurns: [],
        currentTurnIndex: 0,
      };

      const turns = precomputeDummyTurns(dummy);
      expect(turns[0]!.matchedColor).toBe(MANA_WHITE);
      expect(turns[0]!.bonusFlipped).toBe(1);
    });

    it("should match white cards with white crystals", () => {
      // Promise is white
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_PROMISE, // white
          CARD_CRYSTALLIZE,
          CARD_IMPROVISATION,
          CARD_CRYSTALLIZE,
        ] as readonly CardId[],
        discard: [],
        crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 3 },
        precomputedTurns: [],
        currentTurnIndex: 0,
      };

      const turns = precomputeDummyTurns(dummy);
      expect(turns[0]!.matchedColor).toBe(MANA_WHITE);
      expect(turns[0]!.bonusFlipped).toBe(3);
    });
  });

  describe("computeDummyTurnRange", () => {
    it("should return 0/0 for empty deck", () => {
      const crystals = { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 };
      expect(computeDummyTurnRange(0, crystals)).toEqual({ min: 0, max: 0 });
    });

    it("should compute max as ceil(deckSize / 3)", () => {
      const crystals = { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 };

      expect(computeDummyTurnRange(16, crystals).max).toBe(6); // ceil(16/3) = 6
      expect(computeDummyTurnRange(9, crystals).max).toBe(3);
      expect(computeDummyTurnRange(3, crystals).max).toBe(1);
      expect(computeDummyTurnRange(1, crystals).max).toBe(1);
    });

    it("should compute min accounting for crystal bonus", () => {
      // 2 red crystals: max bonus = 2, so cards per turn = 3 + 2 = 5
      const crystals = { [MANA_RED]: 2, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 };

      // min = ceil(16 / 5) = 4
      expect(computeDummyTurnRange(16, crystals).min).toBe(4);
    });

    it("should use the largest crystal count for min estimate", () => {
      // 3 blue crystals is the max → cards per turn = 3 + 3 = 6
      const crystals = { [MANA_RED]: 1, [MANA_BLUE]: 3, [MANA_GREEN]: 2, [MANA_WHITE]: 0 };

      // min = ceil(16 / 6) = 3
      expect(computeDummyTurnRange(16, crystals).min).toBe(3);
    });

    it("should have min equal max with no crystals", () => {
      const crystals = { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 };
      const range = computeDummyTurnRange(9, crystals);
      expect(range.min).toBe(range.max);
    });
  });

  describe("executeDummyTurn", () => {
    it("should advance the turn index and move cards to discard", () => {
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS, CARD_STAMINA, CARD_DETERMINATION, CARD_TRANQUILITY] as readonly CardId[],
        discard: [],
        crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
        precomputedTurns: [
          { cardsFlipped: 3, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 3 },
          { cardsFlipped: 3, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 0 },
        ],
        currentTurnIndex: 0,
      };

      const { dummy: updated, turn } = executeDummyTurn(dummy);

      expect(turn).not.toBeNull();
      expect(turn!.cardsFlipped).toBe(3);
      expect(updated.currentTurnIndex).toBe(1);
      expect(updated.deck).toHaveLength(3);
      expect(updated.discard).toHaveLength(3);
      expect(updated.discard).toEqual([CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS]);
    });

    it("should move bonus cards to discard too", () => {
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS, CARD_STAMINA, CARD_DETERMINATION] as readonly CardId[],
        discard: [],
        crystals: { [MANA_RED]: 2, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
        precomputedTurns: [
          { cardsFlipped: 3, bonusFlipped: 2, matchedColor: MANA_GREEN, deckRemainingAfter: 0 },
        ],
        currentTurnIndex: 0,
      };

      const { dummy: updated } = executeDummyTurn(dummy);

      expect(updated.deck).toHaveLength(0);
      expect(updated.discard).toHaveLength(5); // 3 + 2 bonus
    });

    it("should return null turn when no pre-computed turns remain", () => {
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [],
        discard: [CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS] as readonly CardId[],
        crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
        precomputedTurns: [],
        currentTurnIndex: 0,
      };

      const { dummy: updated, turn } = executeDummyTurn(dummy);

      expect(turn).toBeNull();
      expect(updated).toBe(dummy); // No change
    });

    it("should return null turn when currentTurnIndex exceeds precomputedTurns", () => {
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [],
        discard: [],
        crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
        precomputedTurns: [
          { cardsFlipped: 3, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 0 },
        ],
        currentTurnIndex: 1, // Already past the only turn
      };

      const { turn } = executeDummyTurn(dummy);
      expect(turn).toBeNull();
    });
  });

  describe("resetDummyForNewRound", () => {
    it("should combine deck and discard, shuffle, and pre-compute turns", () => {
      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [CARD_RAGE, CARD_MARCH] as readonly CardId[],
        discard: [CARD_SWIFTNESS, CARD_STAMINA, CARD_DETERMINATION, CARD_TRANQUILITY] as readonly CardId[],
        crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
        precomputedTurns: [],
        currentTurnIndex: 5,
      };

      const { dummy: reset, rng: newRng } = resetDummyForNewRound(dummy, rng);

      expect(reset.deck).toHaveLength(6); // 2 + 4
      expect(reset.discard).toEqual([]);
      expect(reset.currentTurnIndex).toBe(0);
      expect(reset.precomputedTurns.length).toBeGreaterThan(0);
      expect(newRng).not.toEqual(rng);
    });

    it("should preserve crystals through reset", () => {
      const crystals: Record<BasicManaColor, number> = {
        [MANA_RED]: 3,
        [MANA_BLUE]: 1,
        [MANA_GREEN]: 0,
        [MANA_WHITE]: 2,
      };

      const dummy: DummyPlayer = {
        heroId: Hero.Arythea,
        deck: [CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS] as readonly CardId[],
        discard: [],
        crystals,
        precomputedTurns: [],
        currentTurnIndex: 0,
      };

      const { dummy: reset } = resetDummyForNewRound(dummy, rng);
      expect(reset.crystals).toEqual(crystals);
    });
  });
});
