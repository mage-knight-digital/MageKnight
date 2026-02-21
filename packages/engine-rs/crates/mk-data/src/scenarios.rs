//! Scenario definitions — static configuration for each game scenario.

use mk_types::enums::*;
use mk_types::scoring::*;
use mk_types::state::ScenarioConfig;
use std::collections::BTreeMap;

/// First Reconnaissance — solo introductory scenario.
///
/// Map: Wedge shape, 8 countryside + 2 non-city core + 1 city tile.
/// 4 rounds (2 day + 2 night). Game ends when a city tile is revealed.
/// Skills disabled, elite units disabled.
pub fn first_reconnaissance() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 8,
        core_tile_count: 2,
        city_tile_count: 1,
        map_shape: MapShape::Wedge,
        day_rounds: 2,
        night_rounds: 2,
        total_rounds: 4,
        min_players: 1,
        max_players: 1,
        starting_fame: 0,
        starting_reputation: 0,
        skills_enabled: false,
        elite_units_enabled: false,
        pvp_enabled: false,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 1,
        cities_can_be_entered: false,
        default_city_level: 1,
        tactic_removal_mode: TacticRemovalMode::AllUsed,
        dummy_tactic_order: DummyTacticOrder::AfterHumans,
        end_trigger: ScenarioEndTrigger::CityRevealed,
        scoring_config: Some(ScenarioScoringConfig {
            base_score_mode: BaseScoreMode::IndividualFame,
            achievements: AchievementsConfig {
                enabled: true,
                mode: AchievementMode::Solo,
                overrides: BTreeMap::new(),
            },
            modules: vec![],
        }),
    }
}

/// First Reconnaissance — 2-player variant.
///
/// Map: Open 3 shape, 6 countryside + 2 core + 1 city tile.
/// 3 rounds (2 day + 1 night). No dummy player.
pub fn first_reconnaissance_2p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 6,
        core_tile_count: 2,
        city_tile_count: 1,
        map_shape: MapShape::Open3,
        day_rounds: 2,
        night_rounds: 1,
        total_rounds: 3,
        min_players: 2,
        max_players: 2,
        starting_fame: 0,
        starting_reputation: 0,
        skills_enabled: false,
        elite_units_enabled: false,
        pvp_enabled: false,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 1,
        cities_can_be_entered: false,
        default_city_level: 1,
        tactic_removal_mode: TacticRemovalMode::AllUsed,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityRevealed,
        scoring_config: None,
    }
}

/// First Reconnaissance — 3-player variant.
///
/// Map: Open 4 shape, 8 countryside + 3 core + 1 city tile.
/// 3 rounds (2 day + 1 night). No dummy player.
pub fn first_reconnaissance_3p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 8,
        core_tile_count: 3,
        city_tile_count: 1,
        map_shape: MapShape::Open4,
        day_rounds: 2,
        night_rounds: 1,
        total_rounds: 3,
        min_players: 3,
        max_players: 3,
        starting_fame: 0,
        starting_reputation: 0,
        skills_enabled: false,
        elite_units_enabled: false,
        pvp_enabled: false,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 1,
        cities_can_be_entered: false,
        default_city_level: 1,
        tactic_removal_mode: TacticRemovalMode::AllUsed,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityRevealed,
        scoring_config: None,
    }
}

/// First Reconnaissance — 4-player variant.
///
/// Map: Open 5 shape, 10 countryside + 4 core + 1 city tile.
/// 3 rounds (2 day + 1 night). No dummy player.
pub fn first_reconnaissance_4p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 10,
        core_tile_count: 4,
        city_tile_count: 1,
        map_shape: MapShape::Open5,
        day_rounds: 2,
        night_rounds: 1,
        total_rounds: 3,
        min_players: 4,
        max_players: 4,
        starting_fame: 0,
        starting_reputation: 0,
        skills_enabled: false,
        elite_units_enabled: false,
        pvp_enabled: false,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 1,
        cities_can_be_entered: false,
        default_city_level: 1,
        tactic_removal_mode: TacticRemovalMode::AllUsed,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityRevealed,
        scoring_config: None,
    }
}

/// Full Conquest — standard scenario (stub).
///
/// Map: Open 5 shape. 6 rounds (3 day + 3 night).
/// Conquer the city to win. All expansions enabled.
pub fn full_conquest() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 8,
        core_tile_count: 4,
        city_tile_count: 1,
        map_shape: MapShape::Open5,
        day_rounds: 3,
        night_rounds: 3,
        total_rounds: 6,
        min_players: 1,
        max_players: 4,
        starting_fame: 0,
        starting_reputation: 0,
        skills_enabled: true,
        elite_units_enabled: true,
        pvp_enabled: true,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![
            ExpansionId::LostLegion,
            ExpansionId::Krang,
            ExpansionId::ShadesOfTezla,
        ],
        fame_per_tile_explored: 0,
        cities_can_be_entered: true,
        default_city_level: 5,
        tactic_removal_mode: TacticRemovalMode::AllUsed,
        dummy_tactic_order: DummyTacticOrder::AfterHumans,
        end_trigger: ScenarioEndTrigger::CityConquered,
        scoring_config: Some(ScenarioScoringConfig {
            base_score_mode: BaseScoreMode::IndividualFame,
            achievements: AchievementsConfig {
                enabled: true,
                mode: AchievementMode::Competitive,
                overrides: BTreeMap::new(),
            },
            modules: vec![ScoringModuleConfig::CityConquest(
                CityConquestModuleConfig {
                    leader_points: 7,
                    participant_points: 4,
                    title_name: "Greatest City Conqueror".to_string(),
                    title_bonus: 5,
                    title_tied_bonus: 2,
                },
            )],
        }),
    }
}

/// Look up a scenario by ID string (and optional player count).
pub fn get_scenario(id: &str) -> Option<ScenarioConfig> {
    match id {
        "first_reconnaissance" => Some(first_reconnaissance()),
        "first_reconnaissance_2p" => Some(first_reconnaissance_2p()),
        "first_reconnaissance_3p" => Some(first_reconnaissance_3p()),
        "first_reconnaissance_4p" => Some(first_reconnaissance_4p()),
        "full_conquest" => Some(full_conquest()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_recon_config_values() {
        let config = first_reconnaissance();
        assert_eq!(config.countryside_tile_count, 8);
        assert_eq!(config.core_tile_count, 2);
        assert_eq!(config.city_tile_count, 1);
        assert_eq!(config.map_shape, MapShape::Wedge);
        assert_eq!(config.total_rounds, 4);
        assert_eq!(config.day_rounds, 2);
        assert_eq!(config.night_rounds, 2);
        assert_eq!(config.min_players, 1);
        assert_eq!(config.max_players, 1);
        assert_eq!(config.starting_fame, 0);
        assert_eq!(config.starting_reputation, 0);
        assert!(!config.skills_enabled);
        assert!(!config.elite_units_enabled);
        assert!(!config.pvp_enabled);
        assert!(config.spells_available);
        assert!(config.advanced_actions_available);
        assert!(config.enabled_expansions.is_empty());
        assert_eq!(config.fame_per_tile_explored, 1);
        assert!(!config.cities_can_be_entered);
        assert_eq!(config.default_city_level, 1);
        assert_eq!(config.tactic_removal_mode, TacticRemovalMode::AllUsed);
        assert_eq!(config.dummy_tactic_order, DummyTacticOrder::AfterHumans);
        assert_eq!(config.end_trigger, ScenarioEndTrigger::CityRevealed);

        let scoring = config.scoring_config.as_ref().unwrap();
        assert_eq!(scoring.base_score_mode, BaseScoreMode::IndividualFame);
        assert!(scoring.achievements.enabled);
        assert_eq!(scoring.achievements.mode, AchievementMode::Solo);
        assert!(scoring.modules.is_empty());
    }

    #[test]
    fn first_recon_2p_config() {
        let config = first_reconnaissance_2p();
        assert_eq!(config.map_shape, MapShape::Open3);
        assert_eq!(config.min_players, 2);
        assert_eq!(config.max_players, 2);
        assert_eq!(config.total_rounds, 3);
        assert_eq!(config.dummy_tactic_order, DummyTacticOrder::None);
        assert!(config.scoring_config.is_none());
    }

    #[test]
    fn full_conquest_config() {
        let config = full_conquest();
        assert_eq!(config.map_shape, MapShape::Open5);
        assert!(config.skills_enabled);
        assert!(config.elite_units_enabled);
        assert!(config.pvp_enabled);
        assert!(config.cities_can_be_entered);
        assert_eq!(config.default_city_level, 5);
        assert_eq!(config.end_trigger, ScenarioEndTrigger::CityConquered);
        assert_eq!(config.enabled_expansions.len(), 3);

        let scoring = config.scoring_config.as_ref().unwrap();
        assert_eq!(
            scoring.achievements.mode,
            AchievementMode::Competitive
        );
        assert_eq!(scoring.modules.len(), 1);
    }

    #[test]
    fn get_scenario_lookup() {
        assert!(get_scenario("first_reconnaissance").is_some());
        assert!(get_scenario("first_reconnaissance_2p").is_some());
        assert!(get_scenario("first_reconnaissance_3p").is_some());
        assert!(get_scenario("first_reconnaissance_4p").is_some());
        assert!(get_scenario("full_conquest").is_some());
        assert!(get_scenario("nonexistent_scenario").is_none());
    }
}
