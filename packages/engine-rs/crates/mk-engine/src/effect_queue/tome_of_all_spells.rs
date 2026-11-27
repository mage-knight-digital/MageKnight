//! Tome of All Spells' artifact effect and saved selection workflow.
//! Legacy pending states, option order, and queue outcomes remain unchanged.

use super::{eligible_colored_hand_cards, ColoredHandCardScope, ResolveResult};
use crate::action_pipeline::{ApplyError, ApplyResult};
use crate::undo::UndoStack;
use mk_types::ids::CardId;
use mk_types::legal_action::LegalAction;
use mk_types::pending::{ActivePending, EffectMode, PendingTomeOfAllSpells};
use mk_types::state::GameState;

pub(crate) const TOME_OF_ALL_SPELLS_CARD_ID: &str = "tome_of_all_spells";

pub(super) fn apply_tome_of_all_spells(
    state: &mut GameState,
    player_idx: usize,
    mode: EffectMode,
) -> ResolveResult {
    use mk_types::pending::{PendingTomeOfAllSpells, TomeOfAllSpellsPhase};

    // Eligible: any colored (non-wound, non-self) card in hand
    let has_eligible = !eligible_colored_hand_cards(
        &state.players[player_idx].hand,
        TOME_OF_ALL_SPELLS_CARD_ID,
        ColoredHandCardScope::ActionCards,
    )
    .is_empty();

    if !has_eligible {
        return ResolveResult::Skipped;
    }

    let source_card = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from(TOME_OF_ALL_SPELLS_CARD_ID));

    state.players[player_idx].pending.active =
        Some(ActivePending::TomeOfAllSpells(PendingTomeOfAllSpells {
            source_card_id: source_card,
            mode,
            phase: TomeOfAllSpellsPhase::SelectCard,
            discarded_color: None,
            available_spells: Vec::new(),
        }));
    ResolveResult::PendingSet
}

pub(crate) fn apply_resolve_tome_of_all_spells(
    state: &mut GameState,
    player_idx: usize,
    selection_index: usize,
    undo_stack: &mut UndoStack,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{ActivePending, TomeOfAllSpellsPhase};

    let pending = match state.players[player_idx].pending.active.take() {
        Some(ActivePending::TomeOfAllSpells(t)) => t,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "ResolveTomeOfAllSpells: no active TomeOfAllSpells pending".to_string(),
            ));
        }
    };

    match pending.phase {
        TomeOfAllSpellsPhase::SelectCard => {
            // Discard the selected card from hand, determine its color
            let Some((_, card_color)) = super::select_colored_hand_card(
                &mut state.players[player_idx],
                selection_index,
                super::TOME_OF_ALL_SPELLS_CARD_ID,
                super::ColoredHandCardScope::ActionCards,
                super::HandCardDestination::Discard,
            ) else {
                state.players[player_idx].pending.active =
                    Some(ActivePending::TomeOfAllSpells(pending));
                return Err(ApplyError::InternalError(
                    "ResolveTomeOfAllSpells: hand index is not an eligible card".to_string(),
                ));
            };

            // Find matching-color spells in offer
            let available_spells: Vec<mk_types::ids::CardId> =
                super::utils::colored_card_offer_entries(
                    &state.offers.spells,
                    mk_data::cards::get_spell_color,
                )
                    .into_iter()
                    .filter(|(_, _, color)| *color == card_color)
                    .map(|(_, card_id, _)| card_id)
                    .collect();

            if available_spells.is_empty() {
                // No matching spells — resolve without offer phase
                return Ok(ApplyResult {
                    needs_reenumeration: true,
                    game_ended: false,
                    events: vec![],
                });
            }

            // Transition to SelectSpell phase
            state.players[player_idx].pending.active = Some(ActivePending::TomeOfAllSpells(
                mk_types::pending::PendingTomeOfAllSpells {
                    source_card_id: pending.source_card_id,
                    mode: pending.mode,
                    phase: TomeOfAllSpellsPhase::SelectSpell,
                    discarded_color: Some(card_color),
                    available_spells,
                },
            ));
            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: vec![],
            })
        }
        TomeOfAllSpellsPhase::SelectSpell => {
            // Player selected a spell from the available list
            if selection_index >= pending.available_spells.len() {
                return Err(ApplyError::InternalError(
                    "ResolveTomeOfAllSpells: spell selection_index out of range".to_string(),
                ));
            }
            let spell_id = &pending.available_spells[selection_index];

            // Look up the spell and resolve its effect through the queue
            let spell_def = mk_data::cards::get_spell_card(spell_id.as_str());
            if let Some(def) = spell_def {
                let effect = match pending.mode {
                    mk_types::pending::EffectMode::Basic => def.basic_effect.clone(),
                    mk_types::pending::EffectMode::Powered => def.powered_effect.clone(),
                };
                // Resolve the spell's effect through the effect queue
                // The spell stays in the offer (not consumed)
                let mut queue = super::EffectQueue::new();
                queue.push(effect, Some(spell_id.clone()));
                queue.drain_with_undo(state, player_idx, Some(undo_stack));
            }

            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: vec![],
            })
        }
    }
}

pub(crate) fn enumerate_tome_choices(
    tome: &PendingTomeOfAllSpells,
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    use mk_types::pending::TomeOfAllSpellsPhase;
    let player = &state.players[player_idx];
    match tome.phase {
        TomeOfAllSpellsPhase::SelectCard => {
            for (idx, _) in eligible_colored_hand_cards(
                &player.hand,
                TOME_OF_ALL_SPELLS_CARD_ID,
                ColoredHandCardScope::ActionCards,
            ) {
                actions.push(LegalAction::ResolveTomeOfAllSpells {
                    selection_index: idx,
                });
            }
        }
        TomeOfAllSpellsPhase::SelectSpell => {
            for i in 0..tome.available_spells.len() {
                actions.push(LegalAction::ResolveTomeOfAllSpells { selection_index: i });
            }
        }
    }
}

pub(super) fn is_resolvable(state: &GameState, player_idx: usize) -> bool {
    !state.offers.spells.is_empty()
        && !eligible_colored_hand_cards(
            &state.players[player_idx].hand,
            TOME_OF_ALL_SPELLS_CARD_ID,
            ColoredHandCardScope::ActionCards,
        )
        .is_empty()
}
