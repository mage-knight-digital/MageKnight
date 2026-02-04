/**
 * Unassign Attack Command
 *
 * Removes previously assigned attack damage from an enemy during combat.
 * Part of the incremental damage allocation system that allows players
 * to reallocate damage before committing with END_COMBAT_PHASE.
 *
 * This command is REVERSIBLE - supports undo functionality.
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { AttackType, AttackElement } from "@mage-knight/shared";
import {
  ATTACK_UNASSIGNED,
  ATTACK_TYPE_RANGED,
  ATTACK_TYPE_SIEGE,
  ATTACK_TYPE_MELEE,
  ATTACK_ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import type { AccumulatedAttack, AttackDefeatFameTracker } from "../../../types/player.js";
import type { PendingElementalDamage } from "../../../types/combat.js";
import { createEmptyPendingDamage } from "../../../types/combat.js";
import { unassignAttackFromFameTrackers } from "../../combat/attackFameTracking.js";
import {
  getPendingElementalValue,
  subtractFromElementalValues,
  subtractFromPendingElemental,
  isPendingElementalEmpty,
} from "../../helpers/elementalValueHelpers.js";

export const UNASSIGN_ATTACK_COMMAND = "UNASSIGN_ATTACK" as const;

export interface UnassignAttackCommandParams {
  readonly playerId: string;
  readonly enemyInstanceId: string;
  readonly attackType: AttackType;
  readonly element: AttackElement;
  readonly amount: number;
}

/**
 * Subtract from accumulated attack values for a specific type/element combo.
 */
function subtractFromAccumulatedAttack(
  attack: AccumulatedAttack,
  attackType: AttackType,
  element: AttackElement,
  amount: number
): AccumulatedAttack {
  switch (attackType) {
    case ATTACK_TYPE_RANGED:
      if (element === ATTACK_ELEMENT_PHYSICAL) {
        return { ...attack, ranged: attack.ranged - amount };
      }
      return {
        ...attack,
        rangedElements: subtractFromElementalValues(attack.rangedElements, element, amount),
      };
    case ATTACK_TYPE_SIEGE:
      if (element === ATTACK_ELEMENT_PHYSICAL) {
        return { ...attack, siege: attack.siege - amount };
      }
      return {
        ...attack,
        siegeElements: subtractFromElementalValues(attack.siegeElements, element, amount),
      };
    case ATTACK_TYPE_MELEE:
      if (element === ATTACK_ELEMENT_PHYSICAL) {
        return { ...attack, normal: attack.normal - amount };
      }
      return {
        ...attack,
        normalElements: subtractFromElementalValues(attack.normalElements, element, amount),
      };
  }
}

export function createUnassignAttackCommand(params: UnassignAttackCommandParams): Command {
  // Store state needed for undo
  let previousPendingDamage: PendingElementalDamage | undefined;
  let previousAssignedAttack: AccumulatedAttack | undefined;
  let previousAttackFameTrackers: readonly AttackDefeatFameTracker[] | undefined;

  return {
    type: UNASSIGN_ATTACK_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Can undo until END_COMBAT_PHASE

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      // Find the player
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }
      const playerIndex = state.players.indexOf(player);

      // Find the enemy
      const enemy = state.combat.enemies.find((e) => e.instanceId === params.enemyInstanceId);
      if (!enemy) {
        throw new Error(`Enemy not found: ${params.enemyInstanceId}`);
      }

      // Get current pending damage for this enemy
      const currentPending =
        state.combat.pendingDamage[params.enemyInstanceId] ?? createEmptyPendingDamage();

      // Validate that there's enough assigned to unassign
      const currentlyAssigned = getPendingElementalValue(currentPending, params.element);
      if (params.amount > currentlyAssigned) {
        throw new Error(
          `Cannot unassign ${params.amount} ${params.element}: only ${currentlyAssigned} assigned to this enemy`
        );
      }

      // Store state for undo
      previousPendingDamage = currentPending;
      previousAssignedAttack = player.combatAccumulator.assignedAttack;
      previousAttackFameTrackers = player.pendingAttackDefeatFame;

      // Update player's assigned attack (subtract since we're unassigning)
      const newAssignedAttack = subtractFromAccumulatedAttack(
        player.combatAccumulator.assignedAttack,
        params.attackType,
        params.element,
        params.amount
      );

      const updatedTrackers = unassignAttackFromFameTrackers(player.pendingAttackDefeatFame, {
        enemyInstanceId: params.enemyInstanceId,
        attackType: params.attackType,
        element: params.element,
        amount: params.amount,
      });

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              combatAccumulator: {
                ...p.combatAccumulator,
                assignedAttack: newAssignedAttack,
              },
              pendingAttackDefeatFame: updatedTrackers,
            }
          : p
      );

      // Update combat pending damage
      const newPending = subtractFromPendingElemental(currentPending, params.element, params.amount);

      // Check if all pending damage is now zero - if so, remove the entry
      const isEmpty = isPendingElementalEmpty(newPending);

      // Build the new pending damage object
      let updatedPendingDamage: typeof state.combat.pendingDamage;
      if (isEmpty) {
        // Filter out this enemy's entry since it's now empty
        const { [params.enemyInstanceId]: _removed, ...rest } = state.combat.pendingDamage;
        void _removed; // Intentionally unused - we're filtering it out
        updatedPendingDamage = rest;
      } else {
        updatedPendingDamage = {
          ...state.combat.pendingDamage,
          [params.enemyInstanceId]: newPending,
        };
      }

      const updatedCombat = {
        ...state.combat,
        pendingDamage: updatedPendingDamage,
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [
          {
            type: ATTACK_UNASSIGNED,
            enemyInstanceId: params.enemyInstanceId,
            attackType: params.attackType,
            element: params.element,
            amount: params.amount,
          },
        ],
      };
    },

    undo(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      // Find the player
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }
      const playerIndex = state.players.indexOf(player);

      // Restore previous assigned attack
      if (!previousAssignedAttack) {
        throw new Error("Cannot undo: no previous state stored");
      }

      // Capture for TypeScript (narrows the type after the check)
      const restoredAssignedAttack = previousAssignedAttack;

      if (!previousAttackFameTrackers) {
        throw new Error("Cannot undo: no previous tracker state stored");
      }

      const restoredTrackers = previousAttackFameTrackers;

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              combatAccumulator: {
                ...p.combatAccumulator,
                assignedAttack: restoredAssignedAttack,
              },
              pendingAttackDefeatFame: restoredTrackers,
            }
          : p
      );

      // Restore previous pending damage
      if (!previousPendingDamage) {
        throw new Error("Cannot undo: no previous pending damage stored");
      }

      const updatedCombat = {
        ...state.combat,
        pendingDamage: {
          ...state.combat.pendingDamage,
          [params.enemyInstanceId]: previousPendingDamage,
        },
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [], // No specific undo event needed
      };
    },
  };
}
