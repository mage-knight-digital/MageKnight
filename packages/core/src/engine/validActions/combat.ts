/**
 * Combat options computation for ValidActions.
 *
 * Computes what combat actions are valid based on the current combat phase.
 * Includes incremental attack assignment fields for RANGED_SIEGE and ATTACK phases.
 *
 * This module is split into domain-specific files:
 * - combatHelpers.ts - Shared utility functions (resistances, elemental calc)
 * - combatAttack.ts - Attack pool computation and RANGED_SIEGE/ATTACK phases
 * - combatBlock.ts - Block pool computation and BLOCK phase
 * - combatDamage.ts - Damage assignment computation and ASSIGN_DAMAGE phase
 */

import type { CombatOptions } from "@mage-knight/shared";
import type { CombatState, EnemyAssignments } from "../../types/combat.js";
import type { CombatEnemy } from "../../types/combat.js";
import { isEnemyAssignedToPlayer } from "../helpers/cooperativeAssaultHelpers.js";
import type { GameState } from "../../state/GameState.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";

// Import from domain-specific modules
import { computeAttackPhaseOptions } from "./combatAttack.js";
import { computeBlockPhaseOptions } from "./combatBlock.js";
import { getDamageAssignmentOptions, canEndAssignDamagePhase } from "./combatDamage.js";

// Re-export all domain functions for backwards compatibility
export * from "./combatHelpers.js";
export * from "./combatAttack.js";
export * from "./combatBlock.js";
export * from "./combatDamage.js";

// ============================================================================
// Enemy Assignment Filtering (for Cooperative Assaults)
// ============================================================================

/**
 * Filter enemies to only those assigned to a specific player.
 * For cooperative assaults, each player can only see/target their assigned enemies.
 * Returns all enemies if no assignments exist (standard single-player combat).
 *
 * @param enemies - All enemies in combat
 * @param enemyAssignments - Map of player IDs to assigned enemy instance IDs
 * @param playerId - The player to filter for
 */
function filterEnemiesByAssignment(
  enemies: readonly CombatEnemy[],
  enemyAssignments: EnemyAssignments | undefined,
  playerId: string
): readonly CombatEnemy[] {
  if (!enemyAssignments) {
    return enemies; // No assignments = standard combat, all enemies visible
  }
  return enemies.filter((enemy) =>
    isEnemyAssignedToPlayer(enemyAssignments, playerId, enemy.instanceId)
  );
}

// ============================================================================
// Main getCombatOptions function
// ============================================================================

/**
 * Get combat options for the current player.
 * Returns null if not in combat.
 *
 * For cooperative assaults, filters enemies to only those assigned to the current player.
 * Each player can only see/target their assigned enemies.
 *
 * @param state - Full game state, needed to query modifiers for effective enemy stats
 */
export function getCombatOptions(state: GameState): CombatOptions | null {
  const combat = state.combat;
  if (!combat) return null;

  const { phase } = combat;

  // Get current player for accumulator access
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const currentPlayer = state.players.find((p) => p.id === currentPlayerId);

  // Filter enemies for cooperative assaults - player can only target their assigned enemies
  const visibleEnemies = filterEnemiesByAssignment(
    combat.enemies,
    combat.enemyAssignments,
    currentPlayerId ?? ""
  );

  // Create a filtered combat state for phase computations
  const filteredCombat: CombatState = {
    ...combat,
    enemies: visibleEnemies,
  };

  // Compute phase-specific options
  switch (phase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return computeAttackPhaseOptions(state, filteredCombat, currentPlayer, true);

    case COMBAT_PHASE_BLOCK:
      return computeBlockPhaseOptions(state, filteredCombat, currentPlayer);

    case COMBAT_PHASE_ASSIGN_DAMAGE:
      return {
        phase,
        canEndPhase: canEndAssignDamagePhase(state, visibleEnemies),
        damageAssignments: getDamageAssignmentOptions(state, visibleEnemies),
      };

    case COMBAT_PHASE_ATTACK:
      return computeAttackPhaseOptions(state, filteredCombat, currentPlayer, false);

    default:
      return {
        phase,
        canEndPhase: true,
      };
  }
}

// NOTE: getAttackOptions was removed. Phase 3 will add computation for
// incremental attack assignment (availableAttack, enemies, assignableAttacks, unassignableAttacks).
