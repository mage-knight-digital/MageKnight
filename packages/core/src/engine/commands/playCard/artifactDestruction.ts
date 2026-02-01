/**
 * Artifact destruction handling for powered card plays
 *
 * Some artifacts have a "destroyOnPowered" flag - when played with mana,
 * the card is destroyed after resolving its effect.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CardId } from "@mage-knight/shared";
import type { GameEvent } from "@mage-knight/shared";
import { CARD_DESTROYED } from "@mage-knight/shared";

/**
 * Result of handling artifact destruction
 */
export interface ArtifactDestructionResult {
  readonly state: GameState;
  readonly events: GameEvent[];
}

/**
 * Handle artifact destruction when a destroyOnPowered card is played with mana.
 * Moves the card from the play area to removedCards.
 */
export function handleArtifactDestruction(
  state: GameState,
  playerId: string,
  cardId: CardId
): ArtifactDestructionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Remove from play area, add to removedCards
  const newPlayArea = player.playArea.filter((c) => c !== cardId);
  const updatedPlayer: Player = {
    ...player,
    playArea: newPlayArea,
    removedCards: [...player.removedCards, cardId],
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return {
    state: { ...state, players },
    events: [
      {
        type: CARD_DESTROYED,
        playerId,
        cardId,
      },
    ],
  };
}
