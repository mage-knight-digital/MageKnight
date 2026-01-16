/**
 * Tests for pathfinding with MULTIPLE rampaging enemies.
 *
 * Bug: The pathfinding algorithm incorrectly marks hexes as terminal (will trigger combat)
 * when skirting multiple rampaging enemies. The player should be able to:
 * 1. Move adjacent to enemy A (no provoke - wasn't adjacent before)
 * 2. Move away from enemy A to a hex adjacent to enemy B (no provoke - different enemy)
 * 3. Move away from enemy B to a hex not adjacent to either (no provoke - moved away)
 *
 * The algorithm should track which SPECIFIC enemy would be provoked, not just
 * "any rampaging enemy was adjacent".
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
import { resetTokenCounter, createEnemyTokenId } from "../helpers/enemyHelpers.js";
import { ENEMY_DIGGERS, ENEMY_WEREWOLF } from "@mage-knight/shared";
import { getValidMoveTargets } from "../validActions/movement.js";

describe("Multiple Rampaging Enemies Pathfinding", () => {
  beforeEach(() => {
    resetTokenCounter();
  });

  /**
   * Helper to check if a hex is in the reachable list and whether it's terminal
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

  describe("Skirting multiple enemies correctly", () => {
    /**
     * Scenario setup:
     *
     *   Enemy A at (0, -1) - only adjacent to X1
     *   Enemy B at (-1, 2) - only adjacent to X2
     *
     *   Path: Start(1,0) → X1(0,0) → X2(0,1) → X3(1,1)
     *
     *   - Start is adjacent to X1 but not to A or B
     *   - X1 is adjacent to A
     *   - X2 is NOT adjacent to A but IS adjacent to B
     *   - X3 is NOT adjacent to A or B
     *
     * Expected: All hexes should be reachable, X3 should NOT be terminal
     */
    it("should allow skirting different rampaging enemies without triggering combat", () => {
      let state = createTestGameState();

      // Positions
      const startPos = { q: 1, r: 0 };
      const x1Pos = { q: 0, r: 0 };
      const x2Pos = { q: 0, r: 1 };
      const x3Pos = { q: 1, r: 1 };
      const enemyAPos = { q: 0, r: -1 };
      const enemyBPos = { q: -1, r: 2 };

      // Verify our adjacency assumptions
      expect(isAdjacent(startPos, x1Pos)).toBe(true); // Start adjacent to X1
      expect(isAdjacent(startPos, enemyAPos)).toBe(false); // Start NOT adjacent to A
      expect(isAdjacent(startPos, enemyBPos)).toBe(false); // Start NOT adjacent to B

      expect(isAdjacent(x1Pos, enemyAPos)).toBe(true); // X1 adjacent to A
      expect(isAdjacent(x1Pos, enemyBPos)).toBe(false); // X1 NOT adjacent to B

      expect(isAdjacent(x2Pos, enemyAPos)).toBe(false); // X2 NOT adjacent to A
      expect(isAdjacent(x2Pos, enemyBPos)).toBe(true); // X2 adjacent to B

      expect(isAdjacent(x3Pos, enemyAPos)).toBe(false); // X3 NOT adjacent to A
      expect(isAdjacent(x3Pos, enemyBPos)).toBe(false); // X3 NOT adjacent to B

      // Create player with enough move points
      const player = createTestPlayer({
        id: "player1",
        position: startPos,
        movePoints: 10, // Enough to reach all hexes
      });

      // Create enemy tokens
      const enemyAToken = createEnemyTokenId(ENEMY_DIGGERS);
      const enemyBToken = createEnemyTokenId(ENEMY_WEREWOLF);

      // Create all hexes
      const hexes: Record<string, HexState> = {
        [hexKey(startPos)]: createTestHex(startPos.q, startPos.r, TERRAIN_PLAINS),
        [hexKey(x1Pos)]: createTestHex(x1Pos.q, x1Pos.r, TERRAIN_PLAINS),
        [hexKey(x2Pos)]: createTestHex(x2Pos.q, x2Pos.r, TERRAIN_PLAINS),
        [hexKey(x3Pos)]: createTestHex(x3Pos.q, x3Pos.r, TERRAIN_PLAINS),
        [hexKey(enemyAPos)]: {
          ...createTestHex(enemyAPos.q, enemyAPos.r, TERRAIN_PLAINS),
          rampagingEnemies: [RampagingEnemyType.OrcMarauder],
          enemies: [createHexEnemy(enemyAToken)],
        },
        [hexKey(enemyBPos)]: {
          ...createTestHex(enemyBPos.q, enemyBPos.r, TERRAIN_PLAINS),
          rampagingEnemies: [RampagingEnemyType.Draconum],
          enemies: [createHexEnemy(enemyBToken)],
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

      // Get move options
      const moveOptions = getValidMoveTargets(state, player);

      expect(moveOptions).toBeDefined();
      expect(moveOptions?.reachable).toBeDefined();

      // X1 should be reachable and NOT terminal (just approaching enemy A)
      const x1Reachable = findReachableHex(moveOptions?.reachable, x1Pos.q, x1Pos.r);
      expect(x1Reachable).toBeDefined();
      expect(x1Reachable?.isTerminal).toBe(false);

      // X2 should be reachable and NOT terminal (moving away from A toward B)
      const x2Reachable = findReachableHex(moveOptions?.reachable, x2Pos.q, x2Pos.r);
      expect(x2Reachable).toBeDefined();
      expect(x2Reachable?.isTerminal).toBe(false);

      // X3 should be reachable and NOT terminal (moving away from B)
      // THIS IS THE BUG: The pathfinding may incorrectly mark X3 as terminal
      const x3Reachable = findReachableHex(moveOptions?.reachable, x3Pos.q, x3Pos.r);
      expect(x3Reachable).toBeDefined();
      expect(x3Reachable?.isTerminal).toBe(false);
    });

    /**
     * Contrast test: Skirting the SAME enemy SHOULD trigger combat
     */
    it("should correctly trigger combat when skirting the SAME rampaging enemy", () => {
      let state = createTestGameState();

      // Positions - X1 and X2 are both adjacent to the same enemy A
      // Enemy A at (1, -1), X1 at (0, 0), X2 at (1, 0)
      // Both X1 and X2 share (1,-1) as a common neighbor
      const startPos = { q: -1, r: 0 }; // Not adjacent to A
      const x1Pos = { q: 0, r: 0 };
      const x2Pos = { q: 1, r: 0 };
      const enemyAPos = { q: 1, r: -1 }; // Common neighbor of X1 and X2

      // Verify adjacency
      expect(isAdjacent(startPos, enemyAPos)).toBe(false); // Start NOT adjacent to A
      expect(isAdjacent(startPos, x1Pos)).toBe(true); // Start adjacent to X1
      expect(isAdjacent(x1Pos, enemyAPos)).toBe(true); // X1 adjacent to A
      expect(isAdjacent(x2Pos, enemyAPos)).toBe(true); // X2 also adjacent to A
      expect(isAdjacent(x1Pos, x2Pos)).toBe(true); // X1 adjacent to X2

      // Create player
      const player = createTestPlayer({
        id: "player1",
        position: startPos,
        movePoints: 10,
      });

      const enemyAToken = createEnemyTokenId(ENEMY_DIGGERS);

      const hexes: Record<string, HexState> = {
        [hexKey(startPos)]: createTestHex(startPos.q, startPos.r, TERRAIN_PLAINS),
        [hexKey(x1Pos)]: createTestHex(x1Pos.q, x1Pos.r, TERRAIN_PLAINS),
        [hexKey(x2Pos)]: createTestHex(x2Pos.q, x2Pos.r, TERRAIN_PLAINS),
        [hexKey(enemyAPos)]: {
          ...createTestHex(enemyAPos.q, enemyAPos.r, TERRAIN_PLAINS),
          rampagingEnemies: [RampagingEnemyType.OrcMarauder],
          enemies: [createHexEnemy(enemyAToken)],
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

      // X1 should be reachable and NOT terminal (just approaching enemy A)
      const x1Reachable = findReachableHex(moveOptions?.reachable, x1Pos.q, x1Pos.r);
      expect(x1Reachable).toBeDefined();
      expect(x1Reachable?.isTerminal).toBe(false);

      // X2 should be marked as terminal because the path to it goes through X1,
      // and moving from X1 to X2 provokes enemy A (both X1 and X2 are adjacent to A)
      const x2Reachable = findReachableHex(moveOptions?.reachable, x2Pos.q, x2Pos.r);
      expect(x2Reachable).toBeDefined();
      expect(x2Reachable?.isTerminal).toBe(true);
    });

    /**
     * Edge case: Player starts adjacent to a rampaging enemy and moves away
     *
     * Setup:
     * - Start at (0, 0), adjacent to enemy A at (0, -1)
     * - X1 at (0, 1), NOT adjacent to A, adjacent to enemy B at (-1, 2)
     * - X2 at (1, 1), NOT adjacent to A or B
     *
     * Path: Start → X1 → X2
     * - Start→X1: Not provoking A (X1 is not adjacent to A)
     * - X1→X2: Not provoking B (X2 is not adjacent to B)
     */
    it("should handle starting adjacent to one rampaging enemy and moving away through another", () => {
      let state = createTestGameState();

      const startPos = { q: 0, r: 0 };
      const x1Pos = { q: 0, r: 1 };
      const x2Pos = { q: 1, r: 1 };
      const enemyAPos = { q: 0, r: -1 }; // Adjacent to start only
      const enemyBPos = { q: -1, r: 2 }; // Adjacent to X1 only

      // Verify adjacency
      expect(isAdjacent(startPos, enemyAPos)).toBe(true); // Start adjacent to A
      expect(isAdjacent(startPos, x1Pos)).toBe(true); // Start adjacent to X1
      expect(isAdjacent(x1Pos, enemyAPos)).toBe(false); // X1 NOT adjacent to A
      expect(isAdjacent(x1Pos, enemyBPos)).toBe(true); // X1 adjacent to B
      expect(isAdjacent(x1Pos, x2Pos)).toBe(true); // X1 adjacent to X2
      expect(isAdjacent(x2Pos, enemyAPos)).toBe(false); // X2 NOT adjacent to A
      expect(isAdjacent(x2Pos, enemyBPos)).toBe(false); // X2 NOT adjacent to B

      const player = createTestPlayer({
        id: "player1",
        position: startPos,
        movePoints: 10,
      });

      const enemyAToken = createEnemyTokenId(ENEMY_DIGGERS);
      const enemyBToken = createEnemyTokenId(ENEMY_WEREWOLF);

      const hexes: Record<string, HexState> = {
        [hexKey(startPos)]: createTestHex(startPos.q, startPos.r, TERRAIN_PLAINS),
        [hexKey(x1Pos)]: createTestHex(x1Pos.q, x1Pos.r, TERRAIN_PLAINS),
        [hexKey(x2Pos)]: createTestHex(x2Pos.q, x2Pos.r, TERRAIN_PLAINS),
        [hexKey(enemyAPos)]: {
          ...createTestHex(enemyAPos.q, enemyAPos.r, TERRAIN_PLAINS),
          rampagingEnemies: [RampagingEnemyType.OrcMarauder],
          enemies: [createHexEnemy(enemyAToken)],
        },
        [hexKey(enemyBPos)]: {
          ...createTestHex(enemyBPos.q, enemyBPos.r, TERRAIN_PLAINS),
          rampagingEnemies: [RampagingEnemyType.Draconum],
          enemies: [createHexEnemy(enemyBToken)],
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

      // X1 should be reachable - moving away from A to approach B
      // This should NOT provoke A because X1 is not adjacent to A
      const x1Reachable = findReachableHex(moveOptions?.reachable, x1Pos.q, x1Pos.r);
      expect(x1Reachable).toBeDefined();
      expect(x1Reachable?.isTerminal).toBe(false);

      // X2 should be reachable - moving away from B
      // This should NOT provoke B because X2 is not adjacent to B
      const x2Reachable = findReachableHex(moveOptions?.reachable, x2Pos.q, x2Pos.r);
      expect(x2Reachable).toBeDefined();
      expect(x2Reachable?.isTerminal).toBe(false);
    });
  });

  describe("Initial move provoke check", () => {
    /**
     * Test that moving from start position to an adjacent hex that shares a rampaging
     * enemy as a common neighbor correctly marks the move as terminal.
     *
     * This tests a potential bug where initial neighbors (cameFromKey === startKey)
     * might not be checked for provoking.
     */
    it("should correctly mark initial moves that provoke as terminal", () => {
      let state = createTestGameState();

      // Setup: Player at (0,0), Enemy at (1,-1)
      // Moving to (1,0) would provoke because both (0,0) and (1,0) are adjacent to (1,-1)
      const startPos = { q: 0, r: 0 };
      const targetPos = { q: 1, r: 0 };
      const enemyPos = { q: 1, r: -1 };

      // Verify adjacency - enemy should be adjacent to both start and target
      expect(isAdjacent(startPos, enemyPos)).toBe(true);
      expect(isAdjacent(targetPos, enemyPos)).toBe(true);

      const player = createTestPlayer({
        id: "player1",
        position: startPos,
        movePoints: 10,
      });

      const enemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      const hexes: Record<string, HexState> = {
        [hexKey(startPos)]: createTestHex(startPos.q, startPos.r, TERRAIN_PLAINS),
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

      // Check direct targets - the immediate move should be marked as terminal
      const directTarget = moveOptions?.targets.find(
        (t) => t.hex.q === targetPos.q && t.hex.r === targetPos.r
      );
      expect(directTarget).toBeDefined();
      expect(directTarget?.isTerminal).toBe(true);

      // Also check reachable hexes
      const reachableTarget = findReachableHex(
        moveOptions?.reachable,
        targetPos.q,
        targetPos.r
      );
      expect(reachableTarget).toBeDefined();
      expect(reachableTarget?.isTerminal).toBe(true);
    });
  });

  describe("User reported scenario", () => {
    /**
     * Corrected scenario from user:
     * - Start at (1, 2) - NOT adjacent to any enemy
     * - Rampaging enemy A at (0, 1)
     * - Rampaging enemy B at (3, 0)
     * - Path: (1,2) → (1,1) → (2,0) → (2,-1)
     *
     * At each step, the "from" and "to" hexes don't share a common neighbor
     * with any rampaging enemy, so no combat should be triggered.
     */
    it("should allow reaching (2,-1) without provoking - corrected scenario", () => {
      let state = createTestGameState();

      const startPos = { q: 1, r: 2 };
      const enemyAPos = { q: 0, r: 1 };
      const enemyBPos = { q: 3, r: 0 };
      const targetPos = { q: 2, r: -1 };

      // Intermediate hexes in the path
      const hex11 = { q: 1, r: 1 };
      const hex20 = { q: 2, r: 0 };

      // Verify adjacencies for the path
      // Start (1,2) should NOT be adjacent to either enemy
      expect(isAdjacent(startPos, enemyAPos)).toBe(false);
      expect(isAdjacent(startPos, enemyBPos)).toBe(false);

      // (1,1) is adjacent to enemy A but that's OK - we just approach, not skirt
      expect(isAdjacent(hex11, enemyAPos)).toBe(true);
      expect(isAdjacent(hex11, enemyBPos)).toBe(false);

      // (2,0) is adjacent to enemy B but NOT enemy A
      expect(isAdjacent(hex20, enemyBPos)).toBe(true);
      expect(isAdjacent(hex20, enemyAPos)).toBe(false);

      // (2,-1) should NOT be adjacent to either enemy
      expect(isAdjacent(targetPos, enemyAPos)).toBe(false);
      expect(isAdjacent(targetPos, enemyBPos)).toBe(false);

      // Verify NO provoking at each step (no common enemy neighbors)
      // Step 1: (1,2) → (1,1) - common neighbors should not include enemy hexes
      const step1From = getAllNeighbors(startPos);
      const step1To = getAllNeighbors(hex11);
      const step1Common = step1From.filter(n => step1To.some(t => t.q === n.q && t.r === n.r));
      expect(step1Common.some(n => n.q === enemyAPos.q && n.r === enemyAPos.r)).toBe(false);
      expect(step1Common.some(n => n.q === enemyBPos.q && n.r === enemyBPos.r)).toBe(false);

      // Step 2: (1,1) → (2,0) - common neighbors should not include enemy hexes
      const step2From = getAllNeighbors(hex11);
      const step2To = getAllNeighbors(hex20);
      const step2Common = step2From.filter(n => step2To.some(t => t.q === n.q && t.r === n.r));
      expect(step2Common.some(n => n.q === enemyAPos.q && n.r === enemyAPos.r)).toBe(false);
      expect(step2Common.some(n => n.q === enemyBPos.q && n.r === enemyBPos.r)).toBe(false);

      // Step 3: (2,0) → (2,-1) - common neighbors should not include enemy hexes
      const step3From = getAllNeighbors(hex20);
      const step3To = getAllNeighbors(targetPos);
      const step3Common = step3From.filter(n => step3To.some(t => t.q === n.q && t.r === n.r));
      expect(step3Common.some(n => n.q === enemyAPos.q && n.r === enemyAPos.r)).toBe(false);
      expect(step3Common.some(n => n.q === enemyBPos.q && n.r === enemyBPos.r)).toBe(false);

      const player = createTestPlayer({
        id: "player1",
        position: startPos,
        movePoints: 20, // "basically unlimited"
      });

      const enemyAToken = createEnemyTokenId(ENEMY_DIGGERS);
      const enemyBToken = createEnemyTokenId(ENEMY_WEREWOLF);

      // Create all hexes needed for the path
      const hexes: Record<string, HexState> = {
        [hexKey(startPos)]: createTestHex(startPos.q, startPos.r, TERRAIN_PLAINS),
        [hexKey(hex11)]: createTestHex(hex11.q, hex11.r, TERRAIN_PLAINS),
        [hexKey(hex20)]: createTestHex(hex20.q, hex20.r, TERRAIN_PLAINS),
        [hexKey(targetPos)]: createTestHex(targetPos.q, targetPos.r, TERRAIN_PLAINS),
        // Add hexes for alternate paths and common neighbors
        [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
        [hexKey({ q: 2, r: 1 })]: createTestHex(2, 1, TERRAIN_PLAINS),
        [hexKey({ q: 0, r: 2 })]: createTestHex(0, 2, TERRAIN_PLAINS),
        [hexKey({ q: 3, r: -1 })]: createTestHex(3, -1, TERRAIN_PLAINS),
        [hexKey(enemyAPos)]: {
          ...createTestHex(enemyAPos.q, enemyAPos.r, TERRAIN_PLAINS),
          rampagingEnemies: [RampagingEnemyType.OrcMarauder],
          enemies: [createHexEnemy(enemyAToken)],
        },
        [hexKey(enemyBPos)]: {
          ...createTestHex(enemyBPos.q, enemyBPos.r, TERRAIN_PLAINS),
          rampagingEnemies: [RampagingEnemyType.Draconum],
          enemies: [createHexEnemy(enemyBToken)],
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

      // Log what we got for debugging
      console.log("=== Corrected User Scenario Test ===");
      console.log("Reachable hexes:", moveOptions?.reachable?.map(h =>
        `(${h.hex.q},${h.hex.r}) terminal=${h.isTerminal}`
      ));

      // Check each step of the path is reachable and NOT terminal
      const hex11Reachable = findReachableHex(moveOptions?.reachable, hex11.q, hex11.r);
      expect(hex11Reachable).toBeDefined();
      expect(hex11Reachable?.isTerminal).not.toBe(true);

      const hex20Reachable = findReachableHex(moveOptions?.reachable, hex20.q, hex20.r);
      expect(hex20Reachable).toBeDefined();
      expect(hex20Reachable?.isTerminal).not.toBe(true);

      // The final target should be reachable and NOT terminal
      const targetReachable = findReachableHex(moveOptions?.reachable, targetPos.q, targetPos.r);
      expect(targetReachable).toBeDefined();
      expect(targetReachable?.isTerminal).not.toBe(true);
    });

    /**
     * Simpler version: Test just the (2,0) → (2,-1) step
     * If player is at (2,0) adjacent to enemy B at (3,0),
     * moving to (2,-1) should NOT provoke because (2,-1) is not adjacent to B
     */
    it("should allow moving from (2,0) to (2,-1) when only adjacent to enemy at (3,0)", () => {
      let state = createTestGameState();

      const startPos = { q: 2, r: 0 };
      const targetPos = { q: 2, r: -1 };
      const enemyBPos = { q: 3, r: 0 };

      // Verify: start is adjacent to enemy, target is NOT
      expect(isAdjacent(startPos, enemyBPos)).toBe(true);
      expect(isAdjacent(targetPos, enemyBPos)).toBe(false);

      const player = createTestPlayer({
        id: "player1",
        position: startPos,
        movePoints: 10,
      });

      const enemyBToken = createEnemyTokenId(ENEMY_WEREWOLF);

      const hexes: Record<string, HexState> = {
        [hexKey(startPos)]: createTestHex(startPos.q, startPos.r, TERRAIN_PLAINS),
        [hexKey(targetPos)]: createTestHex(targetPos.q, targetPos.r, TERRAIN_PLAINS),
        [hexKey(enemyBPos)]: {
          ...createTestHex(enemyBPos.q, enemyBPos.r, TERRAIN_PLAINS),
          rampagingEnemies: [RampagingEnemyType.Draconum],
          enemies: [createHexEnemy(enemyBToken)],
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

      // Debug: log what we got
      console.log("=== Move from (2,0) to (2,-1) test ===");
      console.log("Targets:", moveOptions?.targets?.map(t =>
        `(${t.hex.q},${t.hex.r}) terminal=${t.isTerminal}`
      ));
      console.log("Reachable:", moveOptions?.reachable?.map(h =>
        `(${h.hex.q},${h.hex.r}) terminal=${h.isTerminal}`
      ));

      // Direct target should exist and NOT be terminal
      const directTarget = moveOptions?.targets.find(
        (t) => t.hex.q === targetPos.q && t.hex.r === targetPos.r
      );
      expect(directTarget).toBeDefined();
      // isTerminal is optional - undefined means not terminal
      expect(directTarget?.isTerminal).not.toBe(true);

      // Reachable should also show it as non-terminal
      const reachableTarget = findReachableHex(moveOptions?.reachable, targetPos.q, targetPos.r);
      expect(reachableTarget).toBeDefined();
      expect(reachableTarget?.isTerminal).not.toBe(true);
    });
  });

  describe("Detailed path analysis", () => {
    /**
     * This test verifies the common neighbor calculation for each step
     */
    it("should correctly identify common neighbors at each step", () => {
      // Positions from the first test
      const startPos = { q: 1, r: 0 };
      const x1Pos = { q: 0, r: 0 };
      const x2Pos = { q: 0, r: 1 };
      const x3Pos = { q: 1, r: 1 };
      const enemyAPos = { q: 0, r: -1 };
      const enemyBPos = { q: -1, r: 2 };

      // Step 1: Start → X1
      const startNeighbors = getAllNeighbors(startPos);
      const x1Neighbors = getAllNeighbors(x1Pos);
      const commonStartX1 = startNeighbors.filter((n) =>
        x1Neighbors.some((x1n) => x1n.q === n.q && x1n.r === n.r)
      );
      // Enemy A should NOT be in common neighbors
      const enemyAInCommonStartX1 = commonStartX1.some(
        (n) => n.q === enemyAPos.q && n.r === enemyAPos.r
      );
      expect(enemyAInCommonStartX1).toBe(false);

      // Step 2: X1 → X2
      const x2Neighbors = getAllNeighbors(x2Pos);
      const commonX1X2 = x1Neighbors.filter((n) =>
        x2Neighbors.some((x2n) => x2n.q === n.q && x2n.r === n.r)
      );
      // Neither A nor B should be in common neighbors
      const enemyAInCommonX1X2 = commonX1X2.some(
        (n) => n.q === enemyAPos.q && n.r === enemyAPos.r
      );
      const enemyBInCommonX1X2 = commonX1X2.some(
        (n) => n.q === enemyBPos.q && n.r === enemyBPos.r
      );
      expect(enemyAInCommonX1X2).toBe(false);
      expect(enemyBInCommonX1X2).toBe(false);

      // Step 3: X2 → X3
      const x3Neighbors = getAllNeighbors(x3Pos);
      const commonX2X3 = x2Neighbors.filter((n) =>
        x3Neighbors.some((x3n) => x3n.q === n.q && x3n.r === n.r)
      );
      // Neither A nor B should be in common neighbors
      const enemyAInCommonX2X3 = commonX2X3.some(
        (n) => n.q === enemyAPos.q && n.r === enemyAPos.r
      );
      const enemyBInCommonX2X3 = commonX2X3.some(
        (n) => n.q === enemyBPos.q && n.r === enemyBPos.r
      );
      expect(enemyAInCommonX2X3).toBe(false);
      expect(enemyBInCommonX2X3).toBe(false);
    });
  });
});
