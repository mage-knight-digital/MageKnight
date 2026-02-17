/**
 * Cumbersome ability validators
 *
 * Validators for the SPEND_MOVE_ON_CUMBERSOME action.
 * Players can spend Move points during the Block phase to reduce
 * the attack of enemies with the Cumbersome ability.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import { SPEND_MOVE_ON_CUMBERSOME_ACTION } from "@mage-knight/shared";
import { COMBAT_PHASE_BLOCK } from "../../../types/combat.js";
import {
  NOT_IN_COMBAT,
  WRONG_COMBAT_PHASE,
  ENEMY_NOT_FOUND,
  NOT_ENOUGH_MOVE_POINTS,
  CUMBERSOME_NOT_ACTIVE,
  CUMBERSOME_INVALID_AMOUNT,
  WRONG_BLOCK_TARGET,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";
import { isCumbersomeActive } from "../../combat/cumbersomeHelpers.js";

/**
 * Validate that spend move on cumbersome action is during combat
 */
export function validateSpendCumbersomeInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== SPEND_MOVE_ON_CUMBERSOME_ACTION) return valid();

  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }

  return valid();
}

/**
 * Validate that spend move on cumbersome action is in Block phase
 */
export function validateSpendCumbersomePhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== SPEND_MOVE_ON_CUMBERSOME_ACTION) return valid();

  if (state.combat?.phase !== COMBAT_PHASE_BLOCK) {
    return invalid(
      WRONG_COMBAT_PHASE,
      "Can only spend move points on Cumbersome enemies during Block phase"
    );
  }

  return valid();
}

/**
 * Validate that the target enemy exists and has active Cumbersome ability.
 * When a block target is declared, cumbersome can only be spent on that target.
 */
export function validateCumbersomeEnemy(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== SPEND_MOVE_ON_CUMBERSOME_ACTION) return valid();

  // Scope constraint: if a block target is declared, must match
  if (state.combat?.declaredBlockTarget && action.enemyInstanceId !== state.combat.declaredBlockTarget) {
    return invalid(WRONG_BLOCK_TARGET, "Can only spend move on cumbersome for declared block target");
  }

  const enemy = state.combat?.enemies.find(
    (e) => e.instanceId === action.enemyInstanceId
  );

  if (!enemy) {
    return invalid(ENEMY_NOT_FOUND, "Target enemy not found");
  }

  if (!isCumbersomeActive(state, playerId, enemy)) {
    return invalid(
      CUMBERSOME_NOT_ACTIVE,
      "Target enemy does not have active Cumbersome ability"
    );
  }

  return valid();
}

/**
 * Validate that player has enough move points to spend
 */
export function validateHasMovePointsForCumbersome(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== SPEND_MOVE_ON_CUMBERSOME_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return valid();

  if (action.movePointsToSpend <= 0) {
    return invalid(
      CUMBERSOME_INVALID_AMOUNT,
      "Must spend at least 1 move point"
    );
  }

  if (action.movePointsToSpend > player.movePoints) {
    return invalid(
      NOT_ENOUGH_MOVE_POINTS,
      `Insufficient move points: need ${action.movePointsToSpend}, have ${player.movePoints}`
    );
  }

  return valid();
}
