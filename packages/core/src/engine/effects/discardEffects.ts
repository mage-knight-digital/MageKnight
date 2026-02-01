/**
 * Card discard effect handlers
 *
 * Handles effects that require discarding cards from hand.
 * Used by skills that need discarding as a cost or for an effect.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { DiscardCardEffect, CardEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { CardId, DiscardFilter } from "@mage-knight/shared";
import {
  CARD_WOUND,
  DISCARD_FILTER_WOUND,
  DISCARD_FILTER_NON_WOUND,
  DISCARD_FILTER_ANY,
} from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";

/**
 * Get cards in hand that match the filter criteria.
 */
export function getDiscardableCards(
  hand: readonly CardId[],
  filter: DiscardFilter
): CardId[] {
  switch (filter) {
    case DISCARD_FILTER_WOUND:
      return hand.filter((cardId) => cardId === CARD_WOUND);
    case DISCARD_FILTER_NON_WOUND:
      return hand.filter((cardId) => cardId !== CARD_WOUND);
    case DISCARD_FILTER_ANY:
      return [...hand];
  }
}

/**
 * Handle the EFFECT_DISCARD_CARD entry point.
 * Checks for eligible cards and either auto-resolves or requests a choice.
 */
export function handleDiscardCard(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: DiscardCardEffect
): EffectResolutionResult {
  const eligibleCards = getDiscardableCards(player.hand, effect.filter);

  // Check if there are enough cards to discard
  if (eligibleCards.length < effect.amount) {
    const filterDesc =
      effect.filter === DISCARD_FILTER_WOUND
        ? "wound cards"
        : effect.filter === DISCARD_FILTER_NON_WOUND
          ? "non-wound cards"
          : "cards";
    return {
      state,
      description: `Not enough ${filterDesc} to discard (need ${effect.amount}, have ${eligibleCards.length})`,
    };
  }

  // If only one card type matches and amount is 1, auto-resolve
  if (eligibleCards.length === 1 && effect.amount === 1) {
    const cardToDiscard = eligibleCards[0];
    if (!cardToDiscard) {
      throw new Error("Expected single eligible card");
    }
    return applyDiscardCard(state, playerIndex, player, [cardToDiscard], effect.onSuccess);
  }

  // Player must choose which card(s) to discard
  return {
    state,
    description: `Choose ${effect.amount} card(s) to discard`,
    requiresChoice: true,
  };
}

/**
 * Apply the discard effect to specific cards.
 * Moves the cards from hand to discard pile.
 * Optionally resolves a follow-up effect on success.
 */
export function applyDiscardCard(
  state: GameState,
  playerIndex: number,
  player: Player,
  cardIds: readonly CardId[],
  onSuccess?: CardEffect
): EffectResolutionResult {
  // Remove cards from hand
  const updatedHand = [...player.hand];
  const discardedCards: CardId[] = [];

  for (const cardId of cardIds) {
    const index = updatedHand.indexOf(cardId);
    if (index === -1) {
      return {
        state,
        description: `Card not found in hand: ${cardId}`,
      };
    }
    updatedHand.splice(index, 1);
    discardedCards.push(cardId);
  }

  // Add to discard pile
  const updatedDiscardPile = [...player.discard, ...discardedCards];

  const updatedPlayer: Player = {
    ...player,
    hand: updatedHand,
    discard: updatedDiscardPile,
  };

  const updatedState = updatePlayer(state, playerIndex, updatedPlayer);

  const description = `Discarded ${cardIds.length} card(s)`;

  // If there's a follow-up effect, note that it needs resolution
  // The command layer will handle chaining to onSuccess
  if (onSuccess) {
    return {
      state: updatedState,
      description: `${description}. Follow-up effect pending.`,
      resolvedEffect: { type: "discard_card", filter: DISCARD_FILTER_ANY, amount: cardIds.length } as DiscardCardEffect,
    };
  }

  return {
    state: updatedState,
    description,
  };
}
