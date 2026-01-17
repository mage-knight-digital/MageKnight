/**
 * A* pathfinding for hex grid path preview visualization
 *
 * Provides path computation between hexes for movement preview UI.
 * Uses A* algorithm with hex-based heuristics.
 */

import type { HexCoord, MoveTarget, ReachableHex } from "@mage-knight/shared";
import { hexKey, getAllNeighbors } from "@mage-knight/shared";

/**
 * Hex distance heuristic for A* pathfinding
 * Uses axial coordinate distance formula for pointy-top hexes
 */
function heuristic(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/**
 * A* pathfinding node
 */
interface PathNode {
  f: number;        // Total estimated cost (g + h)
  g: number;        // Cost from start
  coord: HexCoord;  // Current position
  path: HexCoord[]; // Path taken to reach this node
}

/**
 * Find path between two hexes using A* algorithm
 *
 * @param start - Starting hex coordinate
 * @param end - Target hex coordinate
 * @param reachableHexes - Multi-hop reachable hexes from game state
 * @param adjacentTargets - Adjacent move targets from game state
 * @returns Array of hex coordinates forming the path, or empty array if no path exists
 */
export function findPath(
  start: HexCoord,
  end: HexCoord,
  reachableHexes: readonly ReachableHex[],
  adjacentTargets: readonly MoveTarget[]
): HexCoord[] {
  // Build lookup map of valid hexes
  const reachableMap = new Map<string, { cost: number; isTerminal: boolean }>();

  for (const r of reachableHexes) {
    reachableMap.set(hexKey(r.hex), { cost: r.totalCost, isTerminal: r.isTerminal });
  }

  for (const t of adjacentTargets) {
    reachableMap.set(hexKey(t.hex), { cost: t.cost, isTerminal: t.isTerminal ?? false });
  }

  // Check if end is reachable
  const endKey = hexKey(end);
  if (!reachableMap.has(endKey)) {
    return [];
  }

  // A* search
  const startKey = hexKey(start);
  const openSet: PathNode[] = [
    { f: heuristic(start, end), g: 0, coord: start, path: [start] }
  ];
  const visited = new Set<string>([startKey]);

  while (openSet.length > 0) {
    // Get node with lowest f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift() as PathNode;
    const currentKey = hexKey(current.coord);

    // Found the target
    if (currentKey === endKey) {
      return current.path;
    }

    // Don't expand from terminal hexes (except start)
    const currentData = reachableMap.get(currentKey);
    if (currentData?.isTerminal && currentKey !== startKey) {
      continue;
    }

    // Explore neighbors
    const neighbors = getAllNeighbors(current.coord);
    for (const neighbor of neighbors) {
      const neighborKey = hexKey(neighbor);
      if (visited.has(neighborKey)) continue;

      const neighborData = reachableMap.get(neighborKey);
      if (!neighborData) continue;

      visited.add(neighborKey);
      const g = current.g + 1;
      const f = g + heuristic(neighbor, end);
      openSet.push({
        f,
        g,
        coord: neighbor,
        path: [...current.path, neighbor],
      });
    }
  }

  // No path found
  return [];
}
