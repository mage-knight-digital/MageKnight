use mk_types::legal_action::LegalAction;
use mk_types::enums::UnitState;
use mk_types::state::{GameState, PlayerFlags};

use super::utils::WOUND_CARD_ID;
use crate::undo::UndoStack;

/// Banner card IDs that can be assigned to units.
const BANNER_CARD_IDS: &[&str] = &[
    "banner_of_courage",
    "banner_of_fortitude",
    "banner_of_fear",
    "banner_of_command",
    "banner_of_protection",
    "banner_of_glory",
];

pub(super) fn enumerate_turn_options(
    state: &GameState,
    player_idx: usize,
    undo: &UndoStack,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];
    let is_resting = player.flags.contains(PlayerFlags::IS_RESTING);

    // ActivateTactic — before other options.
    if can_activate_tactic(state, player_idx) {
        actions.push(LegalAction::ActivateTactic);
    }

    // InitiateManaSearch — available if mana_search tactic selected + not used + rerollable dice exist.
    if can_initiate_mana_search(state, player_idx) {
        actions.push(LegalAction::InitiateManaSearch);
    }

    // Banner assignment (free action, not gated on HAS_TAKEN_ACTION).
    if !is_resting && state.combat.is_none() && !player.pending.has_active() {
        enumerate_banner_assignments(state, player_idx, actions);
    }

    // UseBannerCourage (free action: ready a spent unit with courage banner attached).
    if !is_resting && state.combat.is_none() && !player.pending.has_active() {
        enumerate_banner_courage(state, player_idx, actions);
    }

    // Category 9: EndTurn — available after playing a card, resting, or completing combat.
    if !is_resting
        && !player.pending.has_active()
        && (player
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN)
            || player.flags.contains(PlayerFlags::HAS_RESTED_THIS_TURN)
            || player.flags.contains(PlayerFlags::HAS_COMBATTED_THIS_TURN)
            || player
                .flags
                .contains(PlayerFlags::DISCARDED_CARD_THIS_TURN))
    {
        actions.push(LegalAction::EndTurn);
    }

    // AnnounceEndOfRound — multiplayer only, once per round, during normal turn, deck must be empty.
    if !is_resting
        && !player.pending.has_active()
        && state.players.len() > 1
        && state.end_of_round_announced_by.is_none()
        && state.combat.is_none()
        && player.deck.is_empty()
    {
        actions.push(LegalAction::AnnounceEndOfRound);
    }

    // Category 10: DeclareRest.
    if !is_resting
        && state.combat.is_none()
        && !player.hand.is_empty()
        && !player
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
        && !player.flags.contains(PlayerFlags::HAS_MOVED_THIS_TURN)
    {
        actions.push(LegalAction::DeclareRest);
    }

    // Category 11: CompleteRest — one per discardable card.
    if is_resting {
        let has_non_wound = player
            .hand
            .iter()
            .any(|c| c.as_str() != WOUND_CARD_ID);

        if player.hand.is_empty() {
            // Empty hand edge case.
            actions.push(LegalAction::CompleteRest {
                discard_hand_index: None,
            });
        } else if has_non_wound {
            // Standard rest: one CompleteRest per non-wound card.
            for (i, card_id) in player.hand.iter().enumerate() {
                if card_id.as_str() != WOUND_CARD_ID {
                    actions.push(LegalAction::CompleteRest {
                        discard_hand_index: Some(i),
                    });
                }
            }
        } else {
            // Slow recovery: hand is all wounds — one per wound.
            for i in 0..player.hand.len() {
                actions.push(LegalAction::CompleteRest {
                    discard_hand_index: Some(i),
                });
            }
        }
    }

    // Category 12: Undo.
    if undo.can_undo() {
        actions.push(LegalAction::Undo);
    }
}

fn can_activate_tactic(state: &GameState, player_idx: usize) -> bool {
    let player = &state.players[player_idx];
    if player.flags.contains(PlayerFlags::TACTIC_FLIPPED) {
        return false;
    }
    match player.selected_tactic.as_ref().map(|t| t.as_str()) {
        Some("the_right_moment") => state.end_of_round_announced_by.is_none(),
        Some("long_night") => player.deck.is_empty() && !player.discard.is_empty(),
        Some("midnight_meditation") => {
            !player
                .flags
                .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
                && !player.flags.contains(PlayerFlags::HAS_MOVED_THIS_TURN)
                && !player.hand.is_empty()
        }
        _ => false,
    }
}

fn can_initiate_mana_search(state: &GameState, player_idx: usize) -> bool {
    let player = &state.players[player_idx];

    // Must have "mana_search" selected and not used this turn
    if player.selected_tactic.as_ref().map(|t| t.as_str()) != Some("mana_search") {
        return false;
    }
    if player.tactic_state.mana_search_used_this_turn {
        return false;
    }
    if player.flags.contains(PlayerFlags::TACTIC_FLIPPED) {
        return false;
    }

    // At least one rerollable die must exist
    state
        .source
        .dice
        .iter()
        .any(|d| d.taken_by_player_id.is_none())
}

/// Enumerate AssignBanner actions for banner cards in hand × eligible units.
fn enumerate_banner_assignments(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];
    if player.units.is_empty() {
        return;
    }

    for (hand_index, card_id) in player.hand.iter().enumerate() {
        if !BANNER_CARD_IDS.contains(&card_id.as_str()) {
            continue;
        }
        // For each unit that doesn't already have this banner attached
        for unit in &player.units {
            let already_attached = player
                .attached_banners
                .iter()
                .any(|b| b.banner_id.as_str() == card_id.as_str() && b.unit_instance_id == unit.instance_id);
            if !already_attached {
                actions.push(LegalAction::AssignBanner {
                    hand_index,
                    card_id: card_id.clone(),
                    unit_instance_id: unit.instance_id.clone(),
                });
            }
        }
    }
}

/// Enumerate UseBannerCourage for spent units with unused courage banner.
fn enumerate_banner_courage(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];
    for banner in &player.attached_banners {
        if banner.banner_id.as_str() != "banner_of_courage" || banner.is_used_this_round {
            continue;
        }
        // Find the attached unit — must be Spent
        if let Some(unit) = player.units.iter().find(|u| u.instance_id == banner.unit_instance_id) {
            if unit.state == UnitState::Spent {
                actions.push(LegalAction::UseBannerCourage {
                    unit_instance_id: banner.unit_instance_id.clone(),
                });
            }
        }
    }
}
