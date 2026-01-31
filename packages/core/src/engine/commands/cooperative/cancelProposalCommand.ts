/**
 * Cancel Cooperative Proposal command
 *
 * Allows the initiator to cancel a pending cooperative assault proposal.
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { CooperativeAssaultProposal } from "@mage-knight/shared";
import { createCooperativeAssaultCancelledEvent } from "@mage-knight/shared";
import { CANCEL_COOPERATIVE_PROPOSAL_COMMAND } from "../commandTypes.js";

export { CANCEL_COOPERATIVE_PROPOSAL_COMMAND };

export interface CancelProposalCommandParams {
  readonly playerId: string;
}

export function createCancelProposalCommand(
  params: CancelProposalCommandParams
): Command {
  // Store previous state for undo
  let previousProposal: CooperativeAssaultProposal | null = null;

  return {
    type: CANCEL_COOPERATIVE_PROPOSAL_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Can undo cancel

    execute(state: GameState): CommandResult {
      const proposal = state.pendingCooperativeAssault;
      if (!proposal) {
        throw new Error("No pending cooperative assault proposal to cancel");
      }

      // Store for undo
      previousProposal = proposal;

      return {
        state: {
          ...state,
          pendingCooperativeAssault: null,
        },
        events: [createCooperativeAssaultCancelledEvent(params.playerId)],
      };
    },

    undo(state: GameState): CommandResult {
      return {
        state: {
          ...state,
          pendingCooperativeAssault: previousProposal,
        },
        events: [],
      };
    },
  };
}
