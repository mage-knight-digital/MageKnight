/**
 * Game End Detection for End Round
 *
 * Checks if the game should end (when round ends during final turns)
 * and calculates final scores.
 *
 * Rulebook: "If the Round ends during this [final turns], the game ends immediately."
 *
 * @module commands/endRound/gameEnd
 */

import type { GameState } from "../../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import { ROUND_ENDED, GAME_ENDED } from "@mage-knight/shared";
import {
  calculateFinalScores,
  createDefaultScoringConfig,
} from "../../scoring/index.js";
import type { GameEndCheckResult } from "./types.js";

/**
 * Check if the game should end due to round ending during final turns.
 * If so, calculate final scores and return game end state.
 */
export function checkGameEnd(
  state: GameState,
  oldRound: number
): GameEndCheckResult {
  // Check if we're in final turns (scenario end was triggered)
  if (
    !state.scenarioEndTriggered ||
    state.finalTurnsRemaining === null ||
    state.finalTurnsRemaining <= 0
  ) {
    return { gameEnded: false, events: [] };
  }

  const events: GameEvent[] = [];

  // Calculate final scores using the full scoring system
  const isSolo = state.players.length === 1;
  const scoringConfig = createDefaultScoringConfig(isSolo);
  const finalScoreResult = calculateFinalScores(state, scoringConfig);

  // Convert to simple format for event
  const finalScores = finalScoreResult.playerResults.map((r) => ({
    playerId: r.playerId,
    score: r.totalScore,
  }));

  // Determine winner (highest score, or null if tied)
  const winningPlayerId = finalScoreResult.isTied
    ? null
    : finalScoreResult.rankings[0] ?? null;

  events.push({
    type: ROUND_ENDED,
    round: oldRound,
  });

  events.push({
    type: GAME_ENDED,
    winningPlayerId,
    finalScores,
  });

  return {
    gameEnded: true,
    events,
    state: {
      finalTurnsRemaining: 0,
      gameEnded: true,
      winningPlayerId,
      finalScoreResult,
    },
    finalScoreResult,
  };
}
