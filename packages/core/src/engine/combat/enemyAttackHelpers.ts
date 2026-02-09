/**
 * Enemy attack helpers for multi-attack support.
 *
 * These helper functions centralize attack array access logic,
 * providing backward compatibility with single-attack enemies while
 * supporting the new multi-attack system.
 */

import type { EnemyAttack, Element } from "@mage-knight/shared";
import type { CombatEnemy } from "../../types/combat.js";
import type { GameState } from "../../state/GameState.js";
import { getEffectiveAttackElement } from "../modifiers/combat.js";

/**
 * Get all attacks for an enemy (normalized to array format).
 * Single-attack enemies return array with one element.
 *
 * @param enemy - Combat enemy instance
 * @returns Array of enemy attacks (at least one element)
 */
export function getEnemyAttacks(enemy: CombatEnemy): readonly EnemyAttack[] {
  // Multi-attack path: use attacks array if present and non-empty
  if (enemy.definition.attacks && enemy.definition.attacks.length > 0) {
    return enemy.definition.attacks;
  }

  // Legacy path: synthesize single attack from attack/attackElement fields
  return [
    {
      damage: enemy.definition.attack,
      element: enemy.definition.attackElement,
    },
  ];
}

/**
 * Get the number of attacks for an enemy.
 *
 * @param enemy - Combat enemy instance
 * @returns Number of attacks (at least 1)
 */
export function getEnemyAttackCount(enemy: CombatEnemy): number {
  return getEnemyAttacks(enemy).length;
}

/**
 * Get a specific attack by index.
 *
 * @param enemy - Combat enemy instance
 * @param attackIndex - Index of the attack (0-based)
 * @returns The attack at the specified index
 * @throws Error if attackIndex is out of bounds
 */
export function getEnemyAttack(
  enemy: CombatEnemy,
  attackIndex: number
): EnemyAttack {
  const attacks = getEnemyAttacks(enemy);
  const attack = attacks[attackIndex];
  if (attackIndex < 0 || attackIndex >= attacks.length || !attack) {
    throw new Error(
      `Attack index ${attackIndex} out of range (enemy has ${attacks.length} attacks)`
    );
  }
  return attack;
}

/**
 * Check if a specific attack index is blocked.
 *
 * @param enemy - Combat enemy instance
 * @param attackIndex - Index of the attack (0-based)
 * @returns True if the attack is blocked
 */
export function isAttackBlocked(
  enemy: CombatEnemy,
  attackIndex: number
): boolean {
  // If enemy is fully blocked (legacy flag), all attacks are blocked
  if (enemy.isBlocked) return true;

  // Multi-attack path: check attacksBlocked array
  if (enemy.attacksBlocked) {
    return enemy.attacksBlocked[attackIndex] ?? false;
  }

  // Legacy single-attack path: if not isBlocked, the attack is not blocked
  return false;
}

/**
 * Check if a specific attack index has been cancelled.
 * Cancelled attacks don't deal damage but do NOT count as blocked
 * (important for Elusive armor — cancelled attacks use higher Elusive armor).
 * Used by Banner of Fear's cancel attack ability.
 *
 * @param enemy - Combat enemy instance
 * @param attackIndex - Index of the attack (0-based)
 * @returns True if the attack is cancelled
 */
export function isAttackCancelled(
  enemy: CombatEnemy,
  attackIndex: number
): boolean {
  if (enemy.attacksCancelled) {
    return enemy.attacksCancelled[attackIndex] ?? false;
  }
  return false;
}

/**
 * Check if all attacks for an enemy are blocked.
 * Returns true if ALL attacks are blocked.
 *
 * @param enemy - Combat enemy instance
 * @returns True if all attacks are blocked
 */
export function isEnemyFullyBlocked(enemy: CombatEnemy): boolean {
  // Legacy path: single isBlocked flag
  if (enemy.isBlocked) return true;

  // Multi-attack path: check if all attacks are blocked
  if (enemy.attacksBlocked) {
    const attackCount = getEnemyAttackCount(enemy);
    // Only check attacks up to the count (defensive: ignore extra array elements)
    for (let i = 0; i < attackCount; i++) {
      if (!enemy.attacksBlocked[i]) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Check if a specific attack has had damage assigned.
 *
 * @param enemy - Combat enemy instance
 * @param attackIndex - Index of the attack (0-based)
 * @returns True if damage has been assigned for this attack
 */
export function isAttackDamageAssigned(
  enemy: CombatEnemy,
  attackIndex: number
): boolean {
  // If enemy has damageAssigned flag set (legacy), all attacks are assigned
  if (enemy.damageAssigned) return true;

  // Multi-attack path: check attacksDamageAssigned array
  if (enemy.attacksDamageAssigned) {
    return enemy.attacksDamageAssigned[attackIndex] ?? false;
  }

  // Legacy single-attack path: if not damageAssigned, no attacks are assigned
  return false;
}

/**
 * Check if all attacks have had damage assigned (or are blocked).
 * A blocked attack doesn't need damage assigned.
 *
 * @param enemy - Combat enemy instance
 * @returns True if all unblocked attacks have damage assigned
 */
export function isEnemyFullyDamageAssigned(enemy: CombatEnemy): boolean {
  // Legacy path: single damageAssigned flag
  if (enemy.damageAssigned) return true;

  // If fully blocked, no damage assignment needed
  if (isEnemyFullyBlocked(enemy)) return true;

  // Multi-attack path: check if all unblocked/uncancelled attacks have damage assigned
  const attackCount = getEnemyAttackCount(enemy);
  for (let i = 0; i < attackCount; i++) {
    // Skip blocked attacks - they don't need damage assigned
    if (isAttackBlocked(enemy, i)) continue;
    // Skip cancelled attacks - they don't need damage assigned
    if (isAttackCancelled(enemy, i)) continue;

    // Check if this unblocked attack has damage assigned
    if (!isAttackDamageAssigned(enemy, i)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if enemy has multiple attacks.
 *
 * @param enemy - Combat enemy instance
 * @returns True if enemy has more than one attack
 */
export function hasMultipleAttacks(enemy: CombatEnemy): boolean {
  return getEnemyAttackCount(enemy) > 1;
}

/**
 * Get the indices of unblocked attacks for an enemy.
 *
 * @param enemy - Combat enemy instance
 * @returns Array of attack indices that are not blocked
 */
export function getUnblockedAttackIndices(enemy: CombatEnemy): number[] {
  const attackCount = getEnemyAttackCount(enemy);
  const unblockedIndices: number[] = [];

  for (let i = 0; i < attackCount; i++) {
    if (!isAttackBlocked(enemy, i) && !isAttackCancelled(enemy, i)) {
      unblockedIndices.push(i);
    }
  }

  return unblockedIndices;
}

/**
 * Get the indices of attacks that need damage assigned (unblocked and not yet assigned).
 *
 * @param enemy - Combat enemy instance
 * @returns Array of attack indices that need damage assigned
 */
export function getAttacksNeedingDamageAssignment(enemy: CombatEnemy): number[] {
  const attackCount = getEnemyAttackCount(enemy);
  const needsAssignment: number[] = [];

  for (let i = 0; i < attackCount; i++) {
    // Skip blocked attacks - they don't need damage assigned
    if (isAttackBlocked(enemy, i)) continue;
    // Skip cancelled attacks - they don't need damage assigned
    if (isAttackCancelled(enemy, i)) continue;

    // Include if not yet assigned
    if (!isAttackDamageAssigned(enemy, i)) {
      needsAssignment.push(i);
    }
  }

  return needsAssignment;
}

/**
 * Initialize the attacksBlocked array for a multi-attack enemy.
 * Returns an array of false values with length equal to attack count.
 *
 * @param enemy - Combat enemy instance
 * @returns Array of false values, or undefined for single-attack enemies
 */
export function initializeAttacksBlocked(
  enemy: CombatEnemy
): readonly boolean[] | undefined {
  const attackCount = getEnemyAttackCount(enemy);
  if (attackCount <= 1) return undefined;
  return new Array(attackCount).fill(false);
}

/**
 * Initialize the attacksDamageAssigned array for a multi-attack enemy.
 * Returns an array of false values with length equal to attack count.
 *
 * @param enemy - Combat enemy instance
 * @returns Array of false values, or undefined for single-attack enemies
 */
export function initializeAttacksDamageAssigned(
  enemy: CombatEnemy
): readonly boolean[] | undefined {
  const attackCount = getEnemyAttackCount(enemy);
  if (attackCount <= 1) return undefined;
  return new Array(attackCount).fill(false);
}

/**
 * Get the effective attack element for an enemy after element conversion modifiers.
 * Used by block and damage calculations to account for Know Your Prey element conversion.
 *
 * @param state - Game state (for checking modifiers)
 * @param enemy - Combat enemy instance
 * @param originalElement - The original attack element
 * @returns The effective element after any conversions
 */
export function getEffectiveEnemyAttackElement(
  state: GameState,
  enemy: CombatEnemy,
  originalElement: Element
): Element {
  return getEffectiveAttackElement(state, enemy.instanceId, originalElement);
}
