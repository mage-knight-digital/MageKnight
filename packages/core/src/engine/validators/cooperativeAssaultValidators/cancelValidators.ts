/**
 * Cancel cooperative proposal validators
 *
 * Validates the cancel action for cooperative assault proposals.
 * Only the initiator can cancel a proposal:
 * - A pending proposal must exist
 * - The cancelling player must be the initiator
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import { CANCEL_COOPERATIVE_PROPOSAL_ACTION } from "@mage-knight/shared";
import {
  NO_PENDING_PROPOSAL,
  NOT_PROPOSAL_INITIATOR,
} from "../validationCodes.js";

/**
 * There must be a pending proposal to cancel.
 */
export function validateProposalExistsForCancel(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CANCEL_COOPERATIVE_PROPOSAL_ACTION) return valid();

  if (!state.pendingCooperativeAssault) {
    return invalid(
      NO_PENDING_PROPOSAL,
      "There is no pending cooperative assault proposal to cancel"
    );
  }

  return valid();
}

/**
 * The cancelling player must be the initiator.
 */
export function validatePlayerIsInitiator(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== CANCEL_COOPERATIVE_PROPOSAL_ACTION) return valid();

  const proposal = state.pendingCooperativeAssault;
  if (!proposal) return valid(); // Handled by validateProposalExistsForCancel

  if (proposal.initiatorId !== playerId) {
    return invalid(
      NOT_PROPOSAL_INITIATOR,
      "Only the initiator can cancel the proposal"
    );
  }

  return valid();
}
