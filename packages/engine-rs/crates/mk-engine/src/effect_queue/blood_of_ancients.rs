//! Blood of Ancients' wound, mana and advanced-action choice workflow.
//!
//! The legacy pending representations, choice order, source attribution and
//! automatic-selection behavior are compatibility boundaries.
use super::choice_resolution::ResolveChoiceError;
use super::utils::{
    colored_card_offer_entries, consume_mana_source, crystal_count, replenish_aa_offer,
};
use super::{DrainResult, EffectQueue, QueuedEffect, ResolveResult, WOUND_CARD_ID};
use crate::undo::UndoStack;
use mk_types::effect::CardEffect;
use mk_types::enums::{BasicManaColor, ManaColor, ManaSourceType};
use mk_types::ids::CardId;
use mk_types::pending::{ActivePending, ChoiceResolution, ContinuationEntry, PendingChoice};
use mk_types::state::GameState;

pub(super) fn apply_blood_of_ancients_basic(
    state: &mut GameState,
    player_idx: usize,
) -> ResolveResult {
    // Take wound to hand
    state.players[player_idx]
        .hand
        .push(CardId::from(WOUND_CARD_ID));
    state.players[player_idx].wounds_received_this_turn.hand += 1;

    // Build mana options: for each basic color with available mana AND matching AAs
    let advanced_action_entries = colored_card_offer_entries(
        &state.offers.advanced_actions,
        mk_data::cards::get_card_color,
    );
    let player = &state.players[player_idx];
    let mut mana_options: Vec<(mk_types::action::ManaSourceInfo, BasicManaColor)> = Vec::new();

    for &color in &[
        BasicManaColor::Red,
        BasicManaColor::Blue,
        BasicManaColor::Green,
        BasicManaColor::White,
    ] {
        let has_matching_aa = advanced_action_entries
            .iter()
            .any(|(_, _, aa_color)| *aa_color == color);
        if !has_matching_aa {
            continue;
        }

        let target_mana = ManaColor::from(color);
        // Check token
        if player.pure_mana.iter().any(|t| t.color == target_mana) {
            mana_options.push((
                mk_types::action::ManaSourceInfo {
                    source_type: ManaSourceType::Token,
                    color: target_mana,
                    die_id: None,
                },
                color,
            ));
        }
        // Check crystal
        if crystal_count(&player.crystals, color) > 0 {
            mana_options.push((
                mk_types::action::ManaSourceInfo {
                    source_type: ManaSourceType::Crystal,
                    color: target_mana,
                    die_id: None,
                },
                color,
            ));
        }
    }

    if mana_options.is_empty() {
        return ResolveResult::Applied; // Wound taken but no AAs available
    }

    if mana_options.len() == 1 {
        // Auto-select the single mana option
        let (ref mana_source, aa_color) = mana_options[0];
        consume_mana_source(state, player_idx, mana_source);
        // Find matching AAs
        let matching: Vec<(usize, CardId)> = advanced_action_entries
            .iter()
            .filter(|(_, _, offer_color)| *offer_color == aa_color)
            .map(|(offer_index, card_id, _)| (*offer_index, card_id.clone()))
            .collect();
        if matching.len() == 1 {
            let (offer_idx, aa_id) = &matching[0];
            let aa_id = aa_id.clone();
            state.offers.advanced_actions.remove(*offer_idx);
            replenish_aa_offer(state);
            state.players[player_idx].hand.push(aa_id);
        }
        // Preserve the legacy behavior: with multiple matches, mana is spent but no AA is gained.
        return ResolveResult::Applied;
    }

    let options: Vec<CardEffect> = mana_options.iter().map(|_| CardEffect::Noop).collect();
    ResolveResult::NeedsChoiceWith(
        options,
        ChoiceResolution::BloodBasicManaSelect { mana_options },
    )
}

pub(super) fn apply_blood_of_ancients_powered(
    state: &mut GameState,
    _player_idx: usize,
) -> ResolveResult {
    // Check if any AAs in offer
    if state.offers.advanced_actions.is_empty() {
        return ResolveResult::Skipped;
    }

    // Present wound destination choice: hand or discard
    let options = vec![
        CardEffect::Noop, // wound to hand
        CardEffect::Noop, // wound to discard
    ];
    ResolveResult::NeedsChoiceWith(options, ChoiceResolution::BloodPoweredWoundSelect)
}

/// Resume a legacy Blood of Ancients choice without changing its saved shape.
pub(super) fn resolve_choice(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
    choice: PendingChoice,
    undo: Option<&mut UndoStack>,
) -> Result<(), ResolveChoiceError> {
    let chosen_effect = choice.options[choice_index].clone();
    let source_card_id = choice.card_id.clone();
    let resolution = choice.resolution.clone();
    match &resolution {
        ChoiceResolution::BloodBasicManaSelect { mana_options } => {
            if choice_index < mana_options.len() {
                let (ref mana_source, aa_color) = mana_options[choice_index];
                // Consume the mana source
                consume_mana_source(state, player_idx, mana_source);
                // Find matching AAs in offer
                let matching_aas: Vec<(usize, mk_types::ids::CardId)> = colored_card_offer_entries(
                    &state.offers.advanced_actions,
                    mk_data::cards::get_card_color,
                )
                .into_iter()
                .filter(|(_, _, color)| *color == aa_color)
                .map(|(index, card_id, _)| (index, card_id))
                .collect();
                if matching_aas.len() == 1 {
                    // Auto-gain the single matching AA
                    let (offer_idx, aa_id) = &matching_aas[0];
                    let aa_id = aa_id.clone();
                    state.offers.advanced_actions.remove(*offer_idx);
                    replenish_aa_offer(state);
                    state.players[player_idx].hand.push(aa_id);
                } else if matching_aas.len() > 1 {
                    let options: Vec<CardEffect> =
                        matching_aas.iter().map(|_| CardEffect::Noop).collect();
                    let continuation: Vec<ContinuationEntry> =
                        choice.continuation.into_iter().collect();
                    state.players[player_idx].pending.active =
                        Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None,
                            unit_instance_id: None,
                            options,
                            continuation,
                            movement_bonus_applied: false,
                            resolution: ChoiceResolution::BloodBasicAaSelect { color: aa_color },
                        }));
                    return Ok(());
                }
                // Continue with any continuation
                let mut queue = EffectQueue::new();
                queue.push_continuation(
                    choice
                        .continuation
                        .into_iter()
                        .map(|c| QueuedEffect {
                            effect: c.effect,
                            source_card_id: c.source_card_id,
                        })
                        .collect(),
                );
                match queue.drain_with_undo(state, player_idx, undo) {
                    DrainResult::Complete => {}
                    DrainResult::NeedsChoice {
                        options,
                        continuation,
                        resolution: new_res,
                    } => {
                        state.players[player_idx].pending.active =
                            Some(ActivePending::Choice(PendingChoice {
                                card_id: source_card_id,
                                skill_id: None,
                                unit_instance_id: None,
                                options,
                                continuation: continuation
                                    .into_iter()
                                    .map(|q| ContinuationEntry {
                                        effect: q.effect,
                                        source_card_id: q.source_card_id,
                                    })
                                    .collect(),
                                movement_bonus_applied: false,
                                resolution: new_res,
                            }));
                    }
                    DrainResult::PendingSet => {}
                }
                return Ok(());
            }
        }
        ChoiceResolution::BloodBasicAaSelect { color } => {
            // Select AA from offer by color
            let matching_aas: Vec<(usize, mk_types::ids::CardId)> = colored_card_offer_entries(
                &state.offers.advanced_actions,
                mk_data::cards::get_card_color,
            )
            .into_iter()
            .filter(|(_, _, offer_color)| *offer_color == *color)
            .map(|(index, card_id, _)| (index, card_id))
            .collect();
            if choice_index < matching_aas.len() {
                let (offer_idx, aa_id) = &matching_aas[choice_index];
                let aa_id = aa_id.clone();
                state.offers.advanced_actions.remove(*offer_idx);
                replenish_aa_offer(state);
                state.players[player_idx].hand.push(aa_id);
            }
            // Continue with any continuation
            let mut queue = EffectQueue::new();
            queue.push_continuation(
                choice
                    .continuation
                    .into_iter()
                    .map(|c| QueuedEffect {
                        effect: c.effect,
                        source_card_id: c.source_card_id,
                    })
                    .collect(),
            );
            match queue.drain_with_undo(state, player_idx, undo) {
                DrainResult::Complete => {}
                DrainResult::NeedsChoice {
                    options,
                    continuation,
                    resolution: new_res,
                } => {
                    state.players[player_idx].pending.active =
                        Some(ActivePending::Choice(PendingChoice {
                            card_id: source_card_id,
                            skill_id: None,
                            unit_instance_id: None,
                            options,
                            continuation: continuation
                                .into_iter()
                                .map(|q| ContinuationEntry {
                                    effect: q.effect,
                                    source_card_id: q.source_card_id,
                                })
                                .collect(),
                            movement_bonus_applied: false,
                            resolution: new_res,
                        }));
                }
                DrainResult::PendingSet => {}
            }
            return Ok(());
        }
        ChoiceResolution::BloodPoweredWoundSelect => {
            // Choice 0 = wound to hand, choice 1 = wound to discard
            let player = &mut state.players[player_idx];
            if choice_index == 0 {
                player.hand.push(CardId::from(WOUND_CARD_ID));
                player.wounds_received_this_turn.hand += 1;
            } else {
                player.discard.push(CardId::from(WOUND_CARD_ID));
                player.wounds_received_this_turn.discard += 1;
            }
            // Now present all AAs in offer
            let aa_count = state.offers.advanced_actions.len();
            if aa_count > 0 {
                let options: Vec<CardEffect> = (0..aa_count).map(|_| CardEffect::Noop).collect();
                let continuation: Vec<ContinuationEntry> =
                    choice.continuation.into_iter().collect();
                state.players[player_idx].pending.active =
                    Some(ActivePending::Choice(PendingChoice {
                        card_id: source_card_id,
                        skill_id: None,
                        unit_instance_id: None,
                        options,
                        continuation,
                        movement_bonus_applied: false,
                        resolution: ChoiceResolution::BloodPoweredAaSelect,
                    }));
                return Ok(());
            }
        }
        ChoiceResolution::BloodPoweredAaSelect => {
            // Select AA from offer — resolve its powered effect for free
            let aa_list: Vec<mk_types::ids::CardId> = state.offers.advanced_actions.clone();
            if choice_index < aa_list.len() {
                let aa_id = &aa_list[choice_index];
                // Get the AA's powered effect
                if let Some(card_def) = mk_data::cards::get_card(aa_id.as_str()) {
                    let powered_effect = card_def.powered_effect;
                    // Resolve the powered effect through the queue (AA stays in offer)
                    super::continuation::run_effect(
                        state,
                        player_idx,
                        QueuedEffect {
                            effect: powered_effect,
                            source_card_id: Some(aa_id.clone()),
                        },
                        choice.continuation,
                        source_card_id,
                        undo,
                    );
                    return Ok(());
                }
            }
        }
        _ => {
            return Err(ResolveChoiceError::InternalError(
                "unexpected Blood of Ancients choice".to_string(),
            ))
        }
    }
    // Build a new queue with the chosen option + continuation
    let mut queue = EffectQueue::new();
    queue.push(chosen_effect, source_card_id.clone());
    queue.push_continuation(
        choice
            .continuation
            .into_iter()
            .map(|c| QueuedEffect {
                effect: c.effect,
                source_card_id: c.source_card_id,
            })
            .collect(),
    );

    // Drain the queue
    match queue.drain_with_undo(state, player_idx, undo) {
        DrainResult::Complete => {
            // Pending is already cleared (we took it above)
            Ok(())
        }
        DrainResult::NeedsChoice {
            options,
            continuation,
            resolution,
        } => {
            // Another choice emerged — set new pending
            state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                card_id: source_card_id,
                skill_id: None,
                unit_instance_id: None,
                options,
                continuation: continuation
                    .into_iter()
                    .map(|q| ContinuationEntry {
                        effect: q.effect,
                        source_card_id: q.source_card_id,
                    })
                    .collect(),
                movement_bonus_applied: false,
                resolution,
            }));
            Ok(())
        }
        DrainResult::PendingSet => {
            // A custom pending was set directly (e.g., DiscardForBonus inside a choice).
            Ok(())
        }
    }
}

/// Descriptions use the same current offer and indices as the legacy pipeline.
pub(crate) fn describe_blood_of_ancients_choice(
    resolution: &ChoiceResolution,
    choice_index: usize,
    state: &GameState,
) -> Option<String> {
    match resolution {
        ChoiceResolution::BloodBasicManaSelect { mana_options } => mana_options
            .get(choice_index)
            .map(|(_, color)| format!("Spend {:?} mana", color)),
        ChoiceResolution::BloodBasicAaSelect { color } => {
            let matching_aas: Vec<_> = state
                .offers
                .advanced_actions
                .iter()
                .filter(|card_id| mk_data::cards::get_card_color(card_id.as_str()) == Some(*color))
                .collect();
            matching_aas.get(choice_index).and_then(|card_id| {
                mk_data::cards::get_card(card_id.as_str()).map(|def| format!("Gain {}", def.name))
            })
        }
        ChoiceResolution::BloodPoweredWoundSelect => Some(if choice_index == 0 {
            "Wound to hand".to_string()
        } else {
            "Wound to discard".to_string()
        }),
        ChoiceResolution::BloodPoweredAaSelect => state
            .offers
            .advanced_actions
            .get(choice_index)
            .and_then(|card_id| {
                mk_data::cards::get_card(card_id.as_str())
                    .map(|def| format!("Use {}'s powered effect", def.name))
            }),
        _ => None,
    }
}

pub(super) fn is_powered_resolvable(state: &GameState) -> bool {
    !state.offers.advanced_actions.is_empty()
}
