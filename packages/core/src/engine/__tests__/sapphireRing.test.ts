/**
 * Tests for Sapphire Ring artifact (#220)
 *
 * Sapphire Ring:
 * - Basic: Gain blue mana token + blue crystal + Fame +1
 * - Powered (blue, destroy): Endless blue and black mana this turn.
 *                            Fame +1 for each blue spell cast this turn.
 *
 * FAQ S1: Black mana restrictions still apply (day/night rules).
 */

import { describe, it, expect } from "vitest";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import { SAPPHIRE_RING_CARDS } from "../../data/artifacts/sapphireRing.js";
import {
  CARD_SAPPHIRE_RING,
  MANA_BLUE,
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

describe("Sapphire Ring Artifact", () => {
  describe("Card Definition", () => {
    it("should have correct card properties", () => {
      const card = SAPPHIRE_RING_CARDS[CARD_SAPPHIRE_RING];

      expect(card).toBeDefined();
      expect(card.id).toBe(CARD_SAPPHIRE_RING);
      expect(card.name).toBe("Sapphire Ring");
      expect(card.poweredBy).toEqual([MANA_BLUE]);
      expect(card.destroyOnPowered).toBe(true);
    });
  });

  describe("Basic Effect", () => {
    it("should gain blue mana token, blue crystal, and Fame +1", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 5,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const card = SAPPHIRE_RING_CARDS[CARD_SAPPHIRE_RING];
      const result = resolveEffect(state, "player1", card.basicEffect);

      const updatedPlayer = result.state.players[0];

      // Should have blue mana token
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pureMana[0].color).toBe(MANA_BLUE);

      // Should have blue crystal
      expect(updatedPlayer.crystals.blue).toBe(1);

      // Should have +1 fame
      expect(updatedPlayer.fame).toBe(6);
    });
  });

  describe("Powered Effect", () => {
    it("should apply endless blue and black mana modifier", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({ players: [player] });

      const card = SAPPHIRE_RING_CARDS[CARD_SAPPHIRE_RING];
      const result = resolveEffect(state, "player1", card.poweredEffect);

      // Check modifier is applied
      expect(result.state.activeModifiers).toHaveLength(1);
      const modifier = result.state.activeModifiers[0];
      expect(modifier.effect.type).toBe(EFFECT_ENDLESS_MANA);

      // Check endless mana colors
      const endlessColors = getEndlessManaColors(result.state, "player1");
      expect(endlessColors.has(MANA_BLUE)).toBe(true);
      expect(endlessColors.has(MANA_BLACK)).toBe(true);
    });

    it("should provide endless blue mana via query", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({ players: [player] });

      const card = SAPPHIRE_RING_CARDS[CARD_SAPPHIRE_RING];
      const result = resolveEffect(state, "player1", card.poweredEffect);

      expect(hasEndlessMana(result.state, "player1", MANA_BLUE)).toBe(true);
      expect(hasEndlessMana(result.state, "player1", MANA_BLACK)).toBe(true);
    });
  });

  describe("Ring Fame Bonus Calculation", () => {
    it("should grant no fame when no blue spells were cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellsCastByColorThisTurn: {},
      });
      let state = createTestGameState({ players: [player] });

      // Add Sapphire Ring's endless mana modifier
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_BLUE, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_SAPPHIRE_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(0);
      expect(result.player.fame).toBe(10);
    });

    it("should grant Fame +1 for one blue spell cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_BLUE],
        spellsCastByColorThisTurn: { [MANA_BLUE]: 1 },
      });
      let state = createTestGameState({ players: [player] });

      // Add Sapphire Ring's endless mana modifier
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_BLUE, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_SAPPHIRE_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(1);
      expect(result.player.fame).toBe(11);
    });

    it("should grant Fame +3 for three blue spells cast", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_BLUE],
        spellsCastByColorThisTurn: { [MANA_BLUE]: 3 },
      });
      let state = createTestGameState({ players: [player] });

      // Add Sapphire Ring's endless mana modifier
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_BLUE, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_SAPPHIRE_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      expect(result.fameGained).toBe(3);
      expect(result.player.fame).toBe(13);
    });

    it("should only count blue spells, not other colors", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_BLUE, "red", "white"],
        spellsCastByColorThisTurn: { [MANA_BLUE]: 2, red: 3, white: 1 },
      });
      let state = createTestGameState({ players: [player] });

      // Add Sapphire Ring's endless mana modifier (blue + black)
      const endlessManaEffect: EndlessManaModifier = {
        type: EFFECT_ENDLESS_MANA,
        colors: [MANA_BLUE, MANA_BLACK],
      };

      state = addModifier(state, {
        effect: endlessManaEffect,
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        source: { type: SOURCE_CARD, cardId: CARD_SAPPHIRE_RING, playerId: "player1" },
        createdByPlayerId: "player1",
        createdAtRound: 1,
      });

      const result = calculateRingFameBonus(state, state.players[0]);

      // Only 2 blue spells should count
      expect(result.fameGained).toBe(2);
      expect(result.player.fame).toBe(12);
    });

    it("should not grant fame if no ring modifier is active", () => {
      const player = createTestPlayer({
        id: "player1",
        fame: 10,
        spellColorsCastThisTurn: [MANA_BLUE],
        spellsCastByColorThisTurn: { [MANA_BLUE]: 5 },
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
        spellsCastByColorThisTurn: { [MANA_BLUE]: 2 },
      });

      expect(player.spellsCastByColorThisTurn[MANA_BLUE]).toBe(2);
    });
  });
});
