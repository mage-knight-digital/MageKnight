/**
 * Resolve Magical Glade wound discard choice.
 *
 * When a player ends their turn on a Magical Glade with wounds,
 * they may optionally discard one wound from hand or discard pile.
 * After resolving this choice (discard or skip), the turn ends.
 *
 * This command is irreversible since it's part of end-turn processing.
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, GladeWoundChoice } from "@mage-knight/shared";
import {
  GLADE_WOUND_DISCARDED,
  GLADE_WOUND_SKIPPED,
  GLADE_WOUND_CHOICE_HAND,
  GLADE_WOUND_CHOICE_DISCARD,
  GLADE_WOUND_CHOICE_SKIP,
  CARD_WOUND,
} from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import { RESOLVE_GLADE_WOUND_COMMAND } from "./commandTypes.js";
import { createEndTurnCommand } from "./endTurnCommand.js";

export { RESOLVE_GLADE_WOUND_COMMAND };

export interface ResolveGladeWoundCommandParams {
  readonly playerId: string;
  readonly choice: GladeWoundChoice;
}

export function createResolveGladeWoundCommand(
  params: ResolveGladeWoundCommandParams
): Command {
  return {
    type: RESOLVE_GLADE_WOUND_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Part of end-turn processing

    execute(state: GameState): CommandResult {
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error("Player not found");
      }

      if (!player.pendingGladeWoundChoice) {
        throw new Error("No pending glade wound choice");
      }

      const events: GameEvent[] = [];
      let updatedPlayer: Player = {
        ...player,
        pendingGladeWoundChoice: false,
      };

      switch (params.choice) {
        case GLADE_WOUND_CHOICE_HAND: {
          // Find and remove one wound from hand
          const woundIndex = player.hand.indexOf(CARD_WOUND);
          if (woundIndex === -1) {
            throw new Error("No wound in hand to discard");
          }
          const newHand = [
            ...player.hand.slice(0, woundIndex),
            ...player.hand.slice(woundIndex + 1),
          ];
          updatedPlayer = {
            ...updatedPlayer,
            hand: newHand,
          };
          events.push({
            type: GLADE_WOUND_DISCARDED,
            playerId: params.playerId,
            source: "hand",
          });
          break;
        }

        case GLADE_WOUND_CHOICE_DISCARD: {
          // Find and remove one wound from discard pile
          const woundIndex = player.discard.indexOf(CARD_WOUND);
          if (woundIndex === -1) {
            throw new Error("No wound in discard pile to discard");
          }
          const newDiscard = [
            ...player.discard.slice(0, woundIndex),
            ...player.discard.slice(woundIndex + 1),
          ];
          updatedPlayer = {
            ...updatedPlayer,
            discard: newDiscard,
          };
          events.push({
            type: GLADE_WOUND_DISCARDED,
            playerId: params.playerId,
            source: "discard",
          });
          break;
        }

        case GLADE_WOUND_CHOICE_SKIP: {
          // Player chose not to discard a wound
          events.push({
            type: GLADE_WOUND_SKIPPED,
            playerId: params.playerId,
          });
          break;
        }

        default:
          throw new Error(`Invalid glade wound choice: ${params.choice}`);
      }

      // Update player in state
      const newState: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === params.playerId ? updatedPlayer : p
        ),
      };

      // Now execute the end turn command to complete turn ending
      // Skip the glade wound check since we just resolved it
      const endTurnCommand = createEndTurnCommand({
        playerId: params.playerId,
        skipGladeWoundCheck: true,
      });
      const endTurnResult = endTurnCommand.execute(newState);

      return {
        state: endTurnResult.state,
        events: [...events, ...endTurnResult.events],
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo RESOLVE_GLADE_WOUND");
    },
  };
}
