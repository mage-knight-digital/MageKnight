/**
 * Debug Add Fame Command
 *
 * Adds fame to a player and triggers level up flow if thresholds are crossed.
 * This is a debug-only command that goes through the proper command pipeline.
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import { getLevelsCrossed, createFameGainedEvent } from "@mage-knight/shared";

export const DEBUG_ADD_FAME_COMMAND = "DEBUG_ADD_FAME" as const;

export interface DebugAddFameCommandParams {
  readonly playerId: string;
  readonly amount: number;
}

export function createDebugAddFameCommand(
  params: DebugAddFameCommandParams
): Command {
  const { playerId, amount } = params;

  // Store previous state for undo
  let previousFame: number | undefined;
  let previousPendingLevelUps: readonly number[] | undefined;

  return {
    type: DEBUG_ADD_FAME_COMMAND,
    playerId,
    isReversible: true, // Can undo this

    execute(state: GameState): CommandResult {
      const player = state.players.find((p) => p.id === playerId);
      if (!player) {
        return { state, events: [] };
      }

      // Store for undo
      previousFame = player.fame;
      previousPendingLevelUps = player.pendingLevelUps;

      const oldFame = player.fame;
      const newFame = oldFame + amount;

      // Check for level crossings
      const levelsCrossed = getLevelsCrossed(oldFame, newFame);

      // Update player
      const updatedPlayer = {
        ...player,
        fame: newFame,
        pendingLevelUps: [...player.pendingLevelUps, ...levelsCrossed],
      };

      const events: GameEvent[] = [
        createFameGainedEvent(playerId, amount, newFame, "debug"),
      ];

      // Update state
      const newState: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === playerId ? updatedPlayer : p
        ),
      };

      return { state: newState, events };
    },

    undo(state: GameState): CommandResult {
      if (previousFame === undefined || previousPendingLevelUps === undefined) {
        return { state, events: [] };
      }

      const player = state.players.find((p) => p.id === playerId);
      if (!player) {
        return { state, events: [] };
      }

      // Restore previous state
      const restoredPlayer = {
        ...player,
        fame: previousFame,
        pendingLevelUps: previousPendingLevelUps,
      };

      const newState: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === playerId ? restoredPlayer : p
        ),
      };

      return { state: newState, events: [] };
    },
  };
}
