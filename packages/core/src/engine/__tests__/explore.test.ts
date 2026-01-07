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
import { TILE_PLACEMENT_OFFSETS, findTileCenterForHex } from "../explore/tileGrid.js";
import type { TilePlacement } from "../../types/map.js";
import { getValidExploreOptions } from "../validActions/exploration.js";

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
      fromTileCoord: { q: 0, r: 0 },
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
      fromTileCoord: { q: 0, r: 0 },
    });

    expect(result.state.players[0]?.movePoints).toBe(2);
  });

  it("should remove tile from deck", () => {
    const state = createEdgeGameState();
    expect(state.map.tileDeck.countryside.length).toBe(2);

    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "E",
      fromTileCoord: { q: 0, r: 0 },
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
      fromTileCoord: { q: 0, r: 0 },
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
      fromTileCoord: { q: 0, r: 0 },
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
      fromTileCoord: { q: 0, r: 0 },
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
      fromTileCoord: { q: 0, r: 0 },
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
        reason: "Must be on edge of revealed map to explore",
      })
    );
  });

  it("should reject if direction already revealed or not adjacent", () => {
    // Player at (1,0) is on the E edge of tile (0,0)
    // Player is NOT adjacent to NE expansion (which would be at (2,-3))
    // and E expansion at (3,-1) is already filled
    // So trying to explore NE should fail because player isn't adjacent to that slot
    const player = createTestPlayer({
      id: "player1",
      position: { q: 1, r: 0 },
      movePoints: 4,
    });

    const baseState = createTestGameState();

    // Create hexes for tile at (0,0) and tile at (3,-2)
    const hexes: Record<string, ReturnType<typeof createTestHex>> = {
      [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
      [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
      [hexKey({ q: 3, r: -2 })]: createTestHex(3, -2, TERRAIN_PLAINS),
      [hexKey({ q: 2, r: 0 })]: createTestHex(2, 0, TERRAIN_PLAINS),
    };

    // Add tiles: original at (0,0) and one at (3,-2) so E is blocked
    // From (0,0), both E (3,-2) and NE (1,-3) are expansion directions
    // E is blocked by tile, NE is not blocked but player isn't adjacent to it
    const tiles: TilePlacement[] = [
      { tileId: TileId.Countryside1, centerCoord: { q: 0, r: 0 }, rotation: 0 },
      { tileId: TileId.Countryside2, centerCoord: { q: 3, r: -2 }, rotation: 0 },
    ];

    const state: GameState = {
      ...baseState,
      players: [player],
      map: {
        ...baseState.map,
        hexes,
        tiles,
        tileDeck: {
          countryside: [TileId.Countryside3],
          core: [],
        },
      },
    };

    // Player at (1,0) is not adjacent to NE slot (1,-3), so they can't explore at all
    // Since there are NO valid explore options from this position, we get "Cannot explore from current position"
    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "NE", // Not adjacent to this direction's target
      fromTileCoord: { q: 0, r: 0 },
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
        reason: "Cannot explore from current position",
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
      fromTileCoord: { q: 0, r: 0 },
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
      fromTileCoord: { q: 0, r: 0 },
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
      fromTileCoord: { q: 0, r: 0 },
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
    // Player at (1,-1) which is adjacent to NE expansion from tile (0,0)
    // NE tile would be at (2,-3), with hex (1,-2) being adjacent to (1,-1)
    const player = createTestPlayer({
      id: "player1",
      position: { q: 1, r: -1 },
      movePoints: 4,
    });

    const baseState = createTestGameState();
    const hexes: Record<string, ReturnType<typeof createTestHex>> = {
      [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
      [hexKey({ q: 1, r: -1 })]: createTestHex(1, -1, TERRAIN_PLAINS),
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

    // Try NE direction - player at (1,-1) is adjacent to NE expansion
    const result = engine.processAction(state, "player1", {
      type: EXPLORE_ACTION,
      direction: "NE",
      fromTileCoord: { q: 0, r: 0 },
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
        fromTileCoord: { q: 0, r: 0 },
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

  describe("explore ghost direction bug - seed123 reproduction", () => {
    /**
     * Reproduces the bug from the e2e test:
     * - Two tiles: (0,0) and (3,-1)
     * - Player at (3,-2) - NE edge of tile (3,-1)
     * - Ghost at (5,-4) should have direction "NE" (from tile 3,-1)
     * - BUG: Ghost at (5,-4) has direction "E" instead
     *
     * Map context:
     * - Tile (0,0): starting tile
     * - Tile (3,-1): placed E from (0,0)
     * - From tile (3,-1): NE → (5,-4), E → (6,-2)
     */
    it("should return correct direction for each explore target", () => {
      // Create a game state with two tiles and player at (3,-2)
      const tileHexOffsets = [
        { q: 0, r: 0 }, // center
        { q: 1, r: -1 },
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 1 },
        { q: -1, r: 0 },
        { q: 0, r: -1 },
      ];

      const tile1Center: HexCoord = { q: 0, r: 0 };
      const tile2Center: HexCoord = { q: 3, r: -2 }; // E offset from origin

      // Create hexes for both tiles
      const hexes: Record<string, ReturnType<typeof createTestHex>> = {};

      for (const offset of tileHexOffsets) {
        const coord1 = { q: tile1Center.q + offset.q, r: tile1Center.r + offset.r };
        hexes[hexKey(coord1)] = createTestHex(coord1.q, coord1.r, TERRAIN_PLAINS);

        const coord2 = { q: tile2Center.q + offset.q, r: tile2Center.r + offset.r };
        hexes[hexKey(coord2)] = createTestHex(coord2.q, coord2.r, TERRAIN_PLAINS);
      }

      // Player at (4,-3) which is the NE hex of tile (3,-2) - an edge hex
      const player = createTestPlayer({
        id: "player1",
        position: { q: 4, r: -3 },
        movePoints: 10,
      });

      const baseState = createTestGameState();

      // Record both tiles
      const tiles: TilePlacement[] = [
        { tileId: TileId.StartingTileA, centerCoord: tile1Center, rotation: 0 },
        { tileId: TileId.Countryside1, centerCoord: tile2Center, rotation: 0 },
      ];

      const state: GameState = {
        ...baseState,
        players: [player],
        map: {
          ...baseState.map,
          hexes,
          tiles,
          tileDeck: {
            countryside: [TileId.Countryside2, TileId.Countryside3],
            core: [],
          },
        },
      };

      // Verify findTileCenterForHex returns correct tile for player position
      const tileCenters = state.map.tiles.map((t) => t.centerCoord);
      const playerTileCenter = findTileCenterForHex(player.position, tileCenters);
      console.log("Player position:", player.position);
      console.log("Player tile center:", playerTileCenter);
      expect(playerTileCenter).toEqual({ q: 3, r: -2 }); // Player at (4,-3) is NE hex of tile (3,-2)

      // Get the valid explore options
      const exploreOptions = getValidExploreOptions(state, player);

      expect(exploreOptions).toBeDefined();
      if (!exploreOptions) return; // Type guard for following assertions

      expect(exploreOptions.directions.length).toBeGreaterThan(0);

      // Find the direction for target (4,-5)
      // This should be "NE" since (4,-5) = (3,-2) + NE_offset = (3+1, -2-3) = (4,-5)
      const target4_5 = exploreOptions.directions.find(
        (d: { targetCoord: HexCoord }) => d.targetCoord.q === 4 && d.targetCoord.r === -5
      );

      // Find the direction for target (6,-4)
      // This should be "E" since (6,-4) = (3,-2) + E_offset = (3+3, -2-2) = (6,-4)
      const target6_4 = exploreOptions.directions.find(
        (d: { targetCoord: HexCoord }) => d.targetCoord.q === 6 && d.targetCoord.r === -4
      );

      // Log for debugging
      console.log("Explore options:", JSON.stringify(exploreOptions.directions, null, 2));
      console.log("Target (4,-5):", target4_5);
      console.log("Target (6,-4):", target6_4);

      // CRITICAL: (3,-2) should NOT be in the list because a tile already exists there!
      const target3_2 = exploreOptions.directions.find(
        (d: { targetCoord: HexCoord }) => d.targetCoord.q === 3 && d.targetCoord.r === -2
      );
      expect(target3_2).toBeUndefined();

      // Verify the directions are correct
      // (4,-5) should be NE from tile (3,-2)
      if (target4_5) {
        expect(target4_5.direction).toBe("NE");
      }

      // (6,-4) should be E from tile (3,-2)
      if (target6_4) {
        expect(target6_4.direction).toBe("E");
      }

      // At least one of these targets should exist
      expect(target4_5 || target6_4).toBeDefined();
    });
  });
});
