/**
 * Path Finding Card Tests
 *
 * Tests for:
 * - Basic: Move 2 + all terrain costs -1 (min 2) this turn
 * - Powered (Green): Move 4 + all terrain costs set to 2 this turn
 * - Lakes/mountains remain impassable
 * - Cost reduction applies if other effects grant access
 * - Stacking with Song of Wind
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
  TERRAIN_MOUNTAIN,
  TIME_OF_DAY_NIGHT,
  CARD_PATH_FINDING,
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
 * Helper: apply Path Finding basic modifier (all terrain -1, min 2)
 */
function applyPathFindingBasicModifier(baseState: GameState): GameState {
  return addModifier(baseState, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_PATH_FINDING as CardId,
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
}

const PASSABLE_TERRAINS = [
  TERRAIN_PLAINS,
  TERRAIN_HILLS,
  TERRAIN_FOREST,
  TERRAIN_WASTELAND,
  TERRAIN_DESERT,
  TERRAIN_SWAMP,
] as const;

/**
 * Helper: apply Path Finding powered modifiers (each passable terrain cost 2)
 */
function applyPathFindingPoweredModifiers(baseState: GameState): GameState {
  let state = baseState;
  for (const terrain of PASSABLE_TERRAINS) {
    state = addModifier(state, {
      source: {
        type: SOURCE_CARD,
        cardId: CARD_PATH_FINDING as CardId,
        playerId: "player1",
      },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_TERRAIN_COST,
        terrain,
        amount: 0,
        minimum: 0,
        replaceCost: 2,
      },
      createdAtRound: 1,
      createdByPlayerId: "player1",
    });
  }
  return state;
}

/**
 * Helper: apply Song of Wind basic modifiers (plains/deserts/wastelands -1, min 0)
 */
function applySongOfWindBasicModifiers(baseState: GameState): GameState {
  let state = baseState;
  for (const terrain of [TERRAIN_PLAINS, TERRAIN_DESERT, TERRAIN_WASTELAND] as const) {
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
        terrain,
        amount: -1,
        minimum: 0,
      },
      createdAtRound: 1,
      createdByPlayerId: "player1",
    });
  }
  return state;
}

describe("Path Finding Card", () => {
  describe("Basic Effect: All Terrain Cost -1 (min 2)", () => {
    it("should reduce plains cost by 1, clamped to min 2 during day (2 → 2)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingBasicModifier(baseState);

      // Plains day = 2, -1 = 1, but min 2 → 2
      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(2);
    });

    it("should reduce plains cost by 1 at night (3 → 2)", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applyPathFindingBasicModifier(baseState);

      // Plains night = 3, -1 = 2 → 2
      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(2);
    });

    it("should reduce forest cost by 1 during day (3 → 2)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingBasicModifier(baseState);

      // Forest day = 3, -1 = 2 → 2
      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(2);
    });

    it("should reduce forest cost by 1 at night (5 → 4)", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applyPathFindingBasicModifier(baseState);

      // Forest night = 5, -1 = 4 → 4
      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(4);
    });

    it("should reduce hills cost by 1 during day (3 → 2)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingBasicModifier(baseState);

      // Hills day = 3, -1 = 2 → 2
      expect(getEffectiveTerrainCost(state, TERRAIN_HILLS, "player1")).toBe(2);
    });

    it("should reduce wasteland cost by 1 during day (4 → 3)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingBasicModifier(baseState);

      // Wasteland day = 4, -1 = 3 → 3
      expect(getEffectiveTerrainCost(state, TERRAIN_WASTELAND, "player1")).toBe(3);
    });

    it("should reduce desert cost by 1 during day (5 → 4)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingBasicModifier(baseState);

      // Desert day = 5, -1 = 4 → 4
      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(4);
    });

    it("should reduce swamp cost by 1 during day (5 → 4)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingBasicModifier(baseState);

      // Swamp day = 5, -1 = 4 → 4
      expect(getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player1")).toBe(4);
    });

    it("should not reduce below minimum 2", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingBasicModifier(baseState);

      // Plains day = 2, -1 = 1, but min 2 → 2
      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(2);
    });

    it("should not make lakes passable (remain Infinity)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingBasicModifier(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1")).toBe(Infinity);
    });

    it("should not make mountains passable (remain Infinity)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingBasicModifier(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_MOUNTAIN, "player1")).toBe(Infinity);
    });

    it("should not affect other players", () => {
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      const baseState = createTestGameState({
        players: [createTestPlayer(), player2],
        turnOrder: ["player1", "player2"],
      });
      const state = applyPathFindingBasicModifier(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(2);
      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player2")).toBe(3);
    });
  });

  describe("Powered Effect: All Terrain Cost = 2", () => {
    it("should set plains cost to 2 during day", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(2);
    });

    it("should set plains cost to 2 at night (normally 3)", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(2);
    });

    it("should set forest cost to 2 during day (normally 3)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(2);
    });

    it("should set forest cost to 2 at night (normally 5)", () => {
      const baseState = createTestGameState({ timeOfDay: TIME_OF_DAY_NIGHT });
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(2);
    });

    it("should set hills cost to 2 during day (normally 3)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_HILLS, "player1")).toBe(2);
    });

    it("should set wasteland cost to 2 during day (normally 4)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_WASTELAND, "player1")).toBe(2);
    });

    it("should set desert cost to 2 during day (normally 5)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(2);
    });

    it("should set swamp cost to 2 during day (normally 5)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player1")).toBe(2);
    });

    it("should not make lakes passable (remain Infinity)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1")).toBe(Infinity);
    });

    it("should not make mountains passable (remain Infinity)", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_MOUNTAIN, "player1")).toBe(Infinity);
    });

    it("should not affect other players", () => {
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      const baseState = createTestGameState({
        players: [createTestPlayer(), player2],
        turnOrder: ["player1", "player2"],
      });
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(2);
      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player2")).toBe(5);
    });
  });

  describe("Impassable Terrain", () => {
    it("should block movement onto lake hex with basic effect", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_LAKE),
          },
        },
      });
      const state = applyPathFindingBasicModifier(baseState);

      const lakeHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", lakeHex, { q: 1, r: 0 });
      expect(result.cost).toBe(Infinity);
      expect(result.reason).toBe("MOVE_ENTRY_BLOCK_IMPASSABLE");
    });

    it("should block movement onto lake hex with powered effect", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_LAKE),
          },
        },
      });
      const state = applyPathFindingPoweredModifiers(baseState);

      const lakeHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", lakeHex, { q: 1, r: 0 });
      expect(result.cost).toBe(Infinity);
      expect(result.reason).toBe("MOVE_ENTRY_BLOCK_IMPASSABLE");
    });

    it("should apply cost reduction to lake if another effect makes it passable", () => {
      const baseState = createTestGameState();

      // Song of Wind powered with blue mana makes lakes passable at cost 0
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
          terrain: TERRAIN_LAKE,
          amount: 0,
          minimum: 0,
          replaceCost: 0,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Path Finding basic: all -1 (min 2)
      state = applyPathFindingBasicModifier(state);

      // Lake: replaceCost 0 from Song of Wind, then additive -1 from Path Finding
      // Cost = 0 + (-1) = -1, min from Path Finding = 2
      // Result: max(2, -1) = 2
      expect(getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1")).toBe(2);
    });

    it("should apply powered cost to lake if another effect makes it passable", () => {
      const baseState = createTestGameState();

      // Song of Wind powered with blue mana makes lakes passable at cost 0
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
          terrain: TERRAIN_LAKE,
          amount: 0,
          minimum: 0,
          replaceCost: 0,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Path Finding powered: all terrain cost 2
      state = applyPathFindingPoweredModifiers(state);

      // Lake: two replaceCost modifiers — SoW=0, PF=2. Lowest wins → 0
      expect(getEffectiveTerrainCost(state, TERRAIN_LAKE, "player1")).toBe(0);
    });
  });

  describe("Stacking with Song of Wind", () => {
    it("should stack basic Path Finding with basic Song of Wind on plains", () => {
      const baseState = createTestGameState();
      let state = applySongOfWindBasicModifiers(baseState);
      state = applyPathFindingBasicModifier(state);

      // Plains day = 2
      // Song of Wind: -1 (min 0)
      // Path Finding: -1 (min 2)
      // Cost = 2 + (-1) + (-1) = 0
      // minAllowed = max(0, 2) = 2
      // Result: max(2, 0) = 2
      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(2);
    });

    it("should stack basic Path Finding with basic Song of Wind on desert", () => {
      const baseState = createTestGameState();
      let state = applySongOfWindBasicModifiers(baseState);
      state = applyPathFindingBasicModifier(state);

      // Desert day = 5
      // Song of Wind: -1 (min 0)
      // Path Finding: -1 (min 2)
      // Cost = 5 + (-1) + (-1) = 3
      // minAllowed = max(0, 2) = 2
      // Result: max(2, 3) = 3
      expect(getEffectiveTerrainCost(state, TERRAIN_DESERT, "player1")).toBe(3);
    });

    it("should stack basic Path Finding with basic Song of Wind on wasteland", () => {
      const baseState = createTestGameState();
      let state = applySongOfWindBasicModifiers(baseState);
      state = applyPathFindingBasicModifier(state);

      // Wasteland day = 4
      // Song of Wind: -1 (min 0)
      // Path Finding: -1 (min 2)
      // Cost = 4 + (-1) + (-1) = 2
      // minAllowed = max(0, 2) = 2
      // Result: max(2, 2) = 2
      expect(getEffectiveTerrainCost(state, TERRAIN_WASTELAND, "player1")).toBe(2);
    });

    it("should only apply Path Finding on forest (Song of Wind doesn't affect forests)", () => {
      const baseState = createTestGameState();
      let state = applySongOfWindBasicModifiers(baseState);
      state = applyPathFindingBasicModifier(state);

      // Forest day = 3, only Path Finding: -1 (min 2) → 2
      expect(getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1")).toBe(2);
    });

    it("should enforce min 2 from Path Finding when Song of Wind would reduce further", () => {
      const baseState = createTestGameState();
      let state = applySongOfWindBasicModifiers(baseState);
      state = applyPathFindingBasicModifier(state);

      // Plains day = 2, -1 (SoW) -1 (PF) = 0, but min = max(0, 2) = 2
      expect(getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1")).toBe(2);
    });
  });

  describe("Movement Entry with Path Finding", () => {
    it("should allow movement at reduced cost with basic effect", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_FOREST),
          },
        },
      });
      const state = applyPathFindingBasicModifier(baseState);

      const forestHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", forestHex, { q: 1, r: 0 });
      expect(result.cost).toBe(2);
      expect(result.reason).toBeNull();
    });

    it("should allow movement at cost 2 with powered effect on expensive terrain", () => {
      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_SWAMP),
          },
        },
      });
      const state = applyPathFindingPoweredModifiers(baseState);

      const swampHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", swampHex, { q: 1, r: 0 });
      expect(result.cost).toBe(2);
      expect(result.reason).toBeNull();
    });

    it("should block entry to hex with rampaging enemies regardless of cost reduction", () => {
      const forestHex = createTestHex(1, 0, TERRAIN_FOREST);
      const enemy = createHexEnemy("diggers_1" as EnemyTokenId);
      const forestHexWithEnemies = {
        ...forestHex,
        enemies: [enemy],
        rampagingEnemies: [enemy],
      };

      const baseState = createTestGameState({
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: forestHexWithEnemies,
          },
        },
      });
      const state = applyPathFindingPoweredModifiers(baseState);

      const hex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      const result = evaluateMoveEntry(state, "player1", hex, { q: 1, r: 0 });
      expect(result.cost).toBe(Infinity);
      expect(result.reason).toBe("MOVE_ENTRY_BLOCK_RAMPAGING");
    });
  });

  describe("Terrain Safety", () => {
    it("should not make lakes safe with basic effect", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingBasicModifier(baseState);

      expect(isTerrainSafe(state, "player1", TERRAIN_LAKE)).toBe(false);
    });

    it("should not make lakes safe with powered effect", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingPoweredModifiers(baseState);

      expect(isTerrainSafe(state, "player1", TERRAIN_LAKE)).toBe(false);
    });

    it("should keep plains as safe spaces", () => {
      const baseState = createTestGameState();
      const state = applyPathFindingBasicModifier(baseState);

      expect(isTerrainSafe(state, "player1", TERRAIN_PLAINS)).toBe(true);
    });
  });
});
