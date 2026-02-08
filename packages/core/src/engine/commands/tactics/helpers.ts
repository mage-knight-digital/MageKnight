/**
 * Shared helpers for tactic commands
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { GameEvent, TacticId } from "@mage-knight/shared";
import {
  ROUND_PHASE_TACTICS_SELECTION,
  ROUND_PHASE_PLAYER_TURNS,
  TACTIC_SPARING_POWER,
} from "@mage-knight/shared";
import { getTacticCard } from "../../../data/tactics/index.js";
import { DUMMY_PLAYER_ID, isDummyPlayer } from "../../../types/dummyPlayer.js";
import { executeDummyPlayerTurn } from "../dummyTurnCommand.js";

/**
 * Calculate turn order based on selected tactics.
 * Lower turn order number goes first.
 *
 * If a dummy player tactic is provided, the dummy is inserted into
 * the turn order at its tactic's position.
 */
export function calculateTurnOrder(
  players: readonly Player[],
  dummyPlayerTactic?: TacticId | null
): string[] {
  const entries: Array<{ playerId: string; turnOrder: number }> = [];

  for (const player of players) {
    if (player.selectedTactic !== null) {
      entries.push({
        playerId: player.id,
        turnOrder: getTacticCard(player.selectedTactic).turnOrder,
      });
    }
  }

  // Include dummy player if it has a tactic
  if (dummyPlayerTactic) {
    entries.push({
      playerId: DUMMY_PLAYER_ID,
      turnOrder: getTacticCard(dummyPlayerTactic).turnOrder,
    });
  }

  entries.sort((a, b) => a.turnOrder - b.turnOrder);
  return entries.map((p) => p.playerId);
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
    const newTurnOrder = calculateTurnOrder(currentState.players, currentState.dummyPlayerTactic);

    let resultState: GameState = {
      ...currentState,
      players: [...currentState.players],
      roundPhase: ROUND_PHASE_PLAYER_TURNS,
      currentTacticSelector: null,
      turnOrder: newTurnOrder,
      currentPlayerIndex: 0,
    };
    const events = [...existingEvents];

    // If dummy is first in turn order, execute its turn and advance
    let startIndex = 0;
    if (newTurnOrder[0] && isDummyPlayer(newTurnOrder[0])) {
      const dummyResult = executeDummyPlayerTurn(resultState);
      resultState = dummyResult.state;
      events.push(...dummyResult.events);
      startIndex = 1 % newTurnOrder.length;
      resultState = { ...resultState, currentPlayerIndex: startIndex };
    }

    // Check if first human player needs Sparing Power before-turn decision
    const firstPlayerId = newTurnOrder[startIndex];
    const playersForTurns: Player[] = [...resultState.players];

    if (firstPlayerId && !isDummyPlayer(firstPlayerId)) {
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
        ...resultState,
        players: playersForTurns,
      },
      events,
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
