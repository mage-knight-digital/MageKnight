/**
 * Tests for client-side path reconstruction from server-provided cameFrom links
 *
 * The client reconstructs paths using cameFrom links from the server's Dijkstra
 * computation. This ensures the displayed path exactly matches what the server
 * computed, avoiding issues where a different path algorithm might find a
 * provoking path when a non-provoking path exists.
 */

import { describe, it, expect } from "bun:test";
import { findPath } from "../pathfinding";
import type { ReachableHex, MoveTarget, HexCoord } from "@mage-knight/shared";
import { getAllNeighbors } from "@mage-knight/shared";

describe("Client Path Reconstruction", () => {
  /**
   * Helper to check if two hexes share a common neighbor at a given position
   */
  function shareCommonNeighbor(a: HexCoord, b: HexCoord, common: HexCoord): boolean {
    const aNeighbors = getAllNeighbors(a);
    const bNeighbors = getAllNeighbors(b);
    const aHasCommon = aNeighbors.some((n) => n.q === common.q && n.r === common.r);
    const bHasCommon = bNeighbors.some((n) => n.q === common.q && n.r === common.r);
    return aHasCommon && bHasCommon;
  }

  describe("Basic path reconstruction", () => {
    it("should reconstruct a simple 2-hop path", () => {
      const start: HexCoord = { q: 0, r: 0 };
      const mid: HexCoord = { q: 1, r: 0 };
      const end: HexCoord = { q: 2, r: 0 };

      const reachableHexes: ReachableHex[] = [
        { hex: mid, totalCost: 2, isTerminal: false, cameFrom: start },
        { hex: end, totalCost: 4, isTerminal: false, cameFrom: mid },
      ];

      const path = findPath(start, end, reachableHexes, []);

      expect(path).toEqual([start, mid, end]);
    });

    it("should reconstruct a 3-hop path", () => {
      const start: HexCoord = { q: 0, r: 0 };
      const h1: HexCoord = { q: 1, r: 0 };
      const h2: HexCoord = { q: 2, r: 0 };
      const end: HexCoord = { q: 3, r: 0 };

      const reachableHexes: ReachableHex[] = [
        { hex: h1, totalCost: 2, isTerminal: false, cameFrom: start },
        { hex: h2, totalCost: 4, isTerminal: false, cameFrom: h1 },
        { hex: end, totalCost: 6, isTerminal: false, cameFrom: h2 },
      ];

      const path = findPath(start, end, reachableHexes, []);

      expect(path).toEqual([start, h1, h2, end]);
    });

    it("should return empty array for unreachable hex", () => {
      const start: HexCoord = { q: 0, r: 0 };
      const unreachable: HexCoord = { q: 10, r: 10 };

      const reachableHexes: ReachableHex[] = [
        { hex: { q: 1, r: 0 }, totalCost: 2, isTerminal: false, cameFrom: start },
      ];

      const path = findPath(start, unreachable, reachableHexes, []);

      expect(path).toEqual([]);
    });

    it("should handle adjacent targets without cameFrom (direct from start)", () => {
      const start: HexCoord = { q: 0, r: 0 };
      const adjacent: HexCoord = { q: 1, r: 0 };

      const adjacentTargets: MoveTarget[] = [
        { hex: adjacent, cost: 2 },
      ];

      const path = findPath(start, adjacent, [], adjacentTargets);

      expect(path).toEqual([start, adjacent]);
    });
  });

  describe("Rampaging enemy avoidance (the fixed bug)", () => {
    /**
     * This test verifies the bug is fixed:
     * - Player at (0, -1)
     * - Rampaging enemy at (1, -3)
     * - Target hex (2, -3)
     *
     * Old behavior (A*): Found 2-hop path (0,-1) -> (1,-2) -> (2,-3) which provokes
     * New behavior: Uses server's 3-hop path (0,-1) -> (1,-1) -> (2,-2) -> (2,-3) which doesn't provoke
     */
    it("should use server-provided non-provoking path instead of shorter provoking path", () => {
      const start: HexCoord = { q: 0, r: -1 };
      const target: HexCoord = { q: 2, r: -3 };
      const enemyPos: HexCoord = { q: 1, r: -3 };

      // Server computed the 3-hop non-provoking path:
      // (0,-1) -> (1,-1) -> (2,-2) -> (2,-3)
      const step1: HexCoord = { q: 1, r: -1 }; // Not adjacent to enemy
      const step2: HexCoord = { q: 2, r: -2 }; // Not adjacent to enemy

      const reachableHexes: ReachableHex[] = [
        // Adjacent hexes (cameFrom = start)
        { hex: { q: 1, r: -2 }, totalCost: 2, isTerminal: false, cameFrom: start }, // Adjacent to enemy
        { hex: step1, totalCost: 2, isTerminal: false, cameFrom: start }, // NOT adjacent to enemy
        { hex: { q: 0, r: -2 }, totalCost: 2, isTerminal: false, cameFrom: start }, // Adjacent to enemy
        // 2-hop hexes
        { hex: step2, totalCost: 4, isTerminal: false, cameFrom: step1 }, // NOT adjacent to enemy
        // Target - server chose non-provoking path via (2,-2)
        { hex: target, totalCost: 6, isTerminal: false, cameFrom: step2 },
      ];

      const adjacentTargets: MoveTarget[] = [
        { hex: { q: 1, r: -2 }, cost: 2 },
        { hex: step1, cost: 2 },
        { hex: { q: 0, r: -2 }, cost: 2 },
      ];

      const path = findPath(start, target, reachableHexes, adjacentTargets);

      // Should return the non-provoking path
      expect(path).toEqual([start, step1, step2, target]);

      // Verify the path doesn't provoke
      let pathWouldProvoke = false;
      for (let i = 0; i < path.length - 1; i++) {
        const from = path[i];
        const to = path[i + 1];
        if (from && to && shareCommonNeighbor(from, to, enemyPos)) {
          pathWouldProvoke = true;
        }
      }
      expect(pathWouldProvoke).toBe(false);
    });

    /**
     * Verify that the old 2-hop path WOULD have provoked
     */
    it("confirms the 2-hop path would have provoked (for documentation)", () => {
      const provokeFrom: HexCoord = { q: 1, r: -2 };
      const provokeTo: HexCoord = { q: 2, r: -3 };
      const enemy: HexCoord = { q: 1, r: -3 };

      // Both hexes share the enemy as a common neighbor
      expect(shareCommonNeighbor(provokeFrom, provokeTo, enemy)).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should handle path to start position (empty path)", () => {
      const start: HexCoord = { q: 0, r: 0 };

      const path = findPath(start, start, [], []);

      // Path to yourself is just yourself
      expect(path).toEqual([start]);
    });

    it("should handle missing cameFrom in reachable hex (fallback)", () => {
      const start: HexCoord = { q: 0, r: 0 };
      const end: HexCoord = { q: 1, r: 0 };

      // Adjacent target without cameFrom - should work via adjacentTargets handling
      const reachableHexes: ReachableHex[] = [
        { hex: end, totalCost: 2, isTerminal: false }, // No cameFrom!
      ];

      const adjacentTargets: MoveTarget[] = [
        { hex: end, cost: 2 },
      ];

      const path = findPath(start, end, reachableHexes, adjacentTargets);

      // Should still work because adjacentTargets provides fallback
      expect(path).toEqual([start, end]);
    });
  });
});
