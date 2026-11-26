//! Call to Arms' borrowed unit and ability selection workflow.
//! Legacy option ordering, source attribution and saved choices are preserved.

use super::choice_resolution::ResolveChoiceError;
use super::utils::{eligible_unit_offer_indices, resume_continuation};
use super::{DrainResult, EffectQueue, QueuedEffect, ResolveResult};
use crate::undo::UndoStack;
use mk_types::effect::CardEffect;
use mk_types::enums::CombatType;
use mk_types::ids::UnitId;
use mk_types::pending::{ActivePending, ChoiceResolution, ContinuationEntry, PendingChoice};
use mk_types::state::GameState;

/// Return offered units that Call to Arms can borrow an ability from.
fn call_to_arms_unit_indices(unit_offer: &[UnitId]) -> Vec<usize> {
    eligible_unit_offer_indices(unit_offer, |unit| {
        !unit.restricted_from_free_recruit
            && unit
                .abilities
                .iter()
                .any(|ability| ability.mana_cost.is_none())
    })
}

/// Convert a unit ability to a CardEffect for Call to Arms.
fn unit_ability_to_card_effect(ability: &mk_data::units::UnitAbility) -> Option<CardEffect> {
    use mk_data::units::UnitAbility;
    match ability {
        UnitAbility::Attack { value, element } => Some(CardEffect::GainAttack {
            amount: *value,
            combat_type: CombatType::Melee,
            element: *element,
        }),
        UnitAbility::Block { value, element } => Some(CardEffect::GainBlock {
            amount: *value,
            element: *element,
        }),
        UnitAbility::RangedAttack { value, element } => Some(CardEffect::GainAttack {
            amount: *value,
            combat_type: CombatType::Ranged,
            element: *element,
        }),
        UnitAbility::SiegeAttack { value, element } => Some(CardEffect::GainAttack {
            amount: *value,
            combat_type: CombatType::Siege,
            element: *element,
        }),
        UnitAbility::Move { value } => Some(CardEffect::GainMove { amount: *value }),
        UnitAbility::Influence { value } => Some(CardEffect::GainInfluence { amount: *value }),
        UnitAbility::Heal { value } => Some(CardEffect::GainHealing { amount: *value }),
        _ => None, // Passive abilities (Swift, Brutal, etc.) not borrowable
    }
}

/// Call to Arms basic: borrow unit ability from offer (or opponent units in multiplayer).
pub(super) fn apply_call_to_arms(state: &mut GameState, player_idx: usize) -> ResolveResult {
    let eligible_indices = call_to_arms_unit_indices(&state.offers.units);

    // In multiplayer: also scan opponent units for borrowable abilities
    // Opponent unit indices are encoded as offer_size + flat_index to distinguish them
    let offer_size = state.offers.units.len();
    let mut opponent_unit_indices = Vec::new();
    for (p_idx, player) in state.players.iter().enumerate() {
        if p_idx == player_idx {
            continue;
        }
        for (u_idx, unit) in player.units.iter().enumerate() {
            if let Some(unit_def) = mk_data::units::get_unit(unit.unit_id.as_str()) {
                let has_ability = unit_def
                    .abilities
                    .iter()
                    .any(|slot| slot.mana_cost.is_none());
                if has_ability {
                    // Encode as offset index: offer_size + sequential index
                    opponent_unit_indices.push((
                        p_idx,
                        u_idx,
                        offer_size + opponent_unit_indices.len(),
                    ));
                }
            }
        }
    }

    // For now, only use offer indices in the choice resolution (opponent units would
    // need a new ChoiceResolution variant). Extend eligible_indices to include offer units.
    // Opponent unit borrowing is informational for RL — skip complex resolution for now.
    let _ = opponent_unit_indices;

    match eligible_indices.len() {
        0 => ResolveResult::Skipped,
        _ => {
            let options: Vec<CardEffect> =
                eligible_indices.iter().map(|_| CardEffect::Noop).collect();
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::CallToArmsUnitSelect {
                    eligible_unit_indices: eligible_indices,
                },
            )
        }
    }
}

/// Resume a saved unit or ability choice without changing its wire format.
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
        ChoiceResolution::CallToArmsUnitSelect {
            eligible_unit_indices,
        } => {
            if choice_index < eligible_unit_indices.len() {
                let unit_offer_idx = eligible_unit_indices[choice_index];
                if let Some(unit_id) = state.offers.units.get(unit_offer_idx) {
                    if let Some(unit_def) = mk_data::units::get_unit(unit_id.as_str()) {
                        // Collect activatable abilities
                        let mut ability_entries = Vec::new();
                        for (ai, slot) in unit_def.abilities.iter().enumerate() {
                            if slot.mana_cost.is_none() {
                                if let Some(effect) = unit_ability_to_card_effect(&slot.ability) {
                                    ability_entries.push((ai, effect));
                                }
                            }
                        }
                        if ability_entries.len() == 1 {
                            // Auto-select single ability
                            let (_, ref effect) = ability_entries[0];
                            let mut queue = EffectQueue::new();
                            queue.push(effect.clone(), source_card_id.clone());
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
                        } else if ability_entries.len() > 1 {
                            // Present ability choice
                            let options: Vec<CardEffect> =
                                ability_entries.iter().map(|_| CardEffect::Noop).collect();
                            state.players[player_idx].pending.active =
                                Some(ActivePending::Choice(PendingChoice {
                                    card_id: source_card_id,
                                    skill_id: None,
                                    unit_instance_id: None,
                                    options,
                                    continuation: choice.continuation,
                                    movement_bonus_applied: false,
                                    resolution: ChoiceResolution::CallToArmsAbilitySelect {
                                        ability_entries,
                                    },
                                }));
                            return Ok(());
                        }
                    }
                }
                resume_continuation(state, player_idx, source_card_id, choice.continuation, undo);
                return Ok(());
            }
        }
        ChoiceResolution::CallToArmsAbilitySelect { ability_entries } => {
            if choice_index < ability_entries.len() {
                let (_, ref effect) = ability_entries[choice_index];
                let mut queue = EffectQueue::new();
                queue.push(effect.clone(), source_card_id.clone());
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
        _ => {
            return Err(ResolveChoiceError::InternalError(
                "unexpected Call to Arms choice".to_string(),
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

pub(super) fn is_resolvable(state: &GameState) -> bool {
    !call_to_arms_unit_indices(&state.offers.units).is_empty()
}

pub(crate) fn describe_call_to_arms_ability(effect: &CardEffect) -> String {
    format!("{:?}", effect)
}
