/**
 * Select Tactic command - handles a player selecting their tactic card
 *
 * This command is used during the tactics selection phase at the start of each round.
 * It handles:
 * - Validating the selection (correct phase, correct player, tactic available)
 * - Assigning the tactic to the player
 * - Removing it from the available pool
 * - Advancing to the next selector or ending the phase
 * - Setting turn order based on tactic numbers when phase ends
 * - Solo mode: After human selects, dummy player auto-selects random tactic
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { GameEvent, TacticId } from "@mage-knight/shared";
import {
  ROUND_PHASE_TACTICS_SELECTION,
  ROUND_PHASE_PLAYER_TURNS,
  TACTIC_SELECTED,
  DUMMY_TACTIC_SELECTED,
  TACTICS_PHASE_ENDED,
  INVALID_ACTION,
  getTacticsForTimeOfDay,
  DUMMY_TACTIC_AFTER_HUMANS,
} from "@mage-knight/shared";
import { getTacticCard } from "../../data/tactics.js";
import { SELECT_TACTIC_COMMAND } from "./commandTypes.js";
import { randomElement, type RngState } from "../../utils/rng.js";

export { SELECT_TACTIC_COMMAND };

export interface SelectTacticCommandArgs {
  readonly playerId: string;
  readonly tacticId: TacticId;
}

/**
 * Validate tactic selection
 */
function validateSelection(
  state: GameState,
  playerId: string,
  tacticId: TacticId
): string | null {
  // Must be in tactics selection phase
  if (state.roundPhase !== ROUND_PHASE_TACTICS_SELECTION) {
    return "Not in tactics selection phase";
  }

  // Must be the current selector
  if (state.currentTacticSelector !== playerId) {
    return `Not your turn to select. Current selector: ${state.currentTacticSelector}`;
  }

  // Tactic must match time of day (check before availability)
  const validTactics = getTacticsForTimeOfDay(state.timeOfDay);
  if (!validTactics.includes(tacticId)) {
    return `Tactic ${tacticId} is not available during ${state.timeOfDay}`;
  }

  // Tactic must be available (not already selected by another player)
  if (!state.availableTactics.includes(tacticId)) {
    return "Tactic not available (already selected by another player)";
  }

  return null;
}

/**
 * Calculate turn order based on selected tactics
 * Lower turn order number goes first
 */
function calculateTurnOrder(players: readonly Player[]): string[] {
  // Sort players by their tactic's turn order number
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

export function createSelectTacticCommand(
  args: SelectTacticCommandArgs
): Command {
  const { playerId, tacticId } = args;

  return {
    type: SELECT_TACTIC_COMMAND,
    playerId,
    isReversible: false, // Cannot undo tactic selection

    execute(state: GameState): CommandResult {
      const events: GameEvent[] = [];

      // Validate
      const error = validateSelection(state, playerId, tacticId);
      if (error) {
        events.push({
          type: INVALID_ACTION,
          playerId,
          actionType: SELECT_TACTIC_COMMAND,
          reason: error,
        });
        return { state, events };
      }

      const tacticCard = getTacticCard(tacticId);

      // Update the player with their selected tactic
      const updatedPlayers = state.players.map((p) =>
        p.id === playerId
          ? { ...p, selectedTactic: tacticId, tacticFlipped: false }
          : p
      );

      // Remove tactic from available pool
      const updatedAvailableTactics = state.availableTactics.filter(
        (t) => t !== tacticId
      );

      // Emit selection event
      events.push({
        type: TACTIC_SELECTED,
        playerId,
        tacticId,
        turnOrder: tacticCard.turnOrder,
      });

      // Determine next selector
      const currentIndex = state.tacticsSelectionOrder.indexOf(playerId);
      const nextIndex = currentIndex + 1;
      const isLastSelector = nextIndex >= state.tacticsSelectionOrder.length;

      if (isLastSelector) {
        // All human players have selected
        // Check if we need to handle dummy player tactic selection (solo mode)
        let finalAvailableTactics = updatedAvailableTactics;
        let dummyTactic: TacticId | null = null;
        let rng: RngState = state.rng;

        if (state.scenarioConfig.dummyTacticOrder === DUMMY_TACTIC_AFTER_HUMANS) {
          // Solo mode: Dummy player picks random tactic from remaining
          if (finalAvailableTactics.length > 0) {
            const result = randomElement([...finalAvailableTactics], rng);
            // We checked length > 0, so value is guaranteed to be defined
            dummyTactic = result.value as TacticId;
            rng = result.rng;

            // Remove dummy's tactic from available pool
            finalAvailableTactics = finalAvailableTactics.filter(t => t !== dummyTactic);

            const dummyTacticCard = getTacticCard(dummyTactic);
            events.push({
              type: DUMMY_TACTIC_SELECTED,
              tacticId: dummyTactic,
              turnOrder: dummyTacticCard.turnOrder,
            });
          }
        }

        // End tactics phase
        const newTurnOrder = calculateTurnOrder(updatedPlayers);

        events.push({
          type: TACTICS_PHASE_ENDED,
          turnOrder: newTurnOrder,
        });

        return {
          state: {
            ...state,
            players: updatedPlayers,
            availableTactics: finalAvailableTactics,
            dummyPlayerTactic: dummyTactic,
            roundPhase: ROUND_PHASE_PLAYER_TURNS,
            currentTacticSelector: null,
            turnOrder: newTurnOrder,
            currentPlayerIndex: 0, // First player in new turn order starts
            rng,
          },
          events,
        };
      } else {
        // Move to next selector
        const nextSelector = state.tacticsSelectionOrder[nextIndex] ?? null;

        return {
          state: {
            ...state,
            players: updatedPlayers,
            availableTactics: updatedAvailableTactics,
            currentTacticSelector: nextSelector,
          },
          events,
        };
      }
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo SELECT_TACTIC");
    },
  };
}
