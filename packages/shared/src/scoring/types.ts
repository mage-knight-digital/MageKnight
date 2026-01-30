/**
 * Scoring system type definitions for Mage Knight
 *
 * Provides the type foundation for all scoring implementations.
 * Based on the scoring system architecture design (#443).
 */

// =============================================================================
// BASE SCORE MODES
// =============================================================================

/**
 * Base score calculation mode
 *
 * - individual_fame: Each player's own Fame (competitive)
 * - lowest_fame: Lowest Fame of all players (co-op)
 * - victory_points: Alternative point-based system
 * - none: No scoring, victory by position/condition
 */
export type BaseScoreMode =
  | "individual_fame"
  | "lowest_fame"
  | "victory_points"
  | "none";

// =============================================================================
// ACHIEVEMENT CONFIGURATION
// =============================================================================

/**
 * Achievement scoring mode
 *
 * - competitive: Compare players, award titles
 * - solo: No titles (no comparison)
 * - coop_best_only: No titles, score only best player per category
 */
export type AchievementMode = "competitive" | "solo" | "coop_best_only";

/**
 * Standard achievement categories from the rulebook
 */
export type AchievementCategory =
  | "greatest_knowledge"
  | "greatest_loot"
  | "greatest_leader"
  | "greatest_conqueror"
  | "greatest_adventurer"
  | "greatest_beating";

/**
 * Configuration for overriding a specific achievement category
 * (used by scenarios like Dungeon Lords that modify scoring)
 */
export interface AchievementCategoryOverride {
  /** Points per qualifying item (e.g., 4 instead of 2 for dungeons) */
  readonly pointsPerItem?: number;
  /** Custom title name (e.g., "Greatest Dungeon Crawler") */
  readonly titleName?: string;
  /** Custom title bonus (e.g., +5 instead of +3) */
  readonly titleBonus?: number;
  /** Custom tied bonus (e.g., +2 instead of +1) */
  readonly titleTiedBonus?: number;
}

/**
 * Configuration for the achievements scoring subsystem
 */
export interface AchievementsConfig {
  /** Whether achievements are enabled for this scenario */
  readonly enabled: boolean;
  /** How achievements are calculated and titles awarded */
  readonly mode: AchievementMode;
  /** Optional overrides for specific achievement categories */
  readonly overrides?: Partial<
    Record<AchievementCategory, AchievementCategoryOverride>
  >;
}

// =============================================================================
// SCORING MODULE TYPES
// =============================================================================

/**
 * Types of scoring modules that can be enabled per scenario
 */
export type ScoringModuleType =
  | "city_conquest"
  | "time_efficiency"
  | "objective_completion"
  | "mine"
  | "relic"
  | "faction"
  | "volkare";

/**
 * Base interface for all scoring modules
 */
interface BaseScoringModule {
  readonly type: ScoringModuleType;
}

/**
 * City Conquest scoring module
 *
 * Used by: Full Conquest, Blitz Conquest, co-op scenarios
 */
export interface CityConquestModule extends BaseScoringModule {
  readonly type: "city_conquest";
  /** Points for leading a city assault (+7 default) */
  readonly leaderPoints: number;
  /** Points for participating in city assault (+4 default) */
  readonly participantPoints: number;
  /** Title for most city shields */
  readonly titleName: string;
  /** Title bonus for winner (+5 default) */
  readonly titleBonus: number;
  /** Title bonus when tied (+2 default) */
  readonly titleTiedBonus: number;
}

/**
 * Time Efficiency scoring module
 *
 * Used by: Solo/co-op scenarios with round limits
 */
export interface TimeEfficiencyModule extends BaseScoringModule {
  readonly type: "time_efficiency";
  /** Points per round finished early (+30 default) */
  readonly pointsPerEarlyRound: number;
  /** Points per card left in Dummy deck (+1 default) */
  readonly pointsPerDummyCard: number;
  /** Bonus if End of Round not announced (+5 default) */
  readonly bonusIfRoundNotAnnounced: number;
}

/**
 * Configuration for a single objective
 */
export interface ObjectiveConfig {
  /** Unique identifier for this objective */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** Points per completion of this objective */
  readonly pointsEach: number;
  /** Bonus if all instances of this objective are completed */
  readonly allCompletedBonus?: number;
  /** Bonus if every player participated in completing this objective */
  readonly everyPlayerParticipatedBonus?: number;
}

/**
 * Objective Completion scoring module
 *
 * Used by: Solo/co-op scenarios with specific objectives
 */
export interface ObjectiveCompletionModule extends BaseScoringModule {
  readonly type: "objective_completion";
  /** List of objectives that can be completed */
  readonly objectives: readonly ObjectiveConfig[];
}

/**
 * Mine Liberation scoring module
 *
 * Used by: Mine Liberation scenario
 */
export interface MineModule extends BaseScoringModule {
  readonly type: "mine";
  /** Points per mine on Countryside tiles (+4 default) */
  readonly countrysidePoints: number;
  /** Points per mine on Core tiles (+7 default) */
  readonly corePoints: number;
  /** Title for most mines liberated */
  readonly titleName: string;
  /** Title bonus for winner (+5 default) */
  readonly titleBonus: number;
  /** Title bonus when tied (+2 default) */
  readonly titleTiedBonus: number;
}

/**
 * Relic Hunting scoring module
 *
 * Used by: Lost Relic scenarios
 */
export interface RelicModule extends BaseScoringModule {
  readonly type: "relic";
  /** Points per relic piece found */
  readonly pointsPerPiece: number;
  /** Bonus if every player found at least one piece */
  readonly everyPlayerFoundBonus?: number;
  /** Bonus if all pieces are found */
  readonly allPiecesFoundBonus?: number;
  /** Title for most relic pieces (competitive only) */
  readonly titleName?: string;
  /** Title bonus for winner */
  readonly titleBonus?: number;
  /** Title bonus when tied */
  readonly titleTiedBonus?: number;
}

/**
 * Faction scoring module
 *
 * Used by: Faction-specific scenarios (Orc, Draconum, etc.)
 */
export interface FactionModule extends BaseScoringModule {
  readonly type: "faction";
  /** Name of the faction */
  readonly factionName: string;
  /** Title for most shields on faction sites/leaders */
  readonly titleName: string;
  /** Title bonus for winner (+5 default) */
  readonly titleBonus: number;
  /** Title bonus when tied (+2 default) */
  readonly titleTiedBonus: number;
}

/**
 * Volkare scoring module
 *
 * Used by: Lost Legion scenarios
 */
export interface VolkareModule extends BaseScoringModule {
  readonly type: "volkare";
  /** Base bonus for defeating Volkare (varies by Combat level) */
  readonly baseBonus: number;
  /** Points per card left in Volkare's deck */
  readonly pointsPerCard: number;
  /** Multiplier based on Race level (1, 1.5, or 2) */
  readonly raceMultiplier: number;
}

/**
 * Union of all scoring module configurations
 */
export type ScoringModuleConfig =
  | CityConquestModule
  | TimeEfficiencyModule
  | ObjectiveCompletionModule
  | MineModule
  | RelicModule
  | FactionModule
  | VolkareModule;

// =============================================================================
// SCENARIO SCORING CONFIGURATION
// =============================================================================

/**
 * Complete scoring configuration for a scenario
 *
 * Defines how scores are calculated at game end.
 */
export interface ScenarioScoringConfig {
  /** How base scores are calculated */
  readonly baseScoreMode: BaseScoreMode;
  /** Standard achievements configuration */
  readonly achievements: AchievementsConfig;
  /** Additional scoring modules enabled for this scenario */
  readonly modules: readonly ScoringModuleConfig[];
}

// =============================================================================
// RESULT TYPES
// =============================================================================

/**
 * Score breakdown for a single achievement category
 */
export interface AchievementCategoryScore {
  /** The achievement category */
  readonly category: AchievementCategory;
  /** Base points earned (before title bonus) */
  readonly basePoints: number;
  /** Title bonus earned (winner/tied/penalty) */
  readonly titleBonus: number;
  /** Total points for this category */
  readonly totalPoints: number;
  /** Whether this player won the title */
  readonly hasTitle: boolean;
  /** Whether tied for the title */
  readonly isTied: boolean;
}

/**
 * Complete achievement scoring result for a player
 */
export interface AchievementScoreResult {
  /** Scores for each achievement category */
  readonly categoryScores: readonly AchievementCategoryScore[];
  /** Total achievement points */
  readonly totalAchievementPoints: number;
}

/**
 * Score result from a scoring module
 */
export interface ModuleScoreResult {
  /** The module type */
  readonly moduleType: ScoringModuleType;
  /** Points earned from this module */
  readonly points: number;
  /** Breakdown of how points were earned */
  readonly breakdown: readonly ModuleScoreBreakdown[];
  /** Title earned from this module (if any) */
  readonly title?: {
    readonly name: string;
    readonly bonus: number;
    readonly isTied: boolean;
  };
}

/**
 * Individual item in a module score breakdown
 */
export interface ModuleScoreBreakdown {
  /** Description of the scoring item */
  readonly description: string;
  /** Points earned for this item */
  readonly points: number;
  /** Quantity (if applicable) */
  readonly quantity?: number;
}

/**
 * Complete scoring result for a single player
 */
export interface PlayerScoreResult {
  /** The player's ID */
  readonly playerId: string;
  /** Base score (Fame or other base) */
  readonly baseScore: number;
  /** Achievement scoring results (if enabled) */
  readonly achievements?: AchievementScoreResult;
  /** Results from each enabled scoring module */
  readonly moduleResults: readonly ModuleScoreResult[];
  /** Final total score */
  readonly totalScore: number;
}

/**
 * Complete scoring result for the entire game
 */
export interface FinalScoreResult {
  /** Configuration used for scoring */
  readonly config: ScenarioScoringConfig;
  /** Results for each player */
  readonly playerResults: readonly PlayerScoreResult[];
  /** Player IDs in order from highest to lowest score */
  readonly rankings: readonly string[];
  /** Whether there was a tie for first place */
  readonly isTied: boolean;
}
