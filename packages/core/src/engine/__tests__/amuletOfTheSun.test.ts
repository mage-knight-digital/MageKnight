/**
 * Tests for Amulet of the Sun artifact
 *
 * Basic: Gain 1 gold mana token. At night: forests cost 3, gold mana usable, garrisons revealed.
 * Powered (any color, destroy): Same but gain 3 gold mana tokens.
 *
 * Edge cases:
 * - Desert stays at cost 3 (no change)
 * - Black mana still usable at night
 * - Day/Night skills still use night values
 */

import { describe, it, expect } from "vitest";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
  createHexEnemy,
} from "./testHelpers.js";
import { resolveEffect } from "../effects/index.js";
import { AMULET_OF_THE_SUN_CARDS } from "../../data/artifacts/amuletOfTheSun.js";
import { getEffectiveTerrainCost } from "../modifiers/terrain.js";
import { isRuleActive } from "../modifiers/index.js";
import { isManaColorAllowed, canUseGoldAsWild } from "../rules/mana.js";
import {
  CARD_AMULET_OF_THE_SUN,
  MANA_GOLD,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  TERRAIN_FOREST,
  TERRAIN_DESERT,
  TERRAIN_PLAINS,
  TERRAIN_HILLS,
  hexKey,
} from "@mage-knight/shared";
import type { EnemyTokenId } from "../../types/enemy.js";
import { RULE_ALLOW_GOLD_AT_NIGHT } from "../../types/modifierConstants.js";
import { SiteType } from "../../types/map.js";

describe("Amulet of the Sun", () => {
  const card = AMULET_OF_THE_SUN_CARDS[CARD_AMULET_OF_THE_SUN]!;

  // ============================================================================
  // CARD DEFINITION
  // ============================================================================

  describe("card definition", () => {
    it("should be defined with correct properties", () => {
      expect(card).toBeDefined();
      expect(card.name).toBe("Amulet of the Sun");
      expect(card.destroyOnPowered).toBe(true);
      expect(card.sidewaysValue).toBe(1);
      expect(card.categories).toContain("special");
    });

    it("should be powered by any basic color", () => {
      expect(card.poweredBy).toEqual(["red", "blue", "green", "white"]);
    });
  });

  // ============================================================================
  // BASIC EFFECT - DAY
  // ============================================================================

  describe("basic effect during day", () => {
    it("should gain 1 gold mana token", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = resolveEffect(state, "player1", card.basicEffect);

      const tokens = result.state.players[0]!.pureMana;
      expect(tokens).toHaveLength(1);
      expect(tokens[0]!.color).toBe(MANA_GOLD);
    });

    it("should not apply night modifiers during day", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = resolveEffect(state, "player1", card.basicEffect);

      // No modifiers should be applied during day
      expect(result.state.activeModifiers).toHaveLength(0);
    });
  });

  // ============================================================================
  // BASIC EFFECT - NIGHT
  // ============================================================================

  describe("basic effect during night", () => {
    it("should gain 1 gold mana token", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const result = resolveEffect(state, "player1", card.basicEffect);

      const goldTokens = result.state.players[0]!.pureMana.filter(
        (t) => t.color === MANA_GOLD
      );
      expect(goldTokens).toHaveLength(1);
    });

    it("should reduce forest movement cost to 3", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // At night, forest normally costs 5
      const nightForestCost = getEffectiveTerrainCost(
        state,
        TERRAIN_FOREST,
        "player1"
      );
      expect(nightForestCost).toBe(5);

      const result = resolveEffect(state, "player1", card.basicEffect);

      // After Amulet, forest should cost 3
      const modifiedForestCost = getEffectiveTerrainCost(
        result.state,
        TERRAIN_FOREST,
        "player1"
      );
      expect(modifiedForestCost).toBe(3);
    });

    it("should allow gold mana usage at night", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Before: gold mana not allowed at night
      expect(isManaColorAllowed(state, MANA_GOLD, "player1")).toBe(false);

      const result = resolveEffect(state, "player1", card.basicEffect);

      // After: gold mana allowed for this player
      expect(
        isManaColorAllowed(result.state, MANA_GOLD, "player1")
      ).toBe(true);
      expect(
        isRuleActive(result.state, "player1", RULE_ALLOW_GOLD_AT_NIGHT)
      ).toBe(true);
    });

    it("should allow gold mana as wild at night", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Before: gold not wild at night
      expect(canUseGoldAsWild(state, "player1")).toBe(false);

      const result = resolveEffect(state, "player1", card.basicEffect);

      // After: gold is wild for this player
      expect(canUseGoldAsWild(result.state, "player1")).toBe(true);
    });

    it("should reveal garrisons of nearby sites", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
        position: { q: 0, r: 0 },
      });

      // Create a hex with unrevealed garrison enemies adjacent to player
      const keepHex = createTestHex(1, 0, TERRAIN_PLAINS, {
        type: SiteType.Keep,
        owner: null,
        isConquered: false,
        isBurned: false,
      });
      const enemyToken = createHexEnemy("orc_summoners_0" as EnemyTokenId, false);
      keepHex.enemies = [enemyToken];

      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: keepHex,
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      // Before: enemy not revealed
      expect(
        state.map.hexes[hexKey({ q: 1, r: 0 })]!.enemies[0]!.isRevealed
      ).toBe(false);

      const result = resolveEffect(state, "player1", card.basicEffect);

      // After: garrison revealed
      expect(
        result.state.map.hexes[hexKey({ q: 1, r: 0 })]!.enemies[0]!.isRevealed
      ).toBe(true);
    });
  });

  // ============================================================================
  // POWERED EFFECT
  // ============================================================================

  describe("powered effect", () => {
    it("should gain 3 gold mana tokens during day", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = resolveEffect(state, "player1", card.poweredEffect);

      const goldTokens = result.state.players[0]!.pureMana.filter(
        (t) => t.color === MANA_GOLD
      );
      expect(goldTokens).toHaveLength(3);
    });

    it("should gain 3 gold mana tokens during night", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const result = resolveEffect(state, "player1", card.poweredEffect);

      const goldTokens = result.state.players[0]!.pureMana.filter(
        (t) => t.color === MANA_GOLD
      );
      expect(goldTokens).toHaveLength(3);
    });

    it("should apply night modifiers when used at night", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const result = resolveEffect(state, "player1", card.poweredEffect);

      // Forest should cost 3
      const forestCost = getEffectiveTerrainCost(
        result.state,
        TERRAIN_FOREST,
        "player1"
      );
      expect(forestCost).toBe(3);

      // Gold mana should be allowed
      expect(
        isManaColorAllowed(result.state, MANA_GOLD, "player1")
      ).toBe(true);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe("edge cases", () => {
    it("should not change desert movement cost at night", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });

      // Add desert hex to map
      const hexes = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_DESERT),
      };

      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        map: {
          hexes,
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      // Desert at night costs 3 (already the "day" equivalent)
      const desertCostBefore = getEffectiveTerrainCost(
        state,
        TERRAIN_DESERT,
        "player1"
      );
      expect(desertCostBefore).toBe(3);

      const result = resolveEffect(state, "player1", card.basicEffect);

      // Desert should still cost 3 (Amulet only affects forest)
      const desertCostAfter = getEffectiveTerrainCost(
        result.state,
        TERRAIN_DESERT,
        "player1"
      );
      expect(desertCostAfter).toBe(3);
    });

    it("should not affect other terrain costs at night", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const result = resolveEffect(state, "player1", card.basicEffect);

      // Hills at night = 4, should be unchanged
      const hillsCost = getEffectiveTerrainCost(
        result.state,
        TERRAIN_HILLS,
        "player1"
      );
      expect(hillsCost).toBe(4);

      // Plains at night = 3, should be unchanged
      const plainsCost = getEffectiveTerrainCost(
        result.state,
        TERRAIN_PLAINS,
        "player1"
      );
      expect(plainsCost).toBe(3);
    });

    it("should still allow black mana at night", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const result = resolveEffect(state, "player1", card.basicEffect);

      // Black mana should still be allowed at night
      expect(isManaColorAllowed(result.state, MANA_BLACK)).toBe(true);
    });

    it("should not affect gold mana for other players", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const player2 = createTestPlayer({
        id: "player2",
        hand: [],
      });
      const state = createTestGameState({
        players: [player1, player2],
        timeOfDay: TIME_OF_DAY_NIGHT,
        turnOrder: ["player1", "player2"],
      });

      const result = resolveEffect(state, "player1", card.basicEffect);

      // Player 1 can use gold mana
      expect(
        isManaColorAllowed(result.state, MANA_GOLD, "player1")
      ).toBe(true);

      // Player 2 cannot use gold mana
      expect(
        isManaColorAllowed(result.state, MANA_GOLD, "player2")
      ).toBe(false);
    });

    it("should have no effect on modifiers during day", () => {
      const player = createTestPlayer({
        hand: [CARD_AMULET_OF_THE_SUN],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = resolveEffect(state, "player1", card.basicEffect);

      // No modifiers at day (conditional is false, no else branch)
      expect(result.state.activeModifiers).toHaveLength(0);
    });
  });
});
