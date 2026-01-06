/**
 * Declare block command
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { EnemyAbilityType } from "@mage-knight/shared";
import { ENEMY_BLOCKED, BLOCK_FAILED, ABILITY_SWIFT } from "@mage-knight/shared";
import type { CombatEnemy } from "../../../types/combat.js";
import { getFinalBlockValue } from "../../combat/elementalCalc.js";
import { isAbilityNullified } from "../../modifiers.js";
import { createEmptyCombatAccumulator } from "../../../types/player.js";

export const DECLARE_BLOCK_COMMAND = "DECLARE_BLOCK" as const;

export interface DeclareBlockCommandParams {
  readonly playerId: string;
  readonly targetEnemyInstanceId: string;
  // blocks field removed - server now reads from player.combatAccumulator.blockSources
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

      // Find the player to get their block sources
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

      // Read block sources from server-side accumulator (not from client params)
      const blockSources = player.combatAccumulator.blockSources;

      // Calculate final block value including elemental efficiency and combat modifiers
      const effectiveBlockValue = getFinalBlockValue(
        blockSources,
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

      // Clear block accumulator (block is "spent" whether successful or not)
      // Keep attack accumulator intact as it's used in the attack phase
      const emptyAccumulator = createEmptyCombatAccumulator();
      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              combatAccumulator: {
                ...p.combatAccumulator,
                block: 0,
                blockElements: emptyAccumulator.blockElements,
                blockSources: [],
              },
            }
          : p
      );

      if (!isSuccessful) {
        // Block failed — no effect, but still consumed
        return {
          state: { ...state, players: updatedPlayers },
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
