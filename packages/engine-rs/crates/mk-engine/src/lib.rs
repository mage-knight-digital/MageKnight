//! Game logic for Mage Knight — validate, execute, effects, valid_actions.
//!
//! All mutable game logic lives here. No Python dependency.

pub mod action_pipeline;
pub mod card_play;
pub mod client_state;
pub mod combat;
pub mod combat_resolution;
pub mod cooperative_assault;
pub mod dummy_player;
pub mod effect_queue;
pub mod end_turn;
pub mod legal_actions;
pub mod mana;
pub mod movement;
pub mod scoring;
pub mod setup;
pub mod undo;
pub mod valid_actions;

#[cfg(test)]
mod parity_tests;
