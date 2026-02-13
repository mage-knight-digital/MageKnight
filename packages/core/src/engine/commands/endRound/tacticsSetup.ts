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
import { getTacticCard } from "../../../data/tactics/index.js";

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
  // Selection order: player with lowest-numbered tactic card from previous round picks first.
  // state.players still has each player's selectedTactic from the round that just ended.
  // Build a map of player ID → previous tactic turn order number
  const previousTacticOrder = new Map<string, number>();
  for (const player of state.players) {
    if (player.selectedTactic !== null) {
      previousTacticOrder.set(
        player.id,
        getTacticCard(player.selectedTactic).turnOrder
      );
    }
  }

  const tacticsSelectionOrder = [...updatedPlayers]
    .map((p, turnOrderIndex) => ({
      id: p.id,
      previousTurnOrder: previousTacticOrder.get(p.id) ?? Infinity,
      turnOrderIndex, // Position in turn order for tie-breaking
    }))
    .sort((a, b) => {
      // Sort by previous tactic's turn order number ascending (lowest picks first)
      if (a.previousTurnOrder !== b.previousTurnOrder) {
        return a.previousTurnOrder - b.previousTurnOrder;
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
