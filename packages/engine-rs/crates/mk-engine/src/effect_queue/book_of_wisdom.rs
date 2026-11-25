//! Book of Wisdom's artifact effect and saved selection workflow.
//! The existing pending types, option ordering, and action boundaries remain unchanged.

use super::{eligible_colored_hand_cards, ColoredHandCardScope, ResolveResult};
use crate::action_pipeline::{ApplyError, ApplyResult};
use crate::mana;
use mk_types::ids::CardId;
use mk_types::legal_action::LegalAction;
use mk_types::pending::{ActivePending, EffectMode, PendingBookOfWisdom};
use mk_types::state::GameState;

pub(crate) const BOOK_OF_WISDOM_CARD_ID: &str = "book_of_wisdom";

pub(super) fn apply_book_of_wisdom(
    state: &mut GameState,
    player_idx: usize,
    mode: EffectMode,
) -> ResolveResult {
    use mk_types::pending::{BookOfWisdomPhase, PendingBookOfWisdom};

    // Find eligible hand cards: non-wound, non-self action cards with a color
    let eligible = eligible_colored_hand_cards(
        &state.players[player_idx].hand,
        BOOK_OF_WISDOM_CARD_ID,
        ColoredHandCardScope::ActionCardsAndSpells,
    );

    if eligible.is_empty() {
        return ResolveResult::Skipped;
    }

    // Set pending for card selection
    let source_card = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from(BOOK_OF_WISDOM_CARD_ID));
    state.players[player_idx].pending.active =
        Some(ActivePending::BookOfWisdom(PendingBookOfWisdom {
            source_card_id: source_card,
            mode,
            phase: BookOfWisdomPhase::SelectCard,
            thrown_card_color: None,
            available_offer_cards: arrayvec::ArrayVec::new(),
        }));
    ResolveResult::PendingSet
}

pub(crate) fn apply_resolve_book_of_wisdom(
    state: &mut GameState,
    player_idx: usize,
    selection_index: usize,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{ActivePending, BookOfWisdomPhase, PendingBookOfWisdom};

    let pending = match state.players[player_idx].pending.active.take() {
        Some(ActivePending::BookOfWisdom(b)) => b,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "ResolveBookOfWisdom: no active BookOfWisdom pending".to_string(),
            ));
        }
    };

    match pending.phase {
        BookOfWisdomPhase::SelectCard => {
            let Some((_, card_color)) = super::select_colored_hand_card(
                &mut state.players[player_idx],
                selection_index,
                super::BOOK_OF_WISDOM_CARD_ID,
                super::ColoredHandCardScope::ActionCardsAndSpells,
                super::HandCardDestination::Removed,
            ) else {
                state.players[player_idx].pending.active =
                    Some(ActivePending::BookOfWisdom(pending));
                return Err(ApplyError::InternalError(
                    "ResolveBookOfWisdom: hand index is not an eligible card".to_string(),
                ));
            };

            // Basic mode: find matching-color AAs from offer
            // Powered mode: find matching-color spells from offer
            let mut available: arrayvec::ArrayVec<CardId, { mk_types::pending::MAX_OFFER_CARDS }> =
                arrayvec::ArrayVec::new();
            match pending.mode {
                mk_types::pending::EffectMode::Basic => {
                    for aa_id in &state.offers.advanced_actions {
                        if mk_data::cards::get_card_color(aa_id.as_str()) == Some(card_color)
                            && available.try_push(aa_id.clone()).is_err()
                        {
                            break;
                        }
                    }
                }
                mk_types::pending::EffectMode::Powered => {
                    for spell_id in &state.offers.spells {
                        if mk_data::cards::get_spell_color(spell_id.as_str()) == Some(card_color)
                            && available.try_push(spell_id.clone()).is_err()
                        {
                            break;
                        }
                    }
                }
            }

            if available.is_empty() {
                // No matching cards — card was still removed
                Ok(ApplyResult {
                    needs_reenumeration: true,
                    game_ended: false,
                    events: vec![],
                })
            } else if available.len() == 1 {
                // Auto-select the only option
                let selected_id = available[0].clone();
                resolve_book_of_wisdom_selection(state, player_idx, &pending, &selected_id);
                Ok(ApplyResult {
                    needs_reenumeration: true,
                    game_ended: false,
                    events: vec![],
                })
            } else {
                state.players[player_idx].pending.active =
                    Some(ActivePending::BookOfWisdom(PendingBookOfWisdom {
                        phase: BookOfWisdomPhase::SelectFromOffer,
                        thrown_card_color: Some(card_color),
                        available_offer_cards: available,
                        ..pending
                    }));
                Ok(ApplyResult {
                    needs_reenumeration: true,
                    game_ended: false,
                    events: vec![],
                })
            }
        }
        BookOfWisdomPhase::SelectFromOffer => {
            if selection_index >= pending.available_offer_cards.len() {
                state.players[player_idx].pending.active =
                    Some(ActivePending::BookOfWisdom(pending));
                return Err(ApplyError::InternalError(
                    "ResolveBookOfWisdom: offer selection index out of range".to_string(),
                ));
            }

            let selected_id = pending.available_offer_cards[selection_index].clone();
            resolve_book_of_wisdom_selection(state, player_idx, &pending, &selected_id);
            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: vec![],
            })
        }
    }
}

fn resolve_book_of_wisdom_selection(
    state: &mut GameState,
    player_idx: usize,
    pending: &mk_types::pending::PendingBookOfWisdom,
    selected_id: &CardId,
) {
    match pending.mode {
        mk_types::pending::EffectMode::Basic => {
            // Remove AA from offer, add to player's discard
            if let Some(idx) = state
                .offers
                .advanced_actions
                .iter()
                .position(|id| id == selected_id)
            {
                state.offers.advanced_actions.remove(idx);
                super::replenish_aa_offer(state);
            }
            state.players[player_idx].discard.push(selected_id.clone());
        }
        mk_types::pending::EffectMode::Powered => {
            // Remove spell from offer, add to top of player's deck
            if let Some(idx) = state.offers.spells.iter().position(|id| id == selected_id) {
                state.offers.spells.remove(idx);
                super::replenish_spell_offer(state);
            }
            state.players[player_idx]
                .deck
                .insert(0, selected_id.clone());
            // Powered mode also grants a crystal of the discarded card's color
            if let Some(color) = pending.thrown_card_color {
                mana::gain_crystal(&mut state.players[player_idx], color);
            }
        }
    }
}

pub(crate) fn enumerate_book_of_wisdom_choices(
    bow: &PendingBookOfWisdom,
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    use mk_types::pending::BookOfWisdomPhase;
    let player = &state.players[player_idx];
    match bow.phase {
        BookOfWisdomPhase::SelectCard => {
            for (idx, _) in eligible_colored_hand_cards(
                &player.hand,
                BOOK_OF_WISDOM_CARD_ID,
                ColoredHandCardScope::ActionCardsAndSpells,
            ) {
                actions.push(LegalAction::ResolveBookOfWisdom {
                    selection_index: idx,
                });
            }
        }
        BookOfWisdomPhase::SelectFromOffer => {
            for i in 0..bow.available_offer_cards.len() {
                actions.push(LegalAction::ResolveBookOfWisdom { selection_index: i });
            }
        }
    }
}

pub(super) fn is_resolvable(state: &GameState, player_idx: usize) -> bool {
    !eligible_colored_hand_cards(
        &state.players[player_idx].hand,
        BOOK_OF_WISDOM_CARD_ID,
        ColoredHandCardScope::ActionCardsAndSpells,
    )
    .is_empty()
}
