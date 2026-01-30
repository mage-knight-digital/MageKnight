/**
 * Declare block command
 *
 * Updated for incremental block allocation:
 * - Reads from state.combat.pendingBlock[enemyInstanceId] instead of accumulator
 * - Players assign block incrementally before committing via DECLARE_BLOCK
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { EnemyAbilityType, BlockSource, Element } from "@mage-knight/shared";
import {
  ENEMY_BLOCKED,
  BLOCK_FAILED,
  ABILITY_SWIFT,
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import type { CombatEnemy, PendingElementalDamage } from "../../../types/combat.js";
import { createEmptyPendingDamage, getCombatEnemyBaseAttack, getCombatEnemyAttackElement } from "../../../types/combat.js";
import { getFinalBlockValue } from "../../combat/elementalCalc.js";
import { isAbilityNullified } from "../../modifiers.js";

export const DECLARE_BLOCK_COMMAND = "DECLARE_BLOCK" as const;

export interface DeclareBlockCommandParams {
  readonly playerId: string;
  readonly targetEnemyInstanceId: string;
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
 * Check if an enemy has a specific ability
 */
function hasAbility(enemy: CombatEnemy, abilityType: EnemyAbilityType): boolean {
  return enemy.definition.abilities.includes(abilityType);
}

/**
 * Check if enemy's Swift ability is active (not nullified)
 * Swift: doubles the attack value for blocking purposes
 */
function isSwiftActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  if (!hasAbility(enemy, ABILITY_SWIFT)) return false;
  return !isAbilityNullified(state, playerId, enemy.instanceId, ABILITY_SWIFT);
}

/**
 * Get effective enemy attack value for blocking purposes
 * Swift: doubles the attack value (player must assign double block)
 *
 * Note: Swift does NOT affect attack timing or phases - only block requirements
 */
function getEffectiveEnemyAttackForBlocking(
  enemy: CombatEnemy,
  state: GameState,
  playerId: string
): number {
  // Use level-based attack for faction leaders
  let attackValue = getCombatEnemyBaseAttack(enemy);

  // Swift: doubles attack value for blocking purposes
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

      // Read from pendingBlock (incremental allocation system)
      const pendingBlock =
        state.combat.pendingBlock[params.targetEnemyInstanceId] ??
        createEmptyPendingDamage();

      // Convert pendingBlock to BlockSource[] format for calculation
      const blockSources = pendingBlockToBlockSources(pendingBlock);

      // Calculate final block value including elemental efficiency and combat modifiers
      // Use level-based attack element for faction leaders
      const effectiveBlockValue = getFinalBlockValue(
        blockSources,
        getCombatEnemyAttackElement(enemy),
        state,
        params.playerId
      );

      // Get effective attack for blocking (Swift doubles the requirement)
      const requiredBlock = getEffectiveEnemyAttackForBlocking(
        enemy,
        state,
        params.playerId
      );

      // Check if block is sufficient (Block >= Attack, or 2x Attack for Swift)
      const isSuccessful = effectiveBlockValue >= requiredBlock;

      // Clear the pendingBlock for this enemy (new system)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [params.targetEnemyInstanceId]: _removed, ...remainingPendingBlock } =
        state.combat.pendingBlock;

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
        };

        return {
          state: { ...state, players: updatedPlayers, combat: updatedCombat },
          events: [
            {
              type: BLOCK_FAILED,
              enemyInstanceId: params.targetEnemyInstanceId,
              blockValue: effectiveBlockValue,
              requiredBlock,
            },
          ],
        };
      }

      // Block succeeded — mark enemy as blocked
      const updatedEnemies = state.combat.enemies.map((e) =>
        e.instanceId === params.targetEnemyInstanceId
          ? { ...e, isBlocked: true }
          : e
      );

      const updatedCombat = {
        ...state.combat,
        enemies: updatedEnemies,
        pendingBlock: remainingPendingBlock,
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [
          {
            type: ENEMY_BLOCKED,
            enemyInstanceId: params.targetEnemyInstanceId,
            blockValue: effectiveBlockValue,
          },
        ],
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo DECLARE_BLOCK");
    },
  };
}
