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
        guarantee_village_unit_in_offer: true,
        pvp_enabled: false,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 1,
        cities_can_be_entered: false,
        default_city_level: 1,
        fame_per_level_crossed: 0,
        extra_source_dice: 0,
        extra_unit_offer_slots: 0,
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
/// Map: Open 3 shape, 8 countryside + 2 core + 1 city tile.
/// 3 rounds (2 day + 1 night). No dummy player.
pub fn first_reconnaissance_2p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 8,
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
        guarantee_village_unit_in_offer: true,
        pvp_enabled: false,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 1,
        cities_can_be_entered: false,
        default_city_level: 1,
        fame_per_level_crossed: 0,
        extra_source_dice: 0,
        extra_unit_offer_slots: 0,
        tactic_removal_mode: TacticRemovalMode::RemoveTwo,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityRevealed,
        scoring_config: None,
    }
}

/// First Reconnaissance — 3-player variant.
///
/// Map: Open 4 shape, 9 countryside + 2 core + 1 city tile.
/// 3 rounds (2 day + 1 night). No dummy player.
pub fn first_reconnaissance_3p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 9,
        core_tile_count: 2,
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
        guarantee_village_unit_in_offer: true,
        pvp_enabled: false,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 1,
        cities_can_be_entered: false,
        default_city_level: 1,
        fame_per_level_crossed: 0,
        extra_source_dice: 0,
        extra_unit_offer_slots: 0,
        tactic_removal_mode: TacticRemovalMode::RemoveOne,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityRevealed,
        scoring_config: None,
    }
}

/// First Reconnaissance — 4-player variant.
///
/// Map: Open 5 shape, 11 countryside + 2 core + 1 city tile.
/// 3 rounds (2 day + 1 night). No dummy player.
pub fn first_reconnaissance_4p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 11,
        core_tile_count: 2,
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
        guarantee_village_unit_in_offer: true,
        pvp_enabled: false,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 1,
        cities_can_be_entered: false,
        default_city_level: 1,
        fame_per_level_crossed: 0,
        extra_source_dice: 0,
        extra_unit_offer_slots: 0,
        tactic_removal_mode: TacticRemovalMode::None,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityRevealed,
        scoring_config: None,
    }
}

fn full_conquest_scoring() -> ScenarioScoringConfig {
    ScenarioScoringConfig {
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
    }
}

/// Full Conquest — 2-player variant.
///
/// Map: Wedge, 8 countryside + 1 non-city core + 2 city tiles. 6 rounds (3 day + 3 night).
/// Cities are level 4. Game ends when all cities are conquered.
pub fn full_conquest_2p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 8,
        core_tile_count: 1,
        city_tile_count: 2,
        map_shape: MapShape::Wedge,
        day_rounds: 3,
        night_rounds: 3,
        total_rounds: 6,
        min_players: 2,
        max_players: 2,
        starting_fame: 0,
        starting_reputation: 0,
        skills_enabled: true,
        elite_units_enabled: true,
        guarantee_village_unit_in_offer: false,
        pvp_enabled: true,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 0,
        cities_can_be_entered: true,
        default_city_level: 4,
        fame_per_level_crossed: 0,
        extra_source_dice: 0,
        extra_unit_offer_slots: 0,
        tactic_removal_mode: TacticRemovalMode::RemoveTwo,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityConquered,
        scoring_config: Some(full_conquest_scoring()),
    }
}

/// Full Conquest — 3-player variant.
///
/// Map: Wedge, 9 countryside + 2 non-city core + 3 city tiles. 6 rounds (3 day + 3 night).
/// Cities are level 4. Game ends when all cities are conquered.
pub fn full_conquest_3p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 9,
        core_tile_count: 2,
        city_tile_count: 3,
        map_shape: MapShape::Wedge,
        day_rounds: 3,
        night_rounds: 3,
        total_rounds: 6,
        min_players: 3,
        max_players: 3,
        starting_fame: 0,
        starting_reputation: 0,
        skills_enabled: true,
        elite_units_enabled: true,
        guarantee_village_unit_in_offer: false,
        pvp_enabled: true,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 0,
        cities_can_be_entered: true,
        default_city_level: 4,
        fame_per_level_crossed: 0,
        extra_source_dice: 0,
        extra_unit_offer_slots: 0,
        tactic_removal_mode: TacticRemovalMode::RemoveOne,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityConquered,
        scoring_config: Some(full_conquest_scoring()),
    }
}

/// Full Conquest — 4-player variant.
///
/// Map: Fully Open, 11 countryside + 3 non-city core + 4 city tiles. 6 rounds (3 day + 3 night).
/// Cities are level 4. Game ends when all cities are conquered.
pub fn full_conquest_4p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 11,
        core_tile_count: 3,
        city_tile_count: 4,
        map_shape: MapShape::Open5,
        day_rounds: 3,
        night_rounds: 3,
        total_rounds: 6,
        min_players: 4,
        max_players: 4,
        starting_fame: 0,
        starting_reputation: 0,
        skills_enabled: true,
        elite_units_enabled: true,
        guarantee_village_unit_in_offer: false,
        pvp_enabled: true,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 0,
        cities_can_be_entered: true,
        default_city_level: 4,
        fame_per_level_crossed: 0,
        extra_source_dice: 0,
        extra_unit_offer_slots: 0,
        tactic_removal_mode: TacticRemovalMode::None,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityConquered,
        scoring_config: Some(full_conquest_scoring()),
    }
}

fn blitz_conquest_scoring() -> ScenarioScoringConfig {
    ScenarioScoringConfig {
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
    }
}

/// Blitz Conquest — 2-player variant.
///
/// Map: Wedge, 6 countryside + 1 non-city core + 2 city tiles. 4 rounds (2 day + 2 night).
/// Cities are level 3. Starts with 1 Fame, +2 Reputation, extra Source die and Unit offer slot.
pub fn blitz_conquest_2p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 6,
        core_tile_count: 1,
        city_tile_count: 2,
        map_shape: MapShape::Wedge,
        day_rounds: 2,
        night_rounds: 2,
        total_rounds: 4,
        min_players: 2,
        max_players: 2,
        starting_fame: 1,
        starting_reputation: 2,
        skills_enabled: true,
        elite_units_enabled: true,
        guarantee_village_unit_in_offer: false,
        pvp_enabled: true,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 0,
        cities_can_be_entered: true,
        default_city_level: 3,
        fame_per_level_crossed: 1,
        extra_source_dice: 1,
        extra_unit_offer_slots: 1,
        tactic_removal_mode: TacticRemovalMode::RemoveTwo,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityConquered,
        scoring_config: Some(blitz_conquest_scoring()),
    }
}

/// Blitz Conquest — 3-player variant.
///
/// Map: Wedge, 7 countryside + 2 non-city core + 3 city tiles. 4 rounds (2 day + 2 night).
/// Cities are level 3. Starts with 1 Fame, +2 Reputation, extra Source die and Unit offer slot.
pub fn blitz_conquest_3p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 7,
        core_tile_count: 2,
        city_tile_count: 3,
        map_shape: MapShape::Wedge,
        day_rounds: 2,
        night_rounds: 2,
        total_rounds: 4,
        min_players: 3,
        max_players: 3,
        starting_fame: 1,
        starting_reputation: 2,
        skills_enabled: true,
        elite_units_enabled: true,
        guarantee_village_unit_in_offer: false,
        pvp_enabled: true,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 0,
        cities_can_be_entered: true,
        default_city_level: 3,
        fame_per_level_crossed: 1,
        extra_source_dice: 1,
        extra_unit_offer_slots: 1,
        tactic_removal_mode: TacticRemovalMode::RemoveOne,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityConquered,
        scoring_config: Some(blitz_conquest_scoring()),
    }
}

/// Blitz Conquest — 4-player variant.
///
/// Map: Open4 (limited to 4 columns), 9 countryside + 3 non-city core + 4 city tiles.
/// 4 rounds (2 day + 2 night). Cities are level 3. Starts with 1 Fame, +2 Reputation,
/// extra Source die and Unit offer slot.
pub fn blitz_conquest_4p() -> ScenarioConfig {
    ScenarioConfig {
        countryside_tile_count: 9,
        core_tile_count: 3,
        city_tile_count: 4,
        map_shape: MapShape::Open4,
        day_rounds: 2,
        night_rounds: 2,
        total_rounds: 4,
        min_players: 4,
        max_players: 4,
        starting_fame: 1,
        starting_reputation: 2,
        skills_enabled: true,
        elite_units_enabled: true,
        guarantee_village_unit_in_offer: false,
        pvp_enabled: true,
        spells_available: true,
        advanced_actions_available: true,
        enabled_expansions: vec![],
        fame_per_tile_explored: 0,
        cities_can_be_entered: true,
        default_city_level: 3,
        fame_per_level_crossed: 1,
        extra_source_dice: 1,
        extra_unit_offer_slots: 1,
        tactic_removal_mode: TacticRemovalMode::None,
        dummy_tactic_order: DummyTacticOrder::None,
        end_trigger: ScenarioEndTrigger::CityConquered,
        scoring_config: Some(blitz_conquest_scoring()),
    }
}

/// Look up a scenario by ID string (and optional player count).
pub fn get_scenario(id: &str) -> Option<ScenarioConfig> {
    match id {
        "first_reconnaissance" => Some(first_reconnaissance()),
        "first_reconnaissance_2p" => Some(first_reconnaissance_2p()),
        "first_reconnaissance_3p" => Some(first_reconnaissance_3p()),
        "first_reconnaissance_4p" => Some(first_reconnaissance_4p()),
        "full_conquest_2p" => Some(full_conquest_2p()),
        "full_conquest_3p" => Some(full_conquest_3p()),
        "full_conquest_4p" => Some(full_conquest_4p()),
        "blitz_conquest_2p" => Some(blitz_conquest_2p()),
        "blitz_conquest_3p" => Some(blitz_conquest_3p()),
        "blitz_conquest_4p" => Some(blitz_conquest_4p()),
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
        assert!(config.guarantee_village_unit_in_offer);
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
        assert_eq!(config.tactic_removal_mode, TacticRemovalMode::RemoveTwo);
        assert!(config.scoring_config.is_none());
    }

    #[test]
    fn full_conquest_2p_config() {
        let config = full_conquest_2p();
        assert_eq!(config.map_shape, MapShape::Wedge);
        assert_eq!(config.countryside_tile_count, 8);
        assert_eq!(config.core_tile_count, 1);
        assert_eq!(config.city_tile_count, 2);
        assert_eq!(config.total_rounds, 6);
        assert_eq!(config.default_city_level, 4);
        assert_eq!(config.min_players, 2);
        assert_eq!(config.max_players, 2);
        assert!(config.skills_enabled);
        assert!(config.elite_units_enabled);
        assert!(config.pvp_enabled);
        assert!(config.cities_can_be_entered);
        assert_eq!(config.end_trigger, ScenarioEndTrigger::CityConquered);
        assert_eq!(config.tactic_removal_mode, TacticRemovalMode::RemoveTwo);
        assert_eq!(config.dummy_tactic_order, DummyTacticOrder::None);
        let scoring = config.scoring_config.as_ref().unwrap();
        assert_eq!(scoring.achievements.mode, AchievementMode::Competitive);
        assert_eq!(scoring.modules.len(), 1);
    }

    #[test]
    fn full_conquest_3p_config() {
        let config = full_conquest_3p();
        assert_eq!(config.map_shape, MapShape::Wedge);
        assert_eq!(config.countryside_tile_count, 9);
        assert_eq!(config.core_tile_count, 2);
        assert_eq!(config.city_tile_count, 3);
        assert_eq!(config.default_city_level, 4);
        assert_eq!(config.min_players, 3);
        assert_eq!(config.max_players, 3);
        assert_eq!(config.tactic_removal_mode, TacticRemovalMode::RemoveOne);
    }

    #[test]
    fn full_conquest_4p_config() {
        let config = full_conquest_4p();
        assert_eq!(config.map_shape, MapShape::Open5);
        assert_eq!(config.countryside_tile_count, 11);
        assert_eq!(config.core_tile_count, 3);
        assert_eq!(config.city_tile_count, 4);
        assert_eq!(config.default_city_level, 4);
        assert_eq!(config.min_players, 4);
        assert_eq!(config.max_players, 4);
        assert_eq!(config.tactic_removal_mode, TacticRemovalMode::None);
    }

    #[test]
    fn get_scenario_lookup() {
        assert!(get_scenario("first_reconnaissance").is_some());
        assert!(get_scenario("first_reconnaissance_2p").is_some());
        assert!(get_scenario("first_reconnaissance_3p").is_some());
        assert!(get_scenario("first_reconnaissance_4p").is_some());
        assert!(get_scenario("full_conquest_2p").is_some());
        assert!(get_scenario("full_conquest_3p").is_some());
        assert!(get_scenario("full_conquest_4p").is_some());
        assert!(get_scenario("blitz_conquest_2p").is_some());
        assert!(get_scenario("blitz_conquest_3p").is_some());
        assert!(get_scenario("blitz_conquest_4p").is_some());
        assert!(get_scenario("nonexistent_scenario").is_none());
    }

    #[test]
    fn blitz_conquest_2p_config() {
        let config = blitz_conquest_2p();
        assert_eq!(config.map_shape, MapShape::Wedge);
        assert_eq!(config.countryside_tile_count, 6);
        assert_eq!(config.core_tile_count, 1);
        assert_eq!(config.city_tile_count, 2);
        assert_eq!(config.total_rounds, 4);
        assert_eq!(config.default_city_level, 3);
        assert_eq!(config.min_players, 2);
        assert_eq!(config.max_players, 2);
        assert_eq!(config.starting_fame, 1);
        assert_eq!(config.starting_reputation, 2);
        assert_eq!(config.fame_per_level_crossed, 1);
        assert_eq!(config.extra_source_dice, 1);
        assert_eq!(config.extra_unit_offer_slots, 1);
        assert_eq!(config.end_trigger, ScenarioEndTrigger::CityConquered);
        assert_eq!(config.tactic_removal_mode, TacticRemovalMode::RemoveTwo);
    }

    #[test]
    fn blitz_conquest_3p_config() {
        let config = blitz_conquest_3p();
        assert_eq!(config.map_shape, MapShape::Wedge);
        assert_eq!(config.countryside_tile_count, 7);
        assert_eq!(config.core_tile_count, 2);
        assert_eq!(config.city_tile_count, 3);
        assert_eq!(config.default_city_level, 3);
        assert_eq!(config.min_players, 3);
        assert_eq!(config.max_players, 3);
        assert_eq!(config.tactic_removal_mode, TacticRemovalMode::RemoveOne);
        assert_eq!(config.fame_per_level_crossed, 1);
    }

    #[test]
    fn blitz_conquest_4p_config() {
        let config = blitz_conquest_4p();
        assert_eq!(config.map_shape, MapShape::Open4);
        assert_eq!(config.countryside_tile_count, 9);
        assert_eq!(config.core_tile_count, 3);
        assert_eq!(config.city_tile_count, 4);
        assert_eq!(config.default_city_level, 3);
        assert_eq!(config.min_players, 4);
        assert_eq!(config.max_players, 4);
        assert_eq!(config.tactic_removal_mode, TacticRemovalMode::None);
        assert_eq!(config.fame_per_level_crossed, 1);
    }

    #[test]
    fn blitz_conquest_scoring_module_present() {
        let config = blitz_conquest_2p();
        let scoring = config.scoring_config.as_ref().unwrap();
        assert_eq!(scoring.achievements.mode, AchievementMode::Competitive);
        assert_eq!(scoring.modules.len(), 1);
        if let ScoringModuleConfig::CityConquest(ref m) = scoring.modules[0] {
            assert_eq!(m.leader_points, 7);
            assert_eq!(m.participant_points, 4);
            assert_eq!(m.title_bonus, 5);
        } else {
            panic!("expected CityConquest scoring module");
        }
    }

    #[test]
    fn existing_scenarios_have_zero_blitz_fields() {
        for id in ["first_reconnaissance", "first_reconnaissance_2p", "full_conquest_2p"] {
            let config = get_scenario(id).unwrap();
            assert_eq!(config.fame_per_level_crossed, 0, "{id}: fame_per_level_crossed should be 0");
            assert_eq!(config.extra_source_dice, 0, "{id}: extra_source_dice should be 0");
            assert_eq!(config.extra_unit_offer_slots, 0, "{id}: extra_unit_offer_slots should be 0");
        }
    }
}
