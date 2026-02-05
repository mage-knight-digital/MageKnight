/**
 * Thugs Damage Influence Validators
 *
 * Validators for the PAY_THUGS_DAMAGE_INFLUENCE_ACTION.
 * Per rulebook: Thugs units cannot have damage assigned to them unless
 * 2 Influence is paid per-unit, per-combat.
 *
 * @module validators/combatValidators/thugsDamageValidators
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
  UNIT_THUGS,
} from "@mage-knight/shared";
import {
  NOT_IN_COMBAT,
  PLAYER_NOT_FOUND,
  UNIT_NOT_FOUND,
  INSUFFICIENT_INFLUENCE,
  THUGS_DAMAGE_INFLUENCE_ALREADY_PAID,
  THUGS_DAMAGE_NOT_THUGS_UNIT,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";
import { THUGS_DAMAGE_INFLUENCE_COST } from "../../commands/combat/payThugsDamageInfluenceCommand.js";

/**
 * Validate player is in combat for Thugs damage payment.
 */
export function validateThugsDamagePaymentInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PAY_THUGS_DAMAGE_INFLUENCE_ACTION) return valid();

  if (!state.combat) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }

  return valid();
}

/**
 * Validate the unit exists and is a Thugs unit.
 */
export function validateThugsDamageUnitIsThugs(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PAY_THUGS_DAMAGE_INFLUENCE_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const unit = player.units.find(
    (u) => u.instanceId === action.unitInstanceId
  );
  if (!unit) {
    return invalid(UNIT_NOT_FOUND, `Unit ${action.unitInstanceId} not found`);
  }

  if (unit.unitId !== UNIT_THUGS) {
    return invalid(
      THUGS_DAMAGE_NOT_THUGS_UNIT,
      "Only Thugs units require damage influence payment"
    );
  }

  return valid();
}

/**
 * Validate influence has not already been paid for this unit this combat.
 */
export function validateThugsDamageInfluenceNotAlreadyPaid(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PAY_THUGS_DAMAGE_INFLUENCE_ACTION) return valid();
  if (!state.combat) return valid(); // Other validator handles

  if (state.combat.paidThugsDamageInfluence[action.unitInstanceId]) {
    return invalid(
      THUGS_DAMAGE_INFLUENCE_ALREADY_PAID,
      "Thugs damage influence has already been paid for this unit"
    );
  }

  return valid();
}

/**
 * Validate player has enough influence to pay for Thugs damage.
 */
export function validateThugsDamageInfluenceAvailable(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PAY_THUGS_DAMAGE_INFLUENCE_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (player.influencePoints < THUGS_DAMAGE_INFLUENCE_COST) {
    return invalid(
      INSUFFICIENT_INFLUENCE,
      `Insufficient influence (need ${THUGS_DAMAGE_INFLUENCE_COST}, have ${player.influencePoints})`
    );
  }

  return valid();
}
