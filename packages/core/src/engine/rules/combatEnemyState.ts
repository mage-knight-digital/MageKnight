/**
 * Shared combat enemy state rules.
 *
 * These helpers are used by both validators and ValidActions computation
 * to prevent rule drift. They determine when enemies can be targeted
 * for specific combat actions (blocking, attacking, damage assignment).
 */

import type { CombatEnemy } from "../../types/combat.js";
import {
  getEnemyAttackCount,
  isAttackBlocked,
  isAttackDamageAssigned,
  isEnemyFullyBlocked,
} from "../combat/enemyAttackHelpers.js";

/**
 * Check if an enemy can be blocked.
 *
 * An enemy can be blocked if:
 * - It is not defeated
 * - Its summoner is not hidden (if it's a summoned enemy)
 * - Its specific attack (if multi-attack) is not already blocked
 * - Not all of its attacks are already blocked
 */
export function canBlockEnemy(
  enemy: CombatEnemy,
  attackIndex?: number
): boolean {
  // Defeated enemies can't be blocked
  if (enemy.isDefeated) {
    return false;
  }

  // Cannot target hidden summoners - must block their summoned enemy instead
  if (enemy.isSummonerHidden) {
    return false;
  }

  // Get attack index (default to 0 for single-attack enemies)
  const attackIdx = attackIndex ?? 0;
  const attackCount = getEnemyAttackCount(enemy);

  // Validate attack index is in range
  if (attackIdx < 0 || attackIdx >= attackCount) {
    return false;
  }

  // Check if this specific attack is already blocked
  if (isAttackBlocked(enemy, attackIdx)) {
    return false;
  }

  // If all attacks are blocked, the enemy is fully blocked
  if (isEnemyFullyBlocked(enemy)) {
    return false;
  }

  return true;
}

/**
 * Check if an enemy can be attacked.
 *
 * An enemy can be attacked if:
 * - It is not defeated
 * - Its summoner is not hidden (if it's a summoned enemy)
 */
export function canAttackEnemy(enemy: CombatEnemy): boolean {
  // Defeated enemies can't be attacked
  if (enemy.isDefeated) {
    return false;
  }

  // Cannot target hidden summoners
  if (enemy.isSummonerHidden) {
    return false;
  }

  return true;
}

/**
 * Check if an enemy can have damage assigned to it.
 *
 * An enemy can receive damage if:
 * - It is not defeated
 * - Its summoner is not hidden (if it's a summoned enemy)
 * - Its specific attack (if multi-attack) hasn't already had damage assigned
 */
export function canAssignDamageToEnemy(
  enemy: CombatEnemy,
  attackIndex?: number
): boolean {
  // Defeated enemies can't receive damage
  if (enemy.isDefeated) {
    return false;
  }

  // Cannot target hidden summoners
  if (enemy.isSummonerHidden) {
    return false;
  }

  // Get attack index (default to 0 for single-attack enemies)
  const attackIdx = attackIndex ?? 0;
  const attackCount = getEnemyAttackCount(enemy);

  // Validate attack index is in range
  if (attackIdx < 0 || attackIdx >= attackCount) {
    return false;
  }

  // Check if damage is already assigned to this attack
  if (isAttackDamageAssigned(enemy, attackIdx)) {
    return false;
  }

  return true;
}

/**
 * Check if an attack index is valid for an enemy.
 *
 * Attack indices are 0-based and must be less than the enemy's attack count.
 */
export function isValidAttackIndex(
  enemy: CombatEnemy,
  attackIndex: number
): boolean {
  const attackCount = getEnemyAttackCount(enemy);
  return attackIndex >= 0 && attackIndex < attackCount;
}
