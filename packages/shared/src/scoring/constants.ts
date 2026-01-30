/**
 * Scoring system constants for Mage Knight
 *
 * Constants for base score modes, achievement modes, and achievement categories.
 * Based on the scoring system architecture design (#443).
 */

import type {
  BaseScoreMode,
  AchievementMode,
  AchievementCategory,
  ScoringModuleType,
} from "./types.js";

// =============================================================================
// BASE SCORE MODE CONSTANTS
// =============================================================================

/**
 * Individual Fame - Each player's own Fame (competitive modes)
 */
export const BASE_SCORE_INDIVIDUAL_FAME =
  "individual_fame" as const satisfies BaseScoreMode;

/**
 * Lowest Fame - Use the lowest Fame of all players (co-op modes)
 */
export const BASE_SCORE_LOWEST_FAME =
  "lowest_fame" as const satisfies BaseScoreMode;

/**
 * Victory Points - Alternative scoring system (some team scenarios)
 */
export const BASE_SCORE_VICTORY_POINTS =
  "victory_points" as const satisfies BaseScoreMode;

/**
 * None - No scoring, position/condition-based victory only
 */
export const BASE_SCORE_NONE = "none" as const satisfies BaseScoreMode;

// =============================================================================
// ACHIEVEMENT MODE CONSTANTS
// =============================================================================

/**
 * Competitive - Compare players, award titles to winners
 */
export const ACHIEVEMENT_MODE_COMPETITIVE =
  "competitive" as const satisfies AchievementMode;

/**
 * Solo - No titles (no comparison), just calculate per-category scores
 */
export const ACHIEVEMENT_MODE_SOLO = "solo" as const satisfies AchievementMode;

/**
 * Co-op Best Only - No titles, score only best player per category
 */
export const ACHIEVEMENT_MODE_COOP_BEST_ONLY =
  "coop_best_only" as const satisfies AchievementMode;

// =============================================================================
// ACHIEVEMENT CATEGORY CONSTANTS
// =============================================================================

/**
 * Greatest Knowledge - Spells and Advanced Actions
 * +2 per Spell, +1 per Advanced Action
 * Title: +3 (+1 if tied)
 */
export const ACHIEVEMENT_GREATEST_KNOWLEDGE =
  "greatest_knowledge" as const satisfies AchievementCategory;

/**
 * Greatest Loot - Artifacts and Crystals
 * +2 per Artifact, +1 per 2 crystals
 * Title: +3 (+1 if tied)
 */
export const ACHIEVEMENT_GREATEST_LOOT =
  "greatest_loot" as const satisfies AchievementCategory;

/**
 * Greatest Leader - Unit levels
 * +1 per unit level (wounded units count as half)
 * Title: +3 (+1 if tied)
 */
export const ACHIEVEMENT_GREATEST_LEADER =
  "greatest_leader" as const satisfies AchievementCategory;

/**
 * Greatest Conqueror - Shields on fortified sites
 * +2 per shield on keep/tower/monastery
 * Title: +3 (+1 if tied)
 */
export const ACHIEVEMENT_GREATEST_CONQUEROR =
  "greatest_conqueror" as const satisfies AchievementCategory;

/**
 * Greatest Adventurer - Shields on adventure sites
 * +2 per shield on adventure site
 * Title: +3 (+1 if tied)
 */
export const ACHIEVEMENT_GREATEST_ADVENTURER =
  "greatest_adventurer" as const satisfies AchievementCategory;

/**
 * Greatest Beating - Wounds in deck (negative)
 * -2 per wound in deck
 * Penalty: -3 for most wounds (-1 if tied)
 */
export const ACHIEVEMENT_GREATEST_BEATING =
  "greatest_beating" as const satisfies AchievementCategory;

/**
 * All achievement categories in standard order
 */
export const ALL_ACHIEVEMENT_CATEGORIES: readonly AchievementCategory[] = [
  ACHIEVEMENT_GREATEST_KNOWLEDGE,
  ACHIEVEMENT_GREATEST_LOOT,
  ACHIEVEMENT_GREATEST_LEADER,
  ACHIEVEMENT_GREATEST_CONQUEROR,
  ACHIEVEMENT_GREATEST_ADVENTURER,
  ACHIEVEMENT_GREATEST_BEATING,
] as const;

// =============================================================================
// SCORING MODULE TYPE CONSTANTS
// =============================================================================

/**
 * City Conquest - Points for conquering cities
 */
export const SCORING_MODULE_CITY_CONQUEST =
  "city_conquest" as const satisfies ScoringModuleType;

/**
 * Time Efficiency - Points for early completion (solo/co-op)
 */
export const SCORING_MODULE_TIME_EFFICIENCY =
  "time_efficiency" as const satisfies ScoringModuleType;

/**
 * Objective Completion - Points for completing scenario objectives
 */
export const SCORING_MODULE_OBJECTIVE_COMPLETION =
  "objective_completion" as const satisfies ScoringModuleType;

/**
 * Mine Liberation - Points for liberating mines
 */
export const SCORING_MODULE_MINE = "mine" as const satisfies ScoringModuleType;

/**
 * Relic Hunting - Points for finding relic pieces
 */
export const SCORING_MODULE_RELIC =
  "relic" as const satisfies ScoringModuleType;

/**
 * Faction Enemies - Points for faction-specific achievements
 */
export const SCORING_MODULE_FACTION =
  "faction" as const satisfies ScoringModuleType;

/**
 * Volkare - Points for defeating Volkare (Lost Legion)
 */
export const SCORING_MODULE_VOLKARE =
  "volkare" as const satisfies ScoringModuleType;

/**
 * All scoring module types
 */
export const ALL_SCORING_MODULE_TYPES: readonly ScoringModuleType[] = [
  SCORING_MODULE_CITY_CONQUEST,
  SCORING_MODULE_TIME_EFFICIENCY,
  SCORING_MODULE_OBJECTIVE_COMPLETION,
  SCORING_MODULE_MINE,
  SCORING_MODULE_RELIC,
  SCORING_MODULE_FACTION,
  SCORING_MODULE_VOLKARE,
] as const;

// =============================================================================
// SCORING CONSTANTS
// =============================================================================

/**
 * Standard title bonus for achievement winners
 */
export const TITLE_BONUS_WINNER = 3;

/**
 * Standard title bonus when tied for achievement
 */
export const TITLE_BONUS_TIED = 1;

/**
 * Penalty for most wounds (Greatest Beating)
 */
export const TITLE_PENALTY_MOST_WOUNDS = -3;

/**
 * Penalty when tied for most wounds
 */
export const TITLE_PENALTY_MOST_WOUNDS_TIED = -1;

/**
 * Points per spell for Greatest Knowledge
 */
export const POINTS_PER_SPELL = 2;

/**
 * Points per advanced action for Greatest Knowledge
 */
export const POINTS_PER_ADVANCED_ACTION = 1;

/**
 * Points per artifact for Greatest Loot
 */
export const POINTS_PER_ARTIFACT = 2;

/**
 * Crystals needed for 1 point in Greatest Loot
 */
export const CRYSTALS_PER_POINT = 2;

/**
 * Points per shield on keep/tower/monastery for Greatest Conqueror
 */
export const POINTS_PER_FORTIFIED_SHIELD = 2;

/**
 * Points per shield on adventure site for Greatest Adventurer
 */
export const POINTS_PER_ADVENTURE_SHIELD = 2;

/**
 * Points per wound for Greatest Beating (negative)
 */
export const POINTS_PER_WOUND = -2;
