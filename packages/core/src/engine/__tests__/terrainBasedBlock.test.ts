/**
 * Tests for terrain-based block effect
 *
 * Used by Braevalar's "One with the Land" card.
 * Block value = unmodified terrain movement cost
 * Element = Fire (day) / Ice (night or underground)
 */

import { describe, it, expect } from "vitest";
import { resolveEffect } from "../effects/index.js";
import { createTestGameState, createTestPlayer, createTestHex } from "./testHelpers.js";
import { EFFECT_TERRAIN_BASED_BLOCK } from "../../types/effectTypes.js";
import {
  hexKey,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  TERRAIN_PLAINS,
  TERRAIN_HILLS,
  TERRAIN_FOREST,
  TERRAIN_WASTELAND,
  TERRAIN_DESERT,
  TERRAIN_SWAMP,
  TERRAIN_MOUNTAIN,
  TERRAIN_LAKE,
} from "@mage-knight/shared";
import type { TerrainBasedBlockEffect } from "../../types/cards.js";
import { COMBAT_CONTEXT_STANDARD, type CombatState } from "../../types/combat.js";

const terrainBasedBlockEffect: TerrainBasedBlockEffect = {
  type: EFFECT_TERRAIN_BASED_BLOCK,
};

describe("Terrain-Based Block Effect", () => {
  describe("Day time - Fire Block", () => {
    it("should give Fire Block 2 on plains (day cost = 2)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = resolveEffect(state, player.id, terrainBasedBlockEffect);

      expect(result.state.players[0].combatAccumulator.block).toBe(2);
      expect(result.state.players[0].combatAccumulator.blockElements.fire).toBe(2);
      expect(result.description).toContain("fire Block");
    });

    it("should give Fire Block 3 on hills (day cost = 3)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_HILLS),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = resolveEffect(state, player.id, terrainBasedBlockEffect);

      expect(result.state.players[0].combatAccumulator.block).toBe(3);
      expect(result.state.players[0].combatAccumulator.blockElements.fire).toBe(3);
    });

    it("should give Fire Block 3 on forest (day cost = 3, not night cost = 5)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_FOREST),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = resolveEffect(state, player.id, terrainBasedBlockEffect);

      // Uses unmodified (day) cost regardless of time of day
      expect(result.state.players[0].combatAccumulator.block).toBe(3);
      expect(result.state.players[0].combatAccumulator.blockElements.fire).toBe(3);
    });

    it("should give Fire Block 4 on wasteland (day cost = 4)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_WASTELAND),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = resolveEffect(state, player.id, terrainBasedBlockEffect);

      expect(result.state.players[0].combatAccumulator.block).toBe(4);
      expect(result.state.players[0].combatAccumulator.blockElements.fire).toBe(4);
    });

    it("should give Fire Block 5 on desert (day cost = 5)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_DESERT),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = resolveEffect(state, player.id, terrainBasedBlockEffect);

      expect(result.state.players[0].combatAccumulator.block).toBe(5);
      expect(result.state.players[0].combatAccumulator.blockElements.fire).toBe(5);
    });

    it("should give Fire Block 5 on swamp (day cost = 5)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_SWAMP),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = resolveEffect(state, player.id, terrainBasedBlockEffect);

      expect(result.state.players[0].combatAccumulator.block).toBe(5);
      expect(result.state.players[0].combatAccumulator.blockElements.fire).toBe(5);
    });
  });

  describe("Night time - Ice Block", () => {
    it("should give Ice Block 2 on plains at night", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = resolveEffect(state, player.id, terrainBasedBlockEffect);

      expect(result.state.players[0].combatAccumulator.block).toBe(2);
      expect(result.state.players[0].combatAccumulator.blockElements.ice).toBe(2);
      expect(result.description).toContain("ice Block");
    });

    it("should give Ice Block 3 on forest at night (still uses day cost = 3)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_FOREST),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = resolveEffect(state, player.id, terrainBasedBlockEffect);

      // Per rulebook: uses UNMODIFIED move cost (day cost), not the time-adjusted cost
      expect(result.state.players[0].combatAccumulator.block).toBe(3);
      expect(result.state.players[0].combatAccumulator.blockElements.ice).toBe(3);
    });
  });

  describe("Underground combat (Dungeon/Tomb) - Ice Block per FAQ S1", () => {
    it("should give Ice Block during day when in dungeon combat (nightManaRules)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });

      // Create dungeon combat state (nightManaRules = true)
      const combat: CombatState = {
        enemies: [],
        phase: "rangedSiege",
        woundsThisCombat: 0,
        attacksThisPhase: 0,
        fameGained: 0,
        isAtFortifiedSite: false,
        unitsAllowed: false, // Dungeons don't allow units
        nightManaRules: true, // This makes it "night-like" for element purposes
        assaultOrigin: null,
        combatHexCoord: null,
        allDamageBlockedThisPhase: false,
        discardEnemiesOnFailure: false,
        pendingDamage: {},
        pendingBlock: {},
        pendingSwiftBlock: {},
        combatContext: COMBAT_CONTEXT_STANDARD,
        cumbersomeReductions: {},
        usedDefend: {},
        defendBonuses: {},
        paidHeroesAssaultInfluence: false,
        vampiricArmorBonus: {},
      };

      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY, // Day outside, but dungeon uses night rules
        combat,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = resolveEffect(state, player.id, terrainBasedBlockEffect);

      // Even during day, underground combat gives Ice Block
      expect(result.state.players[0].combatAccumulator.blockElements.ice).toBe(2);
      expect(result.description).toContain("ice Block");
    });
  });

  describe("Edge cases", () => {
    it("should give Block 2 on lake (fallback for impassable terrain)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_LAKE),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = resolveEffect(state, player.id, terrainBasedBlockEffect);

      // Lake is impassable (Infinity), but if you're somehow on it (boat),
      // we use a reasonable fallback of 2
      expect(result.state.players[0].combatAccumulator.block).toBe(2);
    });

    it("should give Block 5 on mountain (fallback for impassable terrain)", () => {
      const player = createTestPlayer({ position: { q: 0, r: 0 } });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_MOUNTAIN),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = resolveEffect(state, player.id, terrainBasedBlockEffect);

      // Mountain gets 5 as fallback (thematically appropriate for the highest terrain)
      expect(result.state.players[0].combatAccumulator.block).toBe(5);
    });
  });
});
