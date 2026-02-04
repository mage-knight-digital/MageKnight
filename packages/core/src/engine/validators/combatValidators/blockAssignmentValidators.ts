/**
 * Combat block assignment validators
 *
 * Validators for incremental block assignment system.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction, AttackElement } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import { ASSIGN_BLOCK_ACTION, UNASSIGN_BLOCK_ACTION } from "@mage-knight/shared";
import { COMBAT_PHASE_BLOCK } from "../../../types/combat.js";
import type { ElementalAttackValues } from "../../../types/player.js";
import { getElementalValue, getPendingElementalValue } from "../../helpers/elementalValueHelpers.js";
import {
  NOT_IN_COMBAT,
  WRONG_COMBAT_PHASE,
  ENEMY_NOT_FOUND,
  ENEMY_ALREADY_DEFEATED,
  ENEMY_ALREADY_BLOCKED,
  INSUFFICIENT_BLOCK,
  NOTHING_TO_UNASSIGN_BLOCK,
  INVALID_ASSIGNMENT_AMOUNT,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";

/**
 * Get the available amount for a specific element of block.
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

// Assign/Unassign block must be in combat
export function validateAssignBlockInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const blockActions = [ASSIGN_BLOCK_ACTION, UNASSIGN_BLOCK_ACTION];

  if (!blockActions.includes(action.type as typeof ASSIGN_BLOCK_ACTION)) {
    return valid();
  }

  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }

  return valid();
}

// Assign/Unassign block only in Block phase
export function validateAssignBlockPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const blockActions = [ASSIGN_BLOCK_ACTION, UNASSIGN_BLOCK_ACTION];

  if (!blockActions.includes(action.type as typeof ASSIGN_BLOCK_ACTION)) {
    return valid();
  }

  if (state.combat?.phase !== COMBAT_PHASE_BLOCK) {
    return invalid(
      WRONG_COMBAT_PHASE,
      "Can only assign/unassign block during Block phase"
    );
  }

  return valid();
}

// Target enemy must exist and not be defeated or already blocked (for assign block)
export function validateAssignBlockTargetEnemy(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_BLOCK_ACTION) return valid();

  const enemy = state.combat?.enemies.find(
    (e) => e.instanceId === action.enemyInstanceId
  );

  if (!enemy) {
    return invalid(ENEMY_NOT_FOUND, "Target enemy not found");
  }

  if (enemy.isDefeated) {
    return invalid(ENEMY_ALREADY_DEFEATED, "Target enemy is already defeated");
  }

  if (enemy.isBlocked) {
    return invalid(ENEMY_ALREADY_BLOCKED, "Target enemy is already blocked");
  }

  return valid();
}

// Target enemy must exist (for unassign block)
export function validateUnassignBlockTargetEnemy(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== UNASSIGN_BLOCK_ACTION) return valid();

  const enemy = state.combat?.enemies.find(
    (e) => e.instanceId === action.enemyInstanceId
  );

  if (!enemy) {
    return invalid(ENEMY_NOT_FOUND, "Target enemy not found");
  }

  return valid();
}

// Validate player has enough available block to assign
export function validateHasAvailableBlock(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_BLOCK_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return valid();

  const available = getAvailableBlock(
    player.combatAccumulator.blockElements,
    player.combatAccumulator.assignedBlockElements,
    action.element
  );

  if (action.amount <= 0) {
    return invalid(INVALID_ASSIGNMENT_AMOUNT, "Assignment amount must be positive");
  }

  if (action.amount > available) {
    return invalid(
      INSUFFICIENT_BLOCK,
      `Insufficient ${action.element} block: need ${action.amount}, have ${available}`
    );
  }

  return valid();
}

// Validate there's enough assigned block to unassign
export function validateHasAssignedBlockToUnassign(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== UNASSIGN_BLOCK_ACTION) return valid();

  if (action.amount <= 0) {
    return invalid(INVALID_ASSIGNMENT_AMOUNT, "Unassignment amount must be positive");
  }

  const pending = state.combat?.pendingBlock[action.enemyInstanceId];
  const currentlyAssigned = getPendingElementalValue(pending, action.element);

  if (action.amount > currentlyAssigned) {
    return invalid(
      NOTHING_TO_UNASSIGN_BLOCK,
      `Cannot unassign ${action.amount} ${action.element} block: only ${currentlyAssigned} assigned to this enemy`
    );
  }

  return valid();
}
