/**
 * Validators for choice resolution actions
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { RESOLVE_CHOICE_ACTION } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  PLAYER_NOT_FOUND,
  NO_PENDING_CHOICE,
  INVALID_CHOICE_INDEX,
  CHOICE_PENDING,
  TACTIC_DECISION_PENDING,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import {
  doesPendingTacticDecisionBlockActions,
  isPendingTacticDecisionStillValid,
} from "../rules/tactics.js";

/**
 * Validates that the player has a pending choice to resolve.
 */
export function validateHasPendingChoice(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingChoice) {
    return invalid(NO_PENDING_CHOICE, "No choice pending");
  }

  return valid();
}

/**
 * Validates that the choice index is valid for the pending choice.
 */
export function validateChoiceIndex(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RESOLVE_CHOICE_ACTION || !("choiceIndex" in action)) {
    return invalid(INVALID_CHOICE_INDEX, "Invalid resolve choice action");
  }

  const player = getPlayerById(state, playerId);
  if (!player?.pendingChoice) {
    return invalid(NO_PENDING_CHOICE, "No choice pending");
  }

  const index = action.choiceIndex;
  const maxIndex = player.pendingChoice.options.length - 1;

  if (index < 0 || index > maxIndex) {
    return invalid(
      INVALID_CHOICE_INDEX,
      `Choice index must be 0-${maxIndex}`
    );
  }

  return valid();
}

/**
 * Validates that the player does NOT have a pending choice.
 * Used to block other actions while a choice is pending.
 */
export function validateNoChoicePending(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = getPlayerById(state, playerId);
  if (player?.pendingChoice) {
    return invalid(CHOICE_PENDING, "Must resolve pending choice first");
  }
  return valid();
}

/**
 * Validates that the player does NOT have any pending tactic decision.
 * Used to block END_TURN when any tactic decision needs resolution.
 */
export function validateNoTacticDecisionPending(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = getPlayerById(state, playerId);
  if (player?.pendingTacticDecision && isPendingTacticDecisionStillValid(state, player)) {
    return invalid(TACTIC_DECISION_PENDING, "Must resolve pending tactic decision first");
  }
  return valid();
}

/**
 * Validates that the player does NOT have a blocking pending tactic decision.
 * Used to block normal actions while a "before turn" tactic decision (e.g., Sparing Power) is pending.
 *
 * Note: Not all tactic decisions block normal actions. For example, Mana Steal and Rethink
 * decisions occur during the tactics phase, not during normal turns.
 */
export function validateNoBlockingTacticDecisionPending(
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return valid();
  }

  // Only block if this is a "before turn" tactic decision that gates other actions
  if (doesPendingTacticDecisionBlockActions(player)) {
    return invalid(TACTIC_DECISION_PENDING, "Must resolve pending tactic decision first");
  }

  return valid();
}
