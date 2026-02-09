/**
 * Declare block command
 *
 * Updated for incremental block allocation:
 * - Reads from state.combat.pendingBlock[enemyInstanceId] instead of accumulator
 * - Players assign block incrementally before committing via DECLARE_BLOCK
 *
 * Multi-attack support:
 * - For multi-attack enemies, attackIndex specifies which attack to block
 * - Each attack must be blocked separately with sufficient block value
 * - Enemy is only considered "fully blocked" when all attacks are blocked
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { BlockSource, Element, GameEvent } from "@mage-knight/shared";
import {
  ENEMY_BLOCKED,
  BLOCK_FAILED,
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import type { CombatEnemy, PendingElementalDamage } from "../../../types/combat.js";
import { createEmptyPendingDamage } from "../../../types/combat.js";
import { getFinalBlockValue } from "../../combat/elementalCalc.js";
import {
  getEnemyAttack,
  getEnemyAttacks,
  getEnemyAttackCount,
  isAttackBlocked,
  getEffectiveEnemyAttackElement,
} from "../../combat/enemyAttackHelpers.js";
import { getCumbersomeReducedAttack } from "../../combat/cumbersomeHelpers.js";
import { isSwiftActive } from "../../combat/swiftHelpers.js";
import { getNaturesVengeanceAttackBonus } from "../../modifiers/combat.js";
import { getColdToughnessBlockBonus } from "../../combat/coldToughnessHelpers.js";
import { applyBurningShieldOnBlock } from "../../combat/burningShieldHelpers.js";
import { applyShieldBashArmorReduction } from "../../combat/shieldBashHelpers.js";

export const DECLARE_BLOCK_COMMAND = "DECLARE_BLOCK" as const;

export interface DeclareBlockCommandParams {
  readonly playerId: string;
  readonly targetEnemyInstanceId: string;
  /**
   * For multi-attack enemies, specifies which attack to block (0-indexed).
   * Defaults to 0 for single-attack enemies or when not specified.
   */
  readonly attackIndex?: number;
}

/**
 * Convert PendingElementalDamage to BlockSource[] format for block calculation.
 * Only includes elements with non-zero values.
 */
function pendingBlockToBlockSources(pending: PendingElementalDamage): BlockSource[] {
  const sources: BlockSource[] = [];

  if (pending.physical > 0) {
    sources.push({ element: ELEMENT_PHYSICAL as Element, value: pending.physical });
  }
  if (pending.fire > 0) {
    sources.push({ element: ELEMENT_FIRE as Element, value: pending.fire });
  }
  if (pending.ice > 0) {
    sources.push({ element: ELEMENT_ICE as Element, value: pending.ice });
  }
  if (pending.coldFire > 0) {
    sources.push({ element: ELEMENT_COLD_FIRE as Element, value: pending.coldFire });
  }

  return sources;
}

/**
 * Append swift-double block sources (duplicates) for block values that count twice.
 */
function appendSwiftDoubleSources(
  sources: BlockSource[],
  pendingSwift: PendingElementalDamage
): BlockSource[] {
  const extra = pendingBlockToBlockSources(pendingSwift);
  return extra.length > 0 ? [...sources, ...extra] : sources;
}

/**
 * Get effective enemy attack value for blocking purposes
 *
 * Order of operations (CRITICAL):
 * 1. Apply Cumbersome reduction (move points spent)
 * 2. Apply Swift doubling (if active)
 *
 * Note: Swift does NOT affect attack timing or phases - only block requirements
 *
 * @param enemy - Combat enemy instance
 * @param attackIndex - Which attack to get the value for (0-indexed)
 * @param state - Game state
 * @param playerId - Player attempting to block
 */
function getEffectiveEnemyAttackForBlocking(
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

  let attackValue = attack.damage;

  // Nature's Vengeance competitive penalty: +1 attack per attack during Block phase (S1)
  // Applied BEFORE Cumbersome/Swift (per S1: penalty is to the attack strength)
  attackValue += getNaturesVengeanceAttackBonus(state, playerId);

  // FIRST: Apply Cumbersome reduction (BEFORE Swift)
  attackValue = getCumbersomeReducedAttack(state, playerId, enemy, attackValue);

  // SECOND: Swift doubles attack value for blocking purposes
  if (isSwiftActive(state, playerId, enemy)) {
    attackValue *= 2;
  }

  return attackValue;
}

export function createDeclareBlockCommand(
  params: DeclareBlockCommandParams
): Command {
  return {
    type: DECLARE_BLOCK_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Can't un-block once committed

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      // Find the player to update their assigned block tracking
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }
      const playerIndex = state.players.indexOf(player);

      const enemy = state.combat.enemies.find(
        (e) => e.instanceId === params.targetEnemyInstanceId
      );
      if (!enemy) {
        throw new Error(`Enemy not found: ${params.targetEnemyInstanceId}`);
      }

      // Get the attack index (default to 0 for single-attack enemies)
      const attackIndex = params.attackIndex ?? 0;
      const attackCount = getEnemyAttackCount(enemy);

      // Validate attack index
      if (attackIndex < 0 || attackIndex >= attackCount) {
        throw new Error(
          `Attack index ${attackIndex} out of range (enemy has ${attackCount} attacks)`
        );
      }

      // Check if this specific attack is already blocked
      if (isAttackBlocked(enemy, attackIndex)) {
        throw new Error(`Attack ${attackIndex} is already blocked`);
      }

      // Get the attack being blocked
      const attackBeingBlocked = getEnemyAttack(enemy, attackIndex);

      // Read from pendingBlock (incremental allocation system)
      const pendingBlock =
        state.combat.pendingBlock[params.targetEnemyInstanceId] ??
        createEmptyPendingDamage();

      const pendingSwiftBlock =
        state.combat.pendingSwiftBlock[params.targetEnemyInstanceId] ??
        createEmptyPendingDamage();

      // Convert pendingBlock to BlockSource[] format for calculation
      const baseBlockSources = pendingBlockToBlockSources(pendingBlock);

      // Add Cold Toughness per-enemy bonus as an ice block source (before efficiency calc)
      const coldToughnessBonus = getColdToughnessBlockBonus(state, params.playerId, enemy);
      const sourcesWithBonus = coldToughnessBonus > 0
        ? [...baseBlockSources, { element: ELEMENT_ICE as Element, value: coldToughnessBonus }]
        : baseBlockSources;

      const swiftActive = isSwiftActive(state, params.playerId, enemy);
      const blockSources = swiftActive
        ? appendSwiftDoubleSources(sourcesWithBonus, pendingSwiftBlock)
        : sourcesWithBonus;

      // Calculate final block value including elemental efficiency and combat modifiers
      // Use the attack's effective element (may be converted by Know Your Prey)
      const effectiveAttackElement = getEffectiveEnemyAttackElement(
        state, enemy, attackBeingBlocked.element
      );
      const effectiveBlockValue = getFinalBlockValue(
        blockSources,
        effectiveAttackElement,
        state,
        params.playerId
      );

      // Get effective attack for blocking (Swift doubles the requirement)
      const requiredBlock = getEffectiveEnemyAttackForBlocking(
        enemy,
        attackIndex,
        state,
        params.playerId
      );

      // Check if block is sufficient (Block >= Attack, or 2x Attack for Swift)
      const isSuccessful = effectiveBlockValue >= requiredBlock;

      // Clear the pendingBlock for this enemy (new system)
      const { [params.targetEnemyInstanceId]: _removed, ...remainingPendingBlock } =
        state.combat.pendingBlock;
      void _removed;
      // Clear pendingSwiftBlock for this enemy
      const {
        [params.targetEnemyInstanceId]: _removedSwift,
        ...remainingPendingSwiftBlock
      } = state.combat.pendingSwiftBlock;
      void _removedSwift;

      // Update player's accumulator - reduce assigned block tracking
      const emptyBlockElements = { physical: 0, fire: 0, ice: 0, coldFire: 0 };
      const updatedPlayers = state.players.map((p, i) => {
        if (i !== playerIndex) return p;

        const currentAssignedBlockElements =
          p.combatAccumulator.assignedBlockElements ?? emptyBlockElements;
        return {
          ...p,
          combatAccumulator: {
            ...p.combatAccumulator,
            assignedBlock:
              (p.combatAccumulator.assignedBlock ?? 0) -
              pendingBlock.physical -
              pendingBlock.fire -
              pendingBlock.ice -
              pendingBlock.coldFire,
            assignedBlockElements: {
              physical:
                currentAssignedBlockElements.physical - pendingBlock.physical,
              fire: currentAssignedBlockElements.fire - pendingBlock.fire,
              ice: currentAssignedBlockElements.ice - pendingBlock.ice,
              coldFire:
                currentAssignedBlockElements.coldFire - pendingBlock.coldFire,
            },
          },
        };
      });

      if (!isSuccessful) {
        // Block failed — no effect, but still consumed
        const updatedCombat = {
          ...state.combat,
          pendingBlock: remainingPendingBlock,
          pendingSwiftBlock: remainingPendingSwiftBlock,
        };

        return {
          state: { ...state, players: updatedPlayers, combat: updatedCombat },
          events: [
            {
              type: BLOCK_FAILED,
              enemyInstanceId: params.targetEnemyInstanceId,
              attackIndex,
              blockValue: effectiveBlockValue,
              requiredBlock,
            },
          ],
        };
      }

      // Block succeeded — update per-attack blocked state
      const updatedEnemies = state.combat.enemies.map((e) => {
        if (e.instanceId !== params.targetEnemyInstanceId) return e;

        // For multi-attack enemies, update the attacksBlocked array
        if (attackCount > 1) {
          // Initialize attacksBlocked if not present
          const currentAttacksBlocked = e.attacksBlocked ?? new Array(attackCount).fill(false);
          const newAttacksBlocked = [...currentAttacksBlocked];
          newAttacksBlocked[attackIndex] = true;

          // Check if ALL attacks are now blocked
          const allBlocked = newAttacksBlocked.every((blocked) => blocked);

          return {
            ...e,
            attacksBlocked: newAttacksBlocked,
            isBlocked: allBlocked, // Legacy flag: true only when ALL attacks blocked
          };
        }

        // For single-attack enemies, just set isBlocked
        return { ...e, isBlocked: true };
      });

      const updatedCombat = {
        ...state.combat,
        enemies: updatedEnemies,
        pendingBlock: remainingPendingBlock,
        pendingSwiftBlock: remainingPendingSwiftBlock,
      };

      let resultState: GameState = { ...state, players: updatedPlayers, combat: updatedCombat };
      const resultEvents: GameEvent[] = [
        {
          type: ENEMY_BLOCKED,
          enemyInstanceId: params.targetEnemyInstanceId,
          attackIndex,
          blockValue: effectiveBlockValue,
        },
      ];

      // Check for Burning Shield / Exploding Shield on successful block
      // Find the enemy in the updated state (may have updated isBlocked)
      const updatedEnemy = updatedEnemies.find(
        (e) => e.instanceId === params.targetEnemyInstanceId
      );
      if (updatedEnemy) {
        const shieldResult = applyBurningShieldOnBlock(
          resultState,
          params.playerId,
          updatedEnemy
        );
        if (shieldResult) {
          resultState = shieldResult.state;
          resultEvents.push(...shieldResult.events);
        }
      }

      // Check for Shield Bash armor reduction on successful block
      // Uses the original pendingBlock (before clearing)
      // to calculate excess undoubled block for armor reduction
      if (updatedEnemy) {
        const shieldBashResult = applyShieldBashArmorReduction(
          resultState,
          params.playerId,
          updatedEnemy,
          attackIndex,
          pendingBlock
        );
        if (shieldBashResult) {
          resultState = shieldBashResult.state;
          resultEvents.push(...shieldBashResult.events);
        }
      }

      return {
        state: resultState,
        events: resultEvents,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo DECLARE_BLOCK");
    },
  };
}
