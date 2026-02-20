//! Core types for Mage Knight engine — zero external deps beyond serde.
//!
//! This crate defines every type used across the engine: IDs, enums,
//! game state structures, player actions, effects, and modifiers.
//! It has no game logic — just data definitions.

pub mod action;
pub mod effect;
pub mod enums;
pub mod hex;
pub mod ids;
pub mod legal_action;
pub mod modifier;
pub mod pending;
pub mod rng;
pub mod state;

// Re-export commonly used types at crate root
pub use action::PlayerAction;
pub use enums::*;
pub use hex::{HexCoord, HexDirection};
pub use ids::*;
pub use rng::RngState;
