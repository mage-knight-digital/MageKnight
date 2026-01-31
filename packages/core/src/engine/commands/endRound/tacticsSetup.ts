/**
 * Tactics Setup for End Round
 *
 * Handles tactics management at the end of a round:
 * - Collect used tactics
 * - Update removed tactics based on scenario config
 * - Set up tactics selection phase for new round
 *
 * @module commands/endRound/tacticsSetup
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { TacticId } from "@mage-knight/shared";
import { getTacticsForTimeOfDay, TACTIC_REMOVAL_ALL_USED } from "@mage-knight/shared";
import type { TacticsSetupResult } from "./types.js";

/**
 * Set up tactics for the new round.
 * Collects used tactics, removes them if needed, and prepares the selection phase.
 */
export function processTacticsSetup(
  state: GameState,
  updatedPlayers: Player[],
  newTime: GameState["timeOfDay"]
): TacticsSetupResult {
  // Collect tactics used this round
  const usedTacticsThisRound: TacticId[] = [];
  for (const player of state.players) {
    if (player.selectedTactic !== null) {
      usedTacticsThisRound.push(player.selectedTactic);
    }
  }
  if (state.dummyPlayerTactic !== null) {
    usedTacticsThisRound.push(state.dummyPlayerTactic);
  }

  // Update removed tactics based on scenario config
  let updatedRemovedTactics = [...state.removedTactics];
  if (state.scenarioConfig.tacticRemovalMode === TACTIC_REMOVAL_ALL_USED) {
    // Solo mode: All used tactics are removed from the game
    updatedRemovedTactics = [...updatedRemovedTactics, ...usedTacticsThisRound];
  }
  // Note: TACTIC_REMOVAL_VOTE_ONE (co-op) would require a separate phase - not implemented yet

  // Set up tactics selection phase
  // Selection order is based on Fame (lowest first)
  // Ties are broken by Round Order token position (current turn order)
  const tacticsSelectionOrder = [...updatedPlayers]
    .map((p, turnOrderIndex) => ({
      id: p.id,
      fame: p.fame,
      turnOrderIndex, // Position in turn order for tie-breaking
    }))
    .sort((a, b) => {
      // Sort by fame ascending (lowest fame picks first)
      if (a.fame !== b.fame) {
        return a.fame - b.fame;
      }
      // Tie-breaker: lower turn order position picks first
      return a.turnOrderIndex - b.turnOrderIndex;
    })
    .map((p) => p.id);

  // Get tactics for the new time of day, filtering out removed ones
  const allTacticsForTime = getTacticsForTimeOfDay(newTime);
  const availableTactics: readonly TacticId[] = allTacticsForTime.filter(
    (t) => !updatedRemovedTactics.includes(t)
  );

  const firstSelector = tacticsSelectionOrder[0] ?? null;

  return {
    removedTactics: updatedRemovedTactics,
    availableTactics,
    tacticsSelectionOrder,
    currentTacticSelector: firstSelector,
    dummyPlayerTactic: null, // Reset for new round
  };
}
