/**
 * Base Score Calculation
 *
 * Calculates the base score for each player based on the scoring mode:
 * - individual_fame: Each player's own Fame
 * - lowest_fame: Minimum Fame across all players (co-op)
 * - victory_points: Reserved for alternative scoring (returns 0)
 * - none: No base score (returns 0)
 */

import type { Player } from "../../types/player.js";
import type { BaseScoreMode } from "@mage-knight/shared";
import {
  BASE_SCORE_INDIVIDUAL_FAME,
  BASE_SCORE_LOWEST_FAME,
  BASE_SCORE_VICTORY_POINTS,
  BASE_SCORE_NONE,
} from "@mage-knight/shared";

/**
 * Calculate base score for each player based on the scoring mode.
 *
 * @param players - All players in the game
 * @param mode - The base score calculation mode
 * @returns Map of player ID to base score
 */
export function calculateBaseScores(
  players: readonly Player[],
  mode: BaseScoreMode
): Map<string, number> {
  switch (mode) {
    case BASE_SCORE_INDIVIDUAL_FAME:
      // Each player uses their own Fame
      return new Map(players.map((p) => [p.id, p.fame]));

    case BASE_SCORE_LOWEST_FAME: {
      // Co-op: All players use the lowest Fame among all players
      const lowestFame =
        players.length > 0 ? Math.min(...players.map((p) => p.fame)) : 0;
      return new Map(players.map((p) => [p.id, lowestFame]));
    }

    case BASE_SCORE_VICTORY_POINTS:
      // Alternative scoring system - not Fame-based
      // Return 0 for now; future scenarios may define victory points differently
      return new Map(players.map((p) => [p.id, 0]));

    case BASE_SCORE_NONE:
      // No base score - scoring comes only from achievements/modules
      return new Map(players.map((p) => [p.id, 0]));

    default: {
      // Exhaustive check - TypeScript will error if new mode added without handling
      const _exhaustive: never = mode;
      throw new Error(`Unknown base score mode: ${String(_exhaustive)}`);
    }
  }
}
