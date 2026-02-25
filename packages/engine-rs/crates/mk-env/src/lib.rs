//! Vectorized environment for RL training with Rayon parallelism.
//!
//! Runs N independent game environments in parallel, batching their
//! observations for efficient neural network forward passes.

pub mod batch_output;

use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::PathBuf;

use rayon::prelude::*;

use mk_engine::action_pipeline::{apply_legal_action, ApplyError};
use mk_engine::legal_actions::enumerate_legal_actions_with_undo;
use mk_engine::setup::{create_solo_game, place_initial_tiles};
use mk_engine::undo::UndoStack;
use mk_features::EncodedStep;
use mk_types::enums::Hero;
use mk_types::legal_action::LegalActionSet;
use mk_types::state::GameState;

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
}

impl SingleEnv {
    fn new(seed: u32, hero: Hero, max_steps: u64) -> Self {
        let mut state = create_solo_game(seed, hero);
        place_initial_tiles(&mut state);
        let undo_stack = UndoStack::new();
        let action_set = enumerate_legal_actions_with_undo(&state, 0, &undo_stack);
        Self {
            state,
            undo_stack,
            action_set,
            step_count: 0,
            seed,
            hero,
            max_steps,
        }
    }

    fn reset(&mut self, new_seed: u32) {
        self.seed = new_seed;
        self.state = create_solo_game(new_seed, self.hero);
        place_initial_tiles(&mut self.state);
        self.undo_stack = UndoStack::new();
        self.action_set = enumerate_legal_actions_with_undo(&self.state, 0, &self.undo_stack);
        self.step_count = 0;
    }

    fn fame(&self) -> u32 {
        self.state.players[0].fame
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
                self.action_set = new_actions;
                (apply_result.game_ended, false)
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
    pub fn new(num_envs: usize, base_seed: u32, hero: Hero, max_steps: u64) -> Self {
        let envs: Vec<SingleEnv> = (0..num_envs)
            .into_par_iter()
            .map(|i| SingleEnv::new(base_seed + i as u32, hero, max_steps))
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

        // Capture fames before stepping
        let fames_before: Vec<i32> = self.envs.iter().map(|e| e.fame() as i32).collect();

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

        // Compute deltas and dones
        let mut fame_deltas = Vec::with_capacity(n);
        let mut dones = Vec::with_capacity(n);
        let mut fames_after = Vec::with_capacity(n);
        let mut panicked = Vec::with_capacity(n);
        let mut truncated = Vec::with_capacity(n);
        let mut scenario_end_triggered = Vec::with_capacity(n);

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

    #[test]
    fn vec_env_creation() {
        let env = VecEnv::new(4, 42, Hero::Arythea, 100);
        assert_eq!(env.num_envs(), 4);
    }

    #[test]
    fn encode_batch_shapes() {
        let env = VecEnv::new(4, 42, Hero::Arythea, 100);
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
        let mut env = VecEnv::new(4, 42, Hero::Arythea, 100);

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
        let mut env = VecEnv::new(1, 42, Hero::Arythea, 5);

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
        let env = VecEnv::new(8, 1, Hero::Arythea, 100);
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
}
