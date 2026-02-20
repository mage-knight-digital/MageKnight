//! Execution pipeline — `apply_legal_action()` dispatch.
//!
//! Takes a `LegalAction` and applies it to the game state, returning an
//! `ApplyResult` on success or `ApplyError` on failure. Every action from
//! `enumerate_legal_actions()` MUST succeed — the contract is CI-gated.

use mk_types::enums::*;
use mk_types::legal_action::LegalAction;
use mk_types::state::*;

use crate::card_play;
use crate::effect_queue;
use crate::end_turn;
use crate::movement;
use crate::undo::UndoStack;

// =============================================================================
// Error & result types
// =============================================================================

/// Error from applying a legal action.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ApplyError {
    /// The action set was computed at a different epoch than the current state.
    StaleActionSet { expected: u64, got: u64 },
    /// Internal error — should never happen for properly enumerated actions.
    InternalError(String),
}

/// Result of applying a legal action.
#[derive(Debug, Clone)]
pub struct ApplyResult {
    /// Whether the caller should re-enumerate legal actions.
    pub needs_reenumeration: bool,
    /// Whether the game has ended.
    pub game_ended: bool,
}

// =============================================================================
// Public API
// =============================================================================

/// Apply a legal action to the game state.
///
/// # Epoch check
/// The `expected_epoch` must match `state.action_epoch`. If they differ,
/// the action set is stale and the caller must re-enumerate.
///
/// # Contract
/// For every action produced by `enumerate_legal_actions()`, this function
/// MUST return `Ok(...)`. A failure is a contract violation (CI-gated test).
pub fn apply_legal_action(
    state: &mut GameState,
    undo_stack: &mut UndoStack,
    player_idx: usize,
    action: &LegalAction,
    expected_epoch: u64,
) -> Result<ApplyResult, ApplyError> {
    // Epoch check
    if state.action_epoch != expected_epoch {
        return Err(ApplyError::StaleActionSet {
            expected: state.action_epoch,
            got: expected_epoch,
        });
    }

    let result = match action {
        LegalAction::SelectTactic { tactic_id } => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            apply_select_tactic(state, player_idx, tactic_id)?
        }

        LegalAction::PlayCardBasic { hand_index, .. } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_play_card(state, player_idx, *hand_index, false)?
        }

        LegalAction::PlayCardPowered { hand_index, .. } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_play_card(state, player_idx, *hand_index, true)?
        }

        LegalAction::PlayCardSideways {
            hand_index,
            sideways_as,
            ..
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_play_card_sideways(state, player_idx, *hand_index, *sideways_as)?
        }

        LegalAction::Move { target, .. } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_move(state, player_idx, *target)?
        }

        LegalAction::Explore { direction } => {
            // Irreversible: set checkpoint (tile reveal + RNG)
            undo_stack.set_checkpoint();
            apply_explore(state, player_idx, *direction)?
        }

        LegalAction::ResolveChoice { choice_index } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_resolve_choice(state, player_idx, *choice_index)?
        }

        LegalAction::EndTurn => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            apply_end_turn(state, player_idx)?
        }

        LegalAction::DeclareRest => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_declare_rest(state, player_idx)
        }

        LegalAction::CompleteRest => {
            // Irreversible: set checkpoint (Phase 2 simplified)
            undo_stack.set_checkpoint();
            apply_complete_rest(state, player_idx)
        }

        LegalAction::EndCombatPhase => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            apply_end_combat_phase(state, player_idx)?
        }

        LegalAction::Undo => apply_undo(state, undo_stack)?,
    };

    // Increment epoch after every action
    state.action_epoch += 1;

    Ok(result)
}

// =============================================================================
// Action implementations
// =============================================================================

fn apply_select_tactic(
    state: &mut GameState,
    player_idx: usize,
    tactic_id: &mk_types::ids::TacticId,
) -> Result<ApplyResult, ApplyError> {
    // Set player's tactic
    state.players[player_idx].selected_tactic = Some(tactic_id.clone());

    // Remove tactic from available list
    state.available_tactics.retain(|t| t != tactic_id);

    // Advance to PlayerTurns phase (solo: single selector)
    state.round_phase = RoundPhase::PlayerTurns;
    state.current_tactic_selector = None;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_play_card(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
    powered: bool,
) -> Result<ApplyResult, ApplyError> {
    card_play::play_card(state, player_idx, hand_index, powered)
        .map(|_| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        })
        .map_err(|e| ApplyError::InternalError(format!("play_card failed: {:?}", e)))
}

fn apply_play_card_sideways(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
    sideways_as: SidewaysAs,
) -> Result<ApplyResult, ApplyError> {
    card_play::play_card_sideways(state, player_idx, hand_index, sideways_as)
        .map(|_| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        })
        .map_err(|e| ApplyError::InternalError(format!("play_card_sideways failed: {:?}", e)))
}

fn apply_move(
    state: &mut GameState,
    player_idx: usize,
    target: mk_types::hex::HexCoord,
) -> Result<ApplyResult, ApplyError> {
    movement::execute_move(state, player_idx, target)
        .map(|_| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        })
        .map_err(|e| ApplyError::InternalError(format!("execute_move failed: {:?}", e)))
}

fn apply_explore(
    state: &mut GameState,
    player_idx: usize,
    direction: mk_types::hex::HexDirection,
) -> Result<ApplyResult, ApplyError> {
    movement::execute_explore(state, player_idx, direction)
        .map(|_| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        })
        .map_err(|e| ApplyError::InternalError(format!("execute_explore failed: {:?}", e)))
}

fn apply_resolve_choice(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
) -> Result<ApplyResult, ApplyError> {
    effect_queue::resolve_pending_choice(state, player_idx, choice_index).map_err(|e| {
        ApplyError::InternalError(format!("resolve_pending_choice failed: {:?}", e))
    })?;
    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_end_turn(state: &mut GameState, player_idx: usize) -> Result<ApplyResult, ApplyError> {
    match end_turn::end_turn(state, player_idx) {
        Ok(end_turn::EndTurnResult::GameEnded) => Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: true,
        }),
        Ok(_) => Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        }),
        Err(e) => Err(ApplyError::InternalError(format!(
            "end_turn failed: {:?}",
            e
        ))),
    }
}

fn apply_declare_rest(state: &mut GameState, player_idx: usize) -> ApplyResult {
    state.players[player_idx]
        .flags
        .insert(PlayerFlags::IS_RESTING);
    ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    }
}

fn apply_complete_rest(state: &mut GameState, player_idx: usize) -> ApplyResult {
    // Phase 2 simplified: just set the HAS_RESTED flag and clear IS_RESTING.
    // Full game would involve discarding cards from hand first.
    let player = &mut state.players[player_idx];
    player.flags.remove(PlayerFlags::IS_RESTING);
    player.flags.insert(PlayerFlags::HAS_RESTED_THIS_TURN);
    ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    }
}

fn apply_end_combat_phase(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let combat = state
        .combat
        .as_mut()
        .ok_or_else(|| ApplyError::InternalError("EndCombatPhase with no combat".into()))?;

    match combat.phase {
        CombatPhase::RangedSiege => combat.phase = CombatPhase::Block,
        CombatPhase::Block => combat.phase = CombatPhase::AssignDamage,
        CombatPhase::AssignDamage => combat.phase = CombatPhase::Attack,
        CombatPhase::Attack => {
            // End combat
            state.combat = None;
            if let Some(player) = state.players.get_mut(player_idx) {
                player.combat_accumulator = Default::default();
                player.flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
            }
            return Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
            });
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_undo(
    state: &mut GameState,
    undo_stack: &mut UndoStack,
) -> Result<ApplyResult, ApplyError> {
    match undo_stack.undo() {
        Some(restored) => {
            *state = restored;
            // Note: epoch will be incremented by the caller after this returns,
            // which is correct — the restored state gets a new epoch.
            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
            })
        }
        None => Err(ApplyError::InternalError("Undo stack empty".to_string())),
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::legal_actions::enumerate_legal_actions_with_undo;
    use crate::setup::create_solo_game;
    use mk_types::ids::CardId;
    use mk_types::legal_action::LegalAction;

    fn setup_playing_game(hand: Vec<&str>) -> GameState {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.round_phase = RoundPhase::PlayerTurns;
        state.players[0].hand = hand.into_iter().map(CardId::from).collect();
        state
    }

    #[test]
    fn stale_epoch_rejected() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let result = apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndTurn, 999);
        assert!(matches!(result, Err(ApplyError::StaleActionSet { .. })));
    }

    #[test]
    fn epoch_increments_after_action() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardBasic {
                hand_index: 0,
                card_id: CardId::from("march"),
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.action_epoch, epoch + 1);
    }

    #[test]
    fn select_tactic_transitions_to_player_turns() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        let tactic = state.available_tactics[0].clone();

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: tactic.clone(),
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.round_phase, RoundPhase::PlayerTurns);
        assert!(state.players[0].selected_tactic.is_some());
        assert!(!state.available_tactics.contains(&tactic));
    }

    #[test]
    fn play_card_basic_works() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        let result = apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardBasic {
                hand_index: 0,
                card_id: CardId::from("march"),
            },
            epoch,
        )
        .unwrap();

        assert!(result.needs_reenumeration);
        assert!(!result.game_ended);
        assert_eq!(state.players[0].move_points, 2);
        assert!(undo.can_undo());
    }

    #[test]
    fn play_card_powered_works() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Green,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        let result = apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardPowered {
                hand_index: 0,
                card_id: CardId::from("march"),
                mana_color: BasicManaColor::Green,
            },
            epoch,
        )
        .unwrap();

        assert!(result.needs_reenumeration);
        assert_eq!(state.players[0].move_points, 4);
        assert!(state.players[0].pure_mana.is_empty());
    }

    #[test]
    fn play_card_sideways_works() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardSideways {
                hand_index: 0,
                card_id: CardId::from("march"),
                sideways_as: SidewaysAs::Move,
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.players[0].move_points, 1);
    }

    #[test]
    fn move_works() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].move_points = 5;
        let mut undo = UndoStack::new();

        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let move_action = legal
            .actions
            .iter()
            .find(|a| matches!(a, LegalAction::Move { .. }));
        if let Some(action) = move_action {
            let result = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch).unwrap();
            assert!(result.needs_reenumeration);
        }
    }

    #[test]
    fn declare_rest_sets_flag() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::DeclareRest, epoch).unwrap();

        assert!(state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert!(undo.can_undo());
    }

    #[test]
    fn complete_rest_sets_flag() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].flags.insert(PlayerFlags::IS_RESTING);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::CompleteRest, epoch).unwrap();

        assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::HAS_RESTED_THIS_TURN));
    }

    #[test]
    fn end_turn_after_card_play() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // Play a card first
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardBasic {
                hand_index: 0,
                card_id: CardId::from("march"),
            },
            epoch,
        )
        .unwrap();

        let epoch = state.action_epoch;
        let result =
            apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndTurn, epoch).unwrap();

        assert!(result.needs_reenumeration);
    }

    #[test]
    fn undo_restores_state() {
        let mut state = setup_playing_game(vec!["march", "rage"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        let original_hand_len = state.players[0].hand.len();

        // Play a card (saves snapshot)
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardBasic {
                hand_index: 0,
                card_id: CardId::from("march"),
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.players[0].hand.len(), original_hand_len - 1);

        // Undo
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::Undo, epoch).unwrap();

        assert_eq!(state.players[0].hand.len(), original_hand_len);
    }

    // =========================================================================
    // EndCombatPhase
    // =========================================================================

    #[test]
    fn end_combat_phase_advances_ranged_to_block() {
        let mut state = setup_playing_game(vec!["march"]);
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::RangedSiege,
            ..CombatState::default()
        }));
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();

        assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Block);
    }

    #[test]
    fn end_combat_phase_attack_ends_combat() {
        let mut state = setup_playing_game(vec!["march"]);
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::Attack,
            ..CombatState::default()
        }));
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();

        assert!(
            state.combat.is_none(),
            "combat should be removed after Attack phase"
        );
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
    }

    #[test]
    fn end_combat_phase_full_cycle() {
        let mut state = setup_playing_game(vec!["march"]);
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::RangedSiege,
            ..CombatState::default()
        }));
        let mut undo = UndoStack::new();

        // RangedSiege → Block
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();
        assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Block);

        // Block → AssignDamage
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();
        assert_eq!(
            state.combat.as_ref().unwrap().phase,
            CombatPhase::AssignDamage
        );

        // AssignDamage → Attack
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();
        assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Attack);

        // Attack → combat ends
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();
        assert!(state.combat.is_none());
    }

    #[test]
    fn explore_sets_checkpoint() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].move_points = 5;
        state.players[0].position = Some(mk_types::hex::HexCoord::new(1, 0));
        state.map.tile_deck.countryside = vec![TileId::Countryside1];
        let mut undo = UndoStack::new();
        undo.save(&state); // save something first

        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let explore_action = legal
            .actions
            .iter()
            .find(|a| matches!(a, LegalAction::Explore { .. }));
        if let Some(action) = explore_action {
            apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch).unwrap();
            // Explore is irreversible — checkpoint should have cleared undo stack
            assert!(!undo.can_undo());
        }
    }
}
