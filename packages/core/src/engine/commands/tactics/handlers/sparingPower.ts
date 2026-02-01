/**
 * Sparing Power tactic handler (Night 6)
 *
 * Before your turn, choose to either:
 * - STASH: Take top card of deck and store it under the tactic card
 * - TAKE: Put all stored cards into hand and flip the tactic
 */

import type { GameState } from "../../../../state/GameState.js";
import type { Player } from "../../../../types/player.js";
import type { GameEvent, CardId, ResolveTacticDecisionPayload } from "@mage-knight/shared";
import {
  CARD_DRAWN,
  TACTIC_DECISION_SPARING_POWER,
  SPARING_POWER_CHOICE_STASH,
  SPARING_POWER_CHOICE_TAKE,
} from "@mage-knight/shared";
import type { TacticResolutionResult } from "../types.js";

/**
 * Type for Sparing Power decision
 */
export type SparingPowerDecision = Extract<
  ResolveTacticDecisionPayload,
  { type: typeof TACTIC_DECISION_SPARING_POWER }
>;

/**
 * Validate Sparing Power decision
 */
export function validateSparingPower(
  _state: GameState,
  player: Player,
  decision: SparingPowerDecision
): string | null {
  if (decision.choice === SPARING_POWER_CHOICE_STASH) {
    // Cannot stash if deck is empty
    if (player.deck.length === 0) {
      return "Cannot stash - deck is empty";
    }
  }
  // "take" is always valid (can take even if no cards stored, just flips tactic)

  return null;
}

/**
 * Resolve Sparing Power decision
 *
 * STASH: Take top card of deck and put under tactic
 * TAKE: Put all stored cards into hand and flip tactic
 */
export function resolveSparingPower(
  state: GameState,
  player: Player,
  decision: SparingPowerDecision
): TacticResolutionResult {
  const events: GameEvent[] = [];
  let updatedState = state;

  if (decision.choice === SPARING_POWER_CHOICE_STASH) {
    // Stash: Take top card of deck and put under tactic
    const topCard = player.deck[0];
    if (topCard) {
      const newDeck = player.deck.slice(1);
      const currentStored = player.tacticState.sparingPowerStored ?? [];
      const newStored = [...currentStored, topCard];

      const updatedPlayers = updatedState.players.map((p) =>
        p.id === player.id
          ? ({
              ...p,
              deck: newDeck,
              tacticState: {
                ...p.tacticState,
                sparingPowerStored: newStored,
              },
              pendingTacticDecision: null,
              beforeTurnTacticPending: false,
            } as Player)
          : p
      );

      updatedState = {
        ...updatedState,
        players: updatedPlayers,
      };
    }
  } else if (decision.choice === SPARING_POWER_CHOICE_TAKE) {
    // Take: Put all stored cards into hand and flip tactic
    const storedCards = player.tacticState.sparingPowerStored ?? [];
    const newHand: CardId[] = [...player.hand, ...storedCards];

    const updatedPlayers: Player[] = updatedState.players.map((p) =>
      p.id === player.id
        ? {
            ...p,
            hand: newHand,
            tacticFlipped: true, // Flip the tactic
            tacticState: {
              ...p.tacticState,
              sparingPowerStored: [], // Clear stored cards (empty array, not undefined)
            },
            pendingTacticDecision: null,
            beforeTurnTacticPending: false,
          }
        : p
    );

    updatedState = {
      ...updatedState,
      players: updatedPlayers,
    };

    if (storedCards.length > 0) {
      events.push({
        type: CARD_DRAWN,
        playerId: player.id,
        count: storedCards.length,
      });
    }
  }

  return { updatedState, events };
}

/**
 * Type guard to check if a decision is a Sparing Power decision
 */
export function isSparingPowerDecision(
  decision: { type: string }
): decision is SparingPowerDecision {
  return decision.type === TACTIC_DECISION_SPARING_POWER;
}
