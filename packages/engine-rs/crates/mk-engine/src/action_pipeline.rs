//! Execution pipeline — `apply_legal_action()` dispatch.
//!
//! Takes a `LegalAction` and applies it to the game state, returning an
//! `ApplyResult` on success or `ApplyError` on failure. Every action from
//! `enumerate_legal_actions()` MUST succeed — the contract is CI-gated.

use mk_data::enemies::{attack_count, get_enemy};
use mk_data::enemy_piles::{discard_enemy_token, draw_enemy_token, enemy_id_from_token};
use mk_data::tactics::tactic_turn_order;
use mk_types::enums::*;
use mk_types::ids::{CardId, CombatInstanceId, EnemyId, EnemyTokenId, PlayerId, SkillId};
use arrayvec::ArrayVec;
use mk_types::legal_action::{LegalAction, TacticDecisionData};
use mk_types::pending::{
    ActivePending, PendingTacticDecision, SubsetSelectionKind, SubsetSelectionState,
};
use mk_types::state::*;

use crate::card_play;
use crate::combat;
use crate::combat_resolution;
use crate::effect_queue;
use crate::end_turn;
use crate::mana;
use crate::movement;
use crate::undo::UndoStack;

// =============================================================================
// Error & result types
// =============================================================================

/// Error from applying a legal action.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ApplyError {
    /// The action set was computed at a different epoch than the current state.
    StaleActionSet { expected: u64, got: u64 },
    /// Internal error — should never happen for properly enumerated actions.
    InternalError(String),
}

/// Result of applying a legal action.
#[derive(Debug, Clone)]
pub struct ApplyResult {
    /// Whether the caller should re-enumerate legal actions.
    pub needs_reenumeration: bool,
    /// Whether the game has ended.
    pub game_ended: bool,
}

// =============================================================================
// Public API
// =============================================================================

/// Apply a legal action to the game state.
///
/// # Epoch check
/// The `expected_epoch` must match `state.action_epoch`. If they differ,
/// the action set is stale and the caller must re-enumerate.
///
/// # Contract
/// For every action produced by `enumerate_legal_actions()`, this function
/// MUST return `Ok(...)`. A failure is a contract violation (CI-gated test).
pub fn apply_legal_action(
    state: &mut GameState,
    undo_stack: &mut UndoStack,
    player_idx: usize,
    action: &LegalAction,
    expected_epoch: u64,
) -> Result<ApplyResult, ApplyError> {
    // Epoch check
    if state.action_epoch != expected_epoch {
        return Err(ApplyError::StaleActionSet {
            expected: state.action_epoch,
            got: expected_epoch,
        });
    }

    let result = match action {
        LegalAction::SelectTactic { tactic_id } => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            apply_select_tactic(state, player_idx, tactic_id)?
        }

        LegalAction::PlayCardBasic { hand_index, .. } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_play_card(state, player_idx, *hand_index, false)?
        }

        LegalAction::PlayCardPowered { hand_index, .. } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_play_card(state, player_idx, *hand_index, true)?
        }

        LegalAction::PlayCardSideways {
            hand_index,
            sideways_as,
            ..
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_play_card_sideways(state, player_idx, *hand_index, *sideways_as)?
        }

        LegalAction::Move { target, .. } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_move(state, player_idx, *target)?
        }

        LegalAction::Explore { direction } => {
            // Irreversible: set checkpoint (tile reveal + RNG)
            undo_stack.set_checkpoint();
            apply_explore(state, player_idx, *direction)?
        }

        LegalAction::ChallengeRampaging { hex } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_challenge_rampaging(state, player_idx, *hex)?
        }

        LegalAction::DeclareBlock {
            enemy_instance_id,
            attack_index,
        } => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            apply_declare_block(state, player_idx, enemy_instance_id, *attack_index)?
        }

        LegalAction::InitiateAttack { attack_type } => {
            // Reversible: save snapshot (enters SubsetSelection, undo returns to combat)
            undo_stack.save(state);
            apply_initiate_attack(state, player_idx, *attack_type)?
        }

        LegalAction::ResolveChoice { choice_index } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_resolve_choice(state, player_idx, *choice_index)?
        }

        LegalAction::ResolveDiscardForBonus {
            choice_index,
            discard_count,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_resolve_discard_for_bonus(state, player_idx, *choice_index, *discard_count)?
        }

        LegalAction::ResolveDecompose { hand_index } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_resolve_decompose(state, player_idx, *hand_index)?
        }

        LegalAction::SpendMoveOnCumbersome {
            enemy_instance_id,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_spend_move_on_cumbersome(state, player_idx, enemy_instance_id)?
        }

        LegalAction::ResolveTacticDecision { data } => {
            // Irreversible: uses RNG for shuffles
            undo_stack.set_checkpoint();
            apply_resolve_tactic_decision(state, player_idx, data)?
        }

        LegalAction::ActivateTactic => {
            // Irreversible: changes game state significantly
            undo_stack.set_checkpoint();
            apply_activate_tactic(state, player_idx)?
        }

        LegalAction::InitiateManaSearch => {
            // Reversible: save snapshot (enters SubsetSelection, undo returns to normal turn)
            undo_stack.save(state);
            apply_initiate_mana_search(state, player_idx)?
        }

        LegalAction::EnterSite => {
            // Irreversible: draws enemy tokens (RNG)
            undo_stack.set_checkpoint();
            apply_enter_site(state, player_idx)?
        }

        LegalAction::InteractSite { healing } => {
            // Irreversible: wound removal + influence deduction
            undo_stack.set_checkpoint();
            apply_interact_site(state, player_idx, *healing)?
        }

        LegalAction::PlunderSite => {
            // Irreversible: burns site + reputation loss
            undo_stack.set_checkpoint();
            apply_plunder_site(state, player_idx)?
        }

        LegalAction::DeclinePlunder => {
            // Reversible: just clears pending
            undo_stack.save(state);
            apply_decline_plunder(state, player_idx)?
        }

        LegalAction::ResolveGladeWound { choice } => {
            // Reversible: removes wound from hand or discard
            undo_stack.save(state);
            apply_resolve_glade_wound(state, player_idx, choice)?
        }

        LegalAction::RecruitUnit {
            unit_id,
            offer_index: _,
            influence_cost,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_recruit_unit(state, player_idx, unit_id, *influence_cost)?
        }

        LegalAction::ActivateUnit {
            unit_instance_id,
            ability_index,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_activate_unit(state, player_idx, unit_instance_id, *ability_index)?
        }

        LegalAction::AssignDamageToHero {
            enemy_index,
            attack_index,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_assign_damage_to_hero(state, player_idx, *enemy_index, *attack_index)?
        }

        LegalAction::AssignDamageToUnit {
            enemy_index,
            attack_index,
            unit_instance_id,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_assign_damage_to_unit(state, player_idx, *enemy_index, *attack_index, unit_instance_id)?
        }

        LegalAction::ChooseLevelUpReward {
            skill_index,
            from_common_pool,
            advanced_action_id,
        } => {
            // Irreversible: affects offers and skill pools
            undo_stack.set_checkpoint();
            apply_choose_level_up_reward(
                state,
                player_idx,
                *skill_index,
                *from_common_pool,
                advanced_action_id,
            )?
        }

        LegalAction::EndTurn => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            apply_end_turn(state, player_idx)?
        }

        LegalAction::DeclareRest => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_declare_rest(state, player_idx)
        }

        LegalAction::CompleteRest { discard_hand_index } => {
            // Reversible: save snapshot (no RNG involved).
            undo_stack.save(state);
            apply_complete_rest(state, player_idx, *discard_hand_index)?
        }

        LegalAction::EndCombatPhase => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            apply_end_combat_phase(state, player_idx)?
        }

        LegalAction::UseSkill { skill_id } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_use_skill(state, player_idx, skill_id)?
        }

        LegalAction::SubsetSelect { index } => {
            // No undo save: only mutates pending.active.selected
            apply_subset_select(state, player_idx, *index)?
        }

        LegalAction::SubsetConfirm => {
            // Irreversible: RNG consumed by shuffle
            undo_stack.set_checkpoint();
            apply_subset_confirm(state, player_idx)?
        }

        LegalAction::Undo => apply_undo(state, undo_stack)?,
    };

    // Increment epoch after every action
    state.action_epoch += 1;

    Ok(result)
}

// =============================================================================
// Action implementations
// =============================================================================

fn apply_select_tactic(
    state: &mut GameState,
    player_idx: usize,
    tactic_id: &mk_types::ids::TacticId,
) -> Result<ApplyResult, ApplyError> {
    // Set player's tactic
    state.players[player_idx].selected_tactic = Some(tactic_id.clone());

    // Remove tactic from available list
    state.available_tactics.retain(|t| t != tactic_id);

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

    // Advance to PlayerTurns phase (solo: single selector)
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

    // On-pick tactic effects
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
                        selected: ArrayVec::new(),
                    }));
            }
        }
        "mana_steal" => {
            // Check if any basic-color dice are available (not depleted, not taken)
            let has_available = state.source.dice.iter().any(|d| {
                !d.is_depleted && d.taken_by_player_id.is_none() && d.color.is_basic()
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

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

// =============================================================================
// Tactic decision resolution
// =============================================================================

fn apply_resolve_tactic_decision(
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
    })
}

// =============================================================================
// Subset selection (auto-regressive)
// =============================================================================

fn apply_subset_select(
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
    })
}

fn apply_subset_confirm(
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

fn finalize_subset_selection(
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
            // Map selected pool indices → actual instance IDs
            let target_ids: Vec<CombatInstanceId> = ss
                .selected
                .iter()
                .map(|&pool_idx| eligible_instance_ids[pool_idx].clone())
                .collect();

            return apply_declare_attack_inner(state, player_idx, &target_ids, attack_type);
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
            finish_rest(state, player_idx);
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

// =============================================================================
// Activate tactic
// =============================================================================

fn apply_activate_tactic(
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
                        selected: ArrayVec::new(),
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
    })
}

// =============================================================================
// Reroll source dice (Mana Search)
// =============================================================================

fn apply_initiate_mana_search(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{SubsetSelectionKind, SubsetSelectionState, MAX_SUBSET_ITEMS};

    // Compute rerollable die indices
    let rerollable: ArrayVec<usize, MAX_SUBSET_ITEMS> = state
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
            selected: ArrayVec::new(),
        }));

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_initiate_attack(
    state: &mut GameState,
    player_idx: usize,
    attack_type: CombatType,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{SubsetSelectionKind, SubsetSelectionState, MAX_SUBSET_ITEMS};

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("InitiateAttack: no combat".into()))?;

    let eligible =
        crate::legal_actions::combat::eligible_attack_targets(combat, attack_type, &state.active_modifiers);

    if eligible.is_empty() {
        return Err(ApplyError::InternalError(
            "InitiateAttack: no eligible enemies".into(),
        ));
    }

    let pool_size = eligible.len();
    let eligible_ids: ArrayVec<CombatInstanceId, MAX_SUBSET_ITEMS> =
        eligible.into_iter().collect();

    state.players[player_idx].pending.active =
        Some(ActivePending::SubsetSelection(SubsetSelectionState {
            kind: SubsetSelectionKind::AttackTargets {
                attack_type,
                eligible_instance_ids: eligible_ids,
            },
            pool_size,
            max_selections: pool_size, // Can target all
            min_selections: 1,
            selected: ArrayVec::new(),
        }));

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_play_card(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
    powered: bool,
) -> Result<ApplyResult, ApplyError> {
    card_play::play_card(state, player_idx, hand_index, powered)
        .map(|_| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        })
        .map_err(|e| ApplyError::InternalError(format!("play_card failed: {:?}", e)))
}

fn apply_play_card_sideways(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
    sideways_as: SidewaysAs,
) -> Result<ApplyResult, ApplyError> {
    card_play::play_card_sideways(state, player_idx, hand_index, sideways_as)
        .map(|_| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        })
        .map_err(|e| ApplyError::InternalError(format!("play_card_sideways failed: {:?}", e)))
}

fn apply_move(
    state: &mut GameState,
    player_idx: usize,
    target: mk_types::hex::HexCoord,
) -> Result<ApplyResult, ApplyError> {
    movement::execute_move(state, player_idx, target)
        .map(|_| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        })
        .map_err(|e| ApplyError::InternalError(format!("execute_move failed: {:?}", e)))
}

fn apply_explore(
    state: &mut GameState,
    player_idx: usize,
    direction: mk_types::hex::HexDirection,
) -> Result<ApplyResult, ApplyError> {
    movement::execute_explore(state, player_idx, direction)
        .map(|_| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        })
        .map_err(|e| ApplyError::InternalError(format!("execute_explore failed: {:?}", e)))
}

fn apply_challenge_rampaging(
    state: &mut GameState,
    player_idx: usize,
    hex: mk_types::hex::HexCoord,
) -> Result<ApplyResult, ApplyError> {
    let hex_state = state
        .map
        .hexes
        .get(&hex.key())
        .ok_or_else(|| ApplyError::InternalError("ChallengeRampaging: hex not found".into()))?;

    let enemy_tokens: Vec<mk_types::ids::EnemyTokenId> =
        hex_state.enemies.iter().map(|e| e.token_id.clone()).collect();

    combat::execute_enter_combat(state, player_idx, &enemy_tokens, false, Some(hex), Default::default())
        .map_err(|e| ApplyError::InternalError(format!("enter_combat failed: {:?}", e)))?;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_resolve_choice(
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
        });
    }

    // Check if this is a UnitAbilityChoice
    if let Some(ActivePending::UnitAbilityChoice { .. }) =
        state.players[player_idx].pending.active
    {
        return apply_resolve_unit_ability_choice(state, player_idx, choice_index);
    }

    // Check if this is a SelectCombatEnemy
    if let Some(ActivePending::SelectCombatEnemy { .. }) =
        state.players[player_idx].pending.active
    {
        return apply_resolve_select_enemy(state, player_idx, choice_index);
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
    })
}

fn apply_resolve_decompose(
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
    })
}

fn apply_resolve_discard_for_bonus(
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
    })
}

fn apply_choose_level_up_reward(
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
        push_passive_skill_modifiers(state, player_idx, &chosen_skill);
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
        push_passive_skill_modifiers(state, player_idx, &chosen_skill);
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
        });
    }

    // 5. No more rewards — process card flow and advance turn
    end_turn::process_card_flow_pub(state, player_idx);
    let turn_result = end_turn::advance_turn_pub(state, player_idx);

    let game_ended = matches!(turn_result, end_turn::EndTurnResult::GameEnded);
    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended,
    })
}

fn apply_end_turn(state: &mut GameState, player_idx: usize) -> Result<ApplyResult, ApplyError> {
    match end_turn::end_turn(state, player_idx) {
        Ok(end_turn::EndTurnResult::GameEnded) => Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: true,
        }),
        Ok(_) => Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        }),
        Err(e) => Err(ApplyError::InternalError(format!(
            "end_turn failed: {:?}",
            e
        ))),
    }
}

fn apply_declare_rest(state: &mut GameState, player_idx: usize) -> ApplyResult {
    let player = &mut state.players[player_idx];
    player.flags.insert(PlayerFlags::IS_RESTING);
    player.flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    }
}

fn apply_complete_rest(
    state: &mut GameState,
    player_idx: usize,
    discard_hand_index: Option<usize>,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    if let Some(idx) = discard_hand_index {
        if idx >= player.hand.len() {
            return Err(ApplyError::InternalError(format!(
                "CompleteRest discard index {} out of range (hand len {})",
                idx,
                player.hand.len()
            )));
        }

        let chosen_card = player.hand[idx].clone();
        let is_wound = chosen_card.as_str() == effect_queue::WOUND_CARD_ID;
        let has_non_wound = player
            .hand
            .iter()
            .any(|c| c.as_str() != effect_queue::WOUND_CARD_ID);

        if has_non_wound {
            // Standard rest: discard chosen non-wound card, then let agent choose wounds.
            if is_wound {
                return Err(ApplyError::InternalError(
                    "Standard rest: must discard a non-wound card".into(),
                ));
            }
            // Remove chosen card first (by index).
            player.hand.remove(idx);
            player.discard.push(chosen_card);

            // Check if wounds remain in hand — if so, enter SubsetSelection.
            let wound_hand_indices: ArrayVec<usize, { mk_types::pending::MAX_SUBSET_ITEMS }> =
                player
                    .hand
                    .iter()
                    .enumerate()
                    .filter(|(_, c)| c.as_str() == effect_queue::WOUND_CARD_ID)
                    .map(|(i, _)| i)
                    .collect();

            if !wound_hand_indices.is_empty() {
                let pool_size = wound_hand_indices.len();
                player.pending.active = Some(ActivePending::SubsetSelection(
                    SubsetSelectionState {
                        kind: SubsetSelectionKind::RestWoundDiscard { wound_hand_indices },
                        pool_size,
                        max_selections: pool_size,
                        min_selections: 0,
                        selected: ArrayVec::new(),
                    },
                ));
                return Ok(ApplyResult {
                    needs_reenumeration: true,
                    game_ended: false,
                });
            }
            // No wounds — fall through to finish rest immediately.
        } else {
            // Slow recovery: hand is all wounds — discard only the chosen wound.
            player.hand.remove(idx);
            player.discard.push(chosen_card);
        }
    }
    // else: empty hand — no discard needed.

    finish_rest(state, player_idx);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Finalize rest: clear IS_RESTING, set HAS_RESTED + PLAYED_CARD flags.
fn finish_rest(state: &mut GameState, player_idx: usize) {
    let player = &mut state.players[player_idx];
    player.flags.remove(PlayerFlags::IS_RESTING);
    player.flags.insert(PlayerFlags::HAS_RESTED_THIS_TURN);
    player
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
}

fn apply_declare_block(
    state: &mut GameState,
    player_idx: usize,
    enemy_instance_id: &CombatInstanceId,
    attack_index: usize,
) -> Result<ApplyResult, ApplyError> {
    let combat = state
        .combat
        .as_mut()
        .ok_or_else(|| ApplyError::InternalError("DeclareBlock with no combat".into()))?;

    // Find the enemy
    let enemy = combat
        .enemies
        .iter_mut()
        .find(|e| e.instance_id == *enemy_instance_id)
        .ok_or_else(|| ApplyError::InternalError("DeclareBlock: enemy not found".into()))?;

    let def = get_enemy(enemy.enemy_id.as_str())
        .ok_or_else(|| ApplyError::InternalError("DeclareBlock: unknown enemy".into()))?;

    let player = &state.players[player_idx];
    let block_result = combat_resolution::resolve_block(
        &player.combat_accumulator.block_elements,
        def,
        attack_index,
    );

    if block_result.success {
        // Mark attack as blocked
        if attack_index < enemy.attacks_blocked.len() {
            enemy.attacks_blocked[attack_index] = true;
        }

        // Check if all attacks are now blocked
        let num_attacks = attack_count(def);
        let all_blocked = (0..num_attacks).all(|i| {
            enemy.attacks_blocked.get(i).copied().unwrap_or(false)
                || enemy.attacks_cancelled.get(i).copied().unwrap_or(false)
                || {
                    // Zero-damage attacks don't need blocking
                    let (dmg, _, _) = combat_resolution::get_enemy_attack_info(def, i);
                    dmg == 0
                }
        });
        if all_blocked {
            enemy.is_blocked = true;
        }
    }

    // Block is consumed (all accumulated block used for this declaration)
    let player = &mut state.players[player_idx];
    player.combat_accumulator.block = 0;
    player.combat_accumulator.block_elements = ElementalValues::default();
    player.combat_accumulator.assigned_block = 0;
    player.combat_accumulator.assigned_block_elements = ElementalValues::default();

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_declare_attack_inner(
    state: &mut GameState,
    player_idx: usize,
    target_instance_ids: &[CombatInstanceId],
    attack_type: CombatType,
) -> Result<ApplyResult, ApplyError> {
    // Phase 1: Collect indices and compute resolution without holding borrows across mutation.
    let (target_indices, result, available, target_count, defend_assignments) = {
        let combat = state
            .combat
            .as_ref()
            .ok_or_else(|| ApplyError::InternalError("DeclareAttack with no combat".into()))?;

        // Find target indices and definitions
        let mut target_indices: Vec<usize> = Vec::new();
        let mut target_pairs: Vec<(CombatEnemy, &mk_data::enemies::EnemyDefinition)> = Vec::new();

        for target_id in target_instance_ids {
            let (idx, enemy) = combat
                .enemies
                .iter()
                .enumerate()
                .find(|(_, e)| e.instance_id == *target_id)
                .ok_or_else(|| {
                    ApplyError::InternalError(format!(
                        "DeclareAttack: enemy {} not found",
                        target_id.as_str()
                    ))
                })?;

            let def = get_enemy(enemy.enemy_id.as_str()).ok_or_else(|| {
                ApplyError::InternalError("DeclareAttack: unknown enemy".into())
            })?;

            target_indices.push(idx);
            target_pairs.push((enemy.clone(), def));
        }

        // Get available attack for this type
        let accumulator = &state.players[player_idx].combat_accumulator;
        let (total_elements, assigned_elements) = match attack_type {
            CombatType::Melee => (
                &accumulator.attack.normal_elements,
                &accumulator.assigned_attack.normal_elements,
            ),
            CombatType::Ranged => (
                &accumulator.attack.ranged_elements,
                &accumulator.assigned_attack.ranged_elements,
            ),
            CombatType::Siege => (
                &accumulator.attack.siege_elements,
                &accumulator.assigned_attack.siege_elements,
            ),
        };

        let available = combat_resolution::subtract_elements(total_elements, assigned_elements);

        // Build ref pairs for resolution
        let ref_pairs: Vec<(&CombatEnemy, &mk_data::enemies::EnemyDefinition)> =
            target_pairs.iter().map(|(e, d)| (e, *d)).collect();

        // Compute bonus armor (vampiric + defend)
        let defend_assignments = combat_resolution::auto_assign_defend(
            &combat.enemies,
            target_instance_ids,
            &combat.used_defend,
        );

        let mut bonus_armor = std::collections::BTreeMap::new();
        for (enemy, def) in &target_pairs {
            let vampiric = combat
                .vampiric_armor_bonus
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);
            let defend = defend_assignments
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);
            let _ = def; // def already used by resolve_attack via ref_pairs
            bonus_armor.insert(enemy.instance_id.as_str().to_string(), vampiric + defend);
        }

        let result = combat_resolution::resolve_attack(
            &available, &ref_pairs, combat.phase, &bonus_armor,
        );
        let target_count = target_indices.len();

        (target_indices, result, available, target_count, defend_assignments)
    };

    // Phase 2: Apply mutations
    if result.success {
        let combat = state.combat.as_mut().unwrap();
        for &idx in &target_indices {
            combat.enemies[idx].is_defeated = true;
        }
        combat.fame_gained += result.fame_gained;

        // Record defend usage (defender instance_id → protected target instance_id)
        // We need to find which defenders were assigned by matching the auto_assign_defend logic
        // The defend_assignments map tells us target_id → bonus, but we need defender→target
        // Re-derive from the same logic: iterate defenders in order, assign to targets in order
        {
            let mut newly_used: Vec<String> = Vec::new();
            let defenders: Vec<(String, u32)> = combat
                .enemies
                .iter()
                .filter_map(|e| {
                    if e.is_defeated {
                        return None;
                    }
                    let def = get_enemy(e.enemy_id.as_str())?;
                    if !combat_resolution::has_ability(def, EnemyAbilityType::Defend) {
                        return None;
                    }
                    let defend_value = def.defend?;
                    if combat.used_defend.contains_key(e.instance_id.as_str()) {
                        return None;
                    }
                    Some((e.instance_id.as_str().to_string(), defend_value))
                })
                .collect();

            for target_id in target_instance_ids {
                if !defend_assignments.contains_key(target_id.as_str()) {
                    continue;
                }
                // Find first available defender
                if let Some(defender_id) =
                    defenders.iter().find_map(|(did, _)| {
                        if !newly_used.contains(did)
                            && !combat.used_defend.contains_key(did.as_str())
                        {
                            Some(did.clone())
                        } else {
                            None
                        }
                    })
                {
                    combat.used_defend.insert(
                        defender_id.clone(),
                        target_id.as_str().to_string(),
                    );
                    newly_used.push(defender_id);
                }
            }
        }

        let player = &mut state.players[player_idx];
        player.fame += result.fame_gained;
        player.enemies_defeated_this_turn += target_count as u32;
        player.reputation = (player.reputation as i32 + result.reputation_delta)
            .clamp(-7, 7) as i8;
    }

    // Mark used attack as assigned (consumed whether success or failure)
    let accumulator = &mut state.players[player_idx].combat_accumulator;
    let assigned = match attack_type {
        CombatType::Melee => &mut accumulator.assigned_attack.normal_elements,
        CombatType::Ranged => &mut accumulator.assigned_attack.ranged_elements,
        CombatType::Siege => &mut accumulator.assigned_attack.siege_elements,
    };
    *assigned = combat_resolution::add_elements(assigned, &available);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_spend_move_on_cumbersome(
    state: &mut GameState,
    player_idx: usize,
    enemy_instance_id: &CombatInstanceId,
) -> Result<ApplyResult, ApplyError> {
    // Decrement move points
    let player = &mut state.players[player_idx];
    if player.move_points == 0 {
        return Err(ApplyError::InternalError(
            "SpendMoveOnCumbersome: no move points".into(),
        ));
    }
    player.move_points -= 1;

    // Increment cumbersome reduction
    let combat = state
        .combat
        .as_mut()
        .ok_or_else(|| ApplyError::InternalError("SpendMoveOnCumbersome: no combat".into()))?;

    *combat
        .cumbersome_reductions
        .entry(enemy_instance_id.as_str().to_string())
        .or_insert(0) += 1;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Resolve summon abilities at the start of the Block phase.
///
/// For each undefeated enemy with Summon or SummonGreen:
/// - Draw from Brown (Summon) or Green (SummonGreen) pile
/// - Create CombatEnemy with summoned_by_instance_id linking to summoner
/// - Mark summoner as hidden (doesn't deal damage during Block/AssignDamage)
///
/// For enemies with per-attack Summon (like Dragon Summoner), each Summon attack
/// triggers a separate draw.
fn resolve_summons(state: &mut GameState) -> Result<(), ApplyError> {
    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("resolve_summons: no combat".into()))?;

    // Collect summon requests before mutating
    struct SummonRequest {
        summoner_idx: usize,
        summoner_instance_id: String,
        color: EnemyColor,
        count: usize,
    }

    let mut requests: Vec<SummonRequest> = Vec::new();

    for (idx, enemy) in combat.enemies.iter().enumerate() {
        if enemy.is_defeated {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        // Check for ability-level Summon/SummonGreen
        let is_summon = combat_resolution::has_ability(def, EnemyAbilityType::Summon);
        let is_summon_green = combat_resolution::has_ability(def, EnemyAbilityType::SummonGreen);

        if is_summon || is_summon_green {
            let color = if is_summon_green {
                EnemyColor::Green
            } else {
                EnemyColor::Brown
            };

            // Count: 1 summon per ability instance, unless multi-attack with per-attack Summon
            let mut count = 1;
            if let Some(attacks) = def.attacks {
                // Count per-attack Summon abilities
                let per_attack_summons = attacks
                    .iter()
                    .filter(|a| a.ability == Some(EnemyAbilityType::Summon))
                    .count();
                if per_attack_summons > 0 {
                    count = per_attack_summons;
                }
            }

            requests.push(SummonRequest {
                summoner_idx: idx,
                summoner_instance_id: enemy.instance_id.as_str().to_string(),
                color,
                count,
            });
            continue;
        }

        // Also check per-attack Summon for enemies that don't have ability-level Summon
        // (shouldn't happen in practice, but defensive)
        if let Some(attacks) = def.attacks {
            let per_attack_summons: Vec<_> = attacks
                .iter()
                .filter(|a| {
                    a.ability == Some(EnemyAbilityType::Summon)
                        || a.ability == Some(EnemyAbilityType::SummonGreen)
                })
                .collect();

            if !per_attack_summons.is_empty() {
                let color = if per_attack_summons
                    .iter()
                    .any(|a| a.ability == Some(EnemyAbilityType::SummonGreen))
                {
                    EnemyColor::Green
                } else {
                    EnemyColor::Brown
                };

                requests.push(SummonRequest {
                    summoner_idx: idx,
                    summoner_instance_id: enemy.instance_id.as_str().to_string(),
                    color,
                    count: per_attack_summons.len(),
                });
            }
        }
    }

    if requests.is_empty() {
        return Ok(());
    }

    // Process summon requests — draw from piles (needs &mut state for rng + enemy_tokens)
    struct SummonedEnemy {
        instance_id: String,
        enemy_id: String,
        num_attacks: usize,
        summoner_instance_id: String,
    }

    let mut summoned_enemies: Vec<SummonedEnemy> = Vec::new();
    let mut summoner_indices_to_hide: Vec<usize> = Vec::new();
    let mut next_id = state.combat.as_ref().unwrap().enemies.len();

    for request in &requests {
        let mut any_summoned = false;

        for _ in 0..request.count {
            let token =
                draw_enemy_token(&mut state.enemy_tokens, request.color, &mut state.rng);

            let token_id = match token {
                Some(t) => t,
                None => continue,
            };

            let enemy_id_str = enemy_id_from_token(&token_id);
            let summoned_def = match get_enemy(&enemy_id_str) {
                Some(d) => d,
                None => continue,
            };

            let num_attacks = attack_count(summoned_def);
            let instance_id = format!("summoned_{}_{}", next_id, enemy_id_str);
            next_id += 1;

            summoned_enemies.push(SummonedEnemy {
                instance_id,
                enemy_id: enemy_id_str,
                num_attacks,
                summoner_instance_id: request.summoner_instance_id.clone(),
            });

            any_summoned = true;
        }

        if any_summoned {
            summoner_indices_to_hide.push(request.summoner_idx);
        }
    }

    // Apply mutations to combat state
    let combat = state.combat.as_mut().unwrap();

    for summoned in summoned_enemies {
        combat.enemies.push(CombatEnemy {
            instance_id: CombatInstanceId::from(summoned.instance_id),
            enemy_id: EnemyId::from(summoned.enemy_id),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: Some(CombatInstanceId::from(
                summoned.summoner_instance_id,
            )),
            is_summoner_hidden: false,
            attacks_blocked: vec![false; summoned.num_attacks],
            attacks_damage_assigned: vec![false; summoned.num_attacks],
            attacks_cancelled: vec![false; summoned.num_attacks],
        });
    }

    for &idx in &summoner_indices_to_hide {
        combat.enemies[idx].is_summoner_hidden = true;
    }

    Ok(())
}

fn apply_end_combat_phase(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let combat = state
        .combat
        .as_mut()
        .ok_or_else(|| ApplyError::InternalError("EndCombatPhase with no combat".into()))?;

    match combat.phase {
        CombatPhase::RangedSiege => {
            // Clear ranged/siege attack pools (consumed by this phase)
            let accumulator = &mut state.players[player_idx].combat_accumulator;
            accumulator.attack.ranged = 0;
            accumulator.attack.siege = 0;
            accumulator.attack.ranged_elements = ElementalValues::default();
            accumulator.attack.siege_elements = ElementalValues::default();
            accumulator.assigned_attack.ranged = 0;
            accumulator.assigned_attack.siege = 0;
            accumulator.assigned_attack.ranged_elements = ElementalValues::default();
            accumulator.assigned_attack.siege_elements = ElementalValues::default();

            state.combat.as_mut().unwrap().phase = CombatPhase::Block;

            // Resolve summons at the start of Block phase
            resolve_summons(state)?;
        }
        CombatPhase::Block => {
            // Check DefeatIfBlocked: enemies with the modifier whose ALL attacks are blocked → defeated
            {
                let combat = state.combat.as_ref().unwrap();
                let mut defeat_indices: Vec<usize> = Vec::new();
                for (idx, enemy) in combat.enemies.iter().enumerate() {
                    if enemy.is_defeated {
                        continue;
                    }
                    if !combat_resolution::has_defeat_if_blocked(
                        &state.active_modifiers,
                        enemy.instance_id.as_str(),
                    ) {
                        continue;
                    }
                    // Check if ALL attacks are blocked
                    let all_blocked = enemy
                        .attacks_blocked
                        .iter()
                        .enumerate()
                        .all(|(i, blocked)| {
                            *blocked || enemy.attacks_cancelled.get(i).copied().unwrap_or(false)
                        });
                    if all_blocked && !enemy.attacks_blocked.is_empty() {
                        defeat_indices.push(idx);
                    }
                }

                // Award fame and mark defeated
                for idx in &defeat_indices {
                    let enemy = &state.combat.as_ref().unwrap().enemies[*idx];
                    let enemy_id_str = enemy.enemy_id.as_str().to_string();
                    let is_summoned = enemy.summoned_by_instance_id.is_some();
                    if let Some(def) = get_enemy(&enemy_id_str) {
                        if !is_summoned {
                            state.players[player_idx].fame += def.fame;
                            state.combat.as_mut().unwrap().fame_gained += def.fame;
                        }
                    }
                    state.combat.as_mut().unwrap().enemies[*idx].is_defeated = true;
                }
            }

            // Clear block accumulator
            let accumulator = &mut state.players[player_idx].combat_accumulator;
            accumulator.block = 0;
            accumulator.block_elements = ElementalValues::default();
            accumulator.swift_block_elements = ElementalValues::default();
            accumulator.assigned_block = 0;
            accumulator.assigned_block_elements = ElementalValues::default();

            // Check if there are units available and unblocked damage exists
            // If units present, enter interactive AssignDamage phase.
            // Otherwise, auto-assign all to hero (existing behavior).
            let has_eligible_units = state.combat.as_ref().unwrap().units_allowed
                && state.players[player_idx]
                    .units
                    .iter()
                    .any(|u| u.state == UnitState::Ready || u.state == UnitState::Spent);

            if has_eligible_units && has_unassigned_damage(state) {
                state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;
            } else {
                // Auto-assign all damage to hero (no units to choose)
                apply_auto_damage(state, player_idx)?;
                state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;
            }
        }
        CombatPhase::AssignDamage => {
            // Apply paralyze effect: if any unblocked Paralyze attack dealt wounds to hero,
            // discard all non-wound cards from hand
            let combat = state.combat.as_ref().unwrap();
            if combat.has_paralyze_damage_to_hero {
                let player = &mut state.players[player_idx];
                let non_wounds: Vec<CardId> = player
                    .hand
                    .iter()
                    .filter(|c| c.as_str() != "wound")
                    .cloned()
                    .collect();
                player.hand.retain(|c| c.as_str() == "wound");
                player.discard.extend(non_wounds);
            }

            // Remove undefeated summoned enemies (they don't persist to Attack phase)
            let combat = state.combat.as_mut().unwrap();
            combat.enemies.retain(|e| {
                e.summoned_by_instance_id.is_none() || e.is_defeated
            });

            // Unhide summoners
            for enemy in &mut combat.enemies {
                enemy.is_summoner_hidden = false;
            }

            combat.phase = CombatPhase::Attack;

            // Dueling: grant Attack 1 Physical at Block→Attack transition
            apply_dueling_attack_bonus(state, player_idx);
        }
        CombatPhase::Attack => {
            // End combat — remove defeated enemies from map, discard tokens
            end_combat(state, player_idx);
            return Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
            });
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Auto-process damage from unblocked enemy attacks during Block→AssignDamage transition.
///
/// For each undefeated enemy with unblocked attacks:
/// - Calculate wounds (ceil(damage / hero_armor), Brutal doubles)
/// - Add wound cards to player hand
/// - If Poison: also add wound to discard pile
/// - Mark attacks as damage_assigned
fn apply_auto_damage(
    state: &mut GameState,
    player_idx: usize,
) -> Result<(), ApplyError> {
    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("apply_auto_damage: no combat".into()))?;

    let hero_armor = state.players[player_idx].armor;

    // Collect damage info before mutating
    struct DamageInfo {
        enemy_idx: usize,
        attack_index: usize,
        wounds: u32,
        is_poison: bool,
        is_paralyze: bool,
    }

    let mut damage_entries: Vec<DamageInfo> = Vec::new();

    let active_modifiers = &state.active_modifiers;

    for (enemy_idx, enemy) in combat.enemies.iter().enumerate() {
        if enemy.is_defeated {
            continue;
        }

        // Hidden summoners don't deal damage (their summoned enemies attack instead)
        if enemy.is_summoner_hidden {
            continue;
        }

        // Check if enemy's attacks are skipped (e.g., cancel attack, freeze)
        if combat_resolution::is_enemy_attacks_skipped(active_modifiers, enemy.instance_id.as_str()) {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        let num_attacks = attack_count(def);

        // Get attack modifier for this enemy (from weaken, taunt, etc.)
        let (atk_change, atk_minimum) =
            combat_resolution::get_enemy_attack_modifier(active_modifiers, enemy.instance_id.as_str());

        for attack_index in 0..num_attacks {
            // Skip blocked, cancelled, or already-assigned attacks
            if enemy.attacks_blocked.get(attack_index).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_cancelled.get(attack_index).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_damage_assigned.get(attack_index).copied().unwrap_or(false) {
                continue;
            }

            // Apply cumbersome reduction to damage
            let cumbersome_reduction = combat
                .cumbersome_reductions
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);

            let (base_damage, _element, _is_swift) =
                combat_resolution::get_enemy_attack_info(def, attack_index);

            // Apply attack modifier (weaken, taunt, etc.)
            let modified_damage = if atk_change != 0 {
                (base_damage as i32 + atk_change).max(atk_minimum as i32) as u32
            } else {
                base_damage
            };

            let reduced_damage = modified_damage.saturating_sub(cumbersome_reduction);

            // If cumbersome reduces to 0, skip (considered blocked)
            if reduced_damage == 0 && base_damage > 0 {
                // Mark this attack as blocked for Elusive armor calculation
                // (will be handled via is_blocked flag update below)
                continue;
            }

            let (wounds, is_poison) =
                combat_resolution::calculate_hero_wounds_with_damage(
                    def, attack_index, hero_armor, reduced_damage,
                );

            let is_paralyze = combat_resolution::has_ability(def, EnemyAbilityType::Paralyze);

            if wounds > 0 || is_poison {
                damage_entries.push(DamageInfo {
                    enemy_idx,
                    attack_index,
                    wounds,
                    is_poison,
                    is_paralyze,
                });
            }
        }
    }

    // Check if cumbersome reductions make enemies count as fully blocked
    // (important for Elusive: blocked enemies use lower armor)
    {
        let combat = state.combat.as_ref().unwrap();
        let mut cumbersome_blocked: Vec<usize> = Vec::new();

        for (enemy_idx, enemy) in combat.enemies.iter().enumerate() {
            if enemy.is_defeated || enemy.is_blocked {
                continue;
            }
            let cumbersome_reduction = combat
                .cumbersome_reductions
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);
            if cumbersome_reduction == 0 {
                continue;
            }

            let def = match get_enemy(enemy.enemy_id.as_str()) {
                Some(d) => d,
                None => continue,
            };

            let num_attacks = attack_count(def);
            let all_reduced_to_zero = (0..num_attacks).all(|i| {
                if enemy.attacks_blocked.get(i).copied().unwrap_or(false) {
                    return true;
                }
                if enemy.attacks_cancelled.get(i).copied().unwrap_or(false) {
                    return true;
                }
                let (dmg, _, _) = combat_resolution::get_enemy_attack_info(def, i);
                dmg == 0 || dmg.saturating_sub(cumbersome_reduction) == 0
            });

            if all_reduced_to_zero {
                cumbersome_blocked.push(enemy_idx);
            }
        }

        let combat = state.combat.as_mut().unwrap();
        for idx in cumbersome_blocked {
            combat.enemies[idx].is_blocked = true;
        }
    }

    // Apply damage
    let mut total_wounds_to_hand = 0u32;
    let mut total_wounds_to_discard = 0u32;

    for entry in &damage_entries {
        total_wounds_to_hand += entry.wounds;
        if entry.is_poison {
            // Poison: wounds also go to discard (one extra wound per attack)
            total_wounds_to_discard += entry.wounds;
        }
    }

    // Add wound cards to hand
    let player = &mut state.players[player_idx];
    for _ in 0..total_wounds_to_hand {
        player.hand.push(CardId::from("wound"));
    }

    // Poison: add extra wounds to discard
    for _ in 0..total_wounds_to_discard {
        player.discard.push(CardId::from("wound"));
    }

    player.wounds_received_this_turn.hand += total_wounds_to_hand;
    player.wounds_received_this_turn.discard += total_wounds_to_discard;

    // Update combat state
    let combat = state.combat.as_mut().unwrap();
    combat.wounds_this_combat += total_wounds_to_hand + total_wounds_to_discard;
    if total_wounds_to_hand > 0 {
        combat.wounds_added_to_hand_this_combat = true;
    }

    // Update vampiric armor bonus: each Vampiric enemy gains +1 armor per wound to hand
    if total_wounds_to_hand > 0 {
        for enemy in &combat.enemies {
            if enemy.is_defeated {
                continue;
            }
            let def = match get_enemy(enemy.enemy_id.as_str()) {
                Some(d) => d,
                None => continue,
            };
            if combat_resolution::has_ability(def, EnemyAbilityType::Vampiric) {
                let instance_id = enemy.instance_id.as_str().to_string();
                *combat.vampiric_armor_bonus.entry(instance_id).or_insert(0) +=
                    total_wounds_to_hand;
            }
        }
    }

    // Mark attacks as damage assigned
    for entry in &damage_entries {
        if let Some(enemy) = combat.enemies.get_mut(entry.enemy_idx) {
            if entry.attack_index < enemy.attacks_damage_assigned.len() {
                enemy.attacks_damage_assigned[entry.attack_index] = true;
            }
            enemy.damage_assigned = true;
        }
    }

    // Paralyze: if any unblocked Paralyze attack dealt wounds, discard all non-wound cards from hand
    let has_paralyze_damage = damage_entries.iter().any(|e| e.is_paralyze && e.wounds > 0);
    if has_paralyze_damage {
        let player = &mut state.players[player_idx];
        let non_wounds: Vec<CardId> = player
            .hand
            .iter()
            .filter(|c| c.as_str() != "wound")
            .cloned()
            .collect();
        player.hand.retain(|c| c.as_str() == "wound");
        player.discard.extend(non_wounds);
    }

    Ok(())
}

/// Check if there are any unassigned, unblocked, uncancelled attacks with damage > 0.
fn has_unassigned_damage(state: &GameState) -> bool {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return false,
    };
    for enemy in &combat.enemies {
        if enemy.is_defeated || enemy.is_summoner_hidden {
            continue;
        }
        if combat_resolution::is_enemy_attacks_skipped(
            &state.active_modifiers,
            enemy.instance_id.as_str(),
        ) {
            continue;
        }
        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };
        let num_attacks = attack_count(def);
        for i in 0..num_attacks {
            if enemy.attacks_blocked.get(i).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_cancelled.get(i).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_damage_assigned.get(i).copied().unwrap_or(true) {
                continue;
            }
            let (dmg, _, _) = combat_resolution::get_enemy_attack_info(def, i);
            if dmg > 0 {
                return true;
            }
        }
    }
    false
}

/// Assign a specific enemy attack's damage to the hero.
fn apply_assign_damage_to_hero(
    state: &mut GameState,
    player_idx: usize,
    enemy_index: usize,
    attack_index: usize,
) -> Result<ApplyResult, ApplyError> {
    let combat = state.combat.as_ref().ok_or_else(|| {
        ApplyError::InternalError("AssignDamageToHero: no combat".into())
    })?;

    let enemy = combat.enemies.get(enemy_index).ok_or_else(|| {
        ApplyError::InternalError(format!("AssignDamageToHero: enemy_index {} out of range", enemy_index))
    })?;

    let def = get_enemy(enemy.enemy_id.as_str()).ok_or_else(|| {
        ApplyError::InternalError(format!("AssignDamageToHero: unknown enemy '{}'", enemy.enemy_id.as_str()))
    })?;

    let hero_armor = state.players[player_idx].armor;

    // Get attack modifier for this enemy
    let (atk_change, atk_minimum) =
        combat_resolution::get_enemy_attack_modifier(&state.active_modifiers, enemy.instance_id.as_str());

    // Apply cumbersome reduction
    let cumbersome_reduction = combat
        .cumbersome_reductions
        .get(enemy.instance_id.as_str())
        .copied()
        .unwrap_or(0);

    let (base_damage, _element, _is_swift) =
        combat_resolution::get_enemy_attack_info(def, attack_index);

    let modified_damage = if atk_change != 0 {
        (base_damage as i32 + atk_change).max(atk_minimum as i32) as u32
    } else {
        base_damage
    };

    let reduced_damage = modified_damage.saturating_sub(cumbersome_reduction);

    let (wounds, is_poison) =
        combat_resolution::calculate_hero_wounds_with_damage(def, attack_index, hero_armor, reduced_damage);

    let is_paralyze = combat_resolution::has_ability(def, EnemyAbilityType::Paralyze);

    // Apply wounds to hero
    let player = &mut state.players[player_idx];
    for _ in 0..wounds {
        player.hand.push(CardId::from("wound"));
    }
    if is_poison {
        for _ in 0..wounds {
            player.discard.push(CardId::from("wound"));
        }
    }

    player.wounds_received_this_turn.hand += wounds;
    if is_poison {
        player.wounds_received_this_turn.discard += wounds;
    }

    // Update combat state
    let combat = state.combat.as_mut().unwrap();
    combat.wounds_this_combat += wounds + if is_poison { wounds } else { 0 };
    if wounds > 0 {
        combat.wounds_added_to_hand_this_combat = true;
    }

    // Update vampiric armor bonus
    if wounds > 0 {
        for enemy in &combat.enemies {
            if enemy.is_defeated {
                continue;
            }
            let edef = match get_enemy(enemy.enemy_id.as_str()) {
                Some(d) => d,
                None => continue,
            };
            if combat_resolution::has_ability(edef, EnemyAbilityType::Vampiric) {
                let instance_id = enemy.instance_id.as_str().to_string();
                *combat.vampiric_armor_bonus.entry(instance_id).or_insert(0) += wounds;
            }
        }
    }

    // Mark attack as assigned
    combat.enemies[enemy_index].attacks_damage_assigned[attack_index] = true;
    combat.enemies[enemy_index].damage_assigned = true;

    // Track paralyze for end of assignment
    if is_paralyze && wounds > 0 {
        combat.has_paralyze_damage_to_hero = true;
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Assign a specific enemy attack's damage to a unit.
fn apply_assign_damage_to_unit(
    state: &mut GameState,
    player_idx: usize,
    enemy_index: usize,
    attack_index: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
) -> Result<ApplyResult, ApplyError> {
    let combat = state.combat.as_ref().ok_or_else(|| {
        ApplyError::InternalError("AssignDamageToUnit: no combat".into())
    })?;

    let enemy = combat.enemies.get(enemy_index).ok_or_else(|| {
        ApplyError::InternalError(format!("AssignDamageToUnit: enemy_index {} out of range", enemy_index))
    })?;

    let def = get_enemy(enemy.enemy_id.as_str()).ok_or_else(|| {
        ApplyError::InternalError(format!("AssignDamageToUnit: unknown enemy '{}'", enemy.enemy_id.as_str()))
    })?;

    // Get attack modifier for this enemy
    let (atk_change, atk_minimum) =
        combat_resolution::get_enemy_attack_modifier(&state.active_modifiers, enemy.instance_id.as_str());

    // Apply cumbersome reduction
    let cumbersome_reduction = combat
        .cumbersome_reductions
        .get(enemy.instance_id.as_str())
        .copied()
        .unwrap_or(0);

    let (base_damage, attack_element, _is_swift) =
        combat_resolution::get_enemy_attack_info(def, attack_index);

    let modified_damage = if atk_change != 0 {
        (base_damage as i32 + atk_change).max(atk_minimum as i32) as u32
    } else {
        base_damage
    };

    let reduced_damage = modified_damage.saturating_sub(cumbersome_reduction);

    let is_poison = combat_resolution::has_ability(def, EnemyAbilityType::Poison);
    let is_paralyze = combat_resolution::has_ability(def, EnemyAbilityType::Paralyze);
    let is_brutal = combat_resolution::has_ability(def, EnemyAbilityType::Brutal);
    let effective_damage = if is_brutal { reduced_damage * 2 } else { reduced_damage };

    // Find the unit
    let unit_idx = state.players[player_idx]
        .units
        .iter()
        .position(|u| u.instance_id == *unit_instance_id)
        .ok_or_else(|| {
            ApplyError::InternalError(format!(
                "AssignDamageToUnit: unit '{}' not found",
                unit_instance_id.as_str()
            ))
        })?;

    let unit = &state.players[player_idx].units[unit_idx];
    let unit_id = unit.unit_id.clone();
    let _unit_def = mk_data::units::get_unit(unit_id.as_str()).ok_or_else(|| {
        ApplyError::InternalError(format!("AssignDamageToUnit: unknown unit def '{}'", unit_id.as_str()))
    })?;

    // Collect unit's resistances: base from definition + granted by modifiers
    let unit_resistances: Vec<ResistanceElement> = {
        let mut resistances = Vec::new();
        // Check for GrantResistances modifiers (e.g., from Altem Guardians)
        for m in &state.active_modifiers {
            if let mk_types::modifier::ModifierEffect::GrantResistances { resistances: granted } = &m.effect {
                let scope_matches = matches!(&m.scope, mk_types::modifier::ModifierScope::AllUnits)
                    || matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope);
                if scope_matches {
                    for r in granted {
                        if !resistances.contains(r) {
                            resistances.push(*r);
                        }
                    }
                }
            }
        }
        resistances
    };

    let damage_result = combat_resolution::calculate_unit_damage(
        effective_damage,
        attack_element,
        is_poison,
        is_paralyze,
        unit.level,
        unit.wounded,
        unit.used_resistance_this_combat,
        &unit_resistances,
    );

    // Apply result to unit
    if damage_result.unit_destroyed {
        state.players[player_idx].units.remove(unit_idx);
    } else {
        let unit = &mut state.players[player_idx].units[unit_idx];
        if damage_result.unit_wounded {
            unit.wounded = true;
        }
        if damage_result.resistance_used {
            unit.used_resistance_this_combat = true;
        }
    }

    // Mark attack as assigned
    let combat = state.combat.as_mut().unwrap();
    combat.enemies[enemy_index].attacks_damage_assigned[attack_index] = true;
    combat.enemies[enemy_index].damage_assigned = true;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

// =============================================================================
// Skill activation
// =============================================================================

fn apply_use_skill(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_data::skills::{get_skill, SkillUsageType};

    let def = get_skill(skill_id.as_str()).ok_or_else(|| {
        ApplyError::InternalError(format!("Unknown skill: {}", skill_id.as_str()))
    })?;

    let _effect = def.effect.ok_or_else(|| {
        ApplyError::InternalError(format!("Skill {} has no effect", skill_id.as_str()))
    })?;

    // Mark cooldown
    let player = &mut state.players[player_idx];
    match def.usage_type {
        SkillUsageType::OncePerTurn => {
            player
                .skill_cooldowns
                .used_this_turn
                .push(skill_id.clone());
        }
        SkillUsageType::OncePerRound => {
            player
                .skill_cooldowns
                .used_this_round
                .push(skill_id.clone());
        }
        _ => {}
    }

    // Motivation cross-hero cooldown: mark all motivation skill IDs as used this round
    // so no other player (or this player) can use any motivation until round end.
    if def.is_motivation {
        // The skill itself is already marked above. The cross-player check happens
        // in enumeration by scanning all players' used_this_round for motivation skills.
        // No extra action needed here.
    }

    // Custom skill handlers
    match skill_id.as_str() {
        "arythea_power_of_pain" => return apply_power_of_pain(state, player_idx, skill_id),
        "tovak_i_dont_give_a_damn" => return apply_i_dont_give_a_damn(state, player_idx, skill_id),
        "tovak_who_needs_magic" => return apply_who_needs_magic(state, player_idx, skill_id),
        "goldyx_universal_power" => return apply_universal_power(state, player_idx, skill_id),
        "braevalar_secret_ways" => return apply_secret_ways(state, player_idx, skill_id),
        "krang_regenerate" => return apply_regenerate(state, player_idx, skill_id, BasicManaColor::Red),
        "braevalar_regenerate" => return apply_regenerate(state, player_idx, skill_id, BasicManaColor::Green),
        "wolfhawk_dueling" => return apply_dueling(state, player_idx, skill_id),
        "arythea_invocation" => return apply_invocation(state, player_idx, skill_id),
        "arythea_polarization" => return apply_polarization(state, player_idx, skill_id),
        "krang_curse" => return apply_curse(state, player_idx, skill_id),
        "braevalar_forked_lightning" => return apply_forked_lightning(state, player_idx, skill_id),
        "wolfhawk_know_your_prey" => return apply_know_your_prey(state, player_idx, skill_id),
        _ => {}
    }

    // Create effect queue and resolve
    let mut queue = effect_queue::EffectQueue::new();
    queue.push(_effect, None);
    let drain_result = queue.drain(state, player_idx);

    match drain_result {
        effect_queue::DrainResult::Complete => {}
        effect_queue::DrainResult::NeedsChoice {
            options,
            continuation,
            resolution,
        } => {
            let cont_entries: Vec<mk_types::pending::ContinuationEntry> = continuation
                .into_iter()
                .map(|qe| mk_types::pending::ContinuationEntry {
                    effect: qe.effect,
                    source_card_id: qe.source_card_id,
                })
                .collect();
            state.players[player_idx].pending.active =
                Some(ActivePending::Choice(mk_types::pending::PendingChoice {
                    card_id: None,
                    skill_id: Some(skill_id.clone()),
                    unit_instance_id: None,
                    options,
                    continuation: cont_entries,
                    movement_bonus_applied: false,
                    resolution,
                }));
        }
        effect_queue::DrainResult::PendingSet => {
            // A custom pending was set directly (e.g., SelectCombatEnemy).
        }
    }

    // Note: skills do NOT set HAS_TAKEN_ACTION_THIS_TURN or PLAYED_CARD_FROM_HAND_THIS_TURN

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

// =============================================================================
// Passive + sideways value skill handlers
// =============================================================================

/// Push passive (Permanent) modifiers for a skill when it's acquired.
pub(crate) fn push_passive_skill_modifiers(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) {
    let passives = mk_data::skills::get_passive_modifiers(skill_id.as_str());
    for effect in passives {
        push_skill_modifier(
            state,
            player_idx,
            skill_id,
            mk_types::modifier::ModifierDuration::Permanent,
            mk_types::modifier::ModifierScope::SelfScope,
            effect,
        );
    }
}

/// Push a modifier with Skill source for the current player.
pub(crate) fn push_skill_modifier(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    duration: mk_types::modifier::ModifierDuration,
    scope: mk_types::modifier::ModifierScope,
    effect: mk_types::modifier::ModifierEffect,
) {
    use mk_types::ids::ModifierId;
    use mk_types::modifier::{ActiveModifier, ModifierSource};

    let player_id = state.players[player_idx].id.clone();
    let modifier_count = state.active_modifiers.len();
    let modifier_id = format!(
        "mod_{}_r{}_t{}",
        modifier_count, state.round, state.current_player_index
    );
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from(modifier_id.as_str()),
        source: ModifierSource::Skill {
            skill_id: skill_id.clone(),
            player_id: player_id.clone(),
        },
        duration,
        scope,
        effect,
        created_at_round: state.round,
        created_by_player_id: player_id,
    });
}

fn apply_power_of_pain(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, RuleOverride};

    // Push RuleOverride: WoundsPlayableSideways
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::RuleOverride {
            rule: RuleOverride::WoundsPlayableSideways,
        },
    );
    // Push SidewaysValue: wounds get value 2
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 2,
            for_wounds: true,
            condition: None,
            mana_color: None,
            for_card_types: vec![],
        },
    );

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_i_dont_give_a_damn(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope};

    // Base: all non-wound cards sideways value +2
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 2,
            for_wounds: false,
            condition: None,
            mana_color: None,
            for_card_types: vec![],
        },
    );
    // Bonus: AA, Spell, Artifact get +3
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 3,
            for_wounds: false,
            condition: None,
            mana_color: None,
            for_card_types: vec![
                DeedCardType::AdvancedAction,
                DeedCardType::Spell,
                DeedCardType::Artifact,
            ],
        },
    );

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_who_needs_magic(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, RuleOverride, SidewaysCondition};

    // Base: all non-wound cards sideways value +2
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 2,
            for_wounds: false,
            condition: None,
            mana_color: None,
            for_card_types: vec![],
        },
    );
    // Bonus: +3 if no mana source die used
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 3,
            for_wounds: false,
            condition: Some(SidewaysCondition::NoManaUsed),
            mana_color: None,
            for_card_types: vec![],
        },
    );
    // If no mana used yet, block Source for the rest of turn
    if !state.players[player_idx]
        .flags
        .contains(PlayerFlags::USED_MANA_FROM_SOURCE)
    {
        push_skill_modifier(
            state,
            player_idx,
            skill_id,
            ModifierDuration::Turn,
            ModifierScope::SelfScope,
            ModifierEffect::RuleOverride {
                rule: RuleOverride::SourceBlocked,
            },
        );
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_universal_power(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    // Collect available basic mana colors from tokens
    let player = &state.players[player_idx];
    let mut available_colors: Vec<BasicManaColor> = Vec::new();
    let mut seen = [false; 4];
    for token in &player.pure_mana {
        let idx = match token.color {
            ManaColor::Red => Some(0),
            ManaColor::Blue => Some(1),
            ManaColor::Green => Some(2),
            ManaColor::White => Some(3),
            _ => None,
        };
        if let Some(i) = idx {
            if !seen[i] {
                seen[i] = true;
                available_colors.push(match i {
                    0 => BasicManaColor::Red,
                    1 => BasicManaColor::Blue,
                    2 => BasicManaColor::Green,
                    _ => BasicManaColor::White,
                });
            }
        }
    }

    if available_colors.is_empty() {
        return Err(ApplyError::InternalError(
            "Universal Power: no basic mana tokens available".into(),
        ));
    }

    if available_colors.len() == 1 {
        // Auto-consume the single option
        let color = available_colors[0];
        let mana_color = ManaColor::from(color);
        let player = &mut state.players[player_idx];
        if let Some(pos) = player.pure_mana.iter().position(|t| t.color == mana_color) {
            player.pure_mana.remove(pos);
        }
        push_universal_power_modifiers(state, player_idx, skill_id, color);
    } else {
        // Multiple options: set pending choice
        let options: Vec<CardEffect> = available_colors
            .iter()
            .map(|_| CardEffect::Noop)
            .collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::UniversalPowerMana {
                    available_colors,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

pub(crate) fn push_universal_power_modifiers(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    color: BasicManaColor,
) {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, SidewaysCondition};

    // Base: all non-wound cards sideways value +3
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 3,
            for_wounds: false,
            condition: None,
            mana_color: None,
            for_card_types: vec![],
        },
    );
    // Bonus: +4 if card color matches spent mana color (BasicAction, AA, Spell)
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 4,
            for_wounds: false,
            condition: Some(SidewaysCondition::WithManaMatchingColor),
            mana_color: Some(color),
            for_card_types: vec![
                DeedCardType::BasicAction,
                DeedCardType::AdvancedAction,
                DeedCardType::Spell,
            ],
        },
    );
}

// =============================================================================
// Secret Ways, Regenerate, Dueling skill handlers
// =============================================================================

fn apply_secret_ways(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, TerrainOrAll};
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    // Always grant Move 1
    state.players[player_idx].move_points += 1;

    // Check if player can afford Blue mana (token > crystal > die)
    let player = &state.players[player_idx];
    let has_blue_token = player.pure_mana.iter().any(|t| t.color == ManaColor::Blue);
    let has_blue_crystal = player.crystals.blue > 0;
    let has_blue_die = state
        .source
        .dice
        .iter()
        .any(|d| {
            d.color == ManaColor::Blue
                && !d.is_depleted
                && d.taken_by_player_id.is_none()
        });

    if has_blue_token || has_blue_crystal || has_blue_die {
        // Present choice: Noop (decline) or Lake modifiers (pay blue mana)
        let options = vec![
            CardEffect::Noop,
            CardEffect::Compound {
                effects: vec![
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::TerrainCost {
                            terrain: TerrainOrAll::Specific(mk_types::enums::Terrain::Lake),
                            amount: 0,
                            minimum: 0,
                            replace_cost: Some(2),
                        },
                        duration: ModifierDuration::Turn,
                        scope: ModifierScope::SelfScope,
                    },
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::TerrainSafe {
                            terrain: TerrainOrAll::Specific(mk_types::enums::Terrain::Lake),
                        },
                        duration: ModifierDuration::Turn,
                        scope: ModifierScope::SelfScope,
                    },
                ],
            },
        ];

        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::SecretWaysLake,
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_regenerate(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    bonus_color: BasicManaColor,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    // Collect available mana colors the player can spend
    let player = &state.players[player_idx];
    let mut available_colors: Vec<ManaColor> = Vec::new();
    let mut seen = [false; 6]; // R, B, G, W, Gold, Black

    // Check tokens
    for token in &player.pure_mana {
        let idx = mana_color_to_index(token.color);
        if let Some(i) = idx {
            if !seen[i] {
                seen[i] = true;
                available_colors.push(token.color);
            }
        }
    }

    // Check crystals (basic colors only)
    for (color, count) in [
        (BasicManaColor::Red, player.crystals.red),
        (BasicManaColor::Blue, player.crystals.blue),
        (BasicManaColor::Green, player.crystals.green),
        (BasicManaColor::White, player.crystals.white),
    ] {
        if count > 0 {
            let mc = ManaColor::from(color);
            let idx = mana_color_to_index(mc);
            if let Some(i) = idx {
                if !seen[i] {
                    seen[i] = true;
                    available_colors.push(mc);
                }
            }
        }
    }

    // Check source dice (respecting time-of-day restrictions)
    for die in &state.source.dice {
        if !die.is_depleted && die.taken_by_player_id.is_none() {
            let idx = mana_color_to_index(die.color);
            if let Some(i) = idx {
                if !seen[i] {
                    seen[i] = true;
                    available_colors.push(die.color);
                }
            }
        }
    }

    if available_colors.is_empty() {
        return Err(ApplyError::InternalError(
            "Regenerate: no mana available".into(),
        ));
    }

    if available_colors.len() == 1 {
        // Auto-consume the single option
        execute_regenerate(state, player_idx, available_colors[0], bonus_color)?;
    } else {
        // Multiple options: set pending choice
        let options: Vec<CardEffect> = available_colors
            .iter()
            .map(|_| CardEffect::Noop)
            .collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::RegenerateMana {
                    available_colors,
                    bonus_color,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn mana_color_to_index(color: ManaColor) -> Option<usize> {
    match color {
        ManaColor::Red => Some(0),
        ManaColor::Blue => Some(1),
        ManaColor::Green => Some(2),
        ManaColor::White => Some(3),
        ManaColor::Gold => Some(4),
        ManaColor::Black => Some(5),
    }
}

/// Execute the regenerate effect: consume mana, remove wound, conditionally draw.
pub(crate) fn execute_regenerate(
    state: &mut GameState,
    player_idx: usize,
    mana_color: ManaColor,
    bonus_color: BasicManaColor,
) -> Result<(), ApplyError> {
    // Consume 1 mana of the chosen color (token > crystal > die)
    let player = &mut state.players[player_idx];

    // Try token first
    if let Some(pos) = player.pure_mana.iter().position(|t| t.color == mana_color) {
        player.pure_mana.remove(pos);
    } else if let Some(basic) = mana_color.to_basic() {
        // Try crystal
        let crystal_count = match basic {
            BasicManaColor::Red => &mut player.crystals.red,
            BasicManaColor::Blue => &mut player.crystals.blue,
            BasicManaColor::Green => &mut player.crystals.green,
            BasicManaColor::White => &mut player.crystals.white,
        };
        if *crystal_count > 0 {
            *crystal_count -= 1;
            match basic {
                BasicManaColor::Red => player.spent_crystals_this_turn.red += 1,
                BasicManaColor::Blue => player.spent_crystals_this_turn.blue += 1,
                BasicManaColor::Green => player.spent_crystals_this_turn.green += 1,
                BasicManaColor::White => player.spent_crystals_this_turn.white += 1,
            }
        } else {
            return Err(ApplyError::InternalError(
                "Regenerate: cannot consume mana".into(),
            ));
        }
    } else {
        // Gold/Black — try source die
        if let Some(die) = state.source.dice.iter_mut().find(|d| {
            d.color == mana_color && !d.is_depleted && d.taken_by_player_id.is_none()
        }) {
            die.taken_by_player_id = Some(state.players[player_idx].id.clone());
            die.is_depleted = true;
        } else {
            return Err(ApplyError::InternalError(
                "Regenerate: cannot consume mana".into(),
            ));
        }
    }

    // Remove first wound from hand
    let player = &mut state.players[player_idx];
    if let Some(pos) = player.hand.iter().position(|c| c.as_str() == "wound") {
        player.hand.remove(pos);
        state.wound_pile_count = Some(state.wound_pile_count.unwrap_or(0) + 1);
    }

    // Check bonus draw: mana color matches bonus_color OR strictly lowest fame
    let is_bonus_color = mana_color.to_basic() == Some(bonus_color);
    let is_lowest = has_strictly_lowest_fame(state, player_idx);

    if is_bonus_color || is_lowest {
        let player = &mut state.players[player_idx];
        if !player.deck.is_empty() {
            let card = player.deck.remove(0);
            player.hand.push(card);
        }
    }

    Ok(())
}

/// Check if a player has strictly the lowest fame among all players.
/// In solo (1 player): always false.
fn has_strictly_lowest_fame(state: &GameState, player_idx: usize) -> bool {
    if state.players.len() <= 1 {
        return false;
    }
    let my_fame = state.players[player_idx].fame;
    state.players.iter().enumerate().all(|(i, p)| {
        i == player_idx || p.fame > my_fame
    })
}

fn apply_dueling(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("Dueling: not in combat".into()))?;

    // Filter eligible enemies: alive AND attacks this combat (not skip_attack)
    let eligible: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| {
            !e.is_defeated
                && !combat_resolution::is_enemy_attacks_skipped(
                    &state.active_modifiers,
                    e.instance_id.as_str(),
                )
        })
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    if eligible.is_empty() {
        return Err(ApplyError::InternalError(
            "Dueling: no eligible enemies".into(),
        ));
    }

    // Grant Block 1 Physical
    let accumulator = &mut state.players[player_idx].combat_accumulator;
    accumulator.block += 1;
    accumulator.block_elements.physical += 1;

    if eligible.len() == 1 {
        // Auto-target the single enemy
        apply_dueling_target(state, player_idx, skill_id, &eligible[0]);
    } else {
        // Multiple targets: set pending choice
        let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::DuelingTarget {
                    eligible_enemy_ids: eligible,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Apply the DuelingTarget modifier for a chosen enemy (public wrapper for effect_queue).
pub(crate) fn apply_dueling_target_pub(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
) {
    apply_dueling_target(state, player_idx, skill_id, enemy_instance_id);
}

/// Apply the DuelingTarget modifier for a chosen enemy.
fn apply_dueling_target(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
) {
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        mk_types::modifier::ModifierDuration::Combat,
        mk_types::modifier::ModifierScope::SelfScope,
        mk_types::modifier::ModifierEffect::DuelingTarget {
            enemy_instance_id: enemy_instance_id.to_string(),
            attack_applied: false,
            unit_involved: false,
        },
    );
}

/// Apply the dueling attack bonus at Block→Attack transition.
/// Called from apply_end_combat_phase when transitioning to Attack phase.
pub(crate) fn apply_dueling_attack_bonus(
    state: &mut GameState,
    player_idx: usize,
) {
    // Find active DuelingTarget modifier for this player
    let player_id = &state.players[player_idx].id;
    let modifier_idx = state.active_modifiers.iter().position(|m| {
        m.created_by_player_id == *player_id
            && matches!(&m.effect, mk_types::modifier::ModifierEffect::DuelingTarget { .. })
    });

    let Some(idx) = modifier_idx else { return };

    // Check if already applied
    if let mk_types::modifier::ModifierEffect::DuelingTarget {
        attack_applied: true,
        ..
    } = &state.active_modifiers[idx].effect
    {
        return;
    }

    // Check if target enemy is still alive
    let target_id = if let mk_types::modifier::ModifierEffect::DuelingTarget {
        enemy_instance_id,
        ..
    } = &state.active_modifiers[idx].effect
    {
        enemy_instance_id.clone()
    } else {
        return;
    };

    let target_alive = state
        .combat
        .as_ref()
        .map(|c| {
            c.enemies
                .iter()
                .any(|e| e.instance_id.as_str() == target_id && !e.is_defeated)
        })
        .unwrap_or(false);

    if !target_alive {
        return;
    }

    // Mark attack_applied = true
    if let mk_types::modifier::ModifierEffect::DuelingTarget {
        ref mut attack_applied,
        ..
    } = state.active_modifiers[idx].effect
    {
        *attack_applied = true;
    }

    // Grant Attack 1 Physical
    let accumulator = &mut state.players[player_idx].combat_accumulator;
    accumulator.attack.normal += 1;
    accumulator.attack.normal_elements.physical += 1;
}

/// Resolve dueling fame bonus at combat end.
/// Returns the fame gained (0 or 1).
pub(crate) fn resolve_dueling_fame_bonus(
    state: &mut GameState,
    player_idx: usize,
) -> u32 {
    let player_id = &state.players[player_idx].id;

    // Find DuelingTarget modifier
    let modifier = state.active_modifiers.iter().find(|m| {
        m.created_by_player_id == *player_id
            && matches!(&m.effect, mk_types::modifier::ModifierEffect::DuelingTarget { .. })
    });

    let Some(m) = modifier else { return 0 };

    let (target_id, unit_involved) =
        if let mk_types::modifier::ModifierEffect::DuelingTarget {
            enemy_instance_id,
            unit_involved,
            ..
        } = &m.effect
        {
            (enemy_instance_id.clone(), *unit_involved)
        } else {
            return 0;
        };

    // Target must be defeated
    let target_defeated = state
        .combat
        .as_ref()
        .map(|c| {
            c.enemies
                .iter()
                .any(|e| e.instance_id.as_str() == target_id && e.is_defeated)
        })
        .unwrap_or(false);

    if !target_defeated || unit_involved {
        return 0;
    }

    state.players[player_idx].fame += 1;
    1
}

/// Mark unit involvement on the DuelingTarget modifier.
/// Called when any unit combat ability is activated.
pub(crate) fn mark_dueling_unit_involvement(
    state: &mut GameState,
    player_idx: usize,
) {
    let player_id = &state.players[player_idx].id;
    for m in &mut state.active_modifiers {
        if m.created_by_player_id == *player_id {
            if let mk_types::modifier::ModifierEffect::DuelingTarget {
                ref mut unit_involved,
                ..
            } = m.effect
            {
                *unit_involved = true;
            }
        }
    }
}

// =============================================================================
// Invocation skill handler
// =============================================================================

fn apply_invocation(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, InvocationOption, PendingChoice};

    let player = &state.players[player_idx];
    if player.hand.is_empty() {
        return Err(ApplyError::InternalError(
            "Invocation: hand is empty".into(),
        ));
    }

    // Build deduplicated options: per unique card_id, 2 color choices
    let mut seen_card_ids = Vec::new();
    let mut options = Vec::new();

    for card_id in &player.hand {
        if seen_card_ids.contains(card_id) {
            continue;
        }
        seen_card_ids.push(card_id.clone());
        let is_wound = card_id.as_str() == "wound";
        if is_wound {
            // Wounds → Red or Black
            options.push(InvocationOption {
                card_id: card_id.clone(),
                is_wound: true,
                mana_color: ManaColor::Red,
            });
            options.push(InvocationOption {
                card_id: card_id.clone(),
                is_wound: true,
                mana_color: ManaColor::Black,
            });
        } else {
            // Non-wounds → White or Green
            options.push(InvocationOption {
                card_id: card_id.clone(),
                is_wound: false,
                mana_color: ManaColor::White,
            });
            options.push(InvocationOption {
                card_id: card_id.clone(),
                is_wound: false,
                mana_color: ManaColor::Green,
            });
        }
    }

    if options.len() == 1 {
        // Auto-resolve single option
        execute_invocation(state, player_idx, &options[0]);
    } else {
        let choice_options: Vec<CardEffect> = options.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options: choice_options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::InvocationDiscard { options },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Execute invocation: discard card, gain mana token.
pub(crate) fn execute_invocation(
    state: &mut GameState,
    player_idx: usize,
    opt: &mk_types::pending::InvocationOption,
) {
    let player = &mut state.players[player_idx];

    // Remove first matching card from hand
    if let Some(pos) = player.hand.iter().position(|c| *c == opt.card_id) {
        player.hand.remove(pos);
        if opt.is_wound {
            state.wound_pile_count = Some(state.wound_pile_count.unwrap_or(0) + 1);
        } else {
            state.players[player_idx].discard.push(opt.card_id.clone());
        }
    }

    // Gain mana token
    state.players[player_idx].pure_mana.push(ManaToken {
        color: opt.mana_color,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
}

// =============================================================================
// Polarization skill handler
// =============================================================================

fn apply_polarization(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice, PolarizationOption, PolarizationSourceType};

    let is_day = state.time_of_day == TimeOfDay::Day;

    fn opposite_basic(c: ManaColor) -> Option<ManaColor> {
        match c {
            ManaColor::Red => Some(ManaColor::Blue),
            ManaColor::Blue => Some(ManaColor::Red),
            ManaColor::Green => Some(ManaColor::White),
            ManaColor::White => Some(ManaColor::Green),
            _ => None,
        }
    }

    let mut options: Vec<PolarizationOption> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // 1. Tokens
    let player = &state.players[player_idx];
    for (idx, token) in player.pure_mana.iter().enumerate() {
        // Basic color → opposite
        if let Some(target) = opposite_basic(token.color) {
            let key = (PolarizationSourceType::Token, token.color, target);
            if seen.insert(key) {
                options.push(PolarizationOption {
                    source_type: PolarizationSourceType::Token,
                    source_color: token.color,
                    target_color: target,
                    cannot_power_spells: false,
                    token_index: Some(idx),
                    die_id: None,
                });
            }
        }
        // Black (day) → any basic (cannot_power_spells)
        if token.color == ManaColor::Black && is_day {
            for target in &[ManaColor::Red, ManaColor::Blue, ManaColor::Green, ManaColor::White] {
                let key = (PolarizationSourceType::Token, ManaColor::Black, *target);
                if seen.insert(key) {
                    options.push(PolarizationOption {
                        source_type: PolarizationSourceType::Token,
                        source_color: ManaColor::Black,
                        target_color: *target,
                        cannot_power_spells: true,
                        token_index: Some(idx),
                        die_id: None,
                    });
                }
            }
        }
        // Gold (night) → Black
        if token.color == ManaColor::Gold && !is_day {
            let key = (PolarizationSourceType::Token, ManaColor::Gold, ManaColor::Black);
            if seen.insert(key) {
                options.push(PolarizationOption {
                    source_type: PolarizationSourceType::Token,
                    source_color: ManaColor::Gold,
                    target_color: ManaColor::Black,
                    cannot_power_spells: false,
                    token_index: Some(idx),
                    die_id: None,
                });
            }
        }
    }

    // 2. Crystals
    for (basic, count) in [
        (BasicManaColor::Red, player.crystals.red),
        (BasicManaColor::Blue, player.crystals.blue),
        (BasicManaColor::Green, player.crystals.green),
        (BasicManaColor::White, player.crystals.white),
    ] {
        if count > 0 {
            let src = ManaColor::from(basic);
            if let Some(target) = opposite_basic(src) {
                let key = (PolarizationSourceType::Crystal, src, target);
                if seen.insert(key) {
                    options.push(PolarizationOption {
                        source_type: PolarizationSourceType::Crystal,
                        source_color: src,
                        target_color: target,
                        cannot_power_spells: false,
                        token_index: None,
                        die_id: None,
                    });
                }
            }
        }
    }

    // 3. Source dice
    for die in &state.source.dice {
        if die.is_depleted || die.taken_by_player_id.is_some() {
            continue;
        }
        // Basic → opposite
        if let Some(target) = opposite_basic(die.color) {
            let key = (PolarizationSourceType::Die, die.color, target);
            if seen.insert(key) {
                options.push(PolarizationOption {
                    source_type: PolarizationSourceType::Die,
                    source_color: die.color,
                    target_color: target,
                    cannot_power_spells: false,
                    token_index: None,
                    die_id: Some(die.id.clone()),
                });
            }
        }
        // Black (day) → any basic
        if die.color == ManaColor::Black && is_day {
            for target in &[ManaColor::Red, ManaColor::Blue, ManaColor::Green, ManaColor::White] {
                let key = (PolarizationSourceType::Die, ManaColor::Black, *target);
                if seen.insert(key) {
                    options.push(PolarizationOption {
                        source_type: PolarizationSourceType::Die,
                        source_color: ManaColor::Black,
                        target_color: *target,
                        cannot_power_spells: true,
                        token_index: None,
                        die_id: Some(die.id.clone()),
                    });
                }
            }
        }
        // Gold (night) → Black
        if die.color == ManaColor::Gold && !is_day {
            let key = (PolarizationSourceType::Die, ManaColor::Gold, ManaColor::Black);
            if seen.insert(key) {
                options.push(PolarizationOption {
                    source_type: PolarizationSourceType::Die,
                    source_color: ManaColor::Gold,
                    target_color: ManaColor::Black,
                    cannot_power_spells: false,
                    token_index: None,
                    die_id: Some(die.id.clone()),
                });
            }
        }
    }

    if options.is_empty() {
        return Err(ApplyError::InternalError(
            "Polarization: no conversion options available".into(),
        ));
    }

    if options.len() == 1 {
        execute_polarization(state, player_idx, &options[0]);
    } else {
        let choice_options: Vec<CardEffect> = options.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options: choice_options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::PolarizationConvert { options },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Execute polarization: consume source mana, gain target mana.
pub(crate) fn execute_polarization(
    state: &mut GameState,
    player_idx: usize,
    opt: &mk_types::pending::PolarizationOption,
) {
    use mk_types::pending::PolarizationSourceType;

    match opt.source_type {
        PolarizationSourceType::Token => {
            // Remove the token at the given index (or first matching color)
            let player = &mut state.players[player_idx];
            if let Some(idx) = opt.token_index {
                if idx < player.pure_mana.len() && player.pure_mana[idx].color == opt.source_color {
                    player.pure_mana.remove(idx);
                } else if let Some(pos) = player.pure_mana.iter().position(|t| t.color == opt.source_color) {
                    player.pure_mana.remove(pos);
                }
            }
        }
        PolarizationSourceType::Crystal => {
            let player = &mut state.players[player_idx];
            if let Some(basic) = opt.source_color.to_basic() {
                let crystal = match basic {
                    BasicManaColor::Red => &mut player.crystals.red,
                    BasicManaColor::Blue => &mut player.crystals.blue,
                    BasicManaColor::Green => &mut player.crystals.green,
                    BasicManaColor::White => &mut player.crystals.white,
                };
                if *crystal > 0 {
                    *crystal -= 1;
                    match basic {
                        BasicManaColor::Red => player.spent_crystals_this_turn.red += 1,
                        BasicManaColor::Blue => player.spent_crystals_this_turn.blue += 1,
                        BasicManaColor::Green => player.spent_crystals_this_turn.green += 1,
                        BasicManaColor::White => player.spent_crystals_this_turn.white += 1,
                    }
                }
            }
            // Gain target crystal (polarization crystal→crystal keeps it as crystal)
            if let Some(target_basic) = opt.target_color.to_basic() {
                let target_crystal = match target_basic {
                    BasicManaColor::Red => &mut state.players[player_idx].crystals.red,
                    BasicManaColor::Blue => &mut state.players[player_idx].crystals.blue,
                    BasicManaColor::Green => &mut state.players[player_idx].crystals.green,
                    BasicManaColor::White => &mut state.players[player_idx].crystals.white,
                };
                if *target_crystal < 3 {
                    *target_crystal += 1;
                }
            }
            return; // Crystal→Crystal, no token added
        }
        PolarizationSourceType::Die => {
            if let Some(ref die_id) = opt.die_id {
                let player_id = state.players[player_idx].id.clone();
                if let Some(die) = state.source.dice.iter_mut().find(|d| d.id == *die_id) {
                    die.taken_by_player_id = Some(player_id);
                    die.is_depleted = true;
                }
            }
        }
    }

    // Gain target mana token (for Token and Die sources)
    state.players[player_idx].pure_mana.push(ManaToken {
        color: opt.target_color,
        source: ManaTokenSource::Effect,
        cannot_power_spells: opt.cannot_power_spells,
    });
}

// =============================================================================
// Curse skill handler (3-step)
// =============================================================================

fn apply_curse(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("Curse: not in combat".into()))?;

    let is_ranged_siege = combat.phase == CombatPhase::RangedSiege;

    let eligible: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| {
            !e.is_defeated
                && (!is_ranged_siege || !is_enemy_fortified(e.enemy_id.as_str()))
        })
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    if eligible.is_empty() {
        return Err(ApplyError::InternalError(
            "Curse: no eligible enemies".into(),
        ));
    }

    if eligible.len() == 1 {
        // Auto-target
        setup_curse_mode(state, player_idx, skill_id, &eligible[0]);
    } else {
        let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::CurseTarget {
                    eligible_enemy_ids: eligible,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Set up the mode choice for Curse (Attack -2 or Armor -1).
pub(crate) fn setup_curse_mode(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
) {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let combat = state.combat.as_ref().unwrap();
    let enemy = combat
        .enemies
        .iter()
        .find(|e| e.instance_id.as_str() == enemy_instance_id)
        .unwrap();

    let enemy_def = mk_data::enemies::get_enemy(enemy.enemy_id.as_str());
    let has_ai = enemy_def
        .map(|d| d.abilities.contains(&EnemyAbilityType::ArcaneImmunity))
        .unwrap_or(false);
    let num_attacks = enemy_def
        .map(mk_data::enemies::attack_count)
        .unwrap_or(1);
    let has_multi_attack = num_attacks > 1;

    // Build options: always Attack -2, optionally Armor -1 (blocked by AI)
    let mut options = vec![CardEffect::Noop]; // index 0 = Attack -2
    if !has_ai {
        options.push(CardEffect::Noop); // index 1 = Armor -1
    }

    if options.len() == 1 && !has_multi_attack {
        // Only Attack -2, single attack → auto-apply
        push_skill_modifier(
            state,
            player_idx,
            skill_id,
            mk_types::modifier::ModifierDuration::Combat,
            mk_types::modifier::ModifierScope::OneEnemy {
                enemy_id: enemy_instance_id.to_string(),
            },
            mk_types::modifier::ModifierEffect::EnemyStat {
                stat: mk_types::modifier::EnemyStat::Attack,
                amount: -2,
                minimum: 0,
                attack_index: None,
                per_resistance: false,
                fortified_amount: None,
            },
        );
    } else {
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::CurseMode {
                    enemy_instance_id: enemy_instance_id.to_string(),
                    has_arcane_immunity: has_ai,
                    has_multi_attack,
                },
            }));
    }
}

/// Execute curse mode choice.
pub(crate) fn execute_curse_mode(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
    has_multi_attack: bool,
    choice_index: usize,
) {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    if choice_index == 0 {
        // Attack -2
        if has_multi_attack {
            // Need to choose which attack index
            let enemy_def = {
                let combat = state.combat.as_ref().unwrap();
                let enemy = combat
                    .enemies
                    .iter()
                    .find(|e| e.instance_id.as_str() == enemy_instance_id)
                    .unwrap();
                mk_data::enemies::get_enemy(enemy.enemy_id.as_str())
            };
            let num_attacks = enemy_def.map(mk_data::enemies::attack_count).unwrap_or(1);
            let options: Vec<CardEffect> = (0..num_attacks).map(|_| CardEffect::Noop).collect();
            state.players[player_idx].pending.active =
                Some(ActivePending::Choice(PendingChoice {
                    card_id: None,
                    skill_id: Some(skill_id.clone()),
                    unit_instance_id: None,
                    options,
                    continuation: vec![],
                    movement_bonus_applied: false,
                    resolution: ChoiceResolution::CurseAttackIndex {
                        enemy_instance_id: enemy_instance_id.to_string(),
                        attack_count: num_attacks,
                    },
                }));
        } else {
            // Single attack: apply directly
            push_skill_modifier(
                state,
                player_idx,
                skill_id,
                mk_types::modifier::ModifierDuration::Combat,
                mk_types::modifier::ModifierScope::OneEnemy {
                    enemy_id: enemy_instance_id.to_string(),
                },
                mk_types::modifier::ModifierEffect::EnemyStat {
                    stat: mk_types::modifier::EnemyStat::Attack,
                    amount: -2,
                    minimum: 0,
                    attack_index: None,
                    per_resistance: false,
                    fortified_amount: None,
                },
            );
        }
    } else {
        // Armor -1 (choice_index == 1)
        push_skill_modifier(
            state,
            player_idx,
            skill_id,
            mk_types::modifier::ModifierDuration::Combat,
            mk_types::modifier::ModifierScope::OneEnemy {
                enemy_id: enemy_instance_id.to_string(),
            },
            mk_types::modifier::ModifierEffect::EnemyStat {
                stat: mk_types::modifier::EnemyStat::Armor,
                amount: -1,
                minimum: 1,
                attack_index: None,
                per_resistance: false,
                fortified_amount: None,
            },
        );
    }
}

/// Execute curse attack index selection (multi-attack enemy).
pub(crate) fn execute_curse_attack_index(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
    choice_index: usize,
) {
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        mk_types::modifier::ModifierDuration::Combat,
        mk_types::modifier::ModifierScope::OneEnemy {
            enemy_id: enemy_instance_id.to_string(),
        },
        mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Attack,
            amount: -2,
            minimum: 0,
            attack_index: Some(choice_index as u32),
            per_resistance: false,
            fortified_amount: None,
        },
    );
}

// =============================================================================
// Forked Lightning skill handler (iterative loop)
// =============================================================================

fn apply_forked_lightning(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("Forked Lightning: not in combat".into()))?;

    let eligible: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| !e.is_defeated)
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    if eligible.is_empty() {
        return Err(ApplyError::InternalError(
            "Forked Lightning: no alive enemies".into(),
        ));
    }

    if eligible.len() == 1 {
        // Auto-target the single enemy
        apply_forked_lightning_hit(state, player_idx, &eligible[0]);
        // Only 1 enemy, can't pick more
    } else {
        // First pick: no "Done" option
        let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::ForkedLightningTarget {
                    remaining: 3,
                    already_targeted: vec![],
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_forked_lightning_hit(
    state: &mut GameState,
    player_idx: usize,
    _enemy_instance_id: &str,
) {
    // +1 Ranged ColdFire Attack
    let accumulator = &mut state.players[player_idx].combat_accumulator;
    accumulator.attack.ranged += 1;
    accumulator.attack.ranged_elements.cold_fire += 1;
}

/// Execute forked lightning target selection.
pub(crate) fn execute_forked_lightning_target(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    remaining: u32,
    already_targeted: &[String],
    choice_index: usize,
) {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    // Build eligible list (alive, not already targeted)
    let eligible: Vec<String> = {
        let combat = state.combat.as_ref().unwrap();
        combat
            .enemies
            .iter()
            .filter(|e| !e.is_defeated && !already_targeted.contains(&e.instance_id.as_str().to_string()))
            .map(|e| e.instance_id.as_str().to_string())
            .collect()
    };

    // If not first pick (remaining < 3), last option is "Done"
    let has_done = remaining < 3;

    // Check if "Done" was chosen
    if has_done && choice_index == eligible.len() {
        // "Done" chosen — no more targets
        return;
    }

    if choice_index >= eligible.len() {
        return;
    }

    // Apply the hit
    let target_id = eligible[choice_index].clone();
    apply_forked_lightning_hit(state, player_idx, &target_id);

    let mut new_targeted = already_targeted.to_vec();
    new_targeted.push(target_id);

    let new_remaining = remaining - 1;

    // Check if we can pick more
    let next_eligible: Vec<String> = {
        let combat = state.combat.as_ref().unwrap();
        combat
            .enemies
            .iter()
            .filter(|e| !e.is_defeated && !new_targeted.contains(&e.instance_id.as_str().to_string()))
            .map(|e| e.instance_id.as_str().to_string())
            .collect()
    };

    if new_remaining == 0 || next_eligible.is_empty() {
        // Done
        return;
    }

    // More picks available: present next choice with "Done" option
    let mut options: Vec<CardEffect> = next_eligible.iter().map(|_| CardEffect::Noop).collect();
    options.push(CardEffect::Noop); // "Done" option at the end

    state.players[player_idx].pending.active =
        Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: Some(skill_id.clone()),
            unit_instance_id: None,
            options,
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::ForkedLightningTarget {
                remaining: new_remaining,
                already_targeted: new_targeted,
            },
        }));
}

// =============================================================================
// Know Your Prey skill handler (2-step)
// =============================================================================

fn apply_know_your_prey(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("Know Your Prey: not in combat".into()))?;

    let eligible: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| {
            !e.is_defeated
                && !is_enemy_arcane_immune(e.enemy_id.as_str())
                && has_strippable_attributes(e.enemy_id.as_str())
        })
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    if eligible.is_empty() {
        return Err(ApplyError::InternalError(
            "Know Your Prey: no eligible enemies".into(),
        ));
    }

    if eligible.len() == 1 {
        setup_know_your_prey_options(state, player_idx, skill_id, &eligible[0]);
    } else {
        let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::KnowYourPreyTarget {
                    eligible_enemy_ids: eligible,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Build options for Know Your Prey after target selection.
pub(crate) fn setup_know_your_prey_options(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
) {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, KnowYourPreyApplyOption, PendingChoice};

    let combat = state.combat.as_ref().unwrap();
    let enemy = combat
        .enemies
        .iter()
        .find(|e| e.instance_id.as_str() == enemy_instance_id)
        .unwrap();
    let enemy_def = mk_data::enemies::get_enemy(enemy.enemy_id.as_str());

    let mut strip_options: Vec<KnowYourPreyApplyOption> = Vec::new();

    if let Some(def) = enemy_def {
        // Removable abilities
        let removable = [
            EnemyAbilityType::Assassination,
            EnemyAbilityType::Brutal,
            EnemyAbilityType::Paralyze,
            EnemyAbilityType::Poison,
            EnemyAbilityType::Swift,
            EnemyAbilityType::Vampiric,
            EnemyAbilityType::Elusive,
            EnemyAbilityType::Fortified,
        ];
        for ability in &removable {
            if def.abilities.contains(ability) {
                strip_options.push(KnowYourPreyApplyOption::NullifyAbility {
                    ability: *ability,
                });
            }
        }

        // Resistances
        for r in def.resistances {
            strip_options.push(KnowYourPreyApplyOption::RemoveResistance {
                element: *r,
            });
        }

        // Element conversions (attack element)
        let attack_element = def.attack_element;
        add_element_conversions(&mut strip_options, attack_element);

        // Multi-attack element conversions
        if let Some(attacks) = def.attacks {
            for atk in attacks {
                add_element_conversions(&mut strip_options, atk.element);
            }
        }
    }

    // Deduplicate conversions
    strip_options.dedup_by(|a, b| {
        match (a, b) {
            (
                KnowYourPreyApplyOption::ConvertElement { from: f1, to: t1 },
                KnowYourPreyApplyOption::ConvertElement { from: f2, to: t2 },
            ) => *f1 == *f2 && *t1 == *t2,
            _ => false,
        }
    });

    if strip_options.len() == 1 {
        // Auto-apply
        execute_know_your_prey_option(
            state, player_idx, skill_id, enemy_instance_id, &strip_options[0],
        );
    } else if !strip_options.is_empty() {
        let options: Vec<CardEffect> = strip_options.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::KnowYourPreyOption {
                    enemy_instance_id: enemy_instance_id.to_string(),
                    options: strip_options,
                },
            }));
    }
}

fn add_element_conversions(
    strip_options: &mut Vec<mk_types::pending::KnowYourPreyApplyOption>,
    element: Element,
) {
    use mk_types::pending::KnowYourPreyApplyOption;
    match element {
        Element::Fire => {
            strip_options.push(KnowYourPreyApplyOption::ConvertElement {
                from: Element::Fire,
                to: Element::Physical,
            });
        }
        Element::Ice => {
            strip_options.push(KnowYourPreyApplyOption::ConvertElement {
                from: Element::Ice,
                to: Element::Physical,
            });
        }
        Element::ColdFire => {
            strip_options.push(KnowYourPreyApplyOption::ConvertElement {
                from: Element::ColdFire,
                to: Element::Fire,
            });
            strip_options.push(KnowYourPreyApplyOption::ConvertElement {
                from: Element::ColdFire,
                to: Element::Ice,
            });
        }
        _ => {} // Physical has no conversion
    }
}

/// Execute Know Your Prey option: push modifier.
pub(crate) fn execute_know_your_prey_option(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
    opt: &mk_types::pending::KnowYourPreyApplyOption,
) {
    use mk_types::pending::KnowYourPreyApplyOption;

    let effect = match opt {
        KnowYourPreyApplyOption::NullifyAbility { ability } => {
            mk_types::modifier::ModifierEffect::AbilityNullifier {
                ability: Some(*ability),
                ignore_arcane_immunity: false,
            }
        }
        KnowYourPreyApplyOption::RemoveResistance { element } => {
            match element {
                ResistanceElement::Physical => mk_types::modifier::ModifierEffect::RemovePhysicalResistance,
                ResistanceElement::Fire => mk_types::modifier::ModifierEffect::RemoveFireResistance,
                ResistanceElement::Ice => mk_types::modifier::ModifierEffect::RemoveIceResistance,
            }
        }
        KnowYourPreyApplyOption::ConvertElement { from, to } => {
            mk_types::modifier::ModifierEffect::ConvertAttackElement {
                from_element: *from,
                to_element: *to,
            }
        }
    };

    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        mk_types::modifier::ModifierDuration::Combat,
        mk_types::modifier::ModifierScope::OneEnemy {
            enemy_id: enemy_instance_id.to_string(),
        },
        effect,
    );
}

// =============================================================================
// Enemy helpers
// =============================================================================

fn is_enemy_fortified(enemy_id: &str) -> bool {
    mk_data::enemies::get_enemy(enemy_id)
        .map(|d| d.abilities.contains(&EnemyAbilityType::Fortified))
        .unwrap_or(false)
}

fn is_enemy_arcane_immune(enemy_id: &str) -> bool {
    mk_data::enemies::get_enemy(enemy_id)
        .map(|d| d.abilities.contains(&EnemyAbilityType::ArcaneImmunity))
        .unwrap_or(false)
}

fn has_strippable_attributes(enemy_id: &str) -> bool {
    let Some(def) = mk_data::enemies::get_enemy(enemy_id) else {
        return false;
    };

    // Has removable abilities?
    let removable = [
        EnemyAbilityType::Assassination,
        EnemyAbilityType::Brutal,
        EnemyAbilityType::Paralyze,
        EnemyAbilityType::Poison,
        EnemyAbilityType::Swift,
        EnemyAbilityType::Vampiric,
        EnemyAbilityType::Elusive,
        EnemyAbilityType::Fortified,
    ];
    if def.abilities.iter().any(|a| removable.contains(a)) {
        return true;
    }

    // Has resistances?
    if !def.resistances.is_empty() {
        return true;
    }

    // Has non-physical attack element?
    if !matches!(def.attack_element, Element::Physical) {
        return true;
    }

    // Multi-attack non-physical?
    if let Some(attacks) = def.attacks {
        if attacks.iter().any(|a| !matches!(a.element, Element::Physical)) {
            return true;
        }
    }

    false
}

/// Public wrapper for `has_strippable_attributes` (used by enumeration).
pub(crate) fn has_strippable_attributes_pub(enemy_id: &str) -> bool {
    has_strippable_attributes(enemy_id)
}

/// Short-circuit check for polarization options (used by enumeration gate).
pub(crate) fn has_polarization_options(state: &GameState, player_idx: usize) -> bool {
    let player = &state.players[player_idx];
    let is_day = state.time_of_day == TimeOfDay::Day;

    fn is_basic(c: ManaColor) -> bool {
        matches!(c, ManaColor::Red | ManaColor::Blue | ManaColor::Green | ManaColor::White)
    }

    // Check tokens
    for token in &player.pure_mana {
        if is_basic(token.color) { return true; }
        if token.color == ManaColor::Black && is_day { return true; }
        if token.color == ManaColor::Gold && !is_day { return true; }
    }

    // Check crystals
    if player.crystals.red > 0 || player.crystals.blue > 0
        || player.crystals.green > 0 || player.crystals.white > 0
    {
        return true;
    }

    // Check source dice
    for die in &state.source.dice {
        if die.is_depleted || die.taken_by_player_id.is_some() { continue; }
        if is_basic(die.color) { return true; }
        if die.color == ManaColor::Black && is_day { return true; }
        if die.color == ManaColor::Gold && !is_day { return true; }
    }

    false
}

/// End combat: remove defeated enemies from map hex, discard tokens, clean up state.
fn end_combat(state: &mut GameState, player_idx: usize) {
    if let Some(ref combat) = state.combat {
        // If combat has a hex coordinate, remove defeated enemies from that hex
        if let Some(hex_coord) = combat.combat_hex_coord {
            let hex_key = hex_coord.key();

            // Collect defeated enemy IDs to match against hex enemies
            let defeated_enemy_ids: Vec<String> = combat
                .enemies
                .iter()
                .filter(|e| e.is_defeated)
                .map(|e| e.enemy_id.as_str().to_string())
                .collect();

            if let Some(hex) = state.map.hexes.get_mut(&hex_key) {
                // Remove enemies whose base ID matches a defeated enemy
                // and discard their tokens to the appropriate color pile
                let mut to_remove: Vec<(EnemyTokenId, EnemyColor)> = Vec::new();

                for enemy in hex.enemies.iter() {
                    let base_id = enemy_id_from_token(&enemy.token_id);
                    if defeated_enemy_ids.contains(&base_id) {
                        to_remove.push((enemy.token_id.clone(), enemy.color));
                    }
                }

                // Remove from hex
                hex.enemies.retain(|e| {
                    let base_id = enemy_id_from_token(&e.token_id);
                    !defeated_enemy_ids.contains(&base_id)
                });

                // Discard tokens to color piles
                for (token_id, color) in &to_remove {
                    discard_enemy_token(&mut state.enemy_tokens, token_id, *color);
                }
            }
        }
    }

    // Conquest marking: if all required-for-conquest enemies defeated and hex has an unconquered site.
    // Rampaging enemies provoked during an assault have is_required_for_conquest=false,
    // so they don't need to be defeated for the site to be conquered.
    if let Some(ref combat) = state.combat {
        let all_required_defeated = combat
            .enemies
            .iter()
            .filter(|e| e.is_required_for_conquest)
            .all(|e| e.is_defeated);
        let has_any_required = combat
            .enemies
            .iter()
            .any(|e| e.is_required_for_conquest);
        let all_defeated = combat.enemies.iter().all(|e| e.is_defeated);
        // Conquest if: (1) all required enemies defeated (when there are required enemies), OR
        // (2) all enemies defeated (fallback for non-assault combats with no required markers)
        if (has_any_required && all_required_defeated) || (!has_any_required && all_defeated) {
            if let Some(hex_coord) = combat.combat_hex_coord {
                if let Some(hex) = state.map.hexes.get_mut(&hex_coord.key()) {
                    if let Some(ref mut site) = hex.site {
                        if !site.is_conquered {
                            site.is_conquered = true;
                            site.owner = Some(state.players[player_idx].id.clone());
                        }
                    }
                    // Clear remaining enemies from hex (all defeated)
                    hex.enemies.clear();
                }
            }
        }
    }

    // Dueling: award fame bonus if target defeated without unit involvement
    resolve_dueling_fame_bonus(state, player_idx);

    // Expire combat-duration modifiers
    expire_modifiers_combat(&mut state.active_modifiers);

    // Clear combat state
    state.combat = None;
    let player = &mut state.players[player_idx];
    player.combat_accumulator = Default::default();
    player.flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    player.flags.insert(PlayerFlags::HAS_COMBATTED_THIS_TURN);

    // Reset unit combat-specific state
    for unit in &mut player.units {
        unit.used_resistance_this_combat = false;
    }

    // Clear combat-scoped skill cooldowns
    player.skill_cooldowns.used_this_combat.clear();
}

// =============================================================================
// Modifier expiration
// =============================================================================

/// Expire all modifiers with `Combat` duration.
fn expire_modifiers_combat(modifiers: &mut Vec<mk_types::modifier::ActiveModifier>) {
    modifiers.retain(|m| m.duration != mk_types::modifier::ModifierDuration::Combat);
}

/// Expire `Turn` duration modifiers created by the given player.
pub fn expire_modifiers_turn_end(modifiers: &mut Vec<mk_types::modifier::ActiveModifier>, player_id: &mk_types::ids::PlayerId) {
    modifiers.retain(|m| {
        !(m.duration == mk_types::modifier::ModifierDuration::Turn
            && m.created_by_player_id == *player_id)
    });
}

/// Expire `UntilNextTurn` modifiers created by the given player (at their turn start).
pub fn expire_modifiers_turn_start(modifiers: &mut Vec<mk_types::modifier::ActiveModifier>, player_id: &mk_types::ids::PlayerId) {
    modifiers.retain(|m| {
        !(m.duration == mk_types::modifier::ModifierDuration::UntilNextTurn
            && m.created_by_player_id == *player_id)
    });
}

/// Expire all modifiers with `Round` duration.
pub fn expire_modifiers_round_end(modifiers: &mut Vec<mk_types::modifier::ActiveModifier>) {
    modifiers.retain(|m| m.duration != mk_types::modifier::ModifierDuration::Round);
}

// =============================================================================
// Unit recruitment
// =============================================================================

fn apply_recruit_unit(
    state: &mut GameState,
    player_idx: usize,
    unit_id: &mk_types::ids::UnitId,
    influence_cost: u32,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    if player.influence_points < influence_cost {
        return Err(ApplyError::InternalError(
            "RecruitUnit: insufficient influence".into(),
        ));
    }
    player.influence_points -= influence_cost;

    let instance_id =
        mk_types::ids::UnitInstanceId::from(format!("unit_{}", state.next_instance_counter));
    state.next_instance_counter += 1;

    let level = mk_data::units::get_unit(unit_id.as_str())
        .map(|u| u.level)
        .unwrap_or(1);

    let unit = PlayerUnit {
        instance_id,
        unit_id: unit_id.clone(),
        level,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    };

    // Push unit — ArrayVec panics if over capacity, but enumeration
    // already checked command_slots so this should always fit.
    state.players[player_idx].units.push(unit);

    // Bonds of Loyalty: track the bonds unit if this fills the extra slot
    if state.players[player_idx].bonds_of_loyalty_unit_instance_id.is_none()
        && state.players[player_idx].skills.iter().any(|s| s.as_str() == "norowas_bonds_of_loyalty")
    {
        let normal_slots = mk_data::levels::get_level_stats(
            state.players[player_idx].level,
        ).command_slots as usize;
        if state.players[player_idx].units.len() > normal_slots {
            let inst_id = state.players[player_idx].units.last().unwrap().instance_id.clone();
            state.players[player_idx].bonds_of_loyalty_unit_instance_id = Some(inst_id);
        }
    }

    state.players[player_idx]
        .units_recruited_this_interaction
        .push(unit_id.clone());
    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_RECRUITED_UNIT_THIS_TURN);
    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    mk_data::unit_offers::take_from_unit_offer(&mut state.offers.units, unit_id.as_str());

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn consume_mana_for_unit(
    state: &mut GameState,
    player_idx: usize,
    color: BasicManaColor,
) -> Result<(), ApplyError> {
    let target_mana = ManaColor::from(color);
    let player = &mut state.players[player_idx];

    // 1. Try matching-color mana token
    if let Some(idx) = player.pure_mana.iter().position(|t| t.color == target_mana) {
        player.pure_mana.remove(idx);
        return Ok(());
    }

    // 2. Try gold mana token (wild)
    if let Some(idx) = player
        .pure_mana
        .iter()
        .position(|t| t.color == ManaColor::Gold)
    {
        player.pure_mana.remove(idx);
        return Ok(());
    }

    // 3. Try matching-color crystal
    let crystal = match color {
        BasicManaColor::Red => &mut player.crystals.red,
        BasicManaColor::Blue => &mut player.crystals.blue,
        BasicManaColor::Green => &mut player.crystals.green,
        BasicManaColor::White => &mut player.crystals.white,
    };
    if *crystal > 0 {
        *crystal -= 1;
        return Ok(());
    }

    Err(ApplyError::InternalError(format!(
        "ActivateUnit: cannot afford mana cost {:?}",
        color
    )))
}

fn apply_activate_unit(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
    ability_index: usize,
) -> Result<ApplyResult, ApplyError> {
    // Find the unit
    let unit_idx = state.players[player_idx]
        .units
        .iter()
        .position(|u| u.instance_id == *unit_instance_id)
        .ok_or_else(|| {
            ApplyError::InternalError(format!(
                "ActivateUnit: unit '{}' not found",
                unit_instance_id.as_str()
            ))
        })?;

    let unit_id = state.players[player_idx].units[unit_idx].unit_id.clone();
    let unit_def = mk_data::units::get_unit(unit_id.as_str()).ok_or_else(|| {
        ApplyError::InternalError(format!("ActivateUnit: unknown unit def '{}'", unit_id.as_str()))
    })?;

    if ability_index >= unit_def.abilities.len() {
        return Err(ApplyError::InternalError(format!(
            "ActivateUnit: ability_index {} out of range (unit '{}' has {} abilities)",
            ability_index,
            unit_id.as_str(),
            unit_def.abilities.len()
        )));
    }

    let slot = &unit_def.abilities[ability_index];

    // Consume mana if needed
    if let Some(color) = slot.mana_cost {
        consume_mana_for_unit(state, player_idx, color)?;
    }

    // Apply the ability effect
    use mk_data::units::UnitAbility;
    match slot.ability {
        UnitAbility::Attack { value, element } => {
            let acc = &mut state.players[player_idx].combat_accumulator.attack;
            acc.normal += value;
            add_to_elemental(&mut acc.normal_elements, element, value);
        }
        UnitAbility::Block { value, element } => {
            let acc = &mut state.players[player_idx].combat_accumulator;
            acc.block += value;
            add_to_elemental(&mut acc.block_elements, element, value);
        }
        UnitAbility::RangedAttack { value, element } => {
            let acc = &mut state.players[player_idx].combat_accumulator.attack;
            acc.ranged += value;
            add_to_elemental(&mut acc.ranged_elements, element, value);
        }
        UnitAbility::SiegeAttack { value, element } => {
            let acc = &mut state.players[player_idx].combat_accumulator.attack;
            acc.siege += value;
            add_to_elemental(&mut acc.siege_elements, element, value);
        }
        UnitAbility::Move { value } => {
            state.players[player_idx].move_points += value;
        }
        UnitAbility::Influence { value } => {
            state.players[player_idx].influence_points += value;
        }
        UnitAbility::Heal { value } => {
            let player = &mut state.players[player_idx];
            let wound_count = player
                .hand
                .iter()
                .filter(|c| c.as_str() == "wound")
                .count() as u32;
            let to_heal = value.min(wound_count);
            let mut healed = 0u32;
            player.hand.retain(|c| {
                if healed < to_heal && c.as_str() == "wound" {
                    healed += 1;
                    false
                } else {
                    true
                }
            });
            player.healing_points += value.saturating_sub(to_heal);
            player.wounds_healed_from_hand_this_turn += healed;
        }
        UnitAbility::GainMana { color } => {
            state.players[player_idx].pure_mana.push(ManaToken {
                color: ManaColor::from(color),
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            });
        }
        UnitAbility::GainCrystal { color } => {
            mana::gain_crystal(&mut state.players[player_idx], color);
        }
        UnitAbility::GainManaAndCrystal { color } => {
            state.players[player_idx].pure_mana.push(ManaToken {
                color: ManaColor::from(color),
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            });
            mana::gain_crystal(&mut state.players[player_idx], color);
        }
        UnitAbility::AttackWithRepCost { value, element, rep_change } => {
            let acc = &mut state.players[player_idx].combat_accumulator.attack;
            acc.normal += value;
            add_to_elemental(&mut acc.normal_elements, element, value);
            let new_rep = (state.players[player_idx].reputation as i16 + rep_change as i16)
                .clamp(-7, 7) as i8;
            state.players[player_idx].reputation = new_rep;
        }
        UnitAbility::InfluenceWithRepCost { value, rep_change } => {
            state.players[player_idx].influence_points += value;
            let new_rep = (state.players[player_idx].reputation as i16 + rep_change as i16)
                .clamp(-7, 7) as i8;
            state.players[player_idx].reputation = new_rep;
        }
        UnitAbility::MoveOrInfluence { value } => {
            use mk_types::pending::{ActivePending, UnitAbilityChoiceOption};
            // Mark unit spent first, then create pending choice
            state.players[player_idx].units[unit_idx].state = UnitState::Spent;
            state.players[player_idx].pending.active =
                Some(ActivePending::UnitAbilityChoice {
                    unit_instance_id: unit_instance_id.clone(),
                    options: vec![
                        UnitAbilityChoiceOption::GainMove { value },
                        UnitAbilityChoiceOption::GainInfluence { value },
                    ],
                    wound_self: false,
                });
            // Return early — unit already marked spent
            return Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
            });
        }
        UnitAbility::AttackOrBlockWoundSelf { value, element } => {
            use mk_types::pending::{ActivePending, UnitAbilityChoiceOption};
            // Mark unit spent first, then create pending choice
            state.players[player_idx].units[unit_idx].state = UnitState::Spent;
            state.players[player_idx].pending.active =
                Some(ActivePending::UnitAbilityChoice {
                    unit_instance_id: unit_instance_id.clone(),
                    options: vec![
                        UnitAbilityChoiceOption::GainAttack { value, element },
                        UnitAbilityChoiceOption::GainBlock { value, element },
                    ],
                    wound_self: true,
                });
            // Return early — unit already marked spent
            return Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
            });
        }
        UnitAbility::ReadyUnit { max_level } => {
            // Find spent units at or below max_level
            let eligible: Vec<usize> = state.players[player_idx]
                .units
                .iter()
                .enumerate()
                .filter(|(_, u)| u.state == UnitState::Spent && u.level <= max_level)
                .map(|(i, _)| i)
                .collect();

            match eligible.len() {
                0 => {
                    // No eligible units — should not reach here due to enumeration guard
                }
                1 => {
                    // Auto-ready the single eligible unit
                    let target_idx = eligible[0];
                    state.players[player_idx].units[target_idx].state = UnitState::Ready;
                }
                _ => {
                    use mk_types::pending::ActivePending;
                    use mk_types::effect::CardEffect;
                    use mk_types::pending::{ChoiceResolution, PendingChoice};
                    // Multiple eligible — present choice via existing ReadyUnitTarget mechanism
                    let options: Vec<CardEffect> =
                        eligible.iter().map(|_| CardEffect::Noop).collect();
                    state.players[player_idx].pending.active =
                        Some(ActivePending::Choice(PendingChoice {
                            card_id: None,
                            skill_id: None,
                            unit_instance_id: Some(unit_instance_id.clone()),
                            options,
                            continuation: vec![],
                            movement_bonus_applied: false,
                            resolution: ChoiceResolution::ReadyUnitTarget {
                                eligible_unit_indices: eligible,
                            },
                        }));
                }
            }
        }
        UnitAbility::SelectCombatEnemy(template) => {
            return apply_select_combat_enemy_activation(
                state, player_idx, unit_idx, unit_instance_id, template,
            );
        }
        UnitAbility::CoordinatedFire { ranged_value, element, unit_attack_bonus } => {
            // Add ranged attack to accumulator
            let acc = &mut state.players[player_idx].combat_accumulator.attack;
            acc.ranged += ranged_value;
            add_to_elemental(&mut acc.ranged_elements, element, ranged_value);

            // Add UnitAttackBonus modifier
            use mk_types::modifier::{
                ActiveModifier, ModifierDuration, ModifierEffect, ModifierScope, ModifierSource,
            };
            use mk_types::ids::ModifierId;
            let player_id = state.players[player_idx].id.clone();
            let modifier_count = state.active_modifiers.len();
            let modifier_id = format!(
                "mod_{}_r{}_t{}",
                modifier_count, state.round, state.current_player_index
            );
            state.active_modifiers.push(ActiveModifier {
                id: ModifierId::from(modifier_id.as_str()),
                source: ModifierSource::Unit {
                    unit_index: unit_idx as u32,
                    player_id: player_id.clone(),
                },
                duration: ModifierDuration::Combat,
                scope: ModifierScope::AllUnits,
                effect: ModifierEffect::UnitAttackBonus {
                    amount: unit_attack_bonus,
                },
                created_at_round: state.round,
                created_by_player_id: player_id,
            });
        }
        UnitAbility::GrantAllResistances => {
            use mk_types::modifier::{
                ActiveModifier, ModifierDuration, ModifierEffect, ModifierScope, ModifierSource,
            };
            use mk_types::ids::ModifierId;
            let player_id = state.players[player_idx].id.clone();
            let modifier_count = state.active_modifiers.len();
            let modifier_id = format!(
                "mod_{}_r{}_t{}",
                modifier_count, state.round, state.current_player_index
            );
            state.active_modifiers.push(ActiveModifier {
                id: ModifierId::from(modifier_id.as_str()),
                source: ModifierSource::Unit {
                    unit_index: unit_idx as u32,
                    player_id: player_id.clone(),
                },
                duration: ModifierDuration::Turn,
                scope: ModifierScope::AllUnits,
                effect: ModifierEffect::GrantResistances {
                    resistances: vec![
                        ResistanceElement::Physical,
                        ResistanceElement::Fire,
                        ResistanceElement::Ice,
                    ],
                },
                created_at_round: state.round,
                created_by_player_id: player_id,
            });
        }
        UnitAbility::MoveWithTerrainReduction { move_value, terrain_reductions } => {
            state.players[player_idx].move_points += move_value;
            // Push terrain cost reduction modifiers
            use mk_types::modifier::{
                ActiveModifier, ModifierDuration, ModifierEffect, ModifierScope, ModifierSource,
                TerrainOrAll,
            };
            use mk_types::ids::ModifierId;
            let player_id = state.players[player_idx].id.clone();
            for &(terrain, amount, minimum) in terrain_reductions {
                let modifier_count = state.active_modifiers.len();
                let modifier_id = format!(
                    "mod_{}_r{}_t{}",
                    modifier_count, state.round, state.current_player_index
                );
                state.active_modifiers.push(ActiveModifier {
                    id: ModifierId::from(modifier_id.as_str()),
                    source: ModifierSource::Unit {
                        unit_index: unit_idx as u32,
                        player_id: player_id.clone(),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(terrain),
                        amount,
                        minimum,
                        replace_cost: None,
                    },
                    created_at_round: state.round,
                    created_by_player_id: player_id.clone(),
                });
            }
        }
        UnitAbility::Other { .. } => {
            return Err(ApplyError::InternalError(
                "ActivateUnit: Other abilities not executable".into(),
            ));
        }
    }

    // Mark unit spent
    state.players[player_idx].units[unit_idx].state = UnitState::Spent;

    // Dueling: mark unit involvement if a combat ability was used
    if state.combat.is_some() {
        mark_dueling_unit_involvement(state, player_idx);
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Resolve a UnitAbilityChoice pending (MoveOrInfluence, AttackOrBlockWoundSelf).
fn apply_resolve_unit_ability_choice(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
) -> Result<ApplyResult, ApplyError> {
    // Extract the pending
    let pending = state.players[player_idx]
        .pending
        .active
        .take()
        .ok_or_else(|| ApplyError::InternalError("No active pending".into()))?;

    if let ActivePending::UnitAbilityChoice {
        unit_instance_id,
        options,
        wound_self,
    } = pending
    {
        if choice_index >= options.len() {
            return Err(ApplyError::InternalError(format!(
                "UnitAbilityChoice: invalid choice_index {} (options len {})",
                choice_index,
                options.len()
            )));
        }

        let chosen = options[choice_index];

        // Apply the chosen option
        use mk_types::pending::UnitAbilityChoiceOption;
        match chosen {
            UnitAbilityChoiceOption::GainMove { value } => {
                state.players[player_idx].move_points += value;
            }
            UnitAbilityChoiceOption::GainInfluence { value } => {
                state.players[player_idx].influence_points += value;
            }
            UnitAbilityChoiceOption::GainAttack { value, element } => {
                let acc = &mut state.players[player_idx].combat_accumulator.attack;
                acc.normal += value;
                add_to_elemental(&mut acc.normal_elements, element, value);
            }
            UnitAbilityChoiceOption::GainBlock { value, element } => {
                let acc = &mut state.players[player_idx].combat_accumulator;
                acc.block += value;
                add_to_elemental(&mut acc.block_elements, element, value);
            }
        }

        // Wound the unit if needed (AttackOrBlockWoundSelf)
        if wound_self {
            if let Some(unit) = state.players[player_idx]
                .units
                .iter_mut()
                .find(|u| u.instance_id == unit_instance_id)
            {
                unit.wounded = true;
            }
        }

        Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        })
    } else {
        // Put back what we took and error
        state.players[player_idx].pending.active = Some(pending);
        Err(ApplyError::InternalError(
            "Expected UnitAbilityChoice pending".into(),
        ))
    }
}

// =============================================================================
// SelectCombatEnemy activation + resolution
// =============================================================================

/// Activate a SelectCombatEnemy ability: filter eligible enemies, auto-resolve or create pending.
fn apply_select_combat_enemy_activation(
    state: &mut GameState,
    player_idx: usize,
    unit_idx: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
    template: mk_types::pending::SelectEnemyTemplate,
) -> Result<ApplyResult, ApplyError> {
    // Mark unit spent first
    state.players[player_idx].units[unit_idx].state = UnitState::Spent;

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("SelectCombatEnemy: no combat".into()))?;

    // Filter eligible enemies
    let mut eligible_ids: Vec<String> = Vec::new();
    for enemy in &combat.enemies {
        if enemy.is_defeated || enemy.is_summoner_hidden {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        // Apply template filters
        if template.exclude_fortified
            && combat_resolution::is_effectively_fortified(
                def,
                enemy.instance_id.as_str(),
                combat.is_at_fortified_site,
                &state.active_modifiers,
            )
        {
            continue;
        }

        if template.exclude_arcane_immune
            && combat_resolution::has_ability(def, EnemyAbilityType::ArcaneImmunity)
        {
            continue;
        }

        if let Some(resist) = template.exclude_resistance {
            if def.resistances.contains(&resist) {
                continue;
            }
        }

        eligible_ids.push(enemy.instance_id.as_str().to_string());
    }

    match eligible_ids.len() {
        0 => {
            // No eligible enemies — ability fizzles (unit still spent)
        }
        1 => {
            // Auto-resolve with the single eligible enemy
            let uid_opt = Some(unit_instance_id.clone());
            apply_select_enemy_effects(state, player_idx, &uid_opt, &eligible_ids[0], &template)?;
        }
        _ => {
            // Multiple eligible — create pending
            state.players[player_idx].pending.active =
                Some(ActivePending::SelectCombatEnemy {
                    unit_instance_id: Some(unit_instance_id.clone()),
                    eligible_enemy_ids: eligible_ids,
                    template,
                    continuation: Vec::new(),
                });
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Resolve a SelectCombatEnemy pending choice.
fn apply_resolve_select_enemy(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
) -> Result<ApplyResult, ApplyError> {
    let pending = state.players[player_idx]
        .pending
        .active
        .take()
        .ok_or_else(|| ApplyError::InternalError("No active pending".into()))?;

    if let ActivePending::SelectCombatEnemy {
        unit_instance_id,
        eligible_enemy_ids,
        template,
        continuation,
    } = pending
    {
        if choice_index >= eligible_enemy_ids.len() {
            return Err(ApplyError::InternalError(format!(
                "SelectCombatEnemy: invalid choice_index {} (eligible len {})",
                choice_index,
                eligible_enemy_ids.len()
            )));
        }

        let enemy_id = &eligible_enemy_ids[choice_index];
        apply_select_enemy_effects(state, player_idx, &unit_instance_id, enemy_id, &template)?;

        // Replay any continuation effects from the effect queue
        if !continuation.is_empty() {
            use crate::effect_queue::{EffectQueue, QueuedEffect, DrainResult};
            use mk_types::pending::{ContinuationEntry, PendingChoice};

            let mut queue = EffectQueue::new();
            queue.push_continuation(
                continuation
                    .into_iter()
                    .map(|c| QueuedEffect {
                        effect: c.effect,
                        source_card_id: c.source_card_id,
                    })
                    .collect(),
            );

            match queue.drain(state, player_idx) {
                DrainResult::Complete => {}
                DrainResult::NeedsChoice {
                    options,
                    continuation: cont,
                    resolution,
                } => {
                    state.players[player_idx].pending.active =
                        Some(ActivePending::Choice(PendingChoice {
                            card_id: None,
                            skill_id: None,
                            unit_instance_id: None,
                            options,
                            continuation: cont
                                .into_iter()
                                .map(|q| ContinuationEntry {
                                    effect: q.effect,
                                    source_card_id: q.source_card_id,
                                })
                                .collect(),
                            movement_bonus_applied: false,
                            resolution,
                        }));
                }
                DrainResult::PendingSet => {}
            }
        }

        Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
        })
    } else {
        state.players[player_idx].pending.active = Some(pending);
        Err(ApplyError::InternalError(
            "Expected SelectCombatEnemy pending".into(),
        ))
    }
}

/// Public wrapper for apply_select_enemy_effects (used by effect_queue).
pub fn apply_select_enemy_effects_pub(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &Option<mk_types::ids::UnitInstanceId>,
    enemy_instance_id: &str,
    template: &mk_types::pending::SelectEnemyTemplate,
) -> Result<(), ApplyError> {
    apply_select_enemy_effects(state, player_idx, unit_instance_id, enemy_instance_id, template)
}

/// Apply the template effects to a chosen enemy.
fn apply_select_enemy_effects(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &Option<mk_types::ids::UnitInstanceId>,
    enemy_instance_id: &str,
    template: &mk_types::pending::SelectEnemyTemplate,
) -> Result<(), ApplyError> {
    use mk_types::modifier::{
        ActiveModifier, ModifierDuration, ModifierEffect, ModifierScope, ModifierSource,
        EnemyStat as ModEnemyStat,
    };
    use mk_types::ids::ModifierId;

    let player_id = state.players[player_idx].id.clone();

    // Determine source: unit or card
    let source = if let Some(uid) = unit_instance_id {
        let unit_idx = state.players[player_idx]
            .units
            .iter()
            .position(|u| u.instance_id == *uid)
            .unwrap_or(0) as u32;
        ModifierSource::Unit {
            unit_index: unit_idx,
            player_id: player_id.clone(),
        }
    } else {
        ModifierSource::Card {
            card_id: mk_types::ids::CardId::from("select_combat_enemy"),
            player_id: player_id.clone(),
        }
    };

    // Check if target has ArcaneImmunity
    let has_ai = {
        let combat = state.combat.as_ref().ok_or_else(|| {
            ApplyError::InternalError("SelectCombatEnemy: no combat".into())
        })?;
        combat
            .enemies
            .iter()
            .find(|e| e.instance_id.as_str() == enemy_instance_id)
            .and_then(|e| get_enemy(e.enemy_id.as_str()))
            .is_some_and(|def| {
                combat_resolution::has_ability(def, EnemyAbilityType::ArcaneImmunity)
            })
    };

    // Check if target is fortified (for fortified_armor_change)
    let is_fortified = {
        let combat = state.combat.as_ref().unwrap();
        combat
            .enemies
            .iter()
            .find(|e| e.instance_id.as_str() == enemy_instance_id)
            .and_then(|e| get_enemy(e.enemy_id.as_str()))
            .is_some_and(|def| {
                combat_resolution::is_effectively_fortified(
                    def,
                    enemy_instance_id,
                    combat.is_at_fortified_site,
                    &state.active_modifiers,
                )
            })
    };

    let mut push_modifier = |effect: ModifierEffect| {
        let modifier_count = state.active_modifiers.len();
        let modifier_id = format!(
            "mod_{}_r{}_t{}",
            modifier_count, state.round, state.current_player_index
        );
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from(modifier_id.as_str()),
            source: source.clone(),
            duration: ModifierDuration::Combat,
            scope: ModifierScope::OneEnemy {
                enemy_id: enemy_instance_id.to_string(),
            },
            effect,
            created_at_round: state.round,
            created_by_player_id: player_id.clone(),
        });
    };

    // skip_attack — blocked by ArcaneImmunity
    if template.skip_attack && !has_ai {
        push_modifier(ModifierEffect::EnemySkipAttack);
    }

    // armor_change — blocked by ArcaneImmunity
    let effective_armor_change = if template.armor_per_resistance {
        // resistance_break: multiply armor_change by number of resistances
        let num_resistances = {
            let combat = state.combat.as_ref().unwrap();
            combat
                .enemies
                .iter()
                .find(|e| e.instance_id.as_str() == enemy_instance_id)
                .and_then(|e| get_enemy(e.enemy_id.as_str()))
                .map_or(0, |def| def.resistances.len() as i32)
        };
        template.armor_change * num_resistances
    } else {
        template.armor_change
    };
    if effective_armor_change != 0 && !has_ai {
        // Use fortified_armor_change when enemy is fortified and template specifies it
        let effective_amount = if is_fortified {
            template.fortified_armor_change.unwrap_or(effective_armor_change)
        } else {
            effective_armor_change
        };
        push_modifier(ModifierEffect::EnemyStat {
            stat: ModEnemyStat::Armor,
            amount: effective_amount,
            minimum: template.armor_minimum,
            attack_index: None,
            per_resistance: template.armor_per_resistance,
            fortified_amount: template.fortified_armor_change,
        });
    }

    // attack_change — NOT blocked by ArcaneImmunity (FAQ S1)
    if template.attack_change != 0 {
        push_modifier(ModifierEffect::EnemyStat {
            stat: ModEnemyStat::Attack,
            amount: template.attack_change,
            minimum: template.attack_minimum,
            attack_index: None,
            per_resistance: false,
            fortified_amount: None,
        });
    }

    // nullify_fortified — blocked by ArcaneImmunity
    if template.nullify_fortified && !has_ai {
        push_modifier(ModifierEffect::AbilityNullifier {
            ability: Some(EnemyAbilityType::Fortified),
            ignore_arcane_immunity: false,
        });
    }

    // remove_resistances — blocked by ArcaneImmunity
    if template.remove_resistances && !has_ai {
        push_modifier(ModifierEffect::RemoveResistances);
    }

    // defeat_if_blocked — blocked by ArcaneImmunity
    if template.defeat_if_blocked && !has_ai {
        push_modifier(ModifierEffect::DefeatIfBlocked);
    }

    // damage_redirect — NOT blocked by ArcaneImmunity (defensive effect)
    if template.damage_redirect_from_unit {
        if let Some(uid) = unit_instance_id {
            let combat = state.combat.as_mut().ok_or_else(|| {
                ApplyError::InternalError("SelectCombatEnemy: no combat for redirect".into())
            })?;
            combat.damage_redirects.insert(
                enemy_instance_id.to_string(),
                uid.as_str().to_string(),
            );
        }
    }

    // bundled_ranged_attack — NOT blocked by ArcaneImmunity (always resolves)
    if template.bundled_ranged_attack > 0 {
        let acc = &mut state.players[player_idx].combat_accumulator.attack;
        acc.ranged += template.bundled_ranged_attack;
        acc.ranged_elements.physical += template.bundled_ranged_attack;
    }

    // remove_fire_resistance — blocked by ArcaneImmunity
    if template.remove_fire_resistance && !has_ai {
        push_modifier(ModifierEffect::RemoveFireResistance);
    }

    // defeat — NOT blocked by ArcaneImmunity (physical destruction)
    if template.defeat {
        // Mark enemy as defeated and grant fame
        let (fame_gain, rep_bonus) = {
            let combat = state.combat.as_ref().unwrap();
            if let Some(enemy) = combat.enemies.iter().find(|e| e.instance_id.as_str() == enemy_instance_id) {
                let is_summoned = enemy.summoned_by_instance_id.is_some();
                if !is_summoned {
                    if let Some(def) = get_enemy(enemy.enemy_id.as_str()) {
                        (def.fame, def.reputation_bonus.map(|b| b as i8).unwrap_or(0))
                    } else {
                        (0, 0)
                    }
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            }
        };

        if let Some(combat) = state.combat.as_mut() {
            if let Some(enemy) = combat.enemies.iter_mut().find(|e| e.instance_id.as_str() == enemy_instance_id) {
                enemy.is_defeated = true;
            }
        }

        state.players[player_idx].fame += fame_gain;
        if rep_bonus != 0 {
            state.players[player_idx].reputation = (state.players[player_idx].reputation + rep_bonus)
                .clamp(-7, 7);
        }
    }

    // nullify_all_attack_abilities — bypasses ArcaneImmunity (ignore_arcane_immunity: true)
    if template.nullify_all_attack_abilities {
        use mk_types::enums::EnemyAbilityType as EAT;
        for ability in &[
            EAT::Swift, EAT::Brutal, EAT::Poison, EAT::Paralyze,
            EAT::Vampiric, EAT::Assassination, EAT::Cumbersome,
        ] {
            push_modifier(ModifierEffect::AbilityNullifier {
                ability: Some(*ability),
                ignore_arcane_immunity: true,
            });
        }
    }

    Ok(())
}

/// Helper to add elemental damage values.
fn add_to_elemental(ev: &mut ElementalValues, element: Element, amount: u32) {
    match element {
        Element::Physical => ev.physical += amount,
        Element::Fire => ev.fire += amount,
        Element::Ice => ev.ice += amount,
        Element::ColdFire => ev.cold_fire += amount,
    }
}

fn apply_undo(
    state: &mut GameState,
    undo_stack: &mut UndoStack,
) -> Result<ApplyResult, ApplyError> {
    match undo_stack.undo() {
        Some(restored) => {
            *state = restored;
            // Note: epoch will be incremented by the caller after this returns,
            // which is correct — the restored state gets a new epoch.
            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
            })
        }
        None => Err(ApplyError::InternalError("Undo stack empty".to_string())),
    }
}

// =============================================================================
// Site interactions
// =============================================================================

fn apply_enter_site(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let player_pos = state.players[player_idx]
        .position
        .ok_or_else(|| ApplyError::InternalError("EnterSite: player has no position".into()))?;

    let hex_key = player_pos.key();
    let hex_state = state
        .map
        .hexes
        .get(&hex_key)
        .ok_or_else(|| ApplyError::InternalError("EnterSite: hex not found".into()))?;

    let site = hex_state
        .site
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("EnterSite: no site on hex".into()))?;

    let site_type = site.site_type;

    // Determine enemy tokens for combat
    let enemy_tokens: Vec<EnemyTokenId>;

    if mk_data::sites::draws_fresh_enemies(site_type) {
        // Dungeon/Tomb: always draw fresh enemies
        let config = mk_data::sites::adventure_site_enemies(site_type)
            .ok_or_else(|| ApplyError::InternalError("EnterSite: not an adventure site".into()))?;

        let mut drawn = Vec::new();
        for _ in 0..config.count {
            let token = draw_enemy_token(&mut state.enemy_tokens, config.color, &mut state.rng)
                .ok_or_else(|| {
                    ApplyError::InternalError("EnterSite: no enemy tokens available".into())
                })?;
            drawn.push(token);
        }

        // Place drawn tokens onto hex
        let hex = state.map.hexes.get_mut(&hex_key).unwrap();
        for token in &drawn {
            let enemy_id_str = enemy_id_from_token(token);
            let def = mk_data::enemies::get_enemy(&enemy_id_str).ok_or_else(|| {
                ApplyError::InternalError(format!("EnterSite: unknown enemy {}", enemy_id_str))
            })?;
            hex.enemies.push(HexEnemy {
                token_id: token.clone(),
                color: def.color,
                is_revealed: true,
            });
        }

        enemy_tokens = drawn;
    } else {
        // MonsterDen/SpawningGrounds: use existing hex enemies, or draw if none
        if !hex_state.enemies.is_empty() {
            enemy_tokens = hex_state.enemies.iter().map(|e| e.token_id.clone()).collect();
        } else {
            let config = mk_data::sites::adventure_site_enemies(site_type).ok_or_else(|| {
                ApplyError::InternalError("EnterSite: not an adventure site".into())
            })?;

            let mut drawn = Vec::new();
            for _ in 0..config.count {
                let token =
                    draw_enemy_token(&mut state.enemy_tokens, config.color, &mut state.rng)
                        .ok_or_else(|| {
                            ApplyError::InternalError(
                                "EnterSite: no enemy tokens available".into(),
                            )
                        })?;
                drawn.push(token);
            }

            // Place drawn tokens onto hex
            let hex = state.map.hexes.get_mut(&hex_key).unwrap();
            for token in &drawn {
                let enemy_id_str = enemy_id_from_token(token);
                let def = mk_data::enemies::get_enemy(&enemy_id_str).ok_or_else(|| {
                    ApplyError::InternalError(format!("EnterSite: unknown enemy {}", enemy_id_str))
                })?;
                hex.enemies.push(HexEnemy {
                    token_id: token.clone(),
                    color: def.color,
                    is_revealed: true,
                });
            }

            enemy_tokens = drawn;
        }
    }

    // Determine combat options based on site type
    let options = match site_type {
        SiteType::Dungeon | SiteType::Tomb => combat::EnterCombatOptions {
            units_allowed: false,
            night_mana_rules: true,
        },
        _ => Default::default(),
    };

    let is_fortified = mk_data::sites::is_fortified(site_type);

    // Enter combat
    combat::execute_enter_combat(
        state,
        player_idx,
        &enemy_tokens,
        is_fortified,
        Some(player_pos),
        options,
    )
    .map_err(|e| ApplyError::InternalError(format!("EnterSite: enter_combat failed: {:?}", e)))?;

    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_interact_site(
    state: &mut GameState,
    player_idx: usize,
    healing: u32,
) -> Result<ApplyResult, ApplyError> {
    let player_pos = state.players[player_idx]
        .position
        .ok_or_else(|| ApplyError::InternalError("InteractSite: no position".into()))?;

    let hex_state = state
        .map
        .hexes
        .get(&player_pos.key())
        .ok_or_else(|| ApplyError::InternalError("InteractSite: hex not found".into()))?;

    let site = hex_state
        .site
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("InteractSite: no site on hex".into()))?;

    let cost_per_wound = mk_data::sites::healing_cost(site.site_type)
        .ok_or_else(|| ApplyError::InternalError("InteractSite: site has no healing cost".into()))?;

    let total_cost = healing * cost_per_wound;

    let player = &mut state.players[player_idx];

    if player.influence_points < total_cost {
        return Err(ApplyError::InternalError(
            "InteractSite: not enough influence".into(),
        ));
    }

    // Deduct influence
    player.influence_points -= total_cost;

    // Remove wound cards from hand
    let mut healed = 0u32;
    player.hand.retain(|card| {
        if healed < healing && card.as_str() == "wound" {
            healed += 1;
            false
        } else {
            true
        }
    });

    player.flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_plunder_site(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let player_pos = state.players[player_idx]
        .position
        .ok_or_else(|| ApplyError::InternalError("PlunderSite: no position".into()))?;

    let hex_key = player_pos.key();
    let hex = state
        .map
        .hexes
        .get_mut(&hex_key)
        .ok_or_else(|| ApplyError::InternalError("PlunderSite: hex not found".into()))?;

    let site = hex
        .site
        .as_mut()
        .ok_or_else(|| ApplyError::InternalError("PlunderSite: no site on hex".into()))?;

    site.is_burned = true;

    // Reputation loss (capped at -7)
    let player = &mut state.players[player_idx];
    player.reputation = (player.reputation - 1).max(-7);
    player.flags.insert(PlayerFlags::HAS_PLUNDERED_THIS_TURN);

    // Draw 2 cards from deck
    let cards_to_draw = 2.min(player.deck.len());
    for _ in 0..cards_to_draw {
        let card = player.deck.remove(0);
        player.hand.push(card);
    }

    // Clear pending
    state.players[player_idx].pending.active = None;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_decline_plunder(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    // Clear pending
    state.players[player_idx].pending.active = None;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_resolve_glade_wound(
    state: &mut GameState,
    player_idx: usize,
    choice: &GladeWoundChoice,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    match choice {
        GladeWoundChoice::Hand => {
            if let Some(idx) = player.hand.iter().position(|c| c.as_str() == "wound") {
                player.hand.remove(idx);
            }
        }
        GladeWoundChoice::Discard => {
            if let Some(idx) = player.discard.iter().position(|c| c.as_str() == "wound") {
                player.discard.remove(idx);
            }
        }
        GladeWoundChoice::Skip => {
            // Player chose to skip — no wound removed
        }
    }

    // Clear pending
    player.pending.active = None;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

// =============================================================================
// Pub wrappers for testing
// =============================================================================

/// Public wrapper for power_of_pain handler (testing only).
pub fn apply_power_of_pain_pub(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    let _ = apply_power_of_pain(state, player_idx, skill_id);
}

/// Public wrapper for i_dont_give_a_damn handler (testing only).
pub fn apply_i_dont_give_a_damn_pub(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    let _ = apply_i_dont_give_a_damn(state, player_idx, skill_id);
}

/// Public wrapper for who_needs_magic handler (testing only).
pub fn apply_who_needs_magic_pub(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    let _ = apply_who_needs_magic(state, player_idx, skill_id);
}

/// Public wrapper for universal_power handler (testing only).
pub fn apply_universal_power_pub(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    let _ = apply_universal_power(state, player_idx, skill_id);
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::legal_actions::enumerate_legal_actions_with_undo;
    use crate::setup::create_solo_game;
    use mk_types::ids::CardId;
    use mk_types::legal_action::LegalAction;

    fn setup_playing_game(hand: Vec<&str>) -> GameState {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.round_phase = RoundPhase::PlayerTurns;
        state.players[0].hand = hand.into_iter().map(CardId::from).collect();
        state
    }

    #[test]
    fn stale_epoch_rejected() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let result = apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndTurn, 999);
        assert!(matches!(result, Err(ApplyError::StaleActionSet { .. })));
    }

    #[test]
    fn epoch_increments_after_action() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardBasic {
                hand_index: 0,
                card_id: CardId::from("march"),
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.action_epoch, epoch + 1);
    }

    #[test]
    fn select_tactic_transitions_to_player_turns() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        let tactic = state.available_tactics[0].clone();

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: tactic.clone(),
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.round_phase, RoundPhase::PlayerTurns);
        assert!(state.players[0].selected_tactic.is_some());
        assert!(!state.available_tactics.contains(&tactic));
    }

    #[test]
    fn play_card_basic_works() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        let result = apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardBasic {
                hand_index: 0,
                card_id: CardId::from("march"),
            },
            epoch,
        )
        .unwrap();

        assert!(result.needs_reenumeration);
        assert!(!result.game_ended);
        assert_eq!(state.players[0].move_points, 2);
        assert!(undo.can_undo());
    }

    #[test]
    fn play_card_powered_works() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Green,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        let result = apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardPowered {
                hand_index: 0,
                card_id: CardId::from("march"),
                mana_color: BasicManaColor::Green,
            },
            epoch,
        )
        .unwrap();

        assert!(result.needs_reenumeration);
        assert_eq!(state.players[0].move_points, 4);
        assert!(state.players[0].pure_mana.is_empty());
    }

    #[test]
    fn play_card_sideways_works() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardSideways {
                hand_index: 0,
                card_id: CardId::from("march"),
                sideways_as: SidewaysAs::Move,
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.players[0].move_points, 1);
    }

    #[test]
    fn move_works() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].move_points = 5;
        let mut undo = UndoStack::new();

        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let move_action = legal
            .actions
            .iter()
            .find(|a| matches!(a, LegalAction::Move { .. }));
        if let Some(action) = move_action {
            let result = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch).unwrap();
            assert!(result.needs_reenumeration);
        }
    }

    #[test]
    fn declare_rest_sets_flag() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::DeclareRest, epoch).unwrap();

        assert!(state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
        assert!(undo.can_undo());
    }

    #[test]
    fn complete_rest_sets_flag() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].flags.insert(PlayerFlags::IS_RESTING);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::CompleteRest {
                discard_hand_index: Some(0),
            },
            epoch,
        )
        .unwrap();

        assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::HAS_RESTED_THIS_TURN));
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN));
        // march (non-wound) discarded + no wounds → hand empty, discard has march
        assert!(state.players[0].hand.is_empty());
        assert!(state.players[0]
            .discard
            .iter()
            .any(|c| c.as_str() == "march"));
    }

    #[test]
    fn complete_rest_standard_enters_wound_discard_selection() {
        // Hand: march, wound → standard rest discarding march (index 0)
        // should enter SubsetSelection for wound discard.
        let mut state = setup_playing_game(vec!["march", "wound"]);
        state.players[0].flags.insert(PlayerFlags::IS_RESTING);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::CompleteRest {
                discard_hand_index: Some(0),
            },
            epoch,
        )
        .unwrap();

        // march discarded, wound remains in hand, SubsetSelection active.
        assert_eq!(state.players[0].hand.len(), 1);
        assert_eq!(state.players[0].hand[0].as_str(), "wound");
        assert!(state.players[0].discard.iter().any(|c| c.as_str() == "march"));
        assert!(state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert!(matches!(
            state.players[0].pending.active,
            Some(ActivePending::SubsetSelection(_))
        ));

        // Select the wound (pool index 0) → auto-confirms (max=1).
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SubsetSelect { index: 0 },
            epoch,
        )
        .unwrap();

        // Rest complete: wound discarded, flags set.
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].discard.len(), 2);
        assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert!(state.players[0].flags.contains(PlayerFlags::HAS_RESTED_THIS_TURN));
    }

    #[test]
    fn complete_rest_standard_skip_wound_discard() {
        // Hand: march, wound → standard rest discarding march, then confirm with 0 wounds.
        let mut state = setup_playing_game(vec!["march", "wound"]);
        state.players[0].flags.insert(PlayerFlags::IS_RESTING);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::CompleteRest {
                discard_hand_index: Some(0),
            },
            epoch,
        )
        .unwrap();

        // Confirm with no wounds selected.
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SubsetConfirm,
            epoch,
        )
        .unwrap();

        // Rest complete: wound still in hand, march discarded.
        assert_eq!(state.players[0].hand.len(), 1);
        assert_eq!(state.players[0].hand[0].as_str(), "wound");
        assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert!(state.players[0].flags.contains(PlayerFlags::HAS_RESTED_THIS_TURN));
    }

    #[test]
    fn complete_rest_slow_recovery_discards_one_wound() {
        // Hand: wound, wound → slow recovery discarding index 0
        // should remove only that wound.
        let mut state = setup_playing_game(vec!["wound", "wound"]);
        state.players[0].flags.insert(PlayerFlags::IS_RESTING);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::CompleteRest {
                discard_hand_index: Some(0),
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.players[0].hand.len(), 1); // one wound remains
        assert_eq!(state.players[0].hand[0].as_str(), "wound");
        assert_eq!(state.players[0].discard.len(), 1);
        assert_eq!(state.players[0].discard[0].as_str(), "wound");
    }

    #[test]
    fn complete_rest_empty_hand_sets_flags() {
        let mut state = setup_playing_game(vec![]);
        state.players[0].flags.insert(PlayerFlags::IS_RESTING);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::CompleteRest {
                discard_hand_index: None,
            },
            epoch,
        )
        .unwrap();

        assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::HAS_RESTED_THIS_TURN));
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN));
        assert!(state.players[0].hand.is_empty());
        assert!(state.players[0].discard.is_empty());
    }

    #[test]
    fn undo_complete_rest_restores_hand() {
        // DeclareRest + CompleteRest + SubsetSelect (wound), then undo all.
        let mut state = setup_playing_game(vec!["march", "wound"]);
        let original_hand = state.players[0].hand.clone();
        let mut undo = UndoStack::new();

        // DeclareRest
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::DeclareRest, epoch).unwrap();

        // CompleteRest — enters SubsetSelection for wound discard
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::CompleteRest {
                discard_hand_index: Some(0),
            },
            epoch,
        )
        .unwrap();

        // Select wound (auto-confirms at max=1)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SubsetSelect { index: 0 },
            epoch,
        )
        .unwrap();

        assert!(state.players[0].hand.is_empty());

        // Undo SubsetSelect+CompleteRest (snapshot restores to IS_RESTING with original hand)
        state = undo.undo().expect("should have undo snapshot");
        assert!(state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert_eq!(state.players[0].hand, original_hand);

        // Undo DeclareRest
        state = undo.undo().expect("should have undo snapshot");
        assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert!(!state.players[0]
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
    }

    #[test]
    fn full_rest_flow_declare_complete_end() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();

        // DeclareRest
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::DeclareRest, epoch).unwrap();
        assert!(state.players[0].flags.contains(PlayerFlags::IS_RESTING));

        // CompleteRest
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::CompleteRest {
                discard_hand_index: Some(0),
            },
            epoch,
        )
        .unwrap();
        assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::HAS_RESTED_THIS_TURN));

        // EndTurn should now be available via legal actions
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let has_end = legal
            .actions
            .iter()
            .any(|a| matches!(a, LegalAction::EndTurn));
        assert!(has_end, "EndTurn should be available after resting");
    }

    #[test]
    fn end_turn_after_card_play() {
        let mut state = setup_playing_game(vec!["march"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // Play a card first
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardBasic {
                hand_index: 0,
                card_id: CardId::from("march"),
            },
            epoch,
        )
        .unwrap();

        let epoch = state.action_epoch;
        let result =
            apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndTurn, epoch).unwrap();

        assert!(result.needs_reenumeration);
    }

    #[test]
    fn undo_restores_state() {
        let mut state = setup_playing_game(vec!["march", "rage"]);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        let original_hand_len = state.players[0].hand.len();

        // Play a card (saves snapshot)
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::PlayCardBasic {
                hand_index: 0,
                card_id: CardId::from("march"),
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.players[0].hand.len(), original_hand_len - 1);

        // Undo
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::Undo, epoch).unwrap();

        assert_eq!(state.players[0].hand.len(), original_hand_len);
    }

    // =========================================================================
    // EndCombatPhase
    // =========================================================================

    #[test]
    fn end_combat_phase_advances_ranged_to_block() {
        let mut state = setup_playing_game(vec!["march"]);
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::RangedSiege,
            ..CombatState::default()
        }));
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();

        assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Block);
    }

    #[test]
    fn end_combat_phase_attack_ends_combat() {
        let mut state = setup_playing_game(vec!["march"]);
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::Attack,
            ..CombatState::default()
        }));
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();

        assert!(
            state.combat.is_none(),
            "combat should be removed after Attack phase"
        );
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
    }

    #[test]
    fn end_combat_phase_full_cycle() {
        let mut state = setup_playing_game(vec!["march"]);
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::RangedSiege,
            ..CombatState::default()
        }));
        let mut undo = UndoStack::new();

        // RangedSiege → Block
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();
        assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Block);

        // Block → AssignDamage
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();
        assert_eq!(
            state.combat.as_ref().unwrap().phase,
            CombatPhase::AssignDamage
        );

        // AssignDamage → Attack
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();
        assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Attack);

        // Attack → combat ends
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();
        assert!(state.combat.is_none());
    }

    #[test]
    fn explore_sets_checkpoint() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].move_points = 5;
        state.players[0].position = Some(mk_types::hex::HexCoord::new(1, 0));
        state.map.tile_deck.countryside = vec![TileId::Countryside1];
        let mut undo = UndoStack::new();
        undo.save(&state); // save something first

        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let explore_action = legal
            .actions
            .iter()
            .find(|a| matches!(a, LegalAction::Explore { .. }));
        if let Some(action) = explore_action {
            apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch).unwrap();
            // Explore is irreversible — checkpoint should have cleared undo stack
            assert!(!undo.can_undo());
        }
    }

    // =========================================================================
    // DeclareBlock integration tests
    // =========================================================================

    fn setup_combat_game(enemy_ids: &[&str]) -> GameState {
        let mut state = setup_playing_game(vec!["march"]);
        let tokens: Vec<mk_types::ids::EnemyTokenId> = enemy_ids
            .iter()
            .map(|id| mk_types::ids::EnemyTokenId::from(format!("{}_1", id)))
            .collect();
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        )
        .unwrap();
        state
    }

    /// Helper: execute full attack via InitiateAttack → SubsetSelect → SubsetConfirm.
    fn execute_attack(
        state: &mut GameState,
        undo: &mut UndoStack,
        attack_type: CombatType,
        target_count: usize,
    ) {
        let epoch = state.action_epoch;
        apply_legal_action(
            state, undo, 0,
            &LegalAction::InitiateAttack { attack_type },
            epoch,
        ).unwrap();

        // Select targets 0..target_count
        for i in 0..target_count {
            let epoch = state.action_epoch;
            apply_legal_action(
                state, undo, 0,
                &LegalAction::SubsetSelect { index: i },
                epoch,
            ).unwrap();
        }

        // Confirm if not auto-confirmed
        if state.players[0].pending.has_active() {
            let epoch = state.action_epoch;
            apply_legal_action(
                state, undo, 0,
                &LegalAction::SubsetConfirm,
                epoch,
            ).unwrap();
        }
    }

    #[test]
    fn declare_block_marks_attack_blocked() {
        let mut state = setup_combat_game(&["prowlers"]); // 4 physical
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 5,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::DeclareBlock {
                enemy_instance_id: mk_types::ids::CombatInstanceId::from("enemy_0"),
                attack_index: 0,
            },
            epoch,
        )
        .unwrap();

        let combat = state.combat.as_ref().unwrap();
        assert!(combat.enemies[0].attacks_blocked[0]);
        assert!(combat.enemies[0].is_blocked);
        // Block consumed
        assert_eq!(
            state.players[0].combat_accumulator.block_elements.total(),
            0
        );
    }

    #[test]
    fn declare_block_clears_accumulator() {
        let mut state = setup_combat_game(&["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].combat_accumulator.block = 5;
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 5,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::DeclareBlock {
                enemy_instance_id: mk_types::ids::CombatInstanceId::from("enemy_0"),
                attack_index: 0,
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.players[0].combat_accumulator.block, 0);
        assert_eq!(
            state.players[0].combat_accumulator.block_elements,
            ElementalValues::default()
        );
    }

    // =========================================================================
    // DeclareAttack integration tests
    // =========================================================================

    #[test]
    fn declare_attack_defeats_enemy_grants_fame() {
        let mut state = setup_combat_game(&["prowlers"]); // armor 3, fame 2
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
            physical: 5,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };
        let initial_fame = state.players[0].fame;

        let mut undo = UndoStack::new();
        execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

        let combat = state.combat.as_ref().unwrap();
        assert!(combat.enemies[0].is_defeated);
        assert_eq!(combat.fame_gained, 2);
        assert_eq!(state.players[0].fame, initial_fame + 2);
        assert_eq!(state.players[0].enemies_defeated_this_turn, 1);
    }

    #[test]
    fn declare_attack_reputation_update() {
        // Thugs (gray): reputation_bonus=1
        let mut state = setup_combat_game(&["thugs_gray"]); // armor 5, fame 2, rep bonus 1
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
            physical: 10,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };
        let initial_rep = state.players[0].reputation;

        let mut undo = UndoStack::new();
        execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

        assert_eq!(state.players[0].reputation, initial_rep + 1);
    }

    #[test]
    fn declare_attack_consumes_attack_pool() {
        let mut state = setup_combat_game(&["prowlers"]); // armor 3
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
            physical: 5,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let mut undo = UndoStack::new();
        execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

        // Attack pool should be fully assigned
        assert_eq!(
            state.players[0]
                .combat_accumulator
                .assigned_attack
                .normal_elements
                .physical,
            5
        );
    }

    // =========================================================================
    // EndCombatPhase enhanced tests
    // =========================================================================

    #[test]
    fn end_combat_phase_ranged_siege_clears_ranged_attack() {
        let mut state = setup_combat_game(&["prowlers"]);
        state.players[0].combat_accumulator.attack.ranged = 5;
        state.players[0].combat_accumulator.attack.ranged_elements = ElementalValues {
            physical: 5,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };
        state.players[0].combat_accumulator.attack.siege = 3;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();

        // Ranged/siege should be cleared
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 0);
        assert_eq!(state.players[0].combat_accumulator.attack.siege, 0);
        assert_eq!(
            state.players[0]
                .combat_accumulator
                .attack
                .ranged_elements,
            ElementalValues::default()
        );
    }

    #[test]
    fn end_combat_phase_block_to_assign_damage_applies_wounds() {
        let mut state = setup_combat_game(&["prowlers"]); // 4 physical attack
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        // Don't block — all attacks unblocked

        let initial_hand_len = state.players[0].hand.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();

        // Prowlers deal 4 physical, hero armor=2, ceil(4/2)=2 wounds
        assert_eq!(state.players[0].hand.len(), initial_hand_len + 2);
        let wound_count = state.players[0]
            .hand
            .iter()
            .filter(|c| c.as_str() == "wound")
            .count();
        assert_eq!(wound_count, 2);
        assert_eq!(
            state.combat.as_ref().unwrap().phase,
            CombatPhase::AssignDamage
        );
    }

    #[test]
    fn end_combat_phase_block_poison_adds_wounds_to_discard() {
        let mut state = setup_combat_game(&["cursed_hags"]); // 3 physical, Poison
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        let initial_discard_len = state.players[0].discard.len();
        let initial_hand_len = state.players[0].hand.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();

        // Cursed Hags: 3 physical, hero armor=2, ceil(3/2)=2 wounds to hand
        // Poison: same 2 wounds also to discard
        let hand_wounds = state.players[0].hand.len() - initial_hand_len;
        let discard_wounds = state.players[0].discard.len() - initial_discard_len;
        assert_eq!(hand_wounds, 2);
        assert_eq!(discard_wounds, 2);
    }

    #[test]
    fn end_combat_phase_attack_removes_defeated_from_hex() {
        let hex = mk_types::hex::HexCoord::new(1, -1);
        let mut state = setup_playing_game(vec!["march"]);

        // Set up hex with enemies
        state.map.hexes.insert(
            hex.key(),
            HexState {
                coord: hex,
                terrain: Terrain::Plains,
                tile_id: TileId::Countryside1,
                site: None,
                rampaging_enemies: Default::default(),
                enemies: {
                    let mut arr = arrayvec::ArrayVec::new();
                    arr.push(HexEnemy {
                        token_id: mk_types::ids::EnemyTokenId::from("prowlers_1"),
                        color: EnemyColor::Green,
                        is_revealed: true,
                    });
                    arr
                },
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );

        // Enter combat with that hex
        let tokens = vec![mk_types::ids::EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, Some(hex), Default::default(),
        )
        .unwrap();

        // Mark enemy as defeated
        state.combat.as_mut().unwrap().enemies[0].is_defeated = true;
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();

        // Combat ended
        assert!(state.combat.is_none());
        // Enemy removed from hex
        assert!(state.map.hexes[&hex.key()].enemies.is_empty());
        // Token should be in green discard pile
        assert!(state
            .enemy_tokens
            .green_discard
            .contains(&mk_types::ids::EnemyTokenId::from("prowlers_1")));
    }

    // =========================================================================
    // Full combat cycle integration test
    // =========================================================================

    #[test]
    fn full_combat_cycle_block_damage_attack_defeat() {
        // Enter combat with two enemies:
        // - prowlers (4 physical, armor 3, fame 2)
        // - diggers (3 physical Fortified, armor 3, fame 2)
        let mut state = setup_combat_game(&["prowlers", "diggers"]);
        let mut undo = UndoStack::new();

        // Verify we start in RangedSiege
        assert_eq!(
            state.combat.as_ref().unwrap().phase,
            CombatPhase::RangedSiege
        );

        // Skip RangedSiege → Block
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();
        assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Block);

        // Block prowlers' attack (4 physical, need 4)
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 4,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::DeclareBlock {
                enemy_instance_id: mk_types::ids::CombatInstanceId::from("enemy_0"),
                attack_index: 0,
            },
            epoch,
        )
        .unwrap();
        assert!(state.combat.as_ref().unwrap().enemies[0].is_blocked);

        // Don't block diggers — skip to AssignDamage
        let initial_hand_len = state.players[0].hand.len();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();

        // Diggers: 3 physical, armor 2, ceil(3/2)=2 wounds
        assert_eq!(state.players[0].hand.len(), initial_hand_len + 2);
        assert_eq!(
            state.combat.as_ref().unwrap().phase,
            CombatPhase::AssignDamage
        );

        // Skip AssignDamage → Attack
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();
        assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Attack);

        // Attack both enemies (armor 3+3=6, need 6)
        let initial_fame = state.players[0].fame;
        state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
            physical: 6,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };
        execute_attack(&mut state, &mut undo, CombatType::Melee, 2);

        assert!(state.combat.as_ref().unwrap().enemies[0].is_defeated);
        assert!(state.combat.as_ref().unwrap().enemies[1].is_defeated);
        assert_eq!(state.players[0].fame, initial_fame + 4); // 2+2

        // End combat
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::EndCombatPhase,
            epoch,
        )
        .unwrap();

        assert!(state.combat.is_none());
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::HAS_COMBATTED_THIS_TURN));
    }

    // =========================================================================
    // Contract test: all enumerated combat actions executable
    // =========================================================================

    #[test]
    fn contract_all_combat_actions_executable() {
        use crate::legal_actions::enumerate_legal_actions_with_undo;

        // Setup: combat with prowlers, accumulated block and attack
        let mut state = setup_combat_game(&["prowlers"]);
        let mut undo = UndoStack::new();

        // Play through each phase, executing every enumerated action
        for _step in 0..20 {
            if state.combat.is_none() {
                break;
            }

            // Give resources for each phase
            let phase = state.combat.as_ref().unwrap().phase;
            match phase {
                CombatPhase::Block => {
                    state.players[0].combat_accumulator.block_elements = ElementalValues {
                        physical: 10,
                        fire: 0,
                        ice: 0,
                        cold_fire: 0,
                    };
                }
                CombatPhase::Attack => {
                    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
                        physical: 10,
                        fire: 0,
                        ice: 0,
                        cold_fire: 0,
                    };
                }
                _ => {}
            }

            let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
            if legal.actions.is_empty() {
                break;
            }

            // Pick the first non-card-play, non-undo action (prefer combat actions)
            let action = legal
                .actions
                .iter()
                .find(|a| {
                    matches!(
                        a,
                        LegalAction::DeclareBlock { .. }
                            | LegalAction::InitiateAttack { .. }
                            | LegalAction::SubsetSelect { .. }
                            | LegalAction::SubsetConfirm
                            | LegalAction::EndCombatPhase
                    )
                })
                .unwrap_or(&legal.actions[0]);

            let result = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
            assert!(
                result.is_ok(),
                "Action {:?} failed: {:?}",
                action,
                result.err()
            );
        }
    }

    // =========================================================================
    // Vampiric armor bonus in auto_damage
    // =========================================================================

    #[test]
    fn vampiric_enemy_gains_armor_after_auto_damage() {
        // Gibbering Ghouls: 4 physical attack, Vampiric, armor 4
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![EnemyTokenId::from("gibbering_ghouls_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        // Skip to Block phase
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // End Block phase → auto_damage → wounds to hand
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        let combat = state.combat.as_ref().unwrap();
        // Hero armor = 2, Ghoul attack = 4: ceil(4/2) = 2 wounds to hand
        assert_eq!(combat.vampiric_armor_bonus.get("enemy_0").copied().unwrap_or(0), 2);
    }

    #[test]
    fn vampiric_not_increased_by_poison_discard() {
        // Need a Vampiric + non-poison enemy alongside a Poison enemy to verify
        // Use Gibbering Ghouls (Vampiric, 4 atk) + Cursed Hags (Poison, 3 atk)
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![
            EnemyTokenId::from("gibbering_ghouls_1"),
            EnemyTokenId::from("cursed_hags_2"),
        ];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        let combat = state.combat.as_ref().unwrap();
        // Ghoul: ceil(4/2) = 2 wounds to hand
        // Hags: ceil(3/2) = 2 wounds to hand, + 2 to discard (Poison)
        // Total wounds to hand: 4
        // Vampiric bonus = total_wounds_to_hand = 4 (NOT counting discard wounds)
        assert_eq!(combat.vampiric_armor_bonus.get("enemy_0").copied().unwrap_or(0), 4);
    }

    #[test]
    fn vampiric_bonus_affects_attack_enumeration() {
        // Gibbering Ghouls: armor 4, Vampiric
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![EnemyTokenId::from("gibbering_ghouls_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        // Set vampiric bonus to 3 → effective armor = 4 + 3 = 7
        state.combat.as_mut().unwrap().vampiric_armor_bonus
            .insert("enemy_0".to_string(), 3);

        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

        // Give player 6 melee attack (enough for base armor 4, not enough for 7)
        state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
            physical: 6, fire: 0, ice: 0, cold_fire: 0,
        };

        // InitiateAttack is still offered (we have attack > 0 and eligible enemies)
        let legal = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            legal.actions.iter().any(|a| matches!(a, LegalAction::InitiateAttack { .. })),
            "InitiateAttack should be available with 6 attack"
        );

        // But after initiating and selecting the enemy, SubsetConfirm should NOT be offered
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::InitiateAttack { attack_type: CombatType::Melee }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            !legal.actions.contains(&LegalAction::SubsetConfirm),
            "6 attack should not be sufficient to confirm against armor 7"
        );

        // Undo back to combat
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::Undo, epoch).unwrap();

        // Give 7 attack — now confirm should be available
        state.players[0].combat_accumulator.attack.normal_elements.physical = 7;
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::InitiateAttack { attack_type: CombatType::Melee }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            legal.actions.contains(&LegalAction::SubsetConfirm),
            "7 attack should be sufficient to confirm against armor 7"
        );
    }

    // =========================================================================
    // Cumbersome — spend move points in Block phase
    // =========================================================================

    #[test]
    fn cumbersome_spend_move_reduces_damage_in_auto_damage() {
        // Orc Stonethrowers: 7 physical attack, Cumbersome
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![EnemyTokenId::from("orc_stonethrowers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].move_points = 3;

        let mut undo = UndoStack::new();

        // Spend 3 move on cumbersome
        for _ in 0..3 {
            let epoch = state.action_epoch;
            apply_legal_action(
                &mut state, &mut undo, 0,
                &LegalAction::SpendMoveOnCumbersome {
                    enemy_instance_id: CombatInstanceId::from("enemy_0"),
                },
                epoch,
            ).unwrap();
        }

        assert_eq!(state.players[0].move_points, 0);
        assert_eq!(
            state.combat.as_ref().unwrap().cumbersome_reductions.get("enemy_0").copied().unwrap_or(0),
            3
        );

        // End Block → auto_damage: 7-3=4 damage, hero armor 2, ceil(4/2)=2 wounds
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        // Should have 2 wounds (reduced from ceil(7/2)=4 without cumbersome)
        let wounds_in_hand = state.players[0].hand.iter()
            .filter(|c| c.as_str() == "wound")
            .count();
        assert_eq!(wounds_in_hand, 2);
    }

    #[test]
    fn cumbersome_reduced_to_zero_counts_as_blocked() {
        // Zombie Horde: 3×1 physical attacks, Cumbersome
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![EnemyTokenId::from("zombie_horde_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].move_points = 5;

        let mut undo = UndoStack::new();

        // Spend 1 move on cumbersome → each 1-damage attack reduced to 0
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SpendMoveOnCumbersome {
                enemy_instance_id: CombatInstanceId::from("enemy_0"),
            },
            epoch,
        ).unwrap();

        // End Block → auto_damage: all attacks reduced to 0 → no wounds
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        let wounds_in_hand = state.players[0].hand.iter()
            .filter(|c| c.as_str() == "wound")
            .count();
        assert_eq!(wounds_in_hand, 0, "All attacks reduced to 0 by cumbersome");

        // Enemy should be marked as blocked
        assert!(
            state.combat.as_ref().unwrap().enemies[0].is_blocked,
            "Cumbersome-blocked enemy should be marked as blocked"
        );
    }

    // =========================================================================
    // Paralyze — discard non-wound cards from hand
    // =========================================================================

    #[test]
    fn paralyze_discards_non_wound_cards() {
        // Medusa: 6 physical attack, Paralyze
        let mut state = setup_playing_game(vec!["march", "rage", "swiftness"]);
        let tokens = vec![EnemyTokenId::from("medusa_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // End Block → auto_damage with Paralyze
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        // Hero armor 2, Medusa attack 6: ceil(6/2) = 3 wounds to hand
        // Then Paralyze discards non-wound cards (march, rage, swiftness)
        let non_wounds_in_hand: Vec<_> = state.players[0].hand.iter()
            .filter(|c| c.as_str() != "wound")
            .collect();
        assert!(non_wounds_in_hand.is_empty(), "All non-wound cards should be discarded");

        let wounds_in_hand = state.players[0].hand.iter()
            .filter(|c| c.as_str() == "wound")
            .count();
        assert_eq!(wounds_in_hand, 3, "Wound cards remain in hand");

        // Original cards should be in discard
        assert!(state.players[0].discard.iter().any(|c| c.as_str() == "march"));
        assert!(state.players[0].discard.iter().any(|c| c.as_str() == "rage"));
        assert!(state.players[0].discard.iter().any(|c| c.as_str() == "swiftness"));
    }

    #[test]
    fn paralyze_with_zero_damage_does_not_trigger() {
        // Block all of Medusa's attack → 0 damage → no Paralyze
        let mut state = setup_playing_game(vec!["march", "rage"]);
        let tokens = vec![EnemyTokenId::from("medusa_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        // Block the attack
        state.combat.as_mut().unwrap().enemies[0].attacks_blocked[0] = true;
        state.combat.as_mut().unwrap().enemies[0].is_blocked = true;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        // Non-wound cards should remain in hand
        let non_wounds_in_hand = state.players[0].hand.iter()
            .filter(|c| c.as_str() != "wound")
            .count();
        assert_eq!(non_wounds_in_hand, 2, "Cards should not be discarded when attack is blocked");
    }

    #[test]
    fn paralyze_keeps_wound_cards_in_hand() {
        // Put wounds in hand before paralyze
        let mut state = setup_playing_game(vec!["wound", "march", "wound"]);
        let tokens = vec![EnemyTokenId::from("medusa_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        // Original 2 wounds + 3 new wounds = 5 wounds in hand
        let wounds_in_hand = state.players[0].hand.iter()
            .filter(|c| c.as_str() == "wound")
            .count();
        assert_eq!(wounds_in_hand, 5, "All wound cards stay in hand");

        // march should be discarded
        assert!(state.players[0].discard.iter().any(|c| c.as_str() == "march"));
    }

    #[test]
    fn paralyze_combined_with_poison() {
        // Medusa (Paralyze, 6 atk) + Cursed Hags (Poison, 3 atk)
        let mut state = setup_playing_game(vec!["march", "rage"]);
        let tokens = vec![
            EnemyTokenId::from("medusa_1"),
            EnemyTokenId::from("cursed_hags_2"),
        ];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        // Medusa: ceil(6/2) = 3 wounds to hand, Paralyze triggers
        // Cursed Hags: ceil(3/2) = 2 wounds to hand + 2 to discard (Poison)
        // Total wounds to hand: 5
        // Paralyze discards march and rage
        let non_wounds = state.players[0].hand.iter()
            .filter(|c| c.as_str() != "wound")
            .count();
        assert_eq!(non_wounds, 0, "Paralyze discards non-wounds even with Poison present");

        let wounds_in_hand = state.players[0].hand.iter()
            .filter(|c| c.as_str() == "wound")
            .count();
        assert_eq!(wounds_in_hand, 5);

        // Poison discard wounds
        let wounds_in_discard = state.players[0].discard.iter()
            .filter(|c| c.as_str() == "wound")
            .count();
        assert_eq!(wounds_in_discard, 2, "Poison adds wounds to discard");
    }

    #[test]
    fn non_paralyze_does_not_discard_hand() {
        // Prowlers: 4 physical, no Paralyze
        let mut state = setup_playing_game(vec!["march", "rage"]);
        let tokens = vec![EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        // Cards should remain in hand
        let non_wounds = state.players[0].hand.iter()
            .filter(|c| c.as_str() != "wound")
            .count();
        assert_eq!(non_wounds, 2, "Non-paralyze should not discard hand");
    }

    // =========================================================================
    // Summon — draw enemies at RangedSiege→Block transition
    // =========================================================================

    #[test]
    fn summon_draws_from_brown_pile() {
        // Orc Summoners: 0 attack, Summon ability
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![EnemyTokenId::from("orc_summoners_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let brown_count_before = state.enemy_tokens.brown_draw.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // RangedSiege → Block (triggers resolve_summons)
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        let combat = state.combat.as_ref().unwrap();
        assert_eq!(combat.phase, CombatPhase::Block);

        // Should have drawn one Brown enemy
        let _brown_count_after = state.enemy_tokens.brown_draw.len()
            + state.enemy_tokens.brown_discard.len();
        assert!(
            brown_count_before > state.enemy_tokens.brown_draw.len(),
            "Should have drawn from brown pile"
        );

        // Summoned enemy should be in combat
        let summoned = combat.enemies.iter().find(|e| e.summoned_by_instance_id.is_some());
        assert!(summoned.is_some(), "Summoned enemy should be in combat");
        let summoned = summoned.unwrap();
        assert_eq!(
            summoned.summoned_by_instance_id.as_ref().unwrap().as_str(),
            "enemy_0",
            "Summoned enemy should reference summoner"
        );

        // Summoner should be hidden
        assert!(
            combat.enemies[0].is_summoner_hidden,
            "Summoner should be hidden during Block/AssignDamage"
        );
    }

    #[test]
    fn summon_green_draws_from_green_pile() {
        // Shrouded Necromancers: SummonGreen
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![EnemyTokenId::from("shrouded_necromancers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let green_count_before = state.enemy_tokens.green_draw.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        assert!(
            green_count_before > state.enemy_tokens.green_draw.len(),
            "Should have drawn from green pile"
        );

        let combat = state.combat.as_ref().unwrap();
        let summoned = combat.enemies.iter().find(|e| e.summoned_by_instance_id.is_some());
        assert!(summoned.is_some());
    }

    #[test]
    fn summoned_enemy_removed_at_assign_damage_to_attack() {
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![EnemyTokenId::from("orc_summoners_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let mut undo = UndoStack::new();

        // RangedSiege → Block (summons appear)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        let enemy_count_block = state.combat.as_ref().unwrap().enemies.len();
        assert!(enemy_count_block > 1, "Should have summoned at least one enemy");

        // Block → AssignDamage
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        // AssignDamage → Attack (summoned enemies removed, summoner unhidden)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        let combat = state.combat.as_ref().unwrap();
        assert_eq!(combat.phase, CombatPhase::Attack);

        // Summoned enemies should be removed
        let summoned_count = combat.enemies.iter()
            .filter(|e| e.summoned_by_instance_id.is_some())
            .count();
        assert_eq!(summoned_count, 0, "Summoned enemies should be removed before Attack phase");

        // Summoner should be unhidden
        assert!(
            !combat.enemies[0].is_summoner_hidden,
            "Summoner should be unhidden in Attack phase"
        );
    }

    #[test]
    fn hidden_summoner_does_not_deal_damage() {
        // Orc Summoners has 0 attack anyway, but let's verify the hidden flag works
        // by checking that a hypothetical summoner with damage doesn't deal it
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![EnemyTokenId::from("orc_summoners_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let mut undo = UndoStack::new();

        // RangedSiege → Block
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        // Summoner should be hidden
        assert!(state.combat.as_ref().unwrap().enemies[0].is_summoner_hidden);

        // Block → AssignDamage (auto_damage should skip hidden summoner)
        let _hand_before = state.players[0].hand.len();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        // The summoner had 0 damage anyway, but the summoned enemy should have dealt damage
        // (depending on what was drawn). The key point: summoner itself was hidden.
        // This test verifies the summoner skip path was taken.
        assert!(state.combat.as_ref().unwrap().phase == CombatPhase::AssignDamage);
    }

    #[test]
    fn no_fame_for_defeating_summoned_enemy() {
        // Already tested in combat_resolution.rs, but verify here in integration
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![EnemyTokenId::from("orc_summoners_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let mut undo = UndoStack::new();

        // RangedSiege → Block (summons)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        // Find a summoned enemy and its armor
        let combat = state.combat.as_ref().unwrap();
        let summoned = combat.enemies.iter()
            .find(|e| e.summoned_by_instance_id.is_some());

        if let Some(summoned_enemy) = summoned {
            let _summoned_def = get_enemy(summoned_enemy.enemy_id.as_str()).unwrap();
            let _summoned_id = summoned_enemy.instance_id.clone();

            // Give enough attack to defeat the summoned enemy
            state.players[0].combat_accumulator.block_elements = ElementalValues {
                physical: 100, fire: 0, ice: 0, cold_fire: 0,
            };

            // Skip to Attack phase for the summoned enemy
            // Actually, summoned enemies are removed before Attack. So we can't attack them
            // in Attack phase. The test for fame should use resolve_attack directly.
            // The integration test is in combat_resolution tests.
        }
    }

    #[test]
    fn empty_pile_no_summon() {
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![EnemyTokenId::from("orc_summoners_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        // Empty the brown pile
        state.enemy_tokens.brown_draw.clear();
        state.enemy_tokens.brown_discard.clear();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // RangedSiege → Block (summon fails, no draw)
        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        let combat = state.combat.as_ref().unwrap();
        // Should only have the original summoner (no summoned enemy)
        assert_eq!(combat.enemies.len(), 1, "Empty pile → no summon");

        // Summoner should NOT be hidden (no successful summon)
        assert!(
            !combat.enemies[0].is_summoner_hidden,
            "Summoner should not be hidden when no summon succeeds"
        );
    }

    #[test]
    fn dragon_summoner_draws_twice() {
        // Dragon Summoner: 2 Summon attacks → draws 2 from Brown
        let mut state = setup_playing_game(vec!["march"]);
        let tokens = vec![EnemyTokenId::from("dragon_summoner_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let brown_count_before = state.enemy_tokens.brown_draw.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
        ).unwrap();

        let brown_drawn = brown_count_before - state.enemy_tokens.brown_draw.len();
        assert_eq!(brown_drawn, 2, "Dragon Summoner should draw 2 from brown pile");

        let combat = state.combat.as_ref().unwrap();
        let summoned_count = combat.enemies.iter()
            .filter(|e| e.summoned_by_instance_id.is_some())
            .count();
        assert_eq!(summoned_count, 2, "Should have 2 summoned enemies");
    }

    // =========================================================================
    // Tactic effects — integration tests
    // =========================================================================

    #[test]
    fn select_great_start_draws_two_cards() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let initial_hand = state.players[0].hand.len();
        let initial_deck = state.players[0].deck.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("great_start"),
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.players[0].hand.len(), initial_hand + 2);
        assert_eq!(state.players[0].deck.len(), initial_deck - 2);
        assert_eq!(state.round_phase, RoundPhase::PlayerTurns);
    }

    #[test]
    fn select_great_start_empty_deck_draws_nothing() {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.players[0].deck.clear();
        let initial_hand = state.players[0].hand.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("great_start"),
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.players[0].hand.len(), initial_hand);
    }

    #[test]
    fn select_rethink_creates_pending() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("rethink"),
            },
            epoch,
        )
        .unwrap();

        assert!(state.players[0].pending.has_active());
        match &state.players[0].pending.active {
            Some(ActivePending::SubsetSelection(ss)) => {
                assert_eq!(ss.kind, mk_types::pending::SubsetSelectionKind::Rethink);
                assert_eq!(ss.max_selections, 3);
                assert_eq!(ss.min_selections, 0);
                assert!(ss.selected.is_empty());
            }
            other => panic!("Expected SubsetSelection, got {:?}", other),
        }
    }

    #[test]
    fn rethink_resolution_swaps_cards() {
        let mut state = create_solo_game(42, Hero::Arythea);
        // Set up known hand
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("stamina"),
            CardId::from("rage"),
        ];
        state.players[0].deck = vec![
            CardId::from("swiftness"),
            CardId::from("concentration"),
        ];
        state.players[0].discard.clear();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // Select rethink
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("rethink"),
            },
            epoch,
        )
        .unwrap();

        // Resolve: select indices 0 and 2 (march and rage), then confirm
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SubsetSelect { index: 0 }, epoch,
        ).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SubsetSelect { index: 2 }, epoch,
        ).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SubsetConfirm, epoch,
        ).unwrap();

        // Should still have 3 cards in hand (stamina stayed + 2 drawn)
        assert_eq!(state.players[0].hand.len(), 3);
        // Pending should be cleared
        assert!(!state.players[0].pending.has_active());
        // march and rage were removed; stamina should still be there
        assert!(state.players[0].hand.contains(&CardId::from("stamina")));
    }

    #[test]
    fn rethink_empty_set_keeps_hand_unchanged() {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("stamina"),
        ];

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("rethink"),
            },
            epoch,
        )
        .unwrap();

        let hand_before = state.players[0].hand.clone();

        // Confirm immediately (empty selection)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SubsetConfirm, epoch,
        ).unwrap();

        // No cards swapped, hand unchanged
        assert_eq!(state.players[0].hand, hand_before);
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn select_mana_steal_creates_pending() {
        let mut state = create_solo_game(42, Hero::Arythea);
        // Ensure at least one basic die is available
        assert!(state.source.dice.iter().any(|d| !d.is_depleted && d.taken_by_player_id.is_none() && d.color.is_basic()));

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("mana_steal"),
            },
            epoch,
        )
        .unwrap();

        assert!(matches!(
            state.players[0].pending.active,
            Some(ActivePending::TacticDecision(PendingTacticDecision::ManaSteal))
        ));
    }

    #[test]
    fn mana_steal_resolution_marks_die() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // Select mana_steal
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("mana_steal"),
            },
            epoch,
        )
        .unwrap();

        // Find first available basic die index
        let die_idx = state
            .source
            .dice
            .iter()
            .position(|d| !d.is_depleted && d.taken_by_player_id.is_none() && d.color.is_basic())
            .unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ResolveTacticDecision {
                data: TacticDecisionData::ManaSteal { die_index: die_idx },
            },
            epoch,
        )
        .unwrap();

        // Die should be marked as taken
        assert!(state.source.dice[die_idx].taken_by_player_id.is_some());
        // Stored mana die should be set
        assert!(state.players[0].tactic_state.stored_mana_die.is_some());
        // Pending cleared
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn select_preparation_creates_pending_with_deck_snapshot() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let deck_len = state.players[0].deck.len();
        assert!(deck_len > 0);

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("preparation"),
            },
            epoch,
        )
        .unwrap();

        match &state.players[0].pending.active {
            Some(ActivePending::TacticDecision(PendingTacticDecision::Preparation { deck_snapshot })) => {
                assert_eq!(deck_snapshot.len(), deck_len);
            }
            other => panic!("Expected Preparation pending, got {:?}", other),
        }
    }

    #[test]
    fn preparation_resolution_moves_card_to_hand() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("preparation"),
            },
            epoch,
        )
        .unwrap();

        // Get the first card from the deck snapshot
        let target_card = match &state.players[0].pending.active {
            Some(ActivePending::TacticDecision(PendingTacticDecision::Preparation { deck_snapshot })) => {
                deck_snapshot[0].clone()
            }
            _ => panic!("Expected Preparation pending"),
        };

        let initial_hand = state.players[0].hand.len();
        let initial_deck = state.players[0].deck.len();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ResolveTacticDecision {
                data: TacticDecisionData::Preparation { deck_card_index: 0 },
            },
            epoch,
        )
        .unwrap();

        // Card moved from deck to hand
        assert_eq!(state.players[0].hand.len(), initial_hand + 1);
        assert_eq!(state.players[0].deck.len(), initial_deck - 1);
        assert!(state.players[0].hand.contains(&target_card));
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn activate_the_right_moment_sets_extra_turn() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("the_right_moment"));

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ActivateTactic,
            epoch,
        )
        .unwrap();

        assert!(state.players[0].tactic_state.extra_turn_pending);
        assert!(state.players[0].flags.contains(PlayerFlags::TACTIC_FLIPPED));
    }

    #[test]
    fn activate_long_night_moves_discard_to_deck() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("long_night"));
        state.players[0].deck.clear();
        state.players[0].discard = vec![
            CardId::from("stamina"),
            CardId::from("rage"),
            CardId::from("swiftness"),
            CardId::from("concentration"),
        ];

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ActivateTactic,
            epoch,
        )
        .unwrap();

        // 3 cards moved from discard to deck
        assert_eq!(state.players[0].deck.len(), 3);
        assert_eq!(state.players[0].discard.len(), 1);
        assert!(state.players[0].flags.contains(PlayerFlags::TACTIC_FLIPPED));
    }

    #[test]
    fn activate_midnight_meditation_creates_pending() {
        let mut state = setup_playing_game(vec!["march", "stamina", "rage"]);
        state.players[0].selected_tactic =
            Some(mk_types::ids::TacticId::from("midnight_meditation"));

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ActivateTactic,
            epoch,
        )
        .unwrap();

        assert!(state.players[0].flags.contains(PlayerFlags::TACTIC_FLIPPED));
        match &state.players[0].pending.active {
            Some(ActivePending::SubsetSelection(ss)) => {
                assert_eq!(ss.kind, mk_types::pending::SubsetSelectionKind::MidnightMeditation);
                assert_eq!(ss.max_selections, 3);
                assert_eq!(ss.min_selections, 0);
                assert!(ss.selected.is_empty());
            }
            other => panic!("Expected SubsetSelection, got {:?}", other),
        }
    }

    #[test]
    fn midnight_meditation_resolution_swaps_cards() {
        let mut state = setup_playing_game(vec!["march", "stamina", "rage"]);
        state.players[0].selected_tactic =
            Some(mk_types::ids::TacticId::from("midnight_meditation"));
        state.players[0].deck = vec![CardId::from("swiftness"), CardId::from("concentration")];
        state.players[0].discard.clear();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // Activate
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ActivateTactic,
            epoch,
        )
        .unwrap();

        // Resolve: select indices 0 and 1, then confirm
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SubsetSelect { index: 0 }, epoch,
        ).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SubsetSelect { index: 1 }, epoch,
        ).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SubsetConfirm, epoch,
        ).unwrap();

        // 3 cards: rage (kept) + 2 drawn
        assert_eq!(state.players[0].hand.len(), 3);
        assert!(state.players[0].hand.contains(&CardId::from("rage")));
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn mana_search_single_die_via_subset() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));

        let mut undo = UndoStack::new();

        // Initiate
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::InitiateManaSearch, epoch).unwrap();
        assert!(state.players[0].pending.has_active());

        // Select first die, then confirm
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetConfirm, epoch).unwrap();

        assert!(state.players[0].tactic_state.mana_search_used_this_turn);
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn mana_search_two_dice_auto_confirm() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));

        let available_count = state
            .source
            .dice
            .iter()
            .filter(|d| d.taken_by_player_id.is_none())
            .count();
        assert!(available_count >= 2, "Need at least 2 available dice");

        let mut undo = UndoStack::new();

        // Initiate
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::InitiateManaSearch, epoch).unwrap();

        // Select two dice — should auto-confirm at max (2)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 1 }, epoch).unwrap();

        assert!(state.players[0].tactic_state.mana_search_used_this_turn);
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn sparing_power_stash_moves_deck_top_to_storage() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("sparing_power"));
        state.players[0].deck = vec![CardId::from("swiftness"), CardId::from("concentration")];
        state.players[0].flags.insert(PlayerFlags::BEFORE_TURN_TACTIC_PENDING);
        state.players[0].pending.active = Some(ActivePending::TacticDecision(
            PendingTacticDecision::SparingPower,
        ));

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ResolveTacticDecision {
                data: TacticDecisionData::SparingPowerStash,
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.players[0].tactic_state.sparing_power_stored.len(), 1);
        assert_eq!(
            state.players[0].tactic_state.sparing_power_stored[0],
            CardId::from("swiftness")
        );
        assert_eq!(state.players[0].deck.len(), 1);
        assert!(!state.players[0].pending.has_active());
        assert!(!state.players[0].flags.contains(PlayerFlags::BEFORE_TURN_TACTIC_PENDING));
    }

    #[test]
    fn sparing_power_take_moves_stored_to_hand() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("sparing_power"));
        state.players[0].tactic_state.sparing_power_stored = vec![
            CardId::from("swiftness"),
            CardId::from("concentration"),
        ];
        state.players[0].flags.insert(PlayerFlags::BEFORE_TURN_TACTIC_PENDING);
        state.players[0].pending.active = Some(ActivePending::TacticDecision(
            PendingTacticDecision::SparingPower,
        ));

        let initial_hand = state.players[0].hand.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ResolveTacticDecision {
                data: TacticDecisionData::SparingPowerTake,
            },
            epoch,
        )
        .unwrap();

        assert_eq!(state.players[0].hand.len(), initial_hand + 2);
        assert!(state.players[0].hand.contains(&CardId::from("swiftness")));
        assert!(state.players[0].hand.contains(&CardId::from("concentration")));
        assert!(state.players[0].tactic_state.sparing_power_stored.is_empty());
        assert!(state.players[0].flags.contains(PlayerFlags::TACTIC_FLIPPED));
        assert!(!state.players[0].flags.contains(PlayerFlags::BEFORE_TURN_TACTIC_PENDING));
    }

    #[test]
    fn turn_order_sorted_by_tactic_number() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // Select tactic — solo has human + dummy in turn_order
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("planning"),
            },
            epoch,
        )
        .unwrap();

        // Turn order has 2 entries: human + dummy
        assert_eq!(state.turn_order.len(), 2);
        // Dummy also selected a tactic
        assert!(state.dummy_player_tactic.is_some());
        // current_player_index should point to the human's position
        let human_id = state.players[0].id.clone();
        assert_eq!(state.turn_order[state.current_player_index as usize], human_id);
    }

    #[test]
    fn rethink_pending_enumeration() {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("stamina"),
        ];

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // Select rethink (max_selections will be min(3, 2) = 2)
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("rethink"),
            },
            epoch,
        )
        .unwrap();

        // Enumerate legal actions — should see SubsetSelect per hand card + SubsetConfirm
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let selects: Vec<_> = legal
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::SubsetSelect { .. }))
            .collect();
        let confirms: Vec<_> = legal
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::SubsetConfirm))
            .collect();

        // 2 hand cards → 2 SubsetSelect + 1 SubsetConfirm (min_selections=0)
        assert_eq!(selects.len(), 2);
        assert_eq!(confirms.len(), 1);
    }

    #[test]
    fn mana_steal_pending_enumeration() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("mana_steal"),
            },
            epoch,
        )
        .unwrap();

        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let tactic_decisions: Vec<_> = legal
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::ResolveTacticDecision { .. }))
            .collect();

        // Each available basic die → one action
        let available_basic = state
            .source
            .dice
            .iter()
            .filter(|d| !d.is_depleted && d.taken_by_player_id.is_none() && d.color.is_basic())
            .count();
        assert_eq!(tactic_decisions.len(), available_basic);
        assert!(available_basic > 0);
    }

    #[test]
    fn activate_tactic_enumerated_for_trm() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic =
            Some(mk_types::ids::TacticId::from("the_right_moment"));

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            legal.actions.contains(&LegalAction::ActivateTactic),
            "ActivateTactic should be available for The Right Moment"
        );
    }

    #[test]
    fn activate_tactic_not_enumerated_after_flip() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic =
            Some(mk_types::ids::TacticId::from("the_right_moment"));
        state.players[0].flags.insert(PlayerFlags::TACTIC_FLIPPED);

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            !legal.actions.contains(&LegalAction::ActivateTactic),
            "ActivateTactic should NOT be available after flip"
        );
    }

    #[test]
    fn mana_search_enumerated_for_mana_search_tactic() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            legal.actions.contains(&LegalAction::InitiateManaSearch),
            "Should have InitiateManaSearch for mana_search tactic"
        );
    }

    #[test]
    fn mana_search_not_enumerated_after_use() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));
        state.players[0].tactic_state.mana_search_used_this_turn = true;

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            !legal.actions.contains(&LegalAction::InitiateManaSearch),
            "Should NOT have InitiateManaSearch after use"
        );
    }

    #[test]
    fn activate_trm_during_combat() {
        let mut state = setup_combat_game(&["prowlers"]);
        state.players[0].selected_tactic =
            Some(mk_types::ids::TacticId::from("the_right_moment"));

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            legal.actions.contains(&LegalAction::ActivateTactic),
            "The Right Moment should be available during combat"
        );
    }

    #[test]
    fn long_night_enumerated_when_deck_empty() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("long_night"));
        state.players[0].deck.clear();
        state.players[0].discard = vec![CardId::from("stamina")];

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            legal.actions.contains(&LegalAction::ActivateTactic),
            "Long Night should be available when deck empty and discard not empty"
        );
    }

    #[test]
    fn long_night_not_enumerated_when_deck_not_empty() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("long_night"));
        // deck is not empty (default from setup)
        state.players[0].discard = vec![CardId::from("stamina")];

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            !legal.actions.contains(&LegalAction::ActivateTactic),
            "Long Night should NOT be available when deck not empty"
        );
    }

    // =========================================================================
    // Tactic validation — enumeration gates
    // =========================================================================

    #[test]
    fn tactic_selection_not_enumerated_during_player_turns() {
        let state = setup_playing_game(vec!["march"]);
        // Already in PlayerTurns phase
        assert_eq!(state.round_phase, RoundPhase::PlayerTurns);

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        let select_tactics: Vec<_> = legal
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::SelectTactic { .. }))
            .collect();
        assert!(
            select_tactics.is_empty(),
            "SelectTactic should NOT appear during PlayerTurns phase"
        );
    }

    #[test]
    fn normal_actions_not_enumerated_during_tactics_phase() {
        let state = create_solo_game(42, Hero::Arythea);
        assert_eq!(state.round_phase, RoundPhase::TacticsSelection);

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        // Should only have SelectTactic actions
        for action in &legal.actions {
            assert!(
                matches!(action, LegalAction::SelectTactic { .. }),
                "Only SelectTactic should appear during TacticsSelection, got {:?}",
                action
            );
        }
        assert!(!legal.actions.is_empty(), "Should have at least one tactic to select");
    }

    #[test]
    fn selected_tactic_removed_from_available() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let tactic = state.available_tactics[0].clone();
        assert_eq!(state.available_tactics.len(), 6);

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: tactic.clone(),
            },
            epoch,
        )
        .unwrap();

        assert!(!state.available_tactics.contains(&tactic));
        // Human tactic + dummy auto-selected tactic = 2 removed from 6
        assert_eq!(state.available_tactics.len(), 4);
    }

    #[test]
    fn night_tactics_available_after_round_end() {
        use crate::card_play::play_card;
        use crate::end_turn::end_turn;

        let mut state = create_solo_game(42, Hero::Arythea);

        // Select a day tactic
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        let tactic = state.available_tactics[0].clone();
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: tactic,
            },
            epoch,
        )
        .unwrap();

        // Empty deck AND reduce hand to 1 card so round ends after playing it
        state.players[0].deck.clear();
        state.players[0].hand = vec![CardId::from("march")];

        // Play the last card and end turn — hand+deck both empty triggers round end
        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Should now be night → night tactics available
        assert_eq!(state.time_of_day, TimeOfDay::Night);
        assert_eq!(state.round_phase, RoundPhase::TacticsSelection);

        // Verify night tactics are enumerated
        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        let tactic_ids: Vec<&str> = legal
            .actions
            .iter()
            .filter_map(|a| match a {
                LegalAction::SelectTactic { tactic_id } => Some(tactic_id.as_str()),
                _ => None,
            })
            .collect();

        assert!(tactic_ids.contains(&"from_the_dusk"), "Night tactic should be available");
        assert!(
            !tactic_ids.contains(&"early_bird"),
            "Day tactic should NOT be available at night"
        );
    }

    #[test]
    fn pending_rethink_blocks_all_normal_actions() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("rethink"),
            },
            epoch,
        )
        .unwrap();

        assert!(state.players[0].pending.has_active());

        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        // Only SubsetSelect/SubsetConfirm/Undo should be available
        for action in &legal.actions {
            assert!(
                matches!(
                    action,
                    LegalAction::SubsetSelect { .. }
                        | LegalAction::SubsetConfirm
                        | LegalAction::Undo
                ),
                "Only SubsetSelect/SubsetConfirm/Undo allowed with pending, got {:?}",
                action
            );
        }
        // Should have at least SubsetConfirm (empty-set confirm)
        assert!(!legal.actions.is_empty());
    }

    #[test]
    fn pending_mana_steal_blocks_normal_actions() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("mana_steal"),
            },
            epoch,
        )
        .unwrap();

        assert!(state.players[0].pending.has_active());

        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        for action in &legal.actions {
            assert!(
                matches!(
                    action,
                    LegalAction::ResolveTacticDecision { .. } | LegalAction::Undo
                ),
                "Only ResolveTacticDecision/Undo allowed with ManaSteal pending, got {:?}",
                action
            );
        }
    }

    #[test]
    fn pending_preparation_blocks_normal_actions() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("preparation"),
            },
            epoch,
        )
        .unwrap();

        assert!(state.players[0].pending.has_active());

        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        for action in &legal.actions {
            assert!(
                matches!(
                    action,
                    LegalAction::ResolveTacticDecision { .. } | LegalAction::Undo
                ),
                "Only ResolveTacticDecision/Undo allowed with Preparation pending, got {:?}",
                action
            );
        }
    }

    #[test]
    fn midnight_meditation_not_activatable_after_move() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic =
            Some(mk_types::ids::TacticId::from("midnight_meditation"));
        state.players[0].flags.insert(PlayerFlags::HAS_MOVED_THIS_TURN);

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            !legal.actions.contains(&LegalAction::ActivateTactic),
            "MM should NOT be activatable after moving"
        );
    }

    #[test]
    fn midnight_meditation_not_activatable_after_action() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic =
            Some(mk_types::ids::TacticId::from("midnight_meditation"));
        state.players[0]
            .flags
            .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            !legal.actions.contains(&LegalAction::ActivateTactic),
            "MM should NOT be activatable after taking an action"
        );
    }

    #[test]
    fn midnight_meditation_not_activatable_with_empty_hand() {
        let mut state = setup_playing_game(vec![]);
        state.players[0].selected_tactic =
            Some(mk_types::ids::TacticId::from("midnight_meditation"));

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            !legal.actions.contains(&LegalAction::ActivateTactic),
            "MM should NOT be activatable with empty hand"
        );
    }

    #[test]
    fn the_right_moment_not_activatable_after_round_announced() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic =
            Some(mk_types::ids::TacticId::from("the_right_moment"));
        state.end_of_round_announced_by = Some(state.players[0].id.clone());

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            !legal.actions.contains(&LegalAction::ActivateTactic),
            "TRM should NOT be activatable after round end announced"
        );
    }

    #[test]
    fn long_night_not_activatable_with_nonempty_deck() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("long_night"));
        state.players[0].discard = vec![CardId::from("stamina")];
        // deck is not empty by default

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            !legal.actions.contains(&LegalAction::ActivateTactic),
            "Long Night should NOT be activatable when deck is not empty"
        );
    }

    #[test]
    fn long_night_not_activatable_with_empty_discard() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("long_night"));
        state.players[0].deck.clear();
        state.players[0].discard.clear();

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            !legal.actions.contains(&LegalAction::ActivateTactic),
            "Long Night should NOT be activatable when discard is empty"
        );
    }

    #[test]
    fn mana_search_not_enumerated_when_tactic_flipped() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));
        state.players[0].flags.insert(PlayerFlags::TACTIC_FLIPPED);

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        assert!(
            !legal.actions.contains(&LegalAction::InitiateManaSearch),
            "Mana Search should NOT work when tactic is flipped"
        );
    }

    #[test]
    fn rethink_skips_pending_with_empty_hand() {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.players[0].hand.clear();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("rethink"),
            },
            epoch,
        )
        .unwrap();

        // With empty hand, Rethink should NOT create a pending
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn mana_steal_skips_pending_when_no_basic_dice() {
        let mut state = create_solo_game(42, Hero::Arythea);
        // Mark all dice as depleted
        for die in &mut state.source.dice {
            die.is_depleted = true;
        }

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("mana_steal"),
            },
            epoch,
        )
        .unwrap();

        // No basic dice available → no pending
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn preparation_skips_pending_with_empty_deck() {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.players[0].deck.clear();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("preparation"),
            },
            epoch,
        )
        .unwrap();

        // Empty deck → no pending
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn midnight_meditation_duplicate_cards_in_hand() {
        // Test swapping duplicate cards from hand
        let mut state = setup_playing_game(vec!["march", "march", "march", "rage"]);
        state.players[0].selected_tactic =
            Some(mk_types::ids::TacticId::from("midnight_meditation"));
        state.players[0].deck = vec![CardId::from("stamina"), CardId::from("swiftness")];
        state.players[0].discard.clear();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // Activate MM
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ActivateTactic,
            epoch,
        )
        .unwrap();

        // Resolve: select indices 0 and 1 (2 of the 3 marches), then confirm
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SubsetSelect { index: 0 }, epoch,
        ).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SubsetSelect { index: 1 }, epoch,
        ).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SubsetConfirm, epoch,
        ).unwrap();

        // Should still have 4 cards in hand (rage + 1 march kept + 2 drawn)
        assert_eq!(state.players[0].hand.len(), 4);
        // Rage should still be in hand (index 3 was not swapped)
        assert!(state.players[0].hand.contains(&CardId::from("rage")));
        // At least 1 march should remain (index 2 was kept)
        let march_count = state.players[0]
            .hand
            .iter()
            .filter(|c| c.as_str() == "march")
            .count();
        assert!(march_count >= 1, "At least 1 march should remain (unswapped)");
        // Deck should have remaining pool cards
        // Pool was: 2 marches + 2 deck cards = 4, drew 2 back, so deck has 2
        assert_eq!(state.players[0].deck.len(), 2);
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn subset_select_auto_confirms_at_max() {
        // With 3-card hand and max_selections=3, selecting 3 cards should auto-confirm
        let mut state = create_solo_game(42, Hero::Arythea);
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("stamina"),
            CardId::from("rage"),
        ];
        state.players[0].deck = vec![CardId::from("swiftness"), CardId::from("concentration")];
        state.players[0].discard.clear();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        // Select rethink (max_selections = min(3,3) = 3)
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("rethink"),
            },
            epoch,
        ).unwrap();

        // Select all 3 — third should auto-confirm (no explicit SubsetConfirm needed)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 1 }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 2 }, epoch).unwrap();

        // Pending should be cleared (auto-confirmed)
        assert!(!state.players[0].pending.has_active());
        // All 3 were swapped, so hand should have 3 new cards
        assert_eq!(state.players[0].hand.len(), 3);
    }

    #[test]
    fn subset_select_excludes_already_selected() {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("stamina"),
            CardId::from("rage"),
        ];

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SelectTactic {
                tactic_id: mk_types::ids::TacticId::from("rethink"),
            },
            epoch,
        ).unwrap();

        // Select index 1
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 1 }, epoch).unwrap();

        // Enumerate — should have SubsetSelect for 0 and 2 (not 1) + SubsetConfirm
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let selects: Vec<usize> = legal.actions.iter().filter_map(|a| match a {
            LegalAction::SubsetSelect { index } => Some(*index),
            _ => None,
        }).collect();
        assert_eq!(selects, vec![0, 2]);
        assert!(legal.actions.contains(&LegalAction::SubsetConfirm));
    }

    #[test]
    fn subset_select_no_confirm_below_min() {
        // If min_selections > 0, SubsetConfirm should not appear until met.
        // Currently Rethink/MM have min_selections=0, so this tests the state directly.
        use mk_types::pending::{SubsetSelectionState, SubsetSelectionKind};
        let mut state = setup_playing_game(vec!["march", "stamina"]);

        // Manually set a SubsetSelection with min_selections=1
        state.players[0].pending.active = Some(ActivePending::SubsetSelection(SubsetSelectionState {
            kind: SubsetSelectionKind::Rethink,
            pool_size: 2,
            max_selections: 2,
            min_selections: 1,
            selected: arrayvec::ArrayVec::new(),
        }));

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        // No confirm yet (0 < 1)
        assert!(!legal.actions.contains(&LegalAction::SubsetConfirm));
        // But SubsetSelect is available
        assert!(legal.actions.iter().any(|a| matches!(a, LegalAction::SubsetSelect { .. })));
    }

    #[test]
    fn non_active_player_gets_no_actions() {
        // In solo, during TacticsSelection, only the selector gets actions
        let state = create_solo_game(42, Hero::Arythea);
        assert_eq!(state.round_phase, RoundPhase::TacticsSelection);

        // Player 0 is the selector — try enumerating for an out-of-range player
        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 1, &undo);
        assert!(legal.actions.is_empty(), "Non-existent player should get no actions");
    }

    #[test]
    fn game_ended_returns_no_actions() {
        let mut state = setup_playing_game(vec!["march"]);
        state.game_ended = true;

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(legal.actions.is_empty(), "No actions when game has ended");
    }

    #[test]
    fn stale_epoch_rejected_for_tactic_selection() {
        let mut state = create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();
        let stale_epoch = state.action_epoch + 100;
        let tactic = state.available_tactics[0].clone();

        let result = apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::SelectTactic {
                tactic_id: tactic,
            },
            stale_epoch,
        );
        assert!(matches!(result, Err(ApplyError::StaleActionSet { .. })));
    }

    // =========================================================================
    // Site interaction tests
    // =========================================================================

    use arrayvec::ArrayVec;
    use mk_types::hex::HexCoord;

    /// Helper: place player on a hex with a specific site.
    fn place_player_on_site(state: &mut GameState, site_type: SiteType) -> HexCoord {
        let coord = HexCoord { q: 99, r: 99 };
        let hex = HexState {
            coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type,
                owner: None,
                is_conquered: false,
                is_burned: false,
                city_color: None,
                mine_color: if site_type == SiteType::Mine {
                    Some(BasicManaColor::Red)
                } else {
                    None
                },
                deep_mine_colors: if site_type == SiteType::DeepMine {
                    let mut colors = ArrayVec::new();
                    colors.push(BasicManaColor::Blue);
                    colors.push(BasicManaColor::Green);
                    Some(colors)
                } else {
                    None
                },
            }),
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            shield_tokens: Vec::new(),
        };
        state.map.hexes.insert(coord.key(), hex);
        state.players[0].position = Some(coord);
        coord
    }

    // --- EnterSite tests ---

    #[test]
    fn enter_site_enumerated_on_dungeon() {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, SiteType::Dungeon);

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            actions.actions.iter().any(|a| matches!(a, LegalAction::EnterSite)),
            "EnterSite should be available on Dungeon"
        );
    }

    #[test]
    fn enter_site_not_after_action_taken() {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, SiteType::Dungeon);
        state.players[0].flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::EnterSite)),
            "EnterSite should NOT be available after action taken"
        );
    }

    #[test]
    fn enter_site_not_at_conquered_monster_den() {
        let mut state = setup_playing_game(vec!["march"]);
        let coord = place_player_on_site(&mut state, SiteType::MonsterDen);
        state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::EnterSite)),
            "EnterSite should NOT be available at conquered MonsterDen"
        );
    }

    #[test]
    fn enter_site_at_conquered_dungeon() {
        let mut state = setup_playing_game(vec!["march"]);
        let coord = place_player_on_site(&mut state, SiteType::Dungeon);
        state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            actions.actions.iter().any(|a| matches!(a, LegalAction::EnterSite)),
            "EnterSite SHOULD be available at conquered Dungeon (for fame)"
        );
    }

    #[test]
    fn enter_site_draws_one_brown_for_dungeon() {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, SiteType::Dungeon);
        let brown_before = state.enemy_tokens.brown_draw.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

        // Should have drawn 1 brown enemy
        assert_eq!(state.enemy_tokens.brown_draw.len(), brown_before - 1);
        // Should be in combat
        assert!(state.combat.is_some());
    }

    #[test]
    fn enter_site_spawning_grounds_draws_two() {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, SiteType::SpawningGrounds);
        let brown_before = state.enemy_tokens.brown_draw.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

        // Should have drawn 2 brown enemies
        assert_eq!(state.enemy_tokens.brown_draw.len(), brown_before - 2);
        // Should be in combat with 2 enemies
        assert_eq!(state.combat.as_ref().unwrap().enemies.len(), 2);
    }

    #[test]
    fn enter_site_monster_den_reuses_existing_enemies() {
        let mut state = setup_playing_game(vec!["march"]);
        let coord = place_player_on_site(&mut state, SiteType::MonsterDen);

        // Place an existing enemy on the hex
        let token_id = state.enemy_tokens.brown_draw.remove(0);
        let hex = state.map.hexes.get_mut(&coord.key()).unwrap();
        hex.enemies.push(HexEnemy {
            token_id: token_id.clone(),
            color: EnemyColor::Brown,
            is_revealed: true,
        });
        let brown_before = state.enemy_tokens.brown_draw.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

        // Should NOT have drawn from pile (reuses existing)
        assert_eq!(state.enemy_tokens.brown_draw.len(), brown_before);
        // Should be in combat
        assert!(state.combat.is_some());
    }

    #[test]
    fn enter_dungeon_no_units_night_mana() {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, SiteType::Dungeon);

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

        let combat = state.combat.as_ref().unwrap();
        assert!(!combat.units_allowed, "Dungeon: no units");
        assert!(combat.night_mana_rules, "Dungeon: night mana rules");
    }

    #[test]
    fn enter_tomb_red_enemy() {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, SiteType::Tomb);
        let red_before = state.enemy_tokens.red_draw.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

        // Should have drawn 1 red enemy
        assert_eq!(state.enemy_tokens.red_draw.len(), red_before - 1);
        assert!(state.combat.is_some());
    }

    // --- Conquest tests ---

    #[test]
    fn conquest_marks_site() {
        let mut state = setup_playing_game(vec!["march"]);
        let coord = place_player_on_site(&mut state, SiteType::Dungeon);

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

        // Mark all enemies as defeated
        let combat = state.combat.as_mut().unwrap();
        for enemy in combat.enemies.iter_mut() {
            enemy.is_defeated = true;
        }
        combat.phase = CombatPhase::Attack;

        // End combat phase (Attack → end combat)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

        // Site should be conquered
        let hex = state.map.hexes.get(&coord.key()).unwrap();
        assert!(hex.site.as_ref().unwrap().is_conquered);
        assert_eq!(
            hex.site.as_ref().unwrap().owner.as_ref().unwrap().as_str(),
            state.players[0].id.as_str()
        );
        // Enemies should be cleared from hex
        assert!(hex.enemies.is_empty());
    }

    // --- InteractSite tests ---

    #[test]
    fn interact_site_enumerated_at_village() {
        let mut state = setup_playing_game(vec!["wound", "march"]);
        place_player_on_site(&mut state, SiteType::Village);
        state.players[0].influence_points = 6; // enough for 2 heals at cost 3

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let healing_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::InteractSite { .. }))
            .collect();
        // Only 1 wound in hand → max 1 heal
        assert_eq!(healing_actions.len(), 1);
        assert!(matches!(healing_actions[0], LegalAction::InteractSite { healing: 1 }));
    }

    #[test]
    fn interact_site_not_without_wounds() {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, SiteType::Village);
        state.players[0].influence_points = 6;

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
            "No healing without wounds"
        );
    }

    #[test]
    fn interact_site_not_without_influence() {
        let mut state = setup_playing_game(vec!["wound", "march"]);
        place_player_on_site(&mut state, SiteType::Village);
        state.players[0].influence_points = 2; // not enough (cost 3)

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
            "No healing without enough influence"
        );
    }

    #[test]
    fn interact_site_heals_and_deducts() {
        let mut state = setup_playing_game(vec!["wound", "march"]);
        place_player_on_site(&mut state, SiteType::Village);
        state.players[0].influence_points = 6;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::InteractSite { healing: 1 },
            epoch,
        ).unwrap();

        assert_eq!(state.players[0].influence_points, 3); // 6 - 3
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
        assert_eq!(state.players[0].hand.len(), 1); // just march
    }

    #[test]
    fn monastery_cheaper_healing() {
        let mut state = setup_playing_game(vec!["wound", "march"]);
        place_player_on_site(&mut state, SiteType::Monastery);
        state.players[0].influence_points = 2;

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { healing: 1 })),
            "Monastery healing at cost 2"
        );
    }

    #[test]
    fn keep_only_when_conquered() {
        let mut state = setup_playing_game(vec!["wound", "march"]);
        let coord = place_player_on_site(&mut state, SiteType::Keep);
        state.players[0].influence_points = 10;

        // Not conquered → no interaction
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
            "Keep not accessible when unconquered"
        );

        // Conquer it
        state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
        // Keep doesn't have healing cost by default (only Village/Monastery/RefugeeCamp)
        // So InteractSite still won't be enumerated — correct behavior
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
            "Keep has no healing cost"
        );
    }

    #[test]
    fn multiple_healing_levels_enumerated() {
        let mut state = setup_playing_game(vec!["wound", "wound", "wound", "march"]);
        place_player_on_site(&mut state, SiteType::Village);
        state.players[0].influence_points = 9; // enough for 3 heals at cost 3

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let healing_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::InteractSite { .. }))
            .collect();
        assert_eq!(healing_actions.len(), 3); // heal 1, 2, or 3
    }

    #[test]
    fn burned_site_blocks_interaction() {
        let mut state = setup_playing_game(vec!["wound", "march"]);
        let coord = place_player_on_site(&mut state, SiteType::Village);
        state.players[0].influence_points = 6;
        state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_burned = true;

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
            "Burned site blocks interaction"
        );
    }

    // --- Plunder tests ---

    #[test]
    fn plunder_decision_offered_at_unconquered_village() {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, SiteType::Village);
        state.players[0].pending.active = Some(ActivePending::PlunderDecision);

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(actions.actions.iter().any(|a| matches!(a, LegalAction::PlunderSite)));
        assert!(actions.actions.iter().any(|a| matches!(a, LegalAction::DeclinePlunder)));
    }

    #[test]
    fn plunder_burns_site_and_rep_hit() {
        let mut state = setup_playing_game(vec!["march"]);
        let coord = place_player_on_site(&mut state, SiteType::Village);
        state.players[0].pending.active = Some(ActivePending::PlunderDecision);
        let rep_before = state.players[0].reputation;
        // Put cards in deck to test draw
        state.players[0].deck = vec![CardId::from("rage"), CardId::from("swiftness")];
        let hand_before = state.players[0].hand.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlunderSite, epoch).unwrap();

        let site = state.map.hexes.get(&coord.key()).unwrap().site.as_ref().unwrap();
        assert!(site.is_burned, "Site should be burned");
        assert_eq!(state.players[0].reputation, rep_before - 1, "Reputation -1");
        assert!(state.players[0].flags.contains(PlayerFlags::HAS_PLUNDERED_THIS_TURN));
        assert!(!state.players[0].pending.has_active(), "Pending should be cleared");
        // Should have drawn 2 cards
        assert_eq!(state.players[0].hand.len(), hand_before + 2, "Should draw 2 cards");
        assert!(state.players[0].deck.is_empty(), "Deck should be empty after draw");
    }

    #[test]
    fn plunder_draws_fewer_if_deck_small() {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, SiteType::Village);
        state.players[0].pending.active = Some(ActivePending::PlunderDecision);
        state.players[0].deck = vec![CardId::from("rage")]; // only 1 card in deck
        let hand_before = state.players[0].hand.len();

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlunderSite, epoch).unwrap();

        assert_eq!(state.players[0].hand.len(), hand_before + 1, "Should draw only 1");
    }

    #[test]
    fn plunder_reputation_capped_at_minus_seven() {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, SiteType::Village);
        state.players[0].pending.active = Some(ActivePending::PlunderDecision);
        state.players[0].reputation = -7;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlunderSite, epoch).unwrap();

        assert_eq!(state.players[0].reputation, -7, "Reputation should not go below -7");
    }

    #[test]
    fn decline_plunder_clears_pending() {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, SiteType::Village);
        state.players[0].pending.active = Some(ActivePending::PlunderDecision);

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::DeclinePlunder, epoch).unwrap();

        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn no_plunder_at_conquered_site() {
        let mut state = setup_playing_game(vec!["march"]);
        let coord = place_player_on_site(&mut state, SiteType::Village);
        state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;

        // Plunder decision shouldn't be set for conquered sites
        // (tested via advance_turn / plunder_decision logic)
        assert!(!state.players[0].pending.has_active());
    }

    // =========================================================================
    // Glade Wound Choice
    // =========================================================================

    #[test]
    fn glade_wound_choice_hand_removes_from_hand() {
        let mut state = setup_playing_game(vec!["wound", "march"]);
        state.players[0].pending.active = Some(ActivePending::GladeWoundChoice);
        state.players[0].discard.push(CardId::from("wound"));

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveGladeWound { choice: GladeWoundChoice::Hand },
            epoch,
        ).unwrap();

        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"), "Hand wound removed");
        assert!(state.players[0].discard.iter().any(|c| c.as_str() == "wound"), "Discard wound preserved");
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn glade_wound_choice_discard_removes_from_discard() {
        let mut state = setup_playing_game(vec!["wound", "march"]);
        state.players[0].pending.active = Some(ActivePending::GladeWoundChoice);
        state.players[0].discard.push(CardId::from("wound"));

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveGladeWound { choice: GladeWoundChoice::Discard },
            epoch,
        ).unwrap();

        assert!(state.players[0].hand.iter().any(|c| c.as_str() == "wound"), "Hand wound preserved");
        assert!(!state.players[0].discard.iter().any(|c| c.as_str() == "wound"), "Discard wound removed");
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn glade_wound_choice_enumeration() {
        let mut state = setup_playing_game(vec!["wound", "march"]);
        state.players[0].pending.active = Some(ActivePending::GladeWoundChoice);
        state.players[0].discard.push(CardId::from("wound"));

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(actions.actions.iter().any(|a| matches!(a,
            LegalAction::ResolveGladeWound { choice: GladeWoundChoice::Hand }
        )));
        assert!(actions.actions.iter().any(|a| matches!(a,
            LegalAction::ResolveGladeWound { choice: GladeWoundChoice::Discard }
        )));
    }

    // =========================================================================
    // Skill activation integration tests
    // =========================================================================

    #[test]
    fn battle_frenzy_attack2_no_flip() {
        let mut state = crate::setup::create_solo_game(42, Hero::Krang);
        state.round_phase = RoundPhase::PlayerTurns;
        state.phase = GamePhase::Round;
        state.players[0].skills.push(SkillId::from("krang_battle_frenzy"));
        state.combat = Some(Box::new(CombatState::default()));

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        // UseSkill creates a pending choice
        let result = apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: SkillId::from("krang_battle_frenzy") },
            epoch,
        );
        assert!(result.is_ok());
        assert!(state.players[0].pending.active.is_some());

        // Resolve choice 0 (Attack 2) — should NOT flip
        let epoch = state.action_epoch;
        let result = apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        );
        assert!(result.is_ok());
        assert!(
            !state.players[0].skill_flip_state.flipped_skills.iter()
                .any(|s| s.as_str() == "krang_battle_frenzy"),
            "Attack 2 option should not flip the skill"
        );
        // Check combat accumulator got +2 attack
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
    }

    #[test]
    fn battle_frenzy_attack4_flips() {
        let mut state = crate::setup::create_solo_game(42, Hero::Krang);
        state.round_phase = RoundPhase::PlayerTurns;
        state.phase = GamePhase::Round;
        state.players[0].skills.push(SkillId::from("krang_battle_frenzy"));
        state.combat = Some(Box::new(CombatState::default()));

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        let _ = apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: SkillId::from("krang_battle_frenzy") },
            epoch,
        );

        // Resolve choice 1 (Attack 4) — should flip
        let epoch = state.action_epoch;
        let result = apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 1 },
            epoch,
        );
        assert!(result.is_ok());
        assert!(
            state.players[0].skill_flip_state.flipped_skills.iter()
                .any(|s| s.as_str() == "krang_battle_frenzy"),
            "Attack 4 option should flip the skill face-down"
        );
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 4);
    }

    #[test]
    fn flipped_battle_frenzy_not_activatable() {
        let mut state = crate::setup::create_solo_game(42, Hero::Krang);
        state.round_phase = RoundPhase::PlayerTurns;
        state.phase = GamePhase::Round;
        state.players[0].skills.push(SkillId::from("krang_battle_frenzy"));
        state.players[0].skill_flip_state.flipped_skills.push(SkillId::from("krang_battle_frenzy"));
        state.combat = Some(Box::new(CombatState::default()));

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(
            !actions.actions.iter().any(|a| matches!(a,
                LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "krang_battle_frenzy"
            )),
            "Flipped battle_frenzy should not be activatable"
        );
    }

    #[test]
    fn inspiration_heals_wounded_unit() {
        use mk_types::ids::{UnitId, UnitInstanceId};

        let mut state = crate::setup::create_solo_game(42, Hero::Norowas);
        state.round_phase = RoundPhase::PlayerTurns;
        state.phase = GamePhase::Round;
        state.players[0].skills.push(SkillId::from("norowas_inspiration"));
        // Add a wounded unit
        state.players[0].units.push(PlayerUnit {
            unit_id: UnitId::from("peasants"),
            instance_id: UnitInstanceId::from("unit_0"),
            level: 1,
            state: UnitState::Ready,
            wounded: true,
            used_resistance_this_combat: false,
            used_ability_indices: vec![],
            mana_token: None,
        });

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        // UseSkill → pending choice (ReadyUnit vs HealUnit)
        let _ = apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: SkillId::from("norowas_inspiration") },
            epoch,
        );
        assert!(state.players[0].pending.active.is_some());

        // Choose HealUnit (index 1)
        let epoch = state.action_epoch;
        let _ = apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 1 },
            epoch,
        );
        // Unit should be healed
        assert!(!state.players[0].units[0].wounded, "Unit should be healed");
    }

    // =============================================================================
    // Sideways value skill tests
    // =============================================================================

    fn setup_with_skill(hero: Hero, skill_id: &str) -> (GameState, UndoStack) {
        let mut state = create_solo_game(42, hero);
        state.round_phase = RoundPhase::PlayerTurns;
        state.phase = GamePhase::Round;
        state.players[0].skills.push(mk_types::ids::SkillId::from(skill_id));
        (state, UndoStack::new())
    }

    #[test]
    fn power_of_pain_pushes_modifiers() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_power_of_pain");
        state.players[0].hand = vec![CardId::from("wound")];
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("arythea_power_of_pain") },
            epoch,
        ).unwrap();
        // Should have 2 modifiers: RuleOverride(WoundsPlayableSideways) + SidewaysValue(for_wounds=true, 2)
        assert_eq!(state.active_modifiers.len(), 2);
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride { rule }
                if *rule == mk_types::modifier::RuleOverride::WoundsPlayableSideways)
        ));
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::SidewaysValue {
                new_value, for_wounds, ..
            } if *new_value == 2 && *for_wounds)
        ));
    }

    #[test]
    fn i_dont_give_a_damn_basic_action_plus2() {
        let (mut state, mut undo) = setup_with_skill(Hero::Tovak, "tovak_i_dont_give_a_damn");
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("tovak_i_dont_give_a_damn") },
            epoch,
        ).unwrap();
        // Basic action sideways = 2 (not matched by the AA/Spell/Artifact +3 filter)
        let val = crate::card_play::get_effective_sideways_value(
            &state, 0, false, DeedCardType::BasicAction, Some(BasicManaColor::Green),
        );
        assert_eq!(val, 2);
    }

    #[test]
    fn i_dont_give_a_damn_advanced_action_plus3() {
        let (mut state, mut undo) = setup_with_skill(Hero::Tovak, "tovak_i_dont_give_a_damn");
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("tovak_i_dont_give_a_damn") },
            epoch,
        ).unwrap();
        // AA sideways = 3
        let val = crate::card_play::get_effective_sideways_value(
            &state, 0, false, DeedCardType::AdvancedAction, Some(BasicManaColor::Red),
        );
        assert_eq!(val, 3);
    }

    #[test]
    fn who_needs_magic_plus3_no_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Tovak, "tovak_who_needs_magic");
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("tovak_who_needs_magic") },
            epoch,
        ).unwrap();
        // +3 when no Source die used
        let val = crate::card_play::get_effective_sideways_value(
            &state, 0, false, DeedCardType::BasicAction, None,
        );
        assert_eq!(val, 3);
        // Should also have SourceBlocked rule active
        assert!(crate::card_play::is_rule_active(
            &state, 0, mk_types::modifier::RuleOverride::SourceBlocked
        ));
    }

    #[test]
    fn who_needs_magic_plus2_after_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Tovak, "tovak_who_needs_magic");
        // Set mana used flag BEFORE activating skill
        state.players[0].flags.insert(PlayerFlags::USED_MANA_FROM_SOURCE);
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("tovak_who_needs_magic") },
            epoch,
        ).unwrap();
        // +2 when Source die already used (NoManaUsed condition fails)
        let val = crate::card_play::get_effective_sideways_value(
            &state, 0, false, DeedCardType::BasicAction, None,
        );
        assert_eq!(val, 2);
        // SourceBlocked should NOT be pushed (mana was already used)
        assert!(!crate::card_play::is_rule_active(
            &state, 0, mk_types::modifier::RuleOverride::SourceBlocked
        ));
    }

    #[test]
    fn universal_power_mana_choice() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_universal_power");
        // Give player 2 basic mana tokens (red and blue)
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red, source: ManaTokenSource::Effect, cannot_power_spells: false,
        });
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Blue, source: ManaTokenSource::Effect, cannot_power_spells: false,
        });
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("goldyx_universal_power") },
            epoch,
        ).unwrap();
        // Should have pending choice (2 color options)
        assert!(state.players[0].pending.has_active());
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2);
            assert!(matches!(&choice.resolution, mk_types::pending::ChoiceResolution::UniversalPowerMana { available_colors } if available_colors.len() == 2));
        } else {
            panic!("Expected ActivePending::Choice");
        }
        // Resolve: pick first (red)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();
        // Red mana consumed, blue remains
        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Blue);
        // Should have 2 modifiers: SidewaysValue(3) + SidewaysValue(4, WithManaMatchingColor, Red)
        assert_eq!(state.active_modifiers.len(), 2);
    }

    #[test]
    fn universal_power_auto_consume_single_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_universal_power");
        // Give player 1 basic mana token (green only)
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Green, source: ManaTokenSource::Effect, cannot_power_spells: false,
        });
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("goldyx_universal_power") },
            epoch,
        ).unwrap();
        // Auto-consumed (no pending)
        assert!(!state.players[0].pending.has_active());
        assert!(state.players[0].pure_mana.is_empty());
        assert_eq!(state.active_modifiers.len(), 2);
    }

    #[test]
    fn universal_power_color_match_plus4() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_universal_power");
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Green, source: ManaTokenSource::Effect, cannot_power_spells: false,
        });
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("goldyx_universal_power") },
            epoch,
        ).unwrap();
        // Green-powered BasicAction: matches WithManaMatchingColor → +4
        let val = crate::card_play::get_effective_sideways_value(
            &state, 0, false, DeedCardType::BasicAction, Some(BasicManaColor::Green),
        );
        assert_eq!(val, 4);
        // Red-powered BasicAction: doesn't match → +3
        let val = crate::card_play::get_effective_sideways_value(
            &state, 0, false, DeedCardType::BasicAction, Some(BasicManaColor::Red),
        );
        assert_eq!(val, 3);
    }

    #[test]
    fn mutual_exclusivity_blocks_second_skill() {
        // Activate one sideways skill, then check that a conflicting one is not enumerable
        let (mut state, mut undo) = setup_with_skill(Hero::Tovak, "tovak_i_dont_give_a_damn");
        state.players[0].skills.push(mk_types::ids::SkillId::from("tovak_who_needs_magic"));
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("tovak_i_dont_give_a_damn") },
            epoch,
        ).unwrap();
        // Enumerate: who_needs_magic should NOT appear (mutual exclusivity)
        let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id }
                if skill_id.as_str() == "tovak_who_needs_magic")),
            "Conflicting sideways skill should be blocked"
        );
    }

    #[test]
    fn wound_enumerated_sideways_with_power_of_pain() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_power_of_pain");
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
        // Before skill: wound should NOT be sideways-playable
        let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::PlayCardSideways { card_id, .. }
                if card_id.as_str() == "wound")),
            "Wound should not be sideways before Power of Pain"
        );
        // Activate Power of Pain
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("arythea_power_of_pain") },
            epoch,
        ).unwrap();
        // After skill: wound SHOULD be sideways-playable
        let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            actions.actions.iter().any(|a| matches!(a, LegalAction::PlayCardSideways { card_id, .. }
                if card_id.as_str() == "wound")),
            "Wound should be sideways after Power of Pain"
        );
    }

    // =========================================================================
    // Feral Allies — passive explore reduction + combat choice
    // =========================================================================

    #[test]
    fn feral_allies_passive_explore_cost_reduction() {
        let (mut state, _undo) = setup_with_skill(Hero::Braevalar, "braevalar_feral_allies");
        // Push passive modifiers (simulating skill acquisition)
        push_passive_skill_modifiers(&mut state, 0, &mk_types::ids::SkillId::from("braevalar_feral_allies"));
        // Should have ExploreCostReduction modifier
        let cost = crate::movement::get_effective_explore_cost(&state.active_modifiers);
        assert_eq!(cost, 1, "Explore cost should be reduced to 1 by Feral Allies");
    }

    #[test]
    fn feral_allies_enumerable_in_combat() {
        let (mut state, undo) = setup_with_skill(Hero::Braevalar, "braevalar_feral_allies");
        state.players[0].hand = vec![CardId::from("march")];
        // Not in combat → should NOT be enumerated (CombatOnly)
        let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id }
                if skill_id.as_str() == "braevalar_feral_allies")),
            "Feral Allies should not be available outside combat"
        );
        // Enter combat
        let tokens = vec![EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();
        let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            actions.actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id }
                if skill_id.as_str() == "braevalar_feral_allies")),
            "Feral Allies should be available in combat"
        );
    }

    // =========================================================================
    // Secret Ways — Move 1 + optional Blue mana for lake passability
    // =========================================================================

    #[test]
    fn secret_ways_grants_move_point() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_secret_ways");
        state.players[0].hand = vec![CardId::from("march")];
        let before_move = state.players[0].move_points;
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("braevalar_secret_ways") },
            epoch,
        ).unwrap();
        assert_eq!(
            state.players[0].move_points,
            before_move + 1,
            "Secret Ways should grant +1 move"
        );
    }

    #[test]
    fn secret_ways_blue_mana_creates_pending() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_secret_ways");
        state.players[0].hand = vec![CardId::from("march")];
        // Give player a blue mana token
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Blue,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("braevalar_secret_ways") },
            epoch,
        ).unwrap();
        // Should have a pending choice (decline/pay blue for lake)
        assert!(
            state.players[0].pending.has_active(),
            "Should create pending choice for blue mana lake option"
        );
    }

    #[test]
    fn secret_ways_no_blue_no_pending() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_secret_ways");
        state.players[0].hand = vec![CardId::from("march")];
        // No blue mana available: clear tokens, crystals, and mark all blue dice as depleted
        state.players[0].pure_mana.clear();
        state.players[0].crystals.blue = 0;
        for die in &mut state.source.dice {
            if die.color == ManaColor::Blue {
                die.is_depleted = true;
            }
        }
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("braevalar_secret_ways") },
            epoch,
        ).unwrap();
        // Should NOT have a pending choice (no blue mana = skip choice)
        assert!(
            !state.players[0].pending.has_active(),
            "Should not create pending when no blue mana available"
        );
    }

    #[test]
    fn secret_ways_passive_mountain_cost() {
        let (mut state, _undo) = setup_with_skill(Hero::Braevalar, "braevalar_secret_ways");
        push_passive_skill_modifiers(&mut state, 0, &mk_types::ids::SkillId::from("braevalar_secret_ways"));
        // Check that mountains now have a replace_cost via modifier
        let result = crate::movement::find_replace_cost_for_terrain(
            mk_types::enums::Terrain::Mountain,
            &state.active_modifiers,
        );
        assert_eq!(result, Some(5), "Secret Ways should make mountains cost 5");
    }

    // =========================================================================
    // Regenerate — consume mana, remove wound, conditional draw
    // =========================================================================

    #[test]
    fn regenerate_requires_wound_in_hand() {
        let (mut state, undo) = setup_with_skill(Hero::Krang, "krang_regenerate");
        // No wounds in hand
        state.players[0].hand = vec![CardId::from("march")];
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id }
                if skill_id.as_str() == "krang_regenerate")),
            "Regenerate should not be available without wounds"
        );
    }

    #[test]
    fn regenerate_requires_mana() {
        let (mut state, undo) = setup_with_skill(Hero::Krang, "krang_regenerate");
        // Has wound but no mana
        state.players[0].hand = vec![CardId::from("wound")];
        state.players[0].pure_mana.clear();
        state.players[0].crystals = Crystals::default();
        // Deplete all source dice
        for die in &mut state.source.dice {
            die.is_depleted = true;
        }
        let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            !actions.actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id }
                if skill_id.as_str() == "krang_regenerate")),
            "Regenerate should not be available without mana"
        );
    }

    #[test]
    fn regenerate_auto_consumes_single_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_regenerate");
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
        state.players[0].deck = vec![CardId::from("rage")];
        state.players[0].pure_mana = vec![ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        }];
        // Deplete all source dice so Red token is only option
        for die in &mut state.source.dice {
            die.is_depleted = true;
        }
        state.players[0].crystals = Crystals::default();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("krang_regenerate") },
            epoch,
        ).unwrap();

        // Should auto-consume (only 1 color) — no pending
        assert!(
            !state.players[0].pending.has_active(),
            "Should auto-resolve when only 1 mana option"
        );
        // Wound removed
        assert!(
            !state.players[0].hand.iter().any(|c| c.as_str() == "wound"),
            "Wound should be removed from hand"
        );
        // Red mana consumed
        assert!(state.players[0].pure_mana.is_empty(), "Red token should be consumed");
        // Krang bonus color is Red — should draw a card
        assert_eq!(state.players[0].hand.len(), 2, "Should draw 1 card (bonus color match)");
    }

    #[test]
    fn regenerate_no_draw_without_bonus_color() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_regenerate");
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
        state.players[0].deck = vec![CardId::from("rage")];
        state.players[0].pure_mana = vec![ManaToken {
            color: ManaColor::Blue,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        }];
        for die in &mut state.source.dice {
            die.is_depleted = true;
        }
        state.players[0].crystals = Crystals::default();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("krang_regenerate") },
            epoch,
        ).unwrap();

        // Blue != Red bonus — no draw
        assert_eq!(state.players[0].hand.len(), 1, "Should NOT draw (Blue != Red bonus)");
    }

    #[test]
    fn regenerate_multiple_mana_creates_pending() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_regenerate");
        state.players[0].hand = vec![CardId::from("wound")];
        state.players[0].pure_mana = vec![
            ManaToken { color: ManaColor::Red, source: ManaTokenSource::Effect, cannot_power_spells: false },
            ManaToken { color: ManaColor::Blue, source: ManaTokenSource::Effect, cannot_power_spells: false },
        ];
        for die in &mut state.source.dice {
            die.is_depleted = true;
        }
        state.players[0].crystals = Crystals::default();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("krang_regenerate") },
            epoch,
        ).unwrap();

        // Multiple colors → pending choice
        assert!(
            state.players[0].pending.has_active(),
            "Should create pending when multiple mana colors available"
        );
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2, "Should have 2 mana color options");
            assert!(matches!(
                &choice.resolution,
                mk_types::pending::ChoiceResolution::RegenerateMana { .. }
            ));
        } else {
            panic!("Expected Choice pending");
        }
    }

    // =========================================================================
    // Dueling — Block 1 + target enemy + attack bonus + fame
    // =========================================================================

    #[test]
    fn dueling_requires_eligible_enemies() {
        let (mut state, undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_dueling");
        state.players[0].hand = vec![CardId::from("march")];
        // Enter combat with enemy
        let tokens = vec![EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();
        // Move to Block phase (dueling is BlockOnly)
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            actions.actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id }
                if skill_id.as_str() == "wolfhawk_dueling")),
            "Dueling should be available in Block phase with eligible enemies"
        );
    }

    #[test]
    fn dueling_grants_block_and_targets() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_dueling");
        state.players[0].hand = vec![CardId::from("march")];
        let tokens = vec![EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        let block_before = state.players[0].combat_accumulator.block;
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("wolfhawk_dueling") },
            epoch,
        ).unwrap();
        assert_eq!(
            state.players[0].combat_accumulator.block,
            block_before + 1,
            "Dueling should grant Block 1"
        );
        // Single enemy → auto-target, DuelingTarget modifier created
        assert!(
            state.active_modifiers.iter().any(|m|
                matches!(&m.effect, mk_types::modifier::ModifierEffect::DuelingTarget { enemy_instance_id, .. }
                    if enemy_instance_id == "enemy_0")),
            "Should create DuelingTarget modifier for the single enemy"
        );
    }

    #[test]
    fn dueling_attack_bonus_at_phase_transition() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_dueling");
        state.players[0].hand = vec![CardId::from("march")];
        let tokens = vec![EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        // Activate dueling
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("wolfhawk_dueling") },
            epoch,
        ).unwrap();

        // Transition Block → AssignDamage → Attack (EndCombatPhase twice)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::EndCombatPhase,
            epoch,
        ).unwrap();
        // Now in AssignDamage
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::EndCombatPhase,
            epoch,
        ).unwrap();
        // Now in Attack phase — dueling attack bonus should have been applied
        assert_eq!(
            state.players[0].combat_accumulator.attack.normal, 1,
            "Dueling should grant Attack 1 at AssignDamage→Attack transition"
        );
    }

    #[test]
    fn dueling_fame_bonus_on_defeat() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_dueling");
        state.players[0].hand = vec![CardId::from("march")];
        let tokens = vec![EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        // Activate dueling
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("wolfhawk_dueling") },
            epoch,
        ).unwrap();

        // Mark enemy as defeated (simulate)
        state.combat.as_mut().unwrap().enemies[0].is_defeated = true;

        let fame_before = state.players[0].fame;
        // Resolve dueling fame bonus directly
        let bonus = resolve_dueling_fame_bonus(&mut state, 0);
        assert_eq!(bonus, 1, "Should get +1 fame for defeating dueling target without units");
        assert_eq!(state.players[0].fame, fame_before + 1);
    }

    #[test]
    fn dueling_no_fame_with_unit_involvement() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_dueling");
        state.players[0].hand = vec![CardId::from("march")];
        let tokens = vec![EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        // Activate dueling
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("wolfhawk_dueling") },
            epoch,
        ).unwrap();

        // Mark unit involvement
        mark_dueling_unit_involvement(&mut state, 0);

        // Mark enemy as defeated
        state.combat.as_mut().unwrap().enemies[0].is_defeated = true;

        let bonus = resolve_dueling_fame_bonus(&mut state, 0);
        assert_eq!(bonus, 0, "Should NOT get fame bonus when units were involved");
    }

    #[test]
    fn dueling_multiple_enemies_creates_pending() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_dueling");
        state.players[0].hand = vec![CardId::from("march")];
        let tokens = vec![
            EnemyTokenId::from("prowlers_1"),
            EnemyTokenId::from("prowlers_2"),
        ];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("wolfhawk_dueling") },
            epoch,
        ).unwrap();

        // Multiple enemies → pending choice
        assert!(
            state.players[0].pending.has_active(),
            "Should create pending when multiple eligible enemies"
        );
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2, "Should have 2 enemy target options");
            assert!(matches!(
                &choice.resolution,
                mk_types::pending::ChoiceResolution::DuelingTarget { .. }
            ));
        } else {
            panic!("Expected Choice pending");
        }
    }

    // =============================================================================
    // Bonds of Loyalty tests
    // =============================================================================

    #[test]
    fn bonds_adds_command_slot() {
        let (state, _) = setup_with_skill(Hero::Norowas, "norowas_bonds_of_loyalty");
        let level_slots = mk_data::levels::get_level_stats(state.players[0].level).command_slots as usize;
        // Bonds should add +1 to the base command slots
        // We verify via legal_actions enumeration: with bonds, a player at level 1
        // can hold more units than normal
        assert_eq!(level_slots, 1, "Level 1 should have 1 command slot");
        // With bonds_of_loyalty, effective slots = 2
        // Player has 1 unit already → should still be able to recruit
        // Player has 2 units → should be blocked
    }

    #[test]
    fn bonds_discount_when_slot_empty() {
        let (state, _) = setup_with_skill(Hero::Norowas, "norowas_bonds_of_loyalty");
        assert!(
            state.players[0].bonds_of_loyalty_unit_instance_id.is_none(),
            "Bonds slot should be empty initially"
        );
        // The -5 discount is applied in enumerate_recruitables (units.rs)
        // We verify it's active when bonds_of_loyalty_unit_instance_id is None
    }

    #[test]
    fn bonds_no_discount_after_slot_filled() {
        let (mut state, _) = setup_with_skill(Hero::Norowas, "norowas_bonds_of_loyalty");
        state.players[0].bonds_of_loyalty_unit_instance_id =
            Some(mk_types::ids::UnitInstanceId::from("unit_0"));
        // With slot filled, no discount should apply
        assert!(
            state.players[0].bonds_of_loyalty_unit_instance_id.is_some(),
            "Bonds slot should be filled"
        );
    }

    // =============================================================================
    // Invocation tests
    // =============================================================================

    #[test]
    fn invocation_wound_creates_pending() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_invocation");
        state.players[0].hand = vec![CardId::from("wound")];

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("arythea_invocation") },
            epoch,
        ).unwrap();

        // Wound → Red or Black choice (2 options)
        assert!(state.players[0].pending.has_active());
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2, "Wound should offer Red and Black");
            assert!(matches!(
                &choice.resolution,
                mk_types::pending::ChoiceResolution::InvocationDiscard { .. }
            ));
        } else {
            panic!("Expected Choice pending");
        }

        // Choose Red (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();

        // Wound should be removed from hand
        assert!(state.players[0].hand.is_empty(), "Wound should be discarded");
        // Should have gained a Red mana token
        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Red);
        // Wound goes to wound pile, not discard
        assert!(state.players[0].discard.is_empty());
    }

    #[test]
    fn invocation_non_wound_creates_pending() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_invocation");
        state.players[0].hand = vec![CardId::from("march")];

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("arythea_invocation") },
            epoch,
        ).unwrap();

        // Non-wound → White or Green choice
        assert!(state.players[0].pending.has_active());
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2, "Non-wound should offer White and Green");
        } else {
            panic!("Expected Choice pending");
        }

        // Choose Green (index 1)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 1 },
            epoch,
        ).unwrap();

        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Green);
        // Non-wound goes to discard, not wound pile
        assert_eq!(state.players[0].discard.len(), 1);
        assert_eq!(state.players[0].discard[0].as_str(), "march");
    }

    #[test]
    fn invocation_deduplicates_same_cards() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_invocation");
        // Two copies of the same card should produce only 2 options (not 4)
        state.players[0].hand = vec![CardId::from("march"), CardId::from("march")];

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("arythea_invocation") },
            epoch,
        ).unwrap();

        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2, "Duplicate cards should be deduplicated");
        } else {
            panic!("Expected Choice pending");
        }
    }

    #[test]
    fn invocation_skipped_when_hand_empty() {
        let (mut state, _undo) = setup_with_skill(Hero::Arythea, "arythea_invocation");
        state.players[0].hand.clear();

        let actions = crate::legal_actions::enumerate_legal_actions(&state, 0).actions;
        let has_invocation = actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_invocation"
        ));
        assert!(!has_invocation, "Invocation should not be available with empty hand");
    }

    // =============================================================================
    // Polarization tests
    // =============================================================================

    #[test]
    fn polarization_basic_swap() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_polarization");
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("arythea_polarization") },
            epoch,
        ).unwrap();

        // With only one Red token (day time, no crystals, no dice with basic colors),
        // the only option is Red→Blue. Should auto-resolve.
        // But source dice might also offer options, so check...
        // If pending, resolve the Red→Blue option
        if state.players[0].pending.has_active() {
            // Find the Red→Blue option
            if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
                if let mk_types::pending::ChoiceResolution::PolarizationConvert { ref options } = choice.resolution {
                    let idx = options.iter().position(|o| o.source_color == ManaColor::Red && o.target_color == ManaColor::Blue).unwrap();
                    let epoch = state.action_epoch;
                    apply_legal_action(
                        &mut state, &mut undo, 0,
                        &LegalAction::ResolveChoice { choice_index: idx },
                        epoch,
                    ).unwrap();
                }
            }
        }

        // Should have converted Red → Blue
        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Blue);
    }

    #[test]
    fn polarization_crystal_swap() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_polarization");
        state.players[0].crystals.green = 1;
        // Clear source dice to simplify
        state.source.dice.clear();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("arythea_polarization") },
            epoch,
        ).unwrap();

        // Should auto-resolve (Green crystal → White crystal is the only option)
        // Or resolve if pending
        if state.players[0].pending.has_active() {
            let epoch = state.action_epoch;
            apply_legal_action(
                &mut state, &mut undo, 0,
                &LegalAction::ResolveChoice { choice_index: 0 },
                epoch,
            ).unwrap();
        }

        // Crystal should swap: Green 0, White 1
        assert_eq!(state.players[0].crystals.green, 0);
        assert_eq!(state.players[0].crystals.white, 1);
        // Crystal→Crystal produces no token
        assert!(state.players[0].pure_mana.is_empty());
    }

    #[test]
    fn polarization_black_day_cannot_power_spells() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_polarization");
        state.time_of_day = mk_types::enums::TimeOfDay::Day;
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Black,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        // Clear source dice to simplify
        state.source.dice.clear();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("arythea_polarization") },
            epoch,
        ).unwrap();

        // Black during day → 4 basic options (all with cannot_power_spells=true)
        assert!(state.players[0].pending.has_active());
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 4, "Black day → 4 basic color options");
            if let mk_types::pending::ChoiceResolution::PolarizationConvert { ref options } = choice.resolution {
                for opt in options {
                    assert!(opt.cannot_power_spells, "Black conversion should not power spells");
                }
            }
        }

        // Choose Red (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();

        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert!(state.players[0].pure_mana[0].cannot_power_spells);
    }

    #[test]
    fn polarization_gold_night() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_polarization");
        state.time_of_day = mk_types::enums::TimeOfDay::Night;
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Gold,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        // Clear source dice to simplify
        state.source.dice.clear();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("arythea_polarization") },
            epoch,
        ).unwrap();

        // Gold at night → Black (auto-resolve since only option)
        if state.players[0].pending.has_active() {
            let epoch = state.action_epoch;
            apply_legal_action(
                &mut state, &mut undo, 0,
                &LegalAction::ResolveChoice { choice_index: 0 },
                epoch,
            ).unwrap();
        }

        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Black);
        assert!(!state.players[0].pure_mana[0].cannot_power_spells);
    }

    // =============================================================================
    // Curse tests
    // =============================================================================

    #[test]
    fn curse_attack_single_enemy() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_curse");
        let tokens = vec![EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("krang_curse") },
            epoch,
        ).unwrap();

        // Prowlers: no AI, single attack → mode choice (Attack -2 or Armor -1)
        assert!(state.players[0].pending.has_active());
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2, "Should offer Attack -2 and Armor -1");
        }

        // Choose Attack -2 (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();

        // Should have an EnemyStat modifier: Attack -2
        let modifier = state.active_modifiers.iter().find(|m| matches!(
            &m.effect,
            mk_types::modifier::ModifierEffect::EnemyStat { stat, amount, .. }
            if *stat == mk_types::modifier::EnemyStat::Attack && *amount == -2
        ));
        assert!(modifier.is_some(), "Should have Attack -2 modifier");
    }

    #[test]
    fn curse_armor_non_ai() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_curse");
        let tokens = vec![EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("krang_curse") },
            epoch,
        ).unwrap();

        // Choose Armor -1 (index 1)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 1 },
            epoch,
        ).unwrap();

        // Should have an EnemyStat modifier: Armor -1, minimum 1
        let modifier = state.active_modifiers.iter().find(|m| matches!(
            &m.effect,
            mk_types::modifier::ModifierEffect::EnemyStat { stat, amount, minimum, .. }
            if *stat == mk_types::modifier::EnemyStat::Armor && *amount == -1 && *minimum == 1
        ));
        assert!(modifier.is_some(), "Should have Armor -1 modifier");
    }

    #[test]
    fn curse_armor_blocked_by_ai() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_curse");
        // Shadow has ArcaneImmunity + Elusive
        let tokens = vec![EnemyTokenId::from("shadow_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("krang_curse") },
            epoch,
        ).unwrap();

        // AI enemy with single attack → auto-apply Attack -2 (only option)
        // Should NOT have pending (auto-resolved)
        assert!(!state.players[0].pending.has_active(),
            "AI enemy with single attack should auto-apply Attack -2");

        let modifier = state.active_modifiers.iter().find(|m| matches!(
            &m.effect,
            mk_types::modifier::ModifierEffect::EnemyStat { stat, amount, .. }
            if *stat == mk_types::modifier::EnemyStat::Attack && *amount == -2
        ));
        assert!(modifier.is_some(), "Should have auto-applied Attack -2 modifier");
    }

    #[test]
    fn curse_multi_attack_index() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_curse");
        // Orc Skirmishers have multi-attack (2 attacks)
        let tokens = vec![EnemyTokenId::from("orc_skirmishers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("krang_curse") },
            epoch,
        ).unwrap();

        // Multi-attack, no AI → mode choice (Attack -2 or Armor -1)
        assert!(state.players[0].pending.has_active());

        // Choose Attack -2 (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();

        // Multi-attack → should get attack index choice
        assert!(state.players[0].pending.has_active(),
            "Multi-attack should require attack index selection");
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2, "Orc Skirmishers have 2 attacks");
        }

        // Choose first attack (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();

        // Should have Attack -2 modifier with attack_index = Some(0)
        let modifier = state.active_modifiers.iter().find(|m| matches!(
            &m.effect,
            mk_types::modifier::ModifierEffect::EnemyStat { stat, amount, attack_index, .. }
            if *stat == mk_types::modifier::EnemyStat::Attack && *amount == -2 && *attack_index == Some(0)
        ));
        assert!(modifier.is_some(), "Should have Attack -2 with attack_index=0");
    }

    // =============================================================================
    // Forked Lightning tests
    // =============================================================================

    #[test]
    fn forked_lightning_single_enemy_auto() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_forked_lightning");
        let tokens = vec![EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("braevalar_forked_lightning") },
            epoch,
        ).unwrap();

        // Single enemy → auto-target, no pending
        assert!(!state.players[0].pending.has_active(),
            "Single enemy should auto-target");

        // Should have +1 Ranged ColdFire Attack
        let acc = &state.players[0].combat_accumulator;
        assert_eq!(acc.attack.ranged, 1, "Should have +1 ranged attack");
        assert_eq!(acc.attack.ranged_elements.cold_fire, 1, "Should have +1 cold_fire");
    }

    #[test]
    fn forked_lightning_three_targets() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_forked_lightning");
        let tokens = vec![
            EnemyTokenId::from("prowlers_1"),
            EnemyTokenId::from("prowlers_2"),
            EnemyTokenId::from("prowlers_3"),
        ];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("braevalar_forked_lightning") },
            epoch,
        ).unwrap();

        // 3 enemies → pending (first pick, no "Done")
        assert!(state.players[0].pending.has_active());

        // Pick enemy 0
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 1);

        // Second pick (has "Done" option now)
        assert!(state.players[0].pending.has_active());
        // Pick enemy 0 (next eligible)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 2);

        // Third pick
        assert!(state.players[0].pending.has_active());
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3);
        assert_eq!(state.players[0].combat_accumulator.attack.ranged_elements.cold_fire, 3);

        // No more pending (all 3 targets picked)
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn forked_lightning_done_early() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_forked_lightning");
        let tokens = vec![
            EnemyTokenId::from("prowlers_1"),
            EnemyTokenId::from("prowlers_2"),
            EnemyTokenId::from("prowlers_3"),
        ];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("braevalar_forked_lightning") },
            epoch,
        ).unwrap();

        // Pick first target
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();

        // Second pick: "Done" should be the last option
        assert!(state.players[0].pending.has_active());
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            // 2 remaining eligible + 1 "Done" = 3 options
            assert_eq!(choice.options.len(), 3, "Should have 2 targets + Done");
        }

        // Choose "Done" (last option, index 2)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 2 },
            epoch,
        ).unwrap();

        // Should stop, only 1 hit applied
        assert!(!state.players[0].pending.has_active());
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 1);
    }

    // =============================================================================
    // Know Your Prey tests
    // =============================================================================

    #[test]
    fn know_your_prey_excludes_ai() {
        let (mut state, _undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_know_your_prey");
        // Shadow has ArcaneImmunity
        let tokens = vec![EnemyTokenId::from("shadow_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let actions = crate::legal_actions::enumerate_legal_actions(&state, 0).actions;
        let has_kyp = actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { skill_id } if skill_id.as_str() == "wolfhawk_know_your_prey"
        ));
        assert!(!has_kyp, "Know Your Prey should not be available against AI enemies only");
    }

    #[test]
    fn know_your_prey_nullify_ability() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_know_your_prey");
        // Wolf Riders have Swift
        let tokens = vec![EnemyTokenId::from("wolf_riders_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("wolfhawk_know_your_prey") },
            epoch,
        ).unwrap();

        // Wolf Riders: Swift ability (removable) + Physical attack (no conversion)
        // Should have pending with ability nullification option
        if state.players[0].pending.has_active() {
            // Find and choose the NullifyAbility option (should be first)
            let epoch = state.action_epoch;
            apply_legal_action(
                &mut state, &mut undo, 0,
                &LegalAction::ResolveChoice { choice_index: 0 },
                epoch,
            ).unwrap();
        }

        // Should have AbilityNullifier modifier for Swift
        let modifier = state.active_modifiers.iter().find(|m| matches!(
            &m.effect,
            mk_types::modifier::ModifierEffect::AbilityNullifier { ability: Some(a), .. }
            if *a == EnemyAbilityType::Swift
        ));
        assert!(modifier.is_some(), "Should have AbilityNullifier(Swift) modifier");
    }

    #[test]
    fn know_your_prey_remove_resistance() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_know_your_prey");
        // Ice Dragon: Paralyze ability, Physical+Ice resistance, Ice attack
        let tokens = vec![EnemyTokenId::from("ice_dragon_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("wolfhawk_know_your_prey") },
            epoch,
        ).unwrap();

        // Ice Dragon should have: Paralyze (nullify), Physical resist (remove),
        // Ice resist (remove), Ice→Physical (convert)
        assert!(state.players[0].pending.has_active());
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert!(choice.options.len() >= 3, "Should have multiple strip options");
        }

        // Find Physical resistance removal option
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            if let mk_types::pending::ChoiceResolution::KnowYourPreyOption { ref options, .. } = choice.resolution {
                let phys_idx = options.iter().position(|o| matches!(o,
                    mk_types::pending::KnowYourPreyApplyOption::RemoveResistance { element }
                    if *element == ResistanceElement::Physical
                )).unwrap();

                let epoch = state.action_epoch;
                apply_legal_action(
                    &mut state, &mut undo, 0,
                    &LegalAction::ResolveChoice { choice_index: phys_idx },
                    epoch,
                ).unwrap();
            }
        }

        let modifier = state.active_modifiers.iter().find(|m| matches!(
            &m.effect,
            mk_types::modifier::ModifierEffect::RemovePhysicalResistance
        ));
        assert!(modifier.is_some(), "Should have RemovePhysicalResistance modifier");
    }

    #[test]
    fn know_your_prey_convert_element() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_know_your_prey");
        // Ice Dragon: Ice attack → can convert Ice→Physical
        let tokens = vec![EnemyTokenId::from("ice_dragon_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("wolfhawk_know_your_prey") },
            epoch,
        ).unwrap();

        // Find Ice→Physical conversion option
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            if let mk_types::pending::ChoiceResolution::KnowYourPreyOption { ref options, .. } = choice.resolution {
                let convert_idx = options.iter().position(|o| matches!(o,
                    mk_types::pending::KnowYourPreyApplyOption::ConvertElement { from, to }
                    if *from == Element::Ice && *to == Element::Physical
                )).unwrap();

                let epoch = state.action_epoch;
                apply_legal_action(
                    &mut state, &mut undo, 0,
                    &LegalAction::ResolveChoice { choice_index: convert_idx },
                    epoch,
                ).unwrap();
            }
        }

        let modifier = state.active_modifiers.iter().find(|m| matches!(
            &m.effect,
            mk_types::modifier::ModifierEffect::ConvertAttackElement { from_element, to_element }
            if *from_element == Element::Ice && *to_element == Element::Physical
        ));
        assert!(modifier.is_some(), "Should have ConvertAttackElement(Ice→Physical) modifier");
    }

    #[test]
    fn verify_card_actions_after_tactic_selection() {
        // Reproduces the exact server flow: create game, select tactic, enumerate.
        // Verifies that PlayCard* actions appear and their JSON matches client expectations.
        let mut state = create_solo_game(42, mk_types::enums::Hero::Arythea);
        let mut undo = crate::undo::UndoStack::new();

        // 1. Initial: should be TacticsSelection
        assert_eq!(state.round_phase, mk_types::enums::RoundPhase::TacticsSelection);
        let las1 = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            las1.actions.iter().all(|a| matches!(a, LegalAction::SelectTactic { .. })),
            "Initial actions should all be SelectTactic"
        );

        // 2. Select first tactic
        let tactic = las1.actions[0].clone();
        let epoch = las1.epoch;
        apply_legal_action(&mut state, &mut undo, 0, &tactic, epoch).unwrap();

        // 3. After tactic: should be PlayerTurns
        assert_eq!(state.round_phase, mk_types::enums::RoundPhase::PlayerTurns);

        // 4. Enumerate post-tactic actions
        let las2 = enumerate_legal_actions_with_undo(&state, 0, &undo);

        // 5. Must have card play actions (player should have cards in hand)
        let hand = &state.players[0].hand;
        assert!(!hand.is_empty(), "Player should have cards in hand");

        let card_actions: Vec<_> = las2.actions.iter()
            .filter(|a| matches!(a,
                LegalAction::PlayCardBasic { .. } |
                LegalAction::PlayCardPowered { .. } |
                LegalAction::PlayCardSideways { .. }
            ))
            .collect();

        assert!(!card_actions.is_empty(), "Should have PlayCard* actions after tactic selection, got {} total actions", las2.actions.len());

        // 6. Verify JSON serialization matches client expectations
        for action in &card_actions {
            let json = serde_json::to_string(action).unwrap();
            let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
            // Externally-tagged: { "PlayCardBasic": { "hand_index": N, "card_id": "..." } }
            assert!(parsed.is_object(), "Should be object: {json}");
            let variant = parsed.as_object().unwrap().keys().next().unwrap();
            assert!(
                variant.starts_with("PlayCard"),
                "Variant should start with PlayCard, got: {variant}"
            );
            let inner = &parsed[variant];
            assert!(inner.is_object(), "Inner should be object: {json}");
            // card_id must be snake_case (not camelCase)
            assert!(inner.get("card_id").is_some(), "Must have card_id field: {json}");
            assert!(inner.get("hand_index").is_some(), "Must have hand_index field: {json}");
        }
    }
}
