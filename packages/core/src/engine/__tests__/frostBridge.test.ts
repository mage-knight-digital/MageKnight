/**
 * Frost Bridge Card Tests
 *
 * Tests for:
 * - Basic: Move 2 + swamp cost reduced to 1 this turn
 * - Powered (Blue): Move 4 + lake traversal + lake/swamp cost reduced to 1 this turn
 * - Lakes remain unsafe spaces (traversal only)
 * - Rampaging enemy interactions on lakes
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
  CARD_FROST_BRIDGE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";

/**
 * Helper: apply Frost Bridge basic modifiers (swamp cost 1)
 */
function applyFrostBridgeBasicModifiers(baseState: GameState): GameState {
  return addModifier(baseState, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_FROST_BRIDGE as CardId,
      playerId: "player1",
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_SWAMP,
      amount: 0,
      minimum: 0,
      replaceCost: 1,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });
}

/**
 * Helper: apply Frost Bridge powered modifiers (lake + swamp cost 1)
 */
function applyFrostBridgePoweredModifiers(baseState: GameState): GameState {
  let state = addModifier(baseState, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_FROST_BRIDGE as CardId,
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

  state = addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_FROST_BRIDGE as CardId,
      playerId: "player1",
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_TERRAIN_COST,
      terrain: TERRAIN_SWAMP,
      amount: 0,
      minimum: 0,
      replaceCost: 1,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  return state;
}

describe("Frost Bridge Card", () => {
  describe("Basic Effect: Swamp Cost Reduction", () => {
    it("should reduce swamp cost to 1", () => {
      const baseState = createTestGameState();
      const state = applyFrostBridgeBasicModifiers(baseState);

      const cost = getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player1");
      expect(cost).toBe(1);
    });

    it("should reduce swamp cost to 1 at night (normally 5)", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applyFrostBridgeBasicModifiers(baseState);

      const cost = getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player1");
      expect(cost).toBe(1);
    });

    it("should not affect lake terrain (lakes remain impassable)", () => {
      const baseState = createTestGameState();
      const state = applyFrostBridgeBasicModifiers(baseState);

      const cost = getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1");
      expect(cost).toBe(Infinity);
    });

    it("should not affect other terrain types", () => {
      const baseState = createTestGameState();
      const state = applyFrostBridgeBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(2);
      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(3);
      expect(getEffectiveTerrainCost(state, TERRAIN_HILLS, "player1")).toBe(3);
      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(5);
      expect(getEffectiveTerrainCost(state, TERRAIN_WASTELAND, "player1")).toBe(4);
    });

    it("should not affect other players", () => {
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      const baseState = createTestGameState({
        players: [createTestPlayer(), player2],
        turnOrder: ["player1", "player2"],
      });
      const state = applyFrostBridgeBasicModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player1")).toBe(1);
      expect(getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player2")).toBe(5);
    });
  });

  describe("Powered Effect: Lake Traversal + Swamp/Lake Cost Reduction", () => {
    it("should set lake cost to 1 (makes lakes passable)", () => {
      const baseState = createTestGameState();
      const state = applyFrostBridgePoweredModifiers(baseState);

      const cost = getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1");
      expect(cost).toBe(1);
    });

    it("should set swamp cost to 1", () => {
      const baseState = createTestGameState();
      const state = applyFrostBridgePoweredModifiers(baseState);

      const cost = getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player1");
      expect(cost).toBe(1);
    });

    it("should set lake cost to 1 at night", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applyFrostBridgePoweredModifiers(baseState);

      const cost = getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1");
      expect(cost).toBe(1);
    });

    it("should not affect other terrain types", () => {
      const baseState = createTestGameState();
      const state = applyFrostBridgePoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(2);
      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(3);
      expect(getEffectiveTerrainCost(state, TERRAIN_HILLS, "player1")).toBe(3);
    });

    it("should not affect other players", () => {
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      const baseState = createTestGameState({
        players: [createTestPlayer(), player2],
        turnOrder: ["player1", "player2"],
      });
      const state = applyFrostBridgePoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1")).toBe(1);
      expect(getEffectiveTerrainCost(state, TERRAIN_LAKE, "player2")).toBe(Infinity);
      expect(getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player1")).toBe(1);
      expect(getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player2")).toBe(5);
    });
  });

  describe("Lake Safety", () => {
    it("should NOT make lakes safe spaces (basic effect)", () => {
      const baseState = createTestGameState();
      const state = applyFrostBridgeBasicModifiers(baseState);

      expect(isTerrainSafe(state, "player1", TERRAIN_LAKE)).toBe(false);
    });

    it("should NOT make lakes safe spaces (powered effect)", () => {
      const baseState = createTestGameState();
      const state = applyFrostBridgePoweredModifiers(baseState);

      expect(isTerrainSafe(state, "player1", TERRAIN_LAKE)).toBe(false);
    });

    it("should keep swamps as safe spaces (they are naturally safe)", () => {
      const baseState = createTestGameState();
      const state = applyFrostBridgePoweredModifiers(baseState);

      expect(isTerrainSafe(state, "player1", TERRAIN_SWAMP)).toBe(true);
    });
  });

  describe("Movement Entry with Frost Bridge", () => {
    it("should allow movement onto lake hex with powered effect", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_LAKE),
          },
        },
      });
      const state = applyFrostBridgePoweredModifiers(baseState);

      const lakeHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", lakeHex, { q: 1, r: 0 });
      expect(result.cost).toBe(1);
      expect(result.reason).toBeNull();
    });

    it("should block movement onto lake hex without powered effect", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_LAKE),
          },
        },
      });

      const lakeHex = baseState.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(baseState, "player1", lakeHex, { q: 1, r: 0 });
      expect(result.cost).toBe(Infinity);
      expect(result.reason).toBe("MOVE_ENTRY_BLOCK_IMPASSABLE");
    });

    it("should allow movement onto swamp hex with basic effect at cost 1", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_SWAMP),
          },
        },
      });
      const state = applyFrostBridgeBasicModifiers(baseState);

      const swampHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", swampHex, { q: 1, r: 0 });
      expect(result.cost).toBe(1);
      expect(result.reason).toBeNull();
    });
  });

  describe("Rampaging Enemy Interactions", () => {
    it("should block entry to lake hex with rampaging enemies even with powered effect", () => {
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
      const state = applyFrostBridgePoweredModifiers(baseState);

      const hex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", hex, { q: 1, r: 0 });
      expect(result.cost).toBe(Infinity);
      expect(result.reason).toBe("MOVE_ENTRY_BLOCK_RAMPAGING");
    });

    it("should block entry to swamp hex with rampaging enemies", () => {
      const swampHex = createTestHex(1, 0, TERRAIN_SWAMP);
      const enemy = createHexEnemy("diggers_1" as EnemyTokenId);
      const swampHexWithEnemies = {
        ...swampHex,
        enemies: [enemy],
        rampagingEnemies: [enemy],
      };

      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: swampHexWithEnemies,
          },
        },
      });
      const state = applyFrostBridgeBasicModifiers(baseState);

      const hex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", hex, { q: 1, r: 0 });
      expect(result.cost).toBe(Infinity);
      expect(result.reason).toBe("MOVE_ENTRY_BLOCK_RAMPAGING");
    });
  });
});
