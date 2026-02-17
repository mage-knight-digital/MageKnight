/**
 * Finalize block command
 *
 * Part of the target-first block flow. Resolves block against the
 * declared target using accumulated block from pendingBlock.
 * Irreversible (block resolution cannot be undone).
 *
 * Reads target from combat.declaredBlockTarget instead of action payload.
 * Otherwise identical logic to declareBlockCommand.ts.
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
  findFirstUnblockedAttack,
} from "../../combat/enemyAttackHelpers.js";
import { getCumbersomeReducedAttack } from "../../combat/cumbersomeHelpers.js";
import { isSwiftActive } from "../../combat/swiftHelpers.js";
import { getNaturesVengeanceAttackBonus } from "../../modifiers/combat.js";
import { getColdToughnessBlockBonus } from "../../combat/coldToughnessHelpers.js";
import { applyBurningShieldOnBlock } from "../../combat/burningShieldHelpers.js";
import { applyShieldBashArmorReduction } from "../../combat/shieldBashHelpers.js";

export const FINALIZE_BLOCK_COMMAND = "FINALIZE_BLOCK" as const;

export interface FinalizeBlockCommandParams {
  readonly playerId: string;
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
 * Get effective enemy attack value for blocking purposes.
 * Mirrors the logic from declareBlockCommand.ts.
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

  attackValue += getNaturesVengeanceAttackBonus(state, playerId);
  attackValue = getCumbersomeReducedAttack(state, playerId, enemy, attackValue);

  if (isSwiftActive(state, playerId, enemy)) {
    attackValue *= 2;
  }

  return attackValue;
}

export function createFinalizeBlockCommand(
  params: FinalizeBlockCommandParams
): Command {
  return {
    type: FINALIZE_BLOCK_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      const targetEnemyInstanceId = state.combat.declaredBlockTarget;
      if (!targetEnemyInstanceId) {
        throw new Error("No block target declared");
      }

      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }
      const playerIndex = state.players.indexOf(player);

      const enemy = state.combat.enemies.find(
        (e) => e.instanceId === targetEnemyInstanceId
      );
      if (!enemy) {
        throw new Error(`Enemy not found: ${targetEnemyInstanceId}`);
      }

      // Get attack index from declared state, or auto-resolve
      const attackIndex = state.combat.declaredBlockAttackIndex ?? findFirstUnblockedAttack(enemy);
      const attackCount = getEnemyAttackCount(enemy);

      if (attackIndex < 0 || attackIndex >= attackCount) {
        throw new Error(
          `Attack index ${attackIndex} out of range (enemy has ${attackCount} attacks)`
        );
      }

      if (isAttackBlocked(enemy, attackIndex)) {
        throw new Error(`Attack ${attackIndex} is already blocked`);
      }

      const attackBeingBlocked = getEnemyAttack(enemy, attackIndex);

      // Read from pendingBlock
      const pendingBlock =
        state.combat.pendingBlock[targetEnemyInstanceId] ??
        createEmptyPendingDamage();

      const pendingSwiftBlock =
        state.combat.pendingSwiftBlock[targetEnemyInstanceId] ??
        createEmptyPendingDamage();

      const baseBlockSources = pendingBlockToBlockSources(pendingBlock);

      // Add Cold Toughness per-enemy bonus
      const coldToughnessBonus = getColdToughnessBlockBonus(state, params.playerId, enemy);
      const sourcesWithBonus = coldToughnessBonus > 0
        ? [...baseBlockSources, { element: ELEMENT_ICE as Element, value: coldToughnessBonus }]
        : baseBlockSources;

      const swiftActive = isSwiftActive(state, params.playerId, enemy);
      const blockSources = swiftActive
        ? appendSwiftDoubleSources(sourcesWithBonus, pendingSwiftBlock)
        : sourcesWithBonus;

      const effectiveAttackElement = getEffectiveEnemyAttackElement(
        state, enemy, attackBeingBlocked.element
      );
      const effectiveBlockValue = getFinalBlockValue(
        blockSources,
        effectiveAttackElement,
        state,
        params.playerId
      );

      const requiredBlock = getEffectiveEnemyAttackForBlocking(
        enemy,
        attackIndex,
        state,
        params.playerId
      );

      const isSuccessful = effectiveBlockValue >= requiredBlock;

      // Clear pendingBlock for this enemy
      const { [targetEnemyInstanceId]: _removed, ...remainingPendingBlock } =
        state.combat.pendingBlock;
      void _removed;
      const {
        [targetEnemyInstanceId]: _removedSwift,
        ...remainingPendingSwiftBlock
      } = state.combat.pendingSwiftBlock;
      void _removedSwift;

      // Update player's accumulator
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

      // Clear declaredBlockTarget and declaredBlockAttackIndex
      if (!isSuccessful) {
        const updatedCombat = {
          ...state.combat,
          pendingBlock: remainingPendingBlock,
          pendingSwiftBlock: remainingPendingSwiftBlock,
          declaredBlockTarget: undefined,
          declaredBlockAttackIndex: undefined,
        };

        return {
          state: { ...state, players: updatedPlayers, combat: updatedCombat },
          events: [
            {
              type: BLOCK_FAILED,
              enemyInstanceId: targetEnemyInstanceId,
              attackIndex,
              blockValue: effectiveBlockValue,
              requiredBlock,
            },
          ],
        };
      }

      // Block succeeded — update per-attack blocked state
      const updatedEnemies = state.combat.enemies.map((e) => {
        if (e.instanceId !== targetEnemyInstanceId) return e;

        if (attackCount > 1) {
          const currentAttacksBlocked = e.attacksBlocked ?? new Array(attackCount).fill(false);
          const newAttacksBlocked = [...currentAttacksBlocked];
          newAttacksBlocked[attackIndex] = true;

          const allBlocked = newAttacksBlocked.every((blocked) => blocked);

          return {
            ...e,
            attacksBlocked: newAttacksBlocked,
            isBlocked: allBlocked,
          };
        }

        return { ...e, isBlocked: true };
      });

      const updatedCombat = {
        ...state.combat,
        enemies: updatedEnemies,
        pendingBlock: remainingPendingBlock,
        pendingSwiftBlock: remainingPendingSwiftBlock,
        declaredBlockTarget: undefined,
        declaredBlockAttackIndex: undefined,
      };

      let resultState: GameState = { ...state, players: updatedPlayers, combat: updatedCombat };
      const resultEvents: GameEvent[] = [
        {
          type: ENEMY_BLOCKED,
          enemyInstanceId: targetEnemyInstanceId,
          attackIndex,
          blockValue: effectiveBlockValue,
        },
      ];

      // Check for Burning Shield / Exploding Shield on successful block
      const updatedEnemy = updatedEnemies.find(
        (e) => e.instanceId === targetEnemyInstanceId
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
      throw new Error("Cannot undo FINALIZE_BLOCK");
    },
  };
}
