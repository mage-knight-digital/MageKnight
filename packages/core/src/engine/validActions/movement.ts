/**
 * Movement action options.
 *
 * Computes valid hex targets a player can move to, with terrain costs.
 * Also computes all reachable hexes within current move points using Dijkstra's algorithm.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { MoveOptions, MoveTarget, ReachableHex, HexCoord } from "@mage-knight/shared";
import { HEX_DIRECTIONS, hexKey, getNeighbor, getAllNeighbors, TIME_OF_DAY_DAY } from "@mage-knight/shared";
import { evaluateMoveEntry } from "../rules/movement.js";
import { SiteType, type HexState } from "../../types/map.js";
import { SITE_PROPERTIES } from "../../data/siteProperties.js";
import { FEATURE_FLAGS } from "../../config/featureFlags.js";
import { mustAnnounceEndOfRound } from "./helpers.js";

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

  // Must announce end of round before taking other actions
  if (mustAnnounceEndOfRound(state, player)) {
    return undefined;
  }

  // Can't move while resting
  if (player.isResting) {
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

    const { cost, reason } = evaluateMoveEntry(state, player.id, hex);
    if (reason !== null) continue;

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

    // Check if this move would reveal enemies at adjacent fortified sites (Day only)
    const isDay = state.timeOfDay === TIME_OF_DAY_DAY;
    const wouldReveal = wouldMoveRevealEnemies(
      player.position,
      adjacent,
      state.map.hexes,
      isDay
    );

    const target: MoveTarget = { hex: adjacent, cost };
    if (isTerminal) {
      targets.push(wouldReveal
        ? { ...target, isTerminal: true, wouldRevealEnemies: true }
        : { ...target, isTerminal: true });
    } else {
      targets.push(wouldReveal
        ? { ...target, wouldRevealEnemies: true }
        : target);
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
 * Check if moving to a hex would reveal unrevealed enemies at adjacent fortified sites.
 * Per rules: During Day, moving adjacent to a fortified site reveals its defenders.
 *
 * @param from - Current player position
 * @param to - Destination hex
 * @param hexes - Map hexes
 * @param isDay - Whether it's currently Day time
 * @returns true if this move would reveal at least one unrevealed enemy
 */
function wouldMoveRevealEnemies(
  from: HexCoord,
  to: HexCoord,
  hexes: Record<string, HexState>,
  isDay: boolean
): boolean {
  // Only reveal during Day
  if (!isDay) return false;

  // Get hexes that will become newly adjacent (adjacent to 'to' but not to 'from')
  const fromNeighbors = new Set(getAllNeighbors(from).map(hexKey));
  const toNeighbors = getAllNeighbors(to);

  for (const neighbor of toNeighbors) {
    const key = hexKey(neighbor);
    // Skip hexes already adjacent to current position (already revealed if applicable)
    if (fromNeighbors.has(key)) continue;

    const hex = hexes[key];
    if (!hex?.site) continue;

    // Check if it's a fortified site
    const props = SITE_PROPERTIES[hex.site.type];
    if (!props.fortified) continue;

    // Check if it has unrevealed enemies
    const hasUnrevealedEnemies = hex.enemies.some((e) => !e.isRevealed);
    if (hasUnrevealedEnemies) {
      return true;
    }
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
  const { cost, reason } = evaluateMoveEntry(state, playerId, hex);
  return reason === null ? cost : Infinity;
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

  // Priority queue entries: [totalCost, hexKey, coord, isTerminal, cameFromKey, wouldRevealEnemies]
  // Using array sorted by cost (simple implementation, fine for small graphs)
  type QueueEntry = {
    totalCost: number;
    key: string;
    coord: HexCoord;
    isTerminal: boolean;
    cameFromKey: string | null;
    wouldRevealEnemies: boolean;
  };

  const queue: QueueEntry[] = [];
  const visited = new Map<string, { totalCost: number; isTerminal: boolean; wouldRevealEnemies: boolean; cameFromKey: string | null }>();

  // Check if it's Day (for enemy reveal detection)
  const isDay = state.timeOfDay === TIME_OF_DAY_DAY;

  // Start from player position (cost 0, not terminal, don't include in results)
  visited.set(startKey, { totalCost: 0, isTerminal: false, wouldRevealEnemies: false, cameFromKey: null });

  // Add initial neighbors to queue
  for (const dir of HEX_DIRECTIONS) {
    const neighbor = getNeighbor(player.position, dir);
    const neighborKey = hexKey(neighbor);
    const hex = state.map.hexes[neighborKey];

    const cost = getHexEntryCost(hex, state, player.id);
    if (cost <= movePoints && cost !== Infinity) {
      // Check if moving from start to this neighbor would provoke rampaging enemies
      const wouldProvoke = wouldProvokeRampaging(player.position, neighbor, state.map.hexes);
      const terminal = (hex ? isTerminalHex(hex, player.id, state) : false) || wouldProvoke;
      const wouldReveal = wouldMoveRevealEnemies(
        player.position,
        neighbor,
        state.map.hexes,
        isDay
      );
      queue.push({
        totalCost: cost,
        key: neighborKey,
        coord: neighbor,
        isTerminal: terminal,
        cameFromKey: startKey,
        wouldRevealEnemies: wouldReveal,
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
    // EXCEPTION: If existing visit is terminal but current is not, prefer the non-terminal path
    const existingVisit = visited.get(current.key);
    if (existingVisit && existingVisit.totalCost <= current.totalCost) {
      // Check if we found a better path (same cost, but non-terminal vs terminal)
      const isBetterPath = existingVisit.totalCost === current.totalCost &&
        existingVisit.isTerminal && !current.isTerminal;
      if (!isBetterPath) {
        continue;
      }
      // Fall through to update the visit with the non-terminal path
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
      wouldRevealEnemies: current.wouldRevealEnemies,
      cameFromKey: current.cameFromKey,
    });

    // If terminal, don't expand further from this hex
    if (current.isTerminal) {
      continue;
    }

    // Expand to neighbors
    for (const dir of HEX_DIRECTIONS) {
      const neighbor = getNeighbor(current.coord, dir);
      const neighborKey = hexKey(neighbor);

      // Skip if already visited with a non-terminal path
      // (If visited with terminal path, we might find a better non-terminal path later)
      const existingNeighborVisit = visited.get(neighborKey);
      if (existingNeighborVisit && !existingNeighborVisit.isTerminal) continue;

      const hex = state.map.hexes[neighborKey];
      const edgeCost = getHexEntryCost(hex, state, player.id);

      if (edgeCost === Infinity) continue;

      const newTotalCost = current.totalCost + edgeCost;

      // Skip if exceeds move points
      if (newTotalCost > movePoints) continue;

      // Check if moving here would provoke rampaging
      const wouldProvoke = wouldProvokeRampaging(current.coord, neighbor, state.map.hexes);
      const terminal = (hex ? isTerminalHex(hex, player.id, state) : false) || wouldProvoke;

      // Check if moving here would reveal enemies at adjacent fortified sites
      const wouldReveal = wouldMoveRevealEnemies(
        current.coord,
        neighbor,
        state.map.hexes,
        isDay
      );

      // Add to queue (will be sorted on next iteration)
      queue.push({
        totalCost: newTotalCost,
        key: neighborKey,
        coord: neighbor,
        isTerminal: terminal,
        cameFromKey: current.key,
        wouldRevealEnemies: wouldReveal,
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

    // Parse cameFrom coordinate from key
    let cameFrom: { q: number; r: number } | undefined;
    if (data.cameFromKey) {
      const fromParts = data.cameFromKey.split(",");
      cameFrom = {
        q: parseInt(fromParts[0] ?? "0", 10),
        r: parseInt(fromParts[1] ?? "0", 10),
      };
    }

    const base: ReachableHex = {
      hex: { q, r },
      totalCost: data.totalCost,
      isTerminal: data.isTerminal,
    };

    // Build result with optional fields (to match exactOptionalPropertyTypes)
    const entry: ReachableHex = {
      ...base,
      ...(data.wouldRevealEnemies ? { wouldRevealEnemies: true } : {}),
      ...(cameFrom ? { cameFrom } : {}),
    };
    result.push(entry);
  }

  // Sort by total cost
  result.sort((a, b) => a.totalCost - b.totalCost);

  return result;
}
