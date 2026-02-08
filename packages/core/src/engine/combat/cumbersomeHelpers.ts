/**
 * Cumbersome ability helper functions
 *
 * Cumbersome: In the Block phase, you may spend Move points; for each Move point
 * spent, the attack is reduced by 1 for the rest of the turn. An attack reduced
 * to 0 is considered successfully blocked.
 *
 * CRITICAL: Reduction applies BEFORE Swift doubling.
 *
 * @module engine/combat/cumbersomeHelpers
 */

import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy } from "../../types/combat.js";
import type { EnemyAbilityType } from "@mage-knight/shared";
import { ABILITY_CUMBERSOME } from "@mage-knight/shared";
import { isAbilityNullified } from "../modifiers/index.js";
import { getModifiersForEnemy } from "../modifiers/queries.js";
import { EFFECT_GRANT_ENEMY_ABILITY } from "../../types/modifierConstants.js";

/**
 * Check if an enemy has a specific ability (native or granted by modifiers).
 */
function hasAbility(enemy: CombatEnemy, abilityType: EnemyAbilityType): boolean {
  return enemy.definition.abilities.includes(abilityType);
}

/**
 * Check if an enemy has been granted an ability via modifiers (e.g., Nature's Vengeance).
 */
function hasGrantedAbility(
  state: GameState,
  enemyInstanceId: string,
  abilityType: EnemyAbilityType
): boolean {
  const modifiers = getModifiersForEnemy(state, enemyInstanceId);
  return modifiers.some(
    (m) =>
      m.effect.type === EFFECT_GRANT_ENEMY_ABILITY &&
      m.effect.ability === abilityType
  );
}

/**
 * Check if enemy's Cumbersome ability is active (not nullified).
 * Checks both native ability and dynamically granted ability (e.g., Nature's Vengeance).
 *
 * @param state - Game state
 * @param playerId - Player facing the enemy
 * @param enemy - Combat enemy instance
 * @returns True if enemy has Cumbersome and it's not nullified
 */
export function isCumbersomeActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  const hasNative = hasAbility(enemy, ABILITY_CUMBERSOME);
  const hasGranted = hasGrantedAbility(state, enemy.instanceId, ABILITY_CUMBERSOME);

  if (!hasNative && !hasGranted) return false;
  return !isAbilityNullified(state, playerId, enemy.instanceId, ABILITY_CUMBERSOME);
}

/**
 * Get the attack value for a Cumbersome enemy after move point reduction.
 * Returns base attack minus spent move points (minimum 0).
 *
 * IMPORTANT: This reduction happens BEFORE Swift doubling and BEFORE Brutal doubling.
 * Call this function first, then apply Swift/Brutal multipliers separately.
 *
 * @param state - Game state
 * @param playerId - Player facing the enemy
 * @param enemy - Combat enemy instance
 * @param baseAttack - Base attack value (before any reductions)
 * @returns Reduced attack value (baseAttack - cumbersomeReduction, min 0)
 */
export function getCumbersomeReducedAttack(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy,
  baseAttack: number
): number {
  // Only apply if Cumbersome is active (not nullified)
  if (!isCumbersomeActive(state, playerId, enemy)) {
    return baseAttack;
  }

  // No combat = no reductions
  if (!state.combat) {
    return baseAttack;
  }

  // Get the reduction amount from combat state
  const reduction = state.combat.cumbersomeReductions[enemy.instanceId] ?? 0;

  // Reduce attack (minimum 0)
  return Math.max(0, baseAttack - reduction);
}

/**
 * Check if a Cumbersome enemy's attack has been reduced to 0.
 * Per rules: "An attack reduced to 0 is considered successfully blocked."
 * This triggers Elusive's lower armor value.
 *
 * @param state - Game state
 * @param playerId - Player facing the enemy
 * @param enemy - Combat enemy instance
 * @param baseAttack - Base attack value (before any reductions)
 * @returns True if attack has been reduced to 0
 */
export function isCumbersomeAttackReducedToZero(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy,
  baseAttack: number
): boolean {
  // Only applies if Cumbersome is active
  if (!isCumbersomeActive(state, playerId, enemy)) {
    return false;
  }

  const reducedAttack = getCumbersomeReducedAttack(state, playerId, enemy, baseAttack);
  return reducedAttack === 0;
}

/**
 * Get the current cumbersome reduction for an enemy.
 *
 * @param state - Game state
 * @param enemyInstanceId - Enemy instance ID
 * @returns Number of move points spent (reduction amount)
 */
export function getCumbersomeReduction(
  state: GameState,
  enemyInstanceId: string
): number {
  if (!state.combat) return 0;
  return state.combat.cumbersomeReductions[enemyInstanceId] ?? 0;
}
