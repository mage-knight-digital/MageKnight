/**
 * Tests for boundary outline computation
 */

import { describe, it, expect } from "vitest";
import { HEX_DIRECTIONS, hexKey, getNeighbor, type HexCoord, type HexDirection } from "@mage-knight/shared";

/**
 * For a pointy-top hex with y-down screen coordinates,
 * getHexVertices returns vertices starting from upper-right going clockwise:
 *
 *       5 (top, y=-85)
 *      / \
 *     4   0  (upper corners, y=-42.5)
 *     |   |
 *     3   1  (lower corners, y=+42.5)
 *      \ /
 *       2 (bottom, y=+85)
 *
 * HEX_DIRECTIONS = ["NE", "E", "SE", "SW", "W", "NW"]
 * with axial coordinate offsets:
 *   NE: q+1, r-1 (up-right)
 *   E:  q+1, r+0 (right)
 *   SE: q+0, r+1 (down-right)
 *   SW: q-1, r+1 (down-left)
 *   W:  q-1, r+0 (left)
 *   NW: q+0, r-1 (up-left)
 *
 * Map from direction index to the two vertex indices that form that edge:
 */
const DIRECTION_TO_EDGE_VERTICES: [number, number][] = [
  [5, 0], // NE: upper-right edge (vertices 5 and 0)
  [0, 1], // E: right edge (vertices 0 and 1)
  [1, 2], // SE: lower-right edge (vertices 1 and 2)
  [2, 3], // SW: lower-left edge (vertices 2 and 3)
  [3, 4], // W: left edge (vertices 3 and 4)
  [4, 5], // NW: upper-left edge (vertices 4 and 5)
];

describe("Boundary outline edge mapping", () => {
  it("should have correct direction-to-vertex mapping", () => {
    // Verify the mapping makes geometric sense
    // Each direction should use consecutive vertices (mod 6)
    for (let i = 0; i < 6; i++) {
      const [v1, v2] = DIRECTION_TO_EDGE_VERTICES[i]!;
      // The vertices should be adjacent (differ by 1, wrapping at 6)
      const diff = (v2 - v1 + 6) % 6;
      expect(diff === 1 || diff === 5).toBe(true);
    }
  });

  it("should cover all 6 edges of the hex exactly once", () => {
    const edgeSet = new Set<string>();
    for (const [v1, v2] of DIRECTION_TO_EDGE_VERTICES) {
      // Normalize edge representation (smaller index first)
      const edge = v1 < v2 ? `${v1}-${v2}` : `${v2}-${v1}`;
      edgeSet.add(edge);
    }
    // Should have exactly 6 unique edges
    expect(edgeSet.size).toBe(6);
  });
});

describe("Boundary edge computation", () => {
  /**
   * Simplified version of the boundary computation for testing
   * Returns a map of hex key -> array of direction names that are boundary edges
   */
  function computeBoundaryEdgeDirections(
    reachableCoords: HexCoord[]
  ): Map<string, HexDirection[]> {
    const reachableSet = new Set(reachableCoords.map(hexKey));
    const result = new Map<string, HexDirection[]>();

    for (const coord of reachableCoords) {
      const boundaryDirs: HexDirection[] = [];

      for (const direction of HEX_DIRECTIONS) {
        const neighbor = getNeighbor(coord, direction);

        if (!reachableSet.has(hexKey(neighbor))) {
          boundaryDirs.push(direction);
        }
      }

      if (boundaryDirs.length > 0) {
        result.set(hexKey(coord), boundaryDirs);
      }
    }

    return result;
  }

  it("single hex should have all 6 edges as boundary", () => {
    const reachable: HexCoord[] = [{ q: 0, r: 0 }];
    const boundaries = computeBoundaryEdgeDirections(reachable);

    expect(boundaries.get("0,0")).toEqual(["NE", "E", "SE", "SW", "W", "NW"]);
  });

  it("two adjacent hexes (E direction) should share one edge", () => {
    // Hex at origin and hex to the east
    const reachable: HexCoord[] = [
      { q: 0, r: 0 },
      { q: 1, r: 0 }, // E neighbor
    ];
    const boundaries = computeBoundaryEdgeDirections(reachable);

    // Origin hex: E edge should NOT be a boundary
    const originBoundaries = boundaries.get("0,0")!;
    expect(originBoundaries).not.toContain("E");
    expect(originBoundaries.length).toBe(5);

    // East hex: W edge should NOT be a boundary
    const eastBoundaries = boundaries.get("1,0")!;
    expect(eastBoundaries).not.toContain("W");
    expect(eastBoundaries.length).toBe(5);
  });

  it("three hexes in a line should have correct boundaries", () => {
    const reachable: HexCoord[] = [
      { q: 0, r: 0 },
      { q: 1, r: 0 }, // E
      { q: 2, r: 0 }, // E of E
    ];
    const boundaries = computeBoundaryEdgeDirections(reachable);

    // Middle hex should only have 4 boundary edges (not E or W)
    const middleBoundaries = boundaries.get("1,0")!;
    expect(middleBoundaries).not.toContain("E");
    expect(middleBoundaries).not.toContain("W");
    expect(middleBoundaries.length).toBe(4);
  });

  it("cluster of 7 hexes (tile shape) should have outer boundary only", () => {
    // Center hex and its 6 neighbors
    const center: HexCoord = { q: 0, r: 0 };
    const reachable: HexCoord[] = [
      center,
      ...HEX_DIRECTIONS.map((dir) => getNeighbor(center, dir)),
    ];
    const boundaries = computeBoundaryEdgeDirections(reachable);

    // Center hex should have NO boundary edges (all neighbors are reachable)
    expect(boundaries.has("0,0")).toBe(false);

    // Each outer hex should have exactly 3 boundary edges
    for (const dir of HEX_DIRECTIONS) {
      const neighborCoord = getNeighbor(center, dir);
      const neighborBoundaries = boundaries.get(hexKey(neighborCoord))!;
      expect(neighborBoundaries.length).toBe(3);
    }
  });

  /**
   * User's test case:
   * Player at 0,0 with 2 move points on plains.
   * Reachable hexes: 0,0 (current), 0,-1, 1,0
   *
   * The boundary should form a continuous outline around this 3-hex cluster.
   *
   * Expected boundary edges:
   * - 0,-1: NW, W, SW, SE, E (5 edges - only S edge shared with 0,0)
   * - 1,0: SW, SE, E, NE, NW (5 edges - only W edge shared with 0,0)
   * - 0,0: W, NW, NE, SE (4 edges - N shared with 0,-1, E shared with 1,0)
   *
   * Wait, let me think about this more carefully with axial coordinates:
   * - 0,0 neighbors: NE(1,-1), E(1,0), SE(0,1), SW(-1,1), W(-1,0), NW(0,-1)
   * - So 0,-1 is the NW neighbor of 0,0
   * - And 1,0 is the E neighbor of 0,0
   */
  describe("User test case: 3-hex reachable cluster", () => {
    // Reachable: current hex (0,0) and two neighbors
    const reachable: HexCoord[] = [
      { q: 0, r: 0 },   // Current position
      { q: 0, r: -1 },  // NW neighbor (0,-1)
      { q: 1, r: 0 },   // E neighbor (1,0)
    ];

    it("should compute correct boundary edges for hex 0,-1", () => {
      const boundaries = computeBoundaryEdgeDirections(reachable);
      const hex0m1 = boundaries.get("0,-1")!;

      // 0,-1's neighbors:
      // NE(1,-2) - not reachable -> boundary
      // E(1,-1) - not reachable -> boundary
      // SE(0,0) - reachable! -> NOT boundary
      // SW(-1,0) - not reachable -> boundary
      // W(-1,-1) - not reachable -> boundary
      // NW(0,-2) - not reachable -> boundary

      expect(hex0m1).toContain("NE");
      expect(hex0m1).toContain("E");
      expect(hex0m1).not.toContain("SE"); // Shared with 0,0
      expect(hex0m1).toContain("SW");
      expect(hex0m1).toContain("W");
      expect(hex0m1).toContain("NW");
      expect(hex0m1.length).toBe(5);
    });

    it("should compute correct boundary edges for hex 1,0", () => {
      const boundaries = computeBoundaryEdgeDirections(reachable);
      const hex1_0 = boundaries.get("1,0")!;

      // 1,0's neighbors:
      // NE(2,-1) - not reachable -> boundary
      // E(2,0) - not reachable -> boundary
      // SE(1,1) - not reachable -> boundary
      // SW(0,1) - not reachable -> boundary
      // W(0,0) - reachable! -> NOT boundary
      // NW(1,-1) - not reachable -> boundary

      expect(hex1_0).toContain("NE");
      expect(hex1_0).toContain("E");
      expect(hex1_0).toContain("SE");
      expect(hex1_0).toContain("SW");
      expect(hex1_0).not.toContain("W"); // Shared with 0,0
      expect(hex1_0).toContain("NW");
      expect(hex1_0.length).toBe(5);
    });

    it("should compute correct boundary edges for hex 0,0", () => {
      const boundaries = computeBoundaryEdgeDirections(reachable);
      const hex0_0 = boundaries.get("0,0")!;

      // 0,0's neighbors:
      // NE(1,-1) - not reachable -> boundary
      // E(1,0) - reachable! -> NOT boundary
      // SE(0,1) - not reachable -> boundary
      // SW(-1,1) - not reachable -> boundary
      // W(-1,0) - not reachable -> boundary
      // NW(0,-1) - reachable! -> NOT boundary

      expect(hex0_0).toContain("NE");
      expect(hex0_0).not.toContain("E"); // Shared with 1,0
      expect(hex0_0).toContain("SE");
      expect(hex0_0).toContain("SW");
      expect(hex0_0).toContain("W");
      expect(hex0_0).not.toContain("NW"); // Shared with 0,-1
      expect(hex0_0.length).toBe(4);
    });

    it("should have total of 14 boundary edges forming continuous outline", () => {
      const boundaries = computeBoundaryEdgeDirections(reachable);

      let totalEdges = 0;
      for (const [, edges] of boundaries) {
        totalEdges += edges.length;
      }

      // 5 + 5 + 4 = 14 edges
      expect(totalEdges).toBe(14);
    });
  });
});
