/**
 * Declare block command
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { BlockSource, EnemyAbilityType } from "@mage-knight/shared";
import { ENEMY_BLOCKED, BLOCK_FAILED, ABILITY_SWIFT } from "@mage-knight/shared";
import type { CombatEnemy } from "../../../types/combat.js";
import { getFinalBlockValue } from "../../combat/elementalCalc.js";
import { isAbilityNullified } from "../../modifiers.js";

export const DECLARE_BLOCK_COMMAND = "DECLARE_BLOCK" as const;

export interface DeclareBlockCommandParams {
  readonly playerId: string;
  readonly targetEnemyInstanceId: string;
  readonly blocks: readonly BlockSource[];
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
  let attackValue = enemy.definition.attack;

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

      const enemy = state.combat.enemies.find(
        (e) => e.instanceId === params.targetEnemyInstanceId
      );
      if (!enemy) {
        throw new Error(`Enemy not found: ${params.targetEnemyInstanceId}`);
      }

      // Calculate final block value including elemental efficiency and combat modifiers
      const effectiveBlockValue = getFinalBlockValue(
        params.blocks,
        enemy.definition.attackElement,
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

      if (!isSuccessful) {
        // Block failed — no effect, but still consumed
        return {
          state,
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
      };

      return {
        state: { ...state, combat: updatedCombat },
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
