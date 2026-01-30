/**
 * Scoring system exports for Mage Knight
 *
 * This module provides the type definitions and constants for the scoring system.
 * Based on the scoring system architecture design (#443).
 */

// Re-export all types
export type {
  // Base score modes
  BaseScoreMode,
  // Achievement configuration
  AchievementMode,
  AchievementCategory,
  AchievementCategoryOverride,
  AchievementsConfig,
  // Scoring module types
  ScoringModuleType,
  CityConquestModule,
  TimeEfficiencyModule,
  ObjectiveConfig,
  ObjectiveCompletionModule,
  MineModule,
  RelicModule,
  FactionModule,
  VolkareModule,
  ScoringModuleConfig,
  // Scenario configuration
  ScenarioScoringConfig,
  // Result types
  AchievementCategoryScore,
  AchievementScoreResult,
  ModuleScoreResult,
  ModuleScoreBreakdown,
  PlayerScoreResult,
  FinalScoreResult,
} from "./types.js";

// Re-export all constants
export {
  // Base score mode constants
  BASE_SCORE_INDIVIDUAL_FAME,
  BASE_SCORE_LOWEST_FAME,
  BASE_SCORE_VICTORY_POINTS,
  BASE_SCORE_NONE,
  // Achievement mode constants
  ACHIEVEMENT_MODE_COMPETITIVE,
  ACHIEVEMENT_MODE_SOLO,
  ACHIEVEMENT_MODE_COOP_BEST_ONLY,
  // Achievement category constants
  ACHIEVEMENT_GREATEST_KNOWLEDGE,
  ACHIEVEMENT_GREATEST_LOOT,
  ACHIEVEMENT_GREATEST_LEADER,
  ACHIEVEMENT_GREATEST_CONQUEROR,
  ACHIEVEMENT_GREATEST_ADVENTURER,
  ACHIEVEMENT_GREATEST_BEATING,
  ALL_ACHIEVEMENT_CATEGORIES,
  // Scoring module type constants
  SCORING_MODULE_CITY_CONQUEST,
  SCORING_MODULE_TIME_EFFICIENCY,
  SCORING_MODULE_OBJECTIVE_COMPLETION,
  SCORING_MODULE_MINE,
  SCORING_MODULE_RELIC,
  SCORING_MODULE_FACTION,
  SCORING_MODULE_VOLKARE,
  ALL_SCORING_MODULE_TYPES,
  // Scoring value constants
  TITLE_BONUS_WINNER,
  TITLE_BONUS_TIED,
  TITLE_PENALTY_MOST_WOUNDS,
  TITLE_PENALTY_MOST_WOUNDS_TIED,
  POINTS_PER_SPELL,
  POINTS_PER_ADVANCED_ACTION,
  POINTS_PER_ARTIFACT,
  CRYSTALS_PER_POINT,
  POINTS_PER_FORTIFIED_SHIELD,
  POINTS_PER_ADVENTURE_SHIELD,
  POINTS_PER_WOUND,
} from "./constants.js";
