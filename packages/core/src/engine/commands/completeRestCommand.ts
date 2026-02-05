/**
 * COMPLETE_REST command - completes the rest by discarding cards
 *
 * Rest type is determined automatically based on hand at completion:
 * - Standard Rest: exactly 1 non-wound + any wounds (if hand has non-wounds)
 * - Slow Recovery: exactly 1 wound (if hand has only wounds)
 * - Slow Recovery with no discard: if all wounds were healed during rest (FAQ Q2 A2)
 *
 * ALL discarded cards (including wounds) go to the discard pile.
 * This is NOT healing - wounds are simply cycled through the deck.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CardId, BasicActionCardId, GameEvent, RestType } from "@mage-knight/shared";
import {
  PLAYER_RESTED,
  END_OF_ROUND_ANNOUNCED,
  REST_UNDONE,
} from "@mage-knight/shared";
import { getBasicActionCard } from "../../data/basicActions/index.js";
import { DEED_CARD_TYPE_WOUND } from "../../types/cards.js";

export const COMPLETE_REST_COMMAND = "COMPLETE_REST" as const;

export interface CompleteRestCommandParams {
  readonly playerId: string;
  readonly discardCardIds: readonly CardId[];
  readonly announceEndOfRound: boolean;
  readonly previousHand: readonly CardId[]; // For undo
  readonly previousDiscard: readonly CardId[]; // For undo
  readonly previousIsResting: boolean; // For undo - should be true
  readonly restType: RestType; // Determined by validator based on hand state
}

/**
 * Helper to check if a card is a wound
 */
function isWoundCard(cardId: string): boolean {
  try {
    const card = getBasicActionCard(cardId as BasicActionCardId);
    return card.cardType === DEED_CARD_TYPE_WOUND;
  } catch {
    // If card not found in basic actions, assume it's not a wound
    return false;
  }
}

export function createCompleteRestCommand(
  params: CompleteRestCommandParams
): Command {
  return {
    type: COMPLETE_REST_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Can undo rest completion before end of turn

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Count wounds for event reporting
      let woundCount = 0;
      for (const cardId of params.discardCardIds) {
        if (isWoundCard(cardId)) {
          woundCount++;
        }
      }

      // Remove cards from hand
      const newHand = [...player.hand];
      for (const cardId of params.discardCardIds) {
        const index = newHand.indexOf(cardId);
        if (index !== -1) {
          newHand.splice(index, 1);
        }
      }

      // ALL discarded cards go to discard pile (wounds too - this is NOT healing)
      const newDiscard = [...player.discard, ...params.discardCardIds];

      // Exit resting state, mark minimum turn requirement satisfied
      const updatedPlayer: Player = {
        ...player,
        hand: newHand,
        discard: newDiscard,
        isResting: false, // Rest is now complete
        playedCardFromHandThisTurn: true, // Rest discarding satisfies minimum turn requirement
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      const events: GameEvent[] = [
        {
          type: PLAYER_RESTED,
          playerId: params.playerId,
          restType: params.restType,
          cardsDiscarded: params.discardCardIds.length,
          woundsDiscarded: woundCount,
          announcedEndOfRound: params.announceEndOfRound,
        },
      ];

      if (params.announceEndOfRound) {
        events.push({
          type: END_OF_ROUND_ANNOUNCED,
          playerId: params.playerId,
        });
      }

      return {
        state: { ...state, players },
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Restore to resting state with original hand/discard
      const updatedPlayer: Player = {
        ...player,
        hand: [...params.previousHand],
        discard: [...params.previousDiscard],
        isResting: params.previousIsResting, // Restore to resting state
        playedCardFromHandThisTurn: false, // Undo minimum turn requirement satisfaction
      };

      const players = [...state.players];
      players[playerIndex] = updatedPlayer;

      return {
        state: { ...state, players },
        events: [
          {
            type: REST_UNDONE,
            playerId: params.playerId,
          },
        ],
      };
    },
  };
}
