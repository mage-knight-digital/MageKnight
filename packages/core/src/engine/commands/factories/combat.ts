/**
 * Combat Command Factories
 *
 * Factory functions that translate combat-related PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/combat
 *
 * @remarks Factories in this module:
 * - createEnterCombatCommandFromAction - Start combat at current location
 * - createEndCombatPhaseCommandFromAction - Advance to next combat phase
 * - createDeclareBlockCommandFromAction - Declare block against enemy
 * - createDeclareAttackCommandFromAction - Declare attack against enemy
 * - createAssignDamageCommandFromAction - Assign unblocked damage
 * - createAssignAttackCommandFromAction - Incrementally assign attack damage to enemy
 * - createUnassignAttackCommandFromAction - Remove assigned attack damage from enemy
 * - createAssignBlockCommandFromAction - Incrementally assign block to enemy
 * - createUnassignBlockCommandFromAction - Remove assigned block from enemy
 */

import type { CommandFactory } from "./types.js";
import {
  ENTER_COMBAT_ACTION,
  CHALLENGE_RAMPAGING_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  ASSIGN_ATTACK_ACTION,
  UNASSIGN_ATTACK_ACTION,
  ASSIGN_BLOCK_ACTION,
  UNASSIGN_BLOCK_ACTION,
  SPEND_MOVE_ON_CUMBERSOME_ACTION,
} from "@mage-knight/shared";
import {
  createEnterCombatCommand,
  createChallengeRampagingCommand,
  createEndCombatPhaseCommand,
  createDeclareBlockCommand,
  createDeclareAttackCommand,
  createAssignDamageCommand,
  createAssignAttackCommand,
  createUnassignAttackCommand,
  createAssignBlockCommand,
  createUnassignBlockCommand,
  createSpendMoveOnCumbersomeCommand,
} from "../combat/index.js";

/**
 * Enter combat command factory.
 * Creates a command to start combat with enemies at the current location.
 */
export const createEnterCombatCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== ENTER_COMBAT_ACTION) return null;
  return createEnterCombatCommand({
    playerId,
    enemyIds: action.enemyIds,
    ...(action.isAtFortifiedSite === undefined
      ? {}
      : { isAtFortifiedSite: action.isAtFortifiedSite }),
  });
};

/**
 * Challenge rampaging command factory.
 * Creates a command to challenge rampaging enemies from an adjacent hex.
 */
export const createChallengeRampagingCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== CHALLENGE_RAMPAGING_ACTION) return null;
  return createChallengeRampagingCommand({
    playerId,
    targetHex: action.targetHex,
  });
};

/**
 * End combat phase command factory.
 * Creates a command to advance to the next combat phase.
 */
export const createEndCombatPhaseCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== END_COMBAT_PHASE_ACTION) return null;
  return createEndCombatPhaseCommand({ playerId });
};

/**
 * Declare block command factory.
 * Creates a command to declare a block against an enemy attack.
 * For multi-attack enemies, attackIndex specifies which attack to block.
 */
export const createDeclareBlockCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== DECLARE_BLOCK_ACTION) return null;

  const baseParams = {
    playerId,
    targetEnemyInstanceId: action.targetEnemyInstanceId,
    // blocks now read from player.combatAccumulator.blockSources by the command
  };

  // Only include attackIndex if explicitly provided
  if (action.attackIndex !== undefined) {
    return createDeclareBlockCommand({ ...baseParams, attackIndex: action.attackIndex });
  }
  return createDeclareBlockCommand(baseParams);
};

/**
 * Declare attack command factory.
 * Creates a command to declare attacks against enemies.
 */
export const createDeclareAttackCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== DECLARE_ATTACK_ACTION) return null;
  return createDeclareAttackCommand({
    playerId,
    targetEnemyInstanceIds: action.targetEnemyInstanceIds,
    attacks: action.attacks,
    attackType: action.attackType,
  });
};

/**
 * Assign damage command factory.
 * Creates a command to assign unblocked damage to player/units.
 * For multi-attack enemies, attackIndex specifies which attack's damage to assign.
 */
export const createAssignDamageCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== ASSIGN_DAMAGE_ACTION) return null;

  const baseParams = {
    playerId,
    enemyInstanceId: action.enemyInstanceId,
  };

  // Build params with optional attackIndex
  const paramsWithAttackIndex = action.attackIndex !== undefined
    ? { ...baseParams, attackIndex: action.attackIndex }
    : baseParams;

  // Only include assignments if provided
  if (action.assignments) {
    return createAssignDamageCommand({
      ...paramsWithAttackIndex,
      assignments: action.assignments,
    });
  }

  return createAssignDamageCommand(paramsWithAttackIndex);
};

/**
 * Assign attack command factory.
 * Creates a command to incrementally assign attack damage to an enemy.
 *
 * Part of the incremental damage allocation system.
 */
export const createAssignAttackCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== ASSIGN_ATTACK_ACTION) return null;
  return createAssignAttackCommand({
    playerId,
    enemyInstanceId: action.enemyInstanceId,
    attackType: action.attackType,
    element: action.element,
    amount: action.amount,
  });
};

/**
 * Unassign attack command factory.
 * Creates a command to remove assigned attack damage from an enemy.
 *
 * Part of the incremental damage allocation system.
 */
export const createUnassignAttackCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== UNASSIGN_ATTACK_ACTION) return null;
  return createUnassignAttackCommand({
    playerId,
    enemyInstanceId: action.enemyInstanceId,
    attackType: action.attackType,
    element: action.element,
    amount: action.amount,
  });
};

/**
 * Assign block command factory.
 * Creates a command to incrementally assign block to an enemy.
 *
 * Part of the incremental block allocation system.
 */
export const createAssignBlockCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== ASSIGN_BLOCK_ACTION) return null;
  return createAssignBlockCommand({
    playerId,
    enemyInstanceId: action.enemyInstanceId,
    element: action.element,
    amount: action.amount,
  });
};

/**
 * Unassign block command factory.
 * Creates a command to remove assigned block from an enemy.
 *
 * Part of the incremental block allocation system.
 */
export const createUnassignBlockCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== UNASSIGN_BLOCK_ACTION) return null;
  return createUnassignBlockCommand({
    playerId,
    enemyInstanceId: action.enemyInstanceId,
    element: action.element,
    amount: action.amount,
  });
};

/**
 * Spend move on cumbersome command factory.
 * Creates a command to spend move points to reduce a Cumbersome enemy's attack.
 *
 * Part of the Cumbersome ability system.
 */
export const createSpendMoveOnCumbersomeCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== SPEND_MOVE_ON_CUMBERSOME_ACTION) return null;
  return createSpendMoveOnCumbersomeCommand({
    playerId,
    enemyInstanceId: action.enemyInstanceId,
    movePointsToSpend: action.movePointsToSpend,
  });
};
