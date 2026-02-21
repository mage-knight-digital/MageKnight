//! Scenario definitions — static configuration for each game scenario.

use mk_types::enums::*;
use mk_types::state::ScenarioConfig;

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
        skills_enabled: false,
        elite_units_enabled: false,
        spells_available: true,
        advanced_actions_available: true,
        fame_per_tile_explored: 1,
        cities_can_be_entered: false,
        default_city_level: 1,
        tactic_removal_mode: TacticRemovalMode::AllUsed,
        dummy_tactic_order: DummyTacticOrder::AfterHumans,
        end_trigger: ScenarioEndTrigger::CityRevealed,
    }
}

/// Look up a scenario by ID string.
pub fn get_scenario(id: &str) -> Option<ScenarioConfig> {
    match id {
        "first_reconnaissance" => Some(first_reconnaissance()),
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
        assert!(!config.skills_enabled);
        assert!(!config.elite_units_enabled);
        assert!(config.spells_available);
        assert!(config.advanced_actions_available);
        assert_eq!(config.fame_per_tile_explored, 1);
        assert!(!config.cities_can_be_entered);
        assert_eq!(config.default_city_level, 1);
        assert_eq!(config.tactic_removal_mode, TacticRemovalMode::AllUsed);
        assert_eq!(config.dummy_tactic_order, DummyTacticOrder::AfterHumans);
        assert_eq!(config.end_trigger, ScenarioEndTrigger::CityRevealed);
    }

    #[test]
    fn get_scenario_lookup() {
        assert!(get_scenario("first_reconnaissance").is_some());
        assert!(get_scenario("nonexistent_scenario").is_none());
    }
}
