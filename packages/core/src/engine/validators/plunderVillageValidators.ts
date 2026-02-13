/**
 * Plunder village validators
 *
 * Validators for the plunder village action.
 * With the lifecycle-based approach, plundering is only available when
 * pendingPlunderDecision is true (set at turn start by turnAdvancement).
 */

import type { ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { PLUNDER_VILLAGE_ACTION, DECLINE_PLUNDER_ACTION } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import { PLUNDER_NOT_AVAILABLE } from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";

/**
 * Must have a pending plunder decision (lifecycle-guaranteed at turn start)
 */
export function validatePendingPlunderDecision(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLUNDER_VILLAGE_ACTION && action.type !== DECLINE_PLUNDER_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) return valid();

  if (!player.pendingPlunderDecision) {
    return invalid(
      PLUNDER_NOT_AVAILABLE,
      "Plundering is only available at the start of your turn when on a village"
    );
  }

  return valid();
}
