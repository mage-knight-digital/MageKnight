//! Shared test helpers for action_pipeline tests.

use super::*;
use super::skills::push_passive_skill_modifiers;
use super::skills_complex::{
    classify_basic_action_for_shapeshift, derive_block_element_from_enemy,
    mark_dueling_unit_involvement, resolve_dueling_fame_bonus,
};
use crate::legal_actions::enumerate_legal_actions_with_undo;
use crate::setup::create_solo_game;
use mk_data::enemies::get_enemy;
use mk_types::effect::CardEffect;
use mk_types::ids::{CardId, EnemyTokenId, SkillId};
use mk_types::legal_action::{LegalAction, TacticDecisionData};
use mk_types::pending::{
    ActivePending, BookOfWisdomPhase, DeferredPending, EffectMode,
    PendingTacticDecision, SiteReward, MAX_REWARDS,
};
use mk_types::TacticId;

pub(super) fn setup_playing_game(hand: Vec<&str>) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = hand.into_iter().map(CardId::from).collect();
    state
}

pub(super) fn setup_combat_game(enemy_ids: &[&str]) -> GameState {
    let mut state = setup_playing_game(vec!["march"]);
    let tokens: Vec<mk_types::ids::EnemyTokenId> = enemy_ids
        .iter()
        .map(|id| mk_types::ids::EnemyTokenId::from(format!("{}_1", id)))
        .collect();
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    )
    .unwrap();
    state
}

pub(super) fn execute_attack(
    state: &mut GameState,
    undo: &mut UndoStack,
    attack_type: CombatType,
    target_count: usize,
) {
    let epoch = state.action_epoch;
    apply_legal_action(
        state, undo, 0,
        &LegalAction::InitiateAttack { attack_type },
        epoch,
    ).unwrap();

    // Select targets 0..target_count
    for i in 0..target_count {
        let epoch = state.action_epoch;
        apply_legal_action(
            state, undo, 0,
            &LegalAction::SubsetSelect { index: i },
            epoch,
        ).unwrap();
    }

    // Confirm if not auto-confirmed
    if state.players[0].pending.has_active() {
        let epoch = state.action_epoch;
        apply_legal_action(
            state, undo, 0,
            &LegalAction::SubsetConfirm,
            epoch,
        ).unwrap();
    }
}

pub(super) fn setup_with_skill(hero: Hero, skill_id: &str) -> (GameState, UndoStack) {
    let mut state = create_solo_game(42, hero);
    state.round_phase = RoundPhase::PlayerTurns;
    state.phase = GamePhase::Round;
    state.players[0].skills.push(mk_types::ids::SkillId::from(skill_id));
    (state, UndoStack::new())
}

pub(super) fn setup_two_player_with_skill(hero: Hero, skill_id: &str) -> (GameState, UndoStack) {
    let (mut state, undo) = setup_with_skill(hero, skill_id);
    // Add a second player
    let mut p1 = state.players[0].clone();
    p1.id = mk_types::ids::PlayerId::from("player_1");
    p1.hero = Hero::Tovak;
    p1.skills.clear();
    p1.hand = vec![CardId::from("march")];
    state.players.push(p1);
    state.turn_order = vec![
        mk_types::ids::PlayerId::from("player_0"),
        mk_types::ids::PlayerId::from("player_1"),
    ];
    (state, undo)
}

/// Helper: activate a skill for player 0.
pub(super) fn activate_skill(state: &mut GameState, undo: &mut UndoStack, skill_str: &str) {
    let epoch = state.action_epoch;
    apply_legal_action(
        state, undo, 0,
        &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from(skill_str) },
        epoch,
    ).unwrap();
}

/// Helper: switch current player to player_1 (index 1).
pub(super) fn switch_to_player_1(state: &mut GameState) {
    state.current_player_index = 1;
}

pub(super) fn setup_two_player_combat_with_skill(hero: Hero, skill_id: &str, enemy_ids: &[&str]) -> (GameState, UndoStack) {
    let (mut state, undo) = setup_two_player_with_skill(hero, skill_id);
    let tokens: Vec<mk_types::ids::EnemyTokenId> = enemy_ids
        .iter()
        .map(|id| mk_types::ids::EnemyTokenId::from(format!("{}_1", id)))
        .collect();
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();
    (state, undo)
}

pub(super) fn setup_combat_with_skill(hero: Hero, skill_id: &str, enemy_ids: &[&str]) -> (GameState, UndoStack) {
    let (mut state, undo) = setup_with_skill(hero, skill_id);
    let tokens: Vec<mk_types::ids::EnemyTokenId> = enemy_ids
        .iter()
        .map(|id| mk_types::ids::EnemyTokenId::from(format!("{}_1", id)))
        .collect();
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();
    (state, undo)
}

/// Helper: resolve a pending choice for player 0.
pub(super) fn resolve_choice(state: &mut GameState, undo: &mut UndoStack, choice_index: usize) {
    let epoch = state.action_epoch;
    apply_legal_action(
        state, undo, 0,
        &LegalAction::ResolveChoice { choice_index },
        epoch,
    ).unwrap();
}

mod test_core;
mod test_combat;
mod test_tactics;
mod test_sites;
mod test_skills_simple;
mod test_skills_tier_ab;
mod test_skills_batch3;
mod test_skills_interactive;
mod test_training;
mod test_multiplayer;
mod test_banners;
mod test_artifacts;
