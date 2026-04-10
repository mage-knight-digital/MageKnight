use std::marker::PhantomData;

use rayon::prelude::*;

use crate::traits::{BatchPacker, GameAdapter};
use crate::types::{GenericBatchOutput, GenericStepResult, SignalArray, VecEnvConfig};

/// A single game environment instance within a VecEnv.
///
/// Safety: par_iter requires Sync. All fields are owned and independent
/// across envs, so Sync is safe when State/ActionSet/Action are Send.
struct SingleEnv<A: GameAdapter> {
    state: A::State,
    action_set: A::ActionSet,
    step_count: u64,
    seed: u32,
    action_history: Vec<A::Action>,
}

// SingleEnv is Sync when its contents are Send (each env is independent).
// par_iter takes &self (shared refs), par_iter_mut takes &mut self (exclusive refs).
// The VecEnv parallel loops never share data between envs.
unsafe impl<A: GameAdapter> Sync for SingleEnv<A>
where
    A::State: Send,
    A::ActionSet: Send,
    A::Action: Send,
{
}

impl<A: GameAdapter> SingleEnv<A> {
    fn new(seed: u32, config: &A::Config) -> Self {
        let (state, action_set) = A::create(seed, config);
        Self {
            state,
            action_set,
            step_count: 0,
            seed,
            action_history: Vec::new(),
        }
    }

    fn reset(&mut self, new_seed: u32, config: &A::Config) {
        self.seed = new_seed;
        self.action_set = A::reset(&mut self.state, new_seed, config);
        self.step_count = 0;
        self.action_history.clear();
    }
}

/// Vectorized environment running N games in parallel via Rayon.
///
/// Generic over any game implementing `GameAdapter` and any `BatchPacker`
/// for encoding observations.
pub struct VecEnv<A: GameAdapter, P: BatchPacker<Encoded = A::Encoded>> {
    envs: Vec<SingleEnv<A>>,
    next_seed: u32,
    config: VecEnvConfig<A::Config>,
    _packer: PhantomData<P>,
}

impl<A, P> VecEnv<A, P>
where
    A: GameAdapter,
    P: BatchPacker<Encoded = A::Encoded>,
{
    /// Create N parallel environments with incrementing seeds.
    pub fn new(config: VecEnvConfig<A::Config>) -> Self {
        let envs: Vec<SingleEnv<A>> = (0..config.num_envs)
            .into_par_iter()
            .map(|i| SingleEnv::new(config.base_seed + i as u32, &config.game_config))
            .collect();

        let next_seed = config.base_seed + config.num_envs as u32;
        Self {
            envs,
            next_seed,
            config,
            _packer: PhantomData,
        }
    }

    pub fn num_envs(&self) -> usize {
        self.envs.len()
    }

    /// Get the current seed for each environment.
    pub fn seeds(&self) -> Vec<u32> {
        self.envs.iter().map(|e| e.seed).collect()
    }

    /// Get current action counts for all environments.
    pub fn action_counts(&self) -> Vec<i32> {
        self.envs
            .iter()
            .map(|e| A::action_count(&e.action_set) as i32)
            .collect()
    }

    /// Encode all environments in parallel, returning padded batch output.
    pub fn encode_batch(&self) -> GenericBatchOutput {
        let encoded: Vec<(A::Encoded, i32)> = self
            .envs
            .par_iter()
            .map(|env| {
                let enc = A::encode(&env.state, &env.action_set);
                let signal = A::primary_signal(&env.state);
                (enc, signal)
            })
            .collect();

        let steps: Vec<A::Encoded> = encoded.iter().map(|(s, _)| s.clone()).collect();
        let primary_signals: Vec<i32> = encoded.iter().map(|(_, f)| *f).collect();

        P::pack(&steps, &[("fames", &primary_signals)])
    }

    /// Step all environments in parallel with the given action indices.
    ///
    /// Auto-resets finished environments with incrementing seeds.
    pub fn step_batch(&mut self, actions: &[i32]) -> GenericStepResult {
        let n = self.envs.len();
        assert_eq!(actions.len(), n, "actions length must match num_envs");

        // 1. Capture pre-step snapshots (sequential — reads only)
        let mut snapshots: Vec<Option<A::Snapshot>> = self
            .envs
            .iter()
            .zip(actions.iter())
            .map(|(env, &action)| {
                if A::is_done(
                    &env.state,
                    env.step_count,
                    self.config.max_steps,
                    &self.config.game_config,
                ) {
                    None
                } else {
                    Some(A::snapshot(
                        &env.state,
                        &env.action_set,
                        action as usize,
                        &self.config.game_config,
                    ))
                }
            })
            .collect();

        // 2. Step all envs in parallel
        let step_results: Vec<(bool, bool, usize)> = self
            .envs
            .par_iter_mut()
            .zip(actions.par_iter())
            .map(|(env, &action)| {
                if A::is_done(
                    &env.state,
                    env.step_count,
                    self.config.max_steps,
                    &self.config.game_config,
                ) {
                    (true, false, action as usize)
                } else {
                    let outcome = A::step(
                        &mut env.state,
                        &env.action_set,
                        action as usize,
                        env.step_count,
                        env.seed,
                        &env.action_history,
                        &self.config.game_config,
                    );
                    // Record the applied action for crash dump reproduction
                    let applied_idx = outcome.applied_index
                        .min(A::action_count(&env.action_set).saturating_sub(1));
                    if applied_idx < A::action_count(&env.action_set) {
                        env.action_history.push(
                            A::get_action(&env.action_set, applied_idx).clone()
                        );
                    }
                    env.step_count += 1;
                    env.action_set = outcome.action_set;
                    (outcome.game_ended, outcome.panicked, outcome.applied_index)
                }
            })
            .collect();

        // 3. Compute dones, truncated, signals
        let mut dones = Vec::with_capacity(n);
        let mut truncated_vec = Vec::with_capacity(n);
        let mut applied_actions = Vec::with_capacity(n);
        let mut all_signals: Vec<A::Signals> = Vec::with_capacity(n);

        for (i, &(game_ended, did_panic, clamped_idx)) in step_results.iter().enumerate() {
            applied_actions.push(clamped_idx as i32);

            let env = &self.envs[i];
            let done = game_ended
                || A::is_done(
                    &env.state,
                    env.step_count,
                    self.config.max_steps,
                    &self.config.game_config,
                );
            let is_truncated = done
                && A::is_truncated(
                    &env.state,
                    env.step_count,
                    self.config.max_steps,
                    &self.config.game_config,
                );

            dones.push(done);
            truncated_vec.push(is_truncated);

            // Consume the snapshot and compute signals
            let snapshot = snapshots[i].take();
            let signals = if let Some(snap) = snapshot {
                A::compute_signals(
                    snap,
                    &env.state,
                    done,
                    did_panic,
                    is_truncated,
                    &self.config.game_config,
                )
            } else {
                // Already-done env — compute signals from a fresh snapshot
                // (the env will be reset anyway, signals are zero/default)
                let snap = A::snapshot(
                    &env.state,
                    &env.action_set,
                    0,
                    &self.config.game_config,
                );
                A::compute_signals(
                    snap,
                    &env.state,
                    true,
                    did_panic,
                    is_truncated,
                    &self.config.game_config,
                )
            };
            all_signals.push(signals);
        }

        // 4. Auto-reset finished environments
        for (i, &done) in dones.iter().enumerate() {
            if done {
                let new_seed = self.next_seed;
                self.next_seed = self.next_seed.wrapping_add(1);
                self.envs[i].reset(new_seed, &self.config.game_config);
            }
        }

        // 5. Merge all per-env signals into columnar format
        let signal_map = merge_signals(all_signals);

        GenericStepResult {
            dones,
            truncated: truncated_vec,
            applied_actions,
            signals: signal_map,
        }
    }
}

/// Merge N per-env `Signals` into columnar `Vec<(&str, SignalArray)>`.
///
/// Takes the signal map from the first env to get key names and types,
/// then collects values from all envs into per-key arrays.
fn merge_signals<S: crate::traits::StepSignals>(signals: Vec<S>) -> Vec<(&'static str, SignalArray)> {
    if signals.is_empty() {
        return vec![];
    }

    // Get all signal maps
    let maps: Vec<Vec<(&'static str, SignalArray)>> =
        signals.into_iter().map(|s| s.to_signal_map()).collect();

    let n = maps.len();
    let num_keys = maps[0].len();
    let mut result = Vec::with_capacity(num_keys);

    for k in 0..num_keys {
        let name = maps[0][k].0;
        // Merge based on the type of the first env's signal
        match &maps[0][k].1 {
            SignalArray::I32(_) => {
                let mut merged = Vec::with_capacity(n);
                for m in &maps {
                    if let SignalArray::I32(v) = &m[k].1 {
                        merged.extend_from_slice(v);
                    }
                }
                result.push((name, SignalArray::I32(merged)));
            }
            SignalArray::F32(_) => {
                let mut merged = Vec::with_capacity(n);
                for m in &maps {
                    if let SignalArray::F32(v) = &m[k].1 {
                        merged.extend_from_slice(v);
                    }
                }
                result.push((name, SignalArray::F32(merged)));
            }
            SignalArray::Bool(_) => {
                let mut merged = Vec::with_capacity(n);
                for m in &maps {
                    if let SignalArray::Bool(v) = &m[k].1 {
                        merged.extend_from_slice(v);
                    }
                }
                result.push((name, SignalArray::Bool(merged)));
            }
            SignalArray::I32Fixed { width, .. } => {
                let width = *width;
                let mut merged = Vec::with_capacity(n * width);
                for m in &maps {
                    if let SignalArray::I32Fixed { data, .. } = &m[k].1 {
                        merged.extend_from_slice(data);
                    }
                }
                result.push((name, SignalArray::I32Fixed { data: merged, width }));
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::traits::StepSignals;
    use crate::types::StepOutcome;

    // ── Mock game for testing ──────────────────────────────────────

    /// A trivial counter game: state is a number, action increments it.
    struct MockAdapter;

    #[derive(Clone, serde::Serialize)]
    struct MockState {
        counter: i32,
        ended: bool,
    }

    #[derive(Clone, Debug, serde::Serialize)]
    struct MockAction {
        increment: i32,
    }

    #[derive(Clone)]
    struct MockActionSet {
        actions: Vec<MockAction>,
    }

    #[derive(Clone)]
    struct MockConfig {
        max_counter: i32,
    }

    struct MockSnapshot {
        counter_before: i32,
    }

    #[derive(Clone)]
    struct MockEncoded {
        counter: i32,
        action_count: usize,
    }

    struct MockSignals {
        counter_delta: i32,
    }

    impl StepSignals for MockSignals {
        fn to_signal_map(&self) -> Vec<(&'static str, SignalArray)> {
            vec![("counter_deltas", SignalArray::I32(vec![self.counter_delta]))]
        }
    }

    impl GameAdapter for MockAdapter {
        type State = MockState;
        type Action = MockAction;
        type ActionSet = MockActionSet;
        type Config = MockConfig;
        type Snapshot = MockSnapshot;
        type Encoded = MockEncoded;
        type Signals = MockSignals;

        fn create(seed: u32, _config: &MockConfig) -> (MockState, MockActionSet) {
            (
                MockState {
                    counter: seed as i32,
                    ended: false,
                },
                MockActionSet {
                    actions: vec![MockAction { increment: 1 }, MockAction { increment: 2 }],
                },
            )
        }

        fn reset(state: &mut MockState, seed: u32, _config: &MockConfig) -> MockActionSet {
            *state = MockState {
                counter: seed as i32,
                ended: false,
            };
            MockActionSet {
                actions: vec![MockAction { increment: 1 }, MockAction { increment: 2 }],
            }
        }

        fn action_count(action_set: &MockActionSet) -> usize {
            action_set.actions.len()
        }

        fn get_action(action_set: &MockActionSet, index: usize) -> &MockAction {
            &action_set.actions[index]
        }

        fn step(
            state: &mut MockState,
            action_set: &MockActionSet,
            action_index: usize,
            _step_count: u64,
            _seed: u32,
            _action_history: &[MockAction],
            config: &MockConfig,
        ) -> StepOutcome<MockActionSet> {
            let idx = action_index.min(action_set.actions.len().saturating_sub(1));
            state.counter += action_set.actions[idx].increment;
            if state.counter >= config.max_counter {
                state.ended = true;
            }
            StepOutcome {
                action_set: MockActionSet {
                    actions: vec![MockAction { increment: 1 }, MockAction { increment: 2 }],
                },
                game_ended: state.ended,
                panicked: false,
                applied_index: idx,
            }
        }

        fn encode(state: &MockState, action_set: &MockActionSet) -> MockEncoded {
            MockEncoded {
                counter: state.counter,
                action_count: action_set.actions.len(),
            }
        }

        fn snapshot(
            state: &MockState,
            _action_set: &MockActionSet,
            _action_index: usize,
            _config: &MockConfig,
        ) -> MockSnapshot {
            MockSnapshot {
                counter_before: state.counter,
            }
        }

        fn compute_signals(
            snapshot: MockSnapshot,
            state: &MockState,
            _done: bool,
            _panicked: bool,
            _truncated: bool,
            _config: &MockConfig,
        ) -> MockSignals {
            MockSignals {
                counter_delta: state.counter - snapshot.counter_before,
            }
        }

        fn is_done(state: &MockState, step_count: u64, max_steps: u64, _config: &MockConfig) -> bool {
            state.ended || step_count >= max_steps
        }

        fn is_truncated(state: &MockState, step_count: u64, max_steps: u64, _config: &MockConfig) -> bool {
            !state.ended && step_count >= max_steps
        }

        fn primary_signal(state: &MockState) -> i32 {
            state.counter
        }
    }

    struct MockPacker;

    impl BatchPacker for MockPacker {
        type Encoded = MockEncoded;

        fn pack(steps: &[MockEncoded], extras: &[(&'static str, &[i32])]) -> GenericBatchOutput {
            let n = steps.len();
            let counters: Vec<i32> = steps.iter().map(|s| s.counter).collect();
            let action_counts: Vec<i32> = steps.iter().map(|s| s.action_count as i32).collect();
            GenericBatchOutput {
                num_envs: n,
                arrays_f32: vec![],
                arrays_i32: vec![],
                scalars_i32: {
                    let mut v = vec![
                        ("counters", counters),
                        ("action_counts", action_counts),
                    ];
                    for &(name, data) in extras {
                        v.push((name, data.to_vec()));
                    }
                    v
                },
                scalars_usize: vec![],
            }
        }
    }

    // ── Tests ──────────────────────────────────────────────────────

    #[test]
    fn mock_vec_env_basic() {
        let config = VecEnvConfig {
            num_envs: 4,
            base_seed: 0,
            max_steps: 100,
            game_config: MockConfig { max_counter: 10 },
        };
        let vec_env: VecEnv<MockAdapter, MockPacker> = VecEnv::new(config);

        assert_eq!(vec_env.num_envs(), 4);
        assert_eq!(vec_env.seeds(), vec![0, 1, 2, 3]);
        assert_eq!(vec_env.action_counts(), vec![2, 2, 2, 2]);
    }

    #[test]
    fn mock_vec_env_encode() {
        let config = VecEnvConfig {
            num_envs: 2,
            base_seed: 5,
            max_steps: 100,
            game_config: MockConfig { max_counter: 10 },
        };
        let vec_env: VecEnv<MockAdapter, MockPacker> = VecEnv::new(config);
        let batch = vec_env.encode_batch();

        assert_eq!(batch.num_envs, 2);
        // Check fames (primary signal = counter = seed)
        let fames = batch
            .scalars_i32
            .iter()
            .find(|(name, _)| *name == "fames")
            .unwrap();
        assert_eq!(fames.1, vec![5, 6]);
    }

    #[test]
    fn mock_vec_env_step_and_reset() {
        let config = VecEnvConfig {
            num_envs: 2,
            base_seed: 0,
            max_steps: 100,
            game_config: MockConfig { max_counter: 5 },
        };
        let mut vec_env: VecEnv<MockAdapter, MockPacker> = VecEnv::new(config);

        // Initial counters: env0=0, env1=1
        // Action 1 = increment by 2
        let result = vec_env.step_batch(&[1, 1]);
        assert_eq!(result.dones, vec![false, false]);

        // env0: 0+2=2, env1: 1+2=3
        let deltas = result
            .signals
            .iter()
            .find(|(name, _)| *name == "counter_deltas")
            .unwrap();
        if let SignalArray::I32(v) = &deltas.1 {
            assert_eq!(v, &[2, 2]);
        } else {
            panic!("expected I32");
        }

        // Step again: env0: 2+2=4, env1: 3+2=5 (done!)
        let result = vec_env.step_batch(&[1, 1]);
        assert_eq!(result.dones, vec![false, true]);

        // env1 should have been reset with a new seed
        assert_eq!(vec_env.seeds()[1], 2); // next_seed was 2
    }
}
