//! Scoring and achievement types — configuration and results.
//!
//! Matches the TypeScript scoring system in `shared/src/scoring/types.ts`.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

// =============================================================================
// Base Score Mode
// =============================================================================

/// How the base score (before achievements/modules) is determined.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BaseScoreMode {
    /// Each player's own Fame.
    IndividualFame,
    /// Lowest Fame of all players (co-op).
    LowestFame,
    /// Alternative point-based system.
    VictoryPoints,
    /// No scoring — victory by position/condition.
    None,
}

// =============================================================================
// Achievement Mode
// =============================================================================

/// How achievements are compared between players.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AchievementMode {
    /// Compare players, award titles (+3/-3 for winner, +1/-1 for ties).
    Competitive,
    /// No titles (no comparison) — used for solo scenarios.
    Solo,
    /// No titles, score only best player per category (co-op).
    CoopBestOnly,
}

// =============================================================================
// Achievement Category
// =============================================================================

/// The six standard achievement categories.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AchievementCategory {
    /// +2 per Spell, +1 per Advanced Action.
    GreatestKnowledge,
    /// +2 per Artifact, +1 per 2 crystals.
    GreatestLoot,
    /// +1 per unit level (wounded = half, floor).
    GreatestLeader,
    /// +2 per shield on keep/mage tower/monastery.
    GreatestConqueror,
    /// +2 per shield on adventure site.
    GreatestAdventurer,
    /// -2 per wound in deck (penalty).
    GreatestBeating,
}

/// All achievement categories in standard order.
pub const ALL_ACHIEVEMENT_CATEGORIES: [AchievementCategory; 6] = [
    AchievementCategory::GreatestKnowledge,
    AchievementCategory::GreatestLoot,
    AchievementCategory::GreatestLeader,
    AchievementCategory::GreatestConqueror,
    AchievementCategory::GreatestAdventurer,
    AchievementCategory::GreatestBeating,
];

// =============================================================================
// Scoring Module Types
// =============================================================================

/// Types of optional scoring modules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScoringModuleType {
    CityConquest,
    TimeEfficiency,
    ObjectiveCompletion,
    Mine,
    Relic,
    Faction,
    Volkare,
}

// =============================================================================
// Expansion ID
// =============================================================================

/// Expansion identifiers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExpansionId {
    LostLegion,
    Krang,
    ShadesOfTezla,
}

// =============================================================================
// Achievement Configuration
// =============================================================================

/// Override scoring parameters for a specific achievement category.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementCategoryOverride {
    pub points_per_item: Option<u32>,
    pub title_name: Option<String>,
    pub title_bonus: Option<i32>,
    pub title_tied_bonus: Option<i32>,
}

/// Configuration for the achievement system within a scenario.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementsConfig {
    pub enabled: bool,
    pub mode: AchievementMode,
    #[serde(default)]
    pub overrides: BTreeMap<AchievementCategory, AchievementCategoryOverride>,
}

// =============================================================================
// Scoring Module Configs
// =============================================================================

/// City conquest scoring module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CityConquestModuleConfig {
    pub leader_points: i32,
    pub participant_points: i32,
    pub title_name: String,
    pub title_bonus: i32,
    pub title_tied_bonus: i32,
}

/// Time efficiency scoring module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeEfficiencyModuleConfig {
    pub points_per_early_round: i32,
    pub points_per_dummy_card: i32,
    pub bonus_if_round_not_announced: i32,
}

/// Objective configuration within a scoring module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectiveConfig {
    pub id: String,
    pub description: String,
    pub points_each: i32,
    pub all_completed_bonus: Option<i32>,
    pub every_player_participated_bonus: Option<i32>,
}

/// Objective completion scoring module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectiveCompletionModuleConfig {
    pub objectives: Vec<ObjectiveConfig>,
}

/// Mine scoring module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MineModuleConfig {
    pub countryside_points: i32,
    pub core_points: i32,
    pub title_name: String,
    pub title_bonus: i32,
    pub title_tied_bonus: i32,
}

/// Relic scoring module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelicModuleConfig {
    pub points_per_piece: i32,
    pub every_player_found_bonus: Option<i32>,
    pub all_pieces_found_bonus: Option<i32>,
    pub title_name: Option<String>,
    pub title_bonus: Option<i32>,
    pub title_tied_bonus: Option<i32>,
}

/// Faction scoring module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FactionModuleConfig {
    pub faction_name: String,
    pub title_name: String,
    pub title_bonus: i32,
    pub title_tied_bonus: i32,
}

/// Volkare scoring module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolkareModuleConfig {
    pub base_bonus: i32,
    pub points_per_card: i32,
    pub race_multiplier: f32,
}

/// Tagged union of all scoring module configurations.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ScoringModuleConfig {
    CityConquest(CityConquestModuleConfig),
    TimeEfficiency(TimeEfficiencyModuleConfig),
    ObjectiveCompletion(ObjectiveCompletionModuleConfig),
    Mine(MineModuleConfig),
    Relic(RelicModuleConfig),
    Faction(FactionModuleConfig),
    Volkare(VolkareModuleConfig),
}

// =============================================================================
// Scenario Scoring Config
// =============================================================================

/// Full scoring configuration for a scenario.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioScoringConfig {
    pub base_score_mode: BaseScoreMode,
    pub achievements: AchievementsConfig,
    #[serde(default)]
    pub modules: Vec<ScoringModuleConfig>,
}

// =============================================================================
// Scoring Constants
// =============================================================================

/// Title bonus for sole winner of a category.
pub const TITLE_BONUS_WINNER: i32 = 3;
/// Title bonus when tied for a category.
pub const TITLE_BONUS_TIED: i32 = 1;
/// Penalty for having most wounds (sole).
pub const TITLE_PENALTY_MOST_WOUNDS: i32 = -3;
/// Penalty for having most wounds (tied).
pub const TITLE_PENALTY_MOST_WOUNDS_TIED: i32 = -1;

/// Points per Spell for Greatest Knowledge.
pub const POINTS_PER_SPELL: i32 = 2;
/// Points per Advanced Action for Greatest Knowledge.
pub const POINTS_PER_ADVANCED_ACTION: i32 = 1;
/// Points per Artifact for Greatest Loot.
pub const POINTS_PER_ARTIFACT: i32 = 2;
/// Crystals needed per point for Greatest Loot.
pub const CRYSTALS_PER_POINT: u32 = 2;
/// Points per shield on fortified site for Greatest Conqueror.
pub const POINTS_PER_FORTIFIED_SHIELD: i32 = 2;
/// Points per shield on adventure site for Greatest Adventurer.
pub const POINTS_PER_ADVENTURE_SHIELD: i32 = 2;
/// Points per wound for Greatest Beating (negative).
pub const POINTS_PER_WOUND: i32 = -2;

// =============================================================================
// Scoring Results
// =============================================================================

/// Score breakdown for a single achievement category.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementCategoryScore {
    pub category: AchievementCategory,
    /// Base points before title bonus.
    pub base_points: i32,
    /// Title bonus/penalty (0 if no title).
    pub title_bonus: i32,
    /// base_points + title_bonus.
    pub total_points: i32,
    pub has_title: bool,
    pub is_tied: bool,
}

/// Achievement scoring result for one player.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementScoreResult {
    pub category_scores: Vec<AchievementCategoryScore>,
    pub total_achievement_points: i32,
}

/// Breakdown line for a scoring module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleScoreBreakdown {
    pub description: String,
    pub points: i32,
    pub quantity: Option<u32>,
}

/// Title info for a scoring module.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleTitle {
    pub name: String,
    pub bonus: i32,
    pub is_tied: bool,
}

/// Module scoring result for one player.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleScoreResult {
    pub module_type: ScoringModuleType,
    pub points: i32,
    pub breakdown: Vec<ModuleScoreBreakdown>,
    pub title: Option<ModuleTitle>,
}

/// Full scoring result for one player.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerScoreResult {
    pub player_id: String,
    pub base_score: i32,
    pub achievements: Option<AchievementScoreResult>,
    pub module_results: Vec<ModuleScoreResult>,
    pub total_score: i32,
}

/// Complete final scoring result for the game.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinalScoreResult {
    pub config: ScenarioScoringConfig,
    pub player_results: Vec<PlayerScoreResult>,
    /// Player IDs sorted by score (highest first).
    pub rankings: Vec<String>,
    pub is_tied: bool,
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_achievement_categories_count() {
        assert_eq!(ALL_ACHIEVEMENT_CATEGORIES.len(), 6);
    }

    #[test]
    fn serde_roundtrip_scoring_config() {
        let config = ScenarioScoringConfig {
            base_score_mode: BaseScoreMode::IndividualFame,
            achievements: AchievementsConfig {
                enabled: true,
                mode: AchievementMode::Solo,
                overrides: BTreeMap::new(),
            },
            modules: vec![],
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: ScenarioScoringConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.base_score_mode, BaseScoreMode::IndividualFame);
        assert!(parsed.achievements.enabled);
        assert_eq!(parsed.achievements.mode, AchievementMode::Solo);
    }

    #[test]
    fn serde_roundtrip_city_conquest_module() {
        let module = ScoringModuleConfig::CityConquest(CityConquestModuleConfig {
            leader_points: 7,
            participant_points: 4,
            title_name: "Greatest City Conqueror".to_string(),
            title_bonus: 5,
            title_tied_bonus: 2,
        });
        let json = serde_json::to_string(&module).unwrap();
        assert!(json.contains("city_conquest"));
        let parsed: ScoringModuleConfig = serde_json::from_str(&json).unwrap();
        match parsed {
            ScoringModuleConfig::CityConquest(c) => {
                assert_eq!(c.leader_points, 7);
                assert_eq!(c.participant_points, 4);
            }
            _ => panic!("Expected CityConquest"),
        }
    }
}
