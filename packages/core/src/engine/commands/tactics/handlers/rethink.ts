/**
 * Rethink tactic handler (Day 2)
 *
 * Choose up to 3 cards to discard from hand, shuffle discard into deck,
 * then draw the same number of cards you discarded.
 */

import type { GameState } from "../../../../state/GameState.js";
import type { Player } from "../../../../types/player.js";
import type { GameEvent, CardId, ResolveTacticDecisionPayload } from "@mage-knight/shared";
import { CARD_DRAWN, TACTIC_DECISION_RETHINK } from "@mage-knight/shared";
import type { TacticResolutionResult } from "../types.js";
import { shuffleWithRng } from "../../../../utils/rng.js";

/**
 * Type for Rethink decision
 */
export type RethinkDecision = Extract<
  ResolveTacticDecisionPayload,
  { type: typeof TACTIC_DECISION_RETHINK }
>;

/**
 * Validate Rethink decision
 */
export function validateRethink(
  _state: GameState,
  player: Player,
  decision: RethinkDecision
): string | null {
  // Can discard 0-3 cards
  if (decision.cardIds.length > 3) {
    return "Cannot discard more than 3 cards for Rethink";
  }

  // All cards must be in hand
  for (const cardId of decision.cardIds) {
    if (!player.hand.includes(cardId)) {
      return `Card ${cardId} is not in your hand`;
    }
  }

  return null;
}

/**
 * Resolve Rethink decision
 *
 * 1. Remove chosen cards from hand
 * 2. Shuffle discard pile INTO the existing deck (combine them, then shuffle)
 * 3. Draw the same number of cards discarded
 */
export function resolveRethink(
  state: GameState,
  player: Player,
  decision: RethinkDecision
): TacticResolutionResult {
  const events: GameEvent[] = [];
  const cardsToDiscard = decision.cardIds;
  const discardCount = cardsToDiscard.length;

  // 1. Remove chosen cards from hand (one at a time to handle duplicates correctly)
  let newHand = [...player.hand];
  for (const cardToRemove of cardsToDiscard) {
    const idx = newHand.indexOf(cardToRemove);
    if (idx !== -1) {
      newHand.splice(idx, 1);
    }
  }
  const newDiscardPile = [...player.discard, ...cardsToDiscard];

  // 2. Shuffle discard pile INTO the existing deck (combine them, then shuffle)
  const combinedPool = [...player.deck, ...newDiscardPile];
  const { result: shuffledDeck, rng: newRng } = shuffleWithRng(
    combinedPool,
    state.rng
  );
  const newDiscard: CardId[] = []; // Discard is now empty
  const newDeck = [...shuffledDeck];

  // 3. Draw the same number of cards discarded
  let cardsDrawn = 0;
  const drawnCards: CardId[] = [];
  for (let i = 0; i < discardCount && newDeck.length > 0; i++) {
    const drawnCard = newDeck.shift();
    if (drawnCard) {
      drawnCards.push(drawnCard);
      cardsDrawn++;
    }
  }
  newHand = [...newHand, ...drawnCards];

  // 4. Update player state
  const updatedPlayers = state.players.map((p) =>
    p.id === player.id
      ? ({
          ...p,
          hand: newHand,
          deck: newDeck,
          discard: newDiscard,
          pendingTacticDecision: null,
        } as Player)
      : p
  );

  const updatedState = {
    ...state,
    players: updatedPlayers,
    rng: newRng,
  };

  if (cardsDrawn > 0) {
    events.push({
      type: CARD_DRAWN,
      playerId: player.id,
      count: cardsDrawn,
    });
  }

  return { updatedState, events };
}

/**
 * Type guard to check if a decision is a Rethink decision
 */
export function isRethinkDecision(decision: { type: string }): decision is RethinkDecision {
  return decision.type === TACTIC_DECISION_RETHINK;
}
