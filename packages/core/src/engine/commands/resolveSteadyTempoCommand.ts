/**
 * Resolve Steady Tempo deck placement choice.
 *
 * When a player ends their turn after playing Steady Tempo (basic or powered),
 * they may optionally place Steady Tempo back into their deed deck:
 *
 * - Basic version: Place on BOTTOM of deck (requires non-empty deck)
 * - Powered version: Place on TOP of deck (no restriction)
 *
 * If the player chooses to place, Steady Tempo is removed from the play area
 * and placed in the deck at the appropriate position. If they skip, the card
 * is discarded normally during card flow.
 *
 * This command is irreversible since it's part of end-turn processing.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  CARD_STEADY_TEMPO,
  STEADY_TEMPO_PLACED,
  STEADY_TEMPO_PLACEMENT_SKIPPED,
} from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import { RESOLVE_STEADY_TEMPO_COMMAND } from "./commandTypes.js";
import { createEndTurnCommand } from "./endTurn/index.js";

export { RESOLVE_STEADY_TEMPO_COMMAND };

export interface ResolveSteadyTempoCommandParams {
  readonly playerId: string;
  readonly place: boolean; // true = place in deck, false = skip (discard normally)
}

export function createResolveSteadyTempoCommand(
  params: ResolveSteadyTempoCommandParams
): Command {
  return {
    type: RESOLVE_STEADY_TEMPO_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Part of end-turn processing

    execute(state: GameState): CommandResult {
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error("Player not found");
      }

      if (!player.pendingSteadyTempoDeckPlacement) {
        throw new Error("No pending Steady Tempo deck placement");
      }

      const { version } = player.pendingSteadyTempoDeckPlacement;
      const events: GameEvent[] = [];
      let updatedPlayer: Player = {
        ...player,
        pendingSteadyTempoDeckPlacement: undefined,
      };

      if (params.place) {
        // Remove Steady Tempo from play area
        const playAreaIndex = player.playArea.indexOf(CARD_STEADY_TEMPO);
        if (playAreaIndex === -1) {
          throw new Error("Steady Tempo not found in play area");
        }

        const newPlayArea = [
          ...player.playArea.slice(0, playAreaIndex),
          ...player.playArea.slice(playAreaIndex + 1),
        ];

        // Place in deck at appropriate position
        const position = version === "powered" ? "top" : "bottom";
        const newDeck =
          position === "top"
            ? [CARD_STEADY_TEMPO, ...player.deck]
            : [...player.deck, CARD_STEADY_TEMPO];

        updatedPlayer = {
          ...updatedPlayer,
          playArea: newPlayArea,
          deck: newDeck,
        };

        events.push({
          type: STEADY_TEMPO_PLACED,
          playerId: params.playerId,
          position,
        });
      } else {
        // Player chose not to place - card will be discarded normally during card flow
        events.push({
          type: STEADY_TEMPO_PLACEMENT_SKIPPED,
          playerId: params.playerId,
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
      // Skip the Steady Tempo check since we just resolved it
      const endTurnCommand = createEndTurnCommand({
        playerId: params.playerId,
        skipSteadyTempo: true,
      });
      const endTurnResult = endTurnCommand.execute(newState);

      return {
        state: endTurnResult.state,
        events: [...events, ...endTurnResult.events],
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo RESOLVE_STEADY_TEMPO");
    },
  };
}
