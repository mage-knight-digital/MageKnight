/**
 * Validator registry and runner
 *
 * This module provides the main entry point for action validation.
 * The validator registry is organized into domain-specific modules
 * in the registry/ subdirectory.
 */

import type { ValidationResult, Validator } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { valid } from "./types.js";
import { validatorRegistry } from "./registry/index.js";

// TODO: RULES LIMITATION - Immediate Choice Resolution
// =====================================================
// Current behavior: Players must resolve card choices (e.g., "Attack 2 OR Block 2")
// immediately before playing more cards or taking other actions.
//
// Actual Mage Knight rules: Players can stack multiple cards with unresolved choices,
// then decide when applying effects to combat. Example:
//   1. Play Rage (Attack OR Block - don't choose yet)
//   2. Play March (Move 2)
//   3. Play another card
//   4. Enter combat
//   5. NOW decide what Rage provides based on combat situation
//
// To fix this properly:
//   1. Change pendingChoice to pendingChoices: PendingChoice[] (array)
//   2. Remove validateNoChoicePending from PLAY_CARD_ACTION
//   3. Keep it on END_TURN, EXPLORE (must resolve before irreversible actions)
//   4. Add combat phase resolution that prompts for all pending choices
//   5. Update UI to show multiple pending choices
//
// For now, we force immediate resolution as a simplification.
// =====================================================

// Re-export types
export * from "./types.js";

/**
 * Run all validators for an action type.
 *
 * Validators run in sequence - if any validator fails, the action is
 * rejected with that validator's error code and message.
 *
 * @param state - Current game state
 * @param playerId - ID of the player attempting the action
 * @param action - The action to validate
 * @returns ValidationResult indicating success or failure with error details
 */
export function validateAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const validators = validatorRegistry[action.type];

  if (!validators) {
    // Unknown action type - could be not implemented yet
    return valid(); // Or return invalid if you want strict checking
  }

  for (const validator of validators) {
    const result = validator(state, playerId, action);
    if (!result.valid) {
      return result;
    }
  }

  return valid();
}

/**
 * Get validators for a specific action type.
 *
 * Useful for testing and introspection.
 *
 * @param actionType - The action type to get validators for
 * @returns Array of validators for the action type, or empty array if not found
 */
export function getValidatorsForAction(actionType: string): Validator[] {
  return validatorRegistry[actionType] ?? [];
}
