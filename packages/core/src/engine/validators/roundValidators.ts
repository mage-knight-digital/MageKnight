/**
 * Round end announcement validators
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import { ANNOUNCE_END_OF_ROUND_ACTION, END_TURN_ACTION } from "@mage-knight/shared";
import {
  PLAYER_NOT_FOUND,
  DECK_NOT_EMPTY,
  ALREADY_ANNOUNCED,
  MUST_ANNOUNCE_END_OF_ROUND,
} from "./validationCodes.js";

/**
 * Player must have empty deck to announce end of round.
 * This is a key Mage Knight rule - you can only announce when you've
 * exhausted your deck.
 */
export function validateDeckEmpty(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ANNOUNCE_END_OF_ROUND_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.deck.length > 0) {
    return invalid(
      DECK_NOT_EMPTY,
      "You can only announce end of round when your deck is empty"
    );
  }

  return valid();
}

/**
 * Round end must not have already been announced.
 */
export function validateRoundEndNotAnnounced(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== ANNOUNCE_END_OF_ROUND_ACTION) return valid();

  if (state.endOfRoundAnnouncedBy !== null) {
    return invalid(
      ALREADY_ANNOUNCED,
      "End of round has already been announced"
    );
  }

  return valid();
}

/**
 * If deck AND hand are empty, player MUST announce end of round.
 * This validator applies to actions OTHER than announcing or ending turn.
 */
export function validateMustAnnounceEndOfRound(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  // This validator only applies to actions OTHER than announcing or ending turn
  if (action.type === ANNOUNCE_END_OF_ROUND_ACTION) return valid();
  if (action.type === END_TURN_ACTION) return valid();

  // Skip if round end already announced
  if (state.endOfRoundAnnouncedBy !== null) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  // If deck AND hand are both empty, must announce
  if (player.deck.length === 0 && player.hand.length === 0) {
    return invalid(
      MUST_ANNOUNCE_END_OF_ROUND,
      "You must announce end of round when your deck and hand are both empty"
    );
  }

  return valid();
}
