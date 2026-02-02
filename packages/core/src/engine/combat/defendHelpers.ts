/**
 * Defend ability helper functions
 *
 * Defend: When you attack an enemy, another Defend enemy can add its
 * Defend value to the attacked enemy's armor. Each Defend enemy can only
 * use ability once per combat. Bonus persists even if defender dies.
 *
 * Rules:
 * - Only one Defend bonus can be applied to each target enemy
 * - Each Defend enemy can only use its ability once per combat
 * - Defend bonus persists even if the defending enemy is defeated
 * - Defend triggers when Attack points are assigned to a target
 * - Defend can apply to self when the Defend enemy is attacked
 * - Player chooses distribution (auto-assigned in current implementation)
 *
 * @module engine/combat/defendHelpers
 */

import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy } from "../../types/combat.js";
import { ABILITY_DEFEND } from "@mage-knight/shared";
import { ENEMY_ABILITY_DEFEND } from "../../types/enemyConstants.js";
import { isAbilityNullified } from "../modifiers/index.js";

/**
 * Check if enemy has Defend ability and it's not nullified.
 *
 * @param state - Game state
 * @param playerId - Player facing the enemy
 * @param enemy - Combat enemy instance
 * @returns True if enemy has active Defend ability with value > 0
 */
export function isDefendActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  if (!enemy?.definition?.abilities) return false;
  if (!enemy.definition.abilities.includes(ABILITY_DEFEND)) return false;
  if (!enemy.definition.defend || enemy.definition.defend <= 0) return false;
  return !isAbilityNullified(state, playerId, enemy.instanceId, ENEMY_ABILITY_DEFEND);
}

/**
 * Check if Defend enemy has already used its ability this combat.
 *
 * @param state - Game state
 * @param defenderEnemyId - The defender's enemy instance ID
 * @returns True if this enemy has already used Defend
 */
export function hasUsedDefend(
  state: GameState,
  defenderEnemyId: string
): boolean {
  if (!state.combat) return false;
  if (!state.combat.usedDefend) return false;
  return defenderEnemyId in state.combat.usedDefend;
}

/**
 * Get the Defend value for an enemy.
 * Returns 0 if enemy doesn't have Defend or it's nullified.
 *
 * @param state - Game state
 * @param playerId - Player facing the enemy
 * @param enemy - Combat enemy instance
 * @returns Defend value (e.g., 1 or 2) or 0 if not applicable
 */
export function getDefendValue(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): number {
  if (!isDefendActive(state, playerId, enemy)) return 0;
  return enemy.definition.defend ?? 0;
}

/**
 * Get available Defend enemies that can defend a target.
 * Excludes: defeated enemies, enemies that already used Defend.
 * Includes: the target itself (Defend can apply to self per rules).
 *
 * @param state - Game state
 * @param playerId - Player facing the enemies
 * @returns Array of available defender enemies
 */
export function getAvailableDefenders(
  state: GameState,
  playerId: string
): CombatEnemy[] {
  if (!state.combat) return [];

  return state.combat.enemies.filter((enemy) => {
    // Must be alive
    if (enemy.isDefeated) return false;

    // Must have active Defend ability
    if (!isDefendActive(state, playerId, enemy)) return false;

    // Must not have used Defend already
    if (hasUsedDefend(state, enemy.instanceId)) return false;

    return true;
  });
}

/**
 * Get the total Defend bonus for a target enemy.
 * Returns the bonus from defendBonuses map.
 *
 * @param state - Game state
 * @param targetEnemyId - Target enemy instance ID
 * @returns Total Defend bonus armor (or 0 if none)
 */
export function getTotalDefendBonus(
  state: GameState,
  targetEnemyId: string
): number {
  if (!state.combat) return 0;
  if (!state.combat.defendBonuses) return 0;
  return state.combat.defendBonuses[targetEnemyId] ?? 0;
}

/**
 * Assignment result for a single Defend action
 */
export interface DefendAssignment {
  readonly defenderId: string;
  readonly targetId: string;
  readonly value: number;
}

/**
 * Auto-assign Defend abilities to targets being attacked.
 *
 * Algorithm:
 * - Each target can receive AT MOST one Defend bonus (rule: only one Defend per target)
 * - Each Defend enemy can defend AT MOST once (rule: each Defend once per combat)
 * - First available Defend defends first target (simple auto-assign)
 * - Defend enemies can defend themselves when they are attacked
 *
 * Note: In the future, this could be expanded to allow player choice
 * for distribution, but current implementation auto-assigns.
 *
 * @param state - Game state
 * @param playerId - Player making the attack
 * @param targetEnemyIds - Enemy instance IDs being attacked
 * @returns Array of Defend assignments to apply
 */
export function autoAssignDefend(
  state: GameState,
  playerId: string,
  targetEnemyIds: readonly string[]
): readonly DefendAssignment[] {
  if (!state.combat) return [];

  const assignments: DefendAssignment[] = [];
  const usedDefenders = new Set<string>();
  const defendedTargets = new Set<string>();

  // Get all available defenders before we start assigning
  const availableDefenders = getAvailableDefenders(state, playerId);

  for (const targetId of targetEnemyIds) {
    // Skip if target already has a Defend bonus from earlier in this combat
    if (state.combat.defendBonuses && targetId in state.combat.defendBonuses) {
      continue;
    }

    // Skip if we're assigning Defend to this target in current batch
    if (defendedTargets.has(targetId)) {
      continue;
    }

    // Find first available defender not yet used in this batch
    const defender = availableDefenders.find(
      (d) => !usedDefenders.has(d.instanceId)
    );

    if (!defender) {
      continue; // No more defenders available
    }

    const defendValue = getDefendValue(state, playerId, defender);

    assignments.push({
      defenderId: defender.instanceId,
      targetId,
      value: defendValue,
    });

    usedDefenders.add(defender.instanceId);
    defendedTargets.add(targetId);
  }

  return assignments;
}
