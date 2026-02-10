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
import { ROUND_ENDED, GAME_ENDED, GAME_PHASE_END } from "@mage-knight/shared";
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
  const reachedRoundLimit = oldRound >= state.scenarioConfig.totalRounds;
  const shouldEndFromFinalTurns =
    state.scenarioEndTriggered &&
    state.finalTurnsRemaining !== null &&
    state.finalTurnsRemaining > 0;

  // End conditions:
  // 1. Round ended during final turns after scenario trigger.
  // 2. Scenario round limit reached.
  if (!shouldEndFromFinalTurns && !reachedRoundLimit) {
    return { gameEnded: false, events: [] };
  }

  const events: GameEvent[] = [];

  // Calculate final scores using the full scoring system
  // Use scenario's scoringConfig if provided, otherwise fall back to default
  const isSolo = state.players.length === 1;
  const scoringConfig =
    state.scenarioConfig.scoringConfig ?? createDefaultScoringConfig(isSolo);
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
    fullScoreResult: finalScoreResult,
  });

  return {
    gameEnded: true,
    events,
    state: {
      phase: GAME_PHASE_END,
      finalTurnsRemaining: 0,
      gameEnded: true,
      winningPlayerId,
      finalScoreResult,
    },
    finalScoreResult,
  };
}
