/**
 * Shared helpers for tactic commands
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  ROUND_PHASE_TACTICS_SELECTION,
  ROUND_PHASE_PLAYER_TURNS,
  TACTIC_SPARING_POWER,
} from "@mage-knight/shared";
import { getTacticCard } from "../../../data/tactics/index.js";

/**
 * Calculate turn order based on selected tactics
 * Lower turn order number goes first
 *
 * This is used by both selectTacticCommand and resolveTacticDecisionCommand
 * to determine player order after tactics selection completes.
 */
export function calculateTurnOrder(players: readonly Player[]): string[] {
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

export interface PhaseTransitionResult {
  readonly state: GameState;
  readonly events: GameEvent[];
}

/**
 * Handle phase transition after a tactic decision is resolved during tactics selection.
 *
 * If in tactics selection phase:
 * - If last selector, ends tactics phase and sets up player turns
 * - Otherwise, advances to next selector
 *
 * Returns the updated state with phase transition applied.
 */
export function handlePhaseTransitionAfterDecision(
  currentState: GameState,
  playerId: string,
  existingEvents: GameEvent[]
): PhaseTransitionResult {
  // If not in tactics selection phase, no transition needed
  if (currentState.roundPhase !== ROUND_PHASE_TACTICS_SELECTION) {
    return { state: currentState, events: existingEvents };
  }

  const currentIndex = currentState.tacticsSelectionOrder.indexOf(playerId);
  const nextIndex = currentIndex + 1;
  const isLastSelector = nextIndex >= currentState.tacticsSelectionOrder.length;

  if (isLastSelector) {
    // End tactics phase
    const newTurnOrder = calculateTurnOrder(currentState.players);

    // Check if first player needs Sparing Power before-turn decision
    const firstPlayerId = newTurnOrder[0];
    const playersForTurns: Player[] = [...currentState.players];

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
        ...currentState,
        players: playersForTurns,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
        currentTacticSelector: null,
        turnOrder: newTurnOrder,
        currentPlayerIndex: 0,
      },
      events: existingEvents,
    };
  } else {
    // Move to next selector
    const nextSelector = currentState.tacticsSelectionOrder[nextIndex] ?? null;

    return {
      state: {
        ...currentState,
        currentTacticSelector: nextSelector,
      },
      events: existingEvents,
    };
  }
}
