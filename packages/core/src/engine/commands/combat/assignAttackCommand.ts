/**
 * Assign Attack Command
 *
 * Incrementally assigns attack damage to an enemy during combat.
 * Part of the incremental damage allocation system where players
 * assign damage point-by-point before committing with END_COMBAT_PHASE.
 *
 * This command is REVERSIBLE - players can undo assignments until
 * they end the combat phase.
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { AttackType, AttackElement } from "@mage-knight/shared";
import {
  ATTACK_ASSIGNED,
  ATTACK_TYPE_RANGED,
  ATTACK_TYPE_SIEGE,
  ATTACK_TYPE_MELEE,
  ATTACK_ELEMENT_PHYSICAL,
  ATTACK_ELEMENT_FIRE,
  ATTACK_ELEMENT_ICE,
  ATTACK_ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import type { AccumulatedAttack, AttackDefeatFameTracker } from "../../../types/player.js";
import type { PendingElementalDamage } from "../../../types/combat.js";
import { createEmptyPendingDamage } from "../../../types/combat.js";
import {
  getElementalValue,
  addToElementalValues,
} from "../../helpers/elementalValueHelpers.js";
import { isPhysicalAttackDoubled } from "../../modifiers/index.js";
import { COMBAT_PHASE_ATTACK } from "../../../types/combat.js";
import { assignAttackToFameTrackers } from "../../combat/attackFameTracking.js";

export const ASSIGN_ATTACK_COMMAND = "ASSIGN_ATTACK" as const;

export interface AssignAttackCommandParams {
  readonly playerId: string;
  readonly enemyInstanceId: string;
  readonly attackType: AttackType;
  readonly element: AttackElement;
  readonly amount: number;
}

/**
 * Get the available amount for a specific attack type and element.
 * Available = accumulated - assigned
 */
function getAvailableAttack(
  attack: AccumulatedAttack,
  assigned: AccumulatedAttack,
  attackType: AttackType,
  element: AttackElement
): number {
  let accumulated = 0;
  let alreadyAssigned = 0;

  // Get the accumulated value for this type/element combo
  switch (attackType) {
    case ATTACK_TYPE_RANGED:
      accumulated =
        element === ATTACK_ELEMENT_PHYSICAL
          ? attack.ranged
          : getElementalValue(attack.rangedElements, element);
      alreadyAssigned =
        element === ATTACK_ELEMENT_PHYSICAL
          ? assigned.ranged
          : getElementalValue(assigned.rangedElements, element);
      break;
    case ATTACK_TYPE_SIEGE:
      accumulated =
        element === ATTACK_ELEMENT_PHYSICAL
          ? attack.siege
          : getElementalValue(attack.siegeElements, element);
      alreadyAssigned =
        element === ATTACK_ELEMENT_PHYSICAL
          ? assigned.siege
          : getElementalValue(assigned.siegeElements, element);
      break;
    case ATTACK_TYPE_MELEE:
      accumulated =
        element === ATTACK_ELEMENT_PHYSICAL
          ? attack.normal
          : getElementalValue(attack.normalElements, element);
      alreadyAssigned =
        element === ATTACK_ELEMENT_PHYSICAL
          ? assigned.normal
          : getElementalValue(assigned.normalElements, element);
      break;
  }

  return accumulated - alreadyAssigned;
}

/**
 * Update accumulated attack values by adding to a specific type/element combo.
 */
function addToAccumulatedAttack(
  attack: AccumulatedAttack,
  attackType: AttackType,
  element: AttackElement,
  amount: number
): AccumulatedAttack {
  switch (attackType) {
    case ATTACK_TYPE_RANGED:
      if (element === ATTACK_ELEMENT_PHYSICAL) {
        return { ...attack, ranged: attack.ranged + amount };
      }
      return {
        ...attack,
        rangedElements: addToElementalValues(attack.rangedElements, element, amount),
      };
    case ATTACK_TYPE_SIEGE:
      if (element === ATTACK_ELEMENT_PHYSICAL) {
        return { ...attack, siege: attack.siege + amount };
      }
      return {
        ...attack,
        siegeElements: addToElementalValues(attack.siegeElements, element, amount),
      };
    case ATTACK_TYPE_MELEE:
      if (element === ATTACK_ELEMENT_PHYSICAL) {
        return { ...attack, normal: attack.normal + amount };
      }
      return {
        ...attack,
        normalElements: addToElementalValues(attack.normalElements, element, amount),
      };
  }
}

/**
 * Add damage to pending elemental damage for an enemy.
 */
function addToPendingDamage(
  pending: PendingElementalDamage,
  element: AttackElement,
  amount: number
): PendingElementalDamage {
  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return { ...pending, fire: pending.fire + amount };
    case ATTACK_ELEMENT_ICE:
      return { ...pending, ice: pending.ice + amount };
    case ATTACK_ELEMENT_COLD_FIRE:
      return { ...pending, coldFire: pending.coldFire + amount };
    default:
      return { ...pending, physical: pending.physical + amount };
  }
}

export function createAssignAttackCommand(params: AssignAttackCommandParams): Command {
  // Store state needed for undo
  let previousPendingDamage: PendingElementalDamage | undefined;
  let previousAssignedAttack: AccumulatedAttack | undefined;
  let previousAttackFameTrackers: readonly AttackDefeatFameTracker[] | undefined;

  return {
    type: ASSIGN_ATTACK_COMMAND,
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

      if (enemy.isDefeated) {
        throw new Error(`Enemy already defeated: ${params.enemyInstanceId}`);
      }

      // Validate available attack
      const available = getAvailableAttack(
        player.combatAccumulator.attack,
        player.combatAccumulator.assignedAttack,
        params.attackType,
        params.element
      );

      if (params.amount > available) {
        throw new Error(
          `Insufficient ${params.element} ${params.attackType} attack: need ${params.amount}, have ${available}`
        );
      }

      // Store state for undo
      previousPendingDamage =
        state.combat.pendingDamage[params.enemyInstanceId] ?? createEmptyPendingDamage();
      previousAssignedAttack = player.combatAccumulator.assignedAttack;
      previousAttackFameTrackers = player.pendingAttackDefeatFame;

      // Update player's assigned attack
      const newAssignedAttack = addToAccumulatedAttack(
        player.combatAccumulator.assignedAttack,
        params.attackType,
        params.element,
        params.amount
      );

      const updatedTrackers = assignAttackToFameTrackers(player.pendingAttackDefeatFame, {
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

      // Calculate actual damage amount (may be doubled for physical attacks in Attack phase)
      let damageAmount = params.amount;
      if (
        params.element === ATTACK_ELEMENT_PHYSICAL &&
        params.attackType === ATTACK_TYPE_MELEE &&
        state.combat.phase === COMBAT_PHASE_ATTACK &&
        isPhysicalAttackDoubled(state, params.playerId)
      ) {
        // Sword of Justice powered effect: double physical damage
        damageAmount = params.amount * 2;
      }

      // Update combat pending damage
      const currentPending =
        state.combat.pendingDamage[params.enemyInstanceId] ?? createEmptyPendingDamage();
      const newPending = addToPendingDamage(currentPending, params.element, damageAmount);

      const updatedCombat = {
        ...state.combat,
        pendingDamage: {
          ...state.combat.pendingDamage,
          [params.enemyInstanceId]: newPending,
        },
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [
          {
            type: ATTACK_ASSIGNED,
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

      const wasEmpty =
        previousPendingDamage.physical === 0 &&
        previousPendingDamage.fire === 0 &&
        previousPendingDamage.ice === 0 &&
        previousPendingDamage.coldFire === 0;

      // Build the new pending damage object
      let updatedPendingDamage: typeof state.combat.pendingDamage;
      if (wasEmpty) {
        // Filter out this enemy's entry since it was empty before
        const { [params.enemyInstanceId]: _removed, ...rest } = state.combat.pendingDamage;
        void _removed; // Intentionally unused - we're filtering it out
        updatedPendingDamage = rest;
      } else {
        updatedPendingDamage = {
          ...state.combat.pendingDamage,
          [params.enemyInstanceId]: previousPendingDamage,
        };
      }

      const updatedCombat = {
        ...state.combat,
        pendingDamage: updatedPendingDamage,
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [], // No specific undo event needed
      };
    },
  };
}
