/// A named array of f32 values for batch output.
pub struct BatchArrayF32 {
    pub name: &'static str,
    pub data: Vec<f32>,
    /// Shape hint for numpy reshape, e.g. [N, dim] or [N*max, dim].
    pub shape: Vec<usize>,
}

/// A named array of i32 values for batch output.
pub struct BatchArrayI32 {
    pub name: &'static str,
    pub data: Vec<i32>,
    /// Shape hint for numpy reshape.
    pub shape: Vec<usize>,
}

/// Game-agnostic batch output: named arrays ready for numpy export.
///
/// Games populate this via their `BatchPacker` implementation.
/// The PyO3 layer iterates over these arrays to construct Python dicts.
pub struct GenericBatchOutput {
    pub num_envs: usize,
    pub arrays_f32: Vec<BatchArrayF32>,
    pub arrays_i32: Vec<BatchArrayI32>,
    /// Scalar i32 values (e.g., counts per env).
    pub scalars_i32: Vec<(&'static str, Vec<i32>)>,
    /// Scalar usize values (e.g., max_actions).
    pub scalars_usize: Vec<(&'static str, usize)>,
}

/// A column of per-env signal values from a step.
pub enum SignalArray {
    I32(Vec<i32>),
    F32(Vec<f32>),
    Bool(Vec<bool>),
    /// Fixed-width i32 array per env (e.g., achievement_categories [i32; 6]).
    I32Fixed { data: Vec<i32>, width: usize },
}

/// Outcome of applying a single action in one environment.
pub struct StepOutcome<ActionSet> {
    pub action_set: ActionSet,
    pub game_ended: bool,
    pub panicked: bool,
    pub applied_index: usize,
}

/// Results from a vectorized step_batch call.
pub struct GenericStepResult {
    pub dones: Vec<bool>,
    pub truncated: Vec<bool>,
    pub applied_actions: Vec<i32>,
    /// Game-specific per-env signals (fame_deltas, wound_deltas, etc.).
    pub signals: Vec<(&'static str, SignalArray)>,
}

/// Configuration for creating a VecEnv.
#[derive(Clone)]
pub struct VecEnvConfig<C: Clone> {
    pub num_envs: usize,
    pub base_seed: u32,
    pub max_steps: u64,
    /// Game-specific configuration (hero, scenario, oracle flags, etc.).
    pub game_config: C,
}
