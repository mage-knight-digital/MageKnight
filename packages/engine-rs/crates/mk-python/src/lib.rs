//! PyO3 bindings for Python interop.
//!
//! Exposes the Rust game engine to Python via a `GameEngine` class.
//! This eliminates the need for a WebSocket server — Python drives
//! the engine directly in-process.

// PyO3 #[pymethods] macro generates unnecessary `.into()` on PyErr in PyResult return types.
// See: https://github.com/PyO3/pyo3/issues/4828
#![allow(clippy::useless_conversion)]

use std::panic::{catch_unwind, AssertUnwindSafe};

use pyo3::exceptions::{PyRuntimeError, PyValueError};
use pyo3::prelude::*;

use mk_engine::action_pipeline::{apply_legal_action, initial_events, ApplyError};
use mk_engine::client_state::to_client_state;
use mk_engine::combat_search::{search_combat, CombatSearchConfig};
use mk_engine::legal_actions::enumerate_legal_actions_with_undo;
use mk_engine::scoring::calculate_final_scores;
use mk_engine::setup::{create_solo_game, place_initial_tiles};
use mk_engine::undo::UndoStack;
use mk_env::{TrainingScenario, VecEnv};
use mk_features::EncodedStep;
use mk_types::enums::Hero;
use mk_types::events::GameEvent;
use mk_types::legal_action::{LegalAction, LegalActionSet};
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

fn parse_scenario(scenario: Option<&str>) -> PyResult<TrainingScenario> {
    match scenario {
        None | Some("full_game") => Ok(TrainingScenario::FullGame),
        Some(json) => serde_json::from_str(json).map_err(|e| {
            PyValueError::new_err(format!("Invalid scenario JSON: {e}"))
        }),
    }
}

// =============================================================================
// PyEncodedStep — RL feature encoding exposed to Python
// =============================================================================

/// Encoded RL features for one decision step.
///
/// Contains state features (shared across actions) and per-action features.
/// Use accessor methods to extract data for tensor construction.
///
///     encoded = engine.encode_step()
///     scalars = encoded.state_scalars()       # 76 floats
///     mode = encoded.mode_id()                # u16
///     action_types = encoded.action_type_ids() # list[u16]
#[pyclass]
struct PyEncodedStep {
    inner: EncodedStep,
}

#[pymethods]
impl PyEncodedStep {
    // ── State features ──────────────────────────────────────────────

    /// 85 state scalar features.
    fn state_scalars(&self) -> Vec<f32> {
        self.inner.state.scalars.clone()
    }

    /// MODE_VOCAB index for the current game mode.
    fn mode_id(&self) -> u16 {
        self.inner.state.mode_id
    }

    /// CARD_VOCAB indices for cards in the player's hand.
    fn hand_card_ids(&self) -> Vec<u16> {
        self.inner.state.hand_card_ids.clone()
    }

    /// CARD_VOCAB indices for cards in the draw pile.
    fn deck_card_ids(&self) -> Vec<u16> {
        self.inner.state.deck_card_ids.clone()
    }

    /// CARD_VOCAB indices for cards in the discard pile.
    fn discard_card_ids(&self) -> Vec<u16> {
        self.inner.state.discard_card_ids.clone()
    }

    /// UNIT_VOCAB indices for the player's units.
    fn unit_ids(&self) -> Vec<u16> {
        self.inner.state.unit_ids.clone()
    }

    /// UNIT_SCALAR_DIM floats per unit [is_ready, is_wounded] (list of lists).
    fn unit_scalars(&self) -> Vec<Vec<f32>> {
        self.inner.state.unit_scalars.clone()
    }

    /// SKILL_VOCAB indices for the player's skills.
    fn skill_ids(&self) -> Vec<u16> {
        self.inner.state.skill_ids.clone()
    }

    /// TERRAIN_VOCAB index for the current hex terrain.
    fn current_terrain_id(&self) -> u16 {
        self.inner.state.current_terrain_id
    }

    /// SITE_VOCAB index for the current hex site type.
    fn current_site_type_id(&self) -> u16 {
        self.inner.state.current_site_type_id
    }

    /// ENEMY_VOCAB indices for combat enemies.
    fn combat_enemy_ids(&self) -> Vec<u16> {
        self.inner.state.combat_enemy_ids.clone()
    }

    /// COMBAT_ENEMY_SCALAR_DIM floats per combat enemy (list of lists).
    fn combat_enemy_scalars(&self) -> Vec<Vec<f32>> {
        self.inner.state.combat_enemy_scalars.clone()
    }

    /// SITE_VOCAB indices for all visible sites on the map.
    fn visible_site_ids(&self) -> Vec<u16> {
        self.inner.state.visible_site_ids.clone()
    }

    /// SITE_SCALAR_DIM floats per visible site (list of lists).
    fn visible_site_scalars(&self) -> Vec<Vec<f32>> {
        self.inner.state.visible_site_scalars.clone()
    }

    /// ENEMY_VOCAB indices for all map enemies (not in active combat).
    fn map_enemy_ids(&self) -> Vec<u16> {
        self.inner.state.map_enemy_ids.clone()
    }

    /// MAP_ENEMY_SCALAR_DIM floats per map enemy (list of lists).
    fn map_enemy_scalars(&self) -> Vec<Vec<f32>> {
        self.inner.state.map_enemy_scalars.clone()
    }

    // ── Action features ─────────────────────────────────────────────

    /// Number of legal actions.
    fn action_count(&self) -> usize {
        self.inner.actions.len()
    }

    /// ACTION_TYPE_VOCAB indices for all actions.
    fn action_type_ids(&self) -> Vec<u16> {
        self.inner.actions.iter().map(|a| a.action_type_id).collect()
    }

    /// SOURCE_VOCAB indices for all actions.
    fn action_source_ids(&self) -> Vec<u16> {
        self.inner.actions.iter().map(|a| a.source_id).collect()
    }

    /// CARD_VOCAB indices for all actions.
    fn action_card_ids(&self) -> Vec<u16> {
        self.inner.actions.iter().map(|a| a.card_id).collect()
    }

    /// UNIT_VOCAB indices for all actions.
    fn action_unit_ids(&self) -> Vec<u16> {
        self.inner.actions.iter().map(|a| a.unit_id).collect()
    }

    /// ENEMY_VOCAB indices for all actions.
    fn action_enemy_ids(&self) -> Vec<u16> {
        self.inner.actions.iter().map(|a| a.enemy_id).collect()
    }

    /// SKILL_VOCAB indices for all actions.
    fn action_skill_ids(&self) -> Vec<u16> {
        self.inner.actions.iter().map(|a| a.skill_id).collect()
    }

    /// ACTION_SCALAR_DIM floats per action (M x 34 list of lists).
    fn action_scalars(&self) -> Vec<Vec<f32>> {
        self.inner.actions.iter().map(|a| a.scalars.clone()).collect()
    }

    /// ENEMY_VOCAB indices for multi-target attacks at the given action index.
    fn action_target_enemy_ids(&self, index: usize) -> PyResult<Vec<u16>> {
        self.inner
            .actions
            .get(index)
            .map(|a| a.target_enemy_ids.clone())
            .ok_or_else(|| {
                PyValueError::new_err(format!(
                    "Action index {} out of range (0..{})",
                    index,
                    self.inner.actions.len()
                ))
            })
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
    /// Events from the last action (or initial events on new game).
    last_events: Vec<GameEvent>,
    /// When true, Undo actions are filtered from the legal action set.
    rl_mode: bool,
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
        let events = initial_events(&state, seed, hero_enum);

        Ok(Self {
            state,
            undo_stack,
            action_set,
            player_idx,
            step_count: 0,
            last_events: events,
            rl_mode: false,
        })
    }

    /// Enable RL mode: filters Undo from legal actions.
    fn set_rl_mode(&mut self, enabled: bool) {
        self.rl_mode = enabled;
        if enabled {
            self.action_set
                .actions
                .retain(|a| !matches!(a, LegalAction::Undo));
        }
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
            let diag = self.debug_empty_actions();
            return Err(PyValueError::new_err(format!(
                "Action index {} out of range (0..{}) | {}",
                action_index,
                self.action_set.actions.len(),
                diag,
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
                self.last_events = apply_result.events;
                // Re-enumerate legal actions after state change.
                self.action_set = enumerate_legal_actions_with_undo(
                    &self.state,
                    self.player_idx,
                    &self.undo_stack,
                );
                if self.rl_mode {
                    self.action_set
                        .actions
                        .retain(|a| !matches!(a, LegalAction::Undo));
                }
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

    /// Number of wound cards in hand.
    fn wound_count(&self) -> i32 {
        self.state.players[self.player_idx]
            .hand
            .iter()
            .filter(|c| c.as_str() == "wound")
            .count() as i32
    }

    /// Total wound cards across hand + deck + discard (full deck).
    fn full_deck_wound_count(&self) -> i32 {
        let p = &self.state.players[self.player_idx];
        (p.hand.iter().filter(|c| c.as_str() == "wound").count()
            + p.deck.iter().filter(|c| c.as_str() == "wound").count()
            + p.discard.iter().filter(|c| c.as_str() == "wound").count()) as i32
    }

    /// Total cards across hand + deck + discard (full deck).
    fn full_deck_card_count(&self) -> i32 {
        let p = &self.state.players[self.player_idx];
        (p.hand.len() + p.deck.len() + p.discard.len()) as i32
    }

    /// Current round number.
    fn round(&self) -> u32 {
        self.state.round
    }

    /// Whether the scenario end condition has been triggered (e.g. city revealed).
    fn scenario_end_triggered(&self) -> bool {
        self.state.scenario_end_triggered
    }

    /// Current player position as (q, r) hex coordinates, or None if not on the map.
    fn player_position(&self) -> Option<(i32, i32)> {
        self.state.players[self.player_idx]
            .position
            .map(|p| (p.q, p.r))
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
            self.last_events = vec![GameEvent::Undone {
                player_id: self.state.players[self.player_idx].id.clone(),
            }];
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

    /// Auto-resolve combat using the exhaustive search oracle.
    ///
    /// If the engine is currently in combat, runs the combat search to find
    /// the optimal action sequence, then replays those actions. Returns the
    /// list of action indices that were applied (for recording in replays).
    ///
    /// Returns an empty list if not in combat.
    fn auto_resolve_combat(&mut self) -> PyResult<Vec<i32>> {
        if self.state.combat.is_none() {
            return Ok(vec![]);
        }

        let config = CombatSearchConfig {
            node_limit: 1_000_000,
            seed_rollouts: 500,
        };
        let result = search_combat(&self.state, &config);

        let mut action_indices = Vec::new();

        // Replay optimal actions from the search result
        for action in &result.actions {
            if self.state.combat.is_none() || self.state.game_ended {
                break;
            }
            // Find the action index in the current legal action set
            let idx = self.action_set.actions.iter().position(|a| a == action);
            if let Some(idx) = idx {
                action_indices.push(idx as i32);
                // Apply it through the normal path to keep events/epoch in sync
                let epoch = self.action_set.epoch;
                match apply_legal_action(
                    &mut self.state,
                    &mut self.undo_stack,
                    self.player_idx,
                    action,
                    epoch,
                ) {
                    Ok(apply_result) => {
                        self.step_count += 1;
                        self.last_events = apply_result.events;
                        self.action_set = enumerate_legal_actions_with_undo(
                            &self.state,
                            self.player_idx,
                            &self.undo_stack,
                        );
                        if self.rl_mode {
                            self.action_set
                                .actions
                                .retain(|a| !matches!(a, LegalAction::Undo));
                        }
                    }
                    Err(_) => break,
                }
            } else {
                break; // Action not found — fall through to fallback
            }
        }

        // Fallback: if combat didn't fully resolve, pick EndCombatPhase or EndTurn
        // to cleanly exit. Avoid picking card plays after all enemies are defeated.
        while self.state.combat.is_some() && !self.state.game_ended {
            if self.action_set.actions.is_empty() {
                break;
            }
            // Prefer EndCombatPhase > EndTurn > action 0
            let fallback_idx = self
                .action_set
                .actions
                .iter()
                .position(|a| matches!(a, LegalAction::EndCombatPhase))
                .or_else(|| {
                    self.action_set
                        .actions
                        .iter()
                        .position(|a| matches!(a, LegalAction::EndTurn))
                })
                .unwrap_or(0);
            action_indices.push(fallback_idx as i32);
            let action = self.action_set.actions[fallback_idx].clone();
            let epoch = self.action_set.epoch;
            match apply_legal_action(
                &mut self.state,
                &mut self.undo_stack,
                self.player_idx,
                &action,
                epoch,
            ) {
                Ok(apply_result) => {
                    self.step_count += 1;
                    self.last_events = apply_result.events;
                    self.action_set = enumerate_legal_actions_with_undo(
                        &self.state,
                        self.player_idx,
                        &self.undo_stack,
                    );
                    if self.rl_mode {
                        self.action_set
                            .actions
                            .retain(|a| !matches!(a, LegalAction::Undo));
                    }
                }
                Err(_) => break,
            }
        }

        Ok(action_indices)
    }

    /// Whether the engine is currently in combat.
    fn in_combat(&self) -> bool {
        self.state.combat.is_some()
    }

    /// Get the oracle's recommended action index for the current combat state.
    ///
    /// Runs the combat search and returns the index of the first action
    /// in the optimal sequence (within the current legal action set).
    /// Returns None if not in combat or no action found.
    ///
    /// Does NOT apply the action — call apply_action() with the result.
    fn combat_oracle_action(&self) -> Option<usize> {
        if self.state.combat.is_none() {
            return None;
        }

        let config = CombatSearchConfig {
            node_limit: 1_000_000,
            seed_rollouts: 500,
        };
        let result = search_combat(&self.state, &config);

        // Find the first action from the optimal sequence in the current action set
        if let Some(action) = result.actions.first() {
            self.action_set
                .actions
                .iter()
                .position(|a| a == action)
        } else {
            // Search returned no actions — all enemies defeated or no viable path.
            // Find EndCombatPhase to cleanly exit; return None if not available.
            self.action_set
                .actions
                .iter()
                .position(|a| matches!(a, LegalAction::EndCombatPhase))
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

    /// Get a single legal action as a JSON string by index.
    ///
    /// Args:
    ///     action_index: Index into the legal actions list (0-based).
    ///
    /// Returns a JSON string of the LegalAction at the given index.
    fn legal_action_json(&self, action_index: usize) -> PyResult<String> {
        let action = self.action_set.actions.get(action_index).ok_or_else(|| {
            PyValueError::new_err(format!(
                "Action index {} out of range (0..{})",
                action_index,
                self.action_set.actions.len()
            ))
        })?;
        serde_json::to_string(action)
            .map_err(|e| PyValueError::new_err(format!("Serialization error: {e}")))
    }

    /// Get the events from the last action as a JSON string.
    ///
    /// Returns a JSON array of GameEvent objects. After `new()`, returns
    /// the initial events (GameStarted, TurnStarted). After each
    /// `apply_action()`, returns events from that action.
    fn events_json(&self) -> PyResult<String> {
        serde_json::to_string(&self.last_events)
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

    /// Encode the current state + legal actions into RL features.
    ///
    /// Returns a PyEncodedStep containing:
    /// - State features (85 scalars, mode, entity pools with unit scalars)
    /// - Per-action features (6 vocab IDs + 34 scalars each)
    ///
    /// This replaces the Python-side feature extraction pipeline,
    /// eliminating JSON serialization and dict-crawling overhead.
    fn encode_step(&self) -> PyEncodedStep {
        let encoded = mk_features::encode_step(
            &self.state,
            self.player_idx,
            &self.action_set,
        );
        PyEncodedStep { inner: encoded }
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

    /// Dump internal state for debugging zero-action situations.
    fn debug_state(&self) -> String {
        let s = &self.state;
        let p = &s.players[self.player_idx];
        format!(
            "round={} phase={:?} round_phase={:?} game_ended={}\n\
             current_player_index={} turn_order={:?}\n\
             tactics_selection_order={:?} current_tactic_selector={:?}\n\
             end_of_round_announced_by={:?} scenario_end_triggered={}\n\
             final_turns_remaining={:?} players_with_final_turn={:?}\n\
             player.id={} player.selected_tactic={:?}\n\
             player.flags={:?} player.pending.active={:?}\n\
             player.pending.deferred={}\n\
             combat={} dummy_player={:?}\n\
             available_tactics={:?}\n\
             player.hand={:?}\n\
             player.position={:?}\n\
             player.units={}\n\
             player.move_points={} player.influence_points={}",
            s.round, s.phase, s.round_phase, s.game_ended,
            s.current_player_index, s.turn_order,
            s.tactics_selection_order, s.current_tactic_selector,
            s.end_of_round_announced_by, s.scenario_end_triggered,
            s.final_turns_remaining, s.players_with_final_turn,
            p.id, p.selected_tactic,
            p.flags, p.pending.active,
            p.pending.deferred.len(),
            s.combat.is_some(), s.dummy_player.is_some(),
            s.available_tactics,
            p.hand, p.position,
            p.units.len(),
            p.move_points, p.influence_points,
        )
    }
}

impl GameEngine {
    /// Diagnostic string for empty-action-set errors.
    fn debug_empty_actions(&self) -> String {
        let s = &self.state;
        let p = &s.players[self.player_idx];
        let combat_info = match s.combat.as_ref() {
            Some(c) => format!(
                "combat(phase={:?} enemies={} declared_targets={:?} declared_type={:?})",
                c.phase,
                c.enemies.iter().filter(|e| !e.is_defeated).count(),
                c.declared_attack_targets.as_ref().map(|t| t.len()),
                c.declared_attack_type,
            ),
            None => "no_combat".to_string(),
        };
        format!(
            "phase={:?} round_phase={:?} ended={} pending={:?} deferred={} flags={:?} hand={} {} undo={}",
            s.phase, s.round_phase, s.game_ended,
            p.pending.active, p.pending.deferred.len(),
            p.flags, p.hand.len(),
            combat_info,
            self.undo_stack.can_undo(),
        )
    }
}

// =============================================================================
// PyVecEnv — vectorized environment for batched RL training
// =============================================================================

/// Vectorized environment running N parallel Mage Knight games.
///
/// Uses Rayon for parallel stepping and encoding. Returns numpy arrays
/// via Python dicts for efficient batched neural network forward passes.
///
///     from mk_python import PyVecEnv
///     env = PyVecEnv(num_envs=16, base_seed=42)
///     batch = env.encode_batch()        # dict of numpy arrays
///     result = env.step_batch(actions)   # dict of numpy arrays
#[pyclass]
struct PyVecEnv {
    inner: VecEnv,
}

/// Helper: convert a flat Vec<f32> to a numpy array with the given shape.
fn vec_f32_to_numpy<'py>(
    py: Python<'py>,
    np: &Bound<'py, PyAny>,
    data: &[f32],
    shape: &[usize],
) -> PyResult<PyObject> {
    let list = pyo3::types::PyList::new_bound(py, data);
    let arr = np.call_method1("array", (list,))?;
    let arr = arr.call_method1("astype", ("float32",))?;
    let shape_tuple = pyo3::types::PyTuple::new_bound(py, shape);
    Ok(arr.call_method1("reshape", (shape_tuple,))?.to_object(py))
}

/// Helper: convert a flat Vec<i32> to a numpy array with the given shape.
fn vec_i32_to_numpy<'py>(
    py: Python<'py>,
    np: &Bound<'py, PyAny>,
    data: &[i32],
    shape: &[usize],
) -> PyResult<PyObject> {
    let list = pyo3::types::PyList::new_bound(py, data);
    let arr = np.call_method1("array", (list,))?;
    let arr = arr.call_method1("astype", ("int32",))?;
    let shape_tuple = pyo3::types::PyTuple::new_bound(py, shape);
    Ok(arr.call_method1("reshape", (shape_tuple,))?.to_object(py))
}

/// Helper: convert a Vec<bool> to a numpy bool array.
fn vec_bool_to_numpy<'py>(
    py: Python<'py>,
    np: &Bound<'py, PyAny>,
    data: &[bool],
) -> PyResult<PyObject> {
    let list = pyo3::types::PyList::new_bound(py, data);
    let arr = np.call_method1("array", (list,))?;
    let arr = arr.call_method1("astype", ("bool",))?;
    Ok(arr.to_object(py))
}

#[pymethods]
impl PyVecEnv {
    /// Create a vectorized environment.
    ///
    /// Args:
    ///     num_envs: Number of parallel environments.
    ///     base_seed: Starting seed (incremented per env).
    ///     hero: Hero name.
    ///     max_steps: Max steps per episode before truncation.
    ///     scenario: Optional JSON string for TrainingScenario.
    ///         None or "full_game" → FullGame (default).
    ///         Otherwise parsed as JSON, e.g. '{"type":"CombatDrill","enemy_tokens":["diggers_1"],"is_fortified":false}'.
    #[new]
    #[pyo3(signature = (num_envs=16, base_seed=42, hero="arythea", max_steps=2000, scenario=None, combat_oracle=false, early_term_fame_step=0))]
    fn new(
        num_envs: usize,
        base_seed: u32,
        hero: &str,
        max_steps: u64,
        scenario: Option<&str>,
        combat_oracle: bool,
        early_term_fame_step: u64,
    ) -> PyResult<Self> {
        let hero_enum = parse_hero(hero)?;
        let training_scenario = parse_scenario(scenario)?;
        let inner = VecEnv::new(
            num_envs,
            base_seed,
            hero_enum,
            max_steps,
            training_scenario,
            combat_oracle,
            early_term_fame_step,
        );
        Ok(Self { inner })
    }

    fn num_envs(&self) -> usize {
        self.inner.num_envs()
    }

    fn seeds(&self) -> Vec<u32> {
        self.inner.seeds()
    }

    /// Encode all envs into a dict of numpy arrays.
    fn encode_batch(&self, py: Python<'_>) -> PyResult<PyObject> {
        let batch = self.inner.encode_batch();
        let np = py.import_bound("numpy")?;
        let dict = pyo3::types::PyDict::new_bound(py);
        let n = batch.num_envs;

        dict.set_item("state_scalars", vec_f32_to_numpy(py, &np, &batch.state_scalars, &[n, batch.state_scalars.len() / n])?)?;
        dict.set_item("state_ids", vec_i32_to_numpy(py, &np, &batch.state_ids, &[n, 3])?)?;

        dict.set_item("hand_card_ids", vec_i32_to_numpy(py, &np, &batch.hand_card_ids, &[n, batch.max_hand])?)?;
        dict.set_item("hand_counts", vec_i32_to_numpy(py, &np, &batch.hand_counts, &[n])?)?;

        dict.set_item("deck_card_ids", vec_i32_to_numpy(py, &np, &batch.deck_card_ids, &[n, batch.max_deck])?)?;
        dict.set_item("deck_counts", vec_i32_to_numpy(py, &np, &batch.deck_counts, &[n])?)?;

        dict.set_item("discard_card_ids", vec_i32_to_numpy(py, &np, &batch.discard_card_ids, &[n, batch.max_discard])?)?;
        dict.set_item("discard_counts", vec_i32_to_numpy(py, &np, &batch.discard_counts, &[n])?)?;

        dict.set_item("unit_ids", vec_i32_to_numpy(py, &np, &batch.unit_ids, &[n, batch.max_units])?)?;
        dict.set_item("unit_counts", vec_i32_to_numpy(py, &np, &batch.unit_counts, &[n])?)?;
        dict.set_item("unit_scalars", vec_f32_to_numpy(py, &np, &batch.unit_scalars, &[n * batch.max_units, mk_features::UNIT_SCALAR_DIM])?)?;

        dict.set_item("combat_enemy_ids", vec_i32_to_numpy(py, &np, &batch.combat_enemy_ids, &[n, batch.max_combat_enemies])?)?;
        dict.set_item("combat_enemy_counts", vec_i32_to_numpy(py, &np, &batch.combat_enemy_counts, &[n])?)?;
        dict.set_item("combat_enemy_scalars", vec_f32_to_numpy(py, &np, &batch.combat_enemy_scalars, &[n * batch.max_combat_enemies, mk_features::COMBAT_ENEMY_SCALAR_DIM])?)?;

        dict.set_item("skill_ids", vec_i32_to_numpy(py, &np, &batch.skill_ids, &[n, batch.max_skills])?)?;
        dict.set_item("skill_counts", vec_i32_to_numpy(py, &np, &batch.skill_counts, &[n])?)?;

        dict.set_item("visible_site_ids", vec_i32_to_numpy(py, &np, &batch.visible_site_ids, &[n, batch.max_visible_sites])?)?;
        dict.set_item("visible_site_counts", vec_i32_to_numpy(py, &np, &batch.visible_site_counts, &[n])?)?;
        dict.set_item("visible_site_scalars", vec_f32_to_numpy(py, &np, &batch.visible_site_scalars, &[n * batch.max_visible_sites, mk_features::SITE_SCALAR_DIM])?)?;

        dict.set_item("map_enemy_ids", vec_i32_to_numpy(py, &np, &batch.map_enemy_ids, &[n, batch.max_map_enemies])?)?;
        dict.set_item("map_enemy_counts", vec_i32_to_numpy(py, &np, &batch.map_enemy_counts, &[n])?)?;
        dict.set_item("map_enemy_scalars", vec_f32_to_numpy(py, &np, &batch.map_enemy_scalars, &[n * batch.max_map_enemies, mk_features::MAP_ENEMY_SCALAR_DIM])?)?;

        dict.set_item("action_ids", vec_i32_to_numpy(py, &np, &batch.action_ids, &[n * batch.max_actions, 6])?)?;
        dict.set_item("action_scalars", vec_f32_to_numpy(py, &np, &batch.action_scalars, &[n * batch.max_actions, mk_features::ACTION_SCALAR_DIM])?)?;
        dict.set_item("action_counts", vec_i32_to_numpy(py, &np, &batch.action_counts, &[n])?)?;

        dict.set_item("action_target_offsets", vec_i32_to_numpy(py, &np, &batch.action_target_offsets, &[n * (batch.max_actions + 1)])?)?;
        dict.set_item("action_target_ids", vec_i32_to_numpy(py, &np, &batch.action_target_ids, &[batch.action_target_ids.len()])?)?;

        dict.set_item("fames", vec_i32_to_numpy(py, &np, &batch.fames, &[n])?)?;
        dict.set_item("max_actions", batch.max_actions)?;

        Ok(dict.to_object(py))
    }

    /// Step all envs with the given action indices.
    ///
    /// Args:
    ///     actions: numpy array or list of i32 action indices, one per env.
    ///
    /// Returns a dict with fame_deltas, dones, fames, panicked, truncated, scenario_end_triggered.
    fn step_batch(&mut self, py: Python<'_>, actions: Vec<i32>) -> PyResult<PyObject> {
        let result = self.inner.step_batch(&actions);
        let np = py.import_bound("numpy")?;
        let dict = pyo3::types::PyDict::new_bound(py);
        let n = result.fame_deltas.len();

        dict.set_item("fame_deltas", vec_i32_to_numpy(py, &np, &result.fame_deltas, &[n])?)?;
        dict.set_item("dones", vec_bool_to_numpy(py, &np, &result.dones)?)?;
        dict.set_item("fames", vec_i32_to_numpy(py, &np, &result.fames, &[n])?)?;
        dict.set_item("panicked", vec_bool_to_numpy(py, &np, &result.panicked)?)?;
        dict.set_item("truncated", vec_bool_to_numpy(py, &np, &result.truncated)?)?;
        dict.set_item("scenario_end_triggered", vec_bool_to_numpy(py, &np, &result.scenario_end_triggered)?)?;
        dict.set_item("new_hexes", vec_i32_to_numpy(py, &np, &result.new_hexes, &[n])?)?;
        dict.set_item("wound_deltas", vec_i32_to_numpy(py, &np, &result.wound_deltas, &[n])?)?;
        dict.set_item("non_wound_hand_sizes", vec_i32_to_numpy(py, &np, &result.non_wound_hand_sizes, &[n])?)?;
        dict.set_item("new_tiles", vec_i32_to_numpy(py, &np, &result.new_tiles, &[n])?)?;
        dict.set_item("wasted_move_points", vec_i32_to_numpy(py, &np, &result.wasted_move_points, &[n])?)?;
        dict.set_item("backtrack_moves", vec_i32_to_numpy(py, &np, &result.backtrack_moves, &[n])?)?;
        dict.set_item("wound_counts", vec_i32_to_numpy(py, &np, &result.wound_counts, &[n])?)?;
        dict.set_item("total_card_counts", vec_i32_to_numpy(py, &np, &result.total_card_counts, &[n])?)?;
        dict.set_item("in_combat", vec_bool_to_numpy(py, &np, &result.in_combat)?)?;
        dict.set_item("rested_turns", vec_i32_to_numpy(py, &np, &result.rested_turns, &[n])?)?;

        Ok(dict.to_object(py))
    }

    fn __repr__(&self) -> String {
        format!("PyVecEnv(num_envs={})", self.inner.num_envs())
    }
}

// =============================================================================
// Module registration
// =============================================================================

#[pymodule]
fn mk_python(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add("__version__", "0.1.0")?;
    m.add_class::<GameEngine>()?;
    m.add_class::<PyEncodedStep>()?;
    m.add_class::<PyVecEnv>()?;
    Ok(())
}
