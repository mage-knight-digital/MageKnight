/**
 * Block target declaration validators
 *
 * Validates DECLARE_BLOCK_TARGET and FINALIZE_BLOCK actions
 * for the target-first block flow.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  DECLARE_BLOCK_TARGET_ACTION,
  FINALIZE_BLOCK_ACTION,
} from "@mage-knight/shared";
import {
  NOT_IN_COMBAT,
  WRONG_COMBAT_PHASE,
  BLOCK_TARGET_ALREADY_DECLARED,
  NO_BLOCK_TARGET_DECLARED,
  ENEMY_NOT_FOUND,
  ENEMY_ALREADY_DEFEATED,
  ENEMY_ALREADY_BLOCKED,
  ENEMY_DOES_NOT_ATTACK,
} from "../validationCodes.js";
import { COMBAT_PHASE_BLOCK } from "../../../types/combat.js";
import { doesEnemyAttackThisCombat } from "../../modifiers/index.js";

// ============================================================================
// DECLARE_BLOCK_TARGET validators
// ============================================================================

/** Must be in combat to declare block target */
export function validateDeclareBlockTargetInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_BLOCK_TARGET_ACTION) return valid();
  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }
  return valid();
}

/** Must be in BLOCK phase */
export function validateDeclareBlockTargetPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_BLOCK_TARGET_ACTION) return valid();
  if (!state.combat) return valid();
  if (state.combat.phase !== COMBAT_PHASE_BLOCK) {
    return invalid(WRONG_COMBAT_PHASE, "Can only declare block target during Block phase");
  }
  return valid();
}

/** Cannot declare block target if already declared */
export function validateNoBlockTargetDeclared(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_BLOCK_TARGET_ACTION) return valid();
  if (!state.combat) return valid();
  if (state.combat.declaredBlockTarget) {
    return invalid(BLOCK_TARGET_ALREADY_DECLARED, "Block target already declared");
  }
  return valid();
}

/** Target enemy must exist, not defeated, not blocked, and attacks this combat */
export function validateBlockTargetExistsAndValid(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_BLOCK_TARGET_ACTION) return valid();
  if (!state.combat) return valid();

  const targetId = action.targetEnemyInstanceId;
  const enemy = state.combat.enemies.find((e) => e.instanceId === targetId);

  if (!enemy) {
    return invalid(ENEMY_NOT_FOUND, `Target enemy not found: ${targetId}`);
  }
  if (enemy.isDefeated) {
    return invalid(ENEMY_ALREADY_DEFEATED, `Target enemy already defeated: ${targetId}`);
  }
  if (enemy.isBlocked) {
    return invalid(ENEMY_ALREADY_BLOCKED, `Target enemy already blocked: ${targetId}`);
  }
  if (!doesEnemyAttackThisCombat(state, enemy.instanceId)) {
    return invalid(ENEMY_DOES_NOT_ATTACK, `Target enemy does not attack this combat: ${targetId}`);
  }
  return valid();
}

// ============================================================================
// FINALIZE_BLOCK validators
// ============================================================================

/** Must be in combat to finalize block */
export function validateFinalizeBlockInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== FINALIZE_BLOCK_ACTION) return valid();
  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }
  return valid();
}

/** Must be in BLOCK phase */
export function validateFinalizeBlockPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== FINALIZE_BLOCK_ACTION) return valid();
  if (!state.combat) return valid();
  if (state.combat.phase !== COMBAT_PHASE_BLOCK) {
    return invalid(WRONG_COMBAT_PHASE, "Can only finalize block during Block phase");
  }
  return valid();
}

/** Must have declared block target */
export function validateBlockTargetDeclared(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== FINALIZE_BLOCK_ACTION) return valid();
  if (!state.combat) return valid();
  if (!state.combat.declaredBlockTarget) {
    return invalid(NO_BLOCK_TARGET_DECLARED, "No block target declared");
  }
  return valid();
}
