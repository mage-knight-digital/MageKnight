/**
 * Combat attack options computation for ValidActions.
 *
 * Handles attack pool computation and incremental attack assignment for
 * RANGED_SIEGE and ATTACK phases.
 */

import type {
  CombatOptions,
  AvailableAttackPool,
  EnemyAttackState,
  AssignAttackOption,
  UnassignAttackOption,
  ElementalDamageValues,
  AttackType,
  AttackElement,
} from "@mage-knight/shared";
import {
  ATTACK_TYPE_RANGED,
  ATTACK_TYPE_SIEGE,
  ATTACK_TYPE_MELEE,
  ATTACK_ELEMENT_PHYSICAL,
  ATTACK_ELEMENT_FIRE,
  ATTACK_ELEMENT_ICE,
  ATTACK_ELEMENT_COLD_FIRE,
  ABILITY_FORTIFIED,
} from "@mage-knight/shared";
import type { CombatEnemy, CombatState } from "../../types/combat.js";
import { createEmptyPendingDamage } from "../../types/combat.js";
import type { GameState } from "../../state/GameState.js";
import type { AccumulatedAttack, Player } from "../../types/player.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { isAbilityNullified } from "../modifiers.js";
import {
  getEnemyResistances,
  calculateEffectiveDamage,
} from "./combatHelpers.js";

// ============================================================================
// Available Attack Pool Computation
// ============================================================================

/**
 * Compute the available attack pool (accumulated - assigned).
 * This shows what attack the player can still assign to enemies.
 *
 * @param isRangedSiegePhase - If true, only include ranged/siege. If false (attack phase), only include melee.
 */
export function computeAvailableAttack(
  attack: AccumulatedAttack,
  assigned: AccumulatedAttack,
  isRangedSiegePhase: boolean
): AvailableAttackPool {
  if (isRangedSiegePhase) {
    // Ranged/Siege phase: only ranged and siege attack available
    return {
      ranged: Math.max(0, attack.ranged - assigned.ranged),
      siege: Math.max(0, attack.siege - assigned.siege),
      melee: 0, // Not available in ranged/siege phase
      fireRanged: Math.max(0, attack.rangedElements.fire - assigned.rangedElements.fire),
      iceRanged: Math.max(0, attack.rangedElements.ice - assigned.rangedElements.ice),
      fireSiege: Math.max(0, attack.siegeElements.fire - assigned.siegeElements.fire),
      iceSiege: Math.max(0, attack.siegeElements.ice - assigned.siegeElements.ice),
      fireMelee: 0,
      iceMelee: 0,
      coldFireMelee: 0,
    };
  } else {
    // Attack phase: only melee attack available
    return {
      ranged: 0, // Not available in attack phase
      siege: 0,
      melee: Math.max(0, attack.normal - assigned.normal),
      fireRanged: 0,
      iceRanged: 0,
      fireSiege: 0,
      iceSiege: 0,
      fireMelee: Math.max(0, attack.normalElements.fire - assigned.normalElements.fire),
      iceMelee: Math.max(0, attack.normalElements.ice - assigned.normalElements.ice),
      coldFireMelee: Math.max(0, attack.normalElements.coldFire - assigned.normalElements.coldFire),
    };
  }
}

// ============================================================================
// Enemy Attack State Computation
// ============================================================================

/**
 * Compute the attack state for a single enemy during RANGED_SIEGE or ATTACK phase.
 */
export function computeEnemyAttackState(
  state: GameState,
  enemy: CombatEnemy,
  combat: CombatState,
  isRangedSiegePhase: boolean,
  playerId: string
): EnemyAttackState {
  const resistances = getEnemyResistances(state, enemy);

  // Get pending damage for this enemy (or empty if none assigned yet)
  const rawPending = combat.pendingDamage[enemy.instanceId] ?? createEmptyPendingDamage();
  const pendingDamage: ElementalDamageValues = {
    physical: rawPending.physical,
    fire: rawPending.fire,
    ice: rawPending.ice,
    coldFire: rawPending.coldFire,
  };

  // Calculate effective damage after resistances
  const effectiveDamage = calculateEffectiveDamage(pendingDamage, resistances);

  // Sum up total effective damage
  const totalEffectiveDamage =
    effectiveDamage.physical +
    effectiveDamage.fire +
    effectiveDamage.ice +
    effectiveDamage.coldFire;

  // Check if enemy can be defeated with current pending
  const armor = enemy.definition.armor;
  const canDefeat = totalEffectiveDamage >= armor;

  // Determine if enemy is fortified - check both site fortification and enemy ability
  // Consider fortification removal by modifiers (Expose spell)
  const hasAbilityFortified =
    enemy.definition.abilities.includes(ABILITY_FORTIFIED) &&
    !isAbilityNullified(state, playerId, enemy.instanceId, ABILITY_FORTIFIED);
  const hasSiteFortification =
    combat.isAtFortifiedSite &&
    enemy.isRequiredForConquest &&
    !isAbilityNullified(state, playerId, enemy.instanceId, ABILITY_FORTIFIED);
  const isFortified = hasAbilityFortified || hasSiteFortification;
  const requiresSiege = isRangedSiegePhase && isFortified;

  return {
    enemyInstanceId: enemy.instanceId,
    enemyName: enemy.definition.name,
    armor,
    isDefeated: enemy.isDefeated,
    isFortified,
    requiresSiege,
    pendingDamage,
    effectiveDamage,
    totalEffectiveDamage,
    canDefeat,
    resistances: {
      physical: resistances.includes("physical"),
      fire: resistances.includes("fire"),
      ice: resistances.includes("ice"),
    },
  };
}

// ============================================================================
// Assignable/Unassignable Attack Generation
// ============================================================================

/** All attack type/element combinations for iteration */
interface AttackTypeElementCombo {
  attackType: AttackType;
  element: AttackElement;
  poolKey: keyof AvailableAttackPool;
}

/** Valid combos for ranged/siege phase (only ranged and siege types) */
const RANGED_SIEGE_COMBOS: readonly AttackTypeElementCombo[] = [
  { attackType: ATTACK_TYPE_RANGED, element: ATTACK_ELEMENT_PHYSICAL, poolKey: "ranged" },
  { attackType: ATTACK_TYPE_RANGED, element: ATTACK_ELEMENT_FIRE, poolKey: "fireRanged" },
  { attackType: ATTACK_TYPE_RANGED, element: ATTACK_ELEMENT_ICE, poolKey: "iceRanged" },
  { attackType: ATTACK_TYPE_SIEGE, element: ATTACK_ELEMENT_PHYSICAL, poolKey: "siege" },
  { attackType: ATTACK_TYPE_SIEGE, element: ATTACK_ELEMENT_FIRE, poolKey: "fireSiege" },
  { attackType: ATTACK_TYPE_SIEGE, element: ATTACK_ELEMENT_ICE, poolKey: "iceSiege" },
];

/** Valid combos for attack phase (melee only) */
const ATTACK_PHASE_COMBOS: readonly AttackTypeElementCombo[] = [
  { attackType: ATTACK_TYPE_MELEE, element: ATTACK_ELEMENT_PHYSICAL, poolKey: "melee" },
  { attackType: ATTACK_TYPE_MELEE, element: ATTACK_ELEMENT_FIRE, poolKey: "fireMelee" },
  { attackType: ATTACK_TYPE_MELEE, element: ATTACK_ELEMENT_ICE, poolKey: "iceMelee" },
  { attackType: ATTACK_TYPE_MELEE, element: ATTACK_ELEMENT_COLD_FIRE, poolKey: "coldFireMelee" },
];

/**
 * Generate list of valid attack assignments for the current phase.
 * Each option represents a single point of damage that can be assigned.
 */
export function generateAssignableAttacks(
  enemies: readonly EnemyAttackState[],
  availablePool: AvailableAttackPool,
  isRangedSiegePhase: boolean
): readonly AssignAttackOption[] {
  const options: AssignAttackOption[] = [];

  // Get the valid combos for this phase
  const combos = isRangedSiegePhase ? RANGED_SIEGE_COMBOS : ATTACK_PHASE_COMBOS;

  // For each non-defeated enemy
  for (const enemy of enemies) {
    if (enemy.isDefeated) continue;

    // For each attack type/element combo
    for (const combo of combos) {
      const available = availablePool[combo.poolKey];
      if (available <= 0) continue;

      // Check fortification requirement: in ranged/siege phase, fortified enemies need siege
      if (isRangedSiegePhase && enemy.isFortified) {
        if (combo.attackType === ATTACK_TYPE_RANGED) {
          // Can't use ranged against fortified enemies
          continue;
        }
      }

      // Add option for assigning 1 point
      options.push({
        enemyInstanceId: enemy.enemyInstanceId,
        attackType: combo.attackType,
        element: combo.element,
        amount: 1,
      });
    }
  }

  return options;
}

/**
 * Generate list of valid attack unassignments based on pending damage.
 * Each option represents removing a single point of assigned damage.
 */
export function generateUnassignableAttacks(
  enemies: readonly EnemyAttackState[],
  combat: CombatState,
  isRangedSiegePhase: boolean
): readonly UnassignAttackOption[] {
  const options: UnassignAttackOption[] = [];

  // Get the valid combos for this phase
  const combos = isRangedSiegePhase ? RANGED_SIEGE_COMBOS : ATTACK_PHASE_COMBOS;

  // For each enemy with pending damage
  for (const enemy of enemies) {
    const pending = combat.pendingDamage[enemy.enemyInstanceId];
    if (!pending) continue;

    // For each element with pending damage
    for (const combo of combos) {
      let pendingAmount = 0;
      switch (combo.element) {
        case ATTACK_ELEMENT_PHYSICAL:
          pendingAmount = pending.physical;
          break;
        case ATTACK_ELEMENT_FIRE:
          pendingAmount = pending.fire;
          break;
        case ATTACK_ELEMENT_ICE:
          pendingAmount = pending.ice;
          break;
        case ATTACK_ELEMENT_COLD_FIRE:
          pendingAmount = pending.coldFire;
          break;
      }

      if (pendingAmount > 0) {
        options.push({
          enemyInstanceId: enemy.enemyInstanceId,
          attackType: combo.attackType,
          element: combo.element,
          amount: 1,
        });
      }
    }
  }

  return options;
}

// ============================================================================
// Attack Phase Options Computation
// ============================================================================

/**
 * Compute options for RANGED_SIEGE or ATTACK phase.
 * Both phases use the incremental attack assignment system.
 */
export function computeAttackPhaseOptions(
  state: GameState,
  combat: CombatState,
  player: Player | undefined,
  isRangedSiegePhase: boolean
): CombatOptions {
  const phase = isRangedSiegePhase ? COMBAT_PHASE_RANGED_SIEGE : COMBAT_PHASE_ATTACK;

  // If no player found, return minimal options
  if (!player) {
    return {
      phase,
      canEndPhase: true,
    };
  }

  // Compute available attack pool (only include phase-relevant attack types)
  const availableAttack = computeAvailableAttack(
    player.combatAccumulator.attack,
    player.combatAccumulator.assignedAttack,
    isRangedSiegePhase
  );

  // Compute enemy states (pass state and playerId for modifier checks)
  const enemyStates = combat.enemies.map((enemy) =>
    computeEnemyAttackState(state, enemy, combat, isRangedSiegePhase, player.id)
  );

  // Generate assignable attacks
  const assignableAttacks = generateAssignableAttacks(
    enemyStates,
    availableAttack,
    isRangedSiegePhase
  );

  // Generate unassignable attacks
  const unassignableAttacks = generateUnassignableAttacks(
    enemyStates,
    combat,
    isRangedSiegePhase
  );

  return {
    phase,
    canEndPhase: true, // Can always skip ranged/siege or attack phase
    availableAttack,
    enemies: enemyStates,
    assignableAttacks,
    unassignableAttacks,
  };
}
