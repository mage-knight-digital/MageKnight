//! Game logic for Mage Knight — validate, execute, effects, valid_actions.
//!
//! All mutable game logic lives here. No Python dependency.

pub mod action_pipeline;
pub mod card_play;
pub mod effect_queue;
pub mod end_turn;
pub mod legal_actions;
pub mod mana;
pub mod movement;
pub mod setup;
pub mod undo;
pub mod valid_actions;
