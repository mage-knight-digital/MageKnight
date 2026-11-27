//! Shared, read-only queries for hand cards and card offers.

use mk_types::effect::CardEffect;
use mk_types::enums::{BasicManaColor, DeedCardType};
use mk_types::ids::CardId;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ColoredHandCardScope {
    ActionCards,
}

/// Return hand indices that satisfy a card-specific eligibility rule.
pub(crate) fn eligible_hand_card_indices(
    hand: &[CardId],
    is_eligible: impl Fn(&CardId) -> bool,
) -> Vec<usize> {
    hand.iter()
        .enumerate()
        .filter(|(_, card_id)| is_eligible(card_id))
        .map(|(index, _)| index)
        .collect()
}

/// Return hand indices for basic and advanced action cards.
pub(crate) fn eligible_action_hand_indices(hand: &[CardId]) -> Vec<usize> {
    eligible_hand_card_indices(hand, is_action_card)
}

/// Check whether a card ID refers to a basic or advanced action card.
pub(crate) fn is_action_card(card_id: &CardId) -> bool {
    mk_data::cards::get_card(card_id.as_str()).is_some_and(|definition| {
        matches!(
            definition.card_type,
            DeedCardType::BasicAction | DeedCardType::AdvancedAction
        )
    })
}

/// Pair eligible hand indices with effects derived from their corresponding cards.
pub(crate) fn hand_card_effect_choices(
    hand: &[CardId],
    is_eligible: impl Fn(&CardId) -> bool,
    effect_for_card: impl Fn(&CardId) -> CardEffect,
) -> (Vec<usize>, Vec<CardEffect>) {
    let eligible_indices = eligible_hand_card_indices(hand, is_eligible);
    let options = eligible_indices
        .iter()
        .map(|index| effect_for_card(&hand[*index]))
        .collect();
    (eligible_indices, options)
}

/// Collect offer cards with their original indices and resolved basic mana colors.
pub(crate) fn colored_card_offer_entries(
    offer: &[CardId],
    color_for_card: impl Fn(&str) -> Option<BasicManaColor>,
) -> Vec<(usize, CardId, BasicManaColor)> {
    offer
        .iter()
        .enumerate()
        .filter_map(|(index, card_id)| {
            let color = color_for_card(card_id.as_str())?;
            Some((index, card_id.clone(), color))
        })
        .collect()
}

pub(crate) fn eligible_colored_hand_cards(
    hand: &[CardId],
    excluded_card_id: &str,
    scope: ColoredHandCardScope,
) -> Vec<(usize, BasicManaColor)> {
    eligible_hand_card_indices(hand, |card_id| card_id.as_str() != excluded_card_id)
        .into_iter()
        .filter_map(|index| {
            let card_id = &hand[index];
            let color = match scope {
                ColoredHandCardScope::ActionCards => mk_data::cards::get_card_color(card_id.as_str()),
            }?;
            Some((index, color))
        })
        .collect()
}

