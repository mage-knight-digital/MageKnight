/**
 * Influence-to-block conversion validators
 *
 * Validators for the CONVERT_INFLUENCE_TO_BLOCK action.
 * Players can spend Influence points during combat to gain block
 * when the Diplomacy influence-to-block conversion modifier is active.
 *
 * Basic Diplomacy: 1 influence = 1 physical block (BLOCK phase)
 * Powered Diplomacy: 1 influence = 1 ice or 1 fire block (BLOCK phase)
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import { CONVERT_INFLUENCE_TO_BLOCK_ACTION } from "@mage-knight/shared";
import { COMBAT_PHASE_BLOCK } from "../../../types/combat.js";
import {
  NOT_IN_COMBAT,
  WRONG_COMBAT_PHASE,
  INSUFFICIENT_INFLUENCE,
  NO_CONVERSION_MODIFIER,
  CONVERSION_INVALID_AMOUNT,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";
import { getModifiersForPlayer } from "../../modifiers/index.js";
import { EFFECT_INFLUENCE_TO_BLOCK_CONVERSION } from "../../../types/modifierConstants.js";

/**
 * Validate that conversion action is during combat.
 */
export function validateInfluenceConversionInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CONVERT_INFLUENCE_TO_BLOCK_ACTION) return valid();

  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }

  return valid();
}

/**
 * Validate that conversion action is in BLOCK phase.
 */
export function validateInfluenceConversionPhase(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CONVERT_INFLUENCE_TO_BLOCK_ACTION) return valid();

  const phase = state.combat?.phase;
  if (phase !== COMBAT_PHASE_BLOCK) {
    return invalid(
      WRONG_COMBAT_PHASE,
      "Influence-to-block conversion is only available during Block phase"
    );
  }

  return valid();
}

/**
 * Validate that an active influence-to-block conversion modifier exists.
 */
export function validateInfluenceConversionModifierActive(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CONVERT_INFLUENCE_TO_BLOCK_ACTION) return valid();

  const modifiers = getModifiersForPlayer(state, playerId);
  const hasModifier = modifiers.some(
    (m) => m.effect.type === EFFECT_INFLUENCE_TO_BLOCK_CONVERSION
  );

  if (!hasModifier) {
    return invalid(
      NO_CONVERSION_MODIFIER,
      "No active influence-to-block conversion modifier"
    );
  }

  return valid();
}

/**
 * Validate that the influence points to spend is a valid amount (positive).
 */
export function validateInfluenceConversionAmount(
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CONVERT_INFLUENCE_TO_BLOCK_ACTION) return valid();

  if (action.influencePointsToSpend <= 0) {
    return invalid(
      CONVERSION_INVALID_AMOUNT,
      "Must spend at least 1 influence point"
    );
  }

  return valid();
}

/**
 * Validate that the player has enough influence points.
 */
export function validateInfluenceConversionInfluencePoints(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CONVERT_INFLUENCE_TO_BLOCK_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return valid();

  if (action.influencePointsToSpend > player.influencePoints) {
    return invalid(
      INSUFFICIENT_INFLUENCE,
      `Insufficient influence: need ${action.influencePointsToSpend}, have ${player.influencePoints}`
    );
  }

  return valid();
}
