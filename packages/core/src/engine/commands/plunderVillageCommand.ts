/**
 * Plunder village command - plunder a village for cards at a reputation cost
 *
 * When a player plunders a village:
 * 1. Immediately loses 1 reputation
 * 2. Draws 2 cards from their deck
 * 3. Can only plunder once per turn
 *
 * This is a "before turn" action that can be taken:
 * - Before your turn starts
 * - At the start of a new round (even as first player)
 * - Between a normal turn and a Time Bent turn
 *
 * This action is reversible (no RNG involved).
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId } from "@mage-knight/shared";
import {
  hexKey,
  REPUTATION_REASON_PLUNDER_VILLAGE,
} from "@mage-knight/shared";
import {
  createReputationChangedEvent,
  createCardDrawnEvent,
  createVillagePlunderedEvent,
} from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import { PLUNDER_VILLAGE_COMMAND } from "./commandTypes.js";

export { PLUNDER_VILLAGE_COMMAND };

/** Reputation penalty for plundering a village */
const PLUNDER_REPUTATION_PENALTY = -1;

/** Number of cards drawn when plundering */
const PLUNDER_CARDS_DRAWN = 2;

export interface PlunderVillageCommandParams {
  readonly playerId: string;
}

export function createPlunderVillageCommand(
  params: PlunderVillageCommandParams
): Command {
  // Store previous state for undo
  let previousReputation: number;
  let previousHand: readonly CardId[];
  let previousDeck: readonly CardId[];
  let previousHasPlundered: boolean;

  return {
    type: PLUNDER_VILLAGE_COMMAND,
    playerId: params.playerId,
    isReversible: true, // No RNG involved, can be undone

    execute(state: GameState): CommandResult {
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player?.position) {
        throw new Error("Player has no position");
      }

      const key = hexKey(player.position);
      const hex = state.map.hexes[key];
      if (!hex?.site) {
        throw new Error("No site at player position");
      }

      // Store previous state for undo
      previousReputation = player.reputation;
      previousHand = player.hand;
      previousDeck = player.deck;
      previousHasPlundered = player.hasPlunderedThisTurn;

      const events: GameEvent[] = [];
      let updatedState = state;

      // Calculate new reputation (capped at -7)
      const newReputation = Math.max(-7, player.reputation + PLUNDER_REPUTATION_PENALTY);

      // Draw cards from deck
      const cardsToDraw = Math.min(PLUNDER_CARDS_DRAWN, player.deck.length);
      const drawnCards = player.deck.slice(0, cardsToDraw);
      const newDeck = player.deck.slice(cardsToDraw);
      const newHand = [...player.hand, ...drawnCards];

      // Update player state
      const playerIndex = updatedState.players.findIndex((p) => p.id === params.playerId);
      const updatedPlayer: Player = {
        ...player,
        reputation: newReputation,
        hand: newHand,
        deck: newDeck,
        hasPlunderedThisTurn: true,
      };

      const updatedPlayers = [...updatedState.players];
      updatedPlayers[playerIndex] = updatedPlayer;
      updatedState = { ...updatedState, players: updatedPlayers };

      // Emit events
      events.push(
        createVillagePlunderedEvent(
          params.playerId,
          player.position,
          cardsToDraw
        )
      );

      events.push(
        createReputationChangedEvent(
          params.playerId,
          PLUNDER_REPUTATION_PENALTY,
          newReputation,
          REPUTATION_REASON_PLUNDER_VILLAGE
        )
      );

      if (cardsToDraw > 0) {
        events.push(createCardDrawnEvent(params.playerId, cardsToDraw));
      }

      return {
        state: updatedState,
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex((p) => p.id === params.playerId);
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // Restore previous state
      const restoredPlayer: Player = {
        ...player,
        reputation: previousReputation,
        hand: [...previousHand],
        deck: [...previousDeck],
        hasPlunderedThisTurn: previousHasPlundered,
      };

      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = restoredPlayer;

      return {
        state: { ...state, players: updatedPlayers },
        events: [],
      };
    },
  };
}
