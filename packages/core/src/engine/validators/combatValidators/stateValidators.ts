/**
 * Combat state validators
 *
 * Basic validators for combat entry/exit and state checks.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
} from "@mage-knight/shared";
import {
  ALREADY_IN_COMBAT,
  NOT_IN_COMBAT,
  ALREADY_COMBATTED,
} from "../validationCodes.js";

// Must not already be in combat
export function validateNotAlreadyInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ENTER_COMBAT_ACTION) return valid();

  if (state.combat !== null) {
    return invalid(ALREADY_IN_COMBAT, "Already in combat");
  }

  return valid();
}

// Must be in combat
export function validateIsInCombat(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  const combatActions = [
    END_COMBAT_PHASE_ACTION,
    DECLARE_BLOCK_ACTION,
    DECLARE_ATTACK_ACTION,
    ASSIGN_DAMAGE_ACTION,
  ];

  if (!combatActions.includes(action.type as typeof combatActions[number])) {
    return valid();
  }

  if (state.combat === null) {
    return invalid(NOT_IN_COMBAT, "Not in combat");
  }

  return valid();
}

// Can only have one combat per turn
export function validateOneCombatPerTurn(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ENTER_COMBAT_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return valid();

  if (player.hasCombattedThisTurn) {
    return invalid(ALREADY_COMBATTED, "You can only have one combat per turn");
  }

  return valid();
}
