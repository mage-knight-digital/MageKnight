/**
 * Ability helpers for damage assignment
 *
 * Functions for checking if enemy abilities are active and calculating
 * effective damage values during the damage assignment phase.
 */

import type { GameState } from "../../../state/GameState.js";
import type { CombatEnemy } from "../../../types/combat.js";
import type { EnemyAbilityType } from "@mage-knight/shared";
import {
  ABILITY_BRUTAL,
  ABILITY_POISON,
  ABILITY_PARALYZE,
} from "@mage-knight/shared";
import { isAbilityNullified } from "../../modifiers/index.js";
import { getEnemyAttacks } from "../../combat/enemyAttackHelpers.js";
import { getCumbersomeReducedAttack } from "../../combat/cumbersomeHelpers.js";

/**
 * Check if an enemy has a specific ability.
 */
export function hasAbility(
  enemy: CombatEnemy,
  abilityType: EnemyAbilityType
): boolean {
  return enemy.definition.abilities.includes(abilityType);
}

/**
 * Check if enemy's brutal ability is active (not nullified).
 * Brutal: DOUBLES the damage dealt by the enemy attack.
 */
export function isBrutalActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  if (!hasAbility(enemy, ABILITY_BRUTAL)) return false;
  return !isAbilityNullified(state, playerId, enemy.instanceId, ABILITY_BRUTAL);
}

/**
 * Check if enemy's poison ability is active (not nullified).
 * Poison (hero): wounds go to hand AND matching wounds go to discard.
 * Poison (unit): unit receives 2 wounds immediately = destroyed.
 */
export function isPoisonActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  if (!hasAbility(enemy, ABILITY_POISON)) return false;
  return !isAbilityNullified(state, playerId, enemy.instanceId, ABILITY_POISON);
}

/**
 * Check if enemy's paralyze ability is active (not nullified).
 * Paralyze (hero): discard all non-wound cards from hand when wounds are taken.
 * Paralyze (unit): unit is immediately destroyed when it would be wounded.
 */
export function isParalyzeActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  if (!hasAbility(enemy, ABILITY_PARALYZE)) return false;
  return !isAbilityNullified(
    state,
    playerId,
    enemy.instanceId,
    ABILITY_PARALYZE
  );
}

/**
 * Get effective damage from a specific attack.
 *
 * Order of operations (CRITICAL):
 * 1. Apply Cumbersome reduction (move points spent)
 * 2. Apply Brutal doubling (if active)
 *
 * @param enemy - Combat enemy instance
 * @param attackIndex - Which attack's damage to calculate (0-indexed)
 * @param state - Game state
 * @param playerId - Player receiving damage
 */
export function getEffectiveDamage(
  enemy: CombatEnemy,
  attackIndex: number,
  state: GameState,
  playerId: string
): number {
  const attacks = getEnemyAttacks(enemy);
  const attack = attacks[attackIndex];
  if (!attack) {
    throw new Error(
      `Attack index ${attackIndex} out of range (enemy has ${attacks.length} attacks)`
    );
  }

  let damage = attack.damage;

  // FIRST: Apply Cumbersome reduction (BEFORE Brutal)
  damage = getCumbersomeReducedAttack(state, playerId, enemy, damage);

  // SECOND: Brutal doubles the damage
  if (isBrutalActive(state, playerId, enemy)) {
    damage *= 2;
  }

  return damage;
}
