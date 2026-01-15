/**
 * Resolve Deep Mine crystal color choice.
 *
 * When a player ends their turn on a Deep Mine with multiple available colors,
 * they must choose which crystal color to gain. After resolving this choice,
 * the turn ends.
 *
 * This command is irreversible since it's part of end-turn processing.
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, BasicManaColor } from "@mage-knight/shared";
import { DEEP_MINE_CRYSTAL_GAINED } from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import { mineColorToBasicManaColor } from "../../types/map.js";
import { RESOLVE_DEEP_MINE_COMMAND } from "./commandTypes.js";
import { createEndTurnCommand } from "./endTurnCommand.js";

export { RESOLVE_DEEP_MINE_COMMAND };

export interface ResolveDeepMineChoiceCommandParams {
  readonly playerId: string;
  readonly color: BasicManaColor;
}

const MAX_CRYSTALS_PER_COLOR = 3;

export function createResolveDeepMineChoiceCommand(
  params: ResolveDeepMineChoiceCommandParams
): Command {
  return {
    type: RESOLVE_DEEP_MINE_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Part of end-turn processing

    execute(state: GameState): CommandResult {
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error("Player not found");
      }

      if (!player.pendingDeepMineChoice) {
        throw new Error("No pending deep mine choice");
      }

      // Verify the chosen color is one of the available options
      const availableColors = player.pendingDeepMineChoice.map(mineColorToBasicManaColor);
      if (!availableColors.includes(params.color)) {
        throw new Error(`Invalid color choice: ${params.color}. Available: ${availableColors.join(", ")}`);
      }

      const events: GameEvent[] = [];
      let updatedPlayer: Player = {
        ...player,
        pendingDeepMineChoice: null,
      };

      // Grant the crystal if under max
      const currentCount = player.crystals[params.color];
      if (currentCount < MAX_CRYSTALS_PER_COLOR) {
        updatedPlayer = {
          ...updatedPlayer,
          crystals: {
            ...updatedPlayer.crystals,
            [params.color]: currentCount + 1,
          },
        };
        events.push({
          type: DEEP_MINE_CRYSTAL_GAINED,
          playerId: params.playerId,
          color: params.color,
        });
      }

      // Update player in state
      const newState: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === params.playerId ? updatedPlayer : p
        ),
      };

      // Now execute the end turn command to complete turn ending
      // Skip both the glade wound check and deep mine check since we just resolved
      const endTurnCommand = createEndTurnCommand({
        playerId: params.playerId,
        skipGladeWoundCheck: true,
        skipDeepMineCheck: true,
      });
      const endTurnResult = endTurnCommand.execute(newState);

      return {
        state: endTurnResult.state,
        events: [...events, ...endTurnResult.events],
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo RESOLVE_DEEP_MINE");
    },
  };
}
