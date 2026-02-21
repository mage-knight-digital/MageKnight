use mk_types::legal_action::LegalAction;
use mk_types::state::{GameState, PlayerFlags};

use super::utils::WOUND_CARD_ID;
use crate::undo::UndoStack;

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

    // RerollSourceDice (Mana Search) — subset enumeration over rerollable dice.
    enumerate_mana_search(state, player_idx, actions);

    // Category 9: EndTurn — only if played a card or rested.
    if !is_resting
        && !player.pending.has_active()
        && (player
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN)
            || player.flags.contains(PlayerFlags::HAS_RESTED_THIS_TURN))
    {
        actions.push(LegalAction::EndTurn);
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

fn enumerate_mana_search(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];

    // Must have "mana_search" selected and not used this turn
    if player.selected_tactic.as_ref().map(|t| t.as_str()) != Some("mana_search") {
        return;
    }
    if player.tactic_state.mana_search_used_this_turn {
        return;
    }
    if player.flags.contains(PlayerFlags::TACTIC_FLIPPED) {
        return;
    }

    // Find rerollable dice indices (not taken, available in source)
    let rerollable: Vec<usize> = state
        .source
        .dice
        .iter()
        .enumerate()
        .filter(|(_, d)| d.taken_by_player_id.is_none())
        .map(|(i, _)| i)
        .collect();

    if rerollable.is_empty() {
        return;
    }

    // Subset enumeration: size 1 or 2
    // Size 1
    for &idx in &rerollable {
        actions.push(LegalAction::RerollSourceDice {
            die_indices: vec![idx],
        });
    }
    // Size 2
    for i in 0..rerollable.len() {
        for j in (i + 1)..rerollable.len() {
            actions.push(LegalAction::RerollSourceDice {
                die_indices: vec![rerollable[i], rerollable[j]],
            });
        }
    }
}
