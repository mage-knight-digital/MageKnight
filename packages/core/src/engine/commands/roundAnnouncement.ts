import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { END_OF_ROUND_ANNOUNCED, type EndOfRoundAnnouncedEvent } from "@mage-knight/shared";

export interface RoundAnnouncementResult {
  readonly state: GameState;
  readonly event: EndOfRoundAnnouncedEvent;
}

/**
 * Apply round-end announcement state updates.
 *
 * - Stores the announcing player
 * - Grants one final turn to all other players
 * - Marks announcer as having taken an action this turn
 */
export function applyRoundAnnouncement(
  state: GameState,
  playerId: string
): RoundAnnouncementResult {
  const otherPlayerIds = state.players
    .filter((p) => p.id !== playerId)
    .map((p) => p.id);

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  const updatedPlayers: Player[] = [...state.players];
  const currentPlayer = updatedPlayers[playerIndex];
  if (currentPlayer) {
    updatedPlayers[playerIndex] = {
      ...currentPlayer,
      hasTakenActionThisTurn: true,
    };
  }

  return {
    state: {
      ...state,
      players: updatedPlayers,
      endOfRoundAnnouncedBy: playerId,
      playersWithFinalTurn: otherPlayerIds,
    },
    event: {
      type: END_OF_ROUND_ANNOUNCED,
      playerId,
    },
  };
}
