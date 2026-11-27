//! Spell Forge's offer-indexed crystal selection workflow.
//! Legacy choice ordering, auto-selection, continuations, and pending shape are preserved.

use super::choice_resolution::ResolveChoiceError;
use super::utils::{colored_card_offer_entries, gain_crystal_color, resolve_eligible_noop_choice};
use super::{EffectQueue, QueuedEffect, ResolveResult};
use crate::undo::UndoStack;
use mk_types::effect::CardEffect;
use mk_types::enums::BasicManaColor;
use mk_types::pending::{ActivePending, ChoiceResolution, ContinuationEntry, PendingChoice};
use mk_types::state::GameState;

fn apply_spell_forge(
    state: &mut GameState,
    player_idx: usize,
    allow_second_choice: bool,
) -> ResolveResult {
    let spell_entries: Vec<(usize, BasicManaColor)> =
        colored_card_offer_entries(&state.offers.spells, mk_data::cards::get_spell_color)
            .into_iter()
            .map(|(index, _, color)| (index, color))
            .collect();

    resolve_eligible_noop_choice(
        spell_entries,
        |(_, color)| {
            gain_crystal_color(state, player_idx, color);
            ResolveResult::Applied
        },
        |spell_entries| ChoiceResolution::SpellForgeCrystal {
            spell_entries,
            is_second: false,
            allow_second_choice,
            first_spell_index: None,
        },
    )
}

pub(super) fn apply_spell_forge_basic(state: &mut GameState, player_idx: usize) -> ResolveResult {
    apply_spell_forge(state, player_idx, false)
}

pub(super) fn apply_spell_forge_powered(state: &mut GameState, player_idx: usize) -> ResolveResult {
    apply_spell_forge(state, player_idx, true)
}

/// Resume a saved crystal choice using its persisted indices and continuation.
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
        ChoiceResolution::SpellForgeCrystal {
            spell_entries,
            is_second,
            allow_second_choice,
            first_spell_index: _,
        } => {
            if choice_index < spell_entries.len() {
                let (offer_index, spell_color) = spell_entries[choice_index];
                // Gain crystal of the spell's color
                gain_crystal_color(state, player_idx, spell_color);
                // If this is the first selection of powered, chain to second choice
                if *allow_second_choice && !is_second {
                    // Build second choice: same spells minus the one just picked
                    let second_entries: Vec<(usize, BasicManaColor)> = spell_entries
                        .iter()
                        .filter(|(idx, _)| *idx != offer_index)
                        .copied()
                        .collect();
                    if !second_entries.is_empty() {
                        let options: Vec<CardEffect> =
                            second_entries.iter().map(|_| CardEffect::Noop).collect();
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
                        let continuation: Vec<ContinuationEntry> = queue
                            .queue
                            .drain(..)
                            .map(|q| ContinuationEntry {
                                effect: q.effect,
                                source_card_id: q.source_card_id,
                            })
                            .collect();
                        state.players[player_idx].pending.active =
                            Some(ActivePending::Choice(PendingChoice {
                                card_id: source_card_id,
                                skill_id: None,
                                unit_instance_id: None,
                                options,
                                continuation,
                                movement_bonus_applied: false,
                                resolution: ChoiceResolution::SpellForgeCrystal {
                                    spell_entries: second_entries,
                                    is_second: true,
                                    allow_second_choice: *allow_second_choice,
                                    first_spell_index: Some(offer_index),
                                },
                            }));
                        return Ok(());
                    }
                }
                // Single spell or second selection — continue normally
                super::continuation::run_continuation(
                    state, player_idx, choice.continuation, source_card_id, undo,
                );
                return Ok(());
            }
        }
        _ => {
            return Err(ResolveChoiceError::InternalError(
                "unexpected Spell Forge choice".to_string(),
            ))
        }
    }
    // Build a new queue with the chosen option + continuation
    super::continuation::run_effect(
        state, player_idx, QueuedEffect { effect: chosen_effect, source_card_id: source_card_id.clone() },
        choice.continuation, source_card_id, undo,
    );
    Ok(())
}

pub(super) fn is_resolvable(state: &GameState) -> bool {
    !colored_card_offer_entries(&state.offers.spells, mk_data::cards::get_spell_color).is_empty()
}

pub(crate) fn describe_spell_forge_crystal(color: BasicManaColor) -> String {
    format!("Gain {:?} crystal", color)
}
