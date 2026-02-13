/**
 * Wound lockout validators.
 *
 * When a player's hand is all wounds and they have no escape hatch skills,
 * only rest (slow recovery), end turn, announce end of round, undo, and
 * skills are allowed. This validator rejects all other actions.
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  END_TURN_ACTION,
  ANNOUNCE_END_OF_ROUND_ACTION,
  DECLARE_REST_ACTION,
  COMPLETE_REST_ACTION,
  USE_SKILL_ACTION,
  UNDO_ACTION,
} from "@mage-knight/shared";
import { MUST_SLOW_RECOVER } from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { PLAYER_NOT_FOUND } from "./validationCodes.js";
import { isLockedIntoSlowRecovery } from "../rules/woundLockout.js";

/**
 * Validate that the player is not locked into slow recovery.
 *
 * Passes through for exempt actions (rest, end turn, announce, undo, skills).
 * Also passes through if the player is already resting (let them finish).
 */
export function validateNotLockedIntoSlowRecovery(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  // Exempt actions — always allowed even when locked out
  if (action.type === END_TURN_ACTION) return valid();
  if (action.type === ANNOUNCE_END_OF_ROUND_ACTION) return valid();
  if (action.type === DECLARE_REST_ACTION) return valid();
  if (action.type === COMPLETE_REST_ACTION) return valid();
  if (action.type === USE_SKILL_ACTION) return valid();
  if (action.type === UNDO_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  // If already resting, let them continue
  if (player.isResting) return valid();

  if (isLockedIntoSlowRecovery(state, player)) {
    return invalid(
      MUST_SLOW_RECOVER,
      "Hand is all wounds with no card-drawing skills — must rest (slow recovery) or end turn"
    );
  }

  return valid();
}
