/**
 * Cooperative Assault Helpers
 *
 * Functions for distributing city defenders among players in cooperative assaults.
 * Per Mage Knight rules: players agree on counts, but specific enemies are randomly assigned.
 */

import type { EnemyId } from "@mage-knight/shared";
import type { RngState } from "../../utils/rng.js";
import type { EnemyAssignments } from "../../types/combat.js";
import { shuffleWithRng } from "../../utils/rng.js";

/**
 * Result of distributing enemies among players
 */
export interface DistributeEnemiesResult {
  /** Map of player IDs to assigned enemy IDs */
  readonly assignments: EnemyAssignments;
  /** Updated RNG state after shuffling */
  readonly rng: RngState;
}

/**
 * Validate enemy distribution counts.
 * - Each player must receive at least 1 enemy
 * - Total counts must equal number of enemies
 *
 * @param counts - Map of player IDs to enemy counts
 * @param totalEnemies - Total number of enemies to distribute
 * @returns Error message if invalid, null if valid
 */
export function validateDistributionCounts(
  counts: ReadonlyMap<string, number>,
  totalEnemies: number
): string | null {
  if (counts.size === 0) {
    return "No players specified for distribution";
  }

  let total = 0;
  for (const [playerId, count] of counts) {
    if (count < 1) {
      return `Player ${playerId} must receive at least 1 enemy`;
    }
    total += count;
  }

  if (total !== totalEnemies) {
    return `Total counts (${total}) must equal number of enemies (${totalEnemies})`;
  }

  return null;
}

/**
 * Distribute enemies randomly among players according to agreed counts.
 *
 * Algorithm:
 * 1. Shuffle all enemies using seeded RNG
 * 2. Assign enemies to players in order, respecting counts
 *
 * The distribution is truly random - it doesn't depend on player order or
 * the order in which counts were specified.
 *
 * @param enemyIds - All enemy IDs to distribute (from city garrison)
 * @param counts - Map of player IDs to how many enemies they should receive
 * @param rng - Current RNG state for reproducible shuffling
 * @returns Assignments map and updated RNG state
 *
 * @example
 * ```typescript
 * const counts = new Map([
 *   ["player1", 2],
 *   ["player2", 3],
 * ]);
 * const { assignments, rng: newRng } = distributeEnemies(
 *   ["guardsmen", "swordsmen", "crossbowmen", "cavalry", "altemGuard"],
 *   counts,
 *   state.rng
 * );
 * // assignments might be:
 * // { player1: ["swordsmen", "cavalry"], player2: ["guardsmen", "crossbowmen", "altemGuard"] }
 * ```
 */
export function distributeEnemies(
  enemyIds: readonly EnemyId[],
  counts: ReadonlyMap<string, number>,
  rng: RngState
): DistributeEnemiesResult {
  // Shuffle enemies for random distribution
  const { result: shuffledEnemies, rng: newRng } = shuffleWithRng(
    enemyIds,
    rng
  );

  // Build assignments by taking enemies from shuffled array
  const assignments: Record<string, string[]> = {};
  let currentIndex = 0;

  // Sort player IDs for deterministic assignment order
  // This ensures the same seed produces the same assignments
  const sortedPlayerIds = [...counts.keys()].sort();

  for (const playerId of sortedPlayerIds) {
    const count = counts.get(playerId);
    if (count === undefined || count <= 0) continue;

    // Take the next 'count' enemies from the shuffled array
    const playerEnemies = shuffledEnemies.slice(
      currentIndex,
      currentIndex + count
    );
    assignments[playerId] = playerEnemies;
    currentIndex += count;
  }

  return {
    assignments,
    rng: newRng,
  };
}

/**
 * Create enemy instance ID assignments from EnemyId assignments.
 * Converts enemy IDs to the instance ID format used in CombatState.
 *
 * @param assignments - Map of player IDs to enemy IDs
 * @param enemies - Array of enemies with their instance IDs (from CombatState.enemies)
 * @returns Map of player IDs to enemy instance IDs
 */
export function createInstanceAssignments(
  assignments: EnemyAssignments,
  enemyOrder: readonly EnemyId[]
): EnemyAssignments {
  // Create a lookup from enemyId to instanceId based on order
  // In CombatState, instanceIds are "enemy_0", "enemy_1", etc. in order
  const enemyIdToInstances = new Map<EnemyId, string[]>();

  for (let i = 0; i < enemyOrder.length; i++) {
    const enemyId = enemyOrder[i];
    if (enemyId === undefined) continue;

    if (!enemyIdToInstances.has(enemyId)) {
      enemyIdToInstances.set(enemyId, []);
    }
    const instances = enemyIdToInstances.get(enemyId);
    if (instances) {
      instances.push(`enemy_${i}`);
    }
  }

  // Convert assignments from EnemyId to instanceId
  // Track globally which instances have been used across all players
  const instanceAssignments: Record<string, string[]> = {};
  const globalUsedInstances = new Set<string>();

  for (const [playerId, enemyIds] of Object.entries(assignments)) {
    instanceAssignments[playerId] = [];

    for (const enemyId of enemyIds) {
      const instances = enemyIdToInstances.get(enemyId as EnemyId);
      if (instances) {
        // Find an unused instance for this enemy type (globally unused)
        const instanceId = instances.find((id) => !globalUsedInstances.has(id));
        if (instanceId) {
          instanceAssignments[playerId].push(instanceId);
          globalUsedInstances.add(instanceId);
        }
      }
    }
  }

  return instanceAssignments;
}

/**
 * Get the enemies assigned to a specific player.
 * Returns all enemies if no assignments exist (single-player combat).
 *
 * @param enemyAssignments - The enemy assignments map from CombatState
 * @param playerId - The player to get enemies for
 * @returns Array of enemy instance IDs assigned to the player
 */
export function getAssignedEnemyInstanceIds(
  enemyAssignments: EnemyAssignments | undefined,
  playerId: string
): readonly string[] | null {
  if (!enemyAssignments) {
    return null; // No assignments = single-player combat, see all enemies
  }
  return enemyAssignments[playerId] ?? [];
}

/**
 * Check if an enemy is assigned to a specific player.
 * Returns true if no assignments exist (single-player combat).
 *
 * @param enemyAssignments - The enemy assignments map from CombatState
 * @param playerId - The player to check for
 * @param enemyInstanceId - The enemy instance ID to check
 * @returns True if the enemy is assigned to this player or no assignments exist
 */
export function isEnemyAssignedToPlayer(
  enemyAssignments: EnemyAssignments | undefined,
  playerId: string,
  enemyInstanceId: string
): boolean {
  if (!enemyAssignments) {
    return true; // No assignments = single-player combat, all enemies visible
  }
  const assigned = enemyAssignments[playerId];
  return assigned ? assigned.includes(enemyInstanceId) : false;
}
