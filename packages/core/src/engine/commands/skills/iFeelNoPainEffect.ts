/**
 * I Feel No Pain skill effect handler
 *
 * Tovak's skill: Once a turn, except in combat: discard one Wound from hand.
 * If you do, draw a card.
 *
 * Implementation:
 * - Removes one Wound card from hand
 * - Returns the Wound to the wound pile (not healing, just relocation)
 * - Draws one card from deck
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import { CARD_WOUND } from "@mage-knight/shared";

/**
 * Apply the I Feel No Pain skill effect.
 *
 * 1. Remove one Wound from hand
 * 2. Return it to the wound pile
 * 3. Draw one card
 */
export function applyIFeelNoPainEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Find and remove one wound from hand
  const woundIndex = player.hand.indexOf(CARD_WOUND);
  if (woundIndex === -1) {
    throw new Error("No wound in hand to discard");
  }

  const newHand = [...player.hand];
  newHand.splice(woundIndex, 1);

  // Return wound to wound pile
  const newWoundPileCount =
    state.woundPileCount === null ? null : state.woundPileCount + 1;

  // Draw one card from deck
  const cardToDraw = player.deck[0];
  let newDeck = player.deck;
  let finalHand = newHand;

  if (cardToDraw !== undefined) {
    newDeck = player.deck.slice(1);
    finalHand = [...newHand, cardToDraw];
  }

  const updatedPlayer: Player = {
    ...player,
    hand: finalHand,
    deck: newDeck,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return {
    ...state,
    players,
    woundPileCount: newWoundPileCount,
  };
}

/**
 * Remove the I Feel No Pain skill effect for undo.
 *
 * Reverses the effect:
 * 1. Remove the drawn card from hand and put it back on top of deck
 * 2. Take a wound from the wound pile and add it to hand
 *
 * Note: This is an approximation - we put the last card in hand back on deck,
 * which works correctly if the player didn't play any cards after using the skill.
 * For more complex scenarios, the command system's checkpoint mechanism handles undo.
 */
export function removeIFeelNoPainEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Find the last non-wound card in hand (the card that was drawn)
  // We need to return it to the top of the deck
  const handWithWound = [...player.hand];
  let drawnCardIndex = -1;

  // Look for the last non-wound card (most recently added)
  for (let i = handWithWound.length - 1; i >= 0; i--) {
    if (handWithWound[i] !== CARD_WOUND) {
      drawnCardIndex = i;
      break;
    }
  }

  let newDeck = player.deck;
  if (drawnCardIndex !== -1) {
    // Remove the drawn card and put it back on top of deck
    const drawnCard = handWithWound[drawnCardIndex];
    handWithWound.splice(drawnCardIndex, 1);
    if (drawnCard !== undefined) {
      newDeck = [drawnCard, ...player.deck];
    }
  }

  // Add wound back to hand (from wound pile)
  handWithWound.push(CARD_WOUND);

  // Decrement wound pile
  const newWoundPileCount =
    state.woundPileCount === null ? null : Math.max(0, state.woundPileCount - 1);

  const updatedPlayer: Player = {
    ...player,
    hand: handWithWound,
    deck: newDeck,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return {
    ...state,
    players,
    woundPileCount: newWoundPileCount,
  };
}
