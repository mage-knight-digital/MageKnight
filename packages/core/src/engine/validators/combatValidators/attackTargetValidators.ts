/**
 * Attack target declaration validators
 *
 * Validates DECLARE_ATTACK_TARGETS and FINALIZE_ATTACK actions
 * for the target-first attack flow.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  DECLARE_ATTACK_TARGETS_ACTION,
  FINALIZE_ATTACK_ACTION,
} from "@mage-knight/shared";
import {
  NOT_IN_COMBAT,
  WRONG_COMBAT_PHASE,
  TARGETS_ALREADY_DECLARED,
  NO_TARGETS_DECLARED,
  TARGET_ENEMY_NOT_FOUND,
  ENEMY_ALREADY_DEFEATED,
} from "../validationCodes.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
} from "../../../types/combat.js";

// ============================================================================
// DECLARE_ATTACK_TARGETS validators
// ============================================================================

/** Must be in combat to declare attack targets */
export function validateDeclareTargetsInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_TARGETS_ACTION) return valid();
  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }
  return valid();
}

/** Must be in RANGED_SIEGE or ATTACK phase */
export function validateDeclareTargetsPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_TARGETS_ACTION) return valid();
  if (!state.combat) return valid();
  if (
    state.combat.phase !== COMBAT_PHASE_RANGED_SIEGE &&
    state.combat.phase !== COMBAT_PHASE_ATTACK
  ) {
    return invalid(WRONG_COMBAT_PHASE, "Can only declare attack targets during Ranged/Siege or Attack phase");
  }
  return valid();
}

/** Cannot declare targets if already declared */
export function validateNoTargetsDeclared(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_TARGETS_ACTION) return valid();
  if (!state.combat) return valid();
  if (state.combat.declaredAttackTargets && state.combat.declaredAttackTargets.length > 0) {
    return invalid(TARGETS_ALREADY_DECLARED, "Attack targets already declared");
  }
  return valid();
}

/** All specified enemies must exist and not be defeated */
export function validateTargetsExistAndAlive(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_TARGETS_ACTION) return valid();
  if (!state.combat) return valid();

  const targetIds = action.targetEnemyInstanceIds;
  for (const targetId of targetIds) {
    const enemy = state.combat.enemies.find((e) => e.instanceId === targetId);
    if (!enemy) {
      return invalid(TARGET_ENEMY_NOT_FOUND, `Target enemy not found: ${targetId}`);
    }
    if (enemy.isDefeated) {
      return invalid(ENEMY_ALREADY_DEFEATED, `Target enemy already defeated: ${targetId}`);
    }
  }
  return valid();
}

// ============================================================================
// FINALIZE_ATTACK validators
// ============================================================================

/** Must be in combat to finalize attack */
export function validateFinalizeInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== FINALIZE_ATTACK_ACTION) return valid();
  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }
  return valid();
}

/** Must be in RANGED_SIEGE or ATTACK phase */
export function validateFinalizePhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== FINALIZE_ATTACK_ACTION) return valid();
  if (!state.combat) return valid();
  if (
    state.combat.phase !== COMBAT_PHASE_RANGED_SIEGE &&
    state.combat.phase !== COMBAT_PHASE_ATTACK
  ) {
    return invalid(WRONG_COMBAT_PHASE, "Can only finalize attack during Ranged/Siege or Attack phase");
  }
  return valid();
}

/** Must have declared attack targets */
export function validateTargetsDeclared(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== FINALIZE_ATTACK_ACTION) return valid();
  if (!state.combat) return valid();
  if (!state.combat.declaredAttackTargets || state.combat.declaredAttackTargets.length === 0) {
    return invalid(NO_TARGETS_DECLARED, "No attack targets declared");
  }
  return valid();
}
