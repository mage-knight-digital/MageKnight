/**
 * Tests for pathfinding terminal hex detection.
 *
 * Bug: The pathfinding arrow in the client can show a path as non-terminal (green)
 * when it should be terminal. This happens when a multi-hop path passes through
 * hexes where consecutive steps would provoke a rampaging enemy.
 *
 * The root cause could be in:
 * 1. Server-side `getReachableHexes()` marking hexes as non-terminal incorrectly
 * 2. Client-side A* pathfinding not considering rampaging provocation along the path
 *
 * These tests verify the server-side reachability calculation is correct.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
  createHexEnemy,
} from "./testHelpers.js";
import {
  TERRAIN_PLAINS,
  hexKey,
  getAllNeighbors,
} from "@mage-knight/shared";
import { RampagingEnemyType } from "../../types/map.js";
import type { HexState } from "../../types/map.js";
import { resetTokenCounter, createEnemyTokenId } from "../helpers/enemy/index.js";
import { ENEMY_DIGGERS } from "@mage-knight/shared";
import { getValidMoveTargets } from "../validActions/movement.js";

describe("Pathfinding Terminal Hex Detection", () => {
  beforeEach(() => {
    resetTokenCounter();
  });

  /**
   * Helper to check if a hex is in the reachable list and get its terminal status
   */
  function findReachableHex(
    reachable: { hex: { q: number; r: number }; totalCost: number; isTerminal: boolean }[] | undefined,
    q: number,
    r: number
  ): { hex: { q: number; r: number }; totalCost: number; isTerminal: boolean } | undefined {
    return reachable?.find((h) => h.hex.q === q && h.hex.r === r);
  }

  /**
   * Helper to verify adjacency between two hex coordinates
   */
  function isAdjacent(
    coord1: { q: number; r: number },
    coord2: { q: number; r: number }
  ): boolean {
    const neighbors = getAllNeighbors(coord1);
    return neighbors.some((n) => n.q === coord2.q && n.r === coord2.r);
  }

  describe("User-reported bug: Path arrow shows green when it should be terminal", () => {
    /**
     * Scenario from user:
     * - Player at (0, -1)
     * - Rampaging enemy at (1, -3)
     * - Hover over (2, -3)
     * - Path shown: (0,-1) → (1,-2) → (2,-3)
     *
     * The bug: (2,-3) is shown as non-terminal (green) but it SHOULD be terminal
     * because moving from (1,-2) to (2,-3) provokes the enemy at (1,-3)
     * (both hexes are adjacent to the enemy).
     *
     * Adjacencies:
     * - Enemy (1,-3) neighbors: (2,-4), (2,-3), (1,-2), (0,-2), (0,-3), (1,-4)
     * - (1,-2) IS adjacent to enemy ✓
     * - (2,-3) IS adjacent to enemy ✓
     * - Common neighbor of (1,-2) and (2,-3) includes (1,-3) ← the enemy!
     */
    it("should mark (2,-3) as terminal when path from (1,-2) would provoke enemy at (1,-3)", () => {
      let state = createTestGameState();

      // Positions
      const startPos = { q: 0, r: -1 };
      const enemyPos = { q: 1, r: -3 };
      const intermediatePos = { q: 1, r: -2 }; // Path goes through here
      const targetPos = { q: 2, r: -3 }; // Should be terminal

      // Verify adjacency assumptions
      expect(isAdjacent(startPos, enemyPos)).toBe(false); // Start NOT adjacent to enemy
      expect(isAdjacent(intermediatePos, enemyPos)).toBe(true); // (1,-2) IS adjacent to enemy
      expect(isAdjacent(targetPos, enemyPos)).toBe(true); // (2,-3) IS adjacent to enemy

      // Verify that (1,-2) and (2,-3) share the enemy as a common neighbor
      const intermediateNeighbors = getAllNeighbors(intermediatePos);
      const targetNeighbors = getAllNeighbors(targetPos);
      const commonNeighbors = intermediateNeighbors.filter((n) =>
        targetNeighbors.some((t) => t.q === n.q && t.r === n.r)
      );
      const enemyIsCommonNeighbor = commonNeighbors.some(
        (n) => n.q === enemyPos.q && n.r === enemyPos.r
      );
      expect(enemyIsCommonNeighbor).toBe(true); // Confirms provoking would occur

      // Create player with lots of move points
      const player = createTestPlayer({
        id: "player1",
        position: startPos,
        movePoints: 100,
      });

      const enemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      // Build the map with all hexes needed for the path
      const hexes: Record<string, HexState> = {
        [hexKey(startPos)]: createTestHex(startPos.q, startPos.r, TERRAIN_PLAINS),
        [hexKey(intermediatePos)]: createTestHex(intermediatePos.q, intermediatePos.r, TERRAIN_PLAINS),
        [hexKey(targetPos)]: createTestHex(targetPos.q, targetPos.r, TERRAIN_PLAINS),
        // Add hex between start and intermediate
        [hexKey({ q: 0, r: -2 })]: createTestHex(0, -2, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: -1 })]: createTestHex(1, -1, TERRAIN_PLAINS),
        // Enemy hex
        [hexKey(enemyPos)]: {
          ...createTestHex(enemyPos.q, enemyPos.r, TERRAIN_PLAINS),
          rampagingEnemies: [RampagingEnemyType.OrcMarauder],
          enemies: [createHexEnemy(enemyToken)],
        },
      };

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes,
        },
      };

      const moveOptions = getValidMoveTargets(state, player);

      expect(moveOptions).toBeDefined();
      expect(moveOptions?.reachable).toBeDefined();

      // The intermediate hex (1,-2) should be reachable and NOT terminal
      // (just approaching the enemy, not skirting it)
      const intermediateReachable = findReachableHex(
        moveOptions?.reachable,
        intermediatePos.q,
        intermediatePos.r
      );
      expect(intermediateReachable).toBeDefined();
      expect(intermediateReachable?.isTerminal).toBe(false);

      // The target hex (2,-3) MUST be marked as terminal
      // because the path to reach it (via (1,-2)) provokes the enemy
      const targetReachable = findReachableHex(
        moveOptions?.reachable,
        targetPos.q,
        targetPos.r
      );
      expect(targetReachable).toBeDefined();
      expect(targetReachable?.isTerminal).toBe(true); // THIS IS THE BUG - currently fails
    });

    /**
     * Contrast test: Direct path that correctly shows terminal
     *
     * From the same scenario, hovering over (0,-3) correctly shows terminal.
     * Path: (0,-1) → (0,-2) → (0,-3)
     * - (0,-2) IS adjacent to enemy (1,-3)
     * - (0,-3) IS adjacent to enemy (1,-3)
     * - Moving from (0,-2) to (0,-3) provokes
     */
    it("should correctly mark (0,-3) as terminal (this already works)", () => {
      let state = createTestGameState();

      const startPos = { q: 0, r: -1 };
      const enemyPos = { q: 1, r: -3 };
      const intermediatePos = { q: 0, r: -2 };
      const targetPos = { q: 0, r: -3 };

      // Verify adjacencies
      expect(isAdjacent(intermediatePos, enemyPos)).toBe(true);
      expect(isAdjacent(targetPos, enemyPos)).toBe(true);

      const player = createTestPlayer({
        id: "player1",
        position: startPos,
        movePoints: 100,
      });

      const enemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      const hexes: Record<string, HexState> = {
        [hexKey(startPos)]: createTestHex(startPos.q, startPos.r, TERRAIN_PLAINS),
        [hexKey(intermediatePos)]: createTestHex(intermediatePos.q, intermediatePos.r, TERRAIN_PLAINS),
        [hexKey(targetPos)]: createTestHex(targetPos.q, targetPos.r, TERRAIN_PLAINS),
        [hexKey(enemyPos)]: {
          ...createTestHex(enemyPos.q, enemyPos.r, TERRAIN_PLAINS),
          rampagingEnemies: [RampagingEnemyType.OrcMarauder],
          enemies: [createHexEnemy(enemyToken)],
        },
      };

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes,
        },
      };

      const moveOptions = getValidMoveTargets(state, player);

      expect(moveOptions).toBeDefined();

      const targetReachable = findReachableHex(
        moveOptions?.reachable,
        targetPos.q,
        targetPos.r
      );
      expect(targetReachable).toBeDefined();
      expect(targetReachable?.isTerminal).toBe(true); // This should pass
    });
  });

  describe("Original scenario: 3-hop path with provoking at last step", () => {
    /**
     * Original bug report scenario:
     * - Player at (0, 0)
     * - Rampaging enemy at (3, -2)
     * - Path shows: (0,0) → (1,-1) → (2,-2) → (3,-3)
     *
     * The bug: (3,-3) should be terminal because moving from (2,-2) to (3,-3)
     * provokes the enemy at (3,-2).
     */
    it("should mark (3,-3) as terminal when reached via (2,-2) with enemy at (3,-2)", () => {
      let state = createTestGameState();

      const startPos = { q: 0, r: 0 };
      const enemyPos = { q: 3, r: -2 };
      const targetPos = { q: 3, r: -3 };
      const prevHop = { q: 2, r: -2 };

      // Verify the provoking condition
      expect(isAdjacent(prevHop, enemyPos)).toBe(true);
      expect(isAdjacent(targetPos, enemyPos)).toBe(true);

      // Verify enemy is common neighbor
      const prevNeighbors = getAllNeighbors(prevHop);
      const targetNeighbors = getAllNeighbors(targetPos);
      const commonNeighbors = prevNeighbors.filter((n) =>
        targetNeighbors.some((t) => t.q === n.q && t.r === n.r)
      );
      expect(commonNeighbors.some((n) => n.q === enemyPos.q && n.r === enemyPos.r)).toBe(true);

      const player = createTestPlayer({
        id: "player1",
        position: startPos,
        movePoints: 100,
      });

      const enemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      // Build map with all path hexes
      const hexes: Record<string, HexState> = {
        [hexKey(startPos)]: createTestHex(startPos.q, startPos.r, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: -1 })]: createTestHex(1, -1, TERRAIN_PLAINS),
        [hexKey({ q: 2, r: -2 })]: createTestHex(2, -2, TERRAIN_PLAINS),
        [hexKey(targetPos)]: createTestHex(targetPos.q, targetPos.r, TERRAIN_PLAINS),
        // Also add some alternate path hexes
        [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
        [hexKey({ q: 2, r: -1 })]: createTestHex(2, -1, TERRAIN_PLAINS),
        [hexKey({ q: 2, r: -3 })]: createTestHex(2, -3, TERRAIN_PLAINS),
        [hexKey(enemyPos)]: {
          ...createTestHex(enemyPos.q, enemyPos.r, TERRAIN_PLAINS),
          rampagingEnemies: [RampagingEnemyType.OrcMarauder],
          enemies: [createHexEnemy(enemyToken)],
        },
      };

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes,
        },
      };

      const moveOptions = getValidMoveTargets(state, player);

      expect(moveOptions).toBeDefined();
      expect(moveOptions?.reachable).toBeDefined();

      // (3,-3) should be terminal when reached via (2,-2)
      const targetReachable = findReachableHex(
        moveOptions?.reachable,
        targetPos.q,
        targetPos.r
      );
      expect(targetReachable).toBeDefined();
      expect(targetReachable?.isTerminal).toBe(true);
    });
  });
});
