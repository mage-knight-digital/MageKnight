use mk_data::cards::get_card;
use mk_types::effect::CardEffect;
use mk_types::enums::*;
use mk_types::ids::CardId;
use mk_types::legal_action::LegalAction;
use mk_types::state::{GameState, PlayerFlags};

use crate::effect_queue::is_resolvable;

use super::utils::WOUND_CARD_ID;

pub(super) fn enumerate_normal_cards(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];
    let is_resting = player.flags.contains(PlayerFlags::IS_RESTING);
    let has_rested = player.flags.contains(PlayerFlags::HAS_RESTED_THIS_TURN);

    // Collect basic, powered, sideways separately to emit in category order.
    let mut basic_actions = Vec::new();
    let mut powered_actions = Vec::new();
    let mut sideways_actions = Vec::new();

    for (hand_index, card_id) in player.hand.iter().enumerate() {
        let card_def = match get_card(card_id.as_str()) {
            Some(def) => def,
            None => continue,
        };

        // Category 2: PlayCardBasic — allowed during rest (FAQ S3).
        if is_effect_playable_for_enumeration(state, player_idx, hand_index, &card_def.basic_effect)
        {
            basic_actions.push(LegalAction::PlayCardBasic {
                hand_index,
                card_id: card_id.clone(),
            });
        }

        // Category 3: PlayCardPowered — allowed during rest (FAQ S3).
        if let Some(color) = card_def.powered_by {
            if is_effect_playable_for_enumeration(
                state,
                player_idx,
                hand_index,
                &card_def.powered_effect,
            ) && can_afford_powered(state, player_idx, color)
            {
                powered_actions.push(LegalAction::PlayCardPowered {
                    hand_index,
                    card_id: card_id.clone(),
                    mana_color: color,
                });
            }
        }

        // Category 4: PlayCardSideways.
        // While resting: NO sideways at all.
        // After rest: influence only (no move).
        // Normal: both move and influence.
        if !is_resting && card_def.sideways_value > 0 {
            if has_rested {
                // After rest: influence only.
                sideways_actions.push(LegalAction::PlayCardSideways {
                    hand_index,
                    card_id: card_id.clone(),
                    sideways_as: SidewaysAs::Influence,
                });
            } else {
                // Normal: both move and influence.
                sideways_actions.push(LegalAction::PlayCardSideways {
                    hand_index,
                    card_id: card_id.clone(),
                    sideways_as: SidewaysAs::Move,
                });
                sideways_actions.push(LegalAction::PlayCardSideways {
                    hand_index,
                    card_id: card_id.clone(),
                    sideways_as: SidewaysAs::Influence,
                });
            }
        }
    }

    actions.extend(basic_actions);
    actions.extend(powered_actions);
    actions.extend(sideways_actions);
}

pub(super) fn enumerate_combat_cards(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];

    let mut basic_actions = Vec::new();
    let mut powered_actions = Vec::new();
    let mut sideways_actions = Vec::new();

    for (hand_index, card_id) in player.hand.iter().enumerate() {
        let card_def = match get_card(card_id.as_str()) {
            Some(def) => def,
            None => continue,
        };

        // Category 2: PlayCardBasic.
        if is_effect_playable_for_enumeration(state, player_idx, hand_index, &card_def.basic_effect)
        {
            basic_actions.push(LegalAction::PlayCardBasic {
                hand_index,
                card_id: card_id.clone(),
            });
        }

        // Category 3: PlayCardPowered.
        if let Some(color) = card_def.powered_by {
            if is_effect_playable_for_enumeration(
                state,
                player_idx,
                hand_index,
                &card_def.powered_effect,
            ) && can_afford_powered(state, player_idx, color)
            {
                powered_actions.push(LegalAction::PlayCardPowered {
                    hand_index,
                    card_id: card_id.clone(),
                    mana_color: color,
                });
            }
        }

        // Category 4: PlayCardSideways (combat: Attack and Block).
        if card_def.sideways_value > 0 {
            sideways_actions.push(LegalAction::PlayCardSideways {
                hand_index,
                card_id: card_id.clone(),
                sideways_as: SidewaysAs::Attack,
            });
            sideways_actions.push(LegalAction::PlayCardSideways {
                hand_index,
                card_id: card_id.clone(),
                sideways_as: SidewaysAs::Block,
            });
        }
    }

    actions.extend(basic_actions);
    actions.extend(powered_actions);
    actions.extend(sideways_actions);
}

fn is_effect_playable_for_enumeration(
    state: &GameState,
    player_idx: usize,
    source_hand_index: usize,
    effect: &CardEffect,
) -> bool {
    match effect {
        CardEffect::CardBoost { .. } => {
            has_playable_card_boost_target(state, player_idx, source_hand_index)
        }
        _ => is_resolvable(state, player_idx, effect),
    }
}

fn has_playable_card_boost_target(
    state: &GameState,
    player_idx: usize,
    source_hand_index: usize,
) -> bool {
    let player = &state.players[player_idx];

    player
        .hand
        .iter()
        .enumerate()
        .any(|(target_hand_index, target_card_id)| {
            if target_hand_index == source_hand_index {
                return false;
            }

            let target_def = match get_card(target_card_id.as_str()) {
                Some(def) => def,
                None => return false,
            };

            // CardBoost can target only action cards (not wounds/spells/artifacts).
            if !matches!(
                target_def.card_type,
                DeedCardType::BasicAction | DeedCardType::AdvancedAction
            ) {
                return false;
            }
            if target_def.card_type == DeedCardType::Wound {
                return false;
            }

            // Powered target effect itself must be resolvable in current context.
            if !is_resolvable(state, player_idx, &target_def.powered_effect) {
                return false;
            }

            // For discard-cost targets, both source and target leave hand before
            // resolving the boosted powered effect. Ensure costs remain payable.
            let remaining_hand: Vec<CardId> = player
                .hand
                .iter()
                .enumerate()
                .filter_map(|(idx, id)| {
                    (idx != source_hand_index && idx != target_hand_index).then_some(id.clone())
                })
                .collect();

            discard_costs_payable_with_hand(&target_def.powered_effect, &remaining_hand)
        })
}

fn discard_costs_payable_with_hand(effect: &CardEffect, remaining_hand: &[CardId]) -> bool {
    match effect {
        CardEffect::DiscardCost {
            count,
            filter_wounds,
            wounds_only,
            then_effect,
        } => {
            let eligible = remaining_hand
                .iter()
                .filter(|id| {
                    let is_wound = id.as_str() == WOUND_CARD_ID;
                    if *wounds_only {
                        is_wound
                    } else if *filter_wounds {
                        !is_wound
                    } else {
                        true
                    }
                })
                .count() as u32;
            eligible >= *count && discard_costs_payable_with_hand(then_effect, remaining_hand)
        }
        CardEffect::Choice { options } => options
            .iter()
            .any(|option| discard_costs_payable_with_hand(option, remaining_hand)),
        CardEffect::Compound { effects } => effects
            .iter()
            .any(|sub| discard_costs_payable_with_hand(sub, remaining_hand)),
        CardEffect::Conditional {
            then_effect,
            else_effect,
            ..
        } => {
            discard_costs_payable_with_hand(then_effect, remaining_hand)
                || else_effect.as_ref().is_some_and(|else_branch| {
                    discard_costs_payable_with_hand(else_branch, remaining_hand)
                })
        }
        CardEffect::Scaling { base_effect, .. } => {
            discard_costs_payable_with_hand(base_effect, remaining_hand)
        }
        _ => true,
    }
}

/// Check if player can afford to power a card requiring the given color.
///
/// Mirrors `consume_mana_payment` priority but doesn't mutate state.
fn can_afford_powered(state: &GameState, player_idx: usize, color: BasicManaColor) -> bool {
    let player = &state.players[player_idx];
    let target = ManaColor::from(color);

    // 1. Matching-color mana token.
    if player.pure_mana.iter().any(|t| t.color == target) {
        return true;
    }

    // 2. Gold mana token (wild).
    if player.pure_mana.iter().any(|t| t.color == ManaColor::Gold) {
        return true;
    }

    // 3. Matching-color crystal.
    let crystal_count = match color {
        BasicManaColor::Red => player.crystals.red,
        BasicManaColor::Blue => player.crystals.blue,
        BasicManaColor::Green => player.crystals.green,
        BasicManaColor::White => player.crystals.white,
    };
    crystal_count > 0
}
