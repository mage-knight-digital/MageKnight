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
import type { CombatEnemy } from "../../types/combat.js";
import type { GameState } from "../../state/GameState.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { ABILITY_FORTIFIED, ABILITY_SWIFT, ABILITY_BRUTAL } from "@mage-knight/shared";
import {
  getEffectiveEnemyArmor,
  getEffectiveEnemyAttack,
  doesEnemyAttackThisCombat,
} from "../modifiers.js";

/**
 * Get combat options for the current player.
 * Returns null if not in combat.
 *
 * @param state - Full game state, needed to query modifiers for effective enemy stats
 */
export function getCombatOptions(state: GameState): CombatOptions | null {
  const combat = state.combat;
  if (!combat) return null;

  const { phase, enemies, isAtFortifiedSite } = combat;

  // Compute phase-specific options
  switch (phase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return {
        phase,
        canEndPhase: true, // Can always skip ranged/siege
        attacks: getAttackOptions(state, enemies, isAtFortifiedSite, true),
      };

    case COMBAT_PHASE_BLOCK:
      return {
        phase,
        canEndPhase: true, // Can skip blocking (take damage instead)
        blocks: getBlockOptions(state, enemies),
      };

    case COMBAT_PHASE_ASSIGN_DAMAGE:
      return {
        phase,
        canEndPhase: canEndAssignDamagePhase(state, enemies),
        damageAssignments: getDamageAssignmentOptions(state, enemies),
      };

    case COMBAT_PHASE_ATTACK:
      return {
        phase,
        canEndPhase: true, // Can skip attacking (enemies survive)
        attacks: getAttackOptions(state, enemies, isAtFortifiedSite, false),
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
 * Uses effective armor (after modifiers like Tremor's armor reduction).
 */
function getAttackOptions(
  state: GameState,
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

    // Count resistances for Resistance Break modifier
    const resistances = enemy.definition.resistances;
    const resistanceCount = resistances
      ? (resistances.physical ? 1 : 0) +
        (resistances.fire ? 1 : 0) +
        (resistances.ice ? 1 : 0)
      : 0;

    // Use effective armor (after modifiers like Tremor)
    const effectiveArmor = getEffectiveEnemyArmor(
      state,
      enemy.instanceId,
      enemy.definition.armor,
      resistanceCount
    );

    return {
      enemyInstanceId: enemy.instanceId,
      enemyName: enemy.definition.name,
      enemyArmor: effectiveArmor,
      isDefeated: enemy.isDefeated,
      isFortified,
      requiresSiege,
    };
  });
}

/**
 * Get block options for block phase.
 * Filters out enemies that don't attack (due to Chill/Whirlwind).
 * Uses effective attack values (after modifiers).
 */
function getBlockOptions(
  state: GameState,
  enemies: readonly CombatEnemy[]
): readonly BlockOption[] {
  return enemies
    .filter((enemy) => !enemy.isDefeated)
    // Filter out enemies that don't attack this combat (Chill, Whirlwind)
    .filter((enemy) => doesEnemyAttackThisCombat(state, enemy.instanceId))
    .map((enemy) => {
      const isSwift = enemy.definition.abilities.includes(ABILITY_SWIFT);
      const isBrutal = enemy.definition.abilities.includes(ABILITY_BRUTAL);

      // Use effective attack (after modifiers)
      const effectiveAttack = getEffectiveEnemyAttack(
        state,
        enemy.instanceId,
        enemy.definition.attack
      );

      // Swift enemies require 2x block
      const requiredBlock = isSwift ? effectiveAttack * 2 : effectiveAttack;

      return {
        enemyInstanceId: enemy.instanceId,
        enemyName: enemy.definition.name,
        enemyAttack: effectiveAttack,
        requiredBlock,
        isSwift,
        isBrutal,
        isBlocked: enemy.isBlocked,
      };
    });
}

/**
 * Get damage assignment options for assign damage phase.
 * Filters out enemies that don't attack (due to Chill/Whirlwind).
 * Uses effective attack values (after modifiers).
 */
function getDamageAssignmentOptions(
  state: GameState,
  enemies: readonly CombatEnemy[]
): readonly DamageAssignmentOption[] {
  return enemies
    .filter((enemy) => !enemy.isDefeated && !enemy.isBlocked && !enemy.damageAssigned)
    // Filter out enemies that don't attack this combat (Chill, Whirlwind)
    .filter((enemy) => doesEnemyAttackThisCombat(state, enemy.instanceId))
    .map((enemy) => {
      // Use effective attack (after modifiers)
      const effectiveAttack = getEffectiveEnemyAttack(
        state,
        enemy.instanceId,
        enemy.definition.attack
      );

      return {
        enemyInstanceId: enemy.instanceId,
        enemyName: enemy.definition.name,
        unassignedDamage: effectiveAttack,
      };
    });
}

/**
 * Check if the assign damage phase can be ended.
 * Can only end if all unblocked, attacking enemies have had damage assigned.
 * Enemies that don't attack (due to Chill/Whirlwind) don't need damage assigned.
 */
function canEndAssignDamagePhase(
  state: GameState,
  enemies: readonly CombatEnemy[]
): boolean {
  // All unblocked, non-defeated, attacking enemies must have damage assigned
  const unblockedAttacking = enemies.filter(
    (e) =>
      !e.isDefeated &&
      !e.isBlocked &&
      doesEnemyAttackThisCombat(state, e.instanceId)
  );
  return unblockedAttacking.every((e) => e.damageAssigned);
}
