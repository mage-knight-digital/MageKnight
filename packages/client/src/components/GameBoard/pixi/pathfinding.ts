/**
 * Path reconstruction for hex grid movement preview visualization
 *
 * Reconstructs paths from server-provided cameFrom links.
 * This ensures the displayed path exactly matches the path the server computed,
 * avoiding issues where client A* might find a different (potentially provoking) path.
 */

import type { HexCoord, MoveTarget, ReachableHex } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";

/**
 * Reconstruct path from start to end using cameFrom links from server
 *
 * @param start - Starting hex coordinate (player position)
 * @param end - Target hex coordinate
 * @param reachableHexes - Reachable hexes from game state (with cameFrom links)
 * @param adjacentTargets - Adjacent move targets from game state
 * @returns Array of hex coordinates forming the path, or empty array if no path exists
 */
export function findPath(
  start: HexCoord,
  end: HexCoord,
  reachableHexes: readonly ReachableHex[],
  adjacentTargets: readonly MoveTarget[]
): HexCoord[] {
  const startKey = hexKey(start);
  const endKey = hexKey(end);

  // Build lookup map for cameFrom links
  const cameFromMap = new Map<string, HexCoord | null>();

  // Start position has no cameFrom
  cameFromMap.set(startKey, null);

  // Adjacent targets - their cameFrom is the start
  for (const t of adjacentTargets) {
    const key = hexKey(t.hex);
    cameFromMap.set(key, start);
  }

  // Add all reachable hexes with their cameFrom links
  for (const r of reachableHexes) {
    const key = hexKey(r.hex);
    if (r.cameFrom) {
      // Use server-provided cameFrom (may override adjacent target fallback)
      cameFromMap.set(key, r.cameFrom);
    } else if (!cameFromMap.has(key)) {
      // Hex is reachable but has no cameFrom and isn't adjacent - shouldn't happen
      // but we need to include it in the map for the "is reachable" check
      // Leave it out of the map so path reconstruction will fail gracefully
    }
  }

  // Check if end is reachable
  if (!cameFromMap.has(endKey)) {
    return [];
  }

  // Reconstruct path by following cameFrom links backwards from end to start
  const path: HexCoord[] = [];
  let currentKey = endKey;
  let current: HexCoord = end;

  // Safety limit to prevent infinite loops
  const maxIterations = 100;
  let iterations = 0;

  while (currentKey !== startKey && iterations < maxIterations) {
    path.unshift(current);

    const cameFrom = cameFromMap.get(currentKey);
    if (!cameFrom) {
      // No path found (shouldn't happen if end is reachable)
      return [];
    }

    current = cameFrom;
    currentKey = hexKey(current);
    iterations++;
  }

  // Add start to the beginning
  path.unshift(start);

  return path;
}
