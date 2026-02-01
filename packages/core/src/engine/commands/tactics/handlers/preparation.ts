/**
 * Preparation tactic handler (Night 5)
 *
 * Look at your deck and choose one card to take into your hand,
 * then shuffle the remaining deck.
 */

import type { GameState } from "../../../../state/GameState.js";
import type { Player } from "../../../../types/player.js";
import type { GameEvent, CardId, ResolveTacticDecisionPayload } from "@mage-knight/shared";
import {
  CARD_DRAWN,
  TACTIC_DECISION_PREPARATION,
} from "@mage-knight/shared";
import type { TacticResolutionResult } from "../types.js";
import { shuffleWithRng } from "../../../../utils/rng.js";

/**
 * Type for Preparation decision
 */
export type PreparationDecision = Extract<
  ResolveTacticDecisionPayload,
  { type: typeof TACTIC_DECISION_PREPARATION }
>;

/**
 * Validate Preparation decision
 */
export function validatePreparation(
  _state: GameState,
  player: Player,
  decision: PreparationDecision
): string | null {
  // Card must exist in the deck snapshot
  const pending = player.pendingTacticDecision;
  if (pending?.type !== TACTIC_DECISION_PREPARATION) {
    return "No preparation decision pending";
  }

  if (!pending.deckSnapshot.includes(decision.cardId)) {
    return `Card ${decision.cardId} is not in the deck`;
  }

  return null;
}

/**
 * Resolve Preparation decision
 *
 * Remove the chosen card from deck, add to hand, then shuffle remaining deck.
 */
export function resolvePreparation(
  state: GameState,
  player: Player,
  decision: PreparationDecision
): TacticResolutionResult {
  const events: GameEvent[] = [];
  const chosenCardId = decision.cardId;

  // Remove the card from deck and add to hand
  const newDeck = player.deck.filter((c) => c !== chosenCardId);

  // Shuffle the remaining deck
  const { result: shuffledDeck, rng: newRng } = shuffleWithRng(newDeck, state.rng);

  const newHand: CardId[] = [...player.hand, chosenCardId];

  const updatedPlayers: Player[] = state.players.map((p) =>
    p.id === player.id
      ? {
          ...p,
          hand: newHand,
          deck: shuffledDeck,
          pendingTacticDecision: null,
        }
      : p
  );

  const updatedState = {
    ...state,
    players: updatedPlayers,
    rng: newRng,
  };

  events.push({
    type: CARD_DRAWN,
    playerId: player.id,
    count: 1,
  });

  return { updatedState, events };
}

/**
 * Type guard to check if a decision is a Preparation decision
 */
export function isPreparationDecision(
  decision: { type: string }
): decision is PreparationDecision {
  return decision.type === TACTIC_DECISION_PREPARATION;
}
