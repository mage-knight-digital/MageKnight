//! Mage Knight implementation of the rl-core GameAdapter trait.

pub mod packer;
pub mod signals;
pub mod training_scenario;

use std::collections::BTreeSet;
use std::panic::{catch_unwind, AssertUnwindSafe};

use mk_engine::action_pipeline::{apply_legal_action, ApplyError};
use mk_engine::combat_search::{search_combat, CombatSearchConfig};
use mk_engine::commerce_search::{search_commerce, CommerceSearchConfig};
use mk_engine::legal_actions::enumerate_legal_actions_with_undo;
use mk_engine::scoring::{calculate_category_base_points, calculate_final_scores};
use mk_engine::undo::UndoStack;
use mk_features::EncodedStep;
use mk_types::enums::Hero;
use mk_types::legal_action::{LegalAction, LegalActionSet};
use mk_types::scoring::AchievementCategory;
use mk_types::state::{GameState, PlayerFlags};

use rl_core::{dump_crash_replay, GameAdapter, StepOutcome};

use crate::signals::MkStepSignals;
use crate::training_scenario::{create_training_game, TrainingScenario};

/// Mage Knight game adapter for rl-core.
pub struct MkAdapter;

/// Mage Knight game configuration for VecEnv.
#[derive(Clone)]
pub struct MkConfig {
    pub hero: Hero,
    pub scenario: TrainingScenario,
    pub combat_oracle: bool,
    pub commerce_oracle: bool,
    pub early_term_fame_step: u64,
}

/// Mage Knight environment state (GameState + auxiliary tracking).
#[derive(Clone, serde::Serialize)]
pub struct MkEnvState {
    pub state: GameState,
    #[serde(skip)]
    pub undo_stack: UndoStack,
    pub visited_hexes: BTreeSet<(i32, i32)>,
    pub turn_hexes: BTreeSet<(i32, i32)>,
}

/// Pre-step snapshot for computing signal deltas.
pub struct MkSnapshot {
    fame_before: i32,
    wounds_before: i32,
    achievements_before: i32,
    hexes_before: usize,
    move_points_before: i32,
    position_before: Option<(i32, i32)>,
    is_end_turn: bool,
    was_resting: bool,
    visited_hexes_before: usize,
    turn_hexes_snapshot: BTreeSet<(i32, i32)>,
}

// ── Helper functions ───────────────────────────────────────────────

fn filter_undo(mut action_set: LegalActionSet) -> LegalActionSet {
    action_set.actions.retain(|a| !matches!(a, LegalAction::Undo));
    action_set
}

fn achievement_score_no_wounds(state: &GameState) -> i32 {
    let player = &state.players[0];
    let mut total = 0;
    for cat in [
        AchievementCategory::GreatestKnowledge,
        AchievementCategory::GreatestLoot,
        AchievementCategory::GreatestLeader,
        AchievementCategory::GreatestConqueror,
        AchievementCategory::GreatestAdventurer,
    ] {
        total += calculate_category_base_points(cat, player, state);
    }
    total
}

fn wound_count_in_hand(state: &GameState) -> i32 {
    state.players[0]
        .hand
        .iter()
        .filter(|c| c.as_str() == "wound")
        .count() as i32
}

fn non_wound_hand_size(state: &GameState) -> i32 {
    state.players[0]
        .hand
        .iter()
        .filter(|c| c.as_str() != "wound")
        .count() as i32
}

fn full_deck_wound_count(state: &GameState) -> i32 {
    let p = &state.players[0];
    (p.hand.iter().filter(|c| c.as_str() == "wound").count()
        + p.deck.iter().filter(|c| c.as_str() == "wound").count()
        + p.discard.iter().filter(|c| c.as_str() == "wound").count()) as i32
}

fn full_deck_card_count(state: &GameState) -> i32 {
    let p = &state.players[0];
    (p.hand.len() + p.deck.len() + p.discard.len()) as i32
}

/// Auto-resolve combat using the exhaustive search oracle.
fn resolve_combat_oracle(state: &mut GameState, undo_stack: &mut UndoStack) {
    let config = CombatSearchConfig {
        node_limit: 1_000_000,
        seed_rollouts: 500,
        ..CombatSearchConfig::default()
    };
    let result = search_combat(state, &config);

    for action in &result.actions {
        if state.combat.is_none() || state.game_ended {
            break;
        }
        let epoch = state.action_epoch;
        let _ = apply_legal_action(state, undo_stack, 0, action, epoch);
    }

    while state.combat.is_some() && !state.game_ended {
        let actions = enumerate_legal_actions_with_undo(state, 0, undo_stack);
        if actions.actions.is_empty() {
            break;
        }
        let epoch = actions.epoch;
        let fallback_idx = actions
            .actions
            .iter()
            .position(|a| matches!(a, LegalAction::EndCombatPhase))
            .or_else(|| {
                actions
                    .actions
                    .iter()
                    .position(|a| matches!(a, LegalAction::EndTurn))
            })
            .unwrap_or(0);
        let action = actions.actions[fallback_idx].clone();
        let _ = apply_legal_action(state, undo_stack, 0, &action, epoch);
    }
}

/// Auto-resolve commerce interaction using search oracle.
fn resolve_commerce_oracle(state: &mut GameState, undo_stack: &mut UndoStack) {
    let config = CommerceSearchConfig {
        node_limit: 500_000,
        seed_rollouts: 200,
        ..CommerceSearchConfig::default()
    };
    let result = search_commerce(state, &config);

    for action in &result.actions {
        if !state.players[0]
            .flags
            .contains(PlayerFlags::IS_INTERACTING)
            || state.game_ended
            || state.combat.is_some()
        {
            break;
        }
        let epoch = state.action_epoch;
        let _ = apply_legal_action(state, undo_stack, 0, action, epoch);
    }

    if state.players[0]
        .flags
        .contains(PlayerFlags::IS_INTERACTING)
        && !state.game_ended
    {
        let actions = enumerate_legal_actions_with_undo(state, 0, undo_stack);
        if let Some(end_turn_idx) = actions
            .actions
            .iter()
            .position(|a| matches!(a, LegalAction::EndTurn))
        {
            let action = actions.actions[end_turn_idx].clone();
            let epoch = actions.epoch;
            let _ = apply_legal_action(state, undo_stack, 0, &action, epoch);
        }
    }
}

// ── GameAdapter implementation ─────────────────────────────────────

impl GameAdapter for MkAdapter {
    type State = MkEnvState;
    type Action = LegalAction;
    type ActionSet = LegalActionSet;
    type Config = MkConfig;
    type Snapshot = MkSnapshot;
    type Encoded = EncodedStep;
    type Signals = MkStepSignals;

    fn create(seed: u32, config: &MkConfig) -> (MkEnvState, LegalActionSet) {
        let result = create_training_game(seed, config.hero, &config.scenario);
        let mut visited_hexes = BTreeSet::new();
        let mut turn_hexes = BTreeSet::new();
        if let Some(pos) = result.state.players[0].position {
            visited_hexes.insert((pos.q, pos.r));
            turn_hexes.insert((pos.q, pos.r));
        }
        let env_state = MkEnvState {
            state: result.state,
            undo_stack: result.undo_stack,
            visited_hexes,
            turn_hexes,
        };
        (env_state, result.action_set)
    }

    fn reset(env_state: &mut MkEnvState, seed: u32, config: &MkConfig) -> LegalActionSet {
        let result = create_training_game(seed, config.hero, &config.scenario);
        env_state.state = result.state;
        env_state.undo_stack = result.undo_stack;
        env_state.visited_hexes.clear();
        env_state.turn_hexes.clear();
        if let Some(pos) = env_state.state.players[0].position {
            env_state.visited_hexes.insert((pos.q, pos.r));
            env_state.turn_hexes.insert((pos.q, pos.r));
        }
        result.action_set
    }

    fn action_count(action_set: &LegalActionSet) -> usize {
        action_set.actions.len()
    }

    fn get_action(action_set: &LegalActionSet, index: usize) -> &LegalAction {
        &action_set.actions[index]
    }

    fn step(
        env_state: &mut MkEnvState,
        action_set: &LegalActionSet,
        action_index: usize,
        step_count: u64,
        seed: u32,
        action_history: &[LegalAction],
        config: &MkConfig,
    ) -> StepOutcome<LegalActionSet> {
        let idx = action_index.min(action_set.actions.len().saturating_sub(1));
        let action = action_set.actions[idx].clone();
        let epoch = action_set.epoch;

        let state = &mut env_state.state;
        let undo_stack = &mut env_state.undo_stack;

        let result = catch_unwind(AssertUnwindSafe(|| {
            let apply_result = apply_legal_action(state, undo_stack, 0, &action, epoch)?;
            let new_actions = enumerate_legal_actions_with_undo(state, 0, undo_stack);
            Ok::<_, ApplyError>((apply_result, new_actions))
        }));

        match result {
            Ok(Ok((apply_result, new_actions))) => {
                let mut new_action_set = filter_undo(new_actions);

                // Update hex tracking (must happen before reset)
                if let Some(pos) = state.players[0].position {
                    env_state.visited_hexes.insert((pos.q, pos.r));
                    // Check if this was an EndTurn (resets turn hexes)
                    let was_end_turn = matches!(&action, LegalAction::EndTurn);
                    if was_end_turn {
                        env_state.turn_hexes.clear();
                    }
                    env_state.turn_hexes.insert((pos.q, pos.r));
                }

                // Auto-resolve combat with oracle if enabled
                if config.combat_oracle && state.combat.is_some() {
                    resolve_combat_oracle(state, undo_stack);
                    new_action_set =
                        filter_undo(enumerate_legal_actions_with_undo(state, 0, undo_stack));
                }

                // Auto-resolve commerce with oracle if enabled
                if config.commerce_oracle
                    && state.players[0]
                        .flags
                        .contains(PlayerFlags::IS_INTERACTING)
                {
                    resolve_commerce_oracle(state, undo_stack);
                    new_action_set =
                        filter_undo(enumerate_legal_actions_with_undo(state, 0, undo_stack));
                }

                // In CombatDrill, end episode when combat resolves
                let combat_drill_done =
                    matches!(config.scenario, TrainingScenario::CombatDrill { .. })
                        && state.combat.is_none();
                if combat_drill_done {
                    state.game_ended = true;
                }

                // Detect 0 legal actions (engine bug)
                if new_action_set.actions.is_empty()
                    && !apply_result.game_ended
                    && !state.game_ended
                    && !combat_drill_done
                {
                    dump_crash_replay(state, seed, step_count, action_history);
                }

                StepOutcome {
                    action_set: new_action_set,
                    game_ended: apply_result.game_ended || state.game_ended || combat_drill_done,
                    panicked: false,
                    applied_index: idx,
                }
            }
            Ok(Err(e)) => {
                eprintln!(
                    "[MkAdapter] error at seed={seed} step={step_count} action={action:?}: {e:?}"
                );
                dump_crash_replay(state, seed, step_count, action_history);
                state.game_ended = true;
                StepOutcome {
                    action_set: LegalActionSet {
                        actions: vec![],
                        epoch: action_set.epoch + 1,
                        player_idx: 0,
                    },
                    game_ended: true,
                    panicked: true,
                    applied_index: idx,
                }
            }
            Err(panic_info) => {
                let msg = if let Some(s) = panic_info.downcast_ref::<&str>() {
                    s.to_string()
                } else if let Some(s) = panic_info.downcast_ref::<String>() {
                    s.clone()
                } else {
                    "unknown panic".to_string()
                };
                eprintln!(
                    "[MkAdapter] panic at seed={seed} step={step_count} action={action:?}: {msg}"
                );
                dump_crash_replay(state, seed, step_count, action_history);
                state.game_ended = true;
                StepOutcome {
                    action_set: LegalActionSet {
                        actions: vec![],
                        epoch: action_set.epoch + 1,
                        player_idx: 0,
                    },
                    game_ended: true,
                    panicked: true,
                    applied_index: idx,
                }
            }
        }
    }

    fn encode(env_state: &MkEnvState, action_set: &LegalActionSet) -> EncodedStep {
        mk_features::encode_step(&env_state.state, 0, action_set)
    }

    fn snapshot(
        env_state: &MkEnvState,
        action_set: &LegalActionSet,
        action_index: usize,
        _config: &MkConfig,
    ) -> MkSnapshot {
        let state = &env_state.state;
        let idx = action_index.min(action_set.actions.len().saturating_sub(1));
        let is_end_turn = matches!(
            action_set.actions.get(idx),
            Some(LegalAction::EndTurn)
        );
        let was_resting = state.players[0]
            .flags
            .contains(PlayerFlags::IS_RESTING)
            || state.players[0]
                .flags
                .contains(PlayerFlags::HAS_RESTED_THIS_TURN);

        MkSnapshot {
            fame_before: state.players[0].fame as i32,
            wounds_before: wound_count_in_hand(state),
            achievements_before: achievement_score_no_wounds(state),
            hexes_before: state.map.hexes.len(),
            move_points_before: state.players[0].move_points as i32,
            position_before: state.players[0].position.map(|p| (p.q, p.r)),
            is_end_turn,
            was_resting,
            visited_hexes_before: env_state.visited_hexes.len(),
            turn_hexes_snapshot: env_state.turn_hexes.clone(),
        }
    }

    fn compute_signals(
        snapshot: MkSnapshot,
        env_state: &MkEnvState,
        done: bool,
        panicked: bool,
        _truncated: bool,
        _config: &MkConfig,
    ) -> MkStepSignals {
        let state = &env_state.state;
        let fame_now = state.players[0].fame as i32;

        // New hex = visited_hexes grew (hex tracking updated during step)
        let new_hex = if env_state.visited_hexes.len() > snapshot.visited_hexes_before {
            1
        } else {
            0
        };

        // Check backtrack using pre-step turn_hexes snapshot
        let backtrack = if let Some(pos) = state.players[0].position {
            let coords = (pos.q, pos.r);
            if snapshot.is_end_turn {
                0
            } else {
                let moved = snapshot.position_before != Some(coords);
                if moved && snapshot.turn_hexes_snapshot.contains(&coords) {
                    1
                } else {
                    0
                }
            }
        } else {
            0
        };

        // Game score (only for done envs)
        let (game_score, achievement_categories) = if done && !panicked {
            let result = calculate_final_scores(state);
            if let Some(pr) = result.player_results.first() {
                let mut cats = [0i32; 6];
                if let Some(ref ach) = pr.achievements {
                    for cs in &ach.category_scores {
                        let idx = match cs.category {
                            AchievementCategory::GreatestKnowledge => 0,
                            AchievementCategory::GreatestLoot => 1,
                            AchievementCategory::GreatestLeader => 2,
                            AchievementCategory::GreatestConqueror => 3,
                            AchievementCategory::GreatestAdventurer => 4,
                            AchievementCategory::GreatestBeating => 5,
                        };
                        cats[idx] = cs.base_points;
                    }
                }
                (pr.total_score, cats)
            } else {
                (0, [0i32; 6])
            }
        } else {
            (0, [0i32; 6])
        };

        MkStepSignals {
            fame_delta: fame_now - snapshot.fame_before,
            fame: fame_now,
            panicked,
            scenario_end_triggered: state.scenario_end_triggered,
            new_hex,
            wound_delta: wound_count_in_hand(state) - snapshot.wounds_before,
            non_wound_hand_size: non_wound_hand_size(state),
            new_tile: if state.map.hexes.len() > snapshot.hexes_before { 1 } else { 0 },
            wasted_move_points: if snapshot.is_end_turn { snapshot.move_points_before } else { 0 },
            backtrack_move: backtrack,
            wound_count: full_deck_wound_count(state),
            total_card_count: full_deck_card_count(state),
            in_combat: state.combat.is_some(),
            rested_turn: if snapshot.is_end_turn && snapshot.was_resting { 1 } else { 0 },
            achievement_delta: achievement_score_no_wounds(state) - snapshot.achievements_before,
            game_score,
            achievement_categories,
        }
    }

    fn is_done(env_state: &MkEnvState, step_count: u64, max_steps: u64, config: &MkConfig) -> bool {
        let state = &env_state.state;
        if state.game_ended || step_count >= max_steps {
            return true;
        }
        if config.early_term_fame_step > 0
            && step_count >= config.early_term_fame_step
            && state.players[0].fame == 0
        {
            return true;
        }
        false
    }

    fn is_truncated(env_state: &MkEnvState, step_count: u64, max_steps: u64, config: &MkConfig) -> bool {
        let state = &env_state.state;
        let done = Self::is_done(env_state, step_count, max_steps, config);
        done && !state.game_ended
    }

    fn primary_signal(env_state: &MkEnvState) -> i32 {
        env_state.state.players[0].fame as i32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::packer::MkBatchPacker;
    use rl_core::{VecEnv, VecEnvConfig};

    type MkVecEnv = VecEnv<MkAdapter, MkBatchPacker>;

    fn test_config(num_envs: usize, base_seed: u32, max_steps: u64) -> VecEnvConfig<MkConfig> {
        VecEnvConfig {
            num_envs,
            base_seed,
            max_steps,
            game_config: MkConfig {
                hero: Hero::Arythea,
                scenario: TrainingScenario::default(),
                combat_oracle: false,
                commerce_oracle: false,
                early_term_fame_step: 0,
            },
        }
    }

    #[test]
    fn mk_vec_env_creates_and_encodes() {
        let config = test_config(4, 42, 100);
        let vec_env = MkVecEnv::new(config);

        assert_eq!(vec_env.num_envs(), 4);
        assert_eq!(vec_env.seeds(), vec![42, 43, 44, 45]);

        let batch = vec_env.encode_batch();
        assert_eq!(batch.num_envs, 4);
        // Should have arrays
        assert!(!batch.arrays_f32.is_empty());
        assert!(!batch.arrays_i32.is_empty());
    }

    #[test]
    fn mk_vec_env_steps_without_panic() {
        let config = test_config(2, 42, 50);
        let mut vec_env = MkVecEnv::new(config);

        // Step with action 0 for 20 steps
        for _ in 0..20 {
            let result = vec_env.step_batch(&[0, 0]);
            assert_eq!(result.dones.len(), 2);
            assert_eq!(result.applied_actions.len(), 2);
            // Should have signal entries
            assert!(!result.signals.is_empty());
        }
    }

    #[test]
    fn mk_vec_env_signals_match_expected_keys() {
        let config = test_config(1, 42, 100);
        let mut vec_env = MkVecEnv::new(config);

        let result = vec_env.step_batch(&[0]);
        let signal_names: Vec<&str> = result.signals.iter().map(|(name, _)| *name).collect();

        // Verify all expected Python dict keys are present
        assert!(signal_names.contains(&"fame_deltas"));
        assert!(signal_names.contains(&"fames"));
        assert!(signal_names.contains(&"panicked"));
        assert!(signal_names.contains(&"scenario_end_triggered"));
        assert!(signal_names.contains(&"new_hexes"));
        assert!(signal_names.contains(&"wound_deltas"));
        assert!(signal_names.contains(&"non_wound_hand_sizes"));
        assert!(signal_names.contains(&"new_tiles"));
        assert!(signal_names.contains(&"wasted_move_points"));
        assert!(signal_names.contains(&"backtrack_moves"));
        assert!(signal_names.contains(&"wound_counts"));
        assert!(signal_names.contains(&"total_card_counts"));
        assert!(signal_names.contains(&"in_combat"));
        assert!(signal_names.contains(&"rested_turns"));
        assert!(signal_names.contains(&"achievement_deltas"));
        assert!(signal_names.contains(&"game_scores"));
        assert!(signal_names.contains(&"achievement_categories"));
    }

    #[test]
    fn mk_vec_env_random_actions_full_game() {
        // Run a longer game with random-ish actions to verify no crashes
        let config = test_config(2, 100, 200);
        let mut vec_env = MkVecEnv::new(config);

        for step in 0..200 {
            let counts = vec_env.action_counts();
            // Pick action based on step to get some variety
            let actions: Vec<i32> = counts
                .iter()
                .map(|&c| if c > 0 { (step % c).max(0) } else { 0 })
                .collect();
            let result = vec_env.step_batch(&actions);

            // Verify no panics
            let panicked = result.signals.iter()
                .find(|(name, _)| *name == "panicked")
                .map(|(_, sig)| match sig {
                    rl_core::SignalArray::Bool(v) => v.clone(),
                    _ => panic!("expected bool"),
                })
                .unwrap();
            for (i, p) in panicked.iter().enumerate() {
                assert!(!p, "Engine panicked at step {step} env {i}");
            }
        }
    }

    #[test]
    fn mk_vec_env_encode_batch_keys() {
        let config = test_config(2, 42, 100);
        let vec_env = MkVecEnv::new(config);
        let batch = vec_env.encode_batch();

        // Verify key batch output arrays exist
        let f32_names: Vec<&str> = batch.arrays_f32.iter().map(|a| a.name).collect();
        let i32_names: Vec<&str> = batch.arrays_i32.iter().map(|a| a.name).collect();
        let scalar_names: Vec<&str> = batch.scalars_i32.iter().map(|(n, _)| *n).collect();

        assert!(f32_names.contains(&"state_scalars"));
        assert!(f32_names.contains(&"action_scalars"));
        assert!(i32_names.contains(&"state_ids"));
        assert!(i32_names.contains(&"hand_card_ids"));
        assert!(i32_names.contains(&"action_ids"));
        assert!(scalar_names.contains(&"hand_counts"));
        assert!(scalar_names.contains(&"action_counts"));
        assert!(scalar_names.contains(&"fames"));
    }

    /// Replay test ported from mk-env: verify the adapter produces the same
    /// behavior as the original SingleEnv for a known seed.
    #[test]
    fn mk_adapter_replay_seed_15604() {
        let actions: Vec<usize> = vec![
            5, 7, 4, 3, 3, 4, 2, 2, 0, 0, 4, 2, 6, 7, 4, 5, 6, 7, 4, 6, 1, 4, 1, 7, 7, 4,
            0, 0, 4, 2, 2, 0, 1, 0, 0, 3, 3, 8, 7, 7, 5, 4, 6, 2, 7, 5, 0, 3, 3, 1, 2, 0,
            6, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 4, 4, 5, 2, 2, 2, 2, 0, 2, 1, 0, 0, 0, 0, 0,
            0, 2, 2, 3, 2, 1, 5, 4, 3, 3, 4, 0, 3, 3, 1, 2, 6, 4, 1, 3, 0, 1, 10, 1, 1, 3,
            0, 2, 4, 1, 3, 2, 10, 3, 1, 0, 4, 1, 1, 4, 1, 3, 0, 10, 11, 2, 3, 5, 3, 9, 7,
            4, 4, 0, 3, 3, 5, 0, 2, 4, 3, 3, 1, 2, 0, 4, 4, 1, 3, 3, 5, 2, 1, 0, 2, 1, 0, 0,
        ];

        let config = MkConfig {
            hero: Hero::Arythea,
            scenario: TrainingScenario::default(),
            combat_oracle: false,
            commerce_oracle: false,
            early_term_fame_step: 0,
        };

        let (mut env_state, mut action_set) = MkAdapter::create(15604, &config);
        let mut history: Vec<LegalAction> = Vec::new();

        for (i, &action_idx) in actions.iter().enumerate() {
            assert!(
                !action_set.actions.is_empty(),
                "0 legal actions at step {i}"
            );
            let outcome = MkAdapter::step(
                &mut env_state,
                &action_set,
                action_idx,
                i as u64,
                15604,
                &history,
                &config,
            );
            let idx = action_idx.min(action_set.actions.len().saturating_sub(1));
            history.push(action_set.actions[idx].clone());
            assert!(!outcome.panicked, "Engine panicked at step {i}");
            action_set = outcome.action_set;
            if outcome.game_ended {
                return;
            }
        }

        assert!(
            !action_set.actions.is_empty(),
            "0 legal actions after replaying all {} actions",
            actions.len()
        );
    }

    /// Parity test: run the same seed through both old mk_env::VecEnv and
    /// new rl_core::VecEnv<MkAdapter> and verify signals match exactly.
    #[test]
    fn parity_with_mk_env() {
        let num_envs = 4;
        let base_seed = 42;
        let max_steps = 100;

        // Create old VecEnv
        let old_config = mk_env::VecEnvConfig {
            num_envs,
            base_seed,
            hero: Hero::Arythea,
            max_steps,
            scenario: mk_env::TrainingScenario::default(),
            combat_oracle: false,
            commerce_oracle: false,
            early_term_fame_step: 0,
        };
        let mut old_env = mk_env::VecEnv::new(old_config);

        // Create new VecEnv
        let new_config = test_config(num_envs, base_seed, max_steps);
        let mut new_env = MkVecEnv::new(new_config);

        // Verify seeds match
        assert_eq!(old_env.seeds(), new_env.seeds(), "seeds mismatch");

        // Verify encode_batch produces same fames
        let old_batch = old_env.encode_batch();
        let new_batch = new_env.encode_batch();
        let new_fames = new_batch.scalars_i32.iter()
            .find(|(name, _)| *name == "fames")
            .map(|(_, v)| v.clone())
            .unwrap();
        assert_eq!(old_batch.fames, new_fames, "initial fames mismatch");

        // Verify state_scalars match
        let new_state_scalars = new_batch.arrays_f32.iter()
            .find(|a| a.name == "state_scalars")
            .unwrap();
        assert_eq!(
            old_batch.state_scalars.len(),
            new_state_scalars.data.len(),
            "state_scalars length mismatch"
        );
        for (i, (old, new)) in old_batch.state_scalars.iter()
            .zip(new_state_scalars.data.iter())
            .enumerate()
        {
            assert!(
                (old - new).abs() < 1e-6,
                "state_scalars[{i}] mismatch: old={old} new={new}"
            );
        }

        // Verify action_counts match
        let new_action_counts = new_batch.scalars_i32.iter()
            .find(|(name, _)| *name == "action_counts")
            .map(|(_, v)| v.clone())
            .unwrap();
        assert_eq!(
            old_batch.action_counts, new_action_counts,
            "initial action_counts mismatch"
        );

        // Step both for 50 steps with same actions and compare
        for step in 0..50 {
            let old_counts = old_env.action_counts();
            let new_counts = new_env.action_counts();
            assert_eq!(old_counts, new_counts, "action_counts mismatch at step {step}");

            // Use deterministic action selection
            let actions: Vec<i32> = old_counts
                .iter()
                .map(|&c| if c > 0 { step % c } else { 0 })
                .collect();

            let old_result = old_env.step_batch(&actions);
            let new_result = new_env.step_batch(&actions);

            // Compare dones
            assert_eq!(old_result.dones, new_result.dones, "dones mismatch at step {step}");

            // Compare applied_actions
            assert_eq!(
                old_result.applied_actions, new_result.applied_actions,
                "applied_actions mismatch at step {step}"
            );

            // Compare truncated
            assert_eq!(
                old_result.truncated, new_result.truncated,
                "truncated mismatch at step {step}"
            );

            // Compare key signals
            fn get_i32_signal(signals: &[(&str, rl_core::SignalArray)], name: &str) -> Vec<i32> {
                signals.iter()
                    .find(|(n, _)| *n == name)
                    .map(|(_, sig)| match sig {
                        rl_core::SignalArray::I32(v) => v.clone(),
                        _ => panic!("expected I32 for {name}"),
                    })
                    .unwrap_or_default()
            }

            fn get_bool_signal(signals: &[(&str, rl_core::SignalArray)], name: &str) -> Vec<bool> {
                signals.iter()
                    .find(|(n, _)| *n == name)
                    .map(|(_, sig)| match sig {
                        rl_core::SignalArray::Bool(v) => v.clone(),
                        _ => panic!("expected Bool for {name}"),
                    })
                    .unwrap_or_default()
            }

            assert_eq!(
                old_result.fame_deltas,
                get_i32_signal(&new_result.signals, "fame_deltas"),
                "fame_deltas mismatch at step {step}"
            );
            assert_eq!(
                old_result.wound_deltas,
                get_i32_signal(&new_result.signals, "wound_deltas"),
                "wound_deltas mismatch at step {step}"
            );
            assert_eq!(
                old_result.new_hexes,
                get_i32_signal(&new_result.signals, "new_hexes"),
                "new_hexes mismatch at step {step}"
            );
            assert_eq!(
                old_result.new_tiles,
                get_i32_signal(&new_result.signals, "new_tiles"),
                "new_tiles mismatch at step {step}"
            );
            assert_eq!(
                old_result.wound_counts,
                get_i32_signal(&new_result.signals, "wound_counts"),
                "wound_counts mismatch at step {step}"
            );
            assert_eq!(
                old_result.total_card_counts,
                get_i32_signal(&new_result.signals, "total_card_counts"),
                "total_card_counts mismatch at step {step}"
            );
            assert_eq!(
                old_result.wasted_move_points,
                get_i32_signal(&new_result.signals, "wasted_move_points"),
                "wasted_move_points mismatch at step {step}"
            );
            assert_eq!(
                old_result.backtrack_moves,
                get_i32_signal(&new_result.signals, "backtrack_moves"),
                "backtrack_moves mismatch at step {step}"
            );
            assert_eq!(
                old_result.achievement_deltas,
                get_i32_signal(&new_result.signals, "achievement_deltas"),
                "achievement_deltas mismatch at step {step}"
            );
            assert_eq!(
                old_result.game_scores,
                get_i32_signal(&new_result.signals, "game_scores"),
                "game_scores mismatch at step {step}"
            );
            assert_eq!(
                old_result.rested_turns,
                get_i32_signal(&new_result.signals, "rested_turns"),
                "rested_turns mismatch at step {step}"
            );
            assert_eq!(
                old_result.in_combat,
                get_bool_signal(&new_result.signals, "in_combat"),
                "in_combat mismatch at step {step}"
            );
            assert_eq!(
                old_result.panicked,
                get_bool_signal(&new_result.signals, "panicked"),
                "panicked mismatch at step {step}"
            );
            assert_eq!(
                old_result.scenario_end_triggered,
                get_bool_signal(&new_result.signals, "scenario_end_triggered"),
                "scenario_end_triggered mismatch at step {step}"
            );

            // Compare fames
            assert_eq!(
                old_result.fames,
                get_i32_signal(&new_result.signals, "fames"),
                "fames mismatch at step {step}"
            );

            // Compare non_wound_hand_sizes
            assert_eq!(
                old_result.non_wound_hand_sizes,
                get_i32_signal(&new_result.signals, "non_wound_hand_sizes"),
                "non_wound_hand_sizes mismatch at step {step}"
            );

            // After dones, both should have reset with same seed
            assert_eq!(old_env.seeds(), new_env.seeds(), "seeds mismatch after step {step}");
        }
    }
}
