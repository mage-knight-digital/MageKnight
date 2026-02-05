/**
 * Tests for Ruby Ring artifact (#219)
 *
 * Ruby Ring:
 * - Basic: Gain red mana token + red crystal + Fame +1
 * - Powered (red, destroy): Endless red and black mana this turn.
 *                           Fame +1 for each red spell cast this turn.
 *
 * FAQ S1: Black mana restrictions still apply (day/night rules).
 */

import { describe, it, expect } from "vitest";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import { RUBY_RING_CARDS } from "../../data/artifacts/rubyRing.js";
import {
  CARD_RUBY_RING,
  MANA_RED,
  MANA_BLACK,
  MANA_WHITE,
  MANA_BLUE,
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

describe("Ruby Ring Artifact", () => {
  describe("Card Definition", () => {
    it("should have correct card properties", () => {
      const card = RUBY_RING_CARDS[CARD_RUBY_RING];

      expect(card).toBeDefined();
      expect(card.id).toBe(CARD_RUBY_RING);
      expect(card.name).toBe("Ruby Ring");
      expect(card.poweredBy).toEqual([MANA_RED]);
      expect(card.destroyOnPowered).toBe(true);
    });
  });

  describe("Basic Effect", () => {
    it("should gain red mana token, red crystal, and Fame +1", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 5,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const card = RUBY_RING_CARDS[CARD_RUBY_RING];
      const result = resolveEffect(state, "player1", card.basicEffect);

      const updatedPlayer = result.state.players[0];

      // Should have red mana token
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pureMana[0].color).toBe(MANA_RED);

      // Should have red crystal
      expect(updatedPlayer.crystals.red).toBe(1);

      // Should have +1 fame
      expect(updatedPlayer.fame).toBe(6);
    });
  });

  describe("Powered Effect", () => {
    it("should apply endless red and black mana modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({ players: [player] });

      const card = RUBY_RING_CARDS[CARD_RUBY_RING];
      const result = resolveEffect(state, "player1", card.poweredEffect);

      // Check modifier is applied
      expect(result.state.activeModifiers).toHaveLength(1);
      const modifier = result.state.activeModifiers[0];
      expect(modifier.effect.type).toBe(EFFECT_ENDLESS_MANA);

      // Check endless mana colors
      const endlessColors = getEndlessManaColors(result.state, "player1");
      expect(endlessColors.has(MANA_RED)).toBe(true);
      expect(endlessColors.has(MANA_BLACK)).toBe(true);
    });

    it("should provide endless red mana via query", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({ players: [player] });

      const card = RUBY_RING_CARDS[CARD_RUBY_RING];
      const result = resolveEffect(state, "player1", card.poweredEffect);

      expect(hasEndlessMana(result.state, "player1", MANA_RED)).toBe(true);
      expect(hasEndlessMana(result.state, "player1", MANA_BLACK)).toBe(true);
    });
  });

  describe("Ring Fame Bonus Calculation", () => {
    it("should grant no fame when no red spells were cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellsCastByColorThisTurn: {},
      });
      let state = createTestGameState({ players: [player] });

      // Add Ruby Ring's endless mana modifier
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_RED, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_RUBY_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(0);
      expect(result.player.fame).toBe(10);
    });

    it("should grant Fame +1 for one red spell cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_RED],
        spellsCastByColorThisTurn: { [MANA_RED]: 1 },
      });
      let state = createTestGameState({ players: [player] });

      // Add Ruby Ring's endless mana modifier
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_RED, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_RUBY_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(1);
      expect(result.player.fame).toBe(11);
    });

    it("should grant Fame +3 for three red spells cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_RED],
        spellsCastByColorThisTurn: { [MANA_RED]: 3 },
      });
      let state = createTestGameState({ players: [player] });

      // Add Ruby Ring's endless mana modifier
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_RED, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_RUBY_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(3);
      expect(result.player.fame).toBe(13);
    });

    it("should only count red spells, not other colors", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_RED, MANA_WHITE, MANA_BLUE],
        spellsCastByColorThisTurn: { [MANA_RED]: 2, [MANA_WHITE]: 3, [MANA_BLUE]: 1 },
      });
      let state = createTestGameState({ players: [player] });

      // Add Ruby Ring's endless mana modifier (red + black)
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_RED, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_RUBY_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      // Only 2 red spells should count
      expect(result.fameGained).toBe(2);
      expect(result.player.fame).toBe(12);
    });

    it("should not grant fame if no ring modifier is active", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_RED],
        spellsCastByColorThisTurn: { [MANA_RED]: 5 },
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
        spellsCastByColorThisTurn: { [MANA_RED]: 2 },
      });

      expect(player.spellsCastByColorThisTurn[MANA_RED]).toBe(2);
    });
  });
});
