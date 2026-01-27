/**
 * Debug Trigger Level Up Command
 *
 * Immediately processes pending level ups without ending the turn.
 * This is a debug-only command for quickly testing level up functionality.
 *
 * Uses RNG for skill drawing on even levels, so this is NOT reversible.
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import { processLevelUps } from "../endTurn/levelUp.js";

export const DEBUG_TRIGGER_LEVEL_UP_COMMAND = "DEBUG_TRIGGER_LEVEL_UP" as const;

export interface DebugTriggerLevelUpCommandParams {
  readonly playerId: string;
}

export function createDebugTriggerLevelUpCommand(
  params: DebugTriggerLevelUpCommandParams
): Command {
  const { playerId } = params;

  return {
    type: DEBUG_TRIGGER_LEVEL_UP_COMMAND,
    playerId,
    isReversible: false, // Uses RNG for skill drawing

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      const player = state.players[playerIndex];

      if (playerIndex === -1 || !player) {
        return { state, events: [] };
      }

      // No pending level ups? Nothing to do
      if (player.pendingLevelUps.length === 0) {
        return { state, events: [] };
      }

      // Process level ups (this handles stats, skill drawing, pending rewards)
      const levelUpResult = processLevelUps(player, state.rng);

      // Update state with processed player and new RNG
      const newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? levelUpResult.player : p
        ),
        rng: levelUpResult.rng,
      };

      return { state: newState, events: levelUpResult.events };
    },

    undo(_state: GameState): CommandResult {
      // Not reversible - RNG was consumed
      throw new Error("DEBUG_TRIGGER_LEVEL_UP cannot be undone");
    },
  };
}
