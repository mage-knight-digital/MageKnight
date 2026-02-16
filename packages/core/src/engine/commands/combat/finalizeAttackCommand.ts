/**
 * Finalize attack command
 *
 * Part of the target-first attack flow. Resolves accumulated attack
 * against declared targets using combined armor/resistances (all-or-nothing).
 * Irreversible (sets undo checkpoint) because enemy defeat cannot be undone.
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { GameEvent, AttackSource } from "@mage-knight/shared";
import {
  ATTACK_FAILED,
  ENEMY_DEFEATED,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  COMBAT_TYPE_MELEE,
} from "@mage-knight/shared";
import type { CombatType } from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
} from "../../../types/combat.js";
import {
  createEmptyElementalValues,
  createEmptyAccumulatedAttack,
} from "../../../types/player.js";
import type { Player, AccumulatedAttack } from "../../../types/player.js";
import {
  getFinalAttackValue,
  combineResistances,
  type Resistances,
} from "../../combat/elementalCalc.js";
import { getEffectiveEnemyArmor, getBaseArmorForPhase } from "../../modifiers/index.js";
import { getEnemyResistances } from "../../validActions/combatHelpers.js";
import { autoAssignDefend } from "../../combat/defendHelpers.js";
import { resolveAttackDefeatFameTrackers } from "../../combat/attackFameTracking.js";
import type { AttackDefeatFameTracker } from "../../../types/player.js";
import { resolveScoutFameBonus } from "../../combat/scoutFameTracking.js";
import { resolveBowPhaseFameBonus } from "../../combat/bowPhaseFameTracking.js";
import { resolveSoulHarvesterCrystals } from "../../combat/soulHarvesterTracking.js";
import { applyArmorReductions } from "../../combat/armorReductionHelpers.js";
import {
  applyFameToPlayer,
  applyReputationChange,
} from "./damageResolution.js";

export const FINALIZE_ATTACK_COMMAND = "FINALIZE_ATTACK" as const;

export interface FinalizeAttackCommandParams {
  readonly playerId: string;
}

/**
 * Build AttackSource[] from the player's accumulated attack for the current phase.
 * In RS phase: uses ranged + siege elements.
 * In ATTACK phase: uses normal (melee) elements.
 */
function buildAttackSources(
  attack: AccumulatedAttack,
  isRangedSiegePhase: boolean
): AttackSource[] {
  const sources: AttackSource[] = [];

  if (isRangedSiegePhase) {
    // Ranged physical
    const rangedPhysical = attack.ranged - (attack.rangedElements.fire + attack.rangedElements.ice + attack.rangedElements.coldFire);
    if (rangedPhysical > 0) sources.push({ element: "physical", value: rangedPhysical });
    if (attack.rangedElements.fire > 0) sources.push({ element: "fire", value: attack.rangedElements.fire });
    if (attack.rangedElements.ice > 0) sources.push({ element: "ice", value: attack.rangedElements.ice });
    if (attack.rangedElements.coldFire > 0) sources.push({ element: "cold_fire", value: attack.rangedElements.coldFire });

    // Siege physical
    const siegePhysical = attack.siege - (attack.siegeElements.fire + attack.siegeElements.ice + attack.siegeElements.coldFire);
    if (siegePhysical > 0) sources.push({ element: "physical", value: siegePhysical });
    if (attack.siegeElements.fire > 0) sources.push({ element: "fire", value: attack.siegeElements.fire });
    if (attack.siegeElements.ice > 0) sources.push({ element: "ice", value: attack.siegeElements.ice });
    if (attack.siegeElements.coldFire > 0) sources.push({ element: "cold_fire", value: attack.siegeElements.coldFire });
  } else {
    // Melee physical
    const meleePhysical = attack.normal - (attack.normalElements.fire + attack.normalElements.ice + attack.normalElements.coldFire);
    if (meleePhysical > 0) sources.push({ element: "physical", value: meleePhysical });
    if (attack.normalElements.fire > 0) sources.push({ element: "fire", value: attack.normalElements.fire });
    if (attack.normalElements.ice > 0) sources.push({ element: "ice", value: attack.normalElements.ice });
    if (attack.normalElements.coldFire > 0) sources.push({ element: "cold_fire", value: attack.normalElements.coldFire });
  }

  return sources;
}

/**
 * Determine the attack type for getFinalAttackValue.
 * In RS phase: if any siege attack, use siege. Otherwise ranged.
 * In ATTACK phase: melee.
 */
function getAttackType(attack: AccumulatedAttack, isRangedSiegePhase: boolean): CombatType {
  if (!isRangedSiegePhase) return COMBAT_TYPE_MELEE;
  if (attack.siege > 0) return COMBAT_TYPE_SIEGE;
  return COMBAT_TYPE_RANGED;
}

/**
 * Retroactively populate fame tracker assignments for all-at-once attack resolution.
 * In the target-first flow, attack is not assigned point-by-point to enemies.
 * Instead, all attack is applied as a group. We populate assignedByEnemy for each
 * tracker so that resolveAttackDefeatFameTrackers can detect which enemies were hit.
 */
function populateTrackerAssignments(
  trackers: readonly AttackDefeatFameTracker[],
  targetEnemyIds: readonly string[]
): readonly AttackDefeatFameTracker[] {
  if (trackers.length === 0 || targetEnemyIds.length === 0) return trackers;

  return trackers.map((tracker) => {
    // Distribute tracker's full attack amount across all declared targets
    // (each target gets the full amount since it's all-or-nothing group attack)
    const assignedByEnemy: Record<string, number> = {};
    for (const enemyId of targetEnemyIds) {
      assignedByEnemy[enemyId] = tracker.amount;
    }
    return {
      ...tracker,
      assignedByEnemy,
      remaining: 0,
    };
  });
}

export function createFinalizeAttackCommand(
  params: FinalizeAttackCommandParams
): Command {
  return {
    type: FINALIZE_ATTACK_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      let combat = state.combat;
      if (!combat) {
        throw new Error("Not in combat");
      }

      if (!combat.declaredAttackTargets || combat.declaredAttackTargets.length === 0) {
        throw new Error("No attack targets declared");
      }

      const declaredTargetIds = combat.declaredAttackTargets;
      const isRangedSiegePhase = combat.phase === COMBAT_PHASE_RANGED_SIEGE;
      const combatPhase = combat.phase;

      // Get target enemies
      const targets = combat.enemies.filter(
        (e) =>
          combat!.declaredAttackTargets!.includes(e.instanceId) && !e.isDefeated
      );

      // Get player
      const playerIndex = state.players.findIndex((p) => p.id === params.playerId);
      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Auto-assign Defend abilities
      const defendAssignments = autoAssignDefend(
        state,
        params.playerId,
        combat.declaredAttackTargets
      );

      // Update combat state with Defend assignments
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

        combat = {
          ...combat,
          usedDefend: updatedUsedDefend,
          defendBonuses: updatedDefendBonuses,
        };
        state = { ...state, combat };
      }

      // Build attack sources from accumulated attack
      const attackSources = buildAttackSources(player.combatAccumulator.attack, isRangedSiegePhase);
      const attackType = getAttackType(player.combatAccumulator.attack, isRangedSiegePhase);

      // Calculate combined armor of all targets
      const totalArmor = targets.reduce((sum, e) => {
        const resistances = e.definition.resistances;
        const resistanceCount = resistances ? resistances.length : 0;
        const baseArmor = getBaseArmorForPhase(e, combatPhase, state, params.playerId);
        return sum + getEffectiveEnemyArmor(state, e.instanceId, baseArmor, resistanceCount, params.playerId);
      }, 0);

      // Get combined resistances
      const targetResistances = combineResistances(
        targets.map((e) => ({
          resistances: getEnemyResistances(state, e) as Resistances,
        }))
      );

      // Calculate effective attack value
      const effectiveAttackValue = getFinalAttackValue(
        attackSources,
        targetResistances,
        state,
        params.playerId,
        attackType
      );

      const events: GameEvent[] = [];
      let fameGained = 0;
      let reputationPenalty = 0;
      let reputationBonus = 0;
      let enemiesDefeatedCount = 0;

      // Check if attack succeeds
      if (effectiveAttackValue < totalArmor) {
        // Attack failed
        events.push({
          type: ATTACK_FAILED,
          targetEnemyInstanceIds: combat.declaredAttackTargets,
          attackValue: effectiveAttackValue,
          requiredAttack: totalArmor,
        });
      } else {
        // Attack succeeded — defeat all targets
        const updatedEnemies = combat.enemies.map((e) => {
          if (
            combat!.declaredAttackTargets!.includes(e.instanceId) &&
            !e.isDefeated
          ) {
            fameGained += e.definition.fame;
            if (e.definition.reputationPenalty) {
              reputationPenalty += e.definition.reputationPenalty;
            }
            if (e.definition.reputationBonus) {
              reputationBonus += e.definition.reputationBonus;
            }
            enemiesDefeatedCount++;
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

        combat = {
          ...combat,
          enemies: updatedEnemies,
          fameGained: combat.fameGained + fameGained,
        };
      }

      // Always: clear declaredAttackTargets, wipe phase-relevant attack, clear pending damage
      combat = {
        ...combat,
        declaredAttackTargets: undefined,
        attacksThisPhase: combat.attacksThisPhase + 1,
        pendingDamage: {},
      };

      // Wipe phase-relevant accumulated attack and assigned attack
      let updatedAttack = { ...player.combatAccumulator.attack };
      if (isRangedSiegePhase) {
        updatedAttack = {
          ...updatedAttack,
          ranged: 0,
          siege: 0,
          rangedElements: createEmptyElementalValues(),
          siegeElements: createEmptyElementalValues(),
        };
      } else {
        updatedAttack = {
          ...updatedAttack,
          normal: 0,
          normalElements: createEmptyElementalValues(),
        };
      }

      const updatedPlayer: Player = {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          attack: updatedAttack,
          assignedAttack: createEmptyAccumulatedAttack(),
        },
      };

      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      let updatedState: GameState = {
        ...state,
        combat,
        players: updatedPlayers,
      };

      // Apply fame and reputation if enemies were defeated
      if (fameGained > 0) {
        updatedState = applyFameToPlayer(updatedState, params.playerId, fameGained);
      }

      if (reputationPenalty > 0 || reputationBonus > 0) {
        const repResult = applyReputationChange(
          updatedState,
          params.playerId,
          reputationBonus,
          reputationPenalty
        );
        updatedState = repResult.state;
        events.push(...repResult.events);
      }

      // Track defeated enemies count for Sword of Justice fame bonus
      if (enemiesDefeatedCount > 0) {
        const pIdx = updatedState.players.findIndex((p) => p.id === params.playerId);
        if (pIdx !== -1) {
          const p = updatedState.players[pIdx];
          if (p) {
            const players = [...updatedState.players];
            players[pIdx] = {
              ...p,
              enemiesDefeatedThisTurn: p.enemiesDefeatedThisTurn + enemiesDefeatedCount,
            };
            updatedState = { ...updatedState, players };
          }
        }
      }

      // Resolve fame tracking modifiers (attack defeat fame, scout, bow, soul harvester)
      if (enemiesDefeatedCount > 0) {
        const defeatedEnemyIds = events
          .filter((e): e is { type: typeof ENEMY_DEFEATED; enemyInstanceId: string; enemyName: string; fameGained: number } => e.type === ENEMY_DEFEATED)
          .map((e) => e.enemyInstanceId);

        const pIdx = updatedState.players.findIndex((p) => p.id === params.playerId);
        if (pIdx !== -1) {
          const p = updatedState.players[pIdx];
          if (p) {
            // Populate tracker assignments for the declared targets
            // (required because the all-at-once flow doesn't assign point-by-point)
            const populatedTrackers = populateTrackerAssignments(
              p.pendingAttackDefeatFame,
              declaredTargetIds
            );

            const fameResult = resolveAttackDefeatFameTrackers(
              populatedTrackers,
              defeatedEnemyIds
            );

            if (fameResult.updatedTrackers !== p.pendingAttackDefeatFame) {
              const players = [...updatedState.players];
              players[pIdx] = {
                ...p,
                pendingAttackDefeatFame: fameResult.updatedTrackers,
              };
              updatedState = { ...updatedState, players };
            }

            if (fameResult.fameToGain > 0) {
              updatedState = applyFameToPlayer(updatedState, params.playerId, fameResult.fameToGain);
            }

            if (fameResult.reputationToGain !== 0) {
              const trackerRepResult = applyReputationChange(
                updatedState,
                params.playerId,
                fameResult.reputationToGain > 0 ? fameResult.reputationToGain : 0,
                fameResult.reputationToGain < 0 ? -fameResult.reputationToGain : 0
              );
              updatedState = trackerRepResult.state;
              events.push(...trackerRepResult.events);
            }

            if (fameResult.armorReductionsToApply > 0 && updatedState.combat) {
              updatedState = applyArmorReductions(
                updatedState,
                params.playerId,
                fameResult.armorReductionsToApply
              );
            }
          }
        }

        // Scout fame bonus
        const defeatedEnemyDefinitionIds = (updatedState.combat?.enemies ?? [])
          .filter((e) => e.isDefeated)
          .map((e) => e.enemyId as string);
        const scoutFameResult = resolveScoutFameBonus(updatedState, params.playerId, defeatedEnemyDefinitionIds);
        if (scoutFameResult.fameToGain > 0) {
          updatedState = scoutFameResult.state;
          updatedState = applyFameToPlayer(updatedState, params.playerId, scoutFameResult.fameToGain);
        }

        // Bow of Starsdawn phase fame bonus
        const bowFameResult = resolveBowPhaseFameBonus(updatedState, params.playerId, enemiesDefeatedCount);
        if (bowFameResult.fameToGain > 0) {
          updatedState = bowFameResult.state;
          updatedState = applyFameToPlayer(updatedState, params.playerId, bowFameResult.fameToGain);
        } else if (bowFameResult.state !== updatedState) {
          updatedState = bowFameResult.state;
        }

        // Soul Harvester crystal rewards
        const newlyDefeatedEnemies = (updatedState.combat?.enemies ?? []).filter((e) => e.isDefeated);
        const soulHarvesterResult = resolveSoulHarvesterCrystals(updatedState, params.playerId, newlyDefeatedEnemies);
        if (soulHarvesterResult.state !== updatedState) {
          updatedState = soulHarvesterResult.state;
        }
      }

      return {
        state: updatedState,
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo FINALIZE_ATTACK");
    },
  };
}
