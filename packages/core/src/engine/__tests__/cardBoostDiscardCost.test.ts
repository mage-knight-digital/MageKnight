/**
 * Tests that card boost (Concentration) correctly excludes cards whose
 * powered effects can't resolve after both source and target leave the hand.
 *
 * Two categories:
 * 1. Discard cost: Improvisation's powered effect requires discarding a card.
 * 2. Throw-away: Decompose/Maximal Effect/Book of Wisdom/Training require
 *    throwing away an action card, but the source card is excluded from
 *    eligibility — so if no other action cards remain, the effect can't resolve.
 */

import { describe, it, expect } from "vitest";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import { getEligibleBoostTargets } from "../effects/cardBoostEffects.js";
import { getPlayableCardsForNormalTurn } from "../validActions/cards/normalTurn.js";
import {
  CARD_CONCENTRATION,
  CARD_DECOMPOSE,
  CARD_IMPROVISATION,
  CARD_MARCH,
  CARD_MAXIMAL_EFFECT,
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

  // ==========================================================================
  // THROW-AWAY EFFECTS (Decompose, Maximal Effect, etc.)
  // ==========================================================================

  describe("getEligibleBoostTargets with throw-away effects", () => {
    it("should exclude Decompose when no action cards remain after boost", () => {
      // Hand: [Concentration, Decompose]
      // After Concentration played: [Decompose]
      // If Decompose is picked as boost target, its powered effect needs to
      // throw away an action card — but the only card was Decompose itself
      // (now in play area). No eligible targets → should not be offered.
      const player = createTestPlayer({
        hand: [CARD_CONCENTRATION, CARD_DECOMPOSE],
      });

      const eligible = getEligibleBoostTargets(player, CARD_CONCENTRATION);

      expect(eligible.map((c) => c.id)).not.toContain(CARD_DECOMPOSE);
      expect(eligible).toHaveLength(0);
    });

    it("should exclude Decompose when only wounds remain after boost", () => {
      // Hand: [Concentration, Decompose, Wound]
      // After Concentration played: [Decompose, Wound]
      // If Decompose is picked: hand has [Wound] — no action cards to throw away
      const player = createTestPlayer({
        hand: [CARD_CONCENTRATION, CARD_DECOMPOSE, CARD_WOUND],
      });

      const eligible = getEligibleBoostTargets(player, CARD_CONCENTRATION);

      expect(eligible.map((c) => c.id)).not.toContain(CARD_DECOMPOSE);
    });

    it("should include Decompose when enough action cards remain after boost", () => {
      // Hand: [Concentration, Decompose, March]
      // After Concentration played: [Decompose, March]
      // If Decompose is picked: hand has [March] — can throw away March
      const player = createTestPlayer({
        hand: [CARD_CONCENTRATION, CARD_DECOMPOSE, CARD_MARCH],
      });

      const eligible = getEligibleBoostTargets(player, CARD_CONCENTRATION);

      expect(eligible.map((c) => c.id)).toContain(CARD_DECOMPOSE);
      expect(eligible.map((c) => c.id)).toContain(CARD_MARCH);
    });

    it("should exclude Maximal Effect when no action cards remain after boost", () => {
      // Same pattern as Decompose: Maximal Effect's powered effect also
      // requires throwing away an action card
      const player = createTestPlayer({
        hand: [CARD_CONCENTRATION, CARD_MAXIMAL_EFFECT],
      });

      const eligible = getEligibleBoostTargets(player, CARD_CONCENTRATION);

      expect(eligible.map((c) => c.id)).not.toContain(CARD_MAXIMAL_EFFECT);
      expect(eligible).toHaveLength(0);
    });
  });

  describe("valid actions integration with throw-away effects", () => {
    it("should not show Concentration powered when only Decompose is boost target", () => {
      // Hand: [Concentration, Decompose]
      // No valid boost targets → Concentration powered should not be offered
      const player = createTestPlayer({
        hand: [CARD_CONCENTRATION, CARD_DECOMPOSE],
        pureMana: [{ color: "green", source: "token" }],
      });
      const state = createTestGameState({ players: [player] });

      const playableCards = getPlayableCardsForNormalTurn(state, state.players[0]);
      const concentration = playableCards.cards.find(
        (c) => c.cardId === CARD_CONCENTRATION
      );

      expect(concentration?.canPlayPowered).toBe(false);
    });
  });
});
