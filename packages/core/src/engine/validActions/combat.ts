/**
 * Combat options computation for ValidActions.
 *
 * Computes what combat actions are valid based on the current combat phase.
 *
 * NOTE: Phase 3 will add incremental attack assignment fields (availableAttack, enemies,
 * assignableAttacks, unassignableAttacks). For now, this provides the legacy structure
 * minus the removed `attacks` field.
 */

import type {
  CombatOptions,
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
import { ABILITY_SWIFT, ABILITY_BRUTAL } from "@mage-knight/shared";
import {
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

  const { phase, enemies } = combat;

  // Compute phase-specific options
  // NOTE: Phase 3 will add incremental attack assignment (availableAttack, enemies,
  // assignableAttacks, unassignableAttacks) for RANGED_SIEGE and ATTACK phases
  switch (phase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return {
        phase,
        canEndPhase: true, // Can always skip ranged/siege
        // Phase 3 TODO: Add assignableAttacks, unassignableAttacks, availableAttack, enemies
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
        // Phase 3 TODO: Add assignableAttacks, unassignableAttacks, availableAttack, enemies
      };

    default:
      return {
        phase,
        canEndPhase: true,
      };
  }
}

// NOTE: getAttackOptions was removed. Phase 3 will add computation for
// incremental attack assignment (availableAttack, enemies, assignableAttacks, unassignableAttacks).

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
