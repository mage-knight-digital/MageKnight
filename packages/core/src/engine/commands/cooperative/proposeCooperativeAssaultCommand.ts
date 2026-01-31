/**
 * Propose Cooperative Assault command
 *
 * When a player proposes a cooperative assault on a city, this command
 * creates the pending proposal and emits the appropriate event.
 * The proposal includes enemy distribution among participants.
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { CityColor, EnemyDistribution, CooperativeAssaultProposal } from "@mage-knight/shared";
import { createCooperativeAssaultProposedEvent } from "@mage-knight/shared";
import { PROPOSE_COOPERATIVE_ASSAULT_COMMAND } from "../commandTypes.js";

export { PROPOSE_COOPERATIVE_ASSAULT_COMMAND };

export interface ProposeCooperativeAssaultCommandParams {
  readonly playerId: string;
  readonly targetCity: CityColor;
  readonly invitedPlayerIds: readonly string[];
  readonly distribution: readonly EnemyDistribution[];
}

export function createProposeCooperativeAssaultCommand(
  params: ProposeCooperativeAssaultCommandParams
): Command {
  // Store previous state for undo
  let previousProposal: CooperativeAssaultProposal | null = null;

  return {
    type: PROPOSE_COOPERATIVE_ASSAULT_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Can cancel proposal

    execute(state: GameState): CommandResult {
      // Store for undo
      previousProposal = state.pendingCooperativeAssault;

      // Create the proposal
      const proposal: CooperativeAssaultProposal = {
        initiatorId: params.playerId,
        targetCity: params.targetCity,
        invitedPlayerIds: params.invitedPlayerIds,
        distribution: params.distribution,
        acceptedPlayerIds: [], // No one has accepted yet
      };

      return {
        state: {
          ...state,
          pendingCooperativeAssault: proposal,
        },
        events: [
          createCooperativeAssaultProposedEvent(
            params.playerId,
            params.targetCity,
            params.invitedPlayerIds,
            params.distribution
          ),
        ],
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
