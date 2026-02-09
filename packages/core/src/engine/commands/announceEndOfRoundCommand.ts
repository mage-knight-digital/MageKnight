/**
 * Announce End of Round command
 *
 * When a player's deck is empty, they can announce the end of the round.
 * All other players get one final turn, then the round ends.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import { ANNOUNCE_END_OF_ROUND_COMMAND } from "./commandTypes.js";
import { createEndTurnCommand } from "./endTurn/index.js";
import { applyRoundAnnouncement } from "./roundAnnouncement.js";

export { ANNOUNCE_END_OF_ROUND_COMMAND };

export interface AnnounceEndOfRoundCommandParams {
  readonly playerId: string;
}

export function createAnnounceEndOfRoundCommand(
  params: AnnounceEndOfRoundCommandParams
): Command {
  return {
    type: ANNOUNCE_END_OF_ROUND_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Cannot undo announcing end of round

    execute(state: GameState): CommandResult {
      const announcement = applyRoundAnnouncement(state, params.playerId);
      const endTurnResult = createEndTurnCommand({
        playerId: params.playerId,
        skipAutoAnnounce: true,
      }).execute(announcement.state);

      return {
        state: endTurnResult.state,
        events: [announcement.event, ...endTurnResult.events],
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo ANNOUNCE_END_OF_ROUND");
    },
  };
}
