//! Unified legal action enumeration.
//!
//! `enumerate_legal_actions()` produces a deterministic `LegalActionSet` — every
//! action in the set is guaranteed executable by `apply_legal_action()`.
//!
//! The enumeration order is deterministic (stable across calls for identical state):
//! 1. SelectTactic (by tactic_id lexicographic)
//! 2. PlayCardBasic (by hand_index)
//! 3. PlayCardPowered (by hand_index)
//! 4. PlayCardSideways (by hand_index, then sideways_as discriminant)
//! 5. Move (by (target.q, target.r) lexicographic)
//! 6. Explore (by HexDirection discriminant — NE, E, SE, SW, W, NW)
//! 7. ResolveChoice (by choice_index)
//! 8. EndCombatPhase
//! 9. EndTurn
//! 10. DeclareRest
//! 11. CompleteRest
//! 12. Undo

mod cards;
mod combat;
mod explore;
mod movement;
mod pending;
mod sites;
mod tactics;
mod turn_options;
mod utils;

#[cfg(test)]
mod tests;

use mk_types::enums::*;
use mk_types::legal_action::{LegalAction, LegalActionSet};
use mk_types::state::*;

use crate::undo::UndoStack;

use self::cards::{enumerate_combat_cards, enumerate_normal_cards};
use self::combat::{
    enumerate_attack_declarations, enumerate_block_declarations, enumerate_cumbersome_actions,
};
use self::explore::enumerate_explores;
use self::movement::{enumerate_challenges, enumerate_moves};
use self::pending::enumerate_pending;
use self::sites::enumerate_site_actions;
use self::tactics::enumerate_tactics;
use self::turn_options::enumerate_turn_options;

/// Enumerate all legal actions for the given player.
///
/// Returns a `LegalActionSet` with deterministic ordering. Every action in the
/// set is guaranteed to succeed when passed to `apply_legal_action()`.
pub fn enumerate_legal_actions(state: &GameState, player_idx: usize) -> LegalActionSet {
    enumerate_legal_actions_with_undo(state, player_idx, &UndoStack::new())
}

/// Enumerate legal actions, taking undo availability into account.
pub fn enumerate_legal_actions_with_undo(
    state: &GameState,
    player_idx: usize,
    undo: &UndoStack,
) -> LegalActionSet {
    let epoch = state.action_epoch;
    let mut actions = Vec::new();

    // Guard: player exists.
    if player_idx >= state.players.len() {
        return LegalActionSet {
            epoch,
            player_idx,
            actions,
        };
    }

    // Guard: game phase.
    if state.phase != GamePhase::Round || state.game_ended {
        return LegalActionSet {
            epoch,
            player_idx,
            actions,
        };
    }

    // Guard: active player check.
    if !is_active_player(state, player_idx) {
        return LegalActionSet {
            epoch,
            player_idx,
            actions,
        };
    }

    // Tactics selection phase.
    if state.round_phase == RoundPhase::TacticsSelection {
        enumerate_tactics(state, &mut actions);
        return LegalActionSet {
            epoch,
            player_idx,
            actions,
        };
    }

    let player = &state.players[player_idx];

    // Pending choice blocks everything else.
    if let Some(ref active) = player.pending.active {
        enumerate_pending(active, state, player_idx, undo, &mut actions);
        return LegalActionSet {
            epoch,
            player_idx,
            actions,
        };
    }

    // Combat blocks normal turn.
    if state.combat.is_some() {
        enumerate_combat_cards(state, player_idx, &mut actions);
        // Block/Attack declarations (categories 5-6).
        enumerate_block_declarations(state, player_idx, &mut actions);
        enumerate_cumbersome_actions(state, player_idx, &mut actions);
        enumerate_attack_declarations(state, player_idx, &mut actions);
        // ActivateTactic (The Right Moment can be used during combat).
        if can_activate_tactic_in_combat(state, player_idx) {
            actions.push(LegalAction::ActivateTactic);
        }
        // EndCombatPhase (category 8).
        actions.push(LegalAction::EndCombatPhase);
        // Undo (category 12).
        if undo.can_undo() {
            actions.push(LegalAction::Undo);
        }
        return LegalActionSet {
            epoch,
            player_idx,
            actions,
        };
    }

    // Normal turn.
    enumerate_normal_cards(state, player_idx, &mut actions);
    enumerate_moves(state, player_idx, &mut actions);
    enumerate_explores(state, player_idx, &mut actions);
    enumerate_challenges(state, player_idx, &mut actions);
    enumerate_site_actions(state, player_idx, &mut actions);
    enumerate_turn_options(state, player_idx, undo, &mut actions);

    LegalActionSet {
        epoch,
        player_idx,
        actions,
    }
}

/// Check if ActivateTactic is available during combat (The Right Moment only).
fn can_activate_tactic_in_combat(state: &GameState, player_idx: usize) -> bool {
    let player = &state.players[player_idx];
    if player.flags.contains(PlayerFlags::TACTIC_FLIPPED) {
        return false;
    }
    // Only The Right Moment can be activated during combat
    player.selected_tactic.as_ref().map(|t| t.as_str()) == Some("the_right_moment")
        && state.end_of_round_announced_by.is_none()
}

fn is_active_player(state: &GameState, player_idx: usize) -> bool {
    match state.round_phase {
        RoundPhase::TacticsSelection => state
            .current_tactic_selector
            .as_ref()
            .is_some_and(|selector| *selector == state.players[player_idx].id),
        RoundPhase::PlayerTurns => {
            let current_idx = state.current_player_index as usize;
            current_idx < state.turn_order.len()
                && state.turn_order[current_idx] == state.players[player_idx].id
        }
    }
}
