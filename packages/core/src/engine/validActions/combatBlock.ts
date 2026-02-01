/**
 * Combat block options computation for ValidActions.
 *
 * Handles block pool computation and incremental block assignment for
 * the BLOCK phase.
 */

import type {
  CombatOptions,
  BlockOption,
  AvailableBlockPool,
  EnemyBlockState,
  AssignBlockOption,
  UnassignBlockOption,
  ElementalDamageValues,
  AttackElement,
} from "@mage-knight/shared";
import type { Element } from "@mage-knight/shared";
import {
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
import type { Player, ElementalAttackValues } from "../../types/player.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import {
  getEffectiveEnemyAttack,
  doesEnemyAttackThisCombat,
} from "../modifiers/index.js";
import { calculateTotalBlock } from "../combat/elementalCalc.js";
import {
  getEnemyAttack,
  getEnemyAttacks,
  isAttackBlocked,
} from "../combat/enemyAttackHelpers.js";

// ============================================================================
// Block Allocation Computation
// ============================================================================

/**
 * Compute the available block pool (accumulated - assigned).
 * This shows what block the player can still assign to enemies.
 */
export function computeAvailableBlock(
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
export function computeEnemyBlockState(
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
export function generateAssignableBlocks(
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
export function generateUnassignableBlocks(
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
export function computeBlockPhaseOptions(
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
  // Filter out hidden summoners - must block their summoned enemy instead
  // Filter out 0-attack enemies - nothing to block
  const enemyBlockStates = combat.enemies
    .filter((enemy) => !enemy.isDefeated)
    .filter((enemy) => !enemy.isSummonerHidden)
    .filter((enemy) => doesEnemyAttackThisCombat(state, enemy.instanceId))
    .filter((enemy) => getEffectiveEnemyAttack(state, enemy.instanceId, enemy.definition.attack) > 0)
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
// Block Options (Legacy)
// ============================================================================

/**
 * Get block options for block phase.
 * Filters out enemies that don't attack (due to Chill/Whirlwind).
 * Filters out hidden summoners (must block their summoned enemy instead).
 * Uses effective attack values (after modifiers).
 *
 * For multi-attack enemies, returns separate BlockOption for each unblocked attack.
 */
export function getBlockOptions(
  state: GameState,
  enemies: readonly CombatEnemy[]
): readonly BlockOption[] {
  const options: BlockOption[] = [];

  for (const enemy of enemies) {
    // Filter out defeated enemies
    if (enemy.isDefeated) continue;

    // Filter out hidden summoners - must block their summoned enemy instead
    if (enemy.isSummonerHidden) continue;

    // Filter out enemies that don't attack this combat (Chill, Whirlwind)
    if (!doesEnemyAttackThisCombat(state, enemy.instanceId)) continue;

    const isSwift = enemy.definition.abilities.includes(ABILITY_SWIFT);
    const isBrutal = enemy.definition.abilities.includes(ABILITY_BRUTAL);
    const attacks = getEnemyAttacks(enemy);
    const attackCount = attacks.length;

    // Generate a BlockOption for each unblocked attack
    for (let attackIndex = 0; attackIndex < attackCount; attackIndex++) {
      // Skip already blocked attacks
      if (isAttackBlocked(enemy, attackIndex)) continue;

      const attack = getEnemyAttack(enemy, attackIndex);

      // Use effective attack (after modifiers)
      const effectiveAttack = getEffectiveEnemyAttack(
        state,
        enemy.instanceId,
        attack.damage
      );

      // Filter out attacks with 0 effective attack (nothing to block)
      if (effectiveAttack <= 0) continue;

      // Swift enemies require 2x block
      const requiredBlock = isSwift ? effectiveAttack * 2 : effectiveAttack;

      // Build the base option
      const baseOption = {
        enemyInstanceId: enemy.instanceId,
        enemyName: enemy.definition.name,
        enemyAttack: effectiveAttack,
        attackElement: attack.element,
        requiredBlock,
        isSwift,
        isBrutal,
        isBlocked: false, // We only include unblocked attacks
      };

      // Only include attackIndex for multi-attack enemies
      if (attackCount > 1) {
        options.push({ ...baseOption, attackIndex });
      } else {
        options.push(baseOption);
      }
    }
  }

  return options;
}
