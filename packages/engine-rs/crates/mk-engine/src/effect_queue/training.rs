//! Training's card-local effect, saved choice and legal-action workflow.
//! The legacy pending types, selection indices, and action boundaries remain unchanged.

use super::{eligible_action_hand_indices, ResolveResult};
use crate::action_pipeline::{ApplyError, ApplyResult};
use arrayvec::ArrayVec;
use mk_types::enums::DeedCardType;
use mk_types::ids::CardId;
use mk_types::legal_action::LegalAction;
use mk_types::pending::{ActivePending, BookOfWisdomPhase, EffectMode, PendingTraining};
use mk_types::state::GameState;

const TRAINING_CARD_ID: &str = "training";

/// Apply Training effect — select a non-wound action card to remove, then gain an AA
/// of matching color from the offer.
/// Basic: gained AA goes to discard. Powered: gained AA goes to hand.
pub(super) fn apply_training(
    state: &mut GameState,
    player_idx: usize,
    mode: EffectMode,
) -> ResolveResult {
    let player = &state.players[player_idx];

    // Check if there are any eligible hand cards (non-wound action cards)
    let has_eligible = !eligible_action_hand_indices(&player.hand).is_empty();

    if !has_eligible {
        return ResolveResult::Skipped;
    }

    let source_card_id = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from(TRAINING_CARD_ID));

    state.players[player_idx].pending.active = Some(ActivePending::Training(PendingTraining {
        source_card_id,
        mode,
        phase: BookOfWisdomPhase::SelectCard,
        thrown_card_color: None,
        available_offer_cards: ArrayVec::new(),
    }));

    ResolveResult::PendingSet
}

pub(crate) fn apply_resolve_training(
    state: &mut GameState,
    player_idx: usize,
    selection_index: usize,
) -> Result<ApplyResult, ApplyError> {
    let pending = match state.players[player_idx].pending.active.take() {
        Some(ActivePending::Training(t)) => t,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "ResolveTraining: no active Training pending".to_string(),
            ));
        }
    };

    match pending.phase {
        BookOfWisdomPhase::SelectCard => {
            // Phase 1: Player selects a card from hand to throw away
            let player = &mut state.players[player_idx];
            if selection_index >= player.hand.len() {
                // Restore pending and error
                player.pending.active = Some(ActivePending::Training(pending));
                return Err(ApplyError::InternalError(
                    "ResolveTraining: hand index out of range".to_string(),
                ));
            }

            if !super::utils::is_action_card(&player.hand[selection_index]) {
                player.pending.active = Some(ActivePending::Training(pending));
                return Err(ApplyError::InternalError(
                    "ResolveTraining: hand card is not an action card".to_string(),
                ));
            }

            let card_id = player.hand.remove(selection_index);
            let card_color = mk_data::cards::get_card_color(card_id.as_str());
            player.removed_cards.push(card_id);

            // Find matching-color AAs in offer
            let mut available: arrayvec::ArrayVec<CardId, { mk_types::pending::MAX_OFFER_CARDS }> =
                arrayvec::ArrayVec::new();
            if let Some(color) = card_color {
                for aa_id in &state.offers.advanced_actions {
                    if mk_data::cards::get_card_color(aa_id.as_str()) == Some(color)
                        && available.try_push(aa_id.clone()).is_err()
                    {
                        break;
                    }
                }
            }

            if available.is_empty() {
                // No matching AAs — just clear pending, card was still thrown away
                Ok(ApplyResult {
                    needs_reenumeration: true,
                    game_ended: false,
                    events: Vec::new(),
                })
            } else if available.len() == 1 {
                // Auto-select the only option
                let aa_id = available[0].clone();
                let offer_idx = state
                    .offers
                    .advanced_actions
                    .iter()
                    .position(|id| *id == aa_id)
                    .unwrap();
                state.offers.advanced_actions.remove(offer_idx);
                super::replenish_aa_offer(state);
                let player = &mut state.players[player_idx];
                match pending.mode {
                    mk_types::pending::EffectMode::Powered => player.hand.push(aa_id),
                    mk_types::pending::EffectMode::Basic => player.discard.push(aa_id),
                }
                Ok(ApplyResult {
                    needs_reenumeration: true,
                    game_ended: false,
                    events: Vec::new(),
                })
            } else {
                // Multiple matching AAs — set phase to SelectFromOffer
                state.players[player_idx].pending.active =
                    Some(ActivePending::Training(PendingTraining {
                        phase: BookOfWisdomPhase::SelectFromOffer,
                        thrown_card_color: card_color,
                        available_offer_cards: available,
                        ..pending
                    }));
                Ok(ApplyResult {
                    needs_reenumeration: true,
                    game_ended: false,
                    events: Vec::new(),
                })
            }
        }
        BookOfWisdomPhase::SelectFromOffer => {
            // Phase 2: Player selects an AA from the available offer cards
            if selection_index >= pending.available_offer_cards.len() {
                state.players[player_idx].pending.active = Some(ActivePending::Training(pending));
                return Err(ApplyError::InternalError(
                    "ResolveTraining: offer selection index out of range".to_string(),
                ));
            }

            let aa_id = pending.available_offer_cards[selection_index].clone();
            if let Some(offer_idx) = state
                .offers
                .advanced_actions
                .iter()
                .position(|id| *id == aa_id)
            {
                state.offers.advanced_actions.remove(offer_idx);
                super::replenish_aa_offer(state);
            }

            let player = &mut state.players[player_idx];
            match pending.mode {
                mk_types::pending::EffectMode::Powered => player.hand.push(aa_id),
                mk_types::pending::EffectMode::Basic => player.discard.push(aa_id),
            }

            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: Vec::new(),
            })
        }
    }
}

pub(crate) fn enumerate_training_choices(
    t: &PendingTraining,
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];
    match t.phase {
        BookOfWisdomPhase::SelectCard => {
            // Enumerate eligible hand cards to throw away (BasicAction or AdvancedAction)
            for (idx, card_id) in player.hand.iter().enumerate() {
                if let Some(def) = mk_data::cards::get_card(card_id.as_str()) {
                    if matches!(
                        def.card_type,
                        DeedCardType::BasicAction | DeedCardType::AdvancedAction
                    ) {
                        actions.push(LegalAction::ResolveTraining {
                            selection_index: idx,
                        });
                    }
                }
            }
        }
        BookOfWisdomPhase::SelectFromOffer => {
            // Enumerate available offer cards
            for i in 0..t.available_offer_cards.len() {
                actions.push(LegalAction::ResolveTraining { selection_index: i });
            }
        }
    }
}
