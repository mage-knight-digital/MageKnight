/**
 * Combat target validators
 *
 * Validators for enemy targeting in combat actions.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
} from "@mage-knight/shared";
import {
  ENEMY_NOT_FOUND,
  ENEMY_ALREADY_BLOCKED,
  ENEMY_ALREADY_DEFEATED,
} from "../validationCodes.js";

// Target enemy must exist and not be defeated (for block)
export function validateBlockTargetEnemy(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_BLOCK_ACTION) return valid();

  const enemy = state.combat?.enemies.find(
    (e) => e.instanceId === action.targetEnemyInstanceId
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

// Target enemy must exist and not be blocked/defeated (for assign damage)
export function validateAssignDamageTargetEnemy(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_DAMAGE_ACTION) return valid();

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
    return invalid(ENEMY_ALREADY_BLOCKED, "Enemy is blocked, no damage to assign");
  }

  return valid();
}

// Attack targets must exist and not be defeated
export function validateAttackTargets(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== DECLARE_ATTACK_ACTION) return valid();

  for (const targetId of action.targetEnemyInstanceIds) {
    const enemy = state.combat?.enemies.find((e) => e.instanceId === targetId);

    if (!enemy) {
      return invalid(ENEMY_NOT_FOUND, `Target enemy not found: ${targetId}`);
    }

    if (enemy.isDefeated) {
      return invalid(
        ENEMY_ALREADY_DEFEATED,
        `Target enemy is already defeated: ${enemy.definition.name}`
      );
    }
  }

  return valid();
}
