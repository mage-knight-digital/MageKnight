/**
 * Resolve Meditation spell card selection and placement.
 *
 * Two phases:
 * - Phase 1 (select_cards): Powered mode only. Player selects cards from discard.
 *   Stores selectedCardIds, advances to phase "place_cards".
 * - Phase 2 (place_cards): Player chooses top or bottom of deck.
 *   Removes selected cards from discard, places on top or bottom of deck, clears pending.
 *
 * This command is irreversible since card placement affects hidden information.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId } from "@mage-knight/shared";
import {
  MEDITATION_CARDS_SELECTED,
  MEDITATION_CARDS_PLACED,
} from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import { RESOLVE_MEDITATION_COMMAND } from "./commandTypes.js";

export { RESOLVE_MEDITATION_COMMAND };

export interface ResolveMeditationCommandParams {
  readonly playerId: string;
  readonly selectedCardIds?: readonly CardId[]; // Phase 1 (powered)
  readonly placeOnTop?: boolean; // Phase 2
}

export function createResolveMeditationCommand(
  params: ResolveMeditationCommandParams
): Command {
  return {
    type: RESOLVE_MEDITATION_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error("Player not found");
      }

      if (!player.pendingMeditation) {
        throw new Error("No pending Meditation to resolve");
      }

      const { phase, version } = player.pendingMeditation;
      const events: GameEvent[] = [];

      if (phase === "select_cards") {
        // Phase 1: Store selected cards and advance to place_cards
        const selectedCardIds = params.selectedCardIds;
        if (!selectedCardIds || selectedCardIds.length === 0) {
          throw new Error("Must select cards for phase 1");
        }

        const updatedPlayer: Player = {
          ...player,
          pendingMeditation: {
            version,
            phase: "place_cards",
            selectedCardIds,
          },
        };

        events.push({
          type: MEDITATION_CARDS_SELECTED,
          playerId: params.playerId,
          cardIds: selectedCardIds,
          version,
        });

        return {
          state: {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? updatedPlayer : p
            ),
          },
          events,
        };
      }

      if (phase === "place_cards") {
        // Phase 2: Remove cards from discard, place on top/bottom of deck
        const placeOnTop = params.placeOnTop;
        if (placeOnTop === undefined) {
          throw new Error("Must specify placement for phase 2");
        }

        const selectedCardIds = player.pendingMeditation.selectedCardIds;

        // Remove selected cards from discard
        const remainingDiscard = [...player.discard];
        for (const cardId of selectedCardIds) {
          const idx = remainingDiscard.indexOf(cardId);
          if (idx !== -1) {
            remainingDiscard.splice(idx, 1);
          }
        }

        // Place cards on top or bottom of deck
        const newDeck = placeOnTop
          ? [...selectedCardIds, ...player.deck]
          : [...player.deck, ...selectedCardIds];

        const updatedPlayer: Player = {
          ...player,
          discard: remainingDiscard,
          deck: newDeck,
          pendingMeditation: undefined,
        };

        events.push({
          type: MEDITATION_CARDS_PLACED,
          playerId: params.playerId,
          cardIds: selectedCardIds,
          position: placeOnTop ? "top" : "bottom",
        });

        return {
          state: {
            ...state,
            players: state.players.map((p) =>
              p.id === params.playerId ? updatedPlayer : p
            ),
          },
          events,
        };
      }

      throw new Error(`Unknown meditation phase: ${phase}`);
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo RESOLVE_MEDITATION");
    },
  };
}
