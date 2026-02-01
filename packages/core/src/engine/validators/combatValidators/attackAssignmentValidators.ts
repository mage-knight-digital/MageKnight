/**
 * Combat attack assignment validators
 *
 * Validators for incremental attack assignment system.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction, AttackType, AttackElement } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  ASSIGN_ATTACK_ACTION,
  UNASSIGN_ATTACK_ACTION,
  ATTACK_TYPE_RANGED,
  ATTACK_TYPE_SIEGE,
  ATTACK_TYPE_MELEE,
  ATTACK_ELEMENT_PHYSICAL,
  ATTACK_ELEMENT_FIRE,
  ATTACK_ELEMENT_ICE,
  ATTACK_ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import { createEmptyPendingDamage, COMBAT_PHASE_RANGED_SIEGE } from "../../../types/combat.js";
import type { AccumulatedAttack } from "../../../types/player.js";
import { getFortificationLevel } from "./fortificationValidators.js";
import { getElementalValue } from "../../helpers/elementalValueHelpers.js";
import {
  NOT_IN_COMBAT,
  WRONG_COMBAT_PHASE,
  ENEMY_NOT_FOUND,
  ENEMY_ALREADY_DEFEATED,
  INVALID_ATTACK_TYPE,
  INSUFFICIENT_ATTACK,
  NOTHING_TO_UNASSIGN,
  INVALID_ASSIGNMENT_AMOUNT,
  FORTIFIED_NEEDS_SIEGE,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";

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
 * Get the currently assigned amount for a specific element to a specific enemy.
 */
function getAssignedToEnemy(
  state: GameState,
  enemyInstanceId: string,
  element: AttackElement
): number {
  const pending = state.combat?.pendingDamage[enemyInstanceId] ?? createEmptyPendingDamage();

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

// Assign/Unassign attack must be in combat
export function validateAssignAttackInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const assignmentActions = [ASSIGN_ATTACK_ACTION, UNASSIGN_ATTACK_ACTION];

  if (!assignmentActions.includes(action.type as typeof ASSIGN_ATTACK_ACTION)) {
    return valid();
  }

  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }

  return valid();
}

// Assign/Unassign attack only in Ranged/Siege or Attack phases
export function validateAssignAttackPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const assignmentActions = [ASSIGN_ATTACK_ACTION, UNASSIGN_ATTACK_ACTION];

  if (!assignmentActions.includes(action.type as typeof ASSIGN_ATTACK_ACTION)) {
    return valid();
  }

  const validPhases = [COMBAT_PHASE_RANGED_SIEGE, "attack"];
  if (
    !validPhases.includes(state.combat?.phase as typeof COMBAT_PHASE_RANGED_SIEGE)
  ) {
    return invalid(
      WRONG_COMBAT_PHASE,
      "Can only assign/unassign attacks during Ranged/Siege or Attack phase"
    );
  }

  return valid();
}

// Target enemy must exist and not be defeated (for assign attack)
export function validateAssignAttackTargetEnemy(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_ATTACK_ACTION) return valid();

  const enemy = state.combat?.enemies.find(
    (e) => e.instanceId === action.enemyInstanceId
  );

  if (!enemy) {
    return invalid(ENEMY_NOT_FOUND, "Target enemy not found");
  }

  if (enemy.isDefeated) {
    return invalid(ENEMY_ALREADY_DEFEATED, "Target enemy is already defeated");
  }

  return valid();
}

// Target enemy must exist (for unassign attack - can unassign even from defeated enemy during undo)
export function validateUnassignAttackTargetEnemy(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== UNASSIGN_ATTACK_ACTION) return valid();

  const enemy = state.combat?.enemies.find(
    (e) => e.instanceId === action.enemyInstanceId
  );

  if (!enemy) {
    return invalid(ENEMY_NOT_FOUND, "Target enemy not found");
  }

  return valid();
}

// Validate player has enough available attack to assign
export function validateHasAvailableAttack(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_ATTACK_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return valid();

  const available = getAvailableAttack(
    player.combatAccumulator.attack,
    player.combatAccumulator.assignedAttack,
    action.attackType,
    action.element
  );

  if (action.amount <= 0) {
    return invalid(INVALID_ASSIGNMENT_AMOUNT, "Assignment amount must be positive");
  }

  if (action.amount > available) {
    return invalid(
      INSUFFICIENT_ATTACK,
      `Insufficient ${action.element} ${action.attackType} attack: need ${action.amount}, have ${available}`
    );
  }

  return valid();
}

// Validate there's enough assigned to unassign
export function validateHasAssignedToUnassign(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== UNASSIGN_ATTACK_ACTION) return valid();

  if (action.amount <= 0) {
    return invalid(INVALID_ASSIGNMENT_AMOUNT, "Unassignment amount must be positive");
  }

  const currentlyAssigned = getAssignedToEnemy(
    state,
    action.enemyInstanceId,
    action.element
  );

  if (action.amount > currentlyAssigned) {
    return invalid(
      NOTHING_TO_UNASSIGN,
      `Cannot unassign ${action.amount} ${action.element}: only ${currentlyAssigned} assigned to this enemy`
    );
  }

  return valid();
}

// In Ranged/Siege phase, only ranged/siege attacks can be assigned
export function validateAssignAttackTypeForPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_ATTACK_ACTION) return valid();

  const isRangedSiegePhase = state.combat?.phase === COMBAT_PHASE_RANGED_SIEGE;
  const isRangedOrSiege =
    action.attackType === ATTACK_TYPE_RANGED ||
    action.attackType === ATTACK_TYPE_SIEGE;

  // In Ranged/Siege phase, only ranged/siege attacks allowed
  if (isRangedSiegePhase && !isRangedOrSiege) {
    return invalid(
      INVALID_ATTACK_TYPE,
      "Only Ranged or Siege attacks can be assigned in Ranged/Siege phase"
    );
  }

  return valid();
}

// In Ranged/Siege phase, fortified enemies can only receive siege attacks
export function validateAssignAttackFortification(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_ATTACK_ACTION) return valid();

  // Only applies in Ranged/Siege phase
  if (state.combat?.phase !== COMBAT_PHASE_RANGED_SIEGE) return valid();

  const enemy = state.combat.enemies.find((e) => e.instanceId === action.enemyInstanceId);
  if (!enemy) return valid();

  // Pass state and playerId to check for fortification-removing modifiers (Expose spell)
  const isAtFortifiedSite = state.combat.isAtFortifiedSite;
  const fortificationLevel = getFortificationLevel(enemy, isAtFortifiedSite, state, playerId);

  if (fortificationLevel > 0 && action.attackType !== ATTACK_TYPE_SIEGE) {
    return invalid(
      FORTIFIED_NEEDS_SIEGE,
      `Fortified enemy (${enemy.definition.name}) can only receive Siege attacks in Ranged/Siege phase`
    );
  }

  return valid();
}
