//! Training scenarios for curriculum learning.
//!
//! Each variant configures how a game state is set up for RL training.
//! `FullGame` is identical to the normal game; other variants create
//! focused sub-problems (e.g. combat drills) that are easier to learn.

use mk_engine::action_pipeline::push_passive_skill_modifiers;
use mk_engine::combat::{execute_enter_combat, EnterCombatOptions};
use mk_engine::legal_actions::enumerate_legal_actions_with_undo;
use mk_engine::setup::{create_solo_game, place_initial_tiles};
use mk_engine::undo::UndoStack;
use mk_types::enums::{Hero, RoundPhase, ScenarioEndTrigger, UnitState};
use mk_types::ids::{EnemyTokenId, SkillId, UnitId, UnitInstanceId};
use mk_types::legal_action::LegalActionSet;
use mk_types::pending::MAX_UNITS;
use mk_types::state::{Crystals, GameState, PlayerUnit, TileDeck};
use serde::{Deserialize, Serialize};

use crate::filter_undo;

// =============================================================================
// TrainingScenario enum
// =============================================================================

/// Scenario configuration for RL training environments.
///
/// Each variant is a post-setup modifier on `GameState`.
/// `EncodedStep` dimensions are identical regardless of scenario.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TrainingScenario {
    /// Standard full game — identical to normal play.
    FullGame,

    /// Combat-only drill: player starts in combat with specified enemies.
    ///
    /// Skips tactic selection, enters combat immediately, 1-round limit.
    /// No tile deck (no exploration). Good for learning attack/block mechanics.
    CombatDrill {
        /// Enemy token IDs, e.g. `["diggers_1"]`. Format: `"{enemy_id}_{counter}"`.
        enemy_tokens: Vec<String>,
        /// Whether the combat site is fortified (requires siege before melee).
        is_fortified: bool,
        /// Override starting hand with specific card IDs (e.g. `["rage", "rage", "determination"]`).
        /// If None, uses the normal random 5-card deal.
        #[serde(default)]
        hand_override: Option<Vec<String>>,
        /// Extra card IDs added to the deck before hand draw (e.g. `["assault", "crystallize"]`).
        /// Creates per-episode variation: some hands will contain these cards, some won't.
        #[serde(default)]
        extra_cards: Option<Vec<String>>,
        /// Unit IDs to give the player (e.g. `["peasants", "herbalists"]`).
        /// Capped at MAX_UNITS.
        #[serde(default)]
        units: Option<Vec<String>>,
        /// Skill IDs to grant with passive modifiers (e.g. `["resistance"]`).
        #[serde(default)]
        skills: Option<Vec<String>>,
        /// Crystals to grant (additive, each color capped at 3).
        #[serde(default)]
        crystals: Option<Crystals>,
    },
}

impl Default for TrainingScenario {
    fn default() -> Self {
        Self::FullGame
    }
}

// =============================================================================
// Setup result
// =============================================================================

/// Result from `create_training_game()` — everything needed to initialize a `SingleEnv`.
pub struct ScenarioSetupResult {
    pub state: GameState,
    pub undo_stack: UndoStack,
    pub action_set: LegalActionSet,
}

// =============================================================================
// Game creation
// =============================================================================

/// Create a game state configured for the given training scenario.
pub fn create_training_game(
    seed: u32,
    hero: Hero,
    scenario: &TrainingScenario,
) -> ScenarioSetupResult {
    match scenario {
        TrainingScenario::FullGame => setup_full_game(seed, hero),
        TrainingScenario::CombatDrill {
            enemy_tokens,
            is_fortified,
            hand_override,
            extra_cards,
            units,
            skills,
            crystals,
        } => {
            let config = CombatDrillConfig {
                enemy_tokens,
                is_fortified: *is_fortified,
                hand_override: hand_override.as_deref(),
                extra_cards: extra_cards.as_deref(),
                units: units.as_deref(),
                skills: skills.as_deref(),
                crystals: crystals.as_ref(),
            };
            setup_combat_drill(seed, hero, &config)
        }
    }
}

fn setup_full_game(seed: u32, hero: Hero) -> ScenarioSetupResult {
    let mut state = create_solo_game(seed, hero);
    place_initial_tiles(&mut state);
    let undo_stack = UndoStack::new();
    let action_set = filter_undo(enumerate_legal_actions_with_undo(&state, 0, &undo_stack));
    ScenarioSetupResult {
        state,
        undo_stack,
        action_set,
    }
}

struct CombatDrillConfig<'a> {
    enemy_tokens: &'a [String],
    is_fortified: bool,
    hand_override: Option<&'a [String]>,
    extra_cards: Option<&'a [String]>,
    units: Option<&'a [String]>,
    skills: Option<&'a [String]>,
    crystals: Option<&'a Crystals>,
}

fn setup_combat_drill(seed: u32, hero: Hero, config: &CombatDrillConfig<'_>) -> ScenarioSetupResult {
    let mut state = create_solo_game(seed, hero);
    // Don't place initial tiles — no exploration in combat drills.

    // Extra cards: return hand to deck, add extras, reshuffle, redraw 5.
    if let Some(card_names) = config.extra_cards {
        let player = &mut state.players[0];
        // Return current hand to deck
        player.deck.append(&mut player.hand);
        // Add extra cards to deck
        for name in card_names {
            player.deck.push(mk_types::ids::CardId::from(name.as_str()));
        }
        // Reshuffle the deck
        state.rng.shuffle(&mut state.players[0].deck);
        // Redraw 5 cards (or fewer if deck is smaller)
        let draw_count = state.players[0].deck.len().min(5);
        for _ in 0..draw_count {
            if let Some(card) = state.players[0].deck.pop() {
                state.players[0].hand.push(card);
            }
        }
    }

    // Crystals: additive, cap each color at 3.
    if let Some(c) = config.crystals {
        let player = &mut state.players[0];
        player.crystals.red = (player.crystals.red + c.red).min(3);
        player.crystals.blue = (player.crystals.blue + c.blue).min(3);
        player.crystals.green = (player.crystals.green + c.green).min(3);
        player.crystals.white = (player.crystals.white + c.white).min(3);
    }

    // Skip tactic selection → go straight to player turns.
    state.round_phase = RoundPhase::PlayerTurns;

    // 1-round game with RoundLimit end trigger.
    state.scenario_config.total_rounds = 1;
    state.scenario_config.end_trigger = ScenarioEndTrigger::RoundLimit;

    // Clear tile deck so exploration isn't possible.
    state.map.tile_deck = TileDeck::default();

    // Skills: grant skill IDs + push passive modifiers (before combat so passives are active).
    if let Some(skill_names) = config.skills {
        for name in skill_names {
            let skill_id = SkillId::from(name.as_str());
            state.players[0].skills.push(skill_id.clone());
            push_passive_skill_modifiers(&mut state, 0, &skill_id);
        }
    }

    // Units: create PlayerUnit for each, cap at MAX_UNITS.
    if let Some(unit_names) = config.units {
        for name in unit_names {
            if state.players[0].units.len() >= MAX_UNITS {
                eprintln!("[CombatDrill] units: MAX_UNITS ({MAX_UNITS}) reached, skipping {name:?}");
                break;
            }
            let unit_id = UnitId::from(name.as_str());
            let level = mk_data::units::get_unit(name.as_str())
                .map(|u| u.level)
                .unwrap_or(1);
            let instance_id =
                UnitInstanceId::from(format!("unit_{}", state.next_instance_counter));
            state.next_instance_counter += 1;
            let unit = PlayerUnit {
                instance_id,
                unit_id,
                level,
                state: UnitState::Ready,
                wounded: false,
                used_resistance_this_combat: false,
                used_ability_indices: Vec::new(),
                mana_token: None,
            };
            state.players[0].units.push(unit);
        }
    }

    // Convert token strings to EnemyTokenId and enter combat.
    let token_ids: Vec<EnemyTokenId> = config.enemy_tokens
        .iter()
        .map(|s| EnemyTokenId::from(s.as_str()))
        .collect();

    let combat_hex = state.players[0].position;
    execute_enter_combat(
        &mut state,
        0,
        &token_ids,
        config.is_fortified,
        combat_hex,
        EnterCombatOptions::default(),
    )
    .expect("CombatDrill: failed to enter combat");

    // Apply hand override: move current hand back to deck, then pull specific cards.
    if let Some(card_names) = config.hand_override {
        let player = &mut state.players[0];
        // Return current hand to deck
        player.deck.append(&mut player.hand);
        // Pull requested cards from deck
        for name in card_names {
            if let Some(pos) = player.deck.iter().position(|c| c.as_str() == name.as_str()) {
                let card = player.deck.remove(pos);
                player.hand.push(card);
            } else {
                eprintln!("[CombatDrill] hand_override: card {name:?} not found in deck, skipping");
            }
        }
    }

    let undo_stack = UndoStack::new();
    let action_set = filter_undo(enumerate_legal_actions_with_undo(&state, 0, &undo_stack));
    ScenarioSetupResult {
        state,
        undo_stack,
        action_set,
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_game_scenario_produces_valid_state() {
        let result = create_training_game(42, Hero::Arythea, &TrainingScenario::FullGame);
        assert!(!result.state.game_ended);
        assert!(!result.action_set.actions.is_empty());
    }

    #[test]
    fn combat_drill_starts_in_combat() {
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        assert!(result.state.combat.is_some(), "Should be in combat");
        assert_eq!(result.state.round_phase, RoundPhase::PlayerTurns);
        assert!(!result.action_set.actions.is_empty(), "Should have legal actions");
    }

    #[test]
    fn combat_drill_has_no_tile_deck() {
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        assert!(result.state.map.tile_deck.countryside.is_empty());
        assert!(result.state.map.tile_deck.core.is_empty());
    }

    #[test]
    fn combat_drill_fortified() {
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: true,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        let combat = result.state.combat.as_ref().unwrap();
        assert!(combat.is_at_fortified_site);
    }

    #[test]
    fn combat_drill_round_limit() {
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        assert_eq!(result.state.scenario_config.total_rounds, 1);
        assert_eq!(
            result.state.scenario_config.end_trigger,
            ScenarioEndTrigger::RoundLimit
        );
    }

    #[test]
    fn combat_drill_hand_override() {
        // Arythea has 1 rage, 1 determination, 2 stamina in her deck
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: Some(vec![
                "rage".to_string(),
                "determination".to_string(),
                "stamina".to_string(),
            ]),
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        let hand: Vec<&str> = result.state.players[0].hand.iter().map(|c| c.as_str()).collect();
        assert_eq!(hand.len(), 3);
        assert_eq!(hand.iter().filter(|&&c| c == "rage").count(), 1);
        assert_eq!(hand.iter().filter(|&&c| c == "determination").count(), 1);
        assert_eq!(hand.iter().filter(|&&c| c == "stamina").count(), 1);
    }

    #[test]
    fn combat_drill_hand_override_missing_card_skipped() {
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: Some(vec![
                "rage".to_string(),
                "nonexistent_card".to_string(),
            ]),
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        let hand: Vec<&str> = result.state.players[0].hand.iter().map(|c| c.as_str()).collect();
        // Only "rage" should be in hand, "nonexistent_card" skipped
        assert_eq!(hand.len(), 1);
        assert_eq!(hand[0], "rage");
    }

    #[test]
    fn scenario_deserializes_from_json() {
        let json = r#"{"type":"CombatDrill","enemy_tokens":["diggers_1"],"is_fortified":false}"#;
        let scenario: TrainingScenario = serde_json::from_str(json).unwrap();
        match scenario {
            TrainingScenario::CombatDrill {
                enemy_tokens,
                is_fortified,
                hand_override,
                ..
            } => {
                assert_eq!(enemy_tokens, vec!["diggers_1"]);
                assert!(!is_fortified);
                assert!(hand_override.is_none());
            }
            _ => panic!("Expected CombatDrill"),
        }
    }

    #[test]
    fn scenario_deserializes_with_hand_override() {
        let json = r#"{"type":"CombatDrill","enemy_tokens":["diggers_1"],"is_fortified":false,"hand_override":["rage","rage","determination"]}"#;
        let scenario: TrainingScenario = serde_json::from_str(json).unwrap();
        match scenario {
            TrainingScenario::CombatDrill {
                hand_override,
                ..
            } => {
                assert_eq!(
                    hand_override,
                    Some(vec!["rage".to_string(), "rage".to_string(), "determination".to_string()])
                );
            }
            _ => panic!("Expected CombatDrill"),
        }
    }

    #[test]
    fn full_game_deserializes_from_json() {
        let json = r#"{"type":"FullGame"}"#;
        let scenario: TrainingScenario = serde_json::from_str(json).unwrap();
        assert!(matches!(scenario, TrainingScenario::FullGame));
    }

    #[test]
    fn combat_drill_extra_cards_in_deck() {
        // Arythea has 16 cards. Adding 3 extra cards should result in 19 total.
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: None,
            extra_cards: Some(vec![
                "assault".to_string(),
                "crystallize".to_string(),
                "improvisation".to_string(),
            ]),
            units: None,
            skills: None,
            crystals: None,
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        let total = result.state.players[0].hand.len() + result.state.players[0].deck.len();
        // 16 base + 3 extra = 19 total cards
        assert_eq!(total, 19);
    }

    #[test]
    fn combat_drill_extra_cards_with_hand_override() {
        // Extra cards added to deck, then hand_override pulls specific cards.
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: Some(vec!["assault".to_string()]),
            extra_cards: Some(vec!["assault".to_string()]),
            units: None,
            skills: None,
            crystals: None,
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        let hand: Vec<&str> = result.state.players[0].hand.iter().map(|c| c.as_str()).collect();
        assert_eq!(hand.len(), 1);
        assert_eq!(hand[0], "assault");
    }

    #[test]
    fn combat_drill_with_units() {
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: Some(vec!["peasants".to_string()]),
            skills: None,
            crystals: None,
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        assert_eq!(result.state.players[0].units.len(), 1);
        assert_eq!(result.state.players[0].units[0].unit_id.as_str(), "peasants");
        assert_eq!(result.state.players[0].units[0].state, mk_types::enums::UnitState::Ready);
    }

    #[test]
    fn combat_drill_with_skills() {
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: Some(vec!["resistance".to_string()]),
            crystals: None,
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        assert!(
            result.state.players[0].skills.iter().any(|s| s.as_str() == "resistance"),
            "Player should have the 'resistance' skill"
        );
    }

    #[test]
    fn combat_drill_with_crystals() {
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: None,
            crystals: Some(mk_types::state::Crystals {
                red: 1,
                blue: 2,
                green: 0,
                white: 1,
            }),
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        assert_eq!(result.state.players[0].crystals.red, 1);
        assert_eq!(result.state.players[0].crystals.blue, 2);
        assert_eq!(result.state.players[0].crystals.green, 0);
        assert_eq!(result.state.players[0].crystals.white, 1);
    }

    #[test]
    fn combat_drill_crystals_capped_at_3() {
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: None,
            crystals: Some(mk_types::state::Crystals {
                red: 5,
                blue: 10,
                green: 3,
                white: 0,
            }),
        };
        let result = create_training_game(42, Hero::Arythea, &scenario);
        assert_eq!(result.state.players[0].crystals.red, 3);
        assert_eq!(result.state.players[0].crystals.blue, 3);
        assert_eq!(result.state.players[0].crystals.green, 3);
        assert_eq!(result.state.players[0].crystals.white, 0);
    }

    #[test]
    fn scenario_backward_compat_no_new_fields() {
        // Existing JSON without new fields should still deserialize.
        let json = r#"{"type":"CombatDrill","enemy_tokens":["diggers_1"],"is_fortified":false}"#;
        let scenario: TrainingScenario = serde_json::from_str(json).unwrap();
        match scenario {
            TrainingScenario::CombatDrill {
                extra_cards,
                units,
                skills,
                crystals,
                ..
            } => {
                assert!(extra_cards.is_none());
                assert!(units.is_none());
                assert!(skills.is_none());
                assert!(crystals.is_none());
            }
            _ => panic!("Expected CombatDrill"),
        }
    }

    #[test]
    fn scenario_deserializes_with_all_new_fields() {
        let json = r#"{
            "type": "CombatDrill",
            "enemy_tokens": ["diggers_1"],
            "is_fortified": false,
            "extra_cards": ["assault"],
            "units": ["peasants"],
            "skills": ["resistance"],
            "crystals": {"red": 1, "blue": 0, "green": 2, "white": 0}
        }"#;
        let scenario: TrainingScenario = serde_json::from_str(json).unwrap();
        match scenario {
            TrainingScenario::CombatDrill {
                extra_cards,
                units,
                skills,
                crystals,
                ..
            } => {
                assert_eq!(extra_cards, Some(vec!["assault".to_string()]));
                assert_eq!(units, Some(vec!["peasants".to_string()]));
                assert_eq!(skills, Some(vec!["resistance".to_string()]));
                let c = crystals.unwrap();
                assert_eq!(c.red, 1);
                assert_eq!(c.blue, 0);
                assert_eq!(c.green, 2);
                assert_eq!(c.white, 0);
            }
            _ => panic!("Expected CombatDrill"),
        }
    }
}
