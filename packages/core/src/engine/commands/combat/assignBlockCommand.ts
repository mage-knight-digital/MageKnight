/**
 * Assign Block Command
 *
 * Incrementally assigns block to an enemy during the block phase.
 * Part of the incremental allocation system where players assign
 * block point-by-point before committing with END_COMBAT_PHASE.
 *
 * This command is REVERSIBLE - players can undo assignments until
 * they end the combat phase.
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { AttackElement } from "@mage-knight/shared";
import {
  BLOCK_ASSIGNED,
  ATTACK_ELEMENT_FIRE,
  ATTACK_ELEMENT_ICE,
  ATTACK_ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import type { ElementalAttackValues } from "../../../types/player.js";
import type { PendingElementalDamage } from "../../../types/combat.js";
import { createEmptyPendingDamage } from "../../../types/combat.js";

export const ASSIGN_BLOCK_COMMAND = "ASSIGN_BLOCK" as const;

export interface AssignBlockCommandParams {
  readonly playerId: string;
  readonly enemyInstanceId: string;
  readonly element: AttackElement;
  readonly amount: number;
}

/**
 * Get the available amount for a specific block element.
 * Available = accumulated - assigned
 */
function getAvailableBlock(
  blockElements: ElementalAttackValues,
  assignedBlockElements: ElementalAttackValues,
  element: AttackElement
): number {
  const accumulated = getElementalValue(blockElements, element);
  const alreadyAssigned = getElementalValue(assignedBlockElements, element);
  return accumulated - alreadyAssigned;
}

function getElementalValue(elements: ElementalAttackValues, element: AttackElement): number {
  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return elements.fire;
    case ATTACK_ELEMENT_ICE:
      return elements.ice;
    case ATTACK_ELEMENT_COLD_FIRE:
      return elements.coldFire;
    default:
      return elements.physical;
  }
}

/**
 * Add to elemental values.
 */
function addToElementalValues(
  values: ElementalAttackValues,
  element: AttackElement,
  amount: number
): ElementalAttackValues {
  switch (element) {
    case ATTACK_ELEMENT_FIRE:
      return { ...values, fire: values.fire + amount };
    case ATTACK_ELEMENT_ICE:
      return { ...values, ice: values.ice + amount };
    case ATTACK_ELEMENT_COLD_FIRE:
      return { ...values, coldFire: values.coldFire + amount };
    default:
      return { ...values, physical: values.physical + amount };
  }
}

/**
 * Add block to pending block for an enemy.
 */
function addToPendingBlock(
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

export function createAssignBlockCommand(params: AssignBlockCommandParams): Command {
  // Store state needed for undo
  let previousPendingBlock: PendingElementalDamage | undefined;
  let previousAssignedBlock: number | undefined;
  let previousAssignedBlockElements: ElementalAttackValues | undefined;

  return {
    type: ASSIGN_BLOCK_COMMAND,
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

      if (enemy.isBlocked) {
        throw new Error(`Enemy already blocked: ${params.enemyInstanceId}`);
      }

      // Validate available block
      const available = getAvailableBlock(
        player.combatAccumulator.blockElements,
        player.combatAccumulator.assignedBlockElements,
        params.element
      );

      if (params.amount > available) {
        throw new Error(
          `Insufficient ${params.element} block: need ${params.amount}, have ${available}`
        );
      }

      // Store state for undo
      previousPendingBlock =
        state.combat.pendingBlock[params.enemyInstanceId] ?? createEmptyPendingDamage();
      previousAssignedBlock = player.combatAccumulator.assignedBlock;
      previousAssignedBlockElements = player.combatAccumulator.assignedBlockElements;

      // Update player's assigned block
      const newAssignedBlockElements = addToElementalValues(
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
                assignedBlock: p.combatAccumulator.assignedBlock + params.amount,
                assignedBlockElements: newAssignedBlockElements,
              },
            }
          : p
      );

      // Update combat pending block
      const currentPending =
        state.combat.pendingBlock[params.enemyInstanceId] ?? createEmptyPendingDamage();
      const newPending = addToPendingBlock(currentPending, params.element, params.amount);

      const updatedCombat = {
        ...state.combat,
        pendingBlock: {
          ...state.combat.pendingBlock,
          [params.enemyInstanceId]: newPending,
        },
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [
          {
            type: BLOCK_ASSIGNED,
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

      const wasEmpty =
        previousPendingBlock.physical === 0 &&
        previousPendingBlock.fire === 0 &&
        previousPendingBlock.ice === 0 &&
        previousPendingBlock.coldFire === 0;

      // Build the new pending block object
      let updatedPendingBlock: typeof state.combat.pendingBlock;
      if (wasEmpty) {
        // Filter out this enemy's entry since it was empty before
        const { [params.enemyInstanceId]: _removed, ...rest } = state.combat.pendingBlock;
        void _removed; // Intentionally unused - we're filtering it out
        updatedPendingBlock = rest;
      } else {
        updatedPendingBlock = {
          ...state.combat.pendingBlock,
          [params.enemyInstanceId]: previousPendingBlock,
        };
      }

      const updatedCombat = {
        ...state.combat,
        pendingBlock: updatedPendingBlock,
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [], // No specific undo event needed
      };
    },
  };
}
