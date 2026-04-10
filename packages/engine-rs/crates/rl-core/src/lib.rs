//! Generic vectorized RL environment framework for turn-based games.
//!
//! Provides traits and infrastructure for training RL agents on any game
//! that implements the `GameAdapter` trait. Includes parallel environment
//! stepping via Rayon and generic batch encoding for neural network input.

pub mod crash_dump;
pub mod traits;
pub mod types;
pub mod vec_env;

pub use crash_dump::dump_crash_replay;
pub use traits::{BatchPacker, GameAdapter, StepSignals};
pub use types::{
    BatchArrayF32, BatchArrayI32, GenericBatchOutput, GenericStepResult, SignalArray, StepOutcome,
    VecEnvConfig,
};
pub use vec_env::VecEnv;
