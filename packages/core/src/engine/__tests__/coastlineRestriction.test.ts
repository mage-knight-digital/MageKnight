/**
 * Tests for core tile coastline restriction in wedge maps
 *
 * Per rulebook: "Core (brown) tiles cannot be added to the coastline.
 * (i.e. to the leftmost and rightmost lane of tiles)."
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
} from "./testHelpers.js";
import type { GameState } from "../../state/GameState.js";
import { TileId } from "../../types/map.js";
import type { TileSlot } from "../../types/map.js";
import {
  EXPLORE_ACTION,
  INVALID_ACTION,
  hexKey,
  TERRAIN_PLAINS,
  MAP_SHAPE_WEDGE,
  MAP_SHAPE_OPEN,
} from "@mage-knight/shared";
import { generateWedgeSlots } from "../explore/tileGrid.js";
import { isCoastlineSlot } from "../explore/tileGrid.js";
import { peekNextTileType } from "../../data/tileDeckSetup.js";
import { TILE_TYPE_CORE, TILE_TYPE_COUNTRYSIDE } from "../../data/tileConstants.js";
import { getValidExploreOptions } from "../validActions/exploration.js";
import { validateCoreNotOnCoastline } from "../validators/exploreValidators.js";

describe("Core tile coastline restriction", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("isCoastlineSlot helper", () => {
    it("should return false for row 0 (origin slot)", () => {
      const slots = generateWedgeSlots(3);
      const slotsRecord = Object.fromEntries(slots);

      // Row 0 has only one slot at origin - no coastline concept
      expect(isCoastlineSlot({ q: 0, r: 0 }, slotsRecord)).toBe(false);
    });

    it("should return true for both slots in row 1 (both are coastline)", () => {
      const slots = generateWedgeSlots(3);
      const slotsRecord = Object.fromEntries(slots);

      // Row 1 has 2 slots - both are coastline (left and right edges)
      // NE slot at (1, -3)
      expect(isCoastlineSlot({ q: 1, r: -3 }, slotsRecord)).toBe(true);
      // E slot at (3, -2)
      expect(isCoastlineSlot({ q: 3, r: -2 }, slotsRecord)).toBe(true);
    });

    it("should correctly identify coastline vs interior in row 2", () => {
      const slots = generateWedgeSlots(3);
      const slotsRecord = Object.fromEntries(slots);

      // Row 2 has 3 slots
      // Get all row 2 slots
      const row2Slots = [...slots.values()].filter(s => s.row === 2);
      expect(row2Slots.length).toBe(3);

      // Find min and max q values in row 2
      const qValues = row2Slots.map(s => s.coord.q);
      const minQ = Math.min(...qValues);
      const maxQ = Math.max(...qValues);

      // Coastline slots have min or max q
      for (const slot of row2Slots) {
        const isCoastline = slot.coord.q === minQ || slot.coord.q === maxQ;
        expect(isCoastlineSlot(slot.coord, slotsRecord)).toBe(isCoastline);
      }
    });

    it("should return false for non-existent slot", () => {
      const slots = generateWedgeSlots(3);
      const slotsRecord = Object.fromEntries(slots);

      // This coordinate doesn't exist in the wedge
      expect(isCoastlineSlot({ q: 100, r: 100 }, slotsRecord)).toBe(false);
    });

    it("should work with Map input as well as Record", () => {
      const slots = generateWedgeSlots(3);

      // Row 1 slots should be coastline using Map directly
      expect(isCoastlineSlot({ q: 1, r: -3 }, slots)).toBe(true);
      expect(isCoastlineSlot({ q: 3, r: -2 }, slots)).toBe(true);
    });
  });

  describe("peekNextTileType helper", () => {
    it("should return countryside type when countryside tiles available", () => {
      const deck = {
        countryside: [TileId.Countryside1, TileId.Countryside2],
        core: [TileId.Core1],
      };

      expect(peekNextTileType(deck)).toBe(TILE_TYPE_COUNTRYSIDE);
    });

    it("should return core type when only core tiles available", () => {
      const deck = {
        countryside: [],
        core: [TileId.Core1, TileId.Core2],
      };

      expect(peekNextTileType(deck)).toBe(TILE_TYPE_CORE);
    });

    it("should return null when deck is empty", () => {
      const deck = {
        countryside: [],
        core: [],
      };

      expect(peekNextTileType(deck)).toBeNull();
    });

    it("should not modify the deck (peek only)", () => {
      const deck = {
        countryside: [TileId.Countryside1, TileId.Countryside2],
        core: [TileId.Core1],
      };

      peekNextTileType(deck);

      expect(deck.countryside.length).toBe(2);
      expect(deck.core.length).toBe(1);
    });
  });

  describe("validateCoreNotOnCoastline validator", () => {
    function createWedgeGameState(
      tileDeck: { countryside: TileId[]; core: TileId[] }
    ): GameState {
      const slots = generateWedgeSlots(4);
      const tileSlots: Record<string, TileSlot> = {};
      for (const [key, slot] of slots) {
        tileSlots[key] = slot;
      }
      // Mark origin as filled (starting tile)
      const originKey = hexKey({ q: 0, r: 0 });
      const originSlot = tileSlots[originKey];
      if (originSlot) {
        tileSlots[originKey] = {
          ...originSlot,
          filled: true,
        };
      }

      const player = createTestPlayer({
        id: "player1",
        position: { q: 1, r: 0 }, // On edge of starting tile
        movePoints: 4,
      });

      const baseState = createTestGameState();

      // Create hexes for starting tile
      const hexes: Record<string, ReturnType<typeof createTestHex>> = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: -1 })]: createTestHex(1, -1, TERRAIN_PLAINS),
        [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_PLAINS),
        [hexKey({ q: -1, r: 1 })]: createTestHex(-1, 1, TERRAIN_PLAINS),
        [hexKey({ q: -1, r: 0 })]: createTestHex(-1, 0, TERRAIN_PLAINS),
        [hexKey({ q: 0, r: -1 })]: createTestHex(0, -1, TERRAIN_PLAINS),
      };

      return {
        ...baseState,
        players: [player],
        scenarioConfig: {
          ...baseState.scenarioConfig,
          mapShape: MAP_SHAPE_WEDGE,
        },
        map: {
          ...baseState.map,
          hexes,
          tiles: [
            { tileId: TileId.StartingTileA, centerCoord: { q: 0, r: 0 }, revealed: true },
          ],
          tileDeck,
          tileSlots,
        },
      };
    }

    it("should allow countryside tiles on coastline", () => {
      const state = createWedgeGameState({
        countryside: [TileId.Countryside1],
        core: [],
      });

      const result = validateCoreNotOnCoastline(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });

      expect(result.valid).toBe(true);
    });

    it("should reject core tiles on coastline (E direction from origin)", () => {
      const state = createWedgeGameState({
        countryside: [],
        core: [TileId.Core1],
      });

      const result = validateCoreNotOnCoastline(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("CORE_TILE_ON_COASTLINE");
      }
    });

    it("should reject core tiles on coastline (NE direction from origin)", () => {
      const state = createWedgeGameState({
        countryside: [],
        core: [TileId.Core1],
      });

      const result = validateCoreNotOnCoastline(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "NE",
        fromTileCoord: { q: 0, r: 0 },
      });

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("CORE_TILE_ON_COASTLINE");
      }
    });

    it("should skip validation for open maps", () => {
      const state = createWedgeGameState({
        countryside: [],
        core: [TileId.Core1],
      });

      // Change to open map
      const openMapState: GameState = {
        ...state,
        scenarioConfig: {
          ...state.scenarioConfig,
          mapShape: MAP_SHAPE_OPEN,
        },
      };

      const result = validateCoreNotOnCoastline(openMapState, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });

      expect(result.valid).toBe(true);
    });

    it("should skip validation when tile slots not initialized", () => {
      const state = createWedgeGameState({
        countryside: [],
        core: [TileId.Core1],
      });

      // Clear tile slots
      const noSlotsState: GameState = {
        ...state,
        map: {
          ...state.map,
          tileSlots: {},
        },
      };

      const result = validateCoreNotOnCoastline(noSlotsState, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });

      expect(result.valid).toBe(true);
    });
  });

  describe("getValidExploreOptions filtering", () => {
    function createWedgeExploreState(
      tileDeck: { countryside: TileId[]; core: TileId[] }
    ): GameState {
      const slots = generateWedgeSlots(4);
      const tileSlots: Record<string, TileSlot> = {};
      for (const [key, slot] of slots) {
        tileSlots[key] = slot;
      }
      // Mark origin as filled
      const originKey = hexKey({ q: 0, r: 0 });
      const originSlot = tileSlots[originKey];
      if (originSlot) {
        tileSlots[originKey] = {
          ...originSlot,
          filled: true,
        };
      }

      // Player at (1, -1) which is the NE hex of the starting tile
      // From here, they can reach both NE and E expansion slots
      const player = createTestPlayer({
        id: "player1",
        position: { q: 1, r: -1 },
        movePoints: 4,
      });

      const baseState = createTestGameState();

      // Create hexes for starting tile (7 hexes in flower pattern)
      const hexes: Record<string, ReturnType<typeof createTestHex>> = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: -1 })]: createTestHex(1, -1, TERRAIN_PLAINS),
        [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_PLAINS),
        [hexKey({ q: -1, r: 1 })]: createTestHex(-1, 1, TERRAIN_PLAINS),
        [hexKey({ q: -1, r: 0 })]: createTestHex(-1, 0, TERRAIN_PLAINS),
        [hexKey({ q: 0, r: -1 })]: createTestHex(0, -1, TERRAIN_PLAINS),
      };

      return {
        ...baseState,
        players: [player],
        scenarioConfig: {
          ...baseState.scenarioConfig,
          mapShape: MAP_SHAPE_WEDGE,
        },
        map: {
          ...baseState.map,
          hexes,
          tiles: [
            { tileId: TileId.StartingTileA, centerCoord: { q: 0, r: 0 }, revealed: true },
          ],
          tileDeck,
          tileSlots,
        },
      };
    }

    it("should show all directions when countryside tiles available", () => {
      const state = createWedgeExploreState({
        countryside: [TileId.Countryside1],
        core: [],
      });

      const player = state.players[0];
      expect(player).toBeDefined();
      if (!player) return;

      const options = getValidExploreOptions(state, player);

      // Should have options (NE and/or E from origin)
      expect(options).toBeDefined();
      if (!options) return;
      expect(options.directions.length).toBeGreaterThan(0);
    });

    it("should filter coastline directions when only core tiles available", () => {
      const state = createWedgeExploreState({
        countryside: [],
        core: [TileId.Core1],
      });

      const player = state.players[0];
      expect(player).toBeDefined();
      if (!player) return;

      const options = getValidExploreOptions(state, player);

      // All row 1 slots are coastline (both NE and E), so no valid options
      // should be available when placing core tiles from row 0
      expect(options).toBeUndefined();
    });

    it("should not filter directions for open maps", () => {
      const state = createWedgeExploreState({
        countryside: [],
        core: [TileId.Core1],
      });

      // Change to open map (no coastline concept)
      const openMapState: GameState = {
        ...state,
        scenarioConfig: {
          ...state.scenarioConfig,
          mapShape: MAP_SHAPE_OPEN,
        },
        map: {
          ...state.map,
          tileSlots: {}, // Open maps don't use tileSlots
        },
      };

      const player = openMapState.players[0];
      expect(player).toBeDefined();
      if (!player) return;

      const options = getValidExploreOptions(openMapState, player);

      // Open map should still allow exploration
      expect(options).toBeDefined();
    });
  });

  describe("full integration test", () => {
    function createFullWedgeState(): GameState {
      const slots = generateWedgeSlots(4);
      const tileSlots: Record<string, TileSlot> = {};
      for (const [key, slot] of slots) {
        tileSlots[key] = slot;
      }
      // Mark origin as filled
      const originKey = hexKey({ q: 0, r: 0 });
      const originSlot = tileSlots[originKey];
      if (originSlot) {
        tileSlots[originKey] = {
          ...originSlot,
          filled: true,
        };
      }

      const player = createTestPlayer({
        id: "player1",
        position: { q: 1, r: -1 }, // NE hex of starting tile
        movePoints: 4,
      });

      const baseState = createTestGameState();

      // Create hexes for starting tile
      const hexes: Record<string, ReturnType<typeof createTestHex>> = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: -1 })]: createTestHex(1, -1, TERRAIN_PLAINS),
        [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_PLAINS),
        [hexKey({ q: -1, r: 1 })]: createTestHex(-1, 1, TERRAIN_PLAINS),
        [hexKey({ q: -1, r: 0 })]: createTestHex(-1, 0, TERRAIN_PLAINS),
        [hexKey({ q: 0, r: -1 })]: createTestHex(0, -1, TERRAIN_PLAINS),
      };

      return {
        ...baseState,
        players: [player],
        scenarioConfig: {
          ...baseState.scenarioConfig,
          mapShape: MAP_SHAPE_WEDGE,
        },
        map: {
          ...baseState.map,
          hexes,
          tiles: [
            { tileId: TileId.StartingTileA, centerCoord: { q: 0, r: 0 }, revealed: true },
          ],
          tileDeck: {
            countryside: [],
            core: [TileId.Core1],
          },
          tileSlots,
        },
      };
    }

    it("should reject explore action when core tile would go on coastline", () => {
      const state = createFullWedgeState();

      const result = engine.processAction(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "NE",
        fromTileCoord: { q: 0, r: 0 },
      });

      // The validActions filter removes coastline options before the validator runs,
      // so the error comes from validateExploreDirection (no valid options)
      // rather than the coastline validator specifically.
      // This is correct behavior - the UI wouldn't show these options anyway.
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should allow explore when countryside tiles available for coastline", () => {
      const state = createFullWedgeState();

      // Add countryside tiles
      const stateWithCountryside: GameState = {
        ...state,
        map: {
          ...state.map,
          tileDeck: {
            countryside: [TileId.Countryside1],
            core: [TileId.Core1],
          },
        },
      };

      const result = engine.processAction(stateWithCountryside, "player1", {
        type: EXPLORE_ACTION,
        direction: "NE",
        fromTileCoord: { q: 0, r: 0 },
      });

      // Should NOT have INVALID_ACTION event (explore should succeed)
      const invalidAction = result.events.find(e => e.type === INVALID_ACTION);
      expect(invalidAction).toBeUndefined();
    });
  });
});
