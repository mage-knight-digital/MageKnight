/**
 * Song of Wind Card Tests
 *
 * Tests for:
 * - Basic: Move 2 + plains/deserts/wastelands cost -1 (min 0) this turn
 * - Powered (White): Move 2 + plains/deserts/wastelands cost -2 (min 0)
 *   + optional blue mana for lake traversal at cost 0
 * - Lakes remain unsafe spaces (traversal only)
 * - Terrain modifier stacking
 */

import { describe, it, expect } from "vitest";
import type { GameState } from "../../state/GameState.js";
import type { EnemyTokenId } from "../../types/enemy.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
  createHexEnemy,
} from "./testHelpers.js";
import {
  getEffectiveTerrainCost,
  isTerrainSafe,
} from "../modifiers/terrain.js";
import { addModifier } from "../modifiers/index.js";
import { evaluateMoveEntry } from "../rules/movement.js";
import {
  hexKey,
  TERRAIN_PLAINS,
  TERRAIN_SWAMP,
  TERRAIN_LAKE,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  TERRAIN_DESERT,
  TERRAIN_WASTELAND,
  TIME_OF_DAY_NIGHT,
  CARD_SONG_OF_WIND,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  SCOPE_SELF,
  SOURCE_CARD,
  TERRAIN_ALL,
} from "../../types/modifierConstants.js";

/**
 * Helper: apply Song of Wind basic modifiers (plains/deserts/wastelands -1, min 0)
 */
function applySongOfWindBasicModifiers(baseState: GameState): GameState {
  let state = addModifier(baseState, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_SONG_OF_WIND as CardId,
      playerId: "player1",
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_PLAINS,
      amount: -1,
      minimum: 0,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  state = addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_SONG_OF_WIND as CardId,
      playerId: "player1",
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_DESERT,
      amount: -1,
      minimum: 0,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  state = addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_SONG_OF_WIND as CardId,
      playerId: "player1",
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_WASTELAND,
      amount: -1,
      minimum: 0,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  return state;
}

/**
 * Helper: apply Song of Wind powered modifiers (plains/deserts/wastelands -2, min 0)
 */
function applySongOfWindPoweredModifiers(baseState: GameState): GameState {
  let state = addModifier(baseState, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_SONG_OF_WIND as CardId,
      playerId: "player1",
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_PLAINS,
      amount: -2,
      minimum: 0,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  state = addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_SONG_OF_WIND as CardId,
      playerId: "player1",
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_DESERT,
      amount: -2,
      minimum: 0,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  state = addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_SONG_OF_WIND as CardId,
      playerId: "player1",
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_WASTELAND,
      amount: -2,
      minimum: 0,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  return state;
}

/**
 * Helper: apply Song of Wind powered modifiers + lake traversal (blue mana paid)
 */
function applySongOfWindPoweredWithLakeModifiers(baseState: GameState): GameState {
  let state = applySongOfWindPoweredModifiers(baseState);

  state = addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_SONG_OF_WIND as CardId,
      playerId: "player1",
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_LAKE,
      amount: 0,
      minimum: 0,
      replaceCost: 0,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  return state;
}

describe("Song of Wind Card", () => {
  describe("Basic Effect: Terrain Cost Reduction -1", () => {
    it("should reduce plains cost by 1 during day (2 → 1)", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(1);
    });

    it("should reduce plains cost by 1 at night (3 → 2)", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applySongOfWindBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(2);
    });

    it("should reduce desert cost by 1 during day (5 → 4)", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(4);
    });

    it("should reduce desert cost by 1 at night (3 → 2)", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applySongOfWindBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(2);
    });

    it("should reduce wasteland cost by 1 during day (4 → 3)", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_WASTELAND, "player1")).toBe(3);
    });

    it("should reduce wasteland cost by 1 at night (5 → 4)", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applySongOfWindBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_WASTELAND, "player1")).toBe(4);
    });

    it("should not affect other terrain types", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(3);
      expect(getEffectiveTerrainCost(state, TERRAIN_HILLS, "player1")).toBe(3);
      expect(getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player1")).toBe(5);
    });

    it("should not affect lakes (remain impassable)", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1")).toBe(Infinity);
    });

    it("should not affect other players", () => {
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      const baseState = createTestGameState({
        players: [createTestPlayer(), player2],
        turnOrder: ["player1", "player2"],
      });
      const state = applySongOfWindBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(1);
      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player2")).toBe(2);
      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(4);
      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player2")).toBe(5);
    });
  });

  describe("Powered Effect: Terrain Cost Reduction -2 (without blue mana)", () => {
    it("should reduce plains cost by 2 during day (2 → 0)", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(0);
    });

    it("should reduce plains cost by 2 at night (3 → 1)", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applySongOfWindPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(1);
    });

    it("should reduce desert cost by 2 during day (5 → 3)", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(3);
    });

    it("should reduce desert cost by 2 at night (3 → 1)", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applySongOfWindPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(1);
    });

    it("should reduce wasteland cost by 2 during day (4 → 2)", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_WASTELAND, "player1")).toBe(2);
    });

    it("should reduce wasteland cost by 2 at night (5 → 3)", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applySongOfWindPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_WASTELAND, "player1")).toBe(3);
    });

    it("should not reduce below minimum 0", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindPoweredModifiers(baseState);

      // Plains day cost is 2, -2 = 0, should not go below 0
      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(0);
    });

    it("should not affect lakes (remain impassable without blue mana)", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1")).toBe(Infinity);
    });

    it("should not affect other terrain types", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(3);
      expect(getEffectiveTerrainCost(state, TERRAIN_HILLS, "player1")).toBe(3);
      expect(getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player1")).toBe(5);
    });
  });

  describe("Powered Effect: Lake Traversal (with blue mana)", () => {
    it("should set lake cost to 0 when blue mana is paid", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindPoweredWithLakeModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1")).toBe(0);
    });

    it("should set lake cost to 0 at night when blue mana is paid", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applySongOfWindPoweredWithLakeModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1")).toBe(0);
    });

    it("should still apply terrain cost reductions alongside lake traversal", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindPoweredWithLakeModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(0);
      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(3);
      expect(getEffectiveTerrainCost(state, TERRAIN_WASTELAND, "player1")).toBe(2);
    });
  });

  describe("Lake Safety", () => {
    it("should NOT make lakes safe spaces (basic effect)", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindBasicModifiers(baseState);

      expect(isTerrainSafe(state, "player1", TERRAIN_LAKE)).toBe(false);
    });

    it("should NOT make lakes safe spaces (powered effect without blue mana)", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindPoweredModifiers(baseState);

      expect(isTerrainSafe(state, "player1", TERRAIN_LAKE)).toBe(false);
    });

    it("should NOT make lakes safe spaces (powered effect with blue mana)", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindPoweredWithLakeModifiers(baseState);

      // Song of Wind enables lake traversal but lakes remain unsafe
      expect(isTerrainSafe(state, "player1", TERRAIN_LAKE)).toBe(false);
    });

    it("should keep plains as safe spaces", () => {
      const baseState = createTestGameState();
      const state = applySongOfWindBasicModifiers(baseState);

      expect(isTerrainSafe(state, "player1", TERRAIN_PLAINS)).toBe(true);
    });
  });

  describe("Movement Entry with Song of Wind", () => {
    it("should allow movement onto lake hex with powered effect + blue mana at cost 0", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_LAKE),
          },
        },
      });
      const state = applySongOfWindPoweredWithLakeModifiers(baseState);

      const lakeHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", lakeHex, { q: 1, r: 0 });
      expect(result.cost).toBe(0);
      expect(result.reason).toBeNull();
    });

    it("should block movement onto lake hex without blue mana payment", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_LAKE),
          },
        },
      });
      const state = applySongOfWindPoweredModifiers(baseState);

      const lakeHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", lakeHex, { q: 1, r: 0 });
      expect(result.cost).toBe(Infinity);
      expect(result.reason).toBe("MOVE_ENTRY_BLOCK_IMPASSABLE");
    });

    it("should allow movement onto plains hex at reduced cost", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
          },
        },
      });
      const state = applySongOfWindBasicModifiers(baseState);

      const plainsHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", plainsHex, { q: 1, r: 0 });
      expect(result.cost).toBe(1);
      expect(result.reason).toBeNull();
    });
  });

  describe("Rampaging Enemy Interactions", () => {
    it("should block entry to lake hex with rampaging enemies even with lake traversal", () => {
      const lakeHex = createTestHex(1, 0, TERRAIN_LAKE);
      const enemy = createHexEnemy("diggers_1" as EnemyTokenId);
      const lakeHexWithEnemies = {
        ...lakeHex,
        enemies: [enemy],
        rampagingEnemies: [enemy],
      };

      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: lakeHexWithEnemies,
          },
        },
      });
      const state = applySongOfWindPoweredWithLakeModifiers(baseState);

      const hex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", hex, { q: 1, r: 0 });
      expect(result.cost).toBe(Infinity);
      expect(result.reason).toBe("MOVE_ENTRY_BLOCK_RAMPAGING");
    });
  });

  describe("Terrain Modifier Stacking", () => {
    it("should stack with Path Finding-style TERRAIN_ALL modifier", () => {
      const baseState = createTestGameState();
      let state = applySongOfWindBasicModifiers(baseState);

      // Add a Path Finding-style modifier: all terrain -1 (min 2)
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "path_finding" as CardId,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -1,
          minimum: 2,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Plains: base 2, Song of Wind -1, Path Finding -1 = 0
      // But Path Finding has minimum 2, Song of Wind has minimum 0
      // minAllowed = max(0, 2) = 2
      // Result: max(2, 0) = 2
      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(2);

      // Desert: base 5, Song of Wind -1, Path Finding -1 = 3
      // minAllowed = max(0, 2) = 2
      // Result: max(2, 3) = 3
      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(3);

      // Forest: only Path Finding applies: base 3, -1 = 2
      // minAllowed = 2
      // Result: max(2, 2) = 2
      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(2);
    });

    it("should stack powered effect with Frost Bridge lake modifier", () => {
      const baseState = createTestGameState();
      let state = applySongOfWindPoweredWithLakeModifiers(baseState);

      // Add Frost Bridge lake modifier (replaceCost: 1)
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "frost_bridge" as CardId,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_LAKE,
          amount: 0,
          minimum: 0,
          replaceCost: 1,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Song of Wind sets replaceCost: 0, Frost Bridge sets replaceCost: 1
      // Multiple replaceCost modifiers: use lowest = 0
      expect(getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1")).toBe(0);
    });

    it("should respect minimum 0 when multiple reductions would go negative", () => {
      const baseState = createTestGameState();
      let state = applySongOfWindPoweredModifiers(baseState);

      // Add another -2 modifier for plains (simulating some other card)
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "other_card" as CardId,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_PLAINS,
          amount: -2,
          minimum: 0,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Plains: base 2, Song of Wind -2, other -2 = -2
      // minAllowed = max(0, 0) = 0
      // Result: max(0, -2) = 0
      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(0);
    });
  });
});
