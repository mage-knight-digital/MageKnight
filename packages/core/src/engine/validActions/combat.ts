/**
 * Combat options computation for ValidActions.
 *
 * Computes what combat actions are valid based on the current combat phase.
 */

import type {
  CombatOptions,
  AttackOption,
  BlockOption,
  DamageAssignmentOption,
} from "@mage-knight/shared";
import type { CombatState, CombatEnemy } from "../../types/combat.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { ABILITY_FORTIFIED, ABILITY_SWIFT, ABILITY_BRUTAL } from "@mage-knight/shared";

/**
 * Get combat options for the current player.
 * Returns null if not in combat.
 */
export function getCombatOptions(combat: CombatState | null): CombatOptions | null {
  if (!combat) return null;

  const { phase, enemies, isAtFortifiedSite } = combat;

  // Compute phase-specific options
  switch (phase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return {
        phase,
        canEndPhase: true, // Can always skip ranged/siege
        attacks: getAttackOptions(enemies, isAtFortifiedSite, true),
      };

    case COMBAT_PHASE_BLOCK:
      return {
        phase,
        canEndPhase: true, // Can skip blocking (take damage instead)
        blocks: getBlockOptions(enemies),
      };

    case COMBAT_PHASE_ASSIGN_DAMAGE:
      return {
        phase,
        canEndPhase: canEndAssignDamagePhase(enemies),
        damageAssignments: getDamageAssignmentOptions(enemies),
      };

    case COMBAT_PHASE_ATTACK:
      return {
        phase,
        canEndPhase: true, // Can skip attacking (enemies survive)
        attacks: getAttackOptions(enemies, isAtFortifiedSite, false),
      };

    default:
      return {
        phase,
        canEndPhase: true,
      };
  }
}

/**
 * Get attack options for ranged/siege or attack phase.
 */
function getAttackOptions(
  enemies: readonly CombatEnemy[],
  isAtFortifiedSite: boolean,
  isRangedSiegePhase: boolean
): readonly AttackOption[] {
  return enemies.map((enemy) => {
    const hasFortified = enemy.definition.abilities.includes(ABILITY_FORTIFIED);
    // Enemy is fortified if it has the ability OR if at a fortified site
    const isFortified = hasFortified || isAtFortifiedSite;
    // In ranged/siege phase, fortified enemies require siege attacks
    const requiresSiege = isRangedSiegePhase && isFortified;

    return {
      enemyInstanceId: enemy.instanceId,
      enemyName: enemy.definition.name,
      enemyArmor: enemy.definition.armor,
      isDefeated: enemy.isDefeated,
      isFortified,
      requiresSiege,
    };
  });
}

/**
 * Get block options for block phase.
 */
function getBlockOptions(
  enemies: readonly CombatEnemy[]
): readonly BlockOption[] {
  return enemies
    .filter((enemy) => !enemy.isDefeated)
    .map((enemy) => {
      const isSwift = enemy.definition.abilities.includes(ABILITY_SWIFT);
      const isBrutal = enemy.definition.abilities.includes(ABILITY_BRUTAL);

      return {
        enemyInstanceId: enemy.instanceId,
        enemyName: enemy.definition.name,
        enemyAttack: enemy.definition.attack,
        isSwift,
        isBrutal,
        isBlocked: enemy.isBlocked,
      };
    });
}

/**
 * Get damage assignment options for assign damage phase.
 */
function getDamageAssignmentOptions(
  enemies: readonly CombatEnemy[]
): readonly DamageAssignmentOption[] {
  return enemies
    .filter((enemy) => !enemy.isDefeated && !enemy.isBlocked && !enemy.damageAssigned)
    .map((enemy) => ({
      enemyInstanceId: enemy.instanceId,
      enemyName: enemy.definition.name,
      unassignedDamage: enemy.definition.attack,
    }));
}

/**
 * Check if the assign damage phase can be ended.
 * Can only end if all unblocked enemies have had damage assigned.
 */
function canEndAssignDamagePhase(
  enemies: readonly CombatEnemy[]
): boolean {
  // All unblocked, non-defeated enemies must have damage assigned
  const unblockedAlive = enemies.filter((e) => !e.isDefeated && !e.isBlocked);
  return unblockedAlive.every((e) => e.damageAssigned);
}
