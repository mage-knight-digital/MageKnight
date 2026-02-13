/**
 * Tests that card boost (Concentration) correctly excludes cards whose
 * powered effects have unpayable discard costs.
 *
 * Bug: When a player has only Concentration + Improvisation (+ wounds),
 * Concentration should NOT be a valid action because Improvisation's
 * powered effect requires discarding a card, and after both Concentration
 * and Improvisation leave the hand there are no eligible cards to discard.
 */

import { describe, it, expect } from "vitest";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import { getEligibleBoostTargets } from "../effects/cardBoostEffects.js";
import { getPlayableCardsForNormalTurn } from "../validActions/cards/normalTurn.js";
import {
  CARD_CONCENTRATION,
  CARD_IMPROVISATION,
  CARD_MARCH,
  CARD_WOUND,
} from "@mage-knight/shared";

describe("Card Boost with discard cost cards", () => {
  describe("getEligibleBoostTargets", () => {
    it("should exclude cards whose powered effect has an unpayable discard cost", () => {
      // Hand: [Concentration, Improvisation]
      // After playing Concentration, only Improvisation remains.
      // Improvisation powered requires discarding 1 non-wound card,
      // but after Improvisation also leaves the hand, no cards remain.
      const player = createTestPlayer({
        hand: [CARD_CONCENTRATION, CARD_IMPROVISATION],
      });

      const eligible = getEligibleBoostTargets(player, CARD_CONCENTRATION);

      // Improvisation should NOT be eligible because its discard cost is unpayable
      expect(eligible.map((c) => c.id)).not.toContain(CARD_IMPROVISATION);
      expect(eligible).toHaveLength(0);
    });

    it("should exclude discard-cost cards when only wounds remain after boost", () => {
      // Hand: [Concentration, Improvisation, Wound]
      // After Concentration played: [Improvisation, Wound]
      // If Improvisation is picked: [Wound] - can't discard a non-wound card
      const player = createTestPlayer({
        hand: [CARD_CONCENTRATION, CARD_IMPROVISATION, CARD_WOUND],
      });

      const eligible = getEligibleBoostTargets(player, CARD_CONCENTRATION);

      expect(eligible.map((c) => c.id)).not.toContain(CARD_IMPROVISATION);
    });

    it("should include discard-cost cards when enough cards remain", () => {
      // Hand: [Concentration, Improvisation, March]
      // After Concentration played: [Improvisation, March]
      // If Improvisation is picked: [March] - can discard March
      const player = createTestPlayer({
        hand: [CARD_CONCENTRATION, CARD_IMPROVISATION, CARD_MARCH],
      });

      const eligible = getEligibleBoostTargets(player, CARD_CONCENTRATION);

      expect(eligible.map((c) => c.id)).toContain(CARD_IMPROVISATION);
      expect(eligible.map((c) => c.id)).toContain(CARD_MARCH);
    });

    it("should include cards without discard cost normally", () => {
      // March has no discard cost, so it's always eligible
      const player = createTestPlayer({
        hand: [CARD_CONCENTRATION, CARD_MARCH],
      });

      const eligible = getEligibleBoostTargets(player, CARD_CONCENTRATION);

      expect(eligible.map((c) => c.id)).toContain(CARD_MARCH);
    });
  });

  describe("valid actions integration", () => {
    it("should not show Concentration powered as playable when only discard-cost target exists", () => {
      // Hand: [Concentration, Improvisation]
      // Concentration powered should NOT be valid because the only boost target
      // (Improvisation) has an unpayable discard cost after both cards leave hand.
      const player = createTestPlayer({
        hand: [CARD_CONCENTRATION, CARD_IMPROVISATION],
        pureMana: [{ color: "green", source: "token" }], // Need green mana for powered
      });
      const state = createTestGameState({ players: [player] });

      const playableCards = getPlayableCardsForNormalTurn(state, state.players[0]);
      const concentration = playableCards.cards.find(
        (c) => c.cardId === CARD_CONCENTRATION
      );

      // Concentration should still be listed (can play basic/sideways)
      // but should NOT be playable powered
      expect(concentration?.canPlayPowered).toBe(false);
    });

    it("should show Concentration powered as playable when valid targets exist", () => {
      // Hand: [Concentration, March]
      // March has no discard cost, so it's a valid boost target
      const player = createTestPlayer({
        hand: [CARD_CONCENTRATION, CARD_MARCH],
        pureMana: [{ color: "green", source: "token" }],
      });
      const state = createTestGameState({ players: [player] });

      const playableCards = getPlayableCardsForNormalTurn(state, state.players[0]);
      const concentration = playableCards.cards.find(
        (c) => c.cardId === CARD_CONCENTRATION
      );

      expect(concentration?.canPlayPowered).toBe(true);
    });
  });
});
