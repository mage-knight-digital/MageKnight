use super::*;
use crate::action_pipeline::apply_legal_action;
use crate::setup::create_solo_game;
use crate::undo::UndoStack;
use mk_types::effect::CardEffect;
use mk_types::enums::ResistanceElement;
use mk_types::hex::HexCoord;
use mk_types::ids::{CardId, EnemyTokenId, PlayerId, UnitId, UnitInstanceId};
use mk_types::modifier::{EnemyStat as ModEnemyStat, ModifierEffect, ModifierScope};
use mk_types::pending::ActivePending;
use mk_types::state::Site;

mod cards;
mod combat;
mod explore;
mod movement;
mod pending;
mod turn_options;
mod units;
mod validation;

/// Helper: create a game in player turns phase with specific hand.
pub(super) fn setup_game(hand: Vec<&str>) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = hand.into_iter().map(CardId::from).collect();
    state
}

/// Assert every action in a LegalActionSet executes successfully.
pub(super) fn assert_all_executable(state: &GameState, undo: &UndoStack, player_idx: usize) {
    let legal = enumerate_legal_actions_with_undo(state, player_idx, undo);
    for (i, action) in legal.actions.iter().enumerate() {
        let mut s = state.clone();
        let mut u = undo.clone();
        let result = apply_legal_action(&mut s, &mut u, player_idx, action, legal.epoch);
        assert!(
            result.is_ok(),
            "Action {i} ({action:?}) failed: {:?}",
            result.unwrap_err()
        );
    }
}

/// Helper: place player at a village hex with units in offer + influence.
pub(super) fn setup_village_recruit() -> GameState {
    let mut state = setup_game(vec!["march"]);
    // Place a village on the player's hex (0,0)
    let hex = state.map.hexes.get_mut("0,0").unwrap();
    hex.site = Some(Site {
        site_type: SiteType::Village,
        owner: None,
        is_conquered: false,
        is_burned: false,
        city_color: None,
        mine_color: None,
        deep_mine_colors: None,
    });
    // Populate the unit offer with village-recruitable units
    state.offers.units = vec![
        UnitId::from("peasants"),
        UnitId::from("foresters"),
        UnitId::from("herbalist"),
    ];
    // Give player enough influence
    state.players[0].influence_points = 20;
    state
}

/// Helper: create a game with a ready peasant unit on the player's side.
pub(super) fn setup_unit_activation() -> GameState {
    let mut state = setup_game(vec!["march"]);
    // Add a ready peasant unit
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_1"),
        unit_id: UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });
    state
}

/// Helper: set up a game with a specific unit ready for non-combat activation.
pub(super) fn setup_complex_unit(unit_id: &str, unit_instance_id: &str) -> (GameState, UndoStack) {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("march")]; // need a card to keep turn active
    state.players[0].units.clear();
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from(unit_instance_id),
        unit_id: UnitId::from(unit_id),
        level: mk_data::units::get_unit(unit_id).unwrap().level,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });
    let undo = UndoStack::new();
    (state, undo)
}

/// Helper: set up a combat game with a specific unit and enemies.
pub(super) fn setup_select_enemy_combat(
    unit_id: &str,
    unit_instance_id: &str,
    enemy_ids: &[&str],
) -> (GameState, UndoStack) {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("march")];
    state.players[0].units.clear();
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from(unit_instance_id),
        unit_id: UnitId::from(unit_id),
        level: mk_data::units::get_unit(unit_id).unwrap().level,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    let tokens: Vec<EnemyTokenId> = enemy_ids
        .iter()
        .map(|id| EnemyTokenId::from(format!("{}_1", id)))
        .collect();
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    )
    .unwrap();

    let undo = UndoStack::new();
    (state, undo)
}

/// Helper: create combat state with a unit and enemies, in AssignDamage phase.
pub(super) fn setup_damage_assignment_combat(
    unit_id: &str,
    unit_instance_id: &str,
    enemy_ids: &[&str],
) -> (GameState, UndoStack) {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("march"), CardId::from("rage")];
    state.players[0].units.clear();
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from(unit_instance_id),
        unit_id: UnitId::from(unit_id),
        level: mk_data::units::get_unit(unit_id).unwrap().level,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    let tokens: Vec<EnemyTokenId> = enemy_ids
        .iter()
        .map(|id| EnemyTokenId::from(format!("{}_1", id)))
        .collect();
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    )
    .unwrap();

    // Advance to AssignDamage phase
    let combat = state.combat.as_mut().unwrap();
    combat.phase = CombatPhase::AssignDamage;
    // Mark all attacks as NOT blocked and NOT assigned
    for enemy in &mut combat.enemies {
        for blocked in &mut enemy.attacks_blocked {
            *blocked = false;
        }
        for assigned in &mut enemy.attacks_damage_assigned {
            *assigned = false;
        }
    }

    let undo = UndoStack::new();
    (state, undo)
}

/// Helper: set up a combat with a specific card in hand and given enemies.
/// Returns state in RangedSiege phase with the card playable.
pub(super) fn setup_card_combat(card_id: &str, enemy_ids: &[&str]) -> (GameState, UndoStack) {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from(card_id)];
    state.players[0].units.clear();

    let tokens: Vec<EnemyTokenId> = enemy_ids
        .iter()
        .map(|id| EnemyTokenId::from(format!("{}_1", id)))
        .collect();
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    )
    .unwrap();

    let undo = UndoStack::new();
    (state, undo)
}

/// Helper: set up a game ready for level-up testing.
/// Player is in PlayerTurns phase with march in hand, high fame to trigger level-up.
pub(super) fn setup_level_up_game(fame: u32) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("march")];
    state.players[0].fame = fame;
    state.players[0].level = 1; // Start at level 1
    // Ensure deck has cards for card draw after level-up
    state.players[0].deck = (0..10)
        .map(|i| CardId::from(format!("card_{}", i)))
        .collect();
    state
}

/// Helper: set up a game with a specific mana source configuration.
/// Clears all existing dice and adds the specified ones.
pub(super) fn setup_source_dice(state: &mut GameState, dice: Vec<(ManaColor, bool)>) {
    state.source.dice = dice
        .into_iter()
        .enumerate()
        .map(|(i, (color, is_depleted))| SourceDie {
            id: mk_types::ids::SourceDieId::from(format!("die_{}", i).as_str()),
            color,
            is_depleted,
            taken_by_player_id: None,
        })
        .collect();
}

/// Helper: create combat with given enemies for fear testing.
pub(super) fn setup_fear_combat(enemy_ids: &[&str]) -> GameState {
    let mut state = setup_game(vec!["march"]);
    let tokens: Vec<EnemyTokenId> = enemy_ids
        .iter()
        .map(|id| EnemyTokenId::from(format!("{}_1", id).as_str()))
        .collect();
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();
    state
}

/// Helper: set up Altem Mages with combat state.
pub(super) fn setup_altem_mages_combat(phase: CombatPhase) -> (GameState, UndoStack) {
    let (mut state, undo) = setup_complex_unit("altem_mages", "unit_am");
    state.combat = Some(Box::new(CombatState {
        phase,
        ..CombatState::default()
    }));
    (state, undo)
}

/// Helper: set up a combat game with given enemies (from combat.rs inline tests).
pub(super) fn setup_combat_game(enemy_ids: &[&str]) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;

    let tokens: Vec<EnemyTokenId> = enemy_ids
        .iter()
        .map(|id| EnemyTokenId::from(format!("{}_1", id)))
        .collect();

    crate::combat::execute_enter_combat(&mut state, 0, &tokens, false, None, Default::default())
        .unwrap();

    state
}
