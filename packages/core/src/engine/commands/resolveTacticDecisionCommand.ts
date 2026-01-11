/**
 * Resolve Tactic Decision command - handles resolving pending tactic decisions
 *
 * This command handles resolving player choices for tactics that require decisions:
 * - Rethink (Day 2): Choose cards to discard, shuffle discard into deck, draw that many
 * - Mana Steal (Day 3): Choose a die from the source
 * - Preparation (Night 5): Choose a card from deck
 * - Midnight Meditation (Night 4): Choose cards to shuffle into deck
 * - Sparing Power (Night 6): Choose to stash or take
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  GameEvent,
  CardId,
  ResolveTacticDecisionPayload,
} from "@mage-knight/shared";
import {
  INVALID_ACTION,
  TACTIC_DECISION_RESOLVED,
  CARD_DRAWN,
  ROUND_PHASE_TACTICS_SELECTION,
  ROUND_PHASE_PLAYER_TURNS,
  TACTIC_DECISION_RETHINK,
  TACTIC_DECISION_SPARING_POWER,
  TACTIC_SPARING_POWER,
  SPARING_POWER_CHOICE_STASH,
  SPARING_POWER_CHOICE_TAKE,
} from "@mage-knight/shared";
import { RESOLVE_TACTIC_DECISION_COMMAND } from "./commandTypes.js";
import { shuffleWithRng } from "../../utils/rng.js";
import { getTacticCard } from "../../data/tactics.js";

export { RESOLVE_TACTIC_DECISION_COMMAND };

export interface ResolveTacticDecisionCommandArgs {
  readonly playerId: string;
  readonly decision: ResolveTacticDecisionPayload;
}

/**
 * Validate the tactic decision resolution
 */
function validateResolution(
  state: GameState,
  playerId: string,
  decision: ResolveTacticDecisionPayload
): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return "Player not found";
  }

  // Must have a pending decision
  if (!player.pendingTacticDecision) {
    return "No pending tactic decision to resolve";
  }

  // Decision type must match pending decision type
  if (decision.type !== player.pendingTacticDecision.type) {
    return `Expected decision type ${player.pendingTacticDecision.type}, got ${decision.type}`;
  }

  // Tactic-specific validation
  if (decision.type === TACTIC_DECISION_RETHINK) {
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
  }

  // Sparing Power validation
  if (decision.type === TACTIC_DECISION_SPARING_POWER) {
    if (decision.choice === SPARING_POWER_CHOICE_STASH) {
      // Cannot stash if deck is empty
      if (player.deck.length === 0) {
        return "Cannot stash - deck is empty";
      }
    }
    // "take" is always valid (can take even if no cards stored, just flips tactic)
  }

  return null;
}

/**
 * Calculate turn order based on selected tactics (copied from selectTacticCommand)
 */
function calculateTurnOrder(players: readonly Player[]): string[] {
  const playersWithTactics: Array<{ playerId: string; turnOrder: number }> = [];

  for (const player of players) {
    if (player.selectedTactic !== null) {
      playersWithTactics.push({
        playerId: player.id,
        turnOrder: getTacticCard(player.selectedTactic).turnOrder,
      });
    }
  }

  playersWithTactics.sort((a, b) => a.turnOrder - b.turnOrder);
  return playersWithTactics.map((p) => p.playerId);
}

export function createResolveTacticDecisionCommand(
  args: ResolveTacticDecisionCommandArgs
): Command {
  const { playerId, decision } = args;

  return {
    type: RESOLVE_TACTIC_DECISION_COMMAND,
    playerId,
    isReversible: false, // Cannot undo tactic decisions (they involve shuffling)

    execute(state: GameState): CommandResult {
      const events: GameEvent[] = [];

      // Validate
      const error = validateResolution(state, playerId, decision);
      if (error) {
        events.push({
          type: INVALID_ACTION,
          playerId,
          actionType: RESOLVE_TACTIC_DECISION_COMMAND,
          reason: error,
        });
        return { state, events };
      }

      // Find the player
      const player = state.players.find((p) => p.id === playerId);
      if (!player) {
        return { state, events };
      }

      let updatedState = state;

      // Handle Rethink resolution
      if (decision.type === TACTIC_DECISION_RETHINK) {
        const cardsToDiscard = decision.cardIds;
        const discardCount = cardsToDiscard.length;

        // 1. Remove chosen cards from hand and add to discard
        let newHand = player.hand.filter((c) => !cardsToDiscard.includes(c));
        let newDiscard = [...player.discard, ...cardsToDiscard];

        // 2. Shuffle discard into deck
        const { result: shuffledDeck, rng: rng1 } = shuffleWithRng(
          [...newDiscard],
          state.rng
        );
        newDiscard = [];
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
          p.id === playerId
            ? ({
                ...p,
                hand: newHand,
                deck: newDeck,
                discard: newDiscard,
                pendingTacticDecision: null, // Clear the pending decision
              } as Player)
            : p
        );

        updatedState = {
          ...state,
          players: updatedPlayers,
          rng: rng1,
        };

        if (cardsDrawn > 0) {
          events.push({
            type: CARD_DRAWN,
            playerId,
            count: cardsDrawn,
          });
        }
      }

      // Handle Sparing Power resolution
      if (decision.type === TACTIC_DECISION_SPARING_POWER) {
        if (decision.choice === SPARING_POWER_CHOICE_STASH) {
          // Stash: Take top card of deck and put under tactic
          const topCard = player.deck[0];
          if (topCard) {
            const newDeck = player.deck.slice(1);
            const currentStored = player.tacticState.sparingPowerStored ?? [];
            const newStored = [...currentStored, topCard];

            const updatedPlayers = updatedState.players.map((p) =>
              p.id === playerId
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
            p.id === playerId
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
              playerId,
              count: storedCards.length,
            });
          }
        }
      }

      // Emit resolution event
      events.push({
        type: TACTIC_DECISION_RESOLVED,
        playerId,
        decisionType: decision.type,
      });

      // If we're in tactics selection phase, advance to next selector or end phase
      if (state.roundPhase === ROUND_PHASE_TACTICS_SELECTION) {
        const currentIndex = state.tacticsSelectionOrder.indexOf(playerId);
        const nextIndex = currentIndex + 1;
        const isLastSelector = nextIndex >= state.tacticsSelectionOrder.length;

        if (isLastSelector) {
          // End tactics phase
          const newTurnOrder = calculateTurnOrder(updatedState.players);

          // Check if first player needs Sparing Power before-turn decision
          const firstPlayerId = newTurnOrder[0];
          const playersForTurns: Player[] = [...updatedState.players];
          if (firstPlayerId) {
            const firstPlayerIdx = playersForTurns.findIndex(
              (p) => p.id === firstPlayerId
            );
            if (firstPlayerIdx !== -1) {
              const firstPlayer = playersForTurns[firstPlayerIdx];
              if (
                firstPlayer &&
                firstPlayer.selectedTactic === TACTIC_SPARING_POWER &&
                !firstPlayer.tacticFlipped
              ) {
                const updatedFirstPlayer: Player = {
                  ...firstPlayer,
                  beforeTurnTacticPending: true,
                  pendingTacticDecision: { type: TACTIC_SPARING_POWER },
                };
                playersForTurns[firstPlayerIdx] = updatedFirstPlayer;
              }
            }
          }

          return {
            state: {
              ...updatedState,
              players: playersForTurns,
              roundPhase: ROUND_PHASE_PLAYER_TURNS,
              currentTacticSelector: null,
              turnOrder: newTurnOrder,
              currentPlayerIndex: 0,
            },
            events,
          };
        } else {
          // Move to next selector
          const nextSelector = state.tacticsSelectionOrder[nextIndex] ?? null;

          return {
            state: {
              ...updatedState,
              currentTacticSelector: nextSelector,
            },
            events,
          };
        }
      }

      return { state: updatedState, events };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo RESOLVE_TACTIC_DECISION");
    },
  };
}
