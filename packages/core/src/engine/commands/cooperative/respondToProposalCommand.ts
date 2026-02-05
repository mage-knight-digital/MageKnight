/**
 * Respond to Cooperative Proposal command
 *
 * When an invited player responds to a cooperative assault proposal,
 * this command updates the proposal state and potentially triggers
 * the assault if all invitees have accepted.
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { CooperativeAssaultProposal, CooperativeResponse, GameEvent } from "@mage-knight/shared";
import {
  COOPERATIVE_RESPONSE_ACCEPT,
  COOPERATIVE_RESPONSE_DECLINE,
  createCooperativeAssaultResponseEvent,
  createCooperativeAssaultAgreedEvent,
  createCooperativeAssaultRejectedEvent,
} from "@mage-knight/shared";
import { RESPOND_TO_COOPERATIVE_PROPOSAL_COMMAND } from "../commandTypes.js";

export { RESPOND_TO_COOPERATIVE_PROPOSAL_COMMAND };

export interface RespondToProposalCommandParams {
  readonly playerId: string;
  readonly response: CooperativeResponse;
}

export function createRespondToProposalCommand(
  params: RespondToProposalCommandParams
): Command {
  return {
    type: RESPOND_TO_COOPERATIVE_PROPOSAL_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Cannot undo response - affects other players' decisions

    execute(state: GameState): CommandResult {
      const proposal = state.pendingCooperativeAssault;
      if (!proposal) {
        throw new Error("No pending cooperative assault proposal");
      }

      const events: GameEvent[] = [
        createCooperativeAssaultResponseEvent(
          params.playerId,
          params.response === COOPERATIVE_RESPONSE_ACCEPT
        ),
      ];

      if (params.response === COOPERATIVE_RESPONSE_DECLINE) {
        // Proposal rejected - clear it
        events.push(
          createCooperativeAssaultRejectedEvent(
            proposal.initiatorId,
            params.playerId
          )
        );

        return {
          state: {
            ...state,
            pendingCooperativeAssault: null,
          },
          events,
        };
      }

      // Player accepted
      const updatedAcceptedIds = [...proposal.acceptedPlayerIds, params.playerId];
      const allAccepted = proposal.invitedPlayerIds.every((id) =>
        updatedAcceptedIds.includes(id)
      );

      if (allAccepted) {
        // All invitees accepted - assault is agreed!
        // Flip Round Order tokens for all participants
        const participantIds = [proposal.initiatorId, ...proposal.invitedPlayerIds];
        const updatedPlayers = state.players.map((player) => {
          if (participantIds.includes(player.id)) {
            return {
              ...player,
              roundOrderTokenFlipped: true,
            };
          }
          return player;
        });

        events.push(
          createCooperativeAssaultAgreedEvent(
            proposal.initiatorId,
            participantIds,
            proposal.targetCity
          )
        );

        // Clear the proposal (combat will be started separately)
        return {
          state: {
            ...state,
            players: updatedPlayers,
            pendingCooperativeAssault: null,
          },
          events,
        };
      }

      // Still waiting for more responses
      const updatedProposal: CooperativeAssaultProposal = {
        ...proposal,
        acceptedPlayerIds: updatedAcceptedIds,
      };

      return {
        state: {
          ...state,
          pendingCooperativeAssault: updatedProposal,
        },
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo RESPOND_TO_COOPERATIVE_PROPOSAL");
    },
  };
}
