/**
 * Movement action options.
 *
 * Computes valid hex targets a player can move to, with terrain costs.
 * Also computes all reachable hexes within current move points using Dijkstra's algorithm.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { MoveOptions, MoveTarget, ReachableHex, HexCoord } from "@mage-knight/shared";
import { HEX_DIRECTIONS, hexKey, getNeighbor, getAllNeighbors } from "@mage-knight/shared";
import { getEffectiveTerrainCost } from "../modifiers.js";
import { SiteType, type HexState } from "../../types/map.js";
import { SITE_PROPERTIES } from "../../data/siteProperties.js";
import { FEATURE_FLAGS } from "../../config/featureFlags.js";

/**
 * Get valid move targets for a player.
 *
 * Returns adjacent hexes that the player can move to, with costs.
 * Checks:
 * - Hex exists on map
 * - Terrain is passable (cost < Infinity)
 * - Player has enough move points
 * - No blocking rampaging enemies
 * - Scenario rules (city entry)
 */
export function getValidMoveTargets(
  state: GameState,
  player: Player
): MoveOptions | undefined {
  // Must be on the map
  if (!player.position) {
    return undefined;
  }

  // Can't move after taking an action
  if (player.hasTakenActionThisTurn) {
    return undefined;
  }

  const targets: MoveTarget[] = [];

  // Check each adjacent hex
  for (const dir of HEX_DIRECTIONS) {
    const adjacent = getNeighbor(player.position, dir);
    const key = hexKey(adjacent);
    const hex = state.map.hexes[key];

    // Skip if hex doesn't exist
    if (!hex) continue;

    // Get terrain cost (may be modified by skills/cards)
    const cost = getEffectiveTerrainCost(state, hex.terrain, player.id);

    // Skip impassable terrain
    if (cost === Infinity) continue;

    // Skip if not enough move points
    if (player.movePoints < cost) continue;

    // Skip if blocked by rampaging enemies
    if (hex.rampagingEnemies.length > 0 && hex.enemies.length > 0) continue;

    // Skip cities if scenario doesn't allow entry
    if (hex.site?.type === SiteType.City) {
      if (!state.scenarioConfig.citiesCanBeEntered) continue;
    }

    // Check if this move would be terminal (trigger combat)
    const isTerminal =
      isTerminalHex(hex, player.id, state) ||
      wouldProvokeRampaging(player.position, adjacent, state.map.hexes);

    const target: MoveTarget = { hex: adjacent, cost };
    if (isTerminal) {
      targets.push({ ...target, isTerminal: true });
    } else {
      targets.push(target);
    }
  }

  // Return undefined if no valid targets and no reachable hexes to compute
  if (targets.length === 0 && !FEATURE_FLAGS.ENABLE_REACHABLE_HEXES) {
    return undefined;
  }

  // Compute reachable hexes if feature is enabled
  let reachable: ReachableHex[] | undefined;
  if (FEATURE_FLAGS.ENABLE_REACHABLE_HEXES && player.movePoints > 0) {
    reachable = getReachableHexes(state, player);
  }

  // Return undefined if neither targets nor reachable hexes
  if (targets.length === 0 && (!reachable || reachable.length === 0)) {
    return undefined;
  }

  // Only include reachable if it has values
  if (reachable && reachable.length > 0) {
    return { targets, reachable };
  }

  return { targets };
}

/**
 * Check if a hex would trigger combat when entered (making it a "terminal" hex).
 *
 * Terminal hexes are reachable but movement cannot continue past them:
 * - Unconquered fortified sites (keeps, mage towers, cities)
 * - Opponent-owned keeps
 * - Hexes with non-rampaging enemies (provoked combat)
 */
function isTerminalHex(
  hex: HexState,
  playerId: string,
  _state: GameState
): boolean {
  // Check for fortified site that would trigger assault
  if (hex.site) {
    const site = hex.site;
    const props = SITE_PROPERTIES[site.type];

    // Unconquered fortified sites trigger assault
    const isUnconqueredFortified = props.fortified && !site.isConquered;

    // Opponent-owned keeps also trigger assault
    const isOpponentKeep =
      site.type === SiteType.Keep &&
      site.isConquered &&
      site.owner !== playerId;

    if (isUnconqueredFortified || isOpponentKeep) {
      return true;
    }
  }

  // Hexes with enemies (that aren't blocking rampaging) trigger combat when entered
  // Note: Blocking rampaging (hex.rampagingEnemies.length > 0 && hex.enemies.length > 0)
  // is already handled as impassable, so any hex with enemies here is enterable but terminal
  if (hex.enemies.length > 0) {
    return true;
  }

  return false;
}

/**
 * Check if moving from one hex to another would provoke rampaging enemies.
 * This happens when both hexes are adjacent to the same rampaging enemy hex.
 */
function wouldProvokeRampaging(
  from: HexCoord,
  to: HexCoord,
  hexes: Record<string, HexState>
): boolean {
  const fromNeighbors = getAllNeighbors(from);
  const toNeighbors = getAllNeighbors(to);

  const fromNeighborKeys = new Set(fromNeighbors.map(hexKey));
  const toNeighborKeys = new Set(toNeighbors.map(hexKey));

  // Find hexes adjacent to both from and to
  for (const key of fromNeighborKeys) {
    if (toNeighborKeys.has(key)) {
      const hex = hexes[key];
      if (hex && hex.rampagingEnemies.length > 0 && hex.enemies.length > 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a hex is passable (can be entered and potentially passed through).
 * Returns the cost to enter, or Infinity if impassable.
 */
function getHexEntryCost(
  hex: HexState | undefined,
  state: GameState,
  playerId: string
): number {
  if (!hex) return Infinity;

  // Get terrain cost (may be modified by skills/cards)
  const cost = getEffectiveTerrainCost(state, hex.terrain, playerId);

  // Impassable terrain
  if (cost === Infinity) return Infinity;

  // Blocked by rampaging enemies (can't enter at all)
  if (hex.rampagingEnemies.length > 0 && hex.enemies.length > 0) {
    return Infinity;
  }

  // Cities may be restricted by scenario
  if (hex.site?.type === SiteType.City) {
    if (!state.scenarioConfig.citiesCanBeEntered) {
      return Infinity;
    }
  }

  return cost;
}

/**
 * Compute all hexes reachable within the player's current move points.
 * Uses Dijkstra's algorithm with a priority queue.
 *
 * Returns hexes sorted by total cost (nearest first).
 */
function getReachableHexes(state: GameState, player: Player): ReachableHex[] {
  if (!player.position) return [];

  const startKey = hexKey(player.position);
  const movePoints = player.movePoints;

  // Priority queue entries: [totalCost, hexKey, coord, isTerminal, cameFromKey]
  // Using array sorted by cost (simple implementation, fine for small graphs)
  type QueueEntry = {
    totalCost: number;
    key: string;
    coord: HexCoord;
    isTerminal: boolean;
    cameFromKey: string | null;
  };

  const queue: QueueEntry[] = [];
  const visited = new Map<string, { totalCost: number; isTerminal: boolean }>();

  // Start from player position (cost 0, not terminal, don't include in results)
  visited.set(startKey, { totalCost: 0, isTerminal: false });

  // Add initial neighbors to queue
  for (const dir of HEX_DIRECTIONS) {
    const neighbor = getNeighbor(player.position, dir);
    const neighborKey = hexKey(neighbor);
    const hex = state.map.hexes[neighborKey];

    const cost = getHexEntryCost(hex, state, player.id);
    if (cost <= movePoints && cost !== Infinity) {
      const terminal = hex ? isTerminalHex(hex, player.id, state) : false;
      queue.push({
        totalCost: cost,
        key: neighborKey,
        coord: neighbor,
        isTerminal: terminal,
        cameFromKey: startKey,
      });
    }
  }

  // Sort queue by cost (ascending)
  queue.sort((a, b) => a.totalCost - b.totalCost);

  // Process queue (Dijkstra's algorithm)
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break; // Type guard (should never happen given while condition)

    // Skip if already visited with equal or lower cost
    const existingVisit = visited.get(current.key);
    if (existingVisit && existingVisit.totalCost <= current.totalCost) {
      continue;
    }

    // Check for rampaging provocation from the hex we came from
    if (current.cameFromKey && current.cameFromKey !== startKey) {
      // If the path would provoke rampaging, this becomes terminal
      // (parse coord from key)
      const parts = current.cameFromKey.split(",");
      const fromQ = parseInt(parts[0] ?? "0", 10);
      const fromR = parseInt(parts[1] ?? "0", 10);
      if (wouldProvokeRampaging({ q: fromQ, r: fromR }, current.coord, state.map.hexes)) {
        current.isTerminal = true;
      }
    }

    // Mark as visited
    visited.set(current.key, {
      totalCost: current.totalCost,
      isTerminal: current.isTerminal,
    });

    // If terminal, don't expand further from this hex
    if (current.isTerminal) {
      continue;
    }

    // Expand to neighbors
    for (const dir of HEX_DIRECTIONS) {
      const neighbor = getNeighbor(current.coord, dir);
      const neighborKey = hexKey(neighbor);

      // Skip if already visited
      if (visited.has(neighborKey)) continue;

      const hex = state.map.hexes[neighborKey];
      const edgeCost = getHexEntryCost(hex, state, player.id);

      if (edgeCost === Infinity) continue;

      const newTotalCost = current.totalCost + edgeCost;

      // Skip if exceeds move points
      if (newTotalCost > movePoints) continue;

      // Check if moving here would provoke rampaging
      const wouldProvoke = wouldProvokeRampaging(current.coord, neighbor, state.map.hexes);
      const terminal = (hex ? isTerminalHex(hex, player.id, state) : false) || wouldProvoke;

      // Add to queue (will be sorted on next iteration)
      queue.push({
        totalCost: newTotalCost,
        key: neighborKey,
        coord: neighbor,
        isTerminal: terminal,
        cameFromKey: current.key,
      });

      // Keep queue sorted
      queue.sort((a, b) => a.totalCost - b.totalCost);
    }
  }

  // Convert visited map to result array (excluding start position)
  const result: ReachableHex[] = [];
  for (const [key, data] of visited) {
    if (key === startKey) continue; // Don't include starting position

    const parts = key.split(",");
    const q = parseInt(parts[0] ?? "0", 10);
    const r = parseInt(parts[1] ?? "0", 10);
    result.push({
      hex: { q, r },
      totalCost: data.totalCost,
      isTerminal: data.isTerminal,
    });
  }

  // Sort by total cost
  result.sort((a, b) => a.totalCost - b.totalCost);

  return result;
}
