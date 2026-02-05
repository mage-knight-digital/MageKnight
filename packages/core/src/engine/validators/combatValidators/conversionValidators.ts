/**
 * Move-to-attack conversion validators
 *
 * Validators for the CONVERT_MOVE_TO_ATTACK action.
 * Players can spend Move points during combat to gain attack
 * when the Agility move-to-attack conversion modifier is active.
 *
 * Basic Agility: 1 move = 1 melee attack (ATTACK phase)
 * Powered Agility: 1 move = 1 melee attack OR 2 move = 1 ranged attack
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  CONVERT_MOVE_TO_ATTACK_ACTION,
  CONVERSION_TYPE_RANGED,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
} from "../../../types/combat.js";
import {
  NOT_IN_COMBAT,
  WRONG_COMBAT_PHASE,
  NOT_ENOUGH_MOVE_POINTS,
  NO_CONVERSION_MODIFIER,
  CONVERSION_INVALID_AMOUNT,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";
import { getModifiersForPlayer } from "../../modifiers/index.js";
import { EFFECT_MOVE_TO_ATTACK_CONVERSION, COMBAT_VALUE_RANGED } from "../../../types/modifierConstants.js";
import type { MoveToAttackConversionModifier } from "../../../types/modifiers.js";

/**
 * Validate that conversion action is during combat.
 */
export function validateConversionInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CONVERT_MOVE_TO_ATTACK_ACTION) return valid();

  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }

  return valid();
}

/**
 * Validate that conversion action is in a valid combat phase.
 * Melee conversion: ATTACK phase only.
 * Ranged conversion: RANGED_SIEGE phase only.
 */
export function validateConversionPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CONVERT_MOVE_TO_ATTACK_ACTION) return valid();

  const phase = state.combat?.phase;
  if (action.conversionType === CONVERSION_TYPE_RANGED) {
    if (phase !== COMBAT_PHASE_RANGED_SIEGE) {
      return invalid(
        WRONG_COMBAT_PHASE,
        "Ranged conversion is only available during Ranged/Siege phase"
      );
    }
  } else {
    if (phase !== COMBAT_PHASE_ATTACK) {
      return invalid(
        WRONG_COMBAT_PHASE,
        "Melee conversion is only available during Attack phase"
      );
    }
  }

  return valid();
}

/**
 * Validate that an active move-to-attack conversion modifier exists
 * matching the requested conversion type.
 */
export function validateConversionModifierActive(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CONVERT_MOVE_TO_ATTACK_ACTION) return valid();

  const modifiers = getModifiersForPlayer(state, playerId);
  const hasMatchingModifier = modifiers.some((m) => {
    if (m.effect.type !== EFFECT_MOVE_TO_ATTACK_CONVERSION) return false;
    const effect = m.effect as MoveToAttackConversionModifier;
    if (action.conversionType === CONVERSION_TYPE_RANGED) {
      return effect.attackType === COMBAT_VALUE_RANGED;
    }
    return effect.attackType !== COMBAT_VALUE_RANGED;
  });

  if (!hasMatchingModifier) {
    return invalid(
      NO_CONVERSION_MODIFIER,
      "No active move-to-attack conversion modifier for this type"
    );
  }

  return valid();
}

/**
 * Validate that the move points to spend is a valid amount
 * (positive and divisible by the cost per point).
 */
export function validateConversionAmount(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CONVERT_MOVE_TO_ATTACK_ACTION) return valid();

  if (action.movePointsToSpend <= 0) {
    return invalid(
      CONVERSION_INVALID_AMOUNT,
      "Must spend at least 1 move point"
    );
  }

  // Find the matching modifier to check cost divisibility
  const modifiers = getModifiersForPlayer(state, playerId);
  const modifier = modifiers.find((m) => {
    if (m.effect.type !== EFFECT_MOVE_TO_ATTACK_CONVERSION) return false;
    const effect = m.effect as MoveToAttackConversionModifier;
    if (action.conversionType === CONVERSION_TYPE_RANGED) {
      return effect.attackType === COMBAT_VALUE_RANGED;
    }
    return effect.attackType !== COMBAT_VALUE_RANGED;
  });

  if (modifier) {
    const effect = modifier.effect as MoveToAttackConversionModifier;
    if (action.movePointsToSpend % effect.costPerPoint !== 0) {
      return invalid(
        CONVERSION_INVALID_AMOUNT,
        `Move points must be divisible by ${effect.costPerPoint}`
      );
    }
  }

  return valid();
}

/**
 * Validate that the player has enough move points.
 */
export function validateConversionMovePoints(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CONVERT_MOVE_TO_ATTACK_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return valid();

  if (action.movePointsToSpend > player.movePoints) {
    return invalid(
      NOT_ENOUGH_MOVE_POINTS,
      `Insufficient move points: need ${action.movePointsToSpend}, have ${player.movePoints}`
    );
  }

  return valid();
}
