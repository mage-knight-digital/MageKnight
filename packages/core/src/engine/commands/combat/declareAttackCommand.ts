/**
 * Declare attack command
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { CombatType, GameEvent, AttackSource } from "@mage-knight/shared";
import {
  ENEMY_DEFEATED,
  ATTACK_FAILED,
  getLevelsCrossed,
} from "@mage-knight/shared";
import {
  getFinalAttackValue,
  combineResistances,
  type Resistances,
} from "../../combat/elementalCalc.js";
import { getEffectiveEnemyArmor } from "../../modifiers.js";

export const DECLARE_ATTACK_COMMAND = "DECLARE_ATTACK" as const;

export interface DeclareAttackCommandParams {
  readonly playerId: string;
  readonly targetEnemyInstanceIds: readonly string[];
  readonly attacks: readonly AttackSource[];
  readonly attackType: CombatType;
}

export function createDeclareAttackCommand(
  params: DeclareAttackCommandParams
): Command {
  return {
    type: DECLARE_ATTACK_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      // Get target enemies
      const targets = state.combat.enemies.filter(
        (e) =>
          params.targetEnemyInstanceIds.includes(e.instanceId) && !e.isDefeated
      );

      // Calculate total effective armor of targets (including modifiers like Tremor)
      const totalArmor = targets.reduce((sum, e) => {
        // Count resistances for Resistance Break modifier
        const resistances = e.definition.resistances;
        const resistanceCount = resistances ? resistances.length : 0;

        return sum + getEffectiveEnemyArmor(
          state,
          e.instanceId,
          e.definition.armor,
          resistanceCount
        );
      }, 0);

      // Get combined resistances of all targets
      const targetResistances = combineResistances(
        targets.map((e) => ({
          resistances: e.definition.resistances as Resistances,
        }))
      );

      // Calculate final attack value including resistances and combat modifiers
      const effectiveAttackValue = getFinalAttackValue(
        params.attacks,
        targetResistances,
        state,
        params.playerId,
        params.attackType
      );

      // Check if attack defeats all targets
      if (effectiveAttackValue < totalArmor) {
        // Attack failed — not enough damage
        return {
          state,
          events: [
            {
              type: ATTACK_FAILED,
              targetEnemyInstanceIds: params.targetEnemyInstanceIds,
              attackValue: effectiveAttackValue,
              requiredAttack: totalArmor,
            },
          ],
        };
      }

      // Attack succeeded — defeat all targets
      const events: GameEvent[] = [];
      let fameGained = 0;

      const updatedEnemies = state.combat.enemies.map((e) => {
        if (
          params.targetEnemyInstanceIds.includes(e.instanceId) &&
          !e.isDefeated
        ) {
          fameGained += e.definition.fame;
          events.push({
            type: ENEMY_DEFEATED,
            enemyInstanceId: e.instanceId,
            enemyName: e.definition.name,
            fameGained: e.definition.fame,
          });
          return { ...e, isDefeated: true };
        }
        return e;
      });

      // Update player fame
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Check for level ups when fame changes
      const oldFame = player.fame;
      const newFame = player.fame + fameGained;
      const levelsCrossed = getLevelsCrossed(oldFame, newFame);

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              fame: newFame,
              pendingLevelUps: [...p.pendingLevelUps, ...levelsCrossed],
            }
          : p
      );

      const updatedCombat = {
        ...state.combat,
        enemies: updatedEnemies,
        fameGained: state.combat.fameGained + fameGained,
      };

      return {
        state: { ...state, combat: updatedCombat, players: updatedPlayers },
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo DECLARE_ATTACK");
    },
  };
}
