//! Choice resolution handlers (training, book of wisdom, tome, circlet, meditation, etc.).

use arrayvec::ArrayVec;
use mk_types::ids::CardId;
use mk_types::pending::ActivePending;
use mk_types::state::*;

use crate::undo::UndoStack;
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
    undo_stack: &mut UndoStack,
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
        return units::apply_resolve_select_enemy(state, player_idx, choice_index, undo_stack);
    }

    // Capture skill_id before resolving (pending is consumed)
    let skill_id_for_flip = if let Some(ActivePending::Choice(ref pc)) =
        state.players[player_idx].pending.active
    {
        pc.skill_id.clone()
    } else {
        None
    };

    effect_queue::resolve_pending_choice_with_undo(state, player_idx, choice_index, Some(undo_stack)).map_err(|e| {
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


pub(super) fn apply_resolve_circlet_of_proficiency(
    state: &mut GameState,
    player_idx: usize,
    selection_index: usize,
    undo_stack: &mut UndoStack,
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
                    queue.drain_with_undo(state, player_idx, Some(undo_stack));
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
    undo_stack: &mut UndoStack,
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

    match queue.drain_with_undo(state, player_idx, Some(undo_stack)) {
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
    undo_stack: &mut UndoStack,
) -> Result<ApplyResult, ApplyError> {
    effect_queue::resolve_decompose_with_undo(state, player_idx, hand_index, Some(undo_stack)).map_err(|e| {
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
    undo_stack: &mut UndoStack,
) -> Result<ApplyResult, ApplyError> {
    effect_queue::resolve_discard_for_bonus_with_undo(
        state,
        player_idx,
        choice_index,
        discard_count,
        Some(undo_stack),
    )
        .map_err(|e| {
            ApplyError::InternalError(format!("resolve_discard_for_bonus failed: {:?}", e))
        })?;
    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Step 1: Choose a skill from drawn pair or common pool.
/// If from common pool, the AA is auto-resolved (forced lowest position).
/// If from drawn pair, transitions to SelectAdvancedAction phase.
pub(super) fn apply_choose_level_up_skill(
    state: &mut GameState,
    player_idx: usize,
    skill_index: usize,
    from_common_pool: bool,
) -> Result<ApplyResult, ApplyError> {
    let reward = match state.players[player_idx].pending.active.take() {
        Some(mk_types::pending::ActivePending::LevelUpReward(r))
            if r.phase == mk_types::pending::LevelUpRewardPhase::SelectSkill => r,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "ChooseLevelUpSkill: no active LevelUpReward in SelectSkill phase".into(),
            ));
        }
    };

    if from_common_pool {
        // Pick from common pool — add BOTH drawn skills back to common pool
        if skill_index >= state.offers.common_skills.len() {
            return Err(ApplyError::InternalError(format!(
                "ChooseLevelUpSkill: common pool index {} out of range (len {})",
                skill_index,
                state.offers.common_skills.len()
            )));
        }
        let chosen_skill = state.offers.common_skills.remove(skill_index);
        state.players[player_idx].skills.push(chosen_skill.clone());
        skills::push_passive_skill_modifiers(state, player_idx, &chosen_skill);
        skills_interactive::init_master_of_chaos_if_needed(state, player_idx, &chosen_skill);
        for skill in reward.drawn_skills.iter() {
            state.offers.common_skills.push(skill.clone());
        }

        // Auto-resolve AA: forced lowest position
        let mut events = Vec::new();
        if let Some(aa) = state.offers.advanced_actions.pop() {
            events.push(mk_types::events::GameEvent::CardGained {
                player_id: state.players[player_idx].id.clone(),
                card_id: aa.clone(),
            });
            state.players[player_idx].deck.insert(0, aa);
            if !state.decks.advanced_action_deck.is_empty() {
                let new_card = state.decks.advanced_action_deck.remove(0);
                state.offers.advanced_actions.insert(0, new_card);
            }
        }

        // Done — check for more rewards or advance turn
        finish_level_up(state, player_idx, events)
    } else {
        // Pick from drawn pair — transition to SelectAdvancedAction phase
        if skill_index >= reward.drawn_skills.len() {
            return Err(ApplyError::InternalError(format!(
                "ChooseLevelUpSkill: drawn skill index {} out of range (len {})",
                skill_index,
                reward.drawn_skills.len()
            )));
        }
        let chosen_skill = reward.drawn_skills[skill_index].clone();
        state.players[player_idx].skills.push(chosen_skill.clone());
        skills::push_passive_skill_modifiers(state, player_idx, &chosen_skill);
        skills_interactive::init_master_of_chaos_if_needed(state, player_idx, &chosen_skill);
        // Add unchosen drawn skills to common pool
        for (i, skill) in reward.drawn_skills.iter().enumerate() {
            if i != skill_index {
                state.offers.common_skills.push(skill.clone());
            }
        }

        // Transition to AA selection phase
        state.players[player_idx].pending.active =
            Some(mk_types::pending::ActivePending::LevelUpReward(
                mk_types::pending::PendingLevelUpReward {
                    level: reward.level,
                    drawn_skills: ArrayVec::new(), // no longer needed
                    phase: mk_types::pending::LevelUpRewardPhase::SelectAdvancedAction,
                },
            ));

        Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: Vec::new(),
        })
    }
}

/// Step 2: Choose an AA from the offer (only when skill was from drawn pair).
pub(super) fn apply_choose_level_up_advanced_action(
    state: &mut GameState,
    player_idx: usize,
    advanced_action_id: &CardId,
) -> Result<ApplyResult, ApplyError> {
    // Validate we're in the right phase
    match state.players[player_idx].pending.active.take() {
        Some(mk_types::pending::ActivePending::LevelUpReward(r))
            if r.phase == mk_types::pending::LevelUpRewardPhase::SelectAdvancedAction => {}
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "ChooseLevelUpAdvancedAction: no active SelectAdvancedAction pending".into(),
            ));
        }
    }

    // Take the AA from the offer
    if let Some(offer_idx) = state
        .offers
        .advanced_actions
        .iter()
        .position(|a| a == advanced_action_id)
    {
        let aa = state.offers.advanced_actions.remove(offer_idx);
        state.players[player_idx].deck.insert(0, aa);
        if !state.decks.advanced_action_deck.is_empty() {
            let new_card = state.decks.advanced_action_deck.remove(0);
            state.offers.advanced_actions.insert(0, new_card);
        }
    }

    finish_level_up(state, player_idx, Vec::new())
}

/// Shared finish: check for more level-up rewards or advance turn.
fn finish_level_up(
    state: &mut GameState,
    player_idx: usize,
    events: Vec<mk_types::events::GameEvent>,
) -> Result<ApplyResult, ApplyError> {
    if end_turn::promote_level_up_reward_pub(state, player_idx) {
        return Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events,
        });
    }

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

pub(super) fn apply_resolve_card_end_turn_effect(
    state: &mut GameState,
    player_idx: usize,
    decision: mk_types::legal_action::CardEndTurnDecision,
) -> Result<ApplyResult, ApplyError> {
    // Extract the pending card effect.
    let version = match state.players[player_idx].pending.active.take() {
        Some(ActivePending::CardEndTurnEffect(p)) => p,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "ResolveCardEndTurnEffect: no card end-turn effect pending".into(),
            ));
        }
    };

    use mk_types::effect::CardEndTurnEffect;
    use mk_types::legal_action::CardEndTurnDecision;

    let resolution = match (version.effect, decision) {
        (
            CardEndTurnEffect::OfferDiscardReclaim { allow_wounds },
            CardEndTurnDecision::SelectDiscard { discard_index },
        ) => {
            if let Some(idx) = discard_index {
                let player = &mut state.players[player_idx];
                let eligible = player.discard.get(idx).is_some_and(|card| {
                    allow_wounds || card.as_str() != crate::effect_queue::WOUND_CARD_ID
                });
                if !eligible {
                    player.pending.active = Some(ActivePending::CardEndTurnEffect(version));
                    return Err(ApplyError::InternalError(
                        "ResolveCardEndTurnEffect: selected discard card is not eligible".into(),
                    ));
                }
                let card = player.discard.remove(idx);
                player.hand.push(card);
            }
            Ok(())
        }
        (CardEndTurnEffect::OfferDiscardReclaim { .. }, CardEndTurnDecision::Skip) => Ok(()),
        (
            CardEndTurnEffect::OfferDeckPlacement {
                destination,
                requires_non_empty_deck,
            },
            CardEndTurnDecision::Accept,
        ) => {
            let player = &mut state.players[player_idx];
            if requires_non_empty_deck && player.deck.is_empty() {
                player.pending.active = Some(ActivePending::CardEndTurnEffect(version));
                return Err(ApplyError::InternalError(
                    "ResolveCardEndTurnEffect: deck placement requires a non-empty deck".into(),
                ));
            }
            let Some(idx) = player
                .play_area
                .iter()
                .position(|card| card == &version.source_card_id)
            else {
                player.pending.active = Some(ActivePending::CardEndTurnEffect(version));
                return Err(ApplyError::InternalError(
                    "ResolveCardEndTurnEffect: source card is not in the play area".into(),
                ));
            };
            let card = player.play_area.remove(idx);
            match destination {
                mk_types::effect::CardDeckPosition::Top => player.deck.insert(0, card),
                mk_types::effect::CardDeckPosition::Bottom => player.deck.push(card),
            }
            Ok(())
        }
        (CardEndTurnEffect::OfferDeckPlacement { .. }, CardEndTurnDecision::Skip) => Ok(()),
        _ => {
            state.players[player_idx].pending.active = Some(ActivePending::CardEndTurnEffect(version));
            return Err(ApplyError::InternalError(
                "ResolveCardEndTurnEffect: decision does not match the pending effect".into(),
            ));
        }
    };
    resolution?;

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

