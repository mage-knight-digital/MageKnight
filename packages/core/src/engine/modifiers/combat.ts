/**
 * Combat-related modifier effective value calculations
 *
 * Functions for calculating effective enemy stats and checking combat
 * modifiers like ability nullification and resistance removal.
 */

import type { GameState } from "../../state/GameState.js";
import type {
  EnemyStatModifier,
  CombatValueModifier,
  AbilityNullifierModifier,
} from "../../types/modifiers.js";
import type { EnemyAbility } from "../../types/enemy.js";
import type { CombatEnemy, CombatPhase } from "../../types/combat.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { ABILITY_ELUSIVE } from "@mage-knight/shared";
import { ENEMY_ABILITY_ELUSIVE } from "../../types/enemyConstants.js";
import {
  ABILITY_ANY,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_COMBAT_VALUE,
  EFFECT_ENEMY_SKIP_ATTACK,
  EFFECT_ENEMY_STAT,
  EFFECT_REMOVE_RESISTANCES,
  ENEMY_STAT_ARMOR,
  ENEMY_STAT_ATTACK,
  SCOPE_ALL_ENEMIES,
  SCOPE_ONE_ENEMY,
} from "../modifierConstants.js";
import {
  getModifiersForPlayer,
  getModifiersForEnemy,
  hasArcaneImmunity,
} from "./queries.js";
import { isEnemyFullyBlocked } from "../combat/enemyAttackHelpers.js";

/**
 * Get effective enemy armor after modifiers.
 * @param resistanceCount - number of resistances the enemy has (for Resistance Break)
 */
export function getEffectiveEnemyArmor(
  state: GameState,
  enemyId: string,
  baseArmor: number,
  resistanceCount: number
): number {
  const modifiers = getModifiersForEnemy(state, enemyId)
    .filter(
      (m) => m.effect.type === EFFECT_ENEMY_STAT && m.effect.stat === ENEMY_STAT_ARMOR
    )
    .map((m) => m.effect as EnemyStatModifier);

  let armor = baseArmor;
  let minAllowed = 1;

  for (const mod of modifiers) {
    if (mod.perResistance) {
      // Resistance Break: -1 per resistance
      armor += mod.amount * resistanceCount;
    } else {
      armor += mod.amount;
    }
    minAllowed = Math.max(minAllowed, mod.minimum);
  }

  return Math.max(minAllowed, armor);
}

/**
 * Get effective enemy attack after modifiers.
 */
export function getEffectiveEnemyAttack(
  state: GameState,
  enemyId: string,
  baseAttack: number
): number {
  const modifiers = getModifiersForEnemy(state, enemyId)
    .filter(
      (m) =>
        m.effect.type === EFFECT_ENEMY_STAT && m.effect.stat === ENEMY_STAT_ATTACK
    )
    .map((m) => m.effect as EnemyStatModifier);

  let attack = baseAttack;
  // Default minimum is 0 - enemies can have 0 attack (e.g., Summoners)
  // Modifiers can set a higher minimum if needed
  let minAllowed = 0;

  for (const mod of modifiers) {
    attack += mod.amount;
    minAllowed = Math.max(minAllowed, mod.minimum);
  }

  return Math.max(minAllowed, attack);
}

/**
 * Get combat value bonus from active modifiers.
 * Used to add modifier bonuses to attack/block values.
 */
export function getEffectiveCombatBonus(
  state: GameState,
  playerId: string,
  valueType: CombatValueModifier["valueType"],
  element?: CombatValueModifier["element"]
): number {
  const modifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_COMBAT_VALUE)
    .map((m) => m.effect as CombatValueModifier);

  let bonus = 0;

  for (const mod of modifiers) {
    // Check if valueType matches
    if (mod.valueType !== valueType) continue;

    // Check if element matches (undefined on modifier means all elements)
    if (mod.element && element && mod.element !== element) continue;

    bonus += mod.amount;
  }

  return bonus;
}

/**
 * Check if an enemy ability is nullified by active modifiers.
 * Used to check if abilities like Swift, Brutal, Fortified, etc. should be ignored.
 *
 * Note: Arcane Immunity blocks ability nullification effects (non-Attack/Block effect).
 */
export function isAbilityNullified(
  state: GameState,
  playerId: string,
  enemyId: string,
  abilityType: EnemyAbility["type"]
): boolean {
  // Arcane Immunity blocks ability nullification effects
  if (hasArcaneImmunity(state, enemyId)) {
    return false;
  }

  const modifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_ABILITY_NULLIFIER)
    .map((m) => ({
      scope: m.scope,
      effect: m.effect as AbilityNullifierModifier,
    }));

  for (const mod of modifiers) {
    // Check scope targets this enemy
    if (mod.scope.type === SCOPE_ONE_ENEMY && mod.scope.enemyId !== enemyId)
      continue;
    if (mod.scope.type !== SCOPE_ONE_ENEMY && mod.scope.type !== SCOPE_ALL_ENEMIES)
      continue;

    // Check ability match
    if (mod.effect.ability === ABILITY_ANY || mod.effect.ability === abilityType) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an enemy attacks this combat.
 * Returns false if the enemy has the EFFECT_ENEMY_SKIP_ATTACK modifier.
 * Used by Chill, Whirlwind spells to prevent enemies from dealing damage.
 *
 * Note: Arcane Immunity blocks this effect (non-Attack/Block effect).
 */
export function doesEnemyAttackThisCombat(
  state: GameState,
  enemyId: string
): boolean {
  // Arcane Immunity blocks skip-attack effects
  if (hasArcaneImmunity(state, enemyId)) {
    return true;
  }
  const modifiers = getModifiersForEnemy(state, enemyId);
  return !modifiers.some((m) => m.effect.type === EFFECT_ENEMY_SKIP_ATTACK);
}

/**
 * Check if an enemy's resistances have been removed by active modifiers.
 * Returns true if any EFFECT_REMOVE_RESISTANCES modifier targets this enemy.
 * Used by Expose spell to remove enemy resistances.
 *
 * Note: Arcane Immunity blocks this effect (non-Attack/Block effect).
 */
export function areResistancesRemoved(
  state: GameState,
  enemyId: string
): boolean {
  // Arcane Immunity blocks resistance removal effects
  if (hasArcaneImmunity(state, enemyId)) {
    return false;
  }
  const modifiers = getModifiersForEnemy(state, enemyId);
  return modifiers.some((m) => m.effect.type === EFFECT_REMOVE_RESISTANCES);
}

/**
 * Get the base armor for an enemy, considering Elusive ability and combat phase.
 *
 * Elusive ability rules:
 * - RANGED_SIEGE phase: always uses armorElusive (higher value)
 * - ATTACK phase: uses armor (lower value) if ALL attacks were blocked,
 *   otherwise uses armorElusive (higher value)
 * - Other phases (BLOCK, ASSIGN_DAMAGE): uses armorElusive (higher value)
 *
 * Per rulebook: "If you do not block it (let it deal damage or prevent it from
 * attacking), it keeps using the higher value for the rest of the combat."
 *
 * @param enemy - Combat enemy instance
 * @param phase - Current combat phase
 * @param state - Game state (for ability nullification check)
 * @param playerId - Player ID (for ability nullification check)
 * @returns Base armor value to use (before modifiers)
 */
export function getBaseArmorForPhase(
  enemy: CombatEnemy,
  phase: CombatPhase,
  state: GameState,
  playerId: string
): number {
  const definition = enemy.definition;

  // If no elusive armor defined, or enemy doesn't have Elusive ability, use base armor
  if (
    definition.armorElusive === undefined ||
    !definition.abilities.includes(ABILITY_ELUSIVE)
  ) {
    return definition.armor;
  }

  // Check if Elusive is nullified (Elusive is defensive, doesn't affect attacks/blocks directly)
  // Note: Arcane Immunity blocks ability nullification, but Elusive itself isn't
  // blocked by Arcane Immunity (it's not a "non-Attack/Block effect targeting enemy")
  if (isAbilityNullified(state, playerId, enemy.instanceId, ENEMY_ABILITY_ELUSIVE)) {
    return definition.armor;
  }

  // RANGED_SIEGE phase: always use elusive (higher) armor
  if (phase === COMBAT_PHASE_RANGED_SIEGE) {
    return definition.armorElusive;
  }

  // ATTACK phase: use base (lower) armor only if ALL attacks were blocked
  if (phase === COMBAT_PHASE_ATTACK) {
    const fullyBlocked = isEnemyFullyBlocked(enemy);
    return fullyBlocked ? definition.armor : definition.armorElusive;
  }

  // BLOCK and ASSIGN_DAMAGE phases: use elusive (higher) armor
  // This ensures UI shows the elusive armor during these phases
  return definition.armorElusive;
}
