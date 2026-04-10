use crate::types::{GenericBatchOutput, SignalArray, StepOutcome};

/// Per-step signals emitted by a game for reward computation.
///
/// Each game implements this to return its own diagnostic signals
/// (fame deltas, wound counts, etc.) that the Python reward shaping code reads.
pub trait StepSignals: Send {
    /// Convert to a list of named signal arrays for Python dict construction.
    ///
    /// Key names must match exactly what the Python training code reads.
    fn to_signal_map(&self) -> Vec<(&'static str, SignalArray)>;
}

/// Packs N encoded observations into a generic batch output.
///
/// Each game provides its own packer that knows how to pad variable-length
/// entity pools and produce the correct array shapes.
pub trait BatchPacker: Send + Sync + 'static {
    type Encoded: Clone + Send;

    /// Pack N encoded steps into a generic batch output.
    ///
    /// `extras` contains additional per-env scalar arrays to include
    /// (e.g., "fames" for the current fame per env).
    fn pack(steps: &[Self::Encoded], extras: &[(&'static str, &[i32])]) -> GenericBatchOutput;
}

/// Core trait that any turn-based game must implement for RL training.
///
/// The VecEnv is generic over this trait — different games provide different
/// implementations, but share the same parallel stepping infrastructure.
pub trait GameAdapter: Send + Sync + 'static {
    /// The full game state. Must be serializable for crash dumps.
    type State: Clone + Send + serde::Serialize;

    /// A single legal action.
    type Action: Clone + Send + serde::Serialize + std::fmt::Debug;

    /// The set of legal actions at a given state.
    type ActionSet: Clone + Send;

    /// Game-specific configuration (hero, scenario, oracle flags, etc.).
    type Config: Clone + Send + Sync;

    /// Pre-step snapshot for computing deltas (fame_before, wounds_before, etc.).
    type Snapshot: Send;

    /// Encoded observation for one step (state + actions).
    type Encoded: Clone + Send;

    /// Per-step signals for reward computation.
    type Signals: StepSignals;

    // ── Lifecycle ───────────────────────────────────────────────────

    /// Create a new game from seed and config.
    /// Returns (initial_state, initial_action_set).
    fn create(seed: u32, config: &Self::Config) -> (Self::State, Self::ActionSet);

    /// Reset a game state in-place with a new seed.
    /// Returns the new action set.
    fn reset(state: &mut Self::State, seed: u32, config: &Self::Config) -> Self::ActionSet;

    // ── Core step loop ─────────────────────────────────────────────

    /// Number of legal actions in the action set.
    fn action_count(action_set: &Self::ActionSet) -> usize;

    /// Get a reference to the action at the given index.
    fn get_action(action_set: &Self::ActionSet, index: usize) -> &Self::Action;

    /// Apply an action by index. Handles:
    /// - Action clamping (index >= count → clamp to last)
    /// - Oracle hooks (combat/commerce auto-resolution)
    /// - Panic catching
    /// - Error handling + crash dumps
    ///
    /// Returns a StepOutcome with the new action set and status.
    fn step(
        state: &mut Self::State,
        action_set: &Self::ActionSet,
        action_index: usize,
        step_count: u64,
        seed: u32,
        action_history: &[Self::Action],
        config: &Self::Config,
    ) -> StepOutcome<Self::ActionSet>;

    /// Encode state + action set for the neural network.
    fn encode(state: &Self::State, action_set: &Self::ActionSet) -> Self::Encoded;

    // ── Snapshot / Signals ─────────────────────────────────────────

    /// Capture a pre-step snapshot for delta computation.
    fn snapshot(state: &Self::State, action_set: &Self::ActionSet, action_index: usize, config: &Self::Config) -> Self::Snapshot;

    /// Compute per-env signals from pre-snapshot + post-state.
    fn compute_signals(
        snapshot: Self::Snapshot,
        state: &Self::State,
        done: bool,
        panicked: bool,
        truncated: bool,
        config: &Self::Config,
    ) -> Self::Signals;

    // ── Termination ────────────────────────────────────────────────

    /// Is this episode done? (game_ended, max_steps, early termination, etc.)
    fn is_done(state: &Self::State, step_count: u64, max_steps: u64, config: &Self::Config) -> bool;

    /// Is this a truncation (max_steps / early term) rather than natural game end?
    fn is_truncated(state: &Self::State, step_count: u64, max_steps: u64, config: &Self::Config) -> bool;

    /// Extract a primary scalar signal for batch encoding extras (e.g., fame).
    fn primary_signal(state: &Self::State) -> i32;
}
