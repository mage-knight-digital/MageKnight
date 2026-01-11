/**
 * Activate Tactic command - handles activating a flip-to-use tactic
 *
 * This command handles activated tactics like:
 * - The Right Moment (Day 6): Take another turn immediately after this one
 * - Long Night (Night 2): Shuffle discard, put 3 cards in deck
 * - Midnight Meditation (Night 4): Shuffle cards into deck, draw same amount
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, TacticId } from "@mage-knight/shared";
import {
  INVALID_ACTION,
  TACTIC_ACTIVATED,
  TACTIC_THE_RIGHT_MOMENT,
} from "@mage-knight/shared";
import { ACTIVATE_TACTIC_COMMAND } from "./commandTypes.js";

export { ACTIVATE_TACTIC_COMMAND };

export interface ActivateTacticCommandArgs {
  readonly playerId: string;
  readonly tacticId: TacticId;
}

/**
 * Validate tactic activation
 */
function validateActivation(
  state: GameState,
  playerId: string,
  tacticId: TacticId
): string | null {
  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    return "Player not found";
  }

  // Must have the tactic selected
  if (player.selectedTactic !== tacticId) {
    return `Tactic ${tacticId} is not your selected tactic`;
  }

  // Must not have already flipped the tactic
  if (player.tacticFlipped) {
    return "Tactic has already been used";
  }

  // Tactic-specific validation
  if (tacticId === TACTIC_THE_RIGHT_MOMENT) {
    // Can't use on last turn of round
    if (state.endOfRoundAnnouncedBy !== null || state.scenarioEndTriggered) {
      return "Cannot use The Right Moment on the last turn of the round";
    }
  }

  return null;
}

export function createActivateTacticCommand(
  args: ActivateTacticCommandArgs
): Command {
  const { playerId, tacticId } = args;

  return {
    type: ACTIVATE_TACTIC_COMMAND,
    playerId,
    isReversible: false, // Cannot undo tactic activation (it affects future turns)

    execute(state: GameState): CommandResult {
      const events: GameEvent[] = [];

      // Validate
      const error = validateActivation(state, playerId, tacticId);
      if (error) {
        events.push({
          type: INVALID_ACTION,
          playerId,
          actionType: ACTIVATE_TACTIC_COMMAND,
          reason: error,
        });
        return { state, events };
      }

      // Find the player
      const player = state.players.find(p => p.id === playerId);
      if (!player) {
        return { state, events };
      }

      // Apply tactic-specific effects
      let updatedState = state;

      if (tacticId === TACTIC_THE_RIGHT_MOMENT) {
        // The Right Moment: Queue extra turn
        const updatedPlayers = state.players.map(p =>
          p.id === playerId
            ? {
                ...p,
                tacticFlipped: true,
                tacticState: {
                  ...p.tacticState,
                  extraTurnPending: true,
                },
              }
            : p
        );

        updatedState = {
          ...state,
          players: updatedPlayers,
        };
      }

      // Emit activation event
      events.push({
        type: TACTIC_ACTIVATED,
        playerId,
        tacticId,
      });

      return { state: updatedState, events };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo ACTIVATE_TACTIC");
    },
  };
}
