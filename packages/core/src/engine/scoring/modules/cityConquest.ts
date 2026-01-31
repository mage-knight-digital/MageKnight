/**
 * City Conquest Scoring Module
 *
 * Calculates scores for city conquest achievements.
 * Used by: Full Conquest, Blitz Conquest, co-op scenarios
 *
 * Scoring rules:
 * - +7 Fame per city led (player with most shields on city)
 * - +4 Fame per city participated (has shield, not leader)
 * - Greatest City Conqueror title: +5 (winner) or +2 (tied)
 */

import type {
  CityConquestModule,
  ModuleScoreResult,
  ModuleScoreBreakdown,
} from "@mage-knight/shared";
import { SCORING_MODULE_CITY_CONQUEST } from "@mage-knight/shared";
import type { GameState } from "../../../state/GameState.js";
import type { CityState } from "../../../types/city.js";

/**
 * Statistics for a player's city conquest participation
 */
interface PlayerCityStats {
  /** Number of cities where player is the leader */
  readonly citiesLed: number;
  /** Number of cities where player has shields but is not leader */
  readonly citiesParticipated: number;
  /** Total shields placed across all cities */
  readonly totalShields: number;
  /** Earliest shield order (for tie-breaking), null if no shields */
  readonly firstShieldOrder: number | null;
}

/**
 * Default stats for players with no participation
 */
const DEFAULT_STATS: PlayerCityStats = {
  citiesLed: 0,
  citiesParticipated: 0,
  totalShields: 0,
  firstShieldOrder: null,
};

/**
 * Calculate a player's city conquest statistics
 */
function calculatePlayerCityStats(
  conqueredCities: readonly CityState[],
  playerId: string
): PlayerCityStats {
  let citiesLed = 0;
  let citiesParticipated = 0;
  let totalShields = 0;
  let firstShieldOrder: number | null = null;

  for (const city of conqueredCities) {
    const playerShields = city.shields.filter((s) => s.playerId === playerId);
    const shieldCount = playerShields.length;

    if (shieldCount > 0) {
      totalShields += shieldCount;

      // Track earliest shield order for tie-breaking
      const minOrder = Math.min(...playerShields.map((s) => s.order));
      if (firstShieldOrder === null || minOrder < firstShieldOrder) {
        firstShieldOrder = minOrder;
      }

      // Check if player leads this city
      if (city.leaderId === playerId) {
        citiesLed += 1;
      } else {
        citiesParticipated += 1;
      }
    }
  }

  return {
    citiesLed,
    citiesParticipated,
    totalShields,
    firstShieldOrder,
  };
}

/**
 * Get stats for a player from the map, with safe fallback
 */
function getPlayerStats(
  playerStats: ReadonlyMap<string, PlayerCityStats>,
  playerId: string
): PlayerCityStats {
  return playerStats.get(playerId) ?? DEFAULT_STATS;
}

/**
 * Determine the title winner based on total shields.
 * Tie-breaker: player who placed their first shield earliest wins.
 */
function determineTitleWinners(
  playerStats: ReadonlyMap<string, PlayerCityStats>,
  playerIds: readonly string[]
): { winnerIds: readonly string[]; isTied: boolean } {
  // Find players with any shields
  const playersWithShields = playerIds.filter(
    (id) => getPlayerStats(playerStats, id).totalShields > 0
  );

  if (playersWithShields.length === 0) {
    return { winnerIds: [], isTied: false };
  }

  // Find max shields
  let maxShields = 0;
  for (const id of playersWithShields) {
    const shields = getPlayerStats(playerStats, id).totalShields;
    if (shields > maxShields) {
      maxShields = shields;
    }
  }

  // Find all players with max shields
  const playersWithMax = playersWithShields.filter(
    (id) => getPlayerStats(playerStats, id).totalShields === maxShields
  );

  if (playersWithMax.length === 1) {
    return { winnerIds: playersWithMax, isTied: false };
  }

  // Tie by shield count: use earliest shield order as tiebreaker
  let earliestOrder = Infinity;
  for (const id of playersWithMax) {
    const stats = getPlayerStats(playerStats, id);
    // Players with shields always have firstShieldOrder set
    const order = stats.firstShieldOrder ?? Infinity;
    if (order < earliestOrder) {
      earliestOrder = order;
    }
  }

  // Find all players who have the earliest order (may still be tied)
  const winnersWithEarliestOrder = playersWithMax.filter((id) => {
    const stats = getPlayerStats(playerStats, id);
    return stats.firstShieldOrder === earliestOrder;
  });

  return {
    winnerIds: winnersWithEarliestOrder,
    isTied: winnersWithEarliestOrder.length > 1,
  };
}

/**
 * Calculate city conquest scores for all players.
 *
 * @param state - Current game state
 * @param config - City conquest module configuration
 * @returns Array of scoring results, one per player
 */
export function calculateCityConquestScore(
  state: GameState,
  config: CityConquestModule
): readonly ModuleScoreResult[] {
  // Get all conquered cities
  const conqueredCities = Object.values(state.cities).filter(
    (city): city is CityState => city !== undefined && city.isConquered
  );

  // Calculate stats for each player
  const playerStats = new Map<string, PlayerCityStats>();
  for (const player of state.players) {
    playerStats.set(
      player.id,
      calculatePlayerCityStats(conqueredCities, player.id)
    );
  }

  // Determine title winner(s)
  const { winnerIds, isTied } = determineTitleWinners(
    playerStats,
    state.players.map((p) => p.id)
  );
  const winnerIdSet = new Set(winnerIds);

  // Build results for each player
  const results: ModuleScoreResult[] = [];
  for (const player of state.players) {
    const stats = getPlayerStats(playerStats, player.id);
    const leaderScore = stats.citiesLed * config.leaderPoints;
    const participantScore = stats.citiesParticipated * config.participantPoints;
    const basePoints = leaderScore + participantScore;

    // Determine title bonus
    let titleBonus = 0;
    const hasTitle = winnerIdSet.has(player.id);
    if (hasTitle) {
      titleBonus = isTied ? config.titleTiedBonus : config.titleBonus;
    }

    // Build breakdown
    const breakdown: ModuleScoreBreakdown[] = [];
    if (stats.citiesLed > 0) {
      breakdown.push({
        description: "Cities led",
        points: leaderScore,
        quantity: stats.citiesLed,
      });
    }
    if (stats.citiesParticipated > 0) {
      breakdown.push({
        description: "Cities participated",
        points: participantScore,
        quantity: stats.citiesParticipated,
      });
    }

    // Build the result object, conditionally including title
    const result: ModuleScoreResult = {
      moduleType: SCORING_MODULE_CITY_CONQUEST,
      points: basePoints + titleBonus,
      breakdown,
      ...(hasTitle && {
        title: {
          name: config.titleName,
          bonus: titleBonus,
          isTied,
        },
      }),
    };

    results.push(result);
  }

  return results;
}
