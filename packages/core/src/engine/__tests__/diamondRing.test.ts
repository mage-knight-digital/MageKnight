/**
 * Tests for Diamond Ring artifact (#221)
 *
 * Diamond Ring:
 * - Basic: Gain white mana token + white crystal + Fame +1
 * - Powered (white, destroy): Endless white and black mana this turn.
 *                             Fame +1 for each white spell cast this turn.
 *
 * FAQ S1: Black mana restrictions still apply (day/night rules).
 */

import { describe, it, expect } from "vitest";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import { DIAMOND_RING_CARDS } from "../../data/artifacts/diamondRing.js";
import {
  CARD_DIAMOND_RING,
  MANA_WHITE,
  MANA_BLACK,
} from "@mage-knight/shared";
import { resolveEffect } from "../effects/index.js";
import { getEndlessManaColors, hasEndlessMana } from "../modifiers/queries.js";
import { calculateRingFameBonus } from "../commands/endTurn/ringFameBonus.js";
import type { EndlessManaModifier } from "../../types/modifiers.js";
import {
  EFFECT_ENDLESS_MANA,
  DURATION_TURN,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { addModifier } from "../modifiers/lifecycle.js";

describe("Diamond Ring Artifact", () => {
  describe("Card Definition", () => {
    it("should have correct card properties", () => {
      const card = DIAMOND_RING_CARDS[CARD_DIAMOND_RING];

      expect(card).toBeDefined();
      expect(card.id).toBe(CARD_DIAMOND_RING);
      expect(card.name).toBe("Diamond Ring");
      expect(card.poweredBy).toEqual([MANA_WHITE]);
      expect(card.destroyOnPowered).toBe(true);
    });
  });

  describe("Basic Effect", () => {
    it("should gain white mana token, white crystal, and Fame +1", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 5,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const card = DIAMOND_RING_CARDS[CARD_DIAMOND_RING];
      const result = resolveEffect(state, "player1", card.basicEffect);

      const updatedPlayer = result.state.players[0];

      // Should have white mana token
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pureMana[0].color).toBe(MANA_WHITE);

      // Should have white crystal
      expect(updatedPlayer.crystals.white).toBe(1);

      // Should have +1 fame
      expect(updatedPlayer.fame).toBe(6);
    });
  });

  describe("Powered Effect", () => {
    it("should apply endless white and black mana modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({ players: [player] });

      const card = DIAMOND_RING_CARDS[CARD_DIAMOND_RING];
      const result = resolveEffect(state, "player1", card.poweredEffect);

      // Check modifier is applied
      expect(result.state.activeModifiers).toHaveLength(1);
      const modifier = result.state.activeModifiers[0];
      expect(modifier.effect.type).toBe(EFFECT_ENDLESS_MANA);

      // Check endless mana colors
      const endlessColors = getEndlessManaColors(result.state, "player1");
      expect(endlessColors.has(MANA_WHITE)).toBe(true);
      expect(endlessColors.has(MANA_BLACK)).toBe(true);
    });

    it("should provide endless white mana via query", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({ players: [player] });

      const card = DIAMOND_RING_CARDS[CARD_DIAMOND_RING];
      const result = resolveEffect(state, "player1", card.poweredEffect);

      expect(hasEndlessMana(result.state, "player1", MANA_WHITE)).toBe(true);
      expect(hasEndlessMana(result.state, "player1", MANA_BLACK)).toBe(true);
    });
  });

  describe("Ring Fame Bonus Calculation", () => {
    it("should grant no fame when no white spells were cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellsCastByColorThisTurn: {},
      });
      let state = createTestGameState({ players: [player] });

      // Add Diamond Ring's endless mana modifier
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_WHITE, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_DIAMOND_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(0);
      expect(result.player.fame).toBe(10);
    });

    it("should grant Fame +1 for one white spell cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_WHITE],
        spellsCastByColorThisTurn: { [MANA_WHITE]: 1 },
      });
      let state = createTestGameState({ players: [player] });

      // Add Diamond Ring's endless mana modifier
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_WHITE, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_DIAMOND_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(1);
      expect(result.player.fame).toBe(11);
    });

    it("should grant Fame +3 for three white spells cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_WHITE],
        spellsCastByColorThisTurn: { [MANA_WHITE]: 3 },
      });
      let state = createTestGameState({ players: [player] });

      // Add Diamond Ring's endless mana modifier
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_WHITE, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_DIAMOND_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(3);
      expect(result.player.fame).toBe(13);
    });

    it("should only count white spells, not other colors", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_WHITE, "red", "blue"],
        spellsCastByColorThisTurn: { [MANA_WHITE]: 2, red: 3, blue: 1 },
      });
      let state = createTestGameState({ players: [player] });

      // Add Diamond Ring's endless mana modifier (white + black)
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_WHITE, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_DIAMOND_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      // Only 2 white spells should count
      expect(result.fameGained).toBe(2);
      expect(result.player.fame).toBe(12);
    });

    it("should not grant fame if no ring modifier is active", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_WHITE],
        spellsCastByColorThisTurn: { [MANA_WHITE]: 5 },
      });
      const state = createTestGameState({ players: [player] });

      // No ring modifier added

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(0);
      expect(result.player.fame).toBe(10);
    });
  });

  describe("Spell Count Tracking", () => {
    it("should initialize spellsCastByColorThisTurn as empty", () => {
      const player = createTestPlayer({ id: "player1" });
      expect(player.spellsCastByColorThisTurn).toEqual({});
    });

    it("should track spell counts correctly", () => {
      const player = createTestPlayer({
        id: "player1",
        spellsCastByColorThisTurn: { [MANA_WHITE]: 2 },
      });

      expect(player.spellsCastByColorThisTurn[MANA_WHITE]).toBe(2);
    });
  });
});
