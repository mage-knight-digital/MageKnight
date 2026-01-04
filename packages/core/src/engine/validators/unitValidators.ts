/**
 * Unit-related validators
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  RECRUIT_UNIT_ACTION,
  ACTIVATE_UNIT_ACTION,
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_TARGET_UNIT,
  getUnit,
  UNIT_STATE_READY,
} from "@mage-knight/shared";
import {
  NO_COMMAND_SLOTS,
  INSUFFICIENT_INFLUENCE,
  PLAYER_NOT_FOUND,
  UNIT_NOT_FOUND,
  UNIT_NOT_READY,
  UNIT_IS_WOUNDED,
  UNIT_WOUNDED_NO_DAMAGE,
  UNIT_USED_RESISTANCE,
} from "./validationCodes.js";

/**
 * Check player has enough command slots to recruit
 */
export function validateCommandSlots(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.units.length >= player.commandTokens) {
    return invalid(
      NO_COMMAND_SLOTS,
      `No command slots available (${player.units.length}/${player.commandTokens})`
    );
  }

  return valid();
}

/**
 * Check influence cost is met
 */
export function validateInfluenceCost(
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  const unitDef = getUnit(action.unitId);
  if (action.influenceSpent < unitDef.influence) {
    return invalid(
      INSUFFICIENT_INFLUENCE,
      `Unit costs ${unitDef.influence} influence, only ${action.influenceSpent} provided`
    );
  }

  return valid();
}

/**
 * Check unit exists and belongs to player
 */
export function validateUnitExists(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ACTIVATE_UNIT_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const unit = player.units.find((u) => u.instanceId === action.unitInstanceId);
  if (!unit) {
    return invalid(UNIT_NOT_FOUND, "Unit not found");
  }

  return valid();
}

/**
 * Check unit can be activated (ready and not wounded)
 */
export function validateUnitCanActivate(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ACTIVATE_UNIT_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const unit = player.units.find((u) => u.instanceId === action.unitInstanceId);
  if (!unit) return invalid(UNIT_NOT_FOUND, "Unit not found");

  if (unit.state !== UNIT_STATE_READY) {
    return invalid(UNIT_NOT_READY, "Unit is not ready");
  }

  if (unit.wounded) {
    return invalid(UNIT_IS_WOUNDED, "Wounded units cannot be activated");
  }

  return valid();
}

/**
 * Validate unit can receive damage (not wounded, not used resistance this combat)
 *
 * Per rulebook: wounded units cannot absorb additional damage, and units that
 * absorbed damage via resistance cannot absorb again until the next round.
 */
export function validateUnitCanReceiveDamage(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ASSIGN_DAMAGE_ACTION) return valid();

  // If no assignments provided, all damage goes to hero (no unit validation needed)
  if (!action.assignments) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  for (const assignment of action.assignments) {
    if (assignment.target !== DAMAGE_TARGET_UNIT) continue;

    const unit = player.units.find(
      (u) => u.instanceId === assignment.unitInstanceId
    );
    if (!unit) {
      return invalid(
        UNIT_NOT_FOUND,
        `Unit ${assignment.unitInstanceId} not found`
      );
    }

    if (unit.wounded) {
      return invalid(
        UNIT_WOUNDED_NO_DAMAGE,
        "Cannot assign damage to a wounded unit"
      );
    }

    if (unit.usedResistanceThisCombat) {
      return invalid(
        UNIT_USED_RESISTANCE,
        "Cannot assign damage to a unit that already absorbed damage this combat"
      );
    }
  }

  return valid();
}
