/**
 * Midnight Meditation tactic handler (Night 4)
 *
 * Shuffle up to 5 cards from your hand into the deck,
 * then draw the same number of cards.
 * Flips the tactic after use.
 */

import type { GameState } from "../../../../state/GameState.js";
import type { Player } from "../../../../types/player.js";
import type { GameEvent, CardId, ResolveTacticDecisionPayload } from "@mage-knight/shared";
import {
  CARD_DRAWN,
  TACTIC_DECISION_MIDNIGHT_MEDITATION,
} from "@mage-knight/shared";
import type { TacticResolutionResult } from "../types.js";
import { shuffleWithRng } from "../../../../utils/rng.js";
import { canResolveMidnightMeditation } from "../../../rules/tactics.js";

/**
 * Type for Midnight Meditation decision
 */
export type MidnightMeditationDecision = Extract<
  ResolveTacticDecisionPayload,
  { type: typeof TACTIC_DECISION_MIDNIGHT_MEDITATION }
>;

/**
 * Validate Midnight Meditation decision
 */
export function validateMidnightMeditation(
  _state: GameState,
  player: Player,
  decision: MidnightMeditationDecision
): string | null {
  if (!canResolveMidnightMeditation(player)) {
    return "Cannot resolve Midnight Meditation after starting your turn";
  }

  // Can select 0-5 cards
  if (decision.cardIds.length > 5) {
    return "Cannot shuffle more than 5 cards for Midnight Meditation";
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
 * Resolve Midnight Meditation decision
 *
 * 1. Remove chosen cards from hand
 * 2. Add cards to deck and shuffle
 * 3. Draw the same number of cards back
 * 4. Flip the tactic
 */
export function resolveMidnightMeditation(
  state: GameState,
  player: Player,
  decision: MidnightMeditationDecision
): TacticResolutionResult {
  const events: GameEvent[] = [];
  const cardsToShuffle = decision.cardIds;
  const shuffleCount = cardsToShuffle.length;

  // 1. Remove chosen cards from hand (one at a time to handle duplicates correctly)
  let newHand = [...player.hand];
  for (const cardToRemove of cardsToShuffle) {
    const idx = newHand.indexOf(cardToRemove);
    if (idx !== -1) {
      newHand.splice(idx, 1);
    }
  }

  // 2. Add cards to deck and shuffle
  const deckWithCards = [...player.deck, ...cardsToShuffle];
  const { result: shuffledDeck, rng: newRng } = shuffleWithRng(
    deckWithCards,
    state.rng
  );

  // 3. Draw the same number of cards back
  const newDeck = [...shuffledDeck];
  let cardsDrawn = 0;
  const drawnCards: CardId[] = [];
  for (let i = 0; i < shuffleCount && newDeck.length > 0; i++) {
    const drawnCard = newDeck.shift();
    if (drawnCard) {
      drawnCards.push(drawnCard);
      cardsDrawn++;
    }
  }
  newHand = [...newHand, ...drawnCards];

  // 4. Update player state (flip the tactic)
  const updatedPlayers: Player[] = state.players.map((p) =>
    p.id === player.id
      ? {
          ...p,
          hand: newHand,
          deck: newDeck,
          tacticFlipped: true, // Flip the tactic after use
          pendingTacticDecision: null,
        }
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
 * Type guard to check if a decision is a Midnight Meditation decision
 */
export function isMidnightMeditationDecision(
  decision: { type: string }
): decision is MidnightMeditationDecision {
  return decision.type === TACTIC_DECISION_MIDNIGHT_MEDITATION;
}
