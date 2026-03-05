//! Vectorized environment for RL training with Rayon parallelism.
//!
//! Runs N independent game environments in parallel, batching their
//! observations for efficient neural network forward passes.

pub mod batch_output;
pub mod training_scenario;

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::PathBuf;

use rayon::prelude::*;

use mk_engine::action_pipeline::{apply_legal_action, ApplyError};
use mk_engine::legal_actions::enumerate_legal_actions_with_undo;
use mk_engine::undo::UndoStack;
use mk_features::EncodedStep;
use mk_types::enums::Hero;
use mk_types::legal_action::{LegalAction, LegalActionSet};
use mk_types::state::GameState;

pub use training_scenario::TrainingScenario;
use training_scenario::create_training_game;

/// Remove Undo from an action set — RL agents should not use undo.
fn filter_undo(mut action_set: LegalActionSet) -> LegalActionSet {
    action_set.actions.retain(|a| !matches!(a, LegalAction::Undo));
    action_set
}

use batch_output::BatchOutput;

/// Dump a game state to `training/crashes/crash_{seed}_{step}.json` for reproduction.
fn dump_crash_state(state: &GameState, seed: u32, step: u64) {
    let dir = PathBuf::from("training/crashes");
    if let Err(e) = std::fs::create_dir_all(&dir) {
        eprintln!("[VecEnv] failed to create crash dir: {e}");
        return;
    }
    let path = dir.join(format!("crash_{seed}_{step}.json"));
    match serde_json::to_string(state) {
        Ok(json) => match std::fs::write(&path, json) {
            Ok(()) => eprintln!("[VecEnv] state dumped to {}", path.display()),
            Err(e) => eprintln!("[VecEnv] failed to write crash dump: {e}"),
        },
        Err(e) => eprintln!("[VecEnv] failed to serialize state: {e}"),
    }
}

// =============================================================================
// SingleEnv — one game instance
// =============================================================================

struct SingleEnv {
    state: GameState,
    undo_stack: UndoStack,
    action_set: LegalActionSet,
    step_count: u64,
    seed: u32,
    hero: Hero,
    max_steps: u64,
    scenario: TrainingScenario,
    /// Set of hex coordinates the player has visited (for exploration bonus).
    visited_hexes: std::collections::BTreeSet<(i32, i32)>,
}

impl SingleEnv {
    fn new(seed: u32, hero: Hero, max_steps: u64, scenario: TrainingScenario) -> Self {
        let result = create_training_game(seed, hero, &scenario);
        // Seed visited_hexes with starting position
        let mut visited_hexes = std::collections::BTreeSet::new();
        if let Some(pos) = result.state.players[0].position {
            visited_hexes.insert((pos.q, pos.r));
        }
        Self {
            state: result.state,
            undo_stack: result.undo_stack,
            action_set: result.action_set,
            step_count: 0,
            seed,
            hero,
            max_steps,
            scenario,
            visited_hexes,
        }
    }

    fn reset(&mut self, new_seed: u32) {
        self.seed = new_seed;
        let result = create_training_game(new_seed, self.hero, &self.scenario);
        self.state = result.state;
        self.undo_stack = result.undo_stack;
        self.action_set = result.action_set;
        self.step_count = 0;
        self.visited_hexes.clear();
        if let Some(pos) = self.state.players[0].position {
            self.visited_hexes.insert((pos.q, pos.r));
        }
    }

    fn fame(&self) -> u32 {
        self.state.players[0].fame
    }

    fn wound_count(&self) -> i32 {
        self.state.players[0]
            .hand
            .iter()
            .filter(|c| c.as_str() == "wound")
            .count() as i32
    }

    fn non_wound_hand_size(&self) -> i32 {
        self.state.players[0]
            .hand
            .iter()
            .filter(|c| c.as_str() != "wound")
            .count() as i32
    }

    /// Check if the player is on a hex they haven't visited before.
    /// If so, record it and return true.
    fn check_new_hex(&mut self) -> bool {
        if let Some(pos) = self.state.players[0].position {
            self.visited_hexes.insert((pos.q, pos.r))
        } else {
            false
        }
    }

    fn is_done(&self) -> bool {
        self.state.game_ended || self.step_count >= self.max_steps
    }

    fn action_count(&self) -> usize {
        self.action_set.actions.len()
    }

    fn encode(&self) -> EncodedStep {
        mk_features::encode_step(&self.state, 0, &self.action_set)
    }

    /// Apply an action by index. Returns (game_ended, panicked).
    fn step(&mut self, action_index: usize) -> (bool, bool) {
        let idx = action_index.min(self.action_set.actions.len().saturating_sub(1));
        let action = self.action_set.actions[idx].clone();
        let epoch = self.action_set.epoch;

        let result = catch_unwind(AssertUnwindSafe(|| {
            let apply_result =
                apply_legal_action(&mut self.state, &mut self.undo_stack, 0, &action, epoch)?;
            let new_actions =
                enumerate_legal_actions_with_undo(&self.state, 0, &self.undo_stack);
            Ok::<_, ApplyError>((apply_result, new_actions))
        }));

        match result {
            Ok(Ok((apply_result, new_actions))) => {
                self.step_count += 1;
                self.action_set = filter_undo(new_actions);

                // In CombatDrill, end episode when combat resolves
                let combat_drill_done =
                    matches!(self.scenario, TrainingScenario::CombatDrill { .. })
                        && self.state.combat.is_none();
                if combat_drill_done {
                    self.state.game_ended = true;
                }

                (apply_result.game_ended || combat_drill_done, false)
            }
            Ok(Err(e)) => {
                eprintln!(
                    "[VecEnv] error at seed={} step={} action={:?}: {:?}",
                    self.seed, self.step_count, action, e
                );
                dump_crash_state(&self.state, self.seed, self.step_count);
                self.state.game_ended = true;
                self.action_set = LegalActionSet {
                    actions: vec![],
                    epoch: self.action_set.epoch + 1,
                    player_idx: 0,
                };
                (true, true)
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
                    "[VecEnv] panic at seed={} step={} action={:?}: {}",
                    self.seed, self.step_count, action, msg
                );
                dump_crash_state(&self.state, self.seed, self.step_count);
                self.state.game_ended = true;
                self.action_set = LegalActionSet {
                    actions: vec![],
                    epoch: self.action_set.epoch + 1,
                    player_idx: 0,
                };
                (true, true)
            }
        }
    }
}

// =============================================================================
// StepResult — per-env results from step_batch
// =============================================================================

/// Results from a vectorized step.
pub struct StepResult {
    /// (N,) — per-env reward (fame delta + shaping done in Python)
    pub fame_deltas: Vec<i32>,
    /// (N,) — whether each env's episode is done
    pub dones: Vec<bool>,
    /// (N,) — current fame after stepping
    pub fames: Vec<i32>,
    /// (N,) — whether each env panicked (subset of dones)
    pub panicked: Vec<bool>,
    /// (N,) — whether done due to max_steps (not natural game end)
    pub truncated: Vec<bool>,
    /// (N,) — whether scenario end condition was triggered
    pub scenario_end_triggered: Vec<bool>,
    /// (N,) — number of new hexes visited this step (0 or 1)
    pub new_hexes: Vec<i32>,
    /// (N,) — change in wound count this step (positive = gained wounds)
    pub wound_deltas: Vec<i32>,
    /// (N,) — number of non-wound cards in hand (captured before auto-reset)
    pub non_wound_hand_sizes: Vec<i32>,
    /// (N,) — number of new tiles explored this step (0 or 1)
    pub new_tiles: Vec<i32>,
}

// =============================================================================
// VecEnv — N parallel game environments
// =============================================================================

/// Vectorized environment running N games in parallel via Rayon.
pub struct VecEnv {
    envs: Vec<SingleEnv>,
    next_seed: u32,
}

impl VecEnv {
    /// Create N parallel environments with incrementing seeds.
    pub fn new(
        num_envs: usize,
        base_seed: u32,
        hero: Hero,
        max_steps: u64,
        scenario: TrainingScenario,
    ) -> Self {
        let envs: Vec<SingleEnv> = (0..num_envs)
            .into_par_iter()
            .map(|i| SingleEnv::new(base_seed + i as u32, hero, max_steps, scenario.clone()))
            .collect();

        Self {
            envs,
            next_seed: base_seed + num_envs as u32,
        }
    }

    pub fn num_envs(&self) -> usize {
        self.envs.len()
    }

    /// Get the current seed for each environment.
    pub fn seeds(&self) -> Vec<u32> {
        self.envs.iter().map(|e| e.seed).collect()
    }

    /// Encode all environments in parallel, returning padded batch output.
    pub fn encode_batch(&self) -> BatchOutput {
        let encoded: Vec<(EncodedStep, i32)> = self
            .envs
            .par_iter()
            .map(|env| (env.encode(), env.fame() as i32))
            .collect();

        let steps: Vec<EncodedStep> = encoded.iter().map(|(s, _)| s.clone()).collect();
        let fames: Vec<i32> = encoded.iter().map(|(_, f)| *f).collect();

        BatchOutput::pack(&steps, &fames)
    }

    /// Step all environments in parallel with the given action indices.
    ///
    /// Auto-resets finished environments with incrementing seeds.
    pub fn step_batch(&mut self, actions: &[i32]) -> StepResult {
        let n = self.envs.len();
        assert_eq!(actions.len(), n, "actions length must match num_envs");

        // Capture fames, wounds, and hex counts before stepping
        let fames_before: Vec<i32> = self.envs.iter().map(|e| e.fame() as i32).collect();
        let wounds_before: Vec<i32> = self.envs.iter().map(|e| e.wound_count()).collect();
        let hexes_before: Vec<usize> = self.envs.iter().map(|e| e.state.map.hexes.len()).collect();

        // Step all envs in parallel
        let results: Vec<(bool, bool)> = self
            .envs
            .par_iter_mut()
            .zip(actions.par_iter())
            .map(|(env, &action)| {
                if env.is_done() {
                    // Already done — don't step, will be reset below
                    (true, false)
                } else {
                    env.step(action as usize)
                }
            })
            .collect();

        // Check for new hex visits (must be done before reset, requires &mut)
        let new_hex_flags: Vec<bool> = self
            .envs
            .iter_mut()
            .map(|env| env.check_new_hex())
            .collect();

        // Compute deltas and dones
        let mut fame_deltas = Vec::with_capacity(n);
        let mut dones = Vec::with_capacity(n);
        let mut fames_after = Vec::with_capacity(n);
        let mut panicked = Vec::with_capacity(n);
        let mut truncated = Vec::with_capacity(n);
        let mut scenario_end_triggered = Vec::with_capacity(n);
        let mut new_hexes = Vec::with_capacity(n);
        let mut wound_deltas = Vec::with_capacity(n);
        let mut non_wound_hand_sizes = Vec::with_capacity(n);
        let mut new_tiles = Vec::with_capacity(n);

        for (i, (game_ended, did_panic)) in results.iter().enumerate() {
            let env = &self.envs[i];
            let done = *game_ended || env.is_done();
            let fame_now = env.fame() as i32;
            fame_deltas.push(fame_now - fames_before[i]);
            dones.push(done);
            fames_after.push(fame_now);
            panicked.push(*did_panic);
            // Truncated = done due to max_steps, not natural game end
            truncated.push(done && !env.state.game_ended);
            scenario_end_triggered.push(env.state.scenario_end_triggered);
            new_hexes.push(if new_hex_flags[i] { 1 } else { 0 });
            wound_deltas.push(env.wound_count() - wounds_before[i]);
            non_wound_hand_sizes.push(env.non_wound_hand_size());
            let hexes_now = env.state.map.hexes.len();
            new_tiles.push(if hexes_now > hexes_before[i] { 1 } else { 0 });
        }

        // Auto-reset finished environments
        for (i, &done) in dones.iter().enumerate() {
            if done {
                let new_seed = self.next_seed;
                self.next_seed = self.next_seed.wrapping_add(1);
                self.envs[i].reset(new_seed);
            }
        }

        StepResult {
            fame_deltas,
            dones,
            fames: fames_after,
            panicked,
            truncated,
            scenario_end_triggered,
            new_hexes,
            wound_deltas,
            non_wound_hand_sizes,
            new_tiles,
        }
    }

    /// Get current action counts for all environments.
    pub fn action_counts(&self) -> Vec<i32> {
        self.envs.iter().map(|e| e.action_count() as i32).collect()
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Reproduce: seed=15604 with 156 action indices yields 0 legal actions.
    #[test]
    fn replay_seed_15604_zero_actions() {
        let actions: Vec<usize> = vec![
            5, 7, 4, 3, 3, 4, 2, 2, 0, 0, 4, 2, 6, 7, 4, 5, 6, 7, 4, 6, 1, 4, 1, 7, 7, 4,
            0, 0, 4, 2, 2, 0, 1, 0, 0, 3, 3, 8, 7, 7, 5, 4, 6, 2, 7, 5, 0, 3, 3, 1, 2, 0,
            6, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 4, 4, 5, 2, 2, 2, 2, 0, 2, 1, 0, 0, 0, 0, 0,
            0, 2, 2, 3, 2, 1, 5, 4, 3, 3, 4, 0, 3, 3, 1, 2, 6, 4, 1, 3, 0, 1, 10, 1, 1, 3,
            0, 2, 4, 1, 3, 2, 10, 3, 1, 0, 4, 1, 1, 4, 1, 3, 0, 10, 11, 2, 3, 5, 3, 9, 7,
            4, 4, 0, 3, 3, 5, 0, 2, 4, 3, 3, 1, 2, 0, 4, 4, 1, 3, 3, 5, 2, 1, 0, 2, 1, 0, 0,
        ];

        let mut env = SingleEnv::new(15604, Hero::Arythea, 500, TrainingScenario::default());
        for (i, &action_idx) in actions.iter().enumerate() {
            assert!(
                !env.action_set.actions.is_empty(),
                "0 legal actions at step {i} (before applying action index {action_idx})"
            );
            let action = &env.action_set.actions[action_idx.min(env.action_set.actions.len() - 1)];
            let p = &env.state.players[0];
            eprintln!(
                "step {i:>3}: idx={action_idx:<3} action={action:?}  hand={} flags={:?}",
                p.hand.len(), p.flags
            );
            let (game_ended, panicked) = env.step(action_idx);
            assert!(!panicked, "Engine panicked at step {i}");
            if game_ended {
                return; // Game ended normally, no bug
            }
        }
        // After all actions, should still have legal actions
        if env.action_set.actions.is_empty() {
            let s = &env.state;
            let p = &s.players[0];
            eprintln!("=== 0 legal actions after step {} ===", actions.len());
            eprintln!("phase: {:?}, round_phase: {:?}", s.phase, s.round_phase);
            eprintln!("combat: {:?}", s.combat.as_ref().map(|c| &c.phase));
            eprintln!("pending active: {:?}", p.pending.active);
            eprintln!("pending deferred: {:?}", p.pending.deferred);
            eprintln!("flags: {:?}", p.flags);
            eprintln!("position: {:?}", p.position);
            eprintln!("hand: {} cards, deck: {}, discard: {}", p.hand.len(), p.deck.len(), p.discard.len());
            eprintln!("game_ended: {}, scenario_end_triggered: {}", s.game_ended, s.scenario_end_triggered);
            panic!("0 legal actions after replaying all {} actions", actions.len());
        }
    }

    /// Reproduce: seed=9424 with 120 action indices yields 0 legal actions.
    #[test]
    fn replay_seed_9424_zero_actions() {
        let actions: Vec<usize> = vec![
            2, 0, 4, 0, 3, 1, 3, 2, 6, 1, 11, 2, 1, 5, 1, 4, 0, 15, 8, 11, 1, 4, 1, 0, 0, 2,
            2, 1, 7, 4, 0, 6, 5, 1, 3, 0, 0, 5, 6, 1, 6, 2, 0, 2, 7, 0, 7, 0, 0, 9, 5, 0, 5,
            0, 10, 4, 4, 4, 2, 1, 1, 0, 4, 7, 2, 4, 2, 1, 2, 1, 2, 2, 2, 0, 0, 0, 7, 5, 1, 1,
            3, 1, 1, 4, 2, 10, 4, 5, 4, 2, 2, 1, 1, 0, 2, 7, 0, 4, 0, 0, 2, 0, 0, 1, 1, 0, 0,
            1, 2, 2, 5, 1, 5, 3, 0, 0, 0, 3, 0, 2,
        ];

        let mut env = SingleEnv::new(9424, Hero::Arythea, 500, TrainingScenario::default());
        for (i, &action_idx) in actions.iter().enumerate() {
            assert!(
                !env.action_set.actions.is_empty(),
                "0 legal actions at step {i} (before applying action index {action_idx})"
            );
            let action = &env.action_set.actions[action_idx.min(env.action_set.actions.len() - 1)];
            let p = &env.state.players[0];
            eprintln!(
                "step {i:>3}: idx={action_idx:<3} action={action:?}  hand={} flags={:?}",
                p.hand.len(), p.flags
            );
            let (game_ended, panicked) = env.step(action_idx);
            assert!(!panicked, "Engine panicked at step {i}");
            if game_ended {
                return;
            }
        }
        if env.action_set.actions.is_empty() {
            let s = &env.state;
            let p = &s.players[0];
            eprintln!("=== 0 legal actions after step {} ===", actions.len());
            eprintln!("phase: {:?}, round_phase: {:?}", s.phase, s.round_phase);
            eprintln!("combat: {:?}", s.combat.as_ref().map(|c| &c.phase));
            eprintln!("pending active: {:?}", p.pending.active);
            eprintln!("pending deferred: {:?}", p.pending.deferred);
            eprintln!("flags: {:?}", p.flags);
            eprintln!("position: {:?}", p.position);
            eprintln!("hand: {:?}", p.hand);
            eprintln!("play_area: {:?}", p.play_area);
            eprintln!("influence: {}, healing: {}", p.influence_points, p.healing_points);
            eprintln!("game_ended: {}, scenario_end_triggered: {}", s.game_ended, s.scenario_end_triggered);
            panic!("0 legal actions after replaying all {} actions", actions.len());
        }
    }

    #[test]
    fn vec_env_creation() {
        let env = VecEnv::new(4, 42, Hero::Arythea, 100, TrainingScenario::default());
        assert_eq!(env.num_envs(), 4);
    }

    #[test]
    fn encode_batch_shapes() {
        let env = VecEnv::new(4, 42, Hero::Arythea, 100, TrainingScenario::default());
        let batch = env.encode_batch();
        assert_eq!(batch.num_envs, 4);
        assert_eq!(batch.state_scalars.len(), 4 * mk_features::STATE_SCALAR_DIM);
        assert_eq!(batch.state_ids.len(), 4 * 3);
        assert_eq!(batch.action_counts.len(), 4);
        assert_eq!(batch.hand_counts.len(), 4);
        assert_eq!(batch.fames.len(), 4);

        // All action counts should be > 0 at start
        for &c in &batch.action_counts {
            assert!(c > 0, "Expected legal actions at game start");
        }
    }

    #[test]
    fn step_batch_random_actions() {
        let mut env = VecEnv::new(4, 42, Hero::Arythea, 100, TrainingScenario::default());

        for _ in 0..10 {
            let batch = env.encode_batch();
            let actions: Vec<i32> = batch
                .action_counts
                .iter()
                .map(|&c| if c > 0 { 0 } else { 0 })
                .collect();
            let result = env.step_batch(&actions);
            assert_eq!(result.dones.len(), 4);
            assert_eq!(result.fame_deltas.len(), 4);
            assert_eq!(result.fames.len(), 4);
        }
    }

    #[test]
    fn auto_reset_on_max_steps() {
        let mut env = VecEnv::new(1, 42, Hero::Arythea, 5, TrainingScenario::default());

        // Step until the env is done
        let mut found_done = false;
        for _ in 0..20 {
            let _batch = env.encode_batch();
            let actions = vec![0i32; 1];
            let result = env.step_batch(&actions);
            if result.dones[0] {
                found_done = true;
                // After done, the env should auto-reset, next encode should work
                let batch2 = env.encode_batch();
                assert!(batch2.action_counts[0] > 0, "Reset env should have actions");
                break;
            }
        }
        assert!(found_done, "Expected env to reach done within 20 steps with max_steps=5");
    }

    #[test]
    fn padding_consistency() {
        let env = VecEnv::new(8, 1, Hero::Arythea, 100, TrainingScenario::default());
        let batch = env.encode_batch();

        // action_ids should be (N * max_actions * 6)
        assert_eq!(
            batch.action_ids.len(),
            8 * batch.max_actions * 6,
            "action_ids flat size mismatch"
        );
        // action_scalars should be (N * max_actions * ACTION_SCALAR_DIM)
        assert_eq!(
            batch.action_scalars.len(),
            8 * batch.max_actions * 34,
            "action_scalars flat size mismatch"
        );
    }

    #[test]
    fn combat_drill_vec_env_runs() {
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        };
        let mut env = VecEnv::new(4, 42, Hero::Arythea, 50, scenario);
        let batch = env.encode_batch();
        assert_eq!(batch.num_envs, 4);

        // All envs should start in combat with legal actions
        for &c in &batch.action_counts {
            assert!(c > 0, "Combat drill should have legal actions");
        }

        // Step a few times — should not panic
        for _ in 0..20 {
            let batch = env.encode_batch();
            let actions: Vec<i32> = batch.action_counts.iter().map(|_| 0).collect();
            let _result = env.step_batch(&actions);
        }
    }

    #[test]
    fn combat_drill_auto_resets() {
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        };
        let mut env = VecEnv::new(1, 42, Hero::Arythea, 10, scenario);

        let mut found_done = false;
        for _ in 0..50 {
            let _batch = env.encode_batch();
            let actions = vec![0i32; 1];
            let result = env.step_batch(&actions);
            if result.dones[0] {
                found_done = true;
                // Should auto-reset and still work
                let batch2 = env.encode_batch();
                assert!(batch2.action_counts[0] > 0, "Reset combat drill should have actions");
                break;
            }
        }
        assert!(found_done, "Combat drill should finish within 50 steps with max_steps=10");
    }

    #[test]
    fn combat_drill_ends_when_combat_resolves() {
        // Use a high max_steps so truncation isn't the cause of ending
        let scenario = TrainingScenario::CombatDrill {
            enemy_tokens: vec!["diggers_1".to_string()],
            is_fortified: false,
            hand_override: None,
            extra_cards: None,
            units: None,
            skills: None,
            crystals: None,
        };
        let mut env = VecEnv::new(1, 42, Hero::Arythea, 500, scenario);

        let mut done_step = None;
        for step in 0..200 {
            let _batch = env.encode_batch();
            let actions = vec![0i32; 1];
            let result = env.step_batch(&actions);
            if result.dones[0] {
                done_step = Some(step);
                // Should NOT be truncated — combat ended naturally
                assert!(
                    !result.truncated[0],
                    "Combat drill end should not be truncated (should be natural game end)"
                );
                break;
            }
        }
        let step = done_step.expect("Combat drill should end within 200 steps");
        // With action-0 policy, combat typically ends in 15-40 steps.
        // It should NOT run to 500 (max_steps).
        assert!(
            step < 100,
            "Combat drill ended at step {step} — expected < 100 (combat should resolve, not hit max_steps)"
        );
    }
}
