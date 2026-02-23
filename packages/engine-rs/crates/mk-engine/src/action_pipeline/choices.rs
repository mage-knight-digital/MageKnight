//! Choice resolution handlers (training, book of wisdom, tome, circlet, meditation, etc.).

use mk_types::ids::CardId;
use mk_types::pending::ActivePending;
use mk_types::state::*;

use crate::{effect_queue, end_turn, mana};

use super::{ApplyError, ApplyResult};
use super::turn_flow;
use super::skills;
use super::units;
use super::skills_interactive;


// Card play, move, explore, challenge delegated to turn_flow module

pub(super) fn apply_resolve_choice(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
) -> Result<ApplyResult, ApplyError> {
    // Check if this is a DeepMineChoice (handled separately from standard Choice)
    if let Some(ActivePending::DeepMineChoice { ref colors }) =
        state.players[player_idx].pending.active
    {
        if choice_index >= colors.len() {
            return Err(ApplyError::InternalError(
                "DeepMineChoice: invalid choice index".into(),
            ));
        }
        let color = colors[choice_index];
        state.players[player_idx].pending.active = None;
        mana::gain_crystal(&mut state.players[player_idx], color);
        return Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: Vec::new(),
        });
    }

    // Check if this is a UnitAbilityChoice
    if let Some(ActivePending::UnitAbilityChoice { .. }) =
        state.players[player_idx].pending.active
    {
        return units::apply_resolve_unit_ability_choice(state, player_idx, choice_index);
    }

    // Check if this is a SelectCombatEnemy
    if let Some(ActivePending::SelectCombatEnemy { .. }) =
        state.players[player_idx].pending.active
    {
        return units::apply_resolve_select_enemy(state, player_idx, choice_index);
    }

    // Capture skill_id before resolving (pending is consumed)
    let skill_id_for_flip = if let Some(ActivePending::Choice(ref pc)) =
        state.players[player_idx].pending.active
    {
        pc.skill_id.clone()
    } else {
        None
    };

    effect_queue::resolve_pending_choice(state, player_idx, choice_index).map_err(|e| {
        ApplyError::InternalError(format!("resolve_pending_choice failed: {:?}", e))
    })?;

    // Battle Frenzy: flip face-down when Attack 4 option (index 1) is chosen
    if let Some(ref sid) = skill_id_for_flip {
        if sid.as_str() == "krang_battle_frenzy" && choice_index == 1 {
            let player = &mut state.players[player_idx];
            if !player.skill_flip_state.flipped_skills.contains(sid) {
                player.skill_flip_state.flipped_skills.push(sid.clone());
            }
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_resolve_training(
    state: &mut GameState,
    player_idx: usize,
    selection_index: usize,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{ActivePending, PendingTraining, BookOfWisdomPhase};

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

            let card_id = player.hand.remove(selection_index);
            let card_color = mk_data::cards::get_card_color(card_id.as_str());
            player.removed_cards.push(card_id);

            // Find matching-color AAs in offer
            let mut available: arrayvec::ArrayVec<CardId, { mk_types::pending::MAX_OFFER_CARDS }> =
                arrayvec::ArrayVec::new();
            if let Some(color) = card_color {
                for aa_id in &state.offers.advanced_actions {
                    if mk_data::cards::get_card_color(aa_id.as_str()) == Some(color)
                        && available.try_push(aa_id.clone()).is_err() {
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
                let offer_idx = state.offers.advanced_actions.iter()
                    .position(|id| *id == aa_id)
                    .unwrap();
                state.offers.advanced_actions.remove(offer_idx);
                effect_queue::replenish_aa_offer(state);
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
                state.players[player_idx].pending.active = Some(ActivePending::Training(PendingTraining {
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
            if let Some(offer_idx) = state.offers.advanced_actions.iter().position(|id| *id == aa_id) {
                state.offers.advanced_actions.remove(offer_idx);
                effect_queue::replenish_aa_offer(state);
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


pub(super) fn apply_resolve_book_of_wisdom(
    state: &mut GameState,
    player_idx: usize,
    selection_index: usize,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{ActivePending, PendingBookOfWisdom, BookOfWisdomPhase};

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
            let player = &mut state.players[player_idx];
            if selection_index >= player.hand.len() {
                player.pending.active = Some(ActivePending::BookOfWisdom(pending));
                return Err(ApplyError::InternalError(
                    "ResolveBookOfWisdom: hand index out of range".to_string(),
                ));
            }

            let card_id = player.hand.remove(selection_index);
            let card_color = mk_data::cards::get_card_color(card_id.as_str())
                .or_else(|| mk_data::cards::get_spell_color(card_id.as_str()));
            player.removed_cards.push(card_id);

            // Basic mode: find matching-color AAs from offer
            // Powered mode: find matching-color spells from offer
            let mut available: arrayvec::ArrayVec<CardId, { mk_types::pending::MAX_OFFER_CARDS }> =
                arrayvec::ArrayVec::new();
            if let Some(color) = card_color {
                match pending.mode {
                    mk_types::pending::EffectMode::Basic => {
                        for aa_id in &state.offers.advanced_actions {
                            if mk_data::cards::get_card_color(aa_id.as_str()) == Some(color)
                                && available.try_push(aa_id.clone()).is_err() {
                                break;
                            }
                        }
                    }
                    mk_types::pending::EffectMode::Powered => {
                        for spell_id in &state.offers.spells {
                            if mk_data::cards::get_spell_color(spell_id.as_str()) == Some(color)
                                && available.try_push(spell_id.clone()).is_err() {
                                break;
                            }
                        }
                    }
                }
            }

            if available.is_empty() {
                // No matching cards — card was still removed
                Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: vec![] })
            } else if available.len() == 1 {
                // Auto-select the only option
                let selected_id = available[0].clone();
                resolve_book_of_wisdom_selection(state, player_idx, &pending, &selected_id);
                Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: vec![] })
            } else {
                state.players[player_idx].pending.active = Some(ActivePending::BookOfWisdom(PendingBookOfWisdom {
                    phase: BookOfWisdomPhase::SelectFromOffer,
                    thrown_card_color: card_color,
                    available_offer_cards: available,
                    ..pending
                }));
                Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: vec![] })
            }
        }
        BookOfWisdomPhase::SelectFromOffer => {
            if selection_index >= pending.available_offer_cards.len() {
                state.players[player_idx].pending.active = Some(ActivePending::BookOfWisdom(pending));
                return Err(ApplyError::InternalError(
                    "ResolveBookOfWisdom: offer selection index out of range".to_string(),
                ));
            }

            let selected_id = pending.available_offer_cards[selection_index].clone();
            resolve_book_of_wisdom_selection(state, player_idx, &pending, &selected_id);
            Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: vec![] })
        }
    }
}


pub(super) fn resolve_book_of_wisdom_selection(
    state: &mut GameState,
    player_idx: usize,
    pending: &mk_types::pending::PendingBookOfWisdom,
    selected_id: &CardId,
) {
    match pending.mode {
        mk_types::pending::EffectMode::Basic => {
            // Remove AA from offer, add to player's discard
            if let Some(idx) = state.offers.advanced_actions.iter().position(|id| id == selected_id) {
                state.offers.advanced_actions.remove(idx);
                effect_queue::replenish_aa_offer(state);
            }
            state.players[player_idx].discard.push(selected_id.clone());
        }
        mk_types::pending::EffectMode::Powered => {
            // Remove spell from offer, add to top of player's deck
            if let Some(idx) = state.offers.spells.iter().position(|id| id == selected_id) {
                state.offers.spells.remove(idx);
                effect_queue::replenish_spell_offer(state);
            }
            state.players[player_idx].deck.insert(0, selected_id.clone());
            // Powered mode also grants a crystal of the discarded card's color
            if let Some(color) = pending.thrown_card_color {
                mana::gain_crystal(&mut state.players[player_idx], color);
            }
        }
    }
}


pub(super) fn apply_resolve_tome_of_all_spells(
    state: &mut GameState,
    player_idx: usize,
    selection_index: usize,
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
            if selection_index >= state.players[player_idx].hand.len() {
                return Err(ApplyError::InternalError(
                    "ResolveTomeOfAllSpells: selection_index out of range".to_string(),
                ));
            }
            let card_id = state.players[player_idx].hand.remove(selection_index);
            let card_color = mk_data::cards::get_card_color(card_id.as_str());

            // Move discarded card to discard
            state.players[player_idx].discard.push(card_id);

            // Find matching-color spells in offer
            let available_spells: Vec<mk_types::ids::CardId> = state.offers.spells.iter()
                .filter(|spell_id| {
                    mk_data::cards::get_card_color(spell_id.as_str()) == card_color
                })
                .cloned()
                .collect();

            if available_spells.is_empty() {
                // No matching spells — resolve without offer phase
                return Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: vec![] });
            }

            // Transition to SelectSpell phase
            state.players[player_idx].pending.active =
                Some(ActivePending::TomeOfAllSpells(mk_types::pending::PendingTomeOfAllSpells {
                    source_card_id: pending.source_card_id,
                    mode: pending.mode,
                    phase: TomeOfAllSpellsPhase::SelectSpell,
                    discarded_color: card_color,
                    available_spells,
                }));
            Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: vec![] })
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
                let mut queue = effect_queue::EffectQueue::new();
                queue.push(effect, Some(spell_id.clone()));
                queue.drain(state, player_idx);
            }

            Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: vec![] })
        }
    }
}


pub(super) fn apply_resolve_circlet_of_proficiency(
    state: &mut GameState,
    player_idx: usize,
    selection_index: usize,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::ActivePending;

    let pending = match state.players[player_idx].pending.active.take() {
        Some(ActivePending::CircletOfProficiency(c)) => c,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "ResolveCircletOfProficiency: no active CircletOfProficiency pending".to_string(),
            ));
        }
    };

    if selection_index >= pending.available_skills.len() {
        return Err(ApplyError::InternalError(
            "ResolveCircletOfProficiency: selection_index out of range".to_string(),
        ));
    }

    let skill_id = &pending.available_skills[selection_index];

    match pending.mode {
        mk_types::pending::EffectMode::Basic => {
            // One-shot use: resolve the skill's effect through the queue
            if let Some(def) = mk_data::skills::get_skill(skill_id.as_str()) {
                if let Some(effect) = def.effect {
                    let mut queue = effect_queue::EffectQueue::new();
                    queue.push(effect, None);
                    queue.drain(state, player_idx);
                }
            }
        }
        mk_types::pending::EffectMode::Powered => {
            // Permanent acquisition: add skill to player, remove from common pool
            let skill_id_clone = skill_id.clone();
            if let Some(pos) = state.offers.common_skills.iter().position(|s| s == skill_id) {
                state.offers.common_skills.remove(pos);
            }
            state.players[player_idx].skills.push(skill_id_clone.clone());

            // Apply passive modifiers if the skill has any
            skills::push_passive_skill_modifiers(state, player_idx, &skill_id_clone);
        }
    }

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: vec![] })
}


pub(super) fn apply_resolve_maximal_effect(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::ActivePending;

    let pending = match state.players[player_idx].pending.active.take() {
        Some(ActivePending::MaximalEffect(m)) => m,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "ResolveMaximalEffect: no active MaximalEffect pending".to_string(),
            ));
        }
    };

    let player = &mut state.players[player_idx];
    if hand_index >= player.hand.len() {
        player.pending.active = Some(ActivePending::MaximalEffect(pending));
        return Err(ApplyError::InternalError(
            "ResolveMaximalEffect: hand index out of range".to_string(),
        ));
    }

    // Remove the selected card from hand
    let card_id = player.hand.remove(hand_index);
    player.removed_cards.push(card_id.clone());

    // Get the card's effect
    let card_def = mk_data::cards::get_card(card_id.as_str())
        .ok_or_else(|| ApplyError::InternalError(format!(
            "ResolveMaximalEffect: card {} not found", card_id.as_str()
        )))?;
    let effect = match pending.effect_kind {
        mk_types::pending::EffectMode::Basic => card_def.basic_effect.clone(),
        mk_types::pending::EffectMode::Powered => card_def.powered_effect.clone(),
    };

    // Resolve the effect multiplied times
    let mut queue = effect_queue::EffectQueue::new();
    for _ in 0..pending.multiplier {
        queue.push(effect.clone(), Some(card_id.clone()));
    }

    match queue.drain(state, player_idx) {
        effect_queue::DrainResult::Complete => {
            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: Vec::new(),
            })
        }
        effect_queue::DrainResult::NeedsChoice { options, continuation, resolution } => {
            let cont_entries: Vec<mk_types::pending::ContinuationEntry> = continuation
                .into_iter()
                .map(|qe| mk_types::pending::ContinuationEntry {
                    effect: qe.effect,
                    source_card_id: qe.source_card_id,
                })
                .collect();
            state.players[player_idx].pending.active = Some(ActivePending::Choice(
                mk_types::pending::PendingChoice {
                    card_id: Some(card_id),
                    skill_id: None,
                    unit_instance_id: None,
                    options,
                    continuation: cont_entries,
                    resolution,
                    movement_bonus_applied: false,
                },
            ));
            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: Vec::new(),
            })
        }
        effect_queue::DrainResult::PendingSet => {
            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: Vec::new(),
            })
        }
    }
}


pub(super) fn apply_resolve_meditation(
    state: &mut GameState,
    player_idx: usize,
    selection_index: usize,
    place_on_top: Option<bool>,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{ActivePending, MeditationPhase};

    let pending = match state.players[player_idx].pending.active.take() {
        Some(ActivePending::Meditation(m)) => m,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "ResolveMeditation: no active Meditation pending".to_string(),
            ));
        }
    };

    match pending.phase {
        MeditationPhase::SelectCards => {
            // Powered: add a card from discard to selection
            let player = &state.players[player_idx];
            if selection_index >= player.discard.len() {
                state.players[player_idx].pending.active =
                    Some(ActivePending::Meditation(pending));
                return Err(ApplyError::InternalError(
                    "ResolveMeditation: discard index out of range".to_string(),
                ));
            }
            let card_id = player.discard[selection_index].clone();
            let mut new_pending = pending;
            new_pending.selected_card_ids.push(card_id);

            // If we've selected 3, auto-transition to PlaceCards
            if new_pending.selected_card_ids.len() >= 3 {
                new_pending.phase = MeditationPhase::PlaceCards;
            }
            state.players[player_idx].pending.active =
                Some(ActivePending::Meditation(new_pending));
        }
        MeditationPhase::PlaceCards => {
            // Place the first selected card on top or bottom of deck
            let on_top = place_on_top.unwrap_or(true);
            let mut new_pending = pending;
            let card_id = new_pending.selected_card_ids.remove(0);

            // Remove from discard
            let player = &mut state.players[player_idx];
            if let Some(pos) = player.discard.iter().position(|c| c == &card_id) {
                player.discard.remove(pos);
            }

            // Place on deck
            if on_top {
                player.deck.push(card_id);
            } else {
                player.deck.insert(0, card_id);
            }

            // If more cards to place, keep pending
            if new_pending.selected_card_ids.is_empty() {
                // All cards placed — apply meditation bonus
                player.meditation_hand_limit_bonus =
                    player.meditation_hand_limit_bonus.saturating_add(1);
                // Clear pending
            } else {
                state.players[player_idx].pending.active =
                    Some(ActivePending::Meditation(new_pending));
            }
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_meditation_done_selecting(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{ActivePending, MeditationPhase};

    let pending = match state.players[player_idx].pending.active.take() {
        Some(ActivePending::Meditation(m)) => m,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "MeditationDoneSelecting: no active Meditation pending".to_string(),
            ));
        }
    };

    if pending.selected_card_ids.is_empty() {
        // Nothing selected — clear pending
        return Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: Vec::new(),
        });
    }

    // Transition to PlaceCards phase
    let mut new_pending = pending;
    new_pending.phase = MeditationPhase::PlaceCards;
    state.players[player_idx].pending.active =
        Some(ActivePending::Meditation(new_pending));

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_resolve_decompose(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
) -> Result<ApplyResult, ApplyError> {
    effect_queue::resolve_decompose(state, player_idx, hand_index).map_err(|e| {
        ApplyError::InternalError(format!("resolve_decompose failed: {:?}", e))
    })?;
    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}



pub(super) fn apply_resolve_discard_for_bonus(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
    discard_count: usize,
) -> Result<ApplyResult, ApplyError> {
    effect_queue::resolve_discard_for_bonus(state, player_idx, choice_index, discard_count)
        .map_err(|e| {
            ApplyError::InternalError(format!("resolve_discard_for_bonus failed: {:?}", e))
        })?;
    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_choose_level_up_reward(
    state: &mut GameState,
    player_idx: usize,
    skill_index: usize,
    from_common_pool: bool,
    advanced_action_id: &CardId,
) -> Result<ApplyResult, ApplyError> {
    // 1. Extract the active PendingLevelUpReward
    let reward = match state.players[player_idx].pending.active.take() {
        Some(mk_types::pending::ActivePending::LevelUpReward(r)) => r,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "ChooseLevelUpReward: no active LevelUpReward pending".into(),
            ));
        }
    };

    // 2. Skill selection
    if from_common_pool {
        // Pick from common pool — add BOTH drawn skills back to common pool
        if skill_index >= state.offers.common_skills.len() {
            return Err(ApplyError::InternalError(format!(
                "ChooseLevelUpReward: common pool index {} out of range (len {})",
                skill_index,
                state.offers.common_skills.len()
            )));
        }
        let chosen_skill = state.offers.common_skills.remove(skill_index);
        state.players[player_idx].skills.push(chosen_skill.clone());
        // Push passive modifiers for the newly acquired skill
        skills::push_passive_skill_modifiers(state, player_idx, &chosen_skill);
        // Initialize Master of Chaos wheel position
        skills_interactive::init_master_of_chaos_if_needed(state, player_idx, &chosen_skill);
        // Return both drawn skills to common pool
        for skill in reward.drawn_skills.iter() {
            state.offers.common_skills.push(skill.clone());
        }
    } else {
        // Pick from drawn pair — add the OTHER skill to common pool
        if skill_index >= reward.drawn_skills.len() {
            return Err(ApplyError::InternalError(format!(
                "ChooseLevelUpReward: drawn skill index {} out of range (len {})",
                skill_index,
                reward.drawn_skills.len()
            )));
        }
        let chosen_skill = reward.drawn_skills[skill_index].clone();
        state.players[player_idx].skills.push(chosen_skill.clone());
        // Push passive modifiers for the newly acquired skill
        skills::push_passive_skill_modifiers(state, player_idx, &chosen_skill);
        // Initialize Master of Chaos wheel position
        skills_interactive::init_master_of_chaos_if_needed(state, player_idx, &chosen_skill);
        // Add unchosen drawn skills to common pool
        for (i, skill) in reward.drawn_skills.iter().enumerate() {
            if i != skill_index {
                state.offers.common_skills.push(skill.clone());
            }
        }
    }

    // 3. AA selection — remove from offer, push to front of player's deck, replenish
    if let Some(offer_idx) = state
        .offers
        .advanced_actions
        .iter()
        .position(|a| a == advanced_action_id)
    {
        let aa = state.offers.advanced_actions.remove(offer_idx);
        state.players[player_idx].deck.insert(0, aa);
        // Replenish offer from deck
        if !state.decks.advanced_action_deck.is_empty() {
            let new_card = state.decks.advanced_action_deck.remove(0);
            state.offers.advanced_actions.insert(0, new_card);
        }
    }

    // 4. Check for more rewards — promote next from deferred
    if end_turn::promote_level_up_reward_pub(state, player_idx) {
        // More rewards to resolve
        return Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: Vec::new(),
        });
    }

    // 5. No more rewards — process card flow and advance turn
    end_turn::process_card_flow_pub(state, player_idx);
    let turn_result = end_turn::advance_turn_pub(state, player_idx);

    let game_ended = matches!(turn_result, end_turn::EndTurnResult::GameEnded);
    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended,
        events: Vec::new(),
    })
}


// end_turn, announce_end_of_round delegated to turn_flow module

pub(super) fn apply_resolve_crystal_joy_reclaim(
    state: &mut GameState,
    player_idx: usize,
    discard_index: Option<usize>,
) -> Result<ApplyResult, ApplyError> {
    // Clear pending
    state.players[player_idx].pending.active = None;

    if let Some(idx) = discard_index {
        // Move the selected card from discard to hand
        if idx < state.players[player_idx].discard.len() {
            let card = state.players[player_idx].discard.remove(idx);
            state.players[player_idx].hand.push(card);
        }
    }
    // Skip: no card moved

    // Resume end_turn flow
    turn_flow::end_turn_result_to_apply(end_turn::end_turn(state, player_idx), state)
}


pub(super) fn apply_resolve_steady_tempo(
    state: &mut GameState,
    player_idx: usize,
    place: bool,
) -> Result<ApplyResult, ApplyError> {
    // Extract pending to get version
    let version = match state.players[player_idx].pending.active.take() {
        Some(mk_types::pending::ActivePending::SteadyTempoDeckPlacement(p)) => p.version,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "ResolveSteadyTempo: no SteadyTempoDeckPlacement pending".into(),
            ));
        }
    };

    if place {
        // Remove steady_tempo from play_area and place on deck
        if let Some(idx) = state.players[player_idx]
            .play_area
            .iter()
            .position(|c| c.as_str() == "steady_tempo")
        {
            let card = state.players[player_idx].play_area.remove(idx);
            match version {
                mk_types::pending::EffectMode::Basic => {
                    // Bottom of deck
                    state.players[player_idx].deck.push(card);
                }
                mk_types::pending::EffectMode::Powered => {
                    // Top of deck
                    state.players[player_idx].deck.insert(0, card);
                }
            }
        }
    }
    // Skip: card stays in play_area, will be discarded normally in card flow

    // Resume end_turn flow
    turn_flow::end_turn_result_to_apply(end_turn::end_turn(state, player_idx), state)
}


pub(super) fn apply_resolve_banner_protection(
    state: &mut GameState,
    player_idx: usize,
    remove_all: bool,
) -> Result<ApplyResult, ApplyError> {
    // Clear pending
    state.players[player_idx].pending.active = None;

    if remove_all {
        let wounds = state.players[player_idx].wounds_received_this_turn;

        // Remove wounds from hand
        for _ in 0..wounds.hand {
            if let Some(idx) = state.players[player_idx]
                .hand
                .iter()
                .position(|c| c.as_str() == "wound")
            {
                state.players[player_idx].hand.remove(idx);
            }
        }

        // Remove wounds from discard
        for _ in 0..wounds.discard {
            if let Some(idx) = state.players[player_idx]
                .discard
                .iter()
                .position(|c| c.as_str() == "wound")
            {
                state.players[player_idx].discard.remove(idx);
            }
        }

        // Banner is destroyed after use — remove from play area
        // (Banner of Protection artifact card goes to removed_cards)
        if let Some(idx) = state.players[player_idx]
            .play_area
            .iter()
            .position(|c| c.as_str() == "banner_of_protection")
        {
            let card = state.players[player_idx].play_area.remove(idx);
            state.players[player_idx].removed_cards.push(card);
        }
    }

    // Resume end_turn flow
    turn_flow::end_turn_result_to_apply(end_turn::end_turn(state, player_idx), state)
}

