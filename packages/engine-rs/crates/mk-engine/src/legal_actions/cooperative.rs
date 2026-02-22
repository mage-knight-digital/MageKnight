//! Legal action enumeration for cooperative assaults.
//!
//! Two entry points:
//! - `enumerate_cooperative_response()` — called before the active-player guard
//!   to allow invited (non-active) players to respond to proposals
//! - `enumerate_cooperative_actions()` — called during normal turn enumeration
//!   to allow the initiator to propose or cancel

use mk_types::enums::*;
use mk_types::legal_action::LegalAction;
use mk_types::state::*;

use crate::cooperative_assault;

/// Check if a non-active player should receive cooperative assault response actions.
///
/// Returns `Some(actions)` if the player is an invited non-respondent,
/// `None` if normal enumeration should continue.
pub(super) fn enumerate_cooperative_response(
    state: &GameState,
    player_idx: usize,
) -> Option<Vec<LegalAction>> {
    let proposal = state.pending_cooperative_assault.as_ref()?;

    // Only invited players who haven't responded yet
    if !proposal.invited_player_idxs.contains(&player_idx) {
        return None;
    }
    if proposal.accepted_player_idxs.contains(&player_idx) {
        return None;
    }

    Some(vec![
        LegalAction::RespondToCooperativeProposal { accept: true },
        LegalAction::RespondToCooperativeProposal { accept: false },
    ])
}

/// Enumerate cooperative assault actions during a normal turn.
///
/// - If a proposal is pending and the player is the initiator: emit Cancel
/// - If no proposal is pending: check for proposable cities and emit Propose variants
pub(super) fn enumerate_cooperative_actions(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    // If a proposal is pending
    if let Some(ref proposal) = state.pending_cooperative_assault {
        if proposal.proposer_idx == player_idx {
            actions.push(LegalAction::CancelCooperativeProposal);
        }
        return;
    }

    // Guards for proposing
    let player = &state.players[player_idx];

    // Can't propose if end of round announced
    if state.end_of_round_announced_by.is_some() {
        return;
    }

    // Can't propose if already taken action this turn
    if player
        .flags
        .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
    {
        return;
    }

    // Can't propose if token is flipped
    if player
        .flags
        .contains(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED)
    {
        return;
    }

    // Find adjacent unconquered cities with garrison
    let player_pos = match player.position {
        Some(p) => p,
        None => return,
    };

    for neighbor in player_pos.neighbors() {
        let hex_key = neighbor.key();
        let hex_state = match state.map.hexes.get(&hex_key) {
            Some(h) => h,
            None => continue,
        };

        let site = match hex_state.site.as_ref() {
            Some(s) => s,
            None => continue,
        };

        if site.site_type != SiteType::City || site.is_conquered {
            continue;
        }

        let garrison_size = hex_state.enemies.len() as u32;
        if garrison_size == 0 {
            continue;
        }

        // Find eligible invitees for this city
        let invitees = cooperative_assault::find_eligible_invitees(state, player_idx, neighbor);
        if invitees.is_empty() {
            continue;
        }

        // Generate all valid distributions and emit a Propose action for each
        let distributions =
            cooperative_assault::generate_distributions(player_idx, &invitees, garrison_size);
        for dist in distributions {
            actions.push(LegalAction::ProposeCooperativeAssault {
                hex_coord: neighbor,
                invited_player_idxs: invitees.clone(),
                distribution: dist,
            });
        }
    }
}
