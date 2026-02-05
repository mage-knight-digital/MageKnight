/**
 * Declare attack command
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { CombatType, GameEvent, AttackSource } from "@mage-knight/shared";
import {
  ENEMY_DEFEATED,
  ATTACK_FAILED,
  getLevelsCrossed,
  createReputationChangedEvent,
  REPUTATION_REASON_DEFEAT_ENEMY,
  MIN_REPUTATION,
  MAX_REPUTATION,
} from "@mage-knight/shared";
import {
  getFinalAttackValue,
  combineResistances,
  type Resistances,
} from "../../combat/elementalCalc.js";
import { getEffectiveEnemyArmor, areResistancesRemoved, getBaseArmorForPhase } from "../../modifiers/index.js";
import { autoAssignDefend } from "../../combat/defendHelpers.js";

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
      let combat = state.combat;
      if (!combat) {
        throw new Error("Not in combat");
      }

      const combatPhase = combat.phase;

      // Get target enemies
      const targets = combat.enemies.filter(
        (e) =>
          params.targetEnemyInstanceIds.includes(e.instanceId) && !e.isDefeated
      );

      // Apply Defend abilities: when attacking enemies, available Defend enemies
      // automatically defend the targets, adding their Defend value to target's armor
      const defendAssignments = autoAssignDefend(
        state,
        params.playerId,
        params.targetEnemyInstanceIds
      );

      // Update combat state with Defend assignments if any
      if (defendAssignments.length > 0) {
        let updatedUsedDefend = { ...combat.usedDefend };
        let updatedDefendBonuses = { ...combat.defendBonuses };

        for (const assignment of defendAssignments) {
          updatedUsedDefend = {
            ...updatedUsedDefend,
            [assignment.defenderId]: assignment.targetId,
          };
          updatedDefendBonuses = {
            ...updatedDefendBonuses,
            [assignment.targetId]: assignment.value,
          };
        }

        // Update state with new Defend tracking
        combat = {
          ...combat,
          usedDefend: updatedUsedDefend,
          defendBonuses: updatedDefendBonuses,
        };
        state = {
          ...state,
          combat,
        };
      }

      // Calculate total effective armor of targets (including modifiers like Tremor)
      // Uses phase-aware base armor for Elusive enemies
      // Note: getEffectiveEnemyArmor now includes Defend bonuses automatically
      const totalArmor = targets.reduce((sum, e) => {
        // Count resistances for Resistance Break modifier
        const resistances = e.definition.resistances;
        const resistanceCount = resistances ? resistances.length : 0;

        // Get base armor considering Elusive ability and combat phase
        const baseArmor = getBaseArmorForPhase(
          e,
          combatPhase,
          state,
          params.playerId
        );

        return sum + getEffectiveEnemyArmor(
          state,
          e.instanceId,
          baseArmor,
          resistanceCount,
          params.playerId
        );
      }, 0);

      // Get combined resistances of all targets (accounting for resistance removal modifiers)
      const targetResistances = combineResistances(
        targets.map((e) => ({
          // Check if resistances have been removed by a modifier (Expose spell)
          resistances: areResistancesRemoved(state, e.instanceId)
            ? []
            : (e.definition.resistances as Resistances),
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
      let reputationPenalty = 0;
      let reputationBonus = 0;

      const updatedEnemies = combat.enemies.map((e) => {
        if (
          params.targetEnemyInstanceIds.includes(e.instanceId) &&
          !e.isDefeated
        ) {
          fameGained += e.definition.fame;
          // Track reputation changes from defeated enemies
          if (e.definition.reputationPenalty) {
            reputationPenalty += e.definition.reputationPenalty;
          }
          if (e.definition.reputationBonus) {
            reputationBonus += e.definition.reputationBonus;
          }
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

      // Calculate new reputation (clamped to MIN_REPUTATION and MAX_REPUTATION)
      const oldReputation = player.reputation;
      const netReputationChange = reputationBonus - reputationPenalty;
      const newReputation =
        netReputationChange !== 0
          ? Math.max(
              MIN_REPUTATION,
              Math.min(MAX_REPUTATION, oldReputation + netReputationChange)
            )
          : oldReputation;

      // Emit reputation change event if reputation actually changed
      if (netReputationChange !== 0 && newReputation !== oldReputation) {
        events.push(
          createReputationChangedEvent(
            params.playerId,
            newReputation - oldReputation, // actual delta (may differ from net due to clamping)
            newReputation,
            REPUTATION_REASON_DEFEAT_ENEMY
          )
        );
      }

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              fame: newFame,
              reputation: newReputation,
              pendingLevelUps: [...p.pendingLevelUps, ...levelsCrossed],
            }
          : p
      );

      const updatedCombat = {
        ...combat,
        enemies: updatedEnemies,
        fameGained: combat.fameGained + fameGained,
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
