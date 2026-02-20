//! Valid actions — UI-oriented projection from `LegalActionSet`.
//!
//! `get_valid_actions()` calls `enumerate_legal_actions()` then groups the
//! `LegalAction` variants into the existing UI types (`ValidActions`,
//! `NormalTurnActions`, `PlayableCard`, etc.).
//!
//! This module no longer contains any independent enumeration logic — it is
//! purely a projection layer.

mod projection;

#[cfg(test)]
mod tests;

use mk_types::enums::*;
use mk_types::hex::{HexCoord, HexDirection};
use mk_types::ids::{CardId, TacticId};
use mk_types::state::*;

use crate::legal_actions::enumerate_legal_actions_with_undo;
use crate::undo::UndoStack;

use self::projection::{project_explore_directions, project_move_targets, project_playable_cards};

/// Top-level valid actions — discriminated union matching TS `ValidActions`.
#[derive(Debug)]
pub enum ValidActions {
    /// Player cannot act (wrong phase, not their turn, game ended).
    CannotAct,
    /// Tactics selection phase.
    TacticsSelection { available_tactics: Vec<TacticId> },
    /// Player has a pending choice to resolve.
    PendingChoice { can_undo: bool },
    /// Normal turn — full set of available actions.
    NormalTurn(NormalTurnActions),
    /// Combat turn — player is in combat.
    CombatTurn(CombatTurnActions),
    // TODO: PendingDiscard, PendingLevelUpReward, etc.
}

/// Actions available during a combat turn (Phase 2 stub).
///
/// Full combat has 4 phases (ranged/siege, block, assign damage, attack)
/// each with different available actions. This stub provides the basics:
/// playable cards, sideways options, and the ability to end the current phase.
#[derive(Debug)]
pub struct CombatTurnActions {
    pub combat_phase: CombatPhase,
    pub playable_cards: Vec<PlayableCard>,
    pub can_end_phase: bool,
}

/// All actions available during a normal (non-combat) turn.
#[derive(Debug)]
pub struct NormalTurnActions {
    pub turn: TurnOptions,
    pub playable_cards: Vec<PlayableCard>,
    pub move_targets: Vec<MoveTarget>,
    pub explore_directions: Vec<ExploreDirection>,
}

/// Turn-level options (end turn, rest, undo).
#[derive(Debug, Clone)]
pub struct TurnOptions {
    pub can_end_turn: bool,
    pub can_declare_rest: bool,
    pub can_complete_rest: bool,
    pub is_resting: bool,
    pub can_undo: bool,
}

/// A card that can be played in at least one mode.
#[derive(Debug, Clone)]
pub struct PlayableCard {
    pub card_id: CardId,
    pub hand_index: usize,
    pub can_play_basic: bool,
    pub can_play_powered: bool,
    pub can_play_sideways: bool,
    pub sideways_options: Vec<SidewaysAs>,
}

/// A hex the player can move to.
#[derive(Debug, Clone)]
pub struct MoveTarget {
    pub coord: HexCoord,
    pub cost: u32,
}

/// A direction the player can explore.
#[derive(Debug, Clone)]
pub struct ExploreDirection {
    pub direction: HexDirection,
    pub target_center: HexCoord,
}

/// Compute all valid actions for the given player.
///
/// This is a projection from `enumerate_legal_actions()` — no independent
/// enumeration logic lives here.
pub fn get_valid_actions(state: &GameState, player_idx: usize) -> ValidActions {
    get_valid_actions_with_undo(state, player_idx, &UndoStack::new())
}

/// Compute valid actions, taking undo availability into account.
pub fn get_valid_actions_with_undo(
    state: &GameState,
    player_idx: usize,
    undo: &UndoStack,
) -> ValidActions {
    let legal = enumerate_legal_actions_with_undo(state, player_idx, undo);

    // Empty action set → CannotAct.
    if legal.actions.is_empty() {
        return ValidActions::CannotAct;
    }

    // Detect phase from the action types present.
    // Tactics: all SelectTactic.
    if legal
        .actions
        .iter()
        .all(|a| matches!(a, mk_types::legal_action::LegalAction::SelectTactic { .. }))
    {
        let available_tactics = legal
            .actions
            .iter()
            .filter_map(|a| match a {
                mk_types::legal_action::LegalAction::SelectTactic { tactic_id } => {
                    Some(tactic_id.clone())
                }
                _ => None,
            })
            .collect();
        return ValidActions::TacticsSelection { available_tactics };
    }

    // Pending choice: has ResolveChoice actions.
    if legal
        .actions
        .iter()
        .any(|a| matches!(a, mk_types::legal_action::LegalAction::ResolveChoice { .. }))
    {
        let can_undo = legal
            .actions
            .iter()
            .any(|a| matches!(a, mk_types::legal_action::LegalAction::Undo));
        return ValidActions::PendingChoice { can_undo };
    }

    // Combat: has EndCombatPhase.
    if legal
        .actions
        .iter()
        .any(|a| matches!(a, mk_types::legal_action::LegalAction::EndCombatPhase))
    {
        let combat_phase = state
            .combat
            .as_ref()
            .map(|c| c.phase)
            .unwrap_or(CombatPhase::RangedSiege);
        let playable_cards = project_playable_cards(&legal.actions, true);
        let can_end_phase = true; // EndCombatPhase is present.
        return ValidActions::CombatTurn(CombatTurnActions {
            combat_phase,
            playable_cards,
            can_end_phase,
        });
    }

    // Normal turn.
    let player = &state.players[player_idx];
    let is_resting = player.flags.contains(PlayerFlags::IS_RESTING);

    let playable_cards = project_playable_cards(&legal.actions, false);
    let move_targets = project_move_targets(&legal.actions);
    let explore_directions = project_explore_directions(&legal.actions, state, player_idx);

    let can_end_turn = legal
        .actions
        .iter()
        .any(|a| matches!(a, mk_types::legal_action::LegalAction::EndTurn));
    let can_declare_rest = legal
        .actions
        .iter()
        .any(|a| matches!(a, mk_types::legal_action::LegalAction::DeclareRest));
    let can_complete_rest = legal
        .actions
        .iter()
        .any(|a| matches!(a, mk_types::legal_action::LegalAction::CompleteRest));
    let can_undo = legal
        .actions
        .iter()
        .any(|a| matches!(a, mk_types::legal_action::LegalAction::Undo));

    let turn = TurnOptions {
        can_end_turn,
        can_declare_rest,
        can_complete_rest,
        is_resting,
        can_undo,
    };

    ValidActions::NormalTurn(NormalTurnActions {
        turn,
        playable_cards,
        move_targets,
        explore_directions,
    })
}
