/**
 * Tests for Emerald Ring artifact (#222)
 *
 * Emerald Ring:
 * - Basic: Gain green mana token + green crystal + Fame +1
 * - Powered (green, destroy): Endless green and black mana this turn.
 *                             Fame +1 for each green spell cast this turn.
 *
 * FAQ S1: Black mana restrictions still apply (day/night rules).
 */

import { describe, it, expect } from "vitest";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import { EMERALD_RING_CARDS } from "../../data/artifacts/emeraldRing.js";
import {
  CARD_EMERALD_RING,
  MANA_GREEN,
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

describe("Emerald Ring Artifact", () => {
  describe("Card Definition", () => {
    it("should have correct card properties", () => {
      const card = EMERALD_RING_CARDS[CARD_EMERALD_RING];

      expect(card).toBeDefined();
      expect(card.id).toBe(CARD_EMERALD_RING);
      expect(card.name).toBe("Emerald Ring");
      expect(card.poweredBy).toEqual([MANA_GREEN]);
      expect(card.destroyOnPowered).toBe(true);
    });
  });

  describe("Basic Effect", () => {
    it("should gain green mana token, green crystal, and Fame +1", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 5,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const card = EMERALD_RING_CARDS[CARD_EMERALD_RING];
      const result = resolveEffect(state, "player1", card.basicEffect);

      const updatedPlayer = result.state.players[0];

      // Should have green mana token
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pureMana[0].color).toBe(MANA_GREEN);

      // Should have green crystal
      expect(updatedPlayer.crystals.green).toBe(1);

      // Should have +1 fame
      expect(updatedPlayer.fame).toBe(6);
    });
  });

  describe("Powered Effect", () => {
    it("should apply endless green and black mana modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({ players: [player] });

      const card = EMERALD_RING_CARDS[CARD_EMERALD_RING];
      const result = resolveEffect(state, "player1", card.poweredEffect);

      // Check modifier is applied
      expect(result.state.activeModifiers).toHaveLength(1);
      const modifier = result.state.activeModifiers[0];
      expect(modifier.effect.type).toBe(EFFECT_ENDLESS_MANA);

      // Check endless mana colors
      const endlessColors = getEndlessManaColors(result.state, "player1");
      expect(endlessColors.has(MANA_GREEN)).toBe(true);
      expect(endlessColors.has(MANA_BLACK)).toBe(true);
    });

    it("should provide endless green mana via query", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({ players: [player] });

      const card = EMERALD_RING_CARDS[CARD_EMERALD_RING];
      const result = resolveEffect(state, "player1", card.poweredEffect);

      expect(hasEndlessMana(result.state, "player1", MANA_GREEN)).toBe(true);
      expect(hasEndlessMana(result.state, "player1", MANA_BLACK)).toBe(true);
    });
  });

  describe("Ring Fame Bonus Calculation", () => {
    it("should grant no fame when no green spells were cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellsCastByColorThisTurn: {},
      });
      let state = createTestGameState({ players: [player] });

      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_GREEN, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_EMERALD_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(0);
      expect(result.player.fame).toBe(10);
    });

    it("should grant Fame +1 for one green spell cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_GREEN],
        spellsCastByColorThisTurn: { [MANA_GREEN]: 1 },
      });
      let state = createTestGameState({ players: [player] });

      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_GREEN, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_EMERALD_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(1);
      expect(result.player.fame).toBe(11);
    });

    it("should grant Fame +3 for three green spells cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_GREEN],
        spellsCastByColorThisTurn: { [MANA_GREEN]: 3 },
      });
      let state = createTestGameState({ players: [player] });

      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_GREEN, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_EMERALD_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(3);
      expect(result.player.fame).toBe(13);
    });

    it("should only count green spells, not other colors", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_GREEN, "red", "white"],
        spellsCastByColorThisTurn: { [MANA_GREEN]: 2, red: 3, white: 1 },
      });
      let state = createTestGameState({ players: [player] });

      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_GREEN, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_EMERALD_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      // Only 2 green spells should count
      expect(result.fameGained).toBe(2);
      expect(result.player.fame).toBe(12);
    });

    it("should not grant fame if no ring modifier is active", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_GREEN],
        spellsCastByColorThisTurn: { [MANA_GREEN]: 5 },
      });
      const state = createTestGameState({ players: [player] });

      // No ring modifier added

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(0);
      expect(result.player.fame).toBe(10);
    });
  });
});
