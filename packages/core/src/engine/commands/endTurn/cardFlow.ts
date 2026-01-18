/**
 * Card Flow for End Turn
 *
 * Handles moving play area cards to discard and drawing up to hand limit.
 *
 * @module commands/endTurn/cardFlow
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CardId } from "@mage-knight/shared";
import { getEndTurnDrawLimit } from "../../helpers/handLimitHelpers.js";
import type { CardFlowResult } from "./types.js";

/**
 * Process card flow at end of turn:
 * 1. Move play area cards to discard
 * 2. Draw cards up to effective hand limit (no mid-round reshuffle)
 */
export function processCardFlow(
  state: GameState,
  player: Player
): CardFlowResult {
  // Move play area cards to discard
  const playAreaCards = player.playArea;
  const newDiscard = [...player.discard, ...playAreaCards];
  const clearedPlayArea: readonly CardId[] = [];

  // Calculate how many cards to draw
  const currentHandSize = player.hand.length;
  const effectiveLimit = getEndTurnDrawLimit(state, player.id, currentHandSize);
  const cardsToDraw = Math.max(0, effectiveLimit - currentHandSize);

  // Draw cards (stop if deck empties - no mid-round reshuffle)
  const newHand: CardId[] = [...player.hand];
  const newDeck: CardId[] = [...player.deck];
  let cardsDrawn = 0;

  for (let i = 0; i < cardsToDraw && newDeck.length > 0; i++) {
    const drawnCard = newDeck.shift();
    if (drawnCard) {
      newHand.push(drawnCard);
      cardsDrawn++;
    }
  }

  return {
    hand: newHand,
    deck: newDeck,
    discard: newDiscard,
    playArea: clearedPlayArea,
    cardsDrawn,
  };
}

/**
 * Get the number of cards that were in the play area (for event reporting).
 */
export function getPlayAreaCardCount(player: Player): number {
  return player.playArea.length;
}
