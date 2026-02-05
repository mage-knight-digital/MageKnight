/**
 * Activate Tactic command - handles activating a flip-to-use tactic
 *
 * This command handles activated tactics like:
 * - The Right Moment (Day 6): Take another turn immediately after this one
 * - Long Night (Night 2): Shuffle discard, put 3 cards in deck
 * - Midnight Meditation (Night 4): Shuffle cards into deck, draw same amount
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { GameEvent, TacticId, CardId } from "@mage-knight/shared";
import {
  INVALID_ACTION,
  TACTIC_ACTIVATED,
  TACTIC_THE_RIGHT_MOMENT,
  TACTIC_LONG_NIGHT,
  TACTIC_MIDNIGHT_MEDITATION,
} from "@mage-knight/shared";
import { ACTIVATE_TACTIC_COMMAND } from "./commandTypes.js";
import { shuffleWithRng } from "../../utils/rng.js";

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

  if (tacticId === TACTIC_LONG_NIGHT) {
    // Deck must be empty
    if (player.deck.length > 0) {
      return "Cannot use Long Night when deck is not empty";
    }
    // Discard must have cards
    if (player.discard.length === 0) {
      return "Cannot use Long Night when discard pile is empty";
    }
  }

  if (tacticId === TACTIC_MIDNIGHT_MEDITATION) {
    // Must have cards in hand to shuffle
    if (player.hand.length === 0) {
      return "Cannot use Midnight Meditation when hand is empty";
    }
    // Must not have taken any action this turn
    if (player.hasTakenActionThisTurn) {
      return "Cannot use Midnight Meditation after taking an action";
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
      } else if (tacticId === TACTIC_LONG_NIGHT) {
        // Long Night: Shuffle discard, put 3 random cards back into deck
        // 1. Shuffle the discard pile
        const { result: shuffledDiscard, rng: newRng } = shuffleWithRng(
          [...player.discard],
          state.rng
        );

        // 2. Take up to 3 cards for the new deck
        const cardsForDeck = Math.min(3, shuffledDiscard.length);
        const newDeck: CardId[] = shuffledDiscard.slice(0, cardsForDeck);
        const newDiscard: CardId[] = shuffledDiscard.slice(cardsForDeck);

        // 3. Update player state
        const updatedPlayers = state.players.map(p =>
          p.id === playerId
            ? {
                ...p,
                deck: newDeck,
                discard: newDiscard,
                tacticFlipped: true,
              } as Player
            : p
        );

        updatedState = {
          ...state,
          players: updatedPlayers,
          rng: newRng,
        };
      } else if (tacticId === TACTIC_MIDNIGHT_MEDITATION) {
        // Midnight Meditation: Set pending decision to select cards
        // The actual shuffle and draw happens in resolveTacticDecisionCommand
        const updatedPlayers: Player[] = state.players.map(p =>
          p.id === playerId
            ? {
                ...p,
                pendingTacticDecision: { type: TACTIC_MIDNIGHT_MEDITATION, maxCards: 5 },
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
