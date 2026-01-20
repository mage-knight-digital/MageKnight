/**
 * Combat options computation for ValidActions.
 *
 * Computes what combat actions are valid based on the current combat phase.
 * Includes incremental attack assignment fields for RANGED_SIEGE and ATTACK phases.
 */

import type {
  CombatOptions,
  BlockOption,
  DamageAssignmentOption,
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
  ABILITY_SWIFT,
  ABILITY_BRUTAL,
} from "@mage-knight/shared";
import type { CombatEnemy, CombatState } from "../../types/combat.js";
import { createEmptyPendingDamage } from "../../types/combat.js";
import type { GameState } from "../../state/GameState.js";
import type { AccumulatedAttack, Player } from "../../types/player.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import {
  getEffectiveEnemyAttack,
  doesEnemyAttackThisCombat,
} from "../modifiers.js";
import type { Resistances } from "../combat/elementalCalc.js";
import { isAttackResisted } from "../combat/elementalCalc.js";

// ============================================================================
// Available Attack Pool Computation
// ============================================================================

/**
 * Compute the available attack pool (accumulated - assigned).
 * This shows what attack the player can still assign to enemies.
 */
function computeAvailableAttack(
  attack: AccumulatedAttack,
  assigned: AccumulatedAttack
): AvailableAttackPool {
  return {
    // Physical attack by type
    ranged: Math.max(0, attack.ranged - assigned.ranged),
    siege: Math.max(0, attack.siege - assigned.siege),
    melee: Math.max(0, attack.normal - assigned.normal),
    // Elemental ranged
    fireRanged: Math.max(0, attack.rangedElements.fire - assigned.rangedElements.fire),
    iceRanged: Math.max(0, attack.rangedElements.ice - assigned.rangedElements.ice),
    // Elemental siege
    fireSiege: Math.max(0, attack.siegeElements.fire - assigned.siegeElements.fire),
    iceSiege: Math.max(0, attack.siegeElements.ice - assigned.siegeElements.ice),
    // Elemental melee
    fireMelee: Math.max(0, attack.normalElements.fire - assigned.normalElements.fire),
    iceMelee: Math.max(0, attack.normalElements.ice - assigned.normalElements.ice),
    coldFireMelee: Math.max(0, attack.normalElements.coldFire - assigned.normalElements.coldFire),
  };
}

// ============================================================================
// Effective Damage Computation
// ============================================================================

/**
 * Get enemy resistances as Resistances type.
 * Enemy definitions already have a resistances field.
 */
function getEnemyResistances(enemy: CombatEnemy): Resistances {
  return enemy.definition.resistances;
}

/**
 * Map AttackElement to Element type for resistance calculation.
 */
function attackElementToElement(element: AttackElement): "physical" | "fire" | "ice" | "cold_fire" {
  switch (element) {
    case ATTACK_ELEMENT_PHYSICAL:
      return "physical";
    case ATTACK_ELEMENT_FIRE:
      return "fire";
    case ATTACK_ELEMENT_ICE:
      return "ice";
    case ATTACK_ELEMENT_COLD_FIRE:
      return "cold_fire";
  }
}

/**
 * Calculate effective damage for a single element, applying resistance halving.
 */
function calculateEffectiveElement(
  rawValue: number,
  element: AttackElement,
  resistances: Resistances
): number {
  if (rawValue === 0) return 0;

  const elementType = attackElementToElement(element);
  const isResisted = isAttackResisted(elementType, resistances);

  return isResisted ? Math.floor(rawValue / 2) : rawValue;
}

/**
 * Calculate effective damage values from pending damage, applying resistances.
 */
function calculateEffectiveDamage(
  pending: ElementalDamageValues,
  resistances: Resistances
): ElementalDamageValues {
  return {
    physical: calculateEffectiveElement(pending.physical, ATTACK_ELEMENT_PHYSICAL, resistances),
    fire: calculateEffectiveElement(pending.fire, ATTACK_ELEMENT_FIRE, resistances),
    ice: calculateEffectiveElement(pending.ice, ATTACK_ELEMENT_ICE, resistances),
    coldFire: calculateEffectiveElement(pending.coldFire, ATTACK_ELEMENT_COLD_FIRE, resistances),
  };
}

// ============================================================================
// Enemy Attack State Computation
// ============================================================================

/**
 * Compute the attack state for a single enemy during RANGED_SIEGE or ATTACK phase.
 */
function computeEnemyAttackState(
  enemy: CombatEnemy,
  combat: CombatState,
  isRangedSiegePhase: boolean
): EnemyAttackState {
  const resistances = getEnemyResistances(enemy);

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

  // Determine if enemy requires siege (fortified site during ranged/siege phase)
  const isFortified = combat.isAtFortifiedSite;
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
      physical: resistances.physical,
      fire: resistances.fire,
      ice: resistances.ice,
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
function generateAssignableAttacks(
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
function generateUnassignableAttacks(
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
// Main getCombatOptions function
// ============================================================================

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

  // Get current player for accumulator access
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const currentPlayer = state.players.find((p) => p.id === currentPlayerId);

  // Compute phase-specific options
  switch (phase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return computeAttackPhaseOptions(state, combat, currentPlayer, true);

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
      return computeAttackPhaseOptions(state, combat, currentPlayer, false);

    default:
      return {
        phase,
        canEndPhase: true,
      };
  }
}

/**
 * Compute options for RANGED_SIEGE or ATTACK phase.
 * Both phases use the incremental attack assignment system.
 */
function computeAttackPhaseOptions(
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

  // Compute available attack pool
  const availableAttack = computeAvailableAttack(
    player.combatAccumulator.attack,
    player.combatAccumulator.assignedAttack
  );

  // Compute enemy states
  const enemyStates = combat.enemies.map((enemy) =>
    computeEnemyAttackState(enemy, combat, isRangedSiegePhase)
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
