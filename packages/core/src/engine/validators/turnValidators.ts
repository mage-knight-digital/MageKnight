/**
 * Turn and phase validators
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { GAME_PHASE_ROUND } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  ALREADY_ACTED,
  IN_COMBAT,
  MUST_PLAY_OR_DISCARD_CARD,
  NOT_YOUR_TURN,
  PLAYER_NOT_FOUND,
  WRONG_PHASE,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import {
  hasMetMinimumTurnRequirement,
  canTakeActionPhaseAction,
} from "../rules/turnStructure.js";

// Check it's this player's turn
export function validateIsPlayersTurn(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const currentPlayerId = state.turnOrder[state.currentPlayerIndex];
  if (currentPlayerId !== playerId) {
    return invalid(NOT_YOUR_TURN, "It is not your turn");
  }
  return valid();
}

// Check game is in round phase (not setup or end)
export function validateRoundPhase(
  state: GameState,
  _playerId: string,
  _action: PlayerAction
): ValidationResult {
  if (state.phase !== GAME_PHASE_ROUND) {
    return invalid(
      WRONG_PHASE,
      `Cannot perform actions during ${state.phase} phase`
    );
  }
  return valid();
}

// Check not in combat
export function validateNotInCombat(
  state: GameState,
  _playerId: string,
  _action: PlayerAction
): ValidationResult {
  if (state.combat !== null) {
    return invalid(IN_COMBAT, "Cannot perform this action during combat");
  }
  return valid();
}

// Check player hasn't taken their action yet (for actions that consume the action)
export function validateHasNotActed(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!canTakeActionPhaseAction(player)) {
    return invalid(ALREADY_ACTED, "You have already taken an action this turn");
  }
  return valid();
}

// Check minimum turn requirement: must play or discard at least one card from hand
// Per rulebook Minimum Turn S1: "Every turn you must play at least one card from your hand.
// Failing that, you must discard one unplayed card from your hand."
export function validateMinimumTurnRequirement(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!hasMetMinimumTurnRequirement(player)) {
    return invalid(
      MUST_PLAY_OR_DISCARD_CARD,
      "You must play or discard at least one card from your hand before ending your turn"
    );
  }

  return valid();
}
