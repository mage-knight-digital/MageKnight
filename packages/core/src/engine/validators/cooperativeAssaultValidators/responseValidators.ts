/**
 * Respond to cooperative proposal validators
 *
 * Validates the response action for cooperative assault proposals.
 * Players can respond to proposals when:
 * - A pending proposal exists
 * - They are an invited player
 * - They have not already responded
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import { RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION } from "@mage-knight/shared";
import {
  NO_PENDING_PROPOSAL,
  NOT_AN_INVITEE,
  ALREADY_RESPONDED,
} from "../validationCodes.js";

/**
 * There must be a pending cooperative assault proposal.
 */
export function validateProposalExists(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION) return valid();

  if (!state.pendingCooperativeAssault) {
    return invalid(
      NO_PENDING_PROPOSAL,
      "There is no pending cooperative assault proposal"
    );
  }

  return valid();
}

/**
 * The responding player must be an invitee.
 */
export function validatePlayerIsInvitee(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION) return valid();

  const proposal = state.pendingCooperativeAssault;
  if (!proposal) return valid(); // Handled by validateProposalExists

  if (!proposal.invitedPlayerIds.includes(playerId)) {
    return invalid(NOT_AN_INVITEE, "You are not invited to this proposal");
  }

  return valid();
}

/**
 * The responding player must not have already responded.
 */
export function validatePlayerNotResponded(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION) return valid();

  const proposal = state.pendingCooperativeAssault;
  if (!proposal) return valid(); // Handled by validateProposalExists

  if (proposal.acceptedPlayerIds.includes(playerId)) {
    return invalid(
      ALREADY_RESPONDED,
      "You have already responded to this proposal"
    );
  }

  return valid();
}
