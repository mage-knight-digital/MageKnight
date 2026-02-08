/**
 * Standard Achievements Scoring System
 *
 * Implements the title bonus/penalty logic for competitive multiplayer:
 * - Winner of each category gets +3 Fame (or -3 for Greatest Beating)
 * - Tied players each get +1 Fame (or -1 for Greatest Beating)
 * - Special case: No bonus if tied at 0 for Greatest Knowledge
 * - Special case: No penalty if tied at 0 wounds for Greatest Beating
 *
 * For solo mode, only base scores are calculated (no titles).
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  AchievementCategory,
  AchievementCategoryScore,
  AchievementScoreResult,
  AchievementsConfig,
  PlayerScoreResult,
  FinalScoreResult,
  ScenarioScoringConfig,
} from "@mage-knight/shared";
import {
  ACHIEVEMENT_GREATEST_KNOWLEDGE,
  ACHIEVEMENT_GREATEST_LOOT,
  ACHIEVEMENT_GREATEST_LEADER,
  ACHIEVEMENT_GREATEST_CONQUEROR,
  ACHIEVEMENT_GREATEST_ADVENTURER,
  ACHIEVEMENT_GREATEST_BEATING,
  ALL_ACHIEVEMENT_CATEGORIES,
  TITLE_BONUS_WINNER,
  TITLE_BONUS_TIED,
  TITLE_PENALTY_MOST_WOUNDS,
  TITLE_PENALTY_MOST_WOUNDS_TIED,
  ACHIEVEMENT_MODE_COMPETITIVE,
  ACHIEVEMENT_MODE_SOLO,
  BASE_SCORE_INDIVIDUAL_FAME,
} from "@mage-knight/shared";
import type { ModuleScoreResult } from "@mage-knight/shared";
import { ACHIEVEMENT_CALCULATORS } from "./achievementCalculators.js";
import { calculateModuleScores } from "./modules/index.js";
import { calculateBaseScores } from "./baseScore.js";

/**
 * Configuration for an achievement category's title logic.
 */
interface CategoryTitleConfig {
  /** Bonus for sole winner */
  readonly winnerBonus: number;
  /** Bonus when tied */
  readonly tiedBonus: number;
  /** If true, no bonus/penalty when tied at score of 0 */
  readonly zeroTieException: boolean;
  /** If true, "winner" is the player with the lowest (most negative) score */
  readonly isNegative: boolean;
}

/**
 * Title configuration for each achievement category.
 */
const CATEGORY_TITLE_CONFIG: Record<AchievementCategory, CategoryTitleConfig> = {
  [ACHIEVEMENT_GREATEST_KNOWLEDGE]: {
    winnerBonus: TITLE_BONUS_WINNER,
    tiedBonus: TITLE_BONUS_TIED,
    zeroTieException: true, // No bonus if tied at 0
    isNegative: false,
  },
  [ACHIEVEMENT_GREATEST_LOOT]: {
    winnerBonus: TITLE_BONUS_WINNER,
    tiedBonus: TITLE_BONUS_TIED,
    zeroTieException: false,
    isNegative: false,
  },
  [ACHIEVEMENT_GREATEST_LEADER]: {
    winnerBonus: TITLE_BONUS_WINNER,
    tiedBonus: TITLE_BONUS_TIED,
    zeroTieException: false,
    isNegative: false,
  },
  [ACHIEVEMENT_GREATEST_CONQUEROR]: {
    winnerBonus: TITLE_BONUS_WINNER,
    tiedBonus: TITLE_BONUS_TIED,
    zeroTieException: false,
    isNegative: false,
  },
  [ACHIEVEMENT_GREATEST_ADVENTURER]: {
    winnerBonus: TITLE_BONUS_WINNER,
    tiedBonus: TITLE_BONUS_TIED,
    zeroTieException: false,
    isNegative: false,
  },
  [ACHIEVEMENT_GREATEST_BEATING]: {
    winnerBonus: TITLE_PENALTY_MOST_WOUNDS, // -3 (penalty)
    tiedBonus: TITLE_PENALTY_MOST_WOUNDS_TIED, // -1 (penalty)
    zeroTieException: true, // No penalty if tied at 0 wounds
    isNegative: true, // "Winner" is the one with most wounds (lowest/most negative score)
  },
};

/**
 * Calculate base scores for all players for a single category.
 */
function calculateCategoryBaseScores(
  category: AchievementCategory,
  players: readonly Player[],
  state: GameState
): Map<string, number> {
  const scores = new Map<string, number>();
  const calculator = ACHIEVEMENT_CALCULATORS[category];

  for (const player of players) {
    scores.set(player.id, calculator(player, state));
  }

  return scores;
}

/**
 * Determine title winners for a category.
 * Returns the player IDs who won/tied, and the bonus each gets.
 */
function determineCategoryWinners(
  category: AchievementCategory,
  baseScores: Map<string, number>,
  config?: AchievementsConfig
): { winners: string[]; bonuses: Map<string, number> } {
  const titleConfig = CATEGORY_TITLE_CONFIG[category];
  const bonuses = new Map<string, number>();

  // Convert to array for sorting
  const entries = Array.from(baseScores.entries());

  if (entries.length === 0) {
    return { winners: [], bonuses };
  }

  // Sort by score
  // For negative categories (Greatest Beating), "winner" is the one with lowest score
  if (titleConfig.isNegative) {
    // Sort ascending (most negative first = most wounds)
    entries.sort((a, b) => a[1] - b[1]);
  } else {
    // Sort descending (highest first)
    entries.sort((a, b) => b[1] - a[1]);
  }

  const firstEntry = entries[0];
  if (!firstEntry) {
    return { winners: [], bonuses };
  }
  const bestScore = firstEntry[1];

  // Find all players with the best score (potential ties)
  const winners = entries
    .filter(([, score]) => score === bestScore)
    .map(([playerId]) => playerId);

  const isTied = winners.length > 1;

  // Check for zero-tie exception
  // For Greatest Knowledge: no bonus if everyone tied at 0
  // For Greatest Beating: no penalty if everyone tied at 0 wounds (score = 0)
  // Only applies to ties - a sole winner with 0 score still gets the bonus
  if (titleConfig.zeroTieException && isTied && bestScore === 0) {
    return { winners: [], bonuses };
  }

  // Apply overrides from scenario config if provided
  let winnerBonus = titleConfig.winnerBonus;
  let tiedBonus = titleConfig.tiedBonus;

  if (config?.overrides?.[category]) {
    const override = config.overrides[category];
    if (override.titleBonus !== undefined) {
      winnerBonus = override.titleBonus;
    }
    if (override.titleTiedBonus !== undefined) {
      tiedBonus = override.titleTiedBonus;
    }
  }

  // Award bonuses
  for (const winnerId of winners) {
    bonuses.set(winnerId, isTied ? tiedBonus : winnerBonus);
  }

  return { winners, bonuses };
}

/**
 * Calculate achievement scores for a single category across all players.
 */
function calculateCategoryScores(
  category: AchievementCategory,
  players: readonly Player[],
  state: GameState,
  config: AchievementsConfig
): Map<string, AchievementCategoryScore> {
  const result = new Map<string, AchievementCategoryScore>();

  // Calculate base scores for all players
  const baseScores = calculateCategoryBaseScores(category, players, state);

  // Determine winners (only for competitive mode)
  let winners: string[] = [];
  let bonuses = new Map<string, number>();

  if (config.mode === ACHIEVEMENT_MODE_COMPETITIVE && players.length > 1) {
    const winnerResult = determineCategoryWinners(category, baseScores, config);
    winners = winnerResult.winners;
    bonuses = winnerResult.bonuses;
  }

  // Build result for each player
  for (const player of players) {
    const basePoints = baseScores.get(player.id) ?? 0;
    const titleBonus = bonuses.get(player.id) ?? 0;
    const hasTitle = winners.includes(player.id);
    const isTied = hasTitle && winners.length > 1;

    result.set(player.id, {
      category,
      basePoints,
      titleBonus,
      totalPoints: basePoints + titleBonus,
      hasTitle,
      isTied,
    });
  }

  return result;
}

/**
 * Calculate full achievement results for all players.
 */
export function calculateAchievementResults(
  players: readonly Player[],
  state: GameState,
  config: AchievementsConfig
): Map<string, AchievementScoreResult> {
  const results = new Map<string, AchievementScoreResult>();

  // Initialize results for each player
  for (const player of players) {
    results.set(player.id, {
      categoryScores: [],
      totalAchievementPoints: 0,
    });
  }

  // Calculate each category
  for (const category of ALL_ACHIEVEMENT_CATEGORIES) {
    const categoryResults = calculateCategoryScores(
      category,
      players,
      state,
      config
    );

    // Add category results to each player's achievement result
    for (const player of players) {
      const playerResult = results.get(player.id);
      const categoryScore = categoryResults.get(player.id);

      if (playerResult && categoryScore) {
        results.set(player.id, {
          categoryScores: [...playerResult.categoryScores, categoryScore],
          totalAchievementPoints:
            playerResult.totalAchievementPoints + categoryScore.totalPoints,
        });
      }
    }
  }

  return results;
}

/**
 * Group module results by module, then extract per-player results.
 *
 * The module dispatcher returns a flat array of results where each module
 * contributes one result per player (in player order). This function
 * reorganizes the results so we can easily get all module results for a
 * specific player.
 *
 * @param allModuleResults - Flat array from calculateModuleScores
 * @param moduleCount - Number of modules configured
 * @param playerCount - Number of players
 * @returns Array indexed by player, containing their module results
 */
function groupModuleResultsByPlayer(
  allModuleResults: readonly ModuleScoreResult[],
  moduleCount: number,
  playerCount: number
): ModuleScoreResult[][] {
  // Each module returns playerCount results, in player order
  // So allModuleResults has length = moduleCount * playerCount
  // Results are laid out as:
  //   [module0_player0, module0_player1, ..., module1_player0, module1_player1, ...]

  // Initialize per-player arrays
  const resultsByPlayer: ModuleScoreResult[][] = Array.from(
    { length: playerCount },
    () => []
  );

  for (let moduleIdx = 0; moduleIdx < moduleCount; moduleIdx++) {
    const moduleStartOffset = moduleIdx * playerCount;
    for (let playerIdx = 0; playerIdx < playerCount; playerIdx++) {
      const result = allModuleResults[moduleStartOffset + playerIdx];
      if (result) {
        resultsByPlayer[playerIdx]?.push(result);
      }
    }
  }

  return resultsByPlayer;
}

/**
 * Calculate complete final scores for all players.
 *
 * This is the main scoring orchestration function that combines:
 * 1. Base scores (based on baseScoreMode: individual_fame, lowest_fame, etc.)
 * 2. Achievement scores (if enabled)
 * 3. Module scores (city conquest, time efficiency, etc.)
 *
 * @param state - Current game state
 * @param scoringConfig - Scenario-specific scoring configuration
 * @returns Complete final score results including rankings and tie detection
 */
export function calculateFinalScores(
  state: GameState,
  scoringConfig: ScenarioScoringConfig
): FinalScoreResult {
  const players = state.players;
  const playerResults: PlayerScoreResult[] = [];

  // Step 1: Calculate base scores for all players based on mode
  const baseScorePerPlayer = calculateBaseScores(players, scoringConfig.baseScoreMode);

  // Step 2: Calculate achievement results if enabled
  let achievementResults: Map<string, AchievementScoreResult> | null = null;
  if (scoringConfig.achievements.enabled) {
    achievementResults = calculateAchievementResults(
      players,
      state,
      scoringConfig.achievements
    );
  }

  // Step 3: Calculate module scores if any modules enabled
  const allModuleResults =
    scoringConfig.modules.length > 0
      ? calculateModuleScores(state, scoringConfig.modules)
      : [];

  // Group module results by player for easy lookup
  const moduleResultsByPlayer = groupModuleResultsByPlayer(
    allModuleResults,
    scoringConfig.modules.length,
    players.length
  );

  // Step 4: Build player results
  for (let playerIndex = 0; playerIndex < players.length; playerIndex++) {
    const player = players[playerIndex];
    if (!player) continue;

    // Base score
    const baseScore = baseScorePerPlayer.get(player.id) ?? 0;

    // Achievement points
    const achievements = achievementResults?.get(player.id);
    const achievementPoints = achievements?.totalAchievementPoints ?? 0;

    // Module results and points for this player
    const moduleResults = moduleResultsByPlayer[playerIndex] ?? [];
    const modulePoints = moduleResults.reduce((sum, r) => sum + r.points, 0);

    // Total score
    const totalScore = baseScore + achievementPoints + modulePoints;

    const playerResult: PlayerScoreResult = {
      playerId: player.id,
      baseScore,
      moduleResults,
      totalScore,
    };

    // Add achievements if they were calculated
    if (achievements) {
      playerResults.push({
        ...playerResult,
        achievements,
      });
    } else {
      playerResults.push(playerResult);
    }
  }

  // Step 5: Sort by total score descending to determine rankings
  const sortedResults = [...playerResults].sort(
    (a, b) => b.totalScore - a.totalScore
  );
  const rankings = sortedResults.map((r) => r.playerId);

  // Step 6: Check for tie (first and second place have same score)
  const firstResult = sortedResults[0];
  const secondResult = sortedResults[1];
  const isTied =
    sortedResults.length > 1 &&
    firstResult !== undefined &&
    secondResult !== undefined &&
    firstResult.totalScore === secondResult.totalScore;

  return {
    config: scoringConfig,
    playerResults,
    rankings,
    isTied,
  };
}

/**
 * Create a default scoring config for standard achievements.
 * Used when scenarios don't specify a custom scoring config.
 */
export function createDefaultScoringConfig(
  isSolo: boolean
): ScenarioScoringConfig {
  return {
    baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
    achievements: {
      enabled: true,
      mode: isSolo ? ACHIEVEMENT_MODE_SOLO : ACHIEVEMENT_MODE_COMPETITIVE,
    },
    modules: [],
  };
}
