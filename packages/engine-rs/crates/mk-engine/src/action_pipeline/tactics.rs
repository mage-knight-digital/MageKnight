//! Tactic selection, decision resolution, subset selection, and activation.

use mk_data::tactics::tactic_turn_order;
use mk_types::enums::*;
use mk_types::ids::{CardId, CombatInstanceId, PlayerId};
use mk_types::legal_action::TacticDecisionData;
use mk_types::pending::{
    ActivePending, PendingTacticDecision,
    SubsetSelectionKind, SubsetSelectionState,
};
use mk_types::state::*;

use crate::mana;

use super::{ApplyError, ApplyResult};
use super::turn_flow;


// =============================================================================
// Action implementations
// =============================================================================

pub(super) fn apply_select_tactic(
    state: &mut GameState,
    player_idx: usize,
    tactic_id: &mk_types::ids::TacticId,
) -> Result<ApplyResult, ApplyError> {
    // Set player's tactic
    state.players[player_idx].selected_tactic = Some(tactic_id.clone());

    // Remove tactic from available list
    state.available_tactics.retain(|t| t != tactic_id);

    // Remove current player from selection order
    let current_player_id = state.players[player_idx].id.clone();
    state
        .tactics_selection_order
        .retain(|pid| *pid != current_player_id);

    // Check if more players need to select (multiplayer sequential selection)
    if !state.tactics_selection_order.is_empty() {
        // More players to pick — stay in TacticsSelection phase
        state.current_tactic_selector = state.tactics_selection_order.first().cloned();

        // On-pick tactic effects (applied immediately even if others haven't picked)
        apply_tactic_on_pick_effects(state, player_idx, tactic_id);

        return Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: Vec::new(),
        });
    }

    // All players have selected — transition to PlayerTurns

    // Auto-select dummy tactic if in solo mode
    if state.dummy_player.is_some()
        && state.scenario_config.dummy_tactic_order == DummyTacticOrder::AfterHumans
        && !state.available_tactics.is_empty()
    {
        let idx = state
            .rng
            .random_index(state.available_tactics.len())
            .expect("Available tactics should not be empty");
        let dummy_tactic = state.available_tactics.remove(idx);
        state.dummy_player_tactic = Some(dummy_tactic);
    }

    // Post-selection tactic removal (multiplayer)
    match state.scenario_config.tactic_removal_mode {
        TacticRemovalMode::RemoveTwo => {
            for _ in 0..2.min(state.available_tactics.len()) {
                if let Some(idx) = state.rng.random_index(state.available_tactics.len()) {
                    let removed = state.available_tactics.remove(idx);
                    state.removed_tactics.push(removed);
                }
            }
        }
        TacticRemovalMode::RemoveOne => {
            if let Some(idx) = state.rng.random_index(state.available_tactics.len()) {
                let removed = state.available_tactics.remove(idx);
                state.removed_tactics.push(removed);
            }
        }
        TacticRemovalMode::None | TacticRemovalMode::AllUsed | TacticRemovalMode::VoteOne => {}
    }

    // Advance to PlayerTurns phase
    state.round_phase = RoundPhase::PlayerTurns;
    state.current_tactic_selector = None;

    // Sort turn order by tactic number (lower goes first)
    // Dummy player uses its auto-selected tactic for sorting
    state.turn_order.sort_by_key(|pid| {
        if let Some(p) = state.players.iter().find(|p| p.id == *pid) {
            p.selected_tactic
                .as_ref()
                .and_then(|t| tactic_turn_order(t.as_str()))
                .unwrap_or(99)
        } else if crate::dummy_player::is_dummy_player(pid.as_str()) {
            state
                .dummy_player_tactic
                .as_ref()
                .and_then(|t| tactic_turn_order(t.as_str()))
                .unwrap_or(99)
        } else {
            99
        }
    });
    state.current_player_index = 0;

    // If dummy is first in turn order, auto-execute their first turn
    if crate::dummy_player::is_dummy_player(
        state.turn_order[state.current_player_index as usize].as_str(),
    ) {
        if let Some(ref mut dummy) = state.dummy_player {
            if crate::dummy_player::execute_dummy_turn(dummy).is_none() {
                state.end_of_round_announced_by =
                    Some(PlayerId::from(crate::dummy_player::DUMMY_PLAYER_ID));
                state.players_with_final_turn =
                    state.players.iter().map(|p| p.id.clone()).collect();
            }
        }
        state.current_player_index =
            (state.current_player_index + 1) % state.turn_order.len() as u32;
    }

    // On-pick tactic effects for the final selector
    apply_tactic_on_pick_effects(state, player_idx, tactic_id);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Apply immediate effects when a tactic is selected (e.g., Great Start draws cards).
pub(super) fn apply_tactic_on_pick_effects(
    state: &mut GameState,
    player_idx: usize,
    tactic_id: &mk_types::ids::TacticId,
) {
    let tid = tactic_id.as_str();
    match tid {
        "great_start" => {
            // Draw 2 cards immediately
            let player = &mut state.players[player_idx];
            let draw_count = 2.min(player.deck.len());
            for _ in 0..draw_count {
                let card = player.deck.remove(0);
                player.hand.push(card);
            }
        }
        "rethink" => {
            let hand_len = state.players[player_idx].hand.len();
            if hand_len > 0 {
                state.players[player_idx].pending.active =
                    Some(ActivePending::SubsetSelection(SubsetSelectionState {
                        kind: SubsetSelectionKind::Rethink,
                        pool_size: hand_len,
                        max_selections: 3.min(hand_len),
                        min_selections: 0,
                        selected: Vec::new(),
                    }));
            }
        }
        "mana_steal" => {
            let current_player_id = &state.players[player_idx].id;
            // Available: unclaimed basic dice OR basic dice claimed by other players
            let has_available = state.source.dice.iter().any(|d| {
                !d.is_depleted
                    && d.color.is_basic()
                    && (d.taken_by_player_id.is_none()
                        || d.taken_by_player_id.as_ref().is_some_and(|owner| owner != current_player_id))
            });
            if has_available {
                state.players[player_idx].pending.active =
                    Some(ActivePending::TacticDecision(PendingTacticDecision::ManaSteal));
            }
        }
        "preparation" => {
            let deck_snapshot: Vec<CardId> = state.players[player_idx].deck.clone();
            if !deck_snapshot.is_empty() {
                state.players[player_idx].pending.active =
                    Some(ActivePending::TacticDecision(PendingTacticDecision::Preparation {
                        deck_snapshot,
                    }));
            }
        }
        _ => {} // Other tactics: no on-pick effect
    }
}


// =============================================================================
// Tactic decision resolution
// =============================================================================

pub(super) fn apply_resolve_tactic_decision(
    state: &mut GameState,
    player_idx: usize,
    data: &TacticDecisionData,
) -> Result<ApplyResult, ApplyError> {
    match data {
        TacticDecisionData::ManaSteal { die_index } => {
            if *die_index >= state.source.dice.len() {
                return Err(ApplyError::InternalError("ManaSteal: invalid die index".into()));
            }

            let die = &mut state.source.dice[*die_index];
            let die_id = die.id.clone();
            let color = die.color;

            // If stealing from another player, clear their stored_mana_die
            if let Some(ref prev_owner_id) = die.taken_by_player_id {
                if let Some(prev_owner) = state.players.iter_mut().find(|p| &p.id == prev_owner_id) {
                    prev_owner.tactic_state.stored_mana_die = None;
                }
            }

            die.taken_by_player_id = Some(state.players[player_idx].id.clone());

            // Store the stolen die reference
            state.players[player_idx].tactic_state.stored_mana_die = Some(StoredManaDie {
                die_id,
                color,
            });

            // Clear pending
            state.players[player_idx].pending.active = None;
        }

        TacticDecisionData::Preparation { deck_card_index } => {
            // Validate against actual deck (not snapshot — snapshot was for enumeration)
            let player = &mut state.players[player_idx];

            // Use the pending to get the snapshot card
            let card_id = if let Some(ActivePending::TacticDecision(PendingTacticDecision::Preparation { deck_snapshot })) = &player.pending.active {
                deck_snapshot.get(*deck_card_index).cloned()
            } else {
                None
            };

            let card_id = card_id.ok_or_else(|| {
                ApplyError::InternalError("Preparation: invalid deck card index".into())
            })?;

            // Remove first occurrence from actual deck
            if let Some(pos) = player.deck.iter().position(|c| *c == card_id) {
                player.deck.remove(pos);
                player.hand.push(card_id);
            }

            // Shuffle remaining deck
            let deck = &mut state.players[player_idx].deck;
            state.rng.shuffle(deck);

            // Clear pending
            state.players[player_idx].pending.active = None;
        }

        TacticDecisionData::SparingPowerStash => {
            let player = &mut state.players[player_idx];
            if !player.deck.is_empty() {
                let card = player.deck.remove(0);
                player.tactic_state.sparing_power_stored.push(card);
            }
            player.pending.active = None;
            player.flags.remove(PlayerFlags::BEFORE_TURN_TACTIC_PENDING);
        }

        TacticDecisionData::SparingPowerTake => {
            let player = &mut state.players[player_idx];
            let stored: Vec<CardId> = player.tactic_state.sparing_power_stored.drain(..).collect();
            player.hand.extend(stored);
            player.flags.insert(PlayerFlags::TACTIC_FLIPPED);
            player.pending.active = None;
            player.flags.remove(PlayerFlags::BEFORE_TURN_TACTIC_PENDING);
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


// =============================================================================
// Subset selection (auto-regressive)
// =============================================================================

pub(super) fn apply_subset_select(
    state: &mut GameState,
    player_idx: usize,
    index: usize,
) -> Result<ApplyResult, ApplyError> {
    let ss = match &mut state.players[player_idx].pending.active {
        Some(ActivePending::SubsetSelection(ss)) => ss,
        _ => {
            return Err(ApplyError::InternalError(
                "SubsetSelect: no active SubsetSelection".into(),
            ))
        }
    };

    if index >= ss.pool_size || ss.selected.contains(&index) {
        return Err(ApplyError::InternalError(format!(
            "SubsetSelect: invalid or duplicate index {index}"
        )));
    }

    ss.selected.push(index);
    ss.selected.sort_unstable();

    // Auto-confirm if we've hit the max — but NOT for AttackTargets (needs sufficiency check)
    let should_auto_confirm = ss.selected.len() >= ss.max_selections
        && !matches!(ss.kind, SubsetSelectionKind::AttackTargets { .. });
    if should_auto_confirm {
        return finalize_subset_selection(state, player_idx);
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_subset_confirm(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let min_ok = match &state.players[player_idx].pending.active {
        Some(ActivePending::SubsetSelection(ss)) => ss.selected.len() >= ss.min_selections,
        _ => false,
    };

    if !min_ok {
        return Err(ApplyError::InternalError(
            "SubsetConfirm: no active SubsetSelection or min not met".into(),
        ));
    }

    finalize_subset_selection(state, player_idx)
}


pub(super) fn finalize_subset_selection(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let ss = match state.players[player_idx].pending.active.take() {
        Some(ActivePending::SubsetSelection(ss)) => ss,
        other => {
            // Put it back and error
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError(
                "finalize_subset_selection: no active SubsetSelection".into(),
            ));
        }
    };

    match ss.kind {
        SubsetSelectionKind::Rethink | SubsetSelectionKind::MidnightMeditation => {
            let player = &mut state.players[player_idx];

            // Remove cards at selected indices (sort descending to preserve indices)
            let mut sorted_indices: Vec<usize> = ss.selected.to_vec();
            sorted_indices.sort_unstable_by(|a, b| b.cmp(a));

            let mut removed: Vec<CardId> = Vec::new();
            for &idx in &sorted_indices {
                if idx < player.hand.len() {
                    removed.push(player.hand.remove(idx));
                }
            }
            let draw_count = removed.len();

            // Pool = removed + deck + discard
            let mut pool: Vec<CardId> = Vec::new();
            pool.extend(removed);
            pool.append(&mut player.deck);
            pool.append(&mut player.discard);

            // Shuffle pool
            state.rng.shuffle(&mut pool);

            // Draw same count back
            let player = &mut state.players[player_idx];
            let actual_draw = draw_count.min(pool.len());
            for _ in 0..actual_draw {
                player.hand.push(pool.remove(0));
            }

            // Remaining → deck
            player.deck = pool;
            player.discard.clear();
        }
        SubsetSelectionKind::ManaSearch {
            rerollable_die_indices,
        } => {
            // Map selected pool indices → actual die indices, then reroll
            let time_of_day = state.time_of_day;
            for &pool_idx in ss.selected.iter() {
                let die_idx = rerollable_die_indices[pool_idx];
                let die_id = state.source.dice[die_idx].id.clone();
                mana::reroll_die(&mut state.source, &die_id, time_of_day, &mut state.rng);
            }
            state.players[player_idx].tactic_state.mana_search_used_this_turn = true;
        }
        SubsetSelectionKind::AttackTargets {
            attack_type,
            eligible_instance_ids,
        } => {
            // Map selected pool indices → actual instance IDs and store on CombatState.
            // Resolution happens later via ResolveAttack (rules: declare first, then play cards).
            let target_ids: Vec<CombatInstanceId> = ss
                .selected
                .iter()
                .map(|&pool_idx| eligible_instance_ids[pool_idx].clone())
                .collect();

            let combat = state
                .combat
                .as_mut()
                .ok_or_else(|| super::ApplyError::InternalError(
                    "AttackTargets: no combat".into(),
                ))?;
            combat.declared_attack_targets = Some(target_ids);
            combat.declared_attack_type = Some(attack_type);
        }
        SubsetSelectionKind::RestWoundDiscard { wound_hand_indices } => {
            // Discard selected wounds (reverse order to preserve indices).
            let mut sorted: Vec<usize> = ss
                .selected
                .iter()
                .map(|&pool_idx| wound_hand_indices[pool_idx])
                .collect();
            sorted.sort_unstable_by(|a, b| b.cmp(a));

            let player = &mut state.players[player_idx];
            for &hand_idx in &sorted {
                let wound = player.hand.remove(hand_idx);
                player.discard.push(wound);
            }

            // Finish rest.
            turn_flow::finish_rest(state, player_idx);
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


// =============================================================================
// Activate tactic
// =============================================================================

pub(super) fn apply_activate_tactic(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let tactic_id = state.players[player_idx]
        .selected_tactic
        .as_ref()
        .cloned()
        .ok_or_else(|| ApplyError::InternalError("ActivateTactic: no selected tactic".into()))?;

    state.players[player_idx].flags.insert(PlayerFlags::TACTIC_FLIPPED);

    match tactic_id.as_str() {
        "the_right_moment" => {
            state.players[player_idx].tactic_state.extra_turn_pending = true;
        }
        "long_night" => {
            // Shuffle discard pile
            let discard = &mut state.players[player_idx].discard;
            state.rng.shuffle(discard);
            // Move min(3, discard.len()) from discard to deck
            let player = &mut state.players[player_idx];
            let move_count = 3.min(player.discard.len());
            for _ in 0..move_count {
                let card = player.discard.remove(0);
                player.deck.push(card);
            }
        }
        "midnight_meditation" => {
            let hand_len = state.players[player_idx].hand.len();
            if hand_len > 0 {
                state.players[player_idx].pending.active =
                    Some(ActivePending::SubsetSelection(SubsetSelectionState {
                        kind: SubsetSelectionKind::MidnightMeditation,
                        pool_size: hand_len,
                        max_selections: 5.min(hand_len),
                        min_selections: 0,
                        selected: Vec::new(),
                    }));
            }
        }
        other => {
            return Err(ApplyError::InternalError(format!(
                "ActivateTactic: unhandled tactic '{}'", other
            )));
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


// =============================================================================
// Reroll source dice (Mana Search)
// =============================================================================

pub(super) fn apply_initiate_mana_search(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{SubsetSelectionKind, SubsetSelectionState};

    // Compute rerollable die indices
    let rerollable: Vec<usize> = state
        .source
        .dice
        .iter()
        .enumerate()
        .filter(|(_, d)| d.taken_by_player_id.is_none())
        .map(|(i, _)| i)
        .collect();

    if rerollable.is_empty() {
        return Err(ApplyError::InternalError(
            "InitiateManaSearch: no rerollable dice".into(),
        ));
    }

    let pool_size = rerollable.len();
    let max_selections = 2.min(pool_size); // Mana Search allows 1 or 2

    state.players[player_idx].pending.active =
        Some(ActivePending::SubsetSelection(SubsetSelectionState {
            kind: SubsetSelectionKind::ManaSearch {
                rerollable_die_indices: rerollable,
            },
            pool_size,
            max_selections,
            min_selections: 1,
            selected: Vec::new(),
        }));

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_initiate_attack(
    state: &mut GameState,
    player_idx: usize,
    attack_type: CombatType,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{SubsetSelectionKind, SubsetSelectionState};

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("InitiateAttack: no combat".into()))?;

    let player_id_str = state.players[player_idx].id.as_str().to_string();
    let eligible =
        crate::legal_actions::combat::eligible_attack_targets(combat, attack_type, &state.active_modifiers, Some(&player_id_str));

    if eligible.is_empty() {
        return Err(ApplyError::InternalError(
            "InitiateAttack: no eligible enemies".into(),
        ));
    }

    let pool_size = eligible.len();
    let eligible_ids: Vec<CombatInstanceId> = eligible.into_iter().collect();

    state.players[player_idx].pending.active =
        Some(ActivePending::SubsetSelection(SubsetSelectionState {
            kind: SubsetSelectionKind::AttackTargets {
                attack_type,
                eligible_instance_ids: eligible_ids,
            },
            pool_size,
            max_selections: pool_size, // Can target all
            min_selections: 1,
            selected: Vec::new(),
        }));

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}

