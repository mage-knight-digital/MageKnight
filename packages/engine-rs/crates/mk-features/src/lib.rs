//! RL feature extraction — state/action encoding for Mage Knight.
//!
//! Produces identical output to the Python encoder for checkpoint compatibility.
//!
//! # Architecture
//!
//! ```text
//! encode_step(state, player_idx, action_set)
//!   ├── encode_state()   → StateFeatures (85 scalars + entity pools)
//!   ├── derive_mode()    → mode_id
//!   ├── encode_actions() → Vec<ActionFeatures> (6 IDs + 34 scalars each)
//!   │     └── derive_source() per action
//!   └── EncodedStep { state, actions }
//! ```

pub mod action_encoder;
pub mod mode_derivation;
pub mod source_derivation;
pub mod state_encoder;
pub mod types;
pub mod vocab;

pub use types::{
    ActionFeatures, EncodedStep, StateFeatures, ACTION_SCALAR_DIM, COMBAT_ENEMY_SCALAR_DIM,
    MAP_ENEMY_SCALAR_DIM, SITE_SCALAR_DIM, STATE_SCALAR_DIM, UNIT_SCALAR_DIM,
};
pub use vocab::{
    ACTION_TYPE_VOCAB, CARD_VOCAB, ENEMY_VOCAB, MODE_VOCAB, SITE_VOCAB, SKILL_VOCAB,
    SOURCE_VOCAB, TERRAIN_VOCAB, UNIT_VOCAB,
};

use mk_types::legal_action::LegalActionSet;
use mk_types::state::GameState;

/// Encode one decision step: state features + per-action features.
///
/// This is the main entry point for the RL feature encoding pipeline.
pub fn encode_step(
    state: &GameState,
    player_idx: usize,
    action_set: &LegalActionSet,
) -> EncodedStep {
    let state_features = state_encoder::encode_state(state, player_idx);
    let action_features =
        action_encoder::encode_actions(state, player_idx, &action_set.actions);

    EncodedStep {
        state: state_features,
        actions: action_features,
    }
}
