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
  UnitDamageTarget,
  AvailableAttackPool,
  EnemyAttackState,
  AssignAttackOption,
  UnassignAttackOption,
  ElementalDamageValues,
  AttackType,
  AttackElement,
  AvailableBlockPool,
  EnemyBlockState,
  AssignBlockOption,
  UnassignBlockOption,
} from "@mage-knight/shared";
import type { Element } from "@mage-knight/shared";
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
  getUnit,
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
import { isAttackResisted, calculateTotalBlock } from "../combat/elementalCalc.js";
import type { ElementalAttackValues } from "../../types/player.js";

// ============================================================================
// Available Attack Pool Computation
// ============================================================================

/**
 * Compute the available attack pool (accumulated - assigned).
 * This shows what attack the player can still assign to enemies.
 *
 * @param isRangedSiegePhase - If true, only include ranged/siege. If false (attack phase), only include melee.
 */
function computeAvailableAttack(
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
// Block Allocation Computation
// ============================================================================

/**
 * Compute the available block pool (accumulated - assigned).
 * This shows what block the player can still assign to enemies.
 */
function computeAvailableBlock(
  blockElements: ElementalAttackValues,
  assignedBlockElements: ElementalAttackValues
): AvailableBlockPool {
  return {
    physical: Math.max(0, blockElements.physical - assignedBlockElements.physical),
    fire: Math.max(0, blockElements.fire - assignedBlockElements.fire),
    ice: Math.max(0, blockElements.ice - assignedBlockElements.ice),
    coldFire: Math.max(0, blockElements.coldFire - assignedBlockElements.coldFire),
  };
}

/**
 * Compute the block state for a single enemy during BLOCK phase.
 */
function computeEnemyBlockState(
  enemy: CombatEnemy,
  combat: CombatState,
  state: GameState
): EnemyBlockState {
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

  // Get pending block for this enemy
  const rawPending = combat.pendingBlock[enemy.instanceId] ?? createEmptyPendingDamage();
  const pendingBlock: ElementalDamageValues = {
    physical: rawPending.physical,
    fire: rawPending.fire,
    ice: rawPending.ice,
    coldFire: rawPending.coldFire,
  };

  // Calculate effective block value after elemental efficiency
  const blockSources: { element: Element; value: number }[] = [];
  if (rawPending.physical > 0) {
    blockSources.push({ element: "physical" as Element, value: rawPending.physical });
  }
  if (rawPending.fire > 0) {
    blockSources.push({ element: "fire" as Element, value: rawPending.fire });
  }
  if (rawPending.ice > 0) {
    blockSources.push({ element: "ice" as Element, value: rawPending.ice });
  }
  if (rawPending.coldFire > 0) {
    blockSources.push({ element: "cold_fire" as Element, value: rawPending.coldFire });
  }

  const effectiveBlock = calculateTotalBlock(
    blockSources,
    enemy.definition.attackElement
  );

  // Can block if effective block >= required
  const canBlock = effectiveBlock >= requiredBlock;

  return {
    enemyInstanceId: enemy.instanceId,
    enemyName: enemy.definition.name,
    enemyAttack: effectiveAttack,
    attackElement: enemy.definition.attackElement,
    requiredBlock,
    isSwift,
    isBrutal,
    isBlocked: enemy.isBlocked,
    isDefeated: enemy.isDefeated,
    pendingBlock,
    effectiveBlock,
    canBlock,
  };
}

/** All block elements for iteration */
interface BlockElementCombo {
  element: AttackElement;
  poolKey: keyof AvailableBlockPool;
}

const BLOCK_ELEMENT_COMBOS: readonly BlockElementCombo[] = [
  { element: ATTACK_ELEMENT_PHYSICAL, poolKey: "physical" },
  { element: ATTACK_ELEMENT_FIRE, poolKey: "fire" },
  { element: ATTACK_ELEMENT_ICE, poolKey: "ice" },
  { element: ATTACK_ELEMENT_COLD_FIRE, poolKey: "coldFire" },
];

/**
 * Generate list of valid block assignments for the current phase.
 * Each option represents a single point of block that can be assigned.
 */
function generateAssignableBlocks(
  enemies: readonly EnemyBlockState[],
  availablePool: AvailableBlockPool,
  state: GameState
): readonly AssignBlockOption[] {
  const options: AssignBlockOption[] = [];

  // For each non-defeated, non-blocked, attacking enemy
  for (const enemy of enemies) {
    if (enemy.isDefeated || enemy.isBlocked) continue;

    // Check if enemy actually attacks this combat (not affected by Chill/Whirlwind)
    // We need the raw CombatEnemy to check this
    const combatEnemy = state.combat?.enemies.find(
      (e) => e.instanceId === enemy.enemyInstanceId
    );
    if (combatEnemy && !doesEnemyAttackThisCombat(state, combatEnemy.instanceId)) {
      continue;
    }

    // For each element
    for (const combo of BLOCK_ELEMENT_COMBOS) {
      const available = availablePool[combo.poolKey];
      if (available <= 0) continue;

      // Add option for assigning 1 point
      options.push({
        enemyInstanceId: enemy.enemyInstanceId,
        element: combo.element,
        amount: 1,
      });
    }
  }

  return options;
}

/**
 * Generate list of valid block unassignments based on pending block.
 * Each option represents removing a single point of assigned block.
 */
function generateUnassignableBlocks(
  enemies: readonly EnemyBlockState[],
  combat: CombatState
): readonly UnassignBlockOption[] {
  const options: UnassignBlockOption[] = [];

  // For each enemy with pending block
  for (const enemy of enemies) {
    const pending = combat.pendingBlock[enemy.enemyInstanceId];
    if (!pending) continue;

    // For each element with pending block
    for (const combo of BLOCK_ELEMENT_COMBOS) {
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
          element: combo.element,
          amount: 1,
        });
      }
    }
  }

  return options;
}

/**
 * Compute options for BLOCK phase.
 * Uses the incremental block assignment system.
 */
function computeBlockPhaseOptions(
  state: GameState,
  combat: CombatState,
  player: Player | undefined
): CombatOptions {
  // If no player found, return minimal options
  if (!player) {
    return {
      phase: COMBAT_PHASE_BLOCK,
      canEndPhase: true,
      blocks: getBlockOptions(state, combat.enemies),
    };
  }

  // Compute available block pool (with fallbacks for legacy state)
  const emptyBlockElements = { physical: 0, fire: 0, ice: 0, coldFire: 0 };
  const availableBlock = computeAvailableBlock(
    player.combatAccumulator.blockElements ?? emptyBlockElements,
    player.combatAccumulator.assignedBlockElements ?? emptyBlockElements
  );

  // Compute enemy block states
  const enemyBlockStates = combat.enemies
    .filter((enemy) => !enemy.isDefeated)
    .filter((enemy) => doesEnemyAttackThisCombat(state, enemy.instanceId))
    .map((enemy) => computeEnemyBlockState(enemy, combat, state));

  // Generate assignable blocks
  const assignableBlocks = generateAssignableBlocks(
    enemyBlockStates,
    availableBlock,
    state
  );

  // Generate unassignable blocks
  const unassignableBlocks = generateUnassignableBlocks(enemyBlockStates, combat);

  return {
    phase: COMBAT_PHASE_BLOCK,
    canEndPhase: true, // Can skip blocking (take damage instead)
    blocks: getBlockOptions(state, combat.enemies),
    availableBlock,
    enemyBlockStates,
    assignableBlocks,
    unassignableBlocks,
  };
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
      return computeBlockPhaseOptions(state, combat, currentPlayer);

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

  // Compute available attack pool (only include phase-relevant attack types)
  const availableAttack = computeAvailableAttack(
    player.combatAccumulator.attack,
    player.combatAccumulator.assignedAttack,
    isRangedSiegePhase
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

// ============================================================================
// Unit Damage Target Computation
// ============================================================================

/**
 * Compute available unit targets for damage assignment.
 *
 * Rules:
 * - Only unwounded units can be assigned damage
 * - Units that already had damage assigned this combat cannot be assigned again
 *   (even if they weren't wounded due to resistance)
 * - Units not present in combat (dungeons/tombs/mazes) are excluded
 *
 * @param player - Player whose units to check
 * @param attackElement - Element of the enemy's attack
 * @param unitsAllowed - Whether units are allowed in this combat
 */
function computeAvailableUnitTargets(
  player: Player,
  attackElement: Element,
  unitsAllowed: boolean
): readonly UnitDamageTarget[] {
  // If units are not allowed in this combat (dungeon/tomb), return empty array
  if (!unitsAllowed) {
    return [];
  }

  return player.units.map((unit) => {
    const unitDef = getUnit(unit.unitId);
    const resistances = unitDef.resistances;

    // Check if unit is resistant to this attack element
    const isResistantToAttack = isAttackResisted(attackElement, resistances);

    // Unit can be assigned if not wounded AND hasn't been assigned this combat
    const canBeAssigned = !unit.wounded && !unit.usedResistanceThisCombat;

    return {
      unitInstanceId: unit.instanceId,
      unitName: unitDef.name,
      armor: unitDef.armor,
      isResistantToAttack,
      alreadyAssignedThisCombat: unit.usedResistanceThisCombat,
      isWounded: unit.wounded,
      canBeAssigned,
    };
  });
}

/**
 * Get damage assignment options for assign damage phase.
 * Filters out enemies that don't attack (due to Chill/Whirlwind).
 * Uses effective attack values (after modifiers).
 * Includes unit targets for damage assignment.
 */
function getDamageAssignmentOptions(
  state: GameState,
  enemies: readonly CombatEnemy[]
): readonly DamageAssignmentOption[] {
  const combat = state.combat;
  if (!combat) return [];

  // Get current player for unit access
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  const currentPlayer = state.players.find((p) => p.id === currentPlayerId);

  return enemies
    .filter((enemy) => !enemy.isDefeated && !enemy.isBlocked && !enemy.damageAssigned)
    // Filter out enemies that don't attack this combat (Chill, Whirlwind)
    .filter((enemy) => doesEnemyAttackThisCombat(state, enemy.instanceId))
    .map((enemy) => {
      // Use effective attack (after modifiers)
      const rawAttack = getEffectiveEnemyAttack(
        state,
        enemy.instanceId,
        enemy.definition.attack
      );

      // Check for Brutal ability
      const isBrutal = enemy.definition.abilities.includes(ABILITY_BRUTAL);
      const totalDamage = isBrutal ? rawAttack * 2 : rawAttack;

      // Get attack element
      const attackElement = enemy.definition.attackElement;

      // Compute available unit targets
      const availableUnits = currentPlayer
        ? computeAvailableUnitTargets(currentPlayer, attackElement, combat.unitsAllowed)
        : [];

      return {
        enemyInstanceId: enemy.instanceId,
        enemyName: enemy.definition.name,
        attackElement,
        isBrutal,
        rawAttackValue: rawAttack,
        totalDamage,
        unassignedDamage: totalDamage, // Deprecated but kept for backwards compatibility
        availableUnits,
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
