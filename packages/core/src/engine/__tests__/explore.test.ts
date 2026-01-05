/**
 * Tests for EXPLORE action
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
import {
  EXPLORE_ACTION,
  TILE_EXPLORED,
  INVALID_ACTION,
  UNDO_FAILED,
  UNDO_FAILED_CHECKPOINT_REACHED,
  UNDO_ACTION,
  UNDO_CHECKPOINT_SET,
  hexKey,
  TERRAIN_PLAINS,
  type HexCoord,
} from "@mage-knight/shared";
import { TILE_PLACEMENT_OFFSETS } from "../explore/tileGrid.js";
import type { TilePlacement } from "../../types/map.js";

describe("EXPLORE action", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  /**
   * Create a game state with player on edge of map
   * Player at (1,0) with only hexes (0,0) and (1,0) revealed
   * E direction (2,0) is unexplored
   */
  function createEdgeGameState(overrides: Partial<GameState> = {}): GameState {
    const player = createTestPlayer({
      id: "player1",
      position: { q: 1, r: 0 },
      movePoints: 4,
    });

    const baseState = createTestGameState();

    // Only two hexes revealed - player is on edge
    const hexes: Record<string, ReturnType<typeof createTestHex>> = {
      [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
      [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
    };

    return {
      ...baseState,
      players: [player],
      map: {
        ...baseState.map,
        hexes,
        tileDeck: {
          countryside: [TileId.Countryside1, TileId.Countryside2],
          core: [TileId.Core1],
        },
      },
      ...overrides,
    };
  }

  it("should reveal new tile and add hexes to map", () => {
    const state = createEdgeGameState();
    const initialHexCount = Object.keys(state.map.hexes).length;

    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E",
    });

    // Should have TILE_EXPLORED event
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TILE_EXPLORED,
        playerId: "player1",
        tileId: TileId.Countryside1,
      })
    );

    // Map should have more hexes now (a tile has 7 hexes)
    expect(Object.keys(result.state.map.hexes).length).toBeGreaterThan(
      initialHexCount
    );
  });

  it("should deduct 2 move points", () => {
    const state = createEdgeGameState();
    expect(state.players[0]?.movePoints).toBe(4);

    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E",
    });

    expect(result.state.players[0]?.movePoints).toBe(2);
  });

  it("should remove tile from deck", () => {
    const state = createEdgeGameState();
    expect(state.map.tileDeck.countryside.length).toBe(2);

    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E",
    });

    expect(result.state.map.tileDeck.countryside.length).toBe(1);
    expect(result.state.map.tileDeck.countryside).not.toContain(
      TileId.Countryside1
    );
  });

  it("should be irreversible - sets checkpoint", () => {
    const state = createEdgeGameState();

    const afterExplore = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E",
    });

    // Should have checkpoint set event
    expect(afterExplore.events).toContainEqual(
      expect.objectContaining({
        type: UNDO_CHECKPOINT_SET,
        playerId: "player1",
      })
    );

    // Command stack should have checkpoint
    expect(afterExplore.state.commandStack.checkpoint).not.toBeNull();
    expect(afterExplore.state.commandStack.commands.length).toBe(0);
  });

  it("should block undo after explore", () => {
    const state = createEdgeGameState();

    // Explore (irreversible)
    const afterExplore = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E",
    });

    // Try to undo
    const undoAttempt = engine.processAction(afterExplore.state, "player1", {
      type: UNDO_ACTION,
    });

    expect(undoAttempt.events).toContainEqual(
      expect.objectContaining({
        type: UNDO_FAILED,
        reason: UNDO_FAILED_CHECKPOINT_REACHED,
      })
    );
  });

  it("should add tile to tiles array", () => {
    const state = createEdgeGameState();
    expect(state.map.tiles.length).toBe(0);

    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E",
    });

    expect(result.state.map.tiles.length).toBe(1);
    expect(result.state.map.tiles[0]?.tileId).toBe(TileId.Countryside1);
  });

  it("should reject if not on edge hex", () => {
    // Create state where player is surrounded by hexes on all sides
    const player = createTestPlayer({
      id: "player1",
      position: { q: 0, r: 0 },
      movePoints: 4,
    });

    const baseState = createTestGameState();

    // Create hexes all around the player position
    const hexes: Record<string, ReturnType<typeof createTestHex>> = {
      [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS), // center
      [hexKey({ q: 1, r: -1 })]: createTestHex(1, -1, TERRAIN_PLAINS), // NE
      [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS), // E
      [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_PLAINS), // SE
      [hexKey({ q: -1, r: 1 })]: createTestHex(-1, 1, TERRAIN_PLAINS), // SW
      [hexKey({ q: -1, r: 0 })]: createTestHex(-1, 0, TERRAIN_PLAINS), // W
      [hexKey({ q: 0, r: -1 })]: createTestHex(0, -1, TERRAIN_PLAINS), // NW
    };

    const state: GameState = {
      ...baseState,
      players: [player],
      map: {
        ...baseState.map,
        hexes,
        tileDeck: {
          countryside: [TileId.Countryside1],
          core: [],
        },
      },
    };

    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E",
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
        reason: "Must be on edge of revealed map to explore",
      })
    );
  });

  it("should reject if direction already revealed", () => {
    // Player at (0,0), East (1,0) is already revealed
    const player = createTestPlayer({
      id: "player1",
      position: { q: 0, r: 0 },
      movePoints: 4,
    });

    const baseState = createTestGameState();

    const hexes: Record<string, ReturnType<typeof createTestHex>> = {
      [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
      [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS), // E revealed
      // Other directions are not revealed, so player is on edge
    };

    const state: GameState = {
      ...baseState,
      players: [player],
      map: {
        ...baseState.map,
        hexes,
        tileDeck: {
          countryside: [TileId.Countryside1],
          core: [],
        },
      },
    };

    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E", // Already has hex there
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
        reason: "Cannot explore in that direction - area already revealed",
      })
    );
  });

  it("should reject if not enough move points", () => {
    const player = createTestPlayer({
      id: "player1",
      position: { q: 1, r: 0 },
      movePoints: 1, // Not enough!
    });

    const state = createEdgeGameState({
      players: [player],
    });

    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E",
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
        reason: "Need 2 move points to explore, have 1",
      })
    );
  });

  it("should reject if no tiles available", () => {
    const state = createEdgeGameState({
      map: {
        hexes: {
          [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
          [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
        },
        tiles: [],
        tileDeck: { countryside: [], core: [] }, // No tiles!
      },
    });

    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E",
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
        reason: "No tiles remaining to explore",
      })
    );
  });

  it("should draw from core deck if countryside is empty", () => {
    const state = createEdgeGameState({
      map: {
        hexes: {
          [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
          [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
        },
        tiles: [],
        tileDeck: {
          countryside: [], // Empty!
          core: [TileId.Core1, TileId.Core2],
        },
      },
    });

    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E",
    });

    // Should succeed with core tile
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TILE_EXPLORED,
        tileId: TileId.Core1,
      })
    );

    // Core deck should be reduced
    expect(result.state.map.tileDeck.core.length).toBe(1);
  });

  it("should allow exploring in different valid directions", () => {
    const state = createEdgeGameState();

    // Try NE direction instead of E
    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "NE",
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TILE_EXPLORED,
        playerId: "player1",
      })
    );
  });

  describe("tile placement alignment", () => {
    /**
     * Create a proper game state with a tile at the origin.
     * Player is on a hex of that tile.
     * This tests that new tiles are placed relative to TILE CENTER, not player position.
     */
    function createStateWithTile(): GameState {
      const tileCenter: HexCoord = { q: 0, r: 0 };

      // Create hexes for a tile centered at origin (7 hexes in flower pattern)
      const tileHexOffsets = [
        { q: 0, r: 0 }, // center
        { q: 1, r: -1 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 1 },
        { q: -1, r: 0 },
        { q: 0, r: -1 },
      ];

      const hexes: Record<string, ReturnType<typeof createTestHex>> = {};
      for (const offset of tileHexOffsets) {
        const coord = { q: tileCenter.q + offset.q, r: tileCenter.r + offset.r };
        hexes[hexKey(coord)] = createTestHex(coord.q, coord.r, TERRAIN_PLAINS);
      }

      // Player at (1, 0) - on the E hex of the tile, NOT at tile center
      const player = createTestPlayer({
        id: "player1",
        position: { q: 1, r: 0 },
        movePoints: 10,
      });

      const baseState = createTestGameState();

      // Record that tile is at origin
      const tiles: TilePlacement[] = [
        { tileId: TileId.StartingTileA, centerCoord: tileCenter, revealed: true },
      ];

      return {
        ...baseState,
        players: [player],
        map: {
          ...baseState.map,
          hexes,
          tiles,
          tileDeck: {
            countryside: [TileId.Countryside1],
            core: [],
          },
        },
      };
    }

    it("should place new tile relative to current tile center, not player position", () => {
      const state = createStateWithTile();

      // Player is at (1, 0), but tile center is (0, 0)
      // When exploring E, the new tile should be at:
      // tileCenter + E_offset = (0,0) + (3,-1) = (3, -1)
      // NOT playerPos + E_offset = (1,0) + (3,-1) = (4, -1)

      const result = engine.processAction(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: TILE_EXPLORED,
        })
      );

      // The new tile should be placed at tile center (0,0) + E offset (3,-1) = (3,-1)
      const expectedTileCenter: HexCoord = {
        q: 0 + TILE_PLACEMENT_OFFSETS["E"].q,
        r: 0 + TILE_PLACEMENT_OFFSETS["E"].r,
      };

      // Find the new tile placement
      const newTile = result.state.map.tiles.find(
        (t) => t.tileId === TileId.Countryside1
      );

      expect(newTile).toBeDefined();
      expect(newTile?.centerCoord).toEqual(expectedTileCenter);
    });
  });
});
