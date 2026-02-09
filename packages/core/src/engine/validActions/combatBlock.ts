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
  CumbersomeOption,
  BannerFearOption,
  InfluenceToBlockConversionOption,
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
import type { CombatEnemy, CombatState, PendingElementalDamage } from "../../types/combat.js";
import { createEmptyPendingDamage } from "../../types/combat.js";
import type { GameState } from "../../state/GameState.js";
import type { Player, ElementalAttackValues } from "../../types/player.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import {
  getEffectiveEnemyAttack,
  doesEnemyAttackThisCombat,
  getNaturesVengeanceAttackBonus,
} from "../modifiers/index.js";
import { calculateTotalBlock } from "../combat/elementalCalc.js";
import {
  getEnemyAttack,
  getEnemyAttacks,
  isAttackBlocked,
  isAttackCancelled,
  getEffectiveEnemyAttackElement,
} from "../combat/enemyAttackHelpers.js";
import { isSwiftActive } from "../combat/swiftHelpers.js";
import {
  isCumbersomeActive,
  getCumbersomeReduction,
} from "../combat/cumbersomeHelpers.js";
import { getColdToughnessBlockBonus } from "../combat/coldToughnessHelpers.js";
import { canUseBannerFear, getCancellableAttacks } from "../rules/banners.js";
import { getModifiersForPlayer } from "../modifiers/index.js";
import type { InfluenceToBlockConversionModifier } from "../../types/modifiers.js";
import { EFFECT_INFLUENCE_TO_BLOCK_CONVERSION } from "../../types/modifierConstants.js";

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
 * Convert PendingElementalDamage to block sources for efficiency calculations.
 */
function pendingBlockToBlockSources(
  pending: PendingElementalDamage
): { element: Element; value: number }[] {
  const sources: { element: Element; value: number }[] = [];

  if (pending.physical > 0) {
    sources.push({ element: "physical" as Element, value: pending.physical });
  }
  if (pending.fire > 0) {
    sources.push({ element: "fire" as Element, value: pending.fire });
  }
  if (pending.ice > 0) {
    sources.push({ element: "ice" as Element, value: pending.ice });
  }
  if (pending.coldFire > 0) {
    sources.push({ element: "cold_fire" as Element, value: pending.coldFire });
  }

  return sources;
}

/**
 * Append swift-double block sources (duplicates) for block values that count twice.
 */
function appendSwiftDoubleSources(
  sources: { element: Element; value: number }[],
  pendingSwift: PendingElementalDamage
): { element: Element; value: number }[] {
  const extra = pendingBlockToBlockSources(pendingSwift);
  return extra.length > 0 ? [...sources, ...extra] : sources;
}

/**
 * Compute the block state for a single enemy during BLOCK phase.
 */
export function computeEnemyBlockState(
  enemy: CombatEnemy,
  combat: CombatState,
  state: GameState,
  playerId: string
): EnemyBlockState {
  const swiftActive = isSwiftActive(state, playerId, enemy);
  const isBrutal = enemy.definition.abilities.includes(ABILITY_BRUTAL);

  // Use effective attack (after modifiers)
  // Nature's Vengeance competitive penalty: +1 attack during Block phase (S1)
  const naturesVengeanceBonus = getNaturesVengeanceAttackBonus(state, playerId);
  const effectiveAttack = getEffectiveEnemyAttack(
    state,
    enemy.instanceId,
    enemy.definition.attack
  ) + naturesVengeanceBonus;

  // Swift enemies require 2x block
  const requiredBlock = swiftActive ? effectiveAttack * 2 : effectiveAttack;

  // Get pending block for this enemy
  const rawPending = combat.pendingBlock[enemy.instanceId] ?? createEmptyPendingDamage();
  const rawSwiftPending =
    combat.pendingSwiftBlock[enemy.instanceId] ?? createEmptyPendingDamage();
  const pendingBlock: ElementalDamageValues = {
    physical: rawPending.physical,
    fire: rawPending.fire,
    ice: rawPending.ice,
    coldFire: rawPending.coldFire,
  };

  // Calculate effective block value after elemental efficiency
  const baseBlockSources = pendingBlockToBlockSources(rawPending);

  // Add Cold Toughness per-enemy bonus as an ice block source (before efficiency calc)
  const coldToughnessBonus = getColdToughnessBlockBonus(state, playerId, enemy);
  const sourcesWithBonus = coldToughnessBonus > 0
    ? [...baseBlockSources, { element: "ice" as Element, value: coldToughnessBonus }]
    : baseBlockSources;

  const blockSources = swiftActive
    ? appendSwiftDoubleSources(sourcesWithBonus, rawSwiftPending)
    : sourcesWithBonus;

  const effectiveBlock = calculateTotalBlock(blockSources, enemy.definition.attackElement);

  // Can block if effective block >= required
  const canBlock = effectiveBlock >= requiredBlock;

  return {
    enemyInstanceId: enemy.instanceId,
    enemyName: enemy.definition.name,
    enemyAttack: effectiveAttack,
    attackElement: enemy.definition.attackElement,
    requiredBlock,
    isSwift: swiftActive,
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
 * Compute Cumbersome options for enemies with the Cumbersome ability.
 * Returns options showing how many move points can be spent on each enemy.
 */
export function computeCumbersomeOptions(
  state: GameState,
  combat: CombatState,
  playerId: string,
  playerMovePoints: number
): readonly CumbersomeOption[] {
  const options: CumbersomeOption[] = [];

  for (const enemy of combat.enemies) {
    // Skip defeated enemies
    if (enemy.isDefeated) continue;

    // Skip enemies without active Cumbersome ability
    if (!isCumbersomeActive(state, playerId, enemy)) continue;

    // Skip enemies that don't attack this combat
    if (!doesEnemyAttackThisCombat(state, enemy.instanceId)) continue;

    const baseAttack = enemy.definition.attack;
    const currentReduction = getCumbersomeReduction(state, enemy.instanceId);

    // Can't reduce below 0
    const reducedAttack = Math.max(0, baseAttack - currentReduction);

    // Maximum additional reduction is min of player's move points and remaining attack
    const maxAdditionalReduction = Math.min(playerMovePoints, reducedAttack);

    // Only include if there's attack left to reduce and player has move points
    if (maxAdditionalReduction > 0) {
      options.push({
        enemyInstanceId: enemy.instanceId,
        enemyName: enemy.definition.name,
        baseAttack,
        currentReduction,
        reducedAttack,
        maxAdditionalReduction,
      });
    }
  }

  return options;
}

/**
 * Compute Banner of Fear cancel attack options.
 * Returns options for each unit with Banner of Fear that can cancel an enemy attack.
 */
export function computeBannerFearOptions(
  combat: CombatState,
  player: Player
): readonly BannerFearOption[] {
  const options: BannerFearOption[] = [];

  for (const unit of player.units) {
    if (!canUseBannerFear(player, unit.instanceId)) continue;

    const targets = getCancellableAttacks(combat.enemies);
    if (targets.length === 0) continue;

    options.push({
      unitInstanceId: unit.instanceId,
      targets,
    });
  }

  return options;
}

// ============================================================================
// Influence-to-Block Conversion Options
// ============================================================================

/**
 * Compute available influence-to-block conversion option for the block phase.
 * Returns the conversion option if an influence-to-block modifier is active.
 */
function computeInfluenceToBlockOption(
  state: GameState,
  player: Player
): InfluenceToBlockConversionOption | undefined {
  const modifiers = getModifiersForPlayer(state, player.id);

  for (const mod of modifiers) {
    if (mod.effect.type !== EFFECT_INFLUENCE_TO_BLOCK_CONVERSION) continue;
    const effect = mod.effect as InfluenceToBlockConversionModifier;

    const blockElement = effect.element ?? "physical";
    const maxBlock = Math.floor(player.influencePoints / effect.costPerPoint);

    return {
      blockElement: blockElement as "physical" | "fire" | "ice",
      costPerPoint: effect.costPerPoint,
      maxBlockGainable: maxBlock,
    };
  }

  return undefined;
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
      blocks: getBlockOptions(state, combat.enemies, undefined),
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
    .filter((enemy) => {
      const naturesBonus = getNaturesVengeanceAttackBonus(state, player.id);
      return getEffectiveEnemyAttack(state, enemy.instanceId, enemy.definition.attack) + naturesBonus > 0;
    })
    .map((enemy) => computeEnemyBlockState(enemy, combat, state, player.id));

  // Generate assignable blocks
  const assignableBlocks = generateAssignableBlocks(
    enemyBlockStates,
    availableBlock,
    state
  );

  // Generate unassignable blocks
  const unassignableBlocks = generateUnassignableBlocks(enemyBlockStates, combat);

  // Compute Cumbersome options (move points that can be spent to reduce enemy attack)
  const cumbersomeOptions = computeCumbersomeOptions(
    state,
    combat,
    player.id,
    player.movePoints
  );

  // Compute Banner of Fear cancel attack options
  const bannerFearOpts = computeBannerFearOptions(combat, player);

  // Build the combat options
  const options: CombatOptions = {
    phase: COMBAT_PHASE_BLOCK,
    canEndPhase: true, // Can skip blocking (take damage instead)
    blocks: getBlockOptions(state, combat.enemies, player.id),
    availableBlock,
    enemyBlockStates,
    assignableBlocks,
    unassignableBlocks,
  };

  // Compute influence-to-block conversion options (Diplomacy card)
  const influenceConversion = computeInfluenceToBlockOption(state, player);

  // Only include optional fields if there are options
  let result: CombatOptions = options;

  if (cumbersomeOptions.length > 0) {
    result = { ...result, cumbersomeOptions, availableMovePoints: player.movePoints };
  }

  if (bannerFearOpts.length > 0) {
    result = { ...result, bannerFearOptions: bannerFearOpts };
  }

  if (influenceConversion && influenceConversion.maxBlockGainable > 0) {
    result = {
      ...result,
      influenceToBlockConversion: influenceConversion,
      availableInfluenceForConversion: player.influencePoints,
    };
  }

  return result;
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
  enemies: readonly CombatEnemy[],
  playerId?: string
): readonly BlockOption[] {
  const options: BlockOption[] = [];

  // Nature's Vengeance competitive penalty: +1 attack during Block phase (S1)
  const naturesVengeanceBonus = playerId
    ? getNaturesVengeanceAttackBonus(state, playerId)
    : 0;

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
      // Skip cancelled attacks (Banner of Fear)
      if (isAttackCancelled(enemy, attackIndex)) continue;

      const attack = getEnemyAttack(enemy, attackIndex);

      // Use effective attack (after modifiers) + Nature's Vengeance penalty
      const effectiveAttack = getEffectiveEnemyAttack(
        state,
        enemy.instanceId,
        attack.damage
      ) + naturesVengeanceBonus;

      // Filter out attacks with 0 effective attack (nothing to block)
      if (effectiveAttack <= 0) continue;

      // Swift enemies require 2x block
      const requiredBlock = isSwift ? effectiveAttack * 2 : effectiveAttack;

      // Build the base option (use effective element after conversion modifiers)
      const effectiveElement = getEffectiveEnemyAttackElement(state, enemy, attack.element);
      const baseOption = {
        enemyInstanceId: enemy.instanceId,
        enemyName: enemy.definition.name,
        enemyAttack: effectiveAttack,
        attackElement: effectiveElement,
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
