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
 */

import type { CommandFactory } from "./types.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
} from "@mage-knight/shared";
import {
  createEnterCombatCommand,
  createEndCombatPhaseCommand,
  createDeclareBlockCommand,
  createDeclareAttackCommand,
  createAssignDamageCommand,
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
 */
export const createDeclareBlockCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== DECLARE_BLOCK_ACTION) return null;
  return createDeclareBlockCommand({
    playerId,
    targetEnemyInstanceId: action.targetEnemyInstanceId,
    // blocks now read from player.combatAccumulator.blockSources by the command
  });
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
 */
export const createAssignDamageCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== ASSIGN_DAMAGE_ACTION) return null;

  // Only include assignments if provided
  if (action.assignments) {
    return createAssignDamageCommand({
      playerId,
      enemyInstanceId: action.enemyInstanceId,
      assignments: action.assignments,
    });
  }

  return createAssignDamageCommand({
    playerId,
    enemyInstanceId: action.enemyInstanceId,
  });
};
