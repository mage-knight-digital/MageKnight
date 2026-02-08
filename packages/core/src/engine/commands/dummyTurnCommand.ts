/**
 * Dummy Turn Command
 *
 * Executes a pre-computed dummy turn when it's the dummy's position in
 * the turn order. If the dummy's deck is exhausted, announces end of round.
 *
 * @module commands/dummyTurnCommand
 */

import type { GameState } from "../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  DUMMY_TURN_EXECUTED,
  DUMMY_END_OF_ROUND_ANNOUNCED,
} from "@mage-knight/shared";
import { DUMMY_PLAYER_ID } from "../../types/dummyPlayer.js";
import { executeDummyTurn } from "../helpers/dummyPlayerHelpers.js";

export interface DummyTurnResult {
  readonly state: GameState;
  readonly events: GameEvent[];
  /** True if the dummy announced end of round (deck exhausted) */
  readonly announcedEndOfRound: boolean;
}

/**
 * Execute the dummy player's turn.
 *
 * If the dummy has pre-computed turns remaining, steps through the next one.
 * If the deck is exhausted, announces end of round.
 */
export function executeDummyPlayerTurn(state: GameState): DummyTurnResult {
  const dummy = state.dummyPlayer;
  if (!dummy) {
    return { state, events: [], announcedEndOfRound: false };
  }

  const events: GameEvent[] = [];

  // Check if dummy's deck is exhausted (no more pre-computed turns)
  if (dummy.currentTurnIndex >= dummy.precomputedTurns.length) {
    // Dummy announces end of round
    // Only human players get a final turn
    const humanPlayerIds = state.players.map((p) => p.id);

    events.push({ type: DUMMY_END_OF_ROUND_ANNOUNCED });

    return {
      state: {
        ...state,
        endOfRoundAnnouncedBy: DUMMY_PLAYER_ID,
        playersWithFinalTurn: humanPlayerIds,
      },
      events,
      announcedEndOfRound: true,
    };
  }

  // Execute the pre-computed turn
  const { dummy: updatedDummy, turn } = executeDummyTurn(dummy);

  if (turn) {
    events.push({
      type: DUMMY_TURN_EXECUTED,
      cardsFlipped: turn.cardsFlipped,
      bonusFlipped: turn.bonusFlipped,
      matchedColor: turn.matchedColor,
      deckRemaining: turn.deckRemainingAfter,
    });
  }

  return {
    state: {
      ...state,
      dummyPlayer: updatedDummy,
    },
    events,
    announcedEndOfRound: false,
  };
}
