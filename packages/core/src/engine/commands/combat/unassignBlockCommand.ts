/**
 * Unassign Block Command
 *
 * Removes previously assigned block from an enemy during the block phase.
 * Part of the incremental allocation system that allows players
 * to reallocate block before committing with END_COMBAT_PHASE.
 *
 * This command is REVERSIBLE - supports undo functionality.
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { AttackElement } from "@mage-knight/shared";
import {
  BLOCK_UNASSIGNED,
  ATTACK_ELEMENT_FIRE,
  ATTACK_ELEMENT_ICE,
  ATTACK_ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import type { ElementalAttackValues } from "../../../types/player.js";
import type { PendingElementalDamage } from "../../../types/combat.js";
import { createEmptyPendingDamage } from "../../../types/combat.js";
import { isSwiftActive } from "../../combat/swiftHelpers.js";

export const UNASSIGN_BLOCK_COMMAND = "UNASSIGN_BLOCK" as const;

export interface UnassignBlockCommandParams {
  readonly playerId: string;
  readonly enemyInstanceId: string;
  readonly element: AttackElement;
  readonly amount: number;
}

/**
 * Get the currently assigned amount for a specific block element to a specific enemy.
 */
function getAssignedToEnemy(
  pending: PendingElementalDamage | undefined,
  element: AttackElement
): number {
  if (!pending) return 0;

  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return pending.fire;
    case ATTACK_ELEMENT_ICE:
      return pending.ice;
    case ATTACK_ELEMENT_COLD_FIRE:
      return pending.coldFire;
    default:
      return pending.physical;
  }
}

/**
 * Subtract from elemental values.
 */
function subtractFromElementalValues(
  values: ElementalAttackValues,
  element: AttackElement,
  amount: number
): ElementalAttackValues {
  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return { ...values, fire: values.fire - amount };
    case ATTACK_ELEMENT_ICE:
      return { ...values, ice: values.ice - amount };
    case ATTACK_ELEMENT_COLD_FIRE:
      return { ...values, coldFire: values.coldFire - amount };
    default:
      return { ...values, physical: values.physical - amount };
  }
}

/**
 * Subtract block from pending block for an enemy.
 */
function subtractFromPendingBlock(
  pending: PendingElementalDamage,
  element: AttackElement,
  amount: number
): PendingElementalDamage {
  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return { ...pending, fire: pending.fire - amount };
    case ATTACK_ELEMENT_ICE:
      return { ...pending, ice: pending.ice - amount };
    case ATTACK_ELEMENT_COLD_FIRE:
      return { ...pending, coldFire: pending.coldFire - amount };
    default:
      return { ...pending, physical: pending.physical - amount };
  }
}

export function createUnassignBlockCommand(params: UnassignBlockCommandParams): Command {
  // Store state needed for undo
  let previousPendingBlock: PendingElementalDamage | undefined;
  let previousPendingSwiftBlock: PendingElementalDamage | undefined;
  let previousAssignedBlock: number | undefined;
  let previousAssignedBlockElements: ElementalAttackValues | undefined;

  return {
    type: UNASSIGN_BLOCK_COMMAND,
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

      // Get current pending block for this enemy
      const currentPending =
        state.combat.pendingBlock[params.enemyInstanceId] ?? createEmptyPendingDamage();
      const currentSwiftPending =
        state.combat.pendingSwiftBlock[params.enemyInstanceId] ??
        createEmptyPendingDamage();

      // Validate that there's enough assigned to unassign
      const currentlyAssigned = getAssignedToEnemy(currentPending, params.element);
      if (params.amount > currentlyAssigned) {
        throw new Error(
          `Cannot unassign ${params.amount} ${params.element}: only ${currentlyAssigned} assigned to this enemy`
        );
      }

      // Store state for undo
      previousPendingBlock = currentPending;
      previousPendingSwiftBlock = currentSwiftPending;
      previousAssignedBlock = player.combatAccumulator.assignedBlock;
      previousAssignedBlockElements = player.combatAccumulator.assignedBlockElements;

      const swiftAssigned = getAssignedToEnemy(currentSwiftPending, params.element);
      const normalAssigned = Math.max(0, currentlyAssigned - swiftAssigned);
      const swiftActive = isSwiftActive(state, params.playerId, enemy);

      let swiftToRemove = 0;
      if (swiftActive) {
        const normalToRemove = Math.min(params.amount, normalAssigned);
        const remaining = params.amount - normalToRemove;
        swiftToRemove = Math.min(remaining, swiftAssigned);
      } else {
        swiftToRemove = Math.min(params.amount, swiftAssigned);
      }

      // Update player's assigned block (subtract since we're unassigning)
      const newAssignedBlockElements = subtractFromElementalValues(
        player.combatAccumulator.assignedBlockElements,
        params.element,
        params.amount
      );

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              combatAccumulator: {
                ...p.combatAccumulator,
                assignedBlock: p.combatAccumulator.assignedBlock - params.amount,
                assignedBlockElements: newAssignedBlockElements,
              },
            }
          : p
      );

      // Update combat pending block
      const newPending = subtractFromPendingBlock(currentPending, params.element, params.amount);
      const newSwiftPending =
        swiftToRemove > 0
          ? subtractFromPendingBlock(currentSwiftPending, params.element, swiftToRemove)
          : currentSwiftPending;

      // Check if all pending block is now zero - if so, remove the entry
      const isEmpty =
        newPending.physical === 0 &&
        newPending.fire === 0 &&
        newPending.ice === 0 &&
        newPending.coldFire === 0;

      // Build the new pending block object
      let updatedPendingBlock: typeof state.combat.pendingBlock;
      if (isEmpty) {
        // Filter out this enemy's entry since it's now empty
        const { [params.enemyInstanceId]: _removed, ...rest } = state.combat.pendingBlock;
        void _removed; // Intentionally unused - we're filtering it out
        updatedPendingBlock = rest;
      } else {
        updatedPendingBlock = {
          ...state.combat.pendingBlock,
          [params.enemyInstanceId]: newPending,
        };
      }

      const isSwiftEmpty =
        newSwiftPending.physical === 0 &&
        newSwiftPending.fire === 0 &&
        newSwiftPending.ice === 0 &&
        newSwiftPending.coldFire === 0;
      let updatedPendingSwiftBlock: typeof state.combat.pendingSwiftBlock;
      if (isSwiftEmpty) {
        const { [params.enemyInstanceId]: _removed, ...rest } =
          state.combat.pendingSwiftBlock;
        void _removed;
        updatedPendingSwiftBlock = rest;
      } else {
        updatedPendingSwiftBlock = {
          ...state.combat.pendingSwiftBlock,
          [params.enemyInstanceId]: newSwiftPending,
        };
      }

      const updatedCombat = {
        ...state.combat,
        pendingBlock: updatedPendingBlock,
        pendingSwiftBlock: updatedPendingSwiftBlock,
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [
          {
            type: BLOCK_UNASSIGNED,
            enemyInstanceId: params.enemyInstanceId,
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

      // Restore previous assigned block
      if (previousAssignedBlock === undefined || !previousAssignedBlockElements) {
        throw new Error("Cannot undo: no previous state stored");
      }

      // Capture for TypeScript
      const restoredAssignedBlock = previousAssignedBlock;
      const restoredAssignedBlockElements = previousAssignedBlockElements;

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              combatAccumulator: {
                ...p.combatAccumulator,
                assignedBlock: restoredAssignedBlock,
                assignedBlockElements: restoredAssignedBlockElements,
              },
            }
          : p
      );

      // Restore previous pending block
      if (!previousPendingBlock) {
        throw new Error("Cannot undo: no previous pending block stored");
      }
      if (!previousPendingSwiftBlock) {
        throw new Error("Cannot undo: no previous pending swift block stored");
      }

      const updatedCombat = {
        ...state.combat,
        pendingBlock: {
          ...state.combat.pendingBlock,
          [params.enemyInstanceId]: previousPendingBlock,
        },
        pendingSwiftBlock: {
          ...state.combat.pendingSwiftBlock,
          [params.enemyInstanceId]: previousPendingSwiftBlock,
        },
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [], // No specific undo event needed
      };
    },
  };
}
