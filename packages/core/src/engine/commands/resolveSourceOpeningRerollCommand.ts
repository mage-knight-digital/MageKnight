/**
 * Resolve Source Opening reroll choice at end of turn (FAQ S3).
 *
 * The returning player decides whether to reroll the extra die they used
 * via Source Opening before other dice are rerolled. This choice happens
 * during end-of-turn processing.
 *
 * After resolving this choice, the turn end continues.
 * This command is irreversible since it's part of end-turn processing.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { SourceDieId } from "../../types/mana.js";
import { RESOLVE_SOURCE_OPENING_REROLL_COMMAND } from "./commandTypes.js";
import { createEndTurnCommand } from "./endTurn/index.js";
import { rerollDie } from "../mana/manaSource.js";

export { RESOLVE_SOURCE_OPENING_REROLL_COMMAND };

export interface ResolveSourceOpeningRerollCommandParams {
  readonly playerId: string;
  readonly reroll: boolean; // true = reroll the extra die, false = leave it as-is
}

export function createResolveSourceOpeningRerollCommand(
  params: ResolveSourceOpeningRerollCommandParams
): Command {
  return {
    type: RESOLVE_SOURCE_OPENING_REROLL_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Part of end-turn processing

    execute(state: GameState): CommandResult {
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error("Player not found");
      }

      const dieId = player.pendingSourceOpeningRerollChoice;
      if (!dieId) {
        throw new Error("No pending Source Opening reroll choice");
      }

      // Clear the pending choice
      const updatedPlayer: Player = {
        ...player,
        pendingSourceOpeningRerollChoice: null,
      };

      let updatedState: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === params.playerId ? updatedPlayer : p
        ),
      };

      // If player chose to reroll, reroll the extra die now
      // (before the rest of dice management in endTurn)
      if (params.reroll) {
        const { source: rerolledSource, rng: newRng } = rerollDie(
          updatedState.source,
          dieId as SourceDieId,
          updatedState.timeOfDay,
          updatedState.rng
        );
        updatedState = {
          ...updatedState,
          source: rerolledSource,
          rng: newRng,
        };
      }

      // Now execute the end turn command to complete turn ending
      // Skip the source opening reroll check since we just resolved it
      // Pass the die ID so processDiceReturn excludes it from auto-reroll
      const endTurnCommand = createEndTurnCommand({
        playerId: params.playerId,
        skipSourceOpeningReroll: true,
        sourceOpeningDieHandled: dieId,
      });
      const endTurnResult = endTurnCommand.execute(updatedState);

      return {
        state: endTurnResult.state,
        events: [...endTurnResult.events],
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo RESOLVE_SOURCE_OPENING_REROLL");
    },
  };
}
