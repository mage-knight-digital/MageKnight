//! PyO3 bindings for Python interop.
//!
//! Exposes the Rust game engine to Python via a `GameEngine` class.
//! This eliminates the need for a WebSocket server — Python drives
//! the engine directly in-process.

use std::panic::{catch_unwind, AssertUnwindSafe};

use pyo3::exceptions::{PyRuntimeError, PyValueError};
use pyo3::prelude::*;

use mk_engine::action_pipeline::{apply_legal_action, ApplyError};
use mk_engine::client_state::to_client_state;
use mk_engine::legal_actions::enumerate_legal_actions_with_undo;
use mk_engine::scoring::calculate_final_scores;
use mk_engine::setup::{create_solo_game, place_initial_tiles};
use mk_engine::undo::UndoStack;
use mk_types::enums::Hero;
use mk_types::legal_action::LegalActionSet;
use mk_types::state::GameState;

// =============================================================================
// Hero name → enum mapping
// =============================================================================

fn parse_hero(name: &str) -> PyResult<Hero> {
    match name.to_lowercase().as_str() {
        "arythea" => Ok(Hero::Arythea),
        "tovak" => Ok(Hero::Tovak),
        "goldyx" => Ok(Hero::Goldyx),
        "norowas" => Ok(Hero::Norowas),
        "wolfhawk" => Ok(Hero::Wolfhawk),
        "krang" => Ok(Hero::Krang),
        "braevalar" => Ok(Hero::Braevalar),
        _ => Err(PyValueError::new_err(format!("Unknown hero: {name}"))),
    }
}

// =============================================================================
// GameEngine — the main Python-facing class
// =============================================================================

/// A self-contained Mage Knight game engine.
///
/// Wraps the Rust game state, undo stack, and cached legal action set.
/// All game logic runs in-process — no network, no WebSocket.
///
/// Usage from Python:
///
///     from mk_python import GameEngine
///     engine = GameEngine(seed=42, hero="arythea")
///     while not engine.is_game_ended():
///         n = engine.legal_action_count()
///         engine.apply_action(random.randint(0, n - 1))
///     print(engine.fame())
#[pyclass]
struct GameEngine {
    state: GameState,
    undo_stack: UndoStack,
    action_set: LegalActionSet,
    player_idx: usize,
    step_count: u64,
}

#[pymethods]
impl GameEngine {
    /// Create a new solo game.
    ///
    /// Args:
    ///     seed: RNG seed for deterministic game generation.
    ///     hero: Hero name (e.g. "arythea", "tovak", "goldyx").
    #[new]
    #[pyo3(signature = (seed=42, hero="arythea"))]
    fn new(seed: u32, hero: &str) -> PyResult<Self> {
        let hero_enum = parse_hero(hero)?;
        let mut state = create_solo_game(seed, hero_enum);
        place_initial_tiles(&mut state);
        let undo_stack = UndoStack::new();
        let player_idx = 0;
        let action_set = enumerate_legal_actions_with_undo(&state, player_idx, &undo_stack);

        Ok(Self {
            state,
            undo_stack,
            action_set,
            player_idx,
            step_count: 0,
        })
    }

    /// Number of legal actions available in the current state.
    fn legal_action_count(&self) -> usize {
        self.action_set.actions.len()
    }

    /// The epoch (monotonic counter) of the current action set.
    fn epoch(&self) -> u64 {
        self.action_set.epoch
    }

    /// Apply the legal action at the given index.
    ///
    /// Args:
    ///     action_index: Index into the legal actions list (0-based).
    ///
    /// Returns:
    ///     True if the game ended after this action, False otherwise.
    ///
    /// Raises:
    ///     ValueError: If the index is out of range or the action fails.
    fn apply_action(&mut self, action_index: usize) -> PyResult<bool> {
        if action_index >= self.action_set.actions.len() {
            return Err(PyValueError::new_err(format!(
                "Action index {} out of range (0..{})",
                action_index,
                self.action_set.actions.len()
            )));
        }

        let action = self.action_set.actions[action_index].clone();
        let epoch = self.action_set.epoch;

        // Wrap in catch_unwind to convert panics into Python exceptions
        // instead of aborting the process.
        let result = catch_unwind(AssertUnwindSafe(|| {
            apply_legal_action(
                &mut self.state,
                &mut self.undo_stack,
                self.player_idx,
                &action,
                epoch,
            )
        }));

        match result {
            Ok(Ok(apply_result)) => {
                self.step_count += 1;
                // Re-enumerate legal actions after state change.
                self.action_set = enumerate_legal_actions_with_undo(
                    &self.state,
                    self.player_idx,
                    &self.undo_stack,
                );
                Ok(apply_result.game_ended)
            }
            Ok(Err(ApplyError::StaleActionSet { expected, got })) => {
                Err(PyValueError::new_err(format!(
                    "Stale epoch: state at {expected}, action set at {got}"
                )))
            }
            Ok(Err(ApplyError::InternalError(msg))) => {
                Err(PyValueError::new_err(format!("Internal error: {msg}")))
            }
            Err(panic_info) => {
                let msg = if let Some(s) = panic_info.downcast_ref::<String>() {
                    s.clone()
                } else if let Some(s) = panic_info.downcast_ref::<&str>() {
                    s.to_string()
                } else {
                    "Unknown panic in engine".to_string()
                };
                Err(PyRuntimeError::new_err(format!("Engine panic: {msg}")))
            }
        }
    }

    /// Whether the game has ended.
    fn is_game_ended(&self) -> bool {
        self.state.game_ended
    }

    /// Current player fame.
    fn fame(&self) -> u32 {
        self.state.players[self.player_idx].fame
    }

    /// Current player level.
    fn level(&self) -> u32 {
        self.state.players[self.player_idx].level
    }

    /// Current player reputation.
    fn reputation(&self) -> i8 {
        self.state.players[self.player_idx].reputation
    }

    /// Current round number.
    fn round(&self) -> u32 {
        self.state.round
    }

    /// Total steps applied so far.
    fn step_count(&self) -> u64 {
        self.step_count
    }

    /// Undo the last reversible action.
    ///
    /// Returns True if undo succeeded, False if nothing to undo.
    fn undo(&mut self) -> bool {
        if let Some(restored) = self.undo_stack.undo() {
            self.state = restored;
            self.action_set = enumerate_legal_actions_with_undo(
                &self.state,
                self.player_idx,
                &self.undo_stack,
            );
            true
        } else {
            false
        }
    }

    /// Get the legal actions as a JSON string.
    ///
    /// Returns a JSON array of LegalAction objects. Useful for debugging
    /// or when Python code needs to inspect action details.
    fn legal_actions_json(&self) -> PyResult<String> {
        serde_json::to_string(&self.action_set.actions)
            .map_err(|e| PyValueError::new_err(format!("Serialization error: {e}")))
    }

    /// Get the client-visible game state as a JSON string.
    ///
    /// Returns the same filtered state shape that the WebSocket server
    /// would send. Useful for compatibility with existing Python code
    /// that parses ClientGameState JSON.
    fn client_state_json(&self) -> PyResult<String> {
        let player_id = &self.state.players[self.player_idx].id;
        let client_state = to_client_state(&self.state, player_id);
        serde_json::to_string(&client_state)
            .map_err(|e| PyValueError::new_err(format!("Serialization error: {e}")))
    }

    /// Compute and return final scores as a JSON string.
    ///
    /// Can be called at any point but is most meaningful after game_ended.
    fn final_scores_json(&self) -> PyResult<String> {
        let scores = calculate_final_scores(&self.state);
        serde_json::to_string(&scores)
            .map_err(|e| PyValueError::new_err(format!("Serialization error: {e}")))
    }

    /// String representation for debugging.
    fn __repr__(&self) -> String {
        format!(
            "GameEngine(round={}, fame={}, steps={}, actions={}, ended={})",
            self.state.round,
            self.state.players[self.player_idx].fame,
            self.step_count,
            self.action_set.actions.len(),
            self.state.game_ended,
        )
    }
}

// =============================================================================
// Module registration
// =============================================================================

#[pymodule]
fn mk_python(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add("__version__", "0.1.0")?;
    m.add_class::<GameEngine>()?;
    Ok(())
}
