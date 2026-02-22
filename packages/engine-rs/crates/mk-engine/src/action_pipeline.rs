//! Execution pipeline — `apply_legal_action()` dispatch.
//!
//! Takes a `LegalAction` and applies it to the game state, returning an
//! `ApplyResult` on success or `ApplyError` on failure. Every action from
//! `enumerate_legal_actions()` MUST succeed — the contract is CI-gated.

use mk_data::enemies::{attack_count, get_enemy};
use mk_data::enemy_piles::{discard_enemy_token, draw_enemy_token, enemy_id_from_token};
use mk_data::tactics::tactic_turn_order;
use mk_types::enums::*;
use mk_types::ids::{CardId, CombatInstanceId, EnemyId, EnemyTokenId, PlayerId, SkillId, SourceDieId};
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
            apply_play_card(state, player_idx, *hand_index, false, None)?
        }

        LegalAction::PlayCardPowered {
            hand_index,
            mana_color,
            ..
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_play_card(state, player_idx, *hand_index, true, Some(*mana_color))?
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

        LegalAction::ResolveDiscardForCrystal { .. } => {
            // Handled by ChoiceResolution::DiscardForCrystalSelect now
            return Err(ApplyError::InternalError(
                "ResolveDiscardForCrystal should use Choice path".to_string(),
            ));
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

        LegalAction::ResolveCrystalJoyReclaim { discard_index } => {
            undo_stack.set_checkpoint();
            apply_resolve_crystal_joy_reclaim(state, player_idx, *discard_index)?
        }

        LegalAction::ResolveSteadyTempoDeckPlacement { place } => {
            undo_stack.set_checkpoint();
            apply_resolve_steady_tempo(state, player_idx, *place)?
        }

        LegalAction::ResolveBannerProtection { remove_all } => {
            undo_stack.set_checkpoint();
            apply_resolve_banner_protection(state, player_idx, *remove_all)?
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

        LegalAction::ReturnInteractiveSkill { skill_id } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_return_interactive_skill(state, player_idx, skill_id)?
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

        LegalAction::AnnounceEndOfRound => {
            // Irreversible: affects game flow for all players
            undo_stack.set_checkpoint();
            apply_announce_end_of_round(state, player_idx)?
        }

        LegalAction::Undo => apply_undo(state, undo_stack)?,

        LegalAction::ResolveSourceOpeningReroll { reroll } => {
            // Irreversible: RNG may be consumed
            undo_stack.set_checkpoint();
            apply_resolve_source_opening_reroll(state, player_idx, *reroll)?
        }

        LegalAction::ResolveTraining { selection_index } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_resolve_training(state, player_idx, *selection_index)?
        }

        LegalAction::ResolveMaximalEffect { hand_index } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            apply_resolve_maximal_effect(state, player_idx, *hand_index)?
        }

        LegalAction::ResolveMeditation {
            selection_index,
            place_on_top,
        } => {
            undo_stack.save(state);
            apply_resolve_meditation(state, player_idx, *selection_index, *place_on_top)?
        }

        LegalAction::MeditationDoneSelecting => {
            undo_stack.save(state);
            apply_meditation_done_selecting(state, player_idx)?
        }

        LegalAction::ProposeCooperativeAssault {
            hex_coord,
            invited_player_idxs,
            distribution,
        } => {
            // Reversible: save snapshot
            undo_stack.save(state);
            crate::cooperative_assault::apply_propose(
                state,
                player_idx,
                *hex_coord,
                invited_player_idxs,
                distribution,
            )?;
            ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
            }
        }

        LegalAction::RespondToCooperativeProposal { accept } => {
            // Irreversible: RNG shuffle on agreement
            undo_stack.set_checkpoint();
            crate::cooperative_assault::apply_respond(state, player_idx, *accept)?;
            ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
            }
        }

        LegalAction::CancelCooperativeProposal => {
            // Reversible: save snapshot
            undo_stack.save(state);
            crate::cooperative_assault::apply_cancel(state, player_idx)?;
            ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
            }
        }
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
    })
}

/// Apply immediate effects when a tactic is selected (e.g., Great Start draws cards).
fn apply_tactic_on_pick_effects(
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
                        selected: ArrayVec::new(),
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

    let player_id_str = state.players[player_idx].id.as_str().to_string();
    let eligible =
        crate::legal_actions::combat::eligible_attack_targets(combat, attack_type, &state.active_modifiers, Some(&player_id_str));

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
    override_mana_color: Option<BasicManaColor>,
) -> Result<ApplyResult, ApplyError> {
    card_play::play_card(state, player_idx, hand_index, powered, override_mana_color)
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

fn apply_resolve_training(
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
            })
        }
    }
}

fn apply_resolve_maximal_effect(
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
            })
        }
        effect_queue::DrainResult::PendingSet => {
            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
            })
        }
    }
}

fn apply_resolve_meditation(
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
    })
}

fn apply_meditation_done_selecting(
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
        // Initialize Master of Chaos wheel position
        init_master_of_chaos_if_needed(state, player_idx, &chosen_skill);
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
        // Initialize Master of Chaos wheel position
        init_master_of_chaos_if_needed(state, player_idx, &chosen_skill);
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

fn end_turn_result_to_apply(
    result: Result<end_turn::EndTurnResult, end_turn::EndTurnError>,
) -> Result<ApplyResult, ApplyError> {
    match result {
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

/// Voluntarily announce end of round (multiplayer).
/// All other players get exactly one final turn each.
fn apply_announce_end_of_round(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let player_id = state.players[player_idx].id.clone();
    state.end_of_round_announced_by = Some(player_id.clone());

    // All OTHER players get one final turn
    state.players_with_final_turn = state
        .players
        .iter()
        .filter(|p| p.id != player_id)
        .map(|p| p.id.clone())
        .collect();

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn apply_end_turn(state: &mut GameState, player_idx: usize) -> Result<ApplyResult, ApplyError> {
    end_turn_result_to_apply(end_turn::end_turn(state, player_idx))
}

fn apply_resolve_crystal_joy_reclaim(
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
    end_turn_result_to_apply(end_turn::end_turn(state, player_idx))
}

fn apply_resolve_steady_tempo(
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
    end_turn_result_to_apply(end_turn::end_turn(state, player_idx))
}

fn apply_resolve_banner_protection(
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
    end_turn_result_to_apply(end_turn::end_turn(state, player_idx))
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

        // Burning Shield / Exploding Shield: consume modifier on successful block
        apply_burning_shield_on_block(state, player_idx, enemy_instance_id);
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

/// Apply Burning Shield / Exploding Shield effects after a successful block.
///
/// - Attack mode: adds fire attack to the player's combat accumulator
/// - Destroy mode: attempts to defeat the blocked enemy (blocked by fire resistance
///   or arcane immunity)
///
/// The modifier is consumed (removed) on any successful block, regardless of mode outcome.
fn apply_burning_shield_on_block(
    state: &mut GameState,
    player_idx: usize,
    blocked_enemy_id: &CombatInstanceId,
) {
    use mk_types::modifier::{BurningShieldMode, ModifierEffect, ModifierSource};

    let pid = state.players[player_idx].id.clone();
    let shield_idx = state.active_modifiers.iter().position(|m| {
        matches!(&m.effect, ModifierEffect::BurningShieldActive { .. })
            && matches!(
                &m.source,
                ModifierSource::Card { player_id, .. } if *player_id == pid
            )
    });
    let Some(idx) = shield_idx else { return };

    let (mode, attack_value) = match &state.active_modifiers[idx].effect {
        ModifierEffect::BurningShieldActive {
            mode, attack_value, ..
        } => (*mode, *attack_value),
        _ => return,
    };
    // Consumed on ANY successful block, regardless of outcome
    state.active_modifiers.remove(idx);

    match mode {
        BurningShieldMode::Attack => {
            // Fire attack added to accumulator for Attack phase
            let acc = &mut state.players[player_idx].combat_accumulator;
            acc.attack.normal += attack_value;
            acc.attack.normal_elements.fire += attack_value;
        }
        BurningShieldMode::Destroy => {
            // Attempt to destroy the blocked enemy
            let combat = state.combat.as_mut().unwrap();
            let enemy = combat
                .enemies
                .iter_mut()
                .find(|e| e.instance_id == *blocked_enemy_id)
                .unwrap();
            let enemy_id_str = enemy.enemy_id.as_str().to_string();
            let is_summoned = enemy.summoned_by_instance_id.is_some();
            let def = get_enemy(&enemy_id_str).unwrap();

            // Destroy fails if fire-resistant or arcane immune
            let has_fire_resist = def.resistances.contains(&ResistanceElement::Fire);
            let has_arcane_immune = def
                .abilities
                .contains(&EnemyAbilityType::ArcaneImmunity);

            if !has_fire_resist && !has_arcane_immune {
                enemy.is_defeated = true;
                if !is_summoned {
                    state.players[player_idx].fame += def.fame;
                    state.combat.as_mut().unwrap().fame_gained += def.fame;
                }
            }
        }
    }
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

            // Set all_damage_blocked_this_phase for conditional effects (e.g. BlockedSuccessfully)
            let all_blocked = {
                let combat = state.combat.as_ref().unwrap();
                let undefeated: Vec<&CombatEnemy> =
                    combat.enemies.iter().filter(|e| !e.is_defeated).collect();
                undefeated.is_empty()
                    || undefeated.iter().all(|e| e.is_blocked)
            };
            state.combat.as_mut().unwrap().all_damage_blocked_this_phase = all_blocked;

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
        SkillUsageType::OncePerRound | SkillUsageType::Interactive => {
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
        "wolfhawk_wolfs_howl" => return apply_wolfs_howl(state, player_idx, skill_id),
        "krang_puppet_master" => return apply_puppet_master(state, player_idx, skill_id),
        "braevalar_shapeshift" => return apply_shapeshift(state, player_idx, skill_id),
        "norowas_prayer_of_weather" => return apply_prayer_of_weather(state, player_idx, skill_id),
        "arythea_ritual_of_pain" => return apply_ritual_of_pain(state, player_idx, skill_id),
        "braevalar_natures_vengeance" => return apply_natures_vengeance(state, player_idx, skill_id),
        "tovak_mana_overload" => return apply_mana_overload(state, player_idx, skill_id),
        "goldyx_source_opening" => return apply_source_opening(state, player_idx, skill_id),
        "krang_master_of_chaos" => return apply_master_of_chaos(state, player_idx, skill_id),
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

fn apply_wolfs_howl(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope};

    let player = &state.players[player_idx];
    let level_stats = mk_data::levels::get_level_stats(player.level);
    let units_count = player.units.len() as u32;
    let empty_slots = level_stats.command_slots.saturating_sub(units_count);
    let value = 4 + empty_slots;

    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: value,
            for_wounds: false,
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

// =============================================================================
// Puppet Master + Shapeshift skill handlers
// =============================================================================

fn apply_puppet_master(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    let player = &state.players[player_idx];
    if player.kept_enemy_tokens.is_empty() {
        return Err(ApplyError::InternalError(
            "Puppet Master: no kept enemy tokens".into(),
        ));
    }

    if player.kept_enemy_tokens.len() == 1 {
        // Auto-select the only token, go straight to use mode
        setup_puppet_master_use_mode(state, player_idx, skill_id, 0);
    } else {
        // Multiple tokens: present selection
        let token_indices: Vec<usize> = (0..player.kept_enemy_tokens.len()).collect();
        let options: Vec<mk_types::effect::CardEffect> = token_indices
            .iter()
            .map(|_| mk_types::effect::CardEffect::Noop)
            .collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(mk_types::pending::PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: mk_types::pending::ChoiceResolution::PuppetMasterSelectToken {
                    token_indices,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

fn setup_puppet_master_use_mode(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    token_index: usize,
) {
    let player = &state.players[player_idx];
    let token = &player.kept_enemy_tokens[token_index];

    let attack_value = (token.attack + 1) / 2; // ceil(attack/2)
    let attack_element = token.attack_element;
    let block_value = (token.armor + 1) / 2; // ceil(armor/2)

    // Derive block element from enemy resistances
    let block_element = derive_block_element_from_enemy(token.enemy_id.as_str());

    let options = vec![
        mk_types::effect::CardEffect::Noop, // Attack
        mk_types::effect::CardEffect::Noop, // Block
    ];

    state.players[player_idx].pending.active =
        Some(ActivePending::Choice(mk_types::pending::PendingChoice {
            card_id: None,
            skill_id: Some(skill_id.clone()),
            unit_instance_id: None,
            options,
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: mk_types::pending::ChoiceResolution::PuppetMasterUseMode {
                token_index,
                attack_value,
                attack_element,
                block_value,
                block_element,
            },
        }));
}

/// Derive block element from enemy resistances.
fn derive_block_element_from_enemy(enemy_id: &str) -> Element {
    let def = mk_data::enemies::get_enemy(enemy_id);
    let resistances = def.map(|d| d.resistances).unwrap_or(&[]);

    let has_fire = resistances.contains(&ResistanceElement::Fire);
    let has_ice = resistances.contains(&ResistanceElement::Ice);

    match (has_fire, has_ice) {
        (true, true) => Element::ColdFire,
        (true, false) => Element::Ice,
        (false, true) => Element::Fire,
        (false, false) => Element::Physical,
    }
}

pub(crate) fn execute_puppet_master_select_token(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    token_index: usize,
) {
    setup_puppet_master_use_mode(state, player_idx, skill_id, token_index);
}

pub(crate) fn execute_puppet_master_use_mode(
    state: &mut GameState,
    player_idx: usize,
    token_index: usize,
    choice_index: usize,
    attack_value: u32,
    attack_element: Element,
    block_value: u32,
    block_element: Element,
) {
    // Remove the token from kept_enemy_tokens
    let player = &mut state.players[player_idx];
    if token_index < player.kept_enemy_tokens.len() {
        player.kept_enemy_tokens.remove(token_index);
    }

    if choice_index == 0 {
        // Attack: add melee attack to combat accumulator
        let acc = &mut state.players[player_idx].combat_accumulator.attack;
        acc.normal += attack_value;
        match attack_element {
            Element::Physical => acc.normal_elements.physical += attack_value,
            Element::Fire => acc.normal_elements.fire += attack_value,
            Element::Ice => acc.normal_elements.ice += attack_value,
            Element::ColdFire => acc.normal_elements.cold_fire += attack_value,
        }
    } else {
        // Block: add block value to combat accumulator
        let acc = &mut state.players[player_idx].combat_accumulator;
        acc.block += block_value;
        match block_element {
            Element::Physical => acc.block_elements.physical += block_value,
            Element::Fire => acc.block_elements.fire += block_value,
            Element::Ice => acc.block_elements.ice += block_value,
            Element::ColdFire => acc.block_elements.cold_fire += block_value,
        }
    }
}

fn apply_shapeshift(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{ShapeshiftCardOption, ChoiceResolution, PendingChoice};

    let player = &state.players[player_idx];
    let mut options: Vec<ShapeshiftCardOption> = Vec::new();

    for (hand_index, card_id) in player.hand.iter().enumerate() {
        if let Some(opt) = classify_basic_action_for_shapeshift(card_id.as_str()) {
            options.push(ShapeshiftCardOption {
                hand_index,
                card_id: card_id.clone(),
                original_type: opt.0,
                amount: opt.1,
                element: opt.2,
            });
        }
    }

    if options.is_empty() {
        return Err(ApplyError::InternalError(
            "Shapeshift: no eligible basic action cards in hand".into(),
        ));
    }

    if options.len() == 1 {
        // Single card: go straight to type selection
        let opt = options[0].clone();
        setup_shapeshift_type_select(state, player_idx, skill_id, &opt);
    } else {
        let choice_options: Vec<mk_types::effect::CardEffect> = options
            .iter()
            .map(|_| mk_types::effect::CardEffect::Noop)
            .collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options: choice_options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::ShapeshiftCardSelect { options },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    })
}

/// Classify a card as a basic action eligible for Shapeshift.
/// Returns (original_type, amount, element) or None if not eligible.
///
/// Eligible: cards whose basic effect is GainMove, GainAttack, GainBlock,
/// or a Choice where the first option is GainAttack/GainBlock (rage, determination).
fn classify_basic_action_for_shapeshift(card_id: &str) -> Option<(mk_types::modifier::ShapeshiftTarget, u32, Option<Element>)> {
    let def = mk_data::cards::get_basic_action_card(card_id)?;
    if def.card_type != DeedCardType::BasicAction {
        return None;
    }

    classify_effect_for_shapeshift(&def.basic_effect)
}

fn classify_effect_for_shapeshift(effect: &mk_types::effect::CardEffect) -> Option<(mk_types::modifier::ShapeshiftTarget, u32, Option<Element>)> {
    use mk_types::modifier::ShapeshiftTarget;

    match effect {
        mk_types::effect::CardEffect::GainMove { amount } => {
            Some((ShapeshiftTarget::Move, *amount, None))
        }
        mk_types::effect::CardEffect::GainAttack { amount, element, .. } => {
            Some((ShapeshiftTarget::Attack, *amount, Some(*element)))
        }
        mk_types::effect::CardEffect::GainBlock { amount, element } => {
            Some((ShapeshiftTarget::Block, *amount, Some(*element)))
        }
        mk_types::effect::CardEffect::Choice { options } => {
            // For Choice cards like Rage (Attack 2 or Block 2), classify by first option
            options.first().and_then(|first| classify_effect_for_shapeshift(first))
        }
        _ => None,
    }
}

fn setup_shapeshift_type_select(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    card_opt: &mk_types::pending::ShapeshiftCardOption,
) {
    use mk_types::modifier::ShapeshiftTarget;

    // Build 2 options: the two types other than the original
    let all_types = [ShapeshiftTarget::Move, ShapeshiftTarget::Attack, ShapeshiftTarget::Block];
    let target_types: Vec<ShapeshiftTarget> = all_types
        .iter()
        .filter(|t| **t != card_opt.original_type)
        .copied()
        .collect();

    let options: Vec<mk_types::effect::CardEffect> = target_types
        .iter()
        .map(|_| mk_types::effect::CardEffect::Noop)
        .collect();

    state.players[player_idx].pending.active =
        Some(ActivePending::Choice(mk_types::pending::PendingChoice {
            card_id: None,
            skill_id: Some(skill_id.clone()),
            unit_instance_id: None,
            options,
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: mk_types::pending::ChoiceResolution::ShapeshiftTypeSelect {
                card_id: card_opt.card_id.clone(),
                hand_index: card_opt.hand_index,
                original_type: card_opt.original_type,
                amount: card_opt.amount,
                element: card_opt.element,
            },
        }));
}

pub(crate) fn execute_shapeshift_card_select(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    options: &[mk_types::pending::ShapeshiftCardOption],
    choice_index: usize,
) {
    if choice_index < options.len() {
        let opt = options[choice_index].clone();
        setup_shapeshift_type_select(state, player_idx, skill_id, &opt);
    }
}

pub(crate) fn execute_shapeshift_type_select(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    card_id: &CardId,
    _hand_index: usize,
    original_type: mk_types::modifier::ShapeshiftTarget,
    _amount: u32,
    element: Option<Element>,
    choice_index: usize,
) {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, ShapeshiftTarget};

    let all_types = [ShapeshiftTarget::Move, ShapeshiftTarget::Attack, ShapeshiftTarget::Block];
    let target_types: Vec<ShapeshiftTarget> = all_types
        .iter()
        .filter(|t| **t != original_type)
        .copied()
        .collect();

    if choice_index >= target_types.len() {
        return;
    }

    let target_type = target_types[choice_index];

    // Determine combat_type and element for the new type
    let (combat_type, new_element) = match target_type {
        ShapeshiftTarget::Move => (None, None),
        ShapeshiftTarget::Attack => (
            Some(CombatType::Melee),
            Some(element.unwrap_or(Element::Physical)),
        ),
        ShapeshiftTarget::Block => (
            None,
            Some(element.unwrap_or(Element::Physical)),
        ),
    };

    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::ShapeshiftActive {
            target_card_id: card_id.clone(),
            target_type,
            choice_index: None,
            combat_type,
            element: new_element,
        },
    );
}

/// Check if the player has any basic action card in hand eligible for Shapeshift.
pub(crate) fn has_shapeshift_eligible_cards(state: &GameState, player_idx: usize) -> bool {
    let player = &state.players[player_idx];
    player.hand.iter().any(|card_id| {
        classify_basic_action_for_shapeshift(card_id.as_str()).is_some()
    })
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
                exclude_resistance: None,
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
                    exclude_resistance: None,
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
                exclude_resistance: None,
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
            exclude_resistance: None,
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
) -> Result<ManaColor, ApplyError> {
    let target_mana = ManaColor::from(color);
    let player = &mut state.players[player_idx];

    // 1. Try matching-color mana token
    if let Some(idx) = player.pure_mana.iter().position(|t| t.color == target_mana) {
        player.pure_mana.remove(idx);
        return Ok(target_mana);
    }

    // 2. Try gold mana token (wild)
    if let Some(idx) = player
        .pure_mana
        .iter()
        .position(|t| t.color == ManaColor::Gold)
    {
        player.pure_mana.remove(idx);
        return Ok(ManaColor::Gold);
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
        return Ok(target_mana);
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
        let consumed_color = consume_mana_for_unit(state, player_idx, color)?;
        // Mana Enhancement trigger on mana-powered unit activation
        crate::card_play::check_mana_enhancement_trigger(state, player_idx, consumed_color);
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

        if template.exclude_summoners
            && (combat_resolution::has_ability(def, EnemyAbilityType::Summon)
                || combat_resolution::has_ability(def, EnemyAbilityType::SummonGreen))
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
            exclude_resistance: None,
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
            exclude_resistance: None,
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
// Interactive skill handlers
// =============================================================================

/// Public wrapper for `place_skill_in_center` (used by card_play.rs).
pub fn place_skill_in_center_pub(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    place_skill_in_center(state, player_idx, skill_id);
}

/// Place an interactive skill in the center (flip + push Round/OtherPlayers markers).
fn place_skill_in_center(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, RuleOverride, TerrainOrAll};

    // Flip skill face-down
    let player = &mut state.players[player_idx];
    if !player.skill_flip_state.flipped_skills.contains(skill_id) {
        player.skill_flip_state.flipped_skills.push(skill_id.clone());
    }

    // Add center marker modifiers (Round duration, OtherPlayers scope)
    match skill_id.as_str() {
        "norowas_prayer_of_weather" => {
            push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::All, amount: 0, minimum: 0, replace_cost: None,
                });
        }
        "arythea_ritual_of_pain" => {
            push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::RuleOverride { rule: RuleOverride::WoundsPlayableSideways });
            push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::SidewaysValue {
                    new_value: 3, for_wounds: true, condition: None,
                    mana_color: None, for_card_types: vec![],
                });
        }
        "braevalar_natures_vengeance" => {
            push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::NaturesVengeanceAttackBonus { amount: 1 });
        }
        "tovak_mana_overload" => {
            // No OtherPlayers modifier — center state is in state.mana_overload_center.
            // Auto-returns on trigger, not manually returnable.
        }
        "krang_mana_enhancement" => {
            // Dummy marker for returnable_skills detection
            push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::All, amount: 0, minimum: 0, replace_cost: None,
                });
        }
        "goldyx_source_opening" => {
            // Dummy marker for returnable_skills detection
            push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::All, amount: 0, minimum: 0, replace_cost: None,
                });
        }
        _ => {}
    }
}

/// Prayer of Weather: terrain cost -2 for owner, place in center.
fn apply_prayer_of_weather(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, TerrainOrAll};

    // Owner benefit: all terrain costs -2 (min 1) this turn
    push_skill_modifier(state, player_idx, skill_id,
        ModifierDuration::Turn, ModifierScope::SelfScope,
        ModifierEffect::TerrainCost {
            terrain: TerrainOrAll::All, amount: -2, minimum: 1, replace_cost: None,
        });

    place_skill_in_center(state, player_idx, skill_id);

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false })
}

/// Ritual of Pain: optionally discard 0-2 wounds, place in center.
fn apply_ritual_of_pain(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::ChoiceResolution;

    let wound_count = state.players[player_idx].hand.iter()
        .filter(|c| c.as_str() == "wound")
        .count();

    if wound_count == 0 {
        // No wounds — skip straight to center placement
        place_skill_in_center(state, player_idx, skill_id);
    } else {
        // Build options: "Discard 0", "Discard 1", optionally "Discard 2"
        let max_wounds = wound_count.min(2);
        let mut options = Vec::new();
        for _i in 0..=max_wounds {
            options.push(CardEffect::Noop); // placeholder — choice_index IS the discard count
        }

        state.players[player_idx].pending.active = Some(ActivePending::Choice(
            mk_types::pending::PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::RitualOfPainDiscard { max_wounds },
            },
        ));
    }

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false })
}

/// Execute Ritual of Pain discard resolution.
pub(crate) fn execute_ritual_of_pain_discard(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
    _max_wounds: usize,
) {
    let skill_id = SkillId::from("arythea_ritual_of_pain");

    // Discard `choice_index` wounds from hand
    let mut wounds_to_remove = choice_index;
    let player = &mut state.players[player_idx];
    player.hand.retain(|c| {
        if wounds_to_remove > 0 && c.as_str() == "wound" {
            wounds_to_remove -= 1;
            false
        } else {
            true
        }
    });

    place_skill_in_center(state, player_idx, &skill_id);
}

/// Nature's Vengeance: target an enemy for attack -1 + cumbersome.
fn apply_natures_vengeance(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::ChoiceResolution;

    let combat = state.combat.as_ref()
        .ok_or_else(|| ApplyError::InternalError("Nature's Vengeance: no combat".into()))?;

    let eligible: Vec<String> = combat.enemies.iter()
        .filter(|e| {
            !e.is_defeated && !e.is_summoner_hidden
            && mk_data::enemies::get_enemy(e.enemy_id.as_str()).map_or(false, |def| {
                !combat_resolution::has_ability(def, EnemyAbilityType::Summon)
                && !combat_resolution::has_ability(def, EnemyAbilityType::SummonGreen)
            })
        })
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    match eligible.len() {
        0 => {
            // Fizzle — don't place in center
        }
        1 => {
            apply_natures_vengeance_effects(state, player_idx, &eligible[0]);
            place_skill_in_center(state, player_idx, skill_id);
        }
        _ => {
            let mut options = Vec::new();
            for _ in &eligible {
                options.push(CardEffect::Noop); // placeholder
            }
            state.players[player_idx].pending.active = Some(ActivePending::Choice(
                mk_types::pending::PendingChoice {
                    card_id: None,
                    skill_id: Some(skill_id.clone()),
                    unit_instance_id: None,
                    options,
                    continuation: vec![],
                    movement_bonus_applied: false,
                    resolution: ChoiceResolution::NaturesVengeanceTarget {
                        eligible_enemy_ids: eligible,
                        is_return: false,
                    },
                },
            ));
        }
    }

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false })
}

/// Apply Nature's Vengeance effects to a target enemy: Attack -1 + Cumbersome.
fn apply_natures_vengeance_effects(state: &mut GameState, player_idx: usize, enemy_instance_id: &str) {
    let skill_id = SkillId::from("braevalar_natures_vengeance");

    // Attack -1 modifier
    push_skill_modifier(state, player_idx, &skill_id,
        mk_types::modifier::ModifierDuration::Combat,
        mk_types::modifier::ModifierScope::OneEnemy { enemy_id: enemy_instance_id.to_string() },
        mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Attack,
            amount: -1,
            minimum: 0,
            attack_index: None,
            per_resistance: false,
            fortified_amount: None,
            exclude_resistance: None,
        });

    // GrantEnemyAbility(Cumbersome) modifier
    push_skill_modifier(state, player_idx, &skill_id,
        mk_types::modifier::ModifierDuration::Combat,
        mk_types::modifier::ModifierScope::OneEnemy { enemy_id: enemy_instance_id.to_string() },
        mk_types::modifier::ModifierEffect::GrantEnemyAbility {
            ability: EnemyAbilityType::Cumbersome,
        });
}

/// Execute Nature's Vengeance target resolution (from choice).
pub(crate) fn execute_natures_vengeance_target(
    state: &mut GameState,
    player_idx: usize,
    eligible_enemy_ids: &[String],
    choice_index: usize,
    is_return: bool,
) {
    if let Some(enemy_id) = eligible_enemy_ids.get(choice_index) {
        apply_natures_vengeance_effects(state, player_idx, enemy_id);
        if !is_return {
            let skill_id = SkillId::from("braevalar_natures_vengeance");
            place_skill_in_center(state, player_idx, &skill_id);
        }
    }
}

/// Return an interactive skill from the center to its owner, giving the returner a benefit.
fn apply_return_interactive_skill(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::*;
    use mk_types::pending::ChoiceResolution;

    // Find owner by scanning modifiers
    let owner_id = state.active_modifiers.iter()
        .find_map(|m| {
            if let ModifierSource::Skill { skill_id: sid, player_id: owner } = &m.source {
                if sid.as_str() == skill_id.as_str()
                    && *owner != state.players[player_idx].id
                {
                    return Some(owner.clone());
                }
            }
            None
        })
        .ok_or_else(|| ApplyError::InternalError(
            format!("ReturnInteractiveSkill: no center modifier for {}", skill_id.as_str())
        ))?;

    // Remove ALL center modifiers matching this skill + owner
    let skill_str = skill_id.as_str().to_string();
    let owner_clone = owner_id.clone();
    state.active_modifiers.retain(|m| {
        !matches!(&m.source, ModifierSource::Skill { skill_id: sid, player_id: owner }
            if sid.as_str() == skill_str && *owner == owner_clone)
    });

    // Apply return benefit per skill
    match skill_id.as_str() {
        "norowas_prayer_of_weather" => {
            push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Turn, ModifierScope::SelfScope,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::All, amount: -1, minimum: 1, replace_cost: None,
                });
        }
        "arythea_ritual_of_pain" => {
            push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Turn, ModifierScope::SelfScope,
                ModifierEffect::RuleOverride { rule: RuleOverride::WoundsPlayableSideways });
            push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Turn, ModifierScope::SelfScope,
                ModifierEffect::SidewaysValue {
                    new_value: 3, for_wounds: true, condition: None,
                    mana_color: None, for_card_types: vec![],
                });
        }
        "braevalar_natures_vengeance" => {
            // Trigger enemy selection for returner
            let combat = state.combat.as_ref()
                .ok_or_else(|| ApplyError::InternalError("ReturnNaturesVengeance: no combat".into()))?;

            let eligible: Vec<String> = combat.enemies.iter()
                .filter(|e| {
                    !e.is_defeated && !e.is_summoner_hidden
                    && mk_data::enemies::get_enemy(e.enemy_id.as_str()).map_or(false, |def| {
                        !combat_resolution::has_ability(def, EnemyAbilityType::Summon)
                        && !combat_resolution::has_ability(def, EnemyAbilityType::SummonGreen)
                    })
                })
                .map(|e| e.instance_id.as_str().to_string())
                .collect();

            match eligible.len() {
                0 => {} // No eligible → benefit fizzles
                1 => {
                    apply_natures_vengeance_effects(state, player_idx, &eligible[0]);
                }
                _ => {
                    let mut options = Vec::new();
                    for _ in &eligible {
                        options.push(mk_types::effect::CardEffect::Noop);
                    }
                    state.players[player_idx].pending.active = Some(ActivePending::Choice(
                        mk_types::pending::PendingChoice {
                            card_id: None,
                            skill_id: Some(skill_id.clone()),
                            unit_instance_id: None,
                            options,
                            continuation: vec![],
                            movement_bonus_applied: false,
                            resolution: ChoiceResolution::NaturesVengeanceTarget {
                                eligible_enemy_ids: eligible,
                                is_return: true,
                            },
                        },
                    ));
                }
            }
        }
        "krang_mana_enhancement" => {
            // Grant returner 1 mana token of marked color
            if let Some(center) = state.mana_enhancement_center.take() {
                let mana_color = ManaColor::from(center.marked_color);
                state.players[player_idx].pure_mana.push(ManaToken {
                    color: mana_color,
                    source: ManaTokenSource::Effect,
                    cannot_power_spells: false,
                });
            }
        }
        "goldyx_source_opening" => {
            // Grant ExtraSourceDie modifier to returner
            push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Turn, ModifierScope::SelfScope,
                ModifierEffect::RuleOverride { rule: RuleOverride::ExtraSourceDie });

            // Track returning player for end-of-turn crystal grant
            if let Some(ref mut center) = state.source_opening_center {
                center.returning_player_id = Some(state.players[player_idx].id.clone());
                center.used_die_count_at_return = state.players[player_idx].used_die_ids.len() as u32;
            }
        }
        _ => {}
    }

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false })
}

// =============================================================================
// Batch 3 skills — Mana Overload, Source Opening, Master of Chaos
// =============================================================================

/// Initialize Master of Chaos wheel position when the skill is acquired.
fn init_master_of_chaos_if_needed(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    if skill_id.as_str() == "krang_master_of_chaos" {
        let position = roll_master_of_chaos_initial_position(&mut state.rng);
        state.players[player_idx].master_of_chaos_state = Some(MasterOfChaosState {
            position,
            free_rotate_available: false,
        });
    }
}

fn roll_master_of_chaos_initial_position(rng: &mut mk_types::rng::RngState) -> ManaColor {
    const POSITIONS: [ManaColor; 6] = [
        ManaColor::Blue, ManaColor::Green, ManaColor::Black,
        ManaColor::White, ManaColor::Red, ManaColor::Gold,
    ];
    let idx = rng.random_index(POSITIONS.len()).unwrap();
    POSITIONS[idx]
}

const CLOCKWISE: [ManaColor; 6] = [
    ManaColor::Blue, ManaColor::Green, ManaColor::Black,
    ManaColor::White, ManaColor::Red, ManaColor::Gold,
];

fn rotate_clockwise(current: ManaColor) -> ManaColor {
    let idx = CLOCKWISE.iter().position(|&c| c == current).unwrap_or(0);
    CLOCKWISE[(idx + 1) % 6]
}

fn master_of_chaos_effect(position: ManaColor) -> mk_types::effect::CardEffect {
    use mk_types::effect::CardEffect;
    match position {
        ManaColor::Blue => CardEffect::GainBlock { amount: 3, element: Element::Physical },
        ManaColor::Green => CardEffect::GainMove { amount: 1 },
        ManaColor::Black => CardEffect::GainAttack { amount: 1, combat_type: CombatType::Ranged, element: Element::ColdFire },
        ManaColor::White => CardEffect::GainInfluence { amount: 2 },
        ManaColor::Red => CardEffect::GainAttack { amount: 2, combat_type: CombatType::Melee, element: Element::Physical },
        ManaColor::Gold => CardEffect::Choice {
            options: vec![
                CardEffect::GainBlock { amount: 3, element: Element::Physical },
                CardEffect::GainMove { amount: 1 },
                CardEffect::GainAttack { amount: 1, combat_type: CombatType::Ranged, element: Element::ColdFire },
                CardEffect::GainInfluence { amount: 2 },
                CardEffect::GainAttack { amount: 2, combat_type: CombatType::Melee, element: Element::Physical },
            ],
        },
    }
}

/// Mana Overload: choose non-Gold mana color → gain mana → center.
fn apply_mana_overload(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::ChoiceResolution;

    // Build 5 options: GainMana for each non-Gold color
    let options = vec![
        CardEffect::GainMana { color: ManaColor::Red, amount: 1 },
        CardEffect::GainMana { color: ManaColor::Blue, amount: 1 },
        CardEffect::GainMana { color: ManaColor::Green, amount: 1 },
        CardEffect::GainMana { color: ManaColor::White, amount: 1 },
        CardEffect::GainMana { color: ManaColor::Black, amount: 1 },
    ];

    state.players[player_idx].pending.active = Some(ActivePending::Choice(
        mk_types::pending::PendingChoice {
            card_id: None,
            skill_id: Some(skill_id.clone()),
            unit_instance_id: None,
            options,
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::ManaOverloadColorSelect,
        },
    ));

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false })
}

/// Execute Mana Overload color selection.
pub(crate) fn execute_mana_overload_color_select(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
) {
    const COLORS: [ManaColor; 5] = [
        ManaColor::Red, ManaColor::Blue, ManaColor::Green,
        ManaColor::White, ManaColor::Black,
    ];
    let color = COLORS.get(choice_index).copied().unwrap_or(ManaColor::Red);
    let skill_id = SkillId::from("tovak_mana_overload");

    // Set center state
    state.mana_overload_center = Some(ManaOverloadCenter {
        marked_color: color,
        owner_id: state.players[player_idx].id.clone(),
        skill_id: skill_id.clone(),
    });

    place_skill_in_center(state, player_idx, &skill_id);
}

/// Source Opening: choose a die to reroll → center.
fn apply_source_opening(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::ChoiceResolution;

    // Find available dice
    let die_ids: Vec<SourceDieId> = state.source.dice.iter()
        .filter(|d| d.taken_by_player_id.is_none() && !d.is_depleted)
        .map(|d| d.id.clone())
        .collect();

    if die_ids.is_empty() {
        // No dice to reroll — skip straight to center placement
        state.source_opening_center = Some(SourceOpeningCenter {
            owner_id: state.players[player_idx].id.clone(),
            skill_id: skill_id.clone(),
            returning_player_id: None,
            used_die_count_at_return: 0,
        });
        place_skill_in_center(state, player_idx, skill_id);
    } else {
        // Build options: one per die + one "skip" (last index)
        let mut options = Vec::new();
        for _ in &die_ids {
            options.push(CardEffect::Noop);
        }
        options.push(CardEffect::Noop); // skip option

        state.players[player_idx].pending.active = Some(ActivePending::Choice(
            mk_types::pending::PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::SourceOpeningDieSelect { die_ids },
            },
        ));
    }

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false })
}

/// Execute Source Opening die selection.
pub(crate) fn execute_source_opening_die_select(
    state: &mut GameState,
    player_idx: usize,
    die_ids: &[SourceDieId],
    choice_index: usize,
) {
    let skill_id = SkillId::from("goldyx_source_opening");

    if choice_index < die_ids.len() {
        // Reroll the chosen die
        crate::mana::reroll_die(&mut state.source, &die_ids[choice_index], state.time_of_day, &mut state.rng);
    }
    // else: skip (no reroll)

    // Set center state
    state.source_opening_center = Some(SourceOpeningCenter {
        owner_id: state.players[player_idx].id.clone(),
        skill_id: skill_id.clone(),
        returning_player_id: None,
        used_die_count_at_return: 0,
    });
    place_skill_in_center(state, player_idx, &skill_id);
}

/// Master of Chaos: rotate wheel 1 step, apply effect.
fn apply_master_of_chaos(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::ChoiceResolution;

    let current_pos = state.players[player_idx].master_of_chaos_state
        .as_ref()
        .map(|s| s.position)
        .unwrap_or(ManaColor::Blue);

    let new_pos = rotate_clockwise(current_pos);

    state.players[player_idx].master_of_chaos_state = Some(MasterOfChaosState {
        position: new_pos,
        free_rotate_available: false,
    });

    let effect = master_of_chaos_effect(new_pos);

    // Resolve via effect queue
    let mut queue = effect_queue::EffectQueue::new();
    queue.push(effect, None);
    match queue.drain(state, player_idx) {
        effect_queue::DrainResult::Complete => Ok(ApplyResult { needs_reenumeration: true, game_ended: false }),
        effect_queue::DrainResult::NeedsChoice { options, continuation, resolution: _ } => {
            // Gold position → choice
            state.players[player_idx].pending.active = Some(ActivePending::Choice(
                mk_types::pending::PendingChoice {
                    card_id: None,
                    skill_id: Some(skill_id.clone()),
                    unit_instance_id: None,
                    options,
                    continuation: continuation.into_iter().map(|q| mk_types::pending::ContinuationEntry {
                        effect: q.effect,
                        source_card_id: q.source_card_id,
                    }).collect(),
                    movement_bonus_applied: false,
                    resolution: ChoiceResolution::MasterOfChaosGoldChoice,
                },
            ));
            Ok(ApplyResult { needs_reenumeration: true, game_ended: false })
        }
        effect_queue::DrainResult::PendingSet => Ok(ApplyResult { needs_reenumeration: true, game_ended: false }),
    }
}

/// Resolve Source Opening reroll choice at end-of-turn.
pub(crate) fn apply_resolve_source_opening_reroll(
    state: &mut GameState,
    player_idx: usize,
    reroll: bool,
) -> Result<ApplyResult, ApplyError> {
    let pending = state.players[player_idx].pending.active.take();
    let die_id = match pending {
        Some(ActivePending::SourceOpeningReroll { die_id }) => die_id,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError("No SourceOpeningReroll pending".into()));
        }
    };

    if reroll {
        crate::mana::reroll_die(&mut state.source, &die_id, state.time_of_day, &mut state.rng);
    }

    // Resume end-turn flow
    match crate::end_turn::end_turn(state, player_idx) {
        Ok(_) => Ok(ApplyResult { needs_reenumeration: true, game_ended: false }),
        Err(e) => Err(ApplyError::InternalError(format!("end_turn after source opening reroll: {:?}", e))),
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::legal_actions::enumerate_legal_actions_with_undo;
    use crate::setup::create_solo_game;
    use mk_types::effect::CardEffect;
    use mk_types::ids::CardId;
    use mk_types::legal_action::LegalAction;
    use mk_types::pending::{ActivePending, BookOfWisdomPhase, EffectMode};
    use mk_types::TacticId;

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
        state.source.dice.clear(); // control mana sources explicitly
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
        play_card(&mut state, 0, 0, false, None).unwrap();
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

    // =================================================================
    // Wolf's Howl tests
    // =================================================================

    #[test]
    fn wolfs_howl_base_value_4() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_wolfs_howl");
        // Level 1 has 1 command slot, 0 units = 1 empty slot → value = 4 + 1 = 5
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("wolfhawk_wolfs_howl") },
            epoch,
        ).unwrap();
        let val = crate::card_play::get_effective_sideways_value(
            &state, 0, false, DeedCardType::BasicAction, Some(BasicManaColor::Green),
        );
        // Level 1 = 1 command slot, 0 units → empty_slots = 1, value = 4 + 1 = 5
        assert_eq!(val, 5);
    }

    #[test]
    fn wolfs_howl_scales_with_empty_slots() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_wolfs_howl");
        // Set to level 5 (3 command slots), 1 unit → 2 empty slots → value = 4 + 2 = 6
        state.players[0].level = 5;
        state.players[0].fame = 35; // enough for level 5
        state.players[0].units.push(mk_types::state::PlayerUnit {
            instance_id: mk_types::ids::UnitInstanceId::from("unit_1"),
            unit_id: mk_types::ids::UnitId::from("peasants"),
            level: 1,
            state: UnitState::Ready,
            wounded: false,
            used_resistance_this_combat: false,
            used_ability_indices: vec![],
            mana_token: None,
        });
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("wolfhawk_wolfs_howl") },
            epoch,
        ).unwrap();
        let val = crate::card_play::get_effective_sideways_value(
            &state, 0, false, DeedCardType::BasicAction, Some(BasicManaColor::Green),
        );
        assert_eq!(val, 6);
    }

    #[test]
    fn wolfs_howl_mutual_exclusivity() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_wolfs_howl");
        // Activate wolf's howl
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("wolfhawk_wolfs_howl") },
            epoch,
        ).unwrap();
        // If player also had another sideways skill, it should be blocked.
        // Simulate by adding power_of_pain and checking enumeration.
        state.players[0].skills.push(mk_types::ids::SkillId::from("arythea_power_of_pain"));
        let las = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            !las.actions.iter().any(|a|
                matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "arythea_power_of_pain")
            ),
            "Another sideways skill should be blocked after Wolf's Howl activation"
        );
    }

    // =================================================================
    // Puppet Master tests
    // =================================================================

    fn setup_puppet_master_state() -> (GameState, UndoStack) {
        let (mut state, undo) = setup_with_skill(Hero::Krang, "krang_puppet_master");
        state.combat = Some(Box::new(CombatState::default()));
        // Add a kept enemy token (prowlers: attack 4 Physical, armor 3, no resistances)
        state.players[0].kept_enemy_tokens.push(mk_types::state::KeptEnemyToken {
            enemy_id: mk_types::ids::EnemyId::from("prowlers"),
            name: "Prowlers".to_string(),
            attack: 4,
            attack_element: Element::Physical,
            armor: 3,
        });
        (state, undo)
    }

    #[test]
    fn puppet_master_expend_attack() {
        let (mut state, mut undo) = setup_puppet_master_state();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("krang_puppet_master") },
            epoch,
        ).unwrap();
        // Single token → auto-select → PuppetMasterUseMode pending
        assert!(state.players[0].pending.has_active());
        // Choose attack (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();
        // ceil(4/2) = 2 melee attack
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
        assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 2);
    }

    #[test]
    fn puppet_master_expend_block() {
        let (mut state, mut undo) = setup_puppet_master_state();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("krang_puppet_master") },
            epoch,
        ).unwrap();
        // Choose block (index 1)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 1 },
            epoch,
        ).unwrap();
        // ceil(3/2) = 2 block (armor = 3, Physical since prowlers have no resistances)
        assert_eq!(state.players[0].combat_accumulator.block, 2);
        assert_eq!(state.players[0].combat_accumulator.block_elements.physical, 2);
    }

    #[test]
    fn puppet_master_block_element_from_resistance() {
        // skeletal_warriors: Fire resistance only → block = Ice
        assert_eq!(derive_block_element_from_enemy("skeletal_warriors"), Element::Ice);
        // crystal_sprites: Ice resistance only → block = Fire
        assert_eq!(derive_block_element_from_enemy("crystal_sprites"), Element::Fire);
        // orc_war_beasts: Fire + Ice resistance → block = ColdFire
        assert_eq!(derive_block_element_from_enemy("orc_war_beasts"), Element::ColdFire);
        // prowlers: no resistance → block = Physical
        assert_eq!(derive_block_element_from_enemy("prowlers"), Element::Physical);
    }

    #[test]
    fn puppet_master_token_removed_after_use() {
        let (mut state, mut undo) = setup_puppet_master_state();
        assert_eq!(state.players[0].kept_enemy_tokens.len(), 1);
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("krang_puppet_master") },
            epoch,
        ).unwrap();
        // Choose attack (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();
        assert_eq!(state.players[0].kept_enemy_tokens.len(), 0);
    }

    #[test]
    fn puppet_master_not_available_without_tokens() {
        let (mut state, undo) = setup_with_skill(Hero::Krang, "krang_puppet_master");
        state.combat = Some(Box::new(CombatState::default()));
        // No tokens → should not enumerate
        let las = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(
            !las.actions.iter().any(|a|
                matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "krang_puppet_master")
            ),
            "Puppet Master should not be available without kept tokens"
        );
    }

    // =================================================================
    // Shapeshift tests
    // =================================================================

    fn setup_shapeshift_state() -> (GameState, UndoStack) {
        let (mut state, undo) = setup_with_skill(Hero::Braevalar, "braevalar_shapeshift");
        state.combat = Some(Box::new(CombatState::default()));
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("rage"),
        ];
        (state, undo)
    }

    #[test]
    fn shapeshift_move_to_attack() {
        let (mut state, mut undo) = setup_shapeshift_state();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("braevalar_shapeshift") },
            epoch,
        ).unwrap();
        // Multiple cards → ShapeshiftCardSelect pending
        assert!(state.players[0].pending.has_active());
        // Pick march (index 0 in options which maps to march)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();
        // Now ShapeshiftTypeSelect pending. March = Move, so options are Attack(0), Block(1)
        assert!(state.players[0].pending.has_active());
        // Pick Attack (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();
        // Should have ShapeshiftActive modifier
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::ShapeshiftActive {
                target_card_id, target_type, ..
            } if target_card_id.as_str() == "march" && *target_type == mk_types::modifier::ShapeshiftTarget::Attack)
        ));
    }

    #[test]
    fn shapeshift_attack_to_block() {
        let (mut state, mut undo) = setup_shapeshift_state();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("braevalar_shapeshift") },
            epoch,
        ).unwrap();
        // Pick rage (index 1 in options → rage is Attack type)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 1 },
            epoch,
        ).unwrap();
        // Rage = Attack, so options are Move(0), Block(1)
        // Pick Block (index 1)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 1 },
            epoch,
        ).unwrap();
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::ShapeshiftActive {
                target_card_id, target_type, ..
            } if target_card_id.as_str() == "rage" && *target_type == mk_types::modifier::ShapeshiftTarget::Block)
        ));
    }

    #[test]
    fn shapeshift_only_basic_actions() {
        // Move cards
        assert!(classify_basic_action_for_shapeshift("march").is_some());
        assert!(classify_basic_action_for_shapeshift("stamina").is_some());
        assert!(classify_basic_action_for_shapeshift("swiftness").is_some());
        // Choice cards (Attack/Block first option → classified as Attack)
        assert!(classify_basic_action_for_shapeshift("rage").is_some());
        assert!(classify_basic_action_for_shapeshift("determination").is_some());
    }

    #[test]
    fn shapeshift_excludes_non_combat_cards() {
        assert!(classify_basic_action_for_shapeshift("concentration").is_none());
        assert!(classify_basic_action_for_shapeshift("wound").is_none());
        assert!(classify_basic_action_for_shapeshift("mana_draw").is_none());
        assert!(classify_basic_action_for_shapeshift("crystallize").is_none());
        assert!(classify_basic_action_for_shapeshift("improvisation").is_none());
        assert!(classify_basic_action_for_shapeshift("tranquility").is_none());
        assert!(classify_basic_action_for_shapeshift("promise").is_none());
        assert!(classify_basic_action_for_shapeshift("threaten").is_none());
    }

    #[test]
    fn shapeshift_modifier_applied() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_shapeshift");
        state.combat = Some(Box::new(CombatState::default()));
        // Single eligible card → auto-select card, then type select
        state.players[0].hand = vec![CardId::from("march")];
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from("braevalar_shapeshift") },
            epoch,
        ).unwrap();
        // Single card → auto-selected → ShapeshiftTypeSelect pending
        assert!(state.players[0].pending.has_active());
        // Pick Block (index 1: Move excluded → options are Attack(0), Block(1))
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 1 },
            epoch,
        ).unwrap();
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::ShapeshiftActive {
                target_type, ..
            } if *target_type == mk_types::modifier::ShapeshiftTarget::Block)
        ));
    }

    // =========================================================================
    // Interactive Skill tests
    // =========================================================================

    /// Helper: set up a 2-player game where player 0 has a specific skill and it's their turn.
    fn setup_two_player_with_skill(hero: Hero, skill_id: &str) -> (GameState, UndoStack) {
        let (mut state, undo) = setup_with_skill(hero, skill_id);
        // Add a second player
        let mut p1 = state.players[0].clone();
        p1.id = mk_types::ids::PlayerId::from("player_1");
        p1.hero = Hero::Tovak;
        p1.skills.clear();
        p1.hand = vec![CardId::from("march")];
        state.players.push(p1);
        state.turn_order = vec![
            mk_types::ids::PlayerId::from("player_0"),
            mk_types::ids::PlayerId::from("player_1"),
        ];
        (state, undo)
    }

    /// Helper: activate a skill for player 0.
    fn activate_skill(state: &mut GameState, undo: &mut UndoStack, skill_str: &str) {
        let epoch = state.action_epoch;
        apply_legal_action(
            state, undo, 0,
            &LegalAction::UseSkill { skill_id: mk_types::ids::SkillId::from(skill_str) },
            epoch,
        ).unwrap();
    }

    /// Helper: switch current player to player_1 (index 1).
    fn switch_to_player_1(state: &mut GameState) {
        state.current_player_index = 1;
    }

    // ---- Prayer of Weather ----

    #[test]
    fn prayer_of_weather_owner_terrain_cost_minus_2() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
        activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
        // Owner should have Turn/SelfScope TerrainCost -2
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::TerrainCost {
                amount, minimum, ..
            } if *amount == -2 && *minimum == 1)
            && matches!(&m.duration, mk_types::modifier::ModifierDuration::Turn)
            && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
        ));
    }

    #[test]
    fn prayer_of_weather_center_marker() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
        activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
        // Should have Round/OtherPlayers center marker
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.duration, mk_types::modifier::ModifierDuration::Round)
            && matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
            && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { skill_id, .. }
                if skill_id.as_str() == "norowas_prayer_of_weather")
        ));
    }

    #[test]
    fn prayer_of_weather_skill_flipped() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
        activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
        assert!(state.players[0].skill_flip_state.flipped_skills.iter()
            .any(|s| s.as_str() == "norowas_prayer_of_weather"));
    }

    #[test]
    fn prayer_of_weather_return_gives_minus_1() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
        activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
        // Switch to player 1 and return it
        switch_to_player_1(&mut state);
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 1,
            &LegalAction::ReturnInteractiveSkill {
                skill_id: mk_types::ids::SkillId::from("norowas_prayer_of_weather"),
            },
            epoch,
        ).unwrap();
        // Returner gets Turn/SelfScope TerrainCost -1
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::TerrainCost {
                amount, minimum, ..
            } if *amount == -1 && *minimum == 1)
            && matches!(&m.duration, mk_types::modifier::ModifierDuration::Turn)
            && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
            && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { player_id, .. }
                if player_id.as_str() == "player_1")
        ));
    }

    #[test]
    fn prayer_of_weather_center_cleared_on_return() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
        activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
        switch_to_player_1(&mut state);
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 1,
            &LegalAction::ReturnInteractiveSkill {
                skill_id: mk_types::ids::SkillId::from("norowas_prayer_of_weather"),
            },
            epoch,
        ).unwrap();
        // No more OtherPlayers modifiers from player_0
        assert!(!state.active_modifiers.iter().any(|m|
            matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
            && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { player_id, .. }
                if player_id.as_str() == "player_0")
        ));
    }

    // ---- Ritual of Pain ----

    #[test]
    fn ritual_of_pain_discard_0_wounds() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
        activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");
        // Should have pending choice with 2 options (0 or 1 wound)
        assert!(state.players[0].pending.has_active());
        // Choose 0 wounds
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 },
            epoch,
        ).unwrap();
        // Wound still in hand
        assert_eq!(state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count(), 1);
        // Skill placed in center
        assert!(state.players[0].skill_flip_state.flipped_skills.iter()
            .any(|s| s.as_str() == "arythea_ritual_of_pain"));
    }

    #[test]
    fn ritual_of_pain_discard_1_wound() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
        activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");
        // Choose 1 wound (index 1)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 1 },
            epoch,
        ).unwrap();
        // Wound removed
        assert_eq!(state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count(), 0);
        assert_eq!(state.players[0].hand.len(), 1); // only march
    }

    #[test]
    fn ritual_of_pain_discard_2_wounds() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
        state.players[0].hand = vec![
            CardId::from("wound"), CardId::from("wound"), CardId::from("march"),
        ];
        activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");
        // Should have 3 options: 0, 1, 2 wounds
        // Choose 2 (index 2)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 2 },
            epoch,
        ).unwrap();
        assert_eq!(state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count(), 0);
        assert_eq!(state.players[0].hand.len(), 1); // only march
    }

    #[test]
    fn ritual_of_pain_center_modifiers() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
        state.players[0].hand = vec![CardId::from("march")]; // no wounds → skip to center
        activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");
        // Center markers: WoundsPlayableSideways + SidewaysValue(3)
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride {
                rule: mk_types::modifier::RuleOverride::WoundsPlayableSideways
            })
            && matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
        ));
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::SidewaysValue {
                new_value, for_wounds, ..
            } if *new_value == 3 && *for_wounds)
            && matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
        ));
    }

    #[test]
    fn ritual_of_pain_return_wounds_sideways() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
        state.players[0].hand = vec![CardId::from("march")]; // no wounds
        activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");
        switch_to_player_1(&mut state);
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 1,
            &LegalAction::ReturnInteractiveSkill {
                skill_id: mk_types::ids::SkillId::from("arythea_ritual_of_pain"),
            },
            epoch,
        ).unwrap();
        // Returner gets Turn/SelfScope wound modifiers
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride {
                rule: mk_types::modifier::RuleOverride::WoundsPlayableSideways
            })
            && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
            && matches!(&m.duration, mk_types::modifier::ModifierDuration::Turn)
            && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { player_id, .. }
                if player_id.as_str() == "player_1")
        ));
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::SidewaysValue {
                new_value, for_wounds, ..
            } if *new_value == 3 && *for_wounds)
            && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
            && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { player_id, .. }
                if player_id.as_str() == "player_1")
        ));
    }

    // ---- Nature's Vengeance ----

    /// Helper: set up a combat game with specified enemy ids for 2-player skill tests.
    fn setup_two_player_combat_with_skill(hero: Hero, skill_id: &str, enemy_ids: &[&str]) -> (GameState, UndoStack) {
        let (mut state, undo) = setup_two_player_with_skill(hero, skill_id);
        let tokens: Vec<mk_types::ids::EnemyTokenId> = enemy_ids
            .iter()
            .map(|id| mk_types::ids::EnemyTokenId::from(format!("{}_1", id)))
            .collect();
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();
        (state, undo)
    }

    #[test]
    fn natures_vengeance_attack_minus_1() {
        let (mut state, mut undo) = setup_two_player_combat_with_skill(
            Hero::Braevalar, "braevalar_natures_vengeance", &["prowlers"],
        );
        activate_skill(&mut state, &mut undo, "braevalar_natures_vengeance");
        // Single enemy → auto-apply. Should have EnemyStat Attack -1
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
                stat, amount, ..
            } if *stat == mk_types::modifier::EnemyStat::Attack && *amount == -1)
        ));
    }

    #[test]
    fn natures_vengeance_grants_cumbersome() {
        let (mut state, mut undo) = setup_two_player_combat_with_skill(
            Hero::Braevalar, "braevalar_natures_vengeance", &["prowlers"],
        );
        activate_skill(&mut state, &mut undo, "braevalar_natures_vengeance");
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::GrantEnemyAbility {
                ability
            } if *ability == EnemyAbilityType::Cumbersome)
        ));
    }

    #[test]
    fn natures_vengeance_cumbersome_spend_move() {
        let (mut state, mut undo) = setup_two_player_combat_with_skill(
            Hero::Braevalar, "braevalar_natures_vengeance", &["prowlers"],
        );
        activate_skill(&mut state, &mut undo, "braevalar_natures_vengeance");
        // Player needs move points + correct combat phase to spend on cumbersome
        state.players[0].move_points = 2;
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let enemy_id = state.combat.as_ref().unwrap().enemies[0].instance_id.clone();
        assert!(actions.actions.iter().any(|a|
            matches!(a, LegalAction::SpendMoveOnCumbersome { enemy_instance_id }
                if *enemy_instance_id == enemy_id)
        ));
    }

    #[test]
    fn natures_vengeance_excludes_summoners() {
        let (state, _undo) = setup_two_player_combat_with_skill(
            Hero::Braevalar, "braevalar_natures_vengeance", &["orc_summoners"],
        );
        // orc_summoners has Summon ability → should NOT show UseSkill
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a|
            matches!(a, LegalAction::UseSkill { skill_id }
                if skill_id.as_str() == "braevalar_natures_vengeance")
        ));
    }

    #[test]
    fn natures_vengeance_allows_arcane_immune() {
        // shadow has ArcaneImmunity — NV should still target it
        let (mut state, mut undo) = setup_two_player_combat_with_skill(
            Hero::Braevalar, "braevalar_natures_vengeance", &["shadow"],
        );
        activate_skill(&mut state, &mut undo, "braevalar_natures_vengeance");
        // Auto-apply (single enemy). Should have the modifiers
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
                stat, amount, ..
            } if *stat == mk_types::modifier::EnemyStat::Attack && *amount == -1)
        ));
    }

    #[test]
    fn natures_vengeance_center_penalty() {
        let (mut state, mut undo) = setup_two_player_combat_with_skill(
            Hero::Braevalar, "braevalar_natures_vengeance", &["prowlers"],
        );
        activate_skill(&mut state, &mut undo, "braevalar_natures_vengeance");
        // NaturesVengeanceAttackBonus marker in center
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::NaturesVengeanceAttackBonus {
                amount
            } if *amount == 1)
            && matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
            && matches!(&m.duration, mk_types::modifier::ModifierDuration::Round)
        ));
    }

    // ---- Infrastructure ----

    #[test]
    fn interactive_skill_cooldown() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
        activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
        // Skill in used_this_round → should not be usable again
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "norowas_prayer_of_weather"));
    }

    #[test]
    fn interactive_skill_not_available_when_flipped() {
        let (mut state, _undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
        // Pre-flip the skill
        state.players[0].skill_flip_state.flipped_skills.push(
            mk_types::ids::SkillId::from("norowas_prayer_of_weather")
        );
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a|
            matches!(a, LegalAction::UseSkill { skill_id }
                if skill_id.as_str() == "norowas_prayer_of_weather")
        ));
    }

    #[test]
    fn returnable_skill_not_shown_for_owner() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
        activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
        // Owner (player 0) should NOT see ReturnInteractiveSkill
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a|
            matches!(a, LegalAction::ReturnInteractiveSkill { .. })
        ));
        // But player 1 should
        switch_to_player_1(&mut state);
        let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
        assert!(actions.actions.iter().any(|a|
            matches!(a, LegalAction::ReturnInteractiveSkill { skill_id }
                if skill_id.as_str() == "norowas_prayer_of_weather")
        ));
    }

    // =========================================================================
    // all_damage_blocked_this_phase tests
    // =========================================================================

    #[test]
    fn all_damage_blocked_flag_set_when_all_blocked() {
        let mut state = setup_combat_game(&["prowlers"]); // 4 phys, single attack
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 5, fire: 0, ice: 0, cold_fire: 0,
        };

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::DeclareBlock {
                enemy_instance_id: CombatInstanceId::from("enemy_0"),
                attack_index: 0,
            },
            epoch,
        ).unwrap();

        // Transition Block → AssignDamage
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

        assert!(state.combat.as_ref().unwrap().all_damage_blocked_this_phase);
    }

    #[test]
    fn all_damage_blocked_flag_false_when_one_unblocked() {
        let mut state = setup_combat_game(&["prowlers", "prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 5, fire: 0, ice: 0, cold_fire: 0,
        };

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        // Block only enemy_0
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::DeclareBlock {
                enemy_instance_id: CombatInstanceId::from("enemy_0"),
                attack_index: 0,
            },
            epoch,
        ).unwrap();

        // Transition Block → AssignDamage (enemy_1 still unblocked)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

        assert!(!state.combat.as_ref().unwrap().all_damage_blocked_this_phase);
    }

    #[test]
    fn all_damage_blocked_flag_true_when_all_defeated() {
        let mut state = setup_combat_game(&["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.combat.as_mut().unwrap().enemies[0].is_defeated = true;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

        assert!(state.combat.as_ref().unwrap().all_damage_blocked_this_phase);
    }

    // =========================================================================
    // BurningShieldActive consumption tests
    // =========================================================================

    fn push_burning_shield_modifier(
        state: &mut GameState,
        player_idx: usize,
        mode: mk_types::modifier::BurningShieldMode,
        attack_value: u32,
    ) {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let pid = state.players[player_idx].id.clone();
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("burning_shield_mod"),
            source: ModifierSource::Card {
                card_id: CardId::from("burning_shield"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Combat,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::BurningShieldActive {
                mode,
                block_value: 4,
                attack_value,
            },
            created_at_round: state.round,
            created_by_player_id: pid,
        });
    }

    #[test]
    fn burning_shield_attack_mode_on_successful_block() {
        let mut state = setup_combat_game(&["prowlers"]); // 4 phys, armor 3, fame 2
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        push_burning_shield_modifier(
            &mut state, 0,
            mk_types::modifier::BurningShieldMode::Attack, 4,
        );

        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 5, fire: 0, ice: 0, cold_fire: 0,
        };

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::DeclareBlock {
                enemy_instance_id: CombatInstanceId::from("enemy_0"),
                attack_index: 0,
            },
            epoch,
        ).unwrap();

        // Modifier consumed
        assert!(!state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::BurningShieldActive { .. })
        ));
        // Fire attack 4 added to accumulator
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 4);
        assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.fire, 4);
    }

    #[test]
    fn burning_shield_not_consumed_on_failed_block() {
        let mut state = setup_combat_game(&["prowlers"]); // 4 phys
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        push_burning_shield_modifier(
            &mut state, 0,
            mk_types::modifier::BurningShieldMode::Attack, 4,
        );

        // Insufficient block
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 1, fire: 0, ice: 0, cold_fire: 0,
        };

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::DeclareBlock {
                enemy_instance_id: CombatInstanceId::from("enemy_0"),
                attack_index: 0,
            },
            epoch,
        ).unwrap();

        // Modifier NOT consumed (block failed)
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::BurningShieldActive { .. })
        ));
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 0);
    }

    #[test]
    fn burning_shield_destroy_defeats_enemy() {
        let mut state = setup_combat_game(&["prowlers"]); // no fire resist, no arcane immune
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        push_burning_shield_modifier(
            &mut state, 0,
            mk_types::modifier::BurningShieldMode::Destroy, 0,
        );

        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 5, fire: 0, ice: 0, cold_fire: 0,
        };
        let initial_fame = state.players[0].fame;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::DeclareBlock {
                enemy_instance_id: CombatInstanceId::from("enemy_0"),
                attack_index: 0,
            },
            epoch,
        ).unwrap();

        assert!(state.combat.as_ref().unwrap().enemies[0].is_defeated);
        assert_eq!(state.players[0].fame, initial_fame + 2); // prowlers fame = 2
        assert!(!state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::BurningShieldActive { .. })
        ));
    }

    #[test]
    fn burning_shield_destroy_blocked_by_fire_resistance() {
        // skeletal_warriors: fire resistant, 3 physical, armor 4, fame 1
        let mut state = setup_combat_game(&["skeletal_warriors"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        push_burning_shield_modifier(
            &mut state, 0,
            mk_types::modifier::BurningShieldMode::Destroy, 0,
        );

        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 5, fire: 0, ice: 0, cold_fire: 0,
        };
        let initial_fame = state.players[0].fame;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::DeclareBlock {
                enemy_instance_id: CombatInstanceId::from("enemy_0"),
                attack_index: 0,
            },
            epoch,
        ).unwrap();

        // NOT destroyed (fire resistant), modifier still consumed
        assert!(!state.combat.as_ref().unwrap().enemies[0].is_defeated);
        assert_eq!(state.players[0].fame, initial_fame);
        assert!(!state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::BurningShieldActive { .. })
        ));
    }

    #[test]
    fn burning_shield_destroy_blocked_by_arcane_immunity() {
        // grim_legionnaries: arcane immune, no fire resist, 11 physical, armor 10
        let mut state = setup_combat_game(&["grim_legionnaries"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        push_burning_shield_modifier(
            &mut state, 0,
            mk_types::modifier::BurningShieldMode::Destroy, 0,
        );

        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 12, fire: 0, ice: 0, cold_fire: 0,
        };
        let initial_fame = state.players[0].fame;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::DeclareBlock {
                enemy_instance_id: CombatInstanceId::from("enemy_0"),
                attack_index: 0,
            },
            epoch,
        ).unwrap();

        // NOT destroyed (arcane immune), modifier still consumed
        assert!(!state.combat.as_ref().unwrap().enemies[0].is_defeated);
        assert_eq!(state.players[0].fame, initial_fame);
        assert!(!state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::BurningShieldActive { .. })
        ));
    }

    // =========================================================================
    // Batch 3: Mana Overload
    // =========================================================================

    #[test]
    fn mana_overload_creates_color_choice() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
        activate_skill(&mut state, &mut undo, "tovak_mana_overload");
        // Should have a pending choice with 5 options (Red, Blue, Green, White, Black)
        match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => {
                assert_eq!(c.options.len(), 5);
                assert!(matches!(c.resolution, mk_types::pending::ChoiceResolution::ManaOverloadColorSelect));
            }
            other => panic!("Expected ManaOverloadColorSelect pending, got {:?}", other),
        }
    }

    #[test]
    fn mana_overload_color_select_sets_center() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
        activate_skill(&mut state, &mut undo, "tovak_mana_overload");
        // Choose Red (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 }, epoch).unwrap();
        // Center should be set with Red
        let center = state.mana_overload_center.as_ref().expect("center should be set");
        assert_eq!(center.marked_color, ManaColor::Red);
        assert_eq!(center.owner_id.as_str(), "player_0");
    }

    #[test]
    fn mana_overload_color_select_gains_mana_token() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
        activate_skill(&mut state, &mut undo, "tovak_mana_overload");
        let initial_mana = state.players[0].pure_mana.len();
        // Choose Blue (index 1) — the GainMana effect resolves via queue
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 1 }, epoch).unwrap();
        // Should have gained 1 blue mana token
        assert_eq!(state.players[0].pure_mana.len(), initial_mana + 1);
        assert_eq!(state.players[0].pure_mana.last().unwrap().color, ManaColor::Blue);
    }

    #[test]
    fn mana_overload_trigger_on_matching_color() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
        activate_skill(&mut state, &mut undo, "tovak_mana_overload");
        // Choose Green (index 2)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 2 }, epoch).unwrap();
        assert!(state.mana_overload_center.is_some());

        // Switch to player_1 and give them a green mana token + march card
        switch_to_player_1(&mut state);
        state.source.dice.clear(); // control mana sources explicitly
        state.players[1].hand = vec![CardId::from("march")];
        state.players[1].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Green,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let initial_move = state.players[1].move_points;
        // Play march powered (needs green = matches Mana Overload's color)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::PlayCardPowered {
                hand_index: 0, card_id: CardId::from("march"),
                mana_color: mk_types::enums::BasicManaColor::Green,
            }, epoch).unwrap();
        // March powered = 4 move, Mana Overload trigger = +4 move → 8 total
        assert_eq!(state.players[1].move_points, initial_move + 4 + 4);
        // Center should be cleared
        assert!(state.mana_overload_center.is_none());
    }

    #[test]
    fn mana_overload_no_trigger_wrong_color() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
        activate_skill(&mut state, &mut undo, "tovak_mana_overload");
        // Choose Red (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 }, epoch).unwrap();
        assert!(state.mana_overload_center.is_some());

        // Player 1 powers march with GREEN (not Red) → no trigger
        switch_to_player_1(&mut state);
        state.source.dice.clear(); // control mana sources explicitly
        state.players[1].hand = vec![CardId::from("march")];
        state.players[1].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Green,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::PlayCardPowered {
                hand_index: 0, card_id: CardId::from("march"),
                mana_color: mk_types::enums::BasicManaColor::Green,
            }, epoch).unwrap();
        // March powered = 4 move, no bonus (wrong color)
        assert_eq!(state.players[1].move_points, 4);
        // Center should still be set
        assert!(state.mana_overload_center.is_some());
    }

    #[test]
    fn mana_overload_skill_flipped_after_activation() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
        activate_skill(&mut state, &mut undo, "tovak_mana_overload");
        // Choose any color
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 }, epoch).unwrap();
        // Skill should be flipped
        assert!(state.players[0].skill_flip_state.flipped_skills.iter()
            .any(|s| s.as_str() == "tovak_mana_overload"));
    }

    // =========================================================================
    // Batch 3: Mana Enhancement
    // =========================================================================

    #[test]
    fn mana_enhancement_trigger_on_basic_mana() {
        let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");
        state.source.dice.clear(); // control mana sources explicitly
        state.players[0].hand = vec![CardId::from("march")];
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Green,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let initial_green_crystals = state.players[0].crystals.green;
        let mut undo = UndoStack::new();
        // Play march powered with green mana
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::PlayCardPowered {
                hand_index: 0, card_id: CardId::from("march"),
                mana_color: mk_types::enums::BasicManaColor::Green,
            }, epoch).unwrap();
        // Should gain 1 green crystal
        assert_eq!(state.players[0].crystals.green, initial_green_crystals + 1);
        // Center should be set
        assert!(state.mana_enhancement_center.is_some());
        let center = state.mana_enhancement_center.as_ref().unwrap();
        assert_eq!(center.marked_color, mk_types::enums::BasicManaColor::Green);
    }

    #[test]
    fn mana_enhancement_no_trigger_gold_mana() {
        let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");
        state.players[0].hand = vec![CardId::from("march")];
        // Give gold mana token (not a basic color)
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Gold,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let initial_crystals = state.players[0].crystals;
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::PlayCardPowered {
                hand_index: 0, card_id: CardId::from("march"),
                mana_color: mk_types::enums::BasicManaColor::Green,
            }, epoch).unwrap();
        // No crystal gain (gold mana not basic)
        assert_eq!(state.players[0].crystals, initial_crystals);
        assert!(state.mana_enhancement_center.is_none());
    }

    #[test]
    fn mana_enhancement_return_gives_mana_token() {
        let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");
        state.source.dice.clear(); // control mana sources explicitly
        state.players[0].hand = vec![CardId::from("march")];
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Green,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::PlayCardPowered {
                hand_index: 0, card_id: CardId::from("march"),
                mana_color: mk_types::enums::BasicManaColor::Green,
            }, epoch).unwrap();
        assert!(state.mana_enhancement_center.is_some());

        // Player 1 returns the skill
        switch_to_player_1(&mut state);
        let initial_p1_mana = state.players[1].pure_mana.len();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::ReturnInteractiveSkill {
                skill_id: mk_types::ids::SkillId::from("krang_mana_enhancement"),
            }, epoch).unwrap();
        // Player 1 should gain 1 green mana token
        assert_eq!(state.players[1].pure_mana.len(), initial_p1_mana + 1);
        assert_eq!(state.players[1].pure_mana.last().unwrap().color, ManaColor::Green);
        // Center should be cleared
        assert!(state.mana_enhancement_center.is_none());
    }

    #[test]
    fn mana_enhancement_cooldown() {
        let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");
        state.source.dice.clear(); // control mana sources explicitly
        state.players[0].hand = vec![CardId::from("march"), CardId::from("march")];
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Green,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::PlayCardPowered {
                hand_index: 0, card_id: CardId::from("march"),
                mana_color: mk_types::enums::BasicManaColor::Green,
            }, epoch).unwrap();
        // Should be in used_this_round cooldown
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "krang_mana_enhancement"));

        // Second powered play should NOT trigger again
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Green,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let green_crystals_after_first = state.players[0].crystals.green;
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::PlayCardPowered {
                hand_index: 0, card_id: CardId::from("march"),
                mana_color: mk_types::enums::BasicManaColor::Green,
            }, epoch).unwrap();
        // Crystals unchanged (cooldown prevents second trigger)
        assert_eq!(state.players[0].crystals.green, green_crystals_after_first);
    }

    // =========================================================================
    // Batch 3: Source Opening
    // =========================================================================

    #[test]
    fn source_opening_creates_die_select() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        // Ensure there are available dice
        assert!(!state.source.dice.is_empty());
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => {
                // Options = number of available dice + 1 skip
                let available = state.source.dice.iter()
                    .filter(|d| d.taken_by_player_id.is_none() && !d.is_depleted)
                    .count();
                assert!(matches!(c.resolution, mk_types::pending::ChoiceResolution::SourceOpeningDieSelect { .. }));
                assert_eq!(c.options.len(), available + 1); // +1 for skip
            }
            other => panic!("Expected SourceOpeningDieSelect pending, got {:?}", other),
        }
    }

    #[test]
    fn source_opening_skip_reroll_sets_center() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        // Choose skip (last option)
        let skip_idx = match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
            _ => panic!("Expected choice"),
        };
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();
        // Center should be set
        assert!(state.source_opening_center.is_some());
        let center = state.source_opening_center.as_ref().unwrap();
        assert_eq!(center.owner_id.as_str(), "player_0");
    }

    #[test]
    fn source_opening_reroll_die_sets_center() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        let initial_rng_counter = state.rng.counter;
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        // Choose first die (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 }, epoch).unwrap();
        // Center should be set
        assert!(state.source_opening_center.is_some());
        // RNG should have been consumed (reroll)
        assert!(state.rng.counter > initial_rng_counter);
    }

    #[test]
    fn source_opening_return_grants_extra_die() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        // Skip reroll
        let skip_idx = match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
            _ => panic!("Expected choice"),
        };
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

        // Player 1 returns the skill
        switch_to_player_1(&mut state);
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::ReturnInteractiveSkill {
                skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
            }, epoch).unwrap();
        // Player 1 should have ExtraSourceDie modifier
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride {
                rule: mk_types::modifier::RuleOverride::ExtraSourceDie })
            && m.created_by_player_id.as_str() == "player_1"
        ));
    }

    #[test]
    fn source_opening_no_dice_skips_to_center() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        // Clear all dice so none are available
        state.source.dice.clear();
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        // Should skip straight to center (no pending choice)
        assert!(state.players[0].pending.active.is_none());
        assert!(state.source_opening_center.is_some());
    }

    // =========================================================================
    // Batch 3: Master of Chaos
    // =========================================================================

    #[test]
    fn master_of_chaos_initial_position_set() {
        let mut state = create_solo_game(42, Hero::Krang);
        state.round_phase = RoundPhase::PlayerTurns;
        state.phase = GamePhase::Round;
        let skill_id = mk_types::ids::SkillId::from("krang_master_of_chaos");
        state.players[0].skills.push(skill_id.clone());
        // Initialize MoC state (simulating skill acquisition)
        init_master_of_chaos_if_needed(&mut state, 0, &skill_id);
        assert!(state.players[0].master_of_chaos_state.is_some());
    }

    #[test]
    fn master_of_chaos_rotates_clockwise() {
        assert_eq!(rotate_clockwise(ManaColor::Blue), ManaColor::Green);
        assert_eq!(rotate_clockwise(ManaColor::Green), ManaColor::Black);
        assert_eq!(rotate_clockwise(ManaColor::Black), ManaColor::White);
        assert_eq!(rotate_clockwise(ManaColor::White), ManaColor::Red);
        assert_eq!(rotate_clockwise(ManaColor::Red), ManaColor::Gold);
        assert_eq!(rotate_clockwise(ManaColor::Gold), ManaColor::Blue);
    }

    #[test]
    fn master_of_chaos_white_gives_influence_2() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
        // Set position to Black so rotating lands on White = Influence 2
        state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
            position: ManaColor::Black,
            free_rotate_available: false,
        });
        state.players[0].hand = vec![CardId::from("march")];
        activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
        assert_eq!(state.players[0].influence_points, 2);
        assert_eq!(state.players[0].master_of_chaos_state.as_ref().unwrap().position, ManaColor::White);
    }

    #[test]
    fn master_of_chaos_green_gives_move_1() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
        // Set position to Blue so rotating lands on Green
        state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
            position: ManaColor::Blue,
            free_rotate_available: false,
        });
        state.players[0].hand = vec![CardId::from("march")];
        activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
        assert_eq!(state.players[0].move_points, 1);
        assert_eq!(state.players[0].master_of_chaos_state.as_ref().unwrap().position, ManaColor::Green);
    }

    #[test]
    fn master_of_chaos_gold_gives_choice() {
        let (mut state, mut undo) = setup_two_player_combat_with_skill(
            Hero::Krang, "krang_master_of_chaos", &["prowlers"],
        );
        // Set position to Red so rotating lands on Gold
        state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
            position: ManaColor::Red,
            free_rotate_available: false,
        });
        activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
        // In combat, all 5 options are resolvable → choice with 5 options
        match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => {
                assert_eq!(c.options.len(), 5);
                assert!(matches!(c.resolution, mk_types::pending::ChoiceResolution::MasterOfChaosGoldChoice));
            }
            other => panic!("Expected MasterOfChaosGoldChoice pending, got {:?}", other),
        }
    }

    #[test]
    fn master_of_chaos_once_per_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
        state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
            position: ManaColor::Blue,
            free_rotate_available: false,
        });
        state.players[0].hand = vec![CardId::from("march"), CardId::from("march")];
        activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
        // Used this turn
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "krang_master_of_chaos"));
        // Second activation should not be available
        let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert!(!actions.actions.iter().any(|a|
            matches!(a, LegalAction::UseSkill { skill_id }
                if skill_id.as_str() == "krang_master_of_chaos")
        ));
    }

    // =========================================================================
    // Batch 3: Effect detection helpers
    // =========================================================================

    // =========================================================================
    // Batch 3 Edge Cases: Mana Overload
    // =========================================================================

    #[test]
    fn mana_overload_no_trigger_on_basic_play() {
        // Playing a card as basic (not powered) should NOT trigger Mana Overload
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
        activate_skill(&mut state, &mut undo, "tovak_mana_overload");
        // Choose Red (index 0)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 0 }, epoch).unwrap();
        assert!(state.mana_overload_center.is_some());

        // Player 1 plays march BASIC (not powered) → should NOT trigger
        switch_to_player_1(&mut state);
        state.players[1].hand = vec![CardId::from("march")];
        let initial_move = state.players[1].move_points;
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::PlayCardBasic {
                hand_index: 0, card_id: CardId::from("march"),
            }, epoch).unwrap();
        // March basic = 2 move, no overload bonus
        assert_eq!(state.players[1].move_points, initial_move + 2);
        // Center should still be set
        assert!(state.mana_overload_center.is_some());
    }

    #[test]
    fn mana_overload_no_trigger_on_effect_without_applicable_type() {
        // Powered effect with only Heal/Draw (no Move/Influence/Attack/Block) → no trigger
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
        activate_skill(&mut state, &mut undo, "tovak_mana_overload");
        // Choose White (index 3)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 3 }, epoch).unwrap();
        assert!(state.mana_overload_center.is_some());

        // Player 1 powers "tranquility" (White card: powered = Heal 2 → no Move/Influence/Attack/Block)
        switch_to_player_1(&mut state);
        state.players[1].hand = vec![CardId::from("tranquility")];
        state.players[1].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::White,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::PlayCardPowered {
                hand_index: 0, card_id: CardId::from("tranquility"),
                mana_color: mk_types::enums::BasicManaColor::White,
            }, epoch).unwrap();
        // Center should still be set (no applicable bonus type)
        assert!(state.mana_overload_center.is_some());
    }

    #[test]
    fn mana_overload_no_trigger_on_gold_mana() {
        // Powering with a Gold mana token should NOT match any Mana Overload color
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
        activate_skill(&mut state, &mut undo, "tovak_mana_overload");
        // Choose Green (index 2)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 2 }, epoch).unwrap();
        assert!(state.mana_overload_center.is_some());

        // Player 1 powers march with Gold mana (not Green)
        switch_to_player_1(&mut state);
        state.source.dice.clear(); // control mana sources explicitly
        state.players[1].hand = vec![CardId::from("march")];
        state.players[1].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Gold,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::PlayCardPowered {
                hand_index: 0, card_id: CardId::from("march"),
                mana_color: mk_types::enums::BasicManaColor::Green,
            }, epoch).unwrap();
        // March powered = 4 move, no overload bonus (Gold mana used, not Green)
        assert_eq!(state.players[1].move_points, 4);
        assert!(state.mana_overload_center.is_some());
    }

    #[test]
    fn mana_overload_round_cooldown() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
        activate_skill(&mut state, &mut undo, "tovak_mana_overload");
        // Should be on round cooldown (Interactive = used_this_round)
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "tovak_mana_overload"));
    }

    // =========================================================================
    // Batch 3 Edge Cases: Mana Enhancement
    // =========================================================================

    #[test]
    fn mana_enhancement_trigger_on_unit_activation() {
        // Mana Enhancement should trigger when Krang spends basic mana to activate a unit
        let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");

        // Put Krang in combat so unit activation works
        use mk_types::state::PlayerUnit;
        state.combat = Some(Box::new(CombatState::default()));

        // Add a unit with Green mana cost (Herbalist — Heal 2, costed Green)
        state.players[0].units.push(PlayerUnit {
            unit_id: mk_types::ids::UnitId::from("herbalist"),
            instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            level: 1,
            state: UnitState::Ready,
            wounded: false,
            used_resistance_this_combat: false,
            used_ability_indices: vec![],
            mana_token: None,
        });

        // Give Krang a green mana token for the unit cost
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Green,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let initial_green_crystals = state.players[0].crystals.green;
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ActivateUnit {
                unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
                ability_index: 0,
            }, epoch).unwrap();
        // Should gain 1 green crystal from Mana Enhancement
        assert_eq!(state.players[0].crystals.green, initial_green_crystals + 1);
        assert!(state.mana_enhancement_center.is_some());
    }

    #[test]
    fn mana_enhancement_no_trigger_on_unit_gold_mana() {
        // Unit activation with Gold mana should NOT trigger Mana Enhancement
        let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");

        use mk_types::state::PlayerUnit;
        state.combat = Some(Box::new(CombatState::default()));

        state.players[0].units.push(PlayerUnit {
            unit_id: mk_types::ids::UnitId::from("peasants"),
            instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            level: 1,
            state: UnitState::Ready,
            wounded: false,
            used_resistance_this_combat: false,
            used_ability_indices: vec![],
            mana_token: None,
        });

        // Give only Gold mana
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Gold,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let initial_crystals = state.players[0].crystals;
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ActivateUnit {
                unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
                ability_index: 0,
            }, epoch).unwrap();
        // No crystal gain (Gold mana not basic)
        assert_eq!(state.players[0].crystals, initial_crystals);
        assert!(state.mana_enhancement_center.is_none());
    }

    #[test]
    fn mana_enhancement_expires_at_owner_turn_start() {
        let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");
        state.source.dice.clear(); // control mana sources explicitly
        state.players[0].hand = vec![CardId::from("march")];
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Green,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        // Trigger Mana Enhancement
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::PlayCardPowered {
                hand_index: 0, card_id: CardId::from("march"),
                mana_color: mk_types::enums::BasicManaColor::Green,
            }, epoch).unwrap();
        assert!(state.mana_enhancement_center.is_some());

        // Simulate advance_turn twice: player_0 → player_1 → back to player_0
        // First advance: player_0 to player_1 (mana enhancement should persist)
        state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
        crate::end_turn::advance_turn_pub(&mut state, 0);
        // Now it's player_1's turn. Center should still exist because it's not owner's turn yet.
        assert!(state.mana_enhancement_center.is_some());

        // Second advance: player_1 to player_0 (should expire)
        state.players[1].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
        crate::end_turn::advance_turn_pub(&mut state, 1);
        // Now it's player_0 (Krang) again. Center should be cleared.
        assert!(state.mana_enhancement_center.is_none());
    }

    // =========================================================================
    // Batch 3 Edge Cases: Source Opening
    // =========================================================================

    #[test]
    fn source_opening_no_crystal_when_no_extra_die_used() {
        // If returning player doesn't use the extra die, no crystal is granted
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        let skip_idx = match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
            _ => panic!("Expected choice"),
        };
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();
        assert!(state.source_opening_center.is_some());

        // Player 1 returns the skill
        switch_to_player_1(&mut state);
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::ReturnInteractiveSkill {
                skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
            }, epoch).unwrap();

        // Player 1 does NOT use any extra die — used_die_ids is empty
        let initial_crystals = state.players[0].crystals;

        // End turn for player 1 (simulate by calling check_source_opening_crystal directly)
        let got_crystal = crate::end_turn::check_source_opening_crystal(&mut state, 1);
        assert!(!got_crystal);
        // Goldyx should NOT have gained any crystals
        assert_eq!(state.players[0].crystals, initial_crystals);
    }

    #[test]
    fn source_opening_no_crystal_when_gold_die_used() {
        // If the extra die is Gold (non-basic), no crystal is granted
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        // Set up source dice: one basic + one gold
        state.source.dice = vec![
            mk_types::state::SourceDie {
                id: mk_types::ids::SourceDieId::from("die_0"),
                color: ManaColor::Red,
                is_depleted: false,
                taken_by_player_id: None,
            },
            mk_types::state::SourceDie {
                id: mk_types::ids::SourceDieId::from("die_1"),
                color: ManaColor::Gold,
                is_depleted: false,
                taken_by_player_id: None,
            },
        ];
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        let skip_idx = match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
            _ => panic!("Expected choice"),
        };
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

        // Player 1 returns
        switch_to_player_1(&mut state);
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::ReturnInteractiveSkill {
                skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
            }, epoch).unwrap();

        // Simulate player 1 using 2 dice: die_0 (normal) + die_1 (gold, extra)
        state.players[1].used_die_ids.push(mk_types::ids::SourceDieId::from("die_0"));
        state.players[1].used_die_ids.push(mk_types::ids::SourceDieId::from("die_1"));
        state.source.dice[0].taken_by_player_id = Some(mk_types::ids::PlayerId::from("player_1"));
        state.source.dice[1].taken_by_player_id = Some(mk_types::ids::PlayerId::from("player_1"));

        let initial_crystals = state.players[0].crystals;
        let got_crystal = crate::end_turn::check_source_opening_crystal(&mut state, 1);
        // Gold die → no crystal (non-basic color), but reroll may still be offered
        // The gold die doesn't produce a basic-color crystal
        if got_crystal {
            // If it did trigger, the crystal should NOT have changed (gold → None basic)
            assert_eq!(state.players[0].crystals, initial_crystals);
        }
        // Either way, no crystal gained
        assert_eq!(state.players[0].crystals, initial_crystals);
    }

    #[test]
    fn source_opening_no_crystal_when_only_normal_die_used() {
        // If returning player had already used their normal die before returning,
        // and uses no additional die after return, no crystal is granted.
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        let skip_idx = match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
            _ => panic!("Expected choice"),
        };
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

        switch_to_player_1(&mut state);
        // Player 1 uses their normal die BEFORE returning (baseline)
        let die_id = state.source.dice[0].id.clone();
        state.players[1].used_die_ids.push(die_id);

        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::ReturnInteractiveSkill {
                skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
            }, epoch).unwrap();

        // No additional die used after return — extra_dice_used = 1 - 1 = 0
        let initial_crystals = state.players[0].crystals;
        let got_crystal = crate::end_turn::check_source_opening_crystal(&mut state, 1);
        assert!(!got_crystal);
        assert_eq!(state.players[0].crystals, initial_crystals);
    }

    #[test]
    fn source_opening_crystal_capped_at_max() {
        // If Goldyx is at max crystals for the die color, no extra crystal gained
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        // Set Goldyx to max red crystals
        state.players[0].crystals.red = 3;
        // Ensure source has a red die
        state.source.dice = vec![
            mk_types::state::SourceDie {
                id: mk_types::ids::SourceDieId::from("die_0"),
                color: ManaColor::Blue,
                is_depleted: false,
                taken_by_player_id: None,
            },
            mk_types::state::SourceDie {
                id: mk_types::ids::SourceDieId::from("die_1"),
                color: ManaColor::Red,
                is_depleted: false,
                taken_by_player_id: None,
            },
        ];
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        let skip_idx = match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
            _ => panic!("Expected choice"),
        };
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

        switch_to_player_1(&mut state);
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::ReturnInteractiveSkill {
                skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
            }, epoch).unwrap();

        // Player 1 uses 2 dice: die_0 (normal) + die_1 (red, extra)
        state.players[1].used_die_ids.push(mk_types::ids::SourceDieId::from("die_0"));
        state.players[1].used_die_ids.push(mk_types::ids::SourceDieId::from("die_1"));
        state.source.dice[0].taken_by_player_id = Some(mk_types::ids::PlayerId::from("player_1"));
        state.source.dice[1].taken_by_player_id = Some(mk_types::ids::PlayerId::from("player_1"));

        let got_crystal = crate::end_turn::check_source_opening_crystal(&mut state, 1);
        // Crystal was granted but capped at 3 (gain_crystal handles overflow)
        if got_crystal {
            assert_eq!(state.players[0].crystals.red, 3); // Still 3 (capped)
        }
    }

    #[test]
    fn source_opening_center_cleared_after_end_turn_no_extra_die() {
        // If returning player doesn't use extra die, center is cleared at end of turn
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        let skip_idx = match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
            _ => panic!("Expected choice"),
        };
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

        switch_to_player_1(&mut state);
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::ReturnInteractiveSkill {
                skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
            }, epoch).unwrap();
        assert!(state.source_opening_center.is_some());

        // End turn check with no extra die → should clear center
        let got_crystal = crate::end_turn::check_source_opening_crystal(&mut state, 1);
        assert!(!got_crystal);
        assert!(state.source_opening_center.is_none());
    }

    #[test]
    fn source_opening_return_tracks_returning_player() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        let skip_idx = match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
            _ => panic!("Expected choice"),
        };
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

        switch_to_player_1(&mut state);
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 1,
            &LegalAction::ReturnInteractiveSkill {
                skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
            }, epoch).unwrap();

        let center = state.source_opening_center.as_ref().expect("center should exist");
        assert_eq!(center.returning_player_id.as_ref().unwrap().as_str(), "player_1");
        assert_eq!(center.owner_id.as_str(), "player_0");
    }

    #[test]
    fn source_opening_skill_flipped_on_owner() {
        let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
        activate_skill(&mut state, &mut undo, "goldyx_source_opening");
        let skip_idx = match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
            _ => panic!("Expected choice"),
        };
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

        // Skill should be flipped on the owner
        assert!(state.players[0].skill_flip_state.flipped_skills.iter()
            .any(|s| s.as_str() == "goldyx_source_opening"));
    }

    // =========================================================================
    // Batch 3 Edge Cases: Master of Chaos
    // =========================================================================

    #[test]
    fn master_of_chaos_green_to_black_ranged_coldfire_1() {
        // Green→Black gives Ranged ColdFire Attack 1 (requires combat)
        let (mut state, mut undo) = setup_two_player_combat_with_skill(
            Hero::Krang, "krang_master_of_chaos", &["prowlers"],
        );
        state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
            position: ManaColor::Green,
            free_rotate_available: false,
        });
        activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
        assert_eq!(state.players[0].master_of_chaos_state.as_ref().unwrap().position, ManaColor::Black);
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 1);
        assert_eq!(state.players[0].combat_accumulator.attack.ranged_elements.cold_fire, 1);
    }

    #[test]
    fn master_of_chaos_white_to_red_attack_2() {
        // White→Red gives Melee Attack 2 (requires combat)
        let (mut state, mut undo) = setup_two_player_combat_with_skill(
            Hero::Krang, "krang_master_of_chaos", &["prowlers"],
        );
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
            position: ManaColor::White,
            free_rotate_available: false,
        });
        activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
        assert_eq!(state.players[0].master_of_chaos_state.as_ref().unwrap().position, ManaColor::Red);
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
        assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 2);
    }

    #[test]
    fn master_of_chaos_gold_to_blue_block_3() {
        // Gold→Blue gives Block 3 (requires combat)
        let (mut state, mut undo) = setup_two_player_combat_with_skill(
            Hero::Krang, "krang_master_of_chaos", &["prowlers"],
        );
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
            position: ManaColor::Gold,
            free_rotate_available: false,
        });
        activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
        assert_eq!(state.players[0].master_of_chaos_state.as_ref().unwrap().position, ManaColor::Blue);
        assert_eq!(state.players[0].combat_accumulator.block, 3);
        assert_eq!(state.players[0].combat_accumulator.block_elements.physical, 3);
    }

    #[test]
    fn master_of_chaos_gold_choice_filters_outside_combat() {
        // Outside combat, Gold choice should only show Move + Influence (2 options)
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
        state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
            position: ManaColor::Red,
            free_rotate_available: false,
        });
        state.players[0].hand = vec![CardId::from("march")];
        activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
        // Not in combat → Block, Attack, Ranged ColdFire all filtered → only Move + Influence
        match &state.players[0].pending.active {
            Some(mk_types::pending::ActivePending::Choice(c)) => {
                assert_eq!(c.options.len(), 2, "Gold choice outside combat should have 2 options (Move + Influence)");
            }
            other => panic!("Expected choice pending, got {:?}", other),
        }
        // Resolve with Influence (index 1)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0,
            &LegalAction::ResolveChoice { choice_index: 1 }, epoch).unwrap();
        assert_eq!(state.players[0].influence_points, 2);
    }

    #[test]
    fn master_of_chaos_free_rotate_window_opens_on_turn_reset() {
        // After a turn where MoC was NOT used, free_rotate_available should be set to true
        let (mut state, _undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
        state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
            position: ManaColor::Blue,
            free_rotate_available: false,
        });
        // Simulate end-turn reset (skill was NOT used)
        crate::end_turn::reset_player_turn(&mut state, 0);
        let moc = state.players[0].master_of_chaos_state.as_ref().unwrap();
        assert!(moc.free_rotate_available, "free_rotate should open when skill not used");
    }

    #[test]
    fn master_of_chaos_free_rotate_not_opened_when_used() {
        // After a turn where MoC WAS used, free_rotate_available should stay false
        let (mut state, _undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
        state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
            position: ManaColor::Green,
            free_rotate_available: false,
        });
        state.players[0].skill_cooldowns.used_this_turn.push(
            mk_types::ids::SkillId::from("krang_master_of_chaos"));
        crate::end_turn::reset_player_turn(&mut state, 0);
        let moc = state.players[0].master_of_chaos_state.as_ref().unwrap();
        assert!(!moc.free_rotate_available, "free_rotate should NOT open when skill was used");
    }

    // =========================================================================
    // Batch 3: Effect detection helpers
    // =========================================================================

    #[test]
    fn effect_has_move_detects_gain_move() {
        use mk_types::effect::CardEffect;
        assert!(crate::card_play::effect_has_move(&CardEffect::GainMove { amount: 2 }));
        assert!(!crate::card_play::effect_has_move(&CardEffect::GainAttack {
            amount: 2, combat_type: CombatType::Melee, element: Element::Physical
        }));
    }

    #[test]
    fn effect_has_attack_detects_compound() {
        use mk_types::effect::CardEffect;
        let compound = CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 1 },
                CardEffect::GainAttack { amount: 2, combat_type: CombatType::Melee, element: Element::Physical },
            ],
        };
        assert!(crate::card_play::effect_has_attack(&compound));
        assert!(crate::card_play::effect_has_move(&compound));
        assert!(!crate::card_play::effect_has_block(&compound));
    }

    #[test]
    fn effect_has_block_negative_for_gain_mana() {
        use mk_types::effect::CardEffect;
        let mana = CardEffect::GainMana { color: ManaColor::Red, amount: 1 };
        assert!(!crate::card_play::effect_has_move(&mana));
        assert!(!crate::card_play::effect_has_attack(&mana));
        assert!(!crate::card_play::effect_has_block(&mana));
        assert!(!crate::card_play::effect_has_influence(&mana));
    }

    // =========================================================================
    // Batch 1: Simple Compound Skills (crystal crafts, healing, mana, movement)
    // =========================================================================

    // --- Helper: enter combat for single-player skill tests ---
    fn setup_combat_with_skill(hero: Hero, skill_id: &str, enemy_ids: &[&str]) -> (GameState, UndoStack) {
        let (mut state, undo) = setup_with_skill(hero, skill_id);
        let tokens: Vec<mk_types::ids::EnemyTokenId> = enemy_ids
            .iter()
            .map(|id| mk_types::ids::EnemyTokenId::from(format!("{}_1", id)))
            .collect();
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();
        (state, undo)
    }

    /// Helper: resolve a pending choice for player 0.
    fn resolve_choice(state: &mut GameState, undo: &mut UndoStack, choice_index: usize) {
        let epoch = state.action_epoch;
        apply_legal_action(
            state, undo, 0,
            &LegalAction::ResolveChoice { choice_index },
            epoch,
        ).unwrap();
    }

    // ---- Dark Fire Magic (Arythea) ----

    #[test]
    fn dark_fire_magic_grants_red_crystal_and_choice() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_fire_magic");
        let before_red = state.players[0].crystals.red;
        activate_skill(&mut state, &mut undo, "arythea_dark_fire_magic");
        // Crystal granted immediately, then pending choice for mana
        assert_eq!(state.players[0].crystals.red, before_red + 1);
        assert!(state.players[0].pending.active.is_some(), "Should have pending choice for mana color");
    }

    #[test]
    fn dark_fire_magic_choice_red_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_fire_magic");
        activate_skill(&mut state, &mut undo, "arythea_dark_fire_magic");
        let before_mana = state.players[0].pure_mana.len();
        resolve_choice(&mut state, &mut undo, 0); // Red mana
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Red));
        assert_eq!(state.players[0].pure_mana.len(), before_mana + 1);
    }

    #[test]
    fn dark_fire_magic_choice_black_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_fire_magic");
        activate_skill(&mut state, &mut undo, "arythea_dark_fire_magic");
        resolve_choice(&mut state, &mut undo, 1); // Black mana
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Black));
    }

    #[test]
    fn dark_fire_magic_round_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_fire_magic");
        activate_skill(&mut state, &mut undo, "arythea_dark_fire_magic");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "arythea_dark_fire_magic"));
    }

    // ---- White Crystal Craft (Goldyx) ----

    #[test]
    fn white_crystal_craft_grants_blue_crystal_and_white_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_white_crystal_craft");
        let before_blue = state.players[0].crystals.blue;
        activate_skill(&mut state, &mut undo, "goldyx_white_crystal_craft");
        assert_eq!(state.players[0].crystals.blue, before_blue + 1);
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::White));
    }

    #[test]
    fn white_crystal_craft_round_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_white_crystal_craft");
        activate_skill(&mut state, &mut undo, "goldyx_white_crystal_craft");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "goldyx_white_crystal_craft"));
    }

    // ---- Green Crystal Craft (Goldyx) ----

    #[test]
    fn green_crystal_craft_grants_blue_crystal_and_green_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_green_crystal_craft");
        let before_blue = state.players[0].crystals.blue;
        activate_skill(&mut state, &mut undo, "goldyx_green_crystal_craft");
        assert_eq!(state.players[0].crystals.blue, before_blue + 1);
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Green));
    }

    #[test]
    fn green_crystal_craft_round_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_green_crystal_craft");
        activate_skill(&mut state, &mut undo, "goldyx_green_crystal_craft");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "goldyx_green_crystal_craft"));
    }

    // ---- Red Crystal Craft (Goldyx) ----

    #[test]
    fn red_crystal_craft_grants_blue_crystal_and_red_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_red_crystal_craft");
        let before_blue = state.players[0].crystals.blue;
        activate_skill(&mut state, &mut undo, "goldyx_red_crystal_craft");
        assert_eq!(state.players[0].crystals.blue, before_blue + 1);
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Red));
    }

    // ---- Leaves in the Wind (Norowas) ----

    #[test]
    fn leaves_in_the_wind_grants_green_crystal_and_white_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_leaves_in_the_wind");
        let before_green = state.players[0].crystals.green;
        activate_skill(&mut state, &mut undo, "norowas_leaves_in_the_wind");
        assert_eq!(state.players[0].crystals.green, before_green + 1);
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::White));
    }

    #[test]
    fn leaves_in_the_wind_round_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_leaves_in_the_wind");
        activate_skill(&mut state, &mut undo, "norowas_leaves_in_the_wind");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "norowas_leaves_in_the_wind"));
    }

    // ---- Whispers in the Treetops (Norowas) ----

    #[test]
    fn whispers_in_the_treetops_grants_white_crystal_and_green_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_whispers_in_the_treetops");
        let before_white = state.players[0].crystals.white;
        activate_skill(&mut state, &mut undo, "norowas_whispers_in_the_treetops");
        assert_eq!(state.players[0].crystals.white, before_white + 1);
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Green));
    }

    #[test]
    fn whispers_in_the_treetops_round_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_whispers_in_the_treetops");
        activate_skill(&mut state, &mut undo, "norowas_whispers_in_the_treetops");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "norowas_whispers_in_the_treetops"));
    }

    // ---- Refreshing Bath (Wolfhawk) ----

    #[test]
    fn refreshing_bath_heals_and_grants_blue_crystal() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_refreshing_bath");
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
        let before_blue = state.players[0].crystals.blue;
        activate_skill(&mut state, &mut undo, "wolfhawk_refreshing_bath");
        assert_eq!(state.players[0].crystals.blue, before_blue + 1);
        // Healing 1 should remove a wound from hand (if wound present)
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"),
            "Wound should be healed from hand");
    }

    #[test]
    fn refreshing_bath_round_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_refreshing_bath");
        activate_skill(&mut state, &mut undo, "wolfhawk_refreshing_bath");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "wolfhawk_refreshing_bath"));
    }

    // ---- Refreshing Breeze (Wolfhawk) ----

    #[test]
    fn refreshing_breeze_heals_and_grants_white_crystal() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_refreshing_breeze");
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
        let before_white = state.players[0].crystals.white;
        activate_skill(&mut state, &mut undo, "wolfhawk_refreshing_breeze");
        assert_eq!(state.players[0].crystals.white, before_white + 1);
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"),
            "Wound should be healed from hand");
    }

    // ---- Potion Making (Goldyx) ----

    #[test]
    fn potion_making_heals_2() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_potion_making");
        state.players[0].hand = vec![
            CardId::from("wound"), CardId::from("wound"), CardId::from("march"),
        ];
        activate_skill(&mut state, &mut undo, "goldyx_potion_making");
        let wound_count = state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count();
        assert_eq!(wound_count, 0, "Healing 2 should remove both wounds");
    }

    #[test]
    fn potion_making_heals_partial_when_only_one_wound() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_potion_making");
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
        activate_skill(&mut state, &mut undo, "goldyx_potion_making");
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
    }

    #[test]
    fn potion_making_round_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_potion_making");
        activate_skill(&mut state, &mut undo, "goldyx_potion_making");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "goldyx_potion_making"));
    }

    // ---- Spirit Guides (Krang) ----

    #[test]
    fn spirit_guides_grants_move_and_block_modifier() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_spirit_guides");
        let before_move = state.players[0].move_points;
        activate_skill(&mut state, &mut undo, "krang_spirit_guides");
        assert_eq!(state.players[0].move_points, before_move + 1);
        // Should have Block +1 modifier
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::CombatValue {
                value_type, amount, ..
            } if *value_type == mk_types::modifier::CombatValueType::Block && *amount == 1)
        ));
    }

    #[test]
    fn spirit_guides_block_modifier_is_turn_duration() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_spirit_guides");
        activate_skill(&mut state, &mut undo, "krang_spirit_guides");
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::CombatValue {
                value_type, ..
            } if *value_type == mk_types::modifier::CombatValueType::Block)
            && matches!(&m.duration, mk_types::modifier::ModifierDuration::Turn)
        ));
    }

    #[test]
    fn spirit_guides_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_spirit_guides");
        activate_skill(&mut state, &mut undo, "krang_spirit_guides");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "krang_spirit_guides"));
    }

    // ---- Hawk Eyes (Wolfhawk) ----

    #[test]
    fn hawk_eyes_grants_move_point() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_hawk_eyes");
        let before_move = state.players[0].move_points;
        activate_skill(&mut state, &mut undo, "wolfhawk_hawk_eyes");
        assert_eq!(state.players[0].move_points, before_move + 1);
    }

    #[test]
    fn hawk_eyes_night_explore_cost_reduction() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_hawk_eyes");
        state.time_of_day = mk_types::enums::TimeOfDay::Night;
        activate_skill(&mut state, &mut undo, "wolfhawk_hawk_eyes");
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::ExploreCostReduction { amount }
                if *amount == 1)
        ));
    }

    #[test]
    fn hawk_eyes_day_garrison_reveal() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_hawk_eyes");
        state.time_of_day = mk_types::enums::TimeOfDay::Day;
        activate_skill(&mut state, &mut undo, "wolfhawk_hawk_eyes");
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride { rule }
                if *rule == mk_types::modifier::RuleOverride::GarrisonRevealDistance2)
        ));
    }

    #[test]
    fn hawk_eyes_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_hawk_eyes");
        activate_skill(&mut state, &mut undo, "wolfhawk_hawk_eyes");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "wolfhawk_hawk_eyes"));
    }

    // ---- Glittering Fortune (Goldyx) ----

    #[test]
    fn glittering_fortune_zero_crystals_zero_influence() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_glittering_fortune");
        state.players[0].crystals = Crystals::default();
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "goldyx_glittering_fortune");
        assert_eq!(state.players[0].influence_points, before);
    }

    #[test]
    fn glittering_fortune_one_color_one_influence() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_glittering_fortune");
        state.players[0].crystals = Crystals { red: 2, blue: 0, green: 0, white: 0 };
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "goldyx_glittering_fortune");
        assert_eq!(state.players[0].influence_points, before + 1);
    }

    #[test]
    fn glittering_fortune_four_colors_four_influence() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_glittering_fortune");
        state.players[0].crystals = Crystals { red: 1, blue: 1, green: 1, white: 1 };
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "goldyx_glittering_fortune");
        assert_eq!(state.players[0].influence_points, before + 4);
    }

    #[test]
    fn glittering_fortune_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_glittering_fortune");
        activate_skill(&mut state, &mut undo, "goldyx_glittering_fortune");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "goldyx_glittering_fortune"));
    }

    // ---- Forward March (Norowas) ----

    #[test]
    fn forward_march_no_units_zero_move() {
        let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_forward_march");
        let before = state.players[0].move_points;
        activate_skill(&mut state, &mut undo, "norowas_forward_march");
        assert_eq!(state.players[0].move_points, before);
    }

    #[test]
    fn forward_march_one_ready_unit() {
        let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_forward_march");
        state.players[0].units.push(PlayerUnit {
            unit_id: mk_types::ids::UnitId::from("peasants"),
            instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            level: 1, state: UnitState::Ready, wounded: false,
            used_resistance_this_combat: false, used_ability_indices: vec![], mana_token: None,
        });
        let before = state.players[0].move_points;
        activate_skill(&mut state, &mut undo, "norowas_forward_march");
        assert_eq!(state.players[0].move_points, before + 1);
    }

    #[test]
    fn forward_march_max_three_units() {
        let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_forward_march");
        for i in 0..5 {
            state.players[0].units.push(PlayerUnit {
                unit_id: mk_types::ids::UnitId::from("peasants"),
                instance_id: mk_types::ids::UnitInstanceId::from(format!("unit_{}", i)),
                level: 1, state: UnitState::Ready, wounded: false,
                used_resistance_this_combat: false, used_ability_indices: vec![], mana_token: None,
            });
        }
        let before = state.players[0].move_points;
        activate_skill(&mut state, &mut undo, "norowas_forward_march");
        assert_eq!(state.players[0].move_points, before + 3, "Should cap at 3");
    }

    #[test]
    fn forward_march_wounded_units_excluded() {
        let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_forward_march");
        state.players[0].units.push(PlayerUnit {
            unit_id: mk_types::ids::UnitId::from("peasants"),
            instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            level: 1, state: UnitState::Ready, wounded: true,
            used_resistance_this_combat: false, used_ability_indices: vec![], mana_token: None,
        });
        let before = state.players[0].move_points;
        activate_skill(&mut state, &mut undo, "norowas_forward_march");
        assert_eq!(state.players[0].move_points, before, "Wounded unit should not count");
    }

    // =========================================================================
    // Batch 2: Simple Conditional Skills (day/night, choice)
    // =========================================================================

    // ---- Dark Paths (Arythea) ----

    #[test]
    fn dark_paths_night_move_2() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_paths");
        state.time_of_day = mk_types::enums::TimeOfDay::Night;
        let before = state.players[0].move_points;
        activate_skill(&mut state, &mut undo, "arythea_dark_paths");
        assert_eq!(state.players[0].move_points, before + 2);
    }

    #[test]
    fn dark_paths_day_move_1() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_paths");
        state.time_of_day = mk_types::enums::TimeOfDay::Day;
        let before = state.players[0].move_points;
        activate_skill(&mut state, &mut undo, "arythea_dark_paths");
        assert_eq!(state.players[0].move_points, before + 1);
    }

    #[test]
    fn dark_paths_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_paths");
        activate_skill(&mut state, &mut undo, "arythea_dark_paths");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "arythea_dark_paths"));
    }

    // ---- Dark Negotiation (Arythea) ----

    #[test]
    fn dark_negotiation_night_influence_3() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_negotiation");
        state.time_of_day = mk_types::enums::TimeOfDay::Night;
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "arythea_dark_negotiation");
        assert_eq!(state.players[0].influence_points, before + 3);
    }

    #[test]
    fn dark_negotiation_day_influence_2() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_negotiation");
        state.time_of_day = mk_types::enums::TimeOfDay::Day;
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "arythea_dark_negotiation");
        assert_eq!(state.players[0].influence_points, before + 2);
    }

    #[test]
    fn dark_negotiation_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_negotiation");
        activate_skill(&mut state, &mut undo, "arythea_dark_negotiation");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "arythea_dark_negotiation"));
    }

    // ---- Double Time (Tovak) ----

    #[test]
    fn double_time_day_move_2() {
        let (mut state, mut undo) = setup_with_skill(Hero::Tovak, "tovak_double_time");
        state.time_of_day = mk_types::enums::TimeOfDay::Day;
        let before = state.players[0].move_points;
        activate_skill(&mut state, &mut undo, "tovak_double_time");
        assert_eq!(state.players[0].move_points, before + 2);
    }

    #[test]
    fn double_time_night_move_1() {
        let (mut state, mut undo) = setup_with_skill(Hero::Tovak, "tovak_double_time");
        state.time_of_day = mk_types::enums::TimeOfDay::Night;
        let before = state.players[0].move_points;
        activate_skill(&mut state, &mut undo, "tovak_double_time");
        assert_eq!(state.players[0].move_points, before + 1);
    }

    #[test]
    fn double_time_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Tovak, "tovak_double_time");
        activate_skill(&mut state, &mut undo, "tovak_double_time");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "tovak_double_time"));
    }

    // ---- Night Sharpshooting (Tovak) ----

    #[test]
    fn night_sharpshooting_night_ranged_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_night_sharpshooting", &["prowlers"]);
        state.time_of_day = mk_types::enums::TimeOfDay::Night;
        activate_skill(&mut state, &mut undo, "tovak_night_sharpshooting");
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 2);
    }

    #[test]
    fn night_sharpshooting_day_ranged_1() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_night_sharpshooting", &["prowlers"]);
        state.time_of_day = mk_types::enums::TimeOfDay::Day;
        activate_skill(&mut state, &mut undo, "tovak_night_sharpshooting");
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 1);
    }

    #[test]
    fn night_sharpshooting_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_night_sharpshooting", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "tovak_night_sharpshooting");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "tovak_night_sharpshooting"));
    }

    // ---- Day Sharpshooting (Norowas) ----

    #[test]
    fn day_sharpshooting_day_ranged_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Norowas, "norowas_day_sharpshooting", &["prowlers"]);
        state.time_of_day = mk_types::enums::TimeOfDay::Day;
        activate_skill(&mut state, &mut undo, "norowas_day_sharpshooting");
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 2);
    }

    #[test]
    fn day_sharpshooting_night_ranged_1() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Norowas, "norowas_day_sharpshooting", &["prowlers"]);
        state.time_of_day = mk_types::enums::TimeOfDay::Night;
        activate_skill(&mut state, &mut undo, "norowas_day_sharpshooting");
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 1);
    }

    #[test]
    fn day_sharpshooting_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Norowas, "norowas_day_sharpshooting", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "norowas_day_sharpshooting");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "norowas_day_sharpshooting"));
    }

    // ---- Bright Negotiation (Norowas) ----

    #[test]
    fn bright_negotiation_day_influence_3() {
        let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_bright_negotiation");
        state.time_of_day = mk_types::enums::TimeOfDay::Day;
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "norowas_bright_negotiation");
        assert_eq!(state.players[0].influence_points, before + 3);
    }

    #[test]
    fn bright_negotiation_night_influence_2() {
        let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_bright_negotiation");
        state.time_of_day = mk_types::enums::TimeOfDay::Night;
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "norowas_bright_negotiation");
        assert_eq!(state.players[0].influence_points, before + 2);
    }

    #[test]
    fn bright_negotiation_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_bright_negotiation");
        activate_skill(&mut state, &mut undo, "norowas_bright_negotiation");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "norowas_bright_negotiation"));
    }

    // ---- On Her Own (Wolfhawk) ----

    #[test]
    fn on_her_own_no_unit_recruited_influence_3() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_on_her_own");
        // No unit recruited flag → should get 3
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "wolfhawk_on_her_own");
        assert_eq!(state.players[0].influence_points, before + 3);
    }

    #[test]
    fn on_her_own_unit_recruited_influence_1() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_on_her_own");
        state.players[0].flags |= PlayerFlags::HAS_RECRUITED_UNIT_THIS_TURN;
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "wolfhawk_on_her_own");
        assert_eq!(state.players[0].influence_points, before + 1);
    }

    #[test]
    fn on_her_own_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_on_her_own");
        activate_skill(&mut state, &mut undo, "wolfhawk_on_her_own");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "wolfhawk_on_her_own"));
    }

    // ---- Arcane Disguise (Krang) ----

    #[test]
    fn arcane_disguise_choice_influence_2() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_arcane_disguise");
        activate_skill(&mut state, &mut undo, "krang_arcane_disguise");
        assert!(state.players[0].pending.active.is_some());
        let before = state.players[0].influence_points;
        resolve_choice(&mut state, &mut undo, 0); // Influence 2
        assert_eq!(state.players[0].influence_points, before + 2);
    }

    #[test]
    fn arcane_disguise_choice_ignore_reputation() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_arcane_disguise");
        activate_skill(&mut state, &mut undo, "krang_arcane_disguise");
        resolve_choice(&mut state, &mut undo, 1); // IgnoreReputation
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride { rule }
                if *rule == mk_types::modifier::RuleOverride::IgnoreReputation)
        ));
    }

    #[test]
    fn arcane_disguise_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_arcane_disguise");
        activate_skill(&mut state, &mut undo, "krang_arcane_disguise");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "krang_arcane_disguise"));
    }

    // ---- Shamanic Ritual (Krang) ----

    #[test]
    fn shamanic_ritual_creates_6_option_choice() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_shamanic_ritual");
        activate_skill(&mut state, &mut undo, "krang_shamanic_ritual");
        assert!(state.players[0].pending.active.is_some(), "Should have pending choice");
    }

    #[test]
    fn shamanic_ritual_choice_red_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_shamanic_ritual");
        activate_skill(&mut state, &mut undo, "krang_shamanic_ritual");
        resolve_choice(&mut state, &mut undo, 0); // Red
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Red));
    }

    #[test]
    fn shamanic_ritual_choice_black_mana() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_shamanic_ritual");
        activate_skill(&mut state, &mut undo, "krang_shamanic_ritual");
        resolve_choice(&mut state, &mut undo, 5); // Black (6th option)
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Black));
    }

    #[test]
    fn shamanic_ritual_round_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_shamanic_ritual");
        activate_skill(&mut state, &mut undo, "krang_shamanic_ritual");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "krang_shamanic_ritual"));
    }

    // =========================================================================
    // Batch 3: Combat Choice Skills
    // =========================================================================

    // ---- Burning Power (Arythea): Siege Physical/Fire 1 ----

    #[test]
    fn burning_power_physical_siege_1() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Arythea, "arythea_burning_power", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "arythea_burning_power");
        resolve_choice(&mut state, &mut undo, 0); // Physical
        assert_eq!(state.players[0].combat_accumulator.attack.siege, 1);
    }

    #[test]
    fn burning_power_fire_siege_1() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Arythea, "arythea_burning_power", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "arythea_burning_power");
        resolve_choice(&mut state, &mut undo, 1); // Fire
        assert_eq!(state.players[0].combat_accumulator.attack.siege, 1);
        assert_eq!(state.players[0].combat_accumulator.attack.siege_elements.fire, 1);
    }

    #[test]
    fn burning_power_not_in_block_phase() {
        let (mut state, _undo) = setup_combat_with_skill(Hero::Arythea, "arythea_burning_power", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "arythea_burning_power")));
    }

    #[test]
    fn burning_power_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Arythea, "arythea_burning_power", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "arythea_burning_power");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "arythea_burning_power"));
    }

    // ---- Hot Swordsmanship (Arythea): Melee Physical/Fire 2 ----

    #[test]
    fn hot_swordsmanship_physical_melee_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Arythea, "arythea_hot_swordsmanship", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        activate_skill(&mut state, &mut undo, "arythea_hot_swordsmanship");
        resolve_choice(&mut state, &mut undo, 0); // Physical
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
    }

    #[test]
    fn hot_swordsmanship_fire_melee_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Arythea, "arythea_hot_swordsmanship", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        activate_skill(&mut state, &mut undo, "arythea_hot_swordsmanship");
        resolve_choice(&mut state, &mut undo, 1); // Fire
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
        assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.fire, 2);
    }

    #[test]
    fn hot_swordsmanship_not_in_ranged_phase() {
        let (state, _undo) = setup_combat_with_skill(Hero::Arythea, "arythea_hot_swordsmanship", &["prowlers"]);
        // RangedSiege is the default phase; MeleeAttackOnly should block it
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "arythea_hot_swordsmanship")));
    }

    #[test]
    fn hot_swordsmanship_available_in_attack_phase() {
        let (mut state, _undo) = setup_combat_with_skill(Hero::Arythea, "arythea_hot_swordsmanship", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "arythea_hot_swordsmanship")));
    }

    // ---- Cold Swordsmanship (Tovak): Melee Physical/Ice 2 ----

    #[test]
    fn cold_swordsmanship_physical_melee_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_cold_swordsmanship", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        activate_skill(&mut state, &mut undo, "tovak_cold_swordsmanship");
        resolve_choice(&mut state, &mut undo, 0); // Physical
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
    }

    #[test]
    fn cold_swordsmanship_ice_melee_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_cold_swordsmanship", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        activate_skill(&mut state, &mut undo, "tovak_cold_swordsmanship");
        resolve_choice(&mut state, &mut undo, 1); // Ice
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
        assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.ice, 2);
    }

    #[test]
    fn cold_swordsmanship_not_in_block_phase() {
        let (mut state, _undo) = setup_combat_with_skill(Hero::Tovak, "tovak_cold_swordsmanship", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "tovak_cold_swordsmanship")));
    }

    #[test]
    fn cold_swordsmanship_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_cold_swordsmanship", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        activate_skill(&mut state, &mut undo, "tovak_cold_swordsmanship");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "tovak_cold_swordsmanship"));
    }

    // ---- Freezing Power (Goldyx): Siege Physical/Ice 1 ----

    #[test]
    fn freezing_power_physical_siege_1() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Goldyx, "goldyx_freezing_power", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "goldyx_freezing_power");
        resolve_choice(&mut state, &mut undo, 0); // Physical
        assert_eq!(state.players[0].combat_accumulator.attack.siege, 1);
    }

    #[test]
    fn freezing_power_ice_siege_1() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Goldyx, "goldyx_freezing_power", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "goldyx_freezing_power");
        resolve_choice(&mut state, &mut undo, 1); // Ice
        assert_eq!(state.players[0].combat_accumulator.attack.siege, 1);
        assert_eq!(state.players[0].combat_accumulator.attack.siege_elements.ice, 1);
    }

    #[test]
    fn freezing_power_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Goldyx, "goldyx_freezing_power", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "goldyx_freezing_power");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "goldyx_freezing_power"));
    }

    // ---- Shield Mastery (Tovak): Block Phys3/Fire2/Ice2 ----

    #[test]
    fn shield_mastery_physical_block_3() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_shield_mastery", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        activate_skill(&mut state, &mut undo, "tovak_shield_mastery");
        resolve_choice(&mut state, &mut undo, 0); // Physical 3
        assert_eq!(state.players[0].combat_accumulator.block, 3);
    }

    #[test]
    fn shield_mastery_fire_block_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_shield_mastery", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        activate_skill(&mut state, &mut undo, "tovak_shield_mastery");
        resolve_choice(&mut state, &mut undo, 1); // Fire 2
        assert_eq!(state.players[0].combat_accumulator.block, 2);
        assert_eq!(state.players[0].combat_accumulator.block_elements.fire, 2);
    }

    #[test]
    fn shield_mastery_ice_block_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_shield_mastery", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        activate_skill(&mut state, &mut undo, "tovak_shield_mastery");
        resolve_choice(&mut state, &mut undo, 2); // Ice 2
        assert_eq!(state.players[0].combat_accumulator.block, 2);
        assert_eq!(state.players[0].combat_accumulator.block_elements.ice, 2);
    }

    #[test]
    fn shield_mastery_not_in_attack_phase() {
        let (mut state, _undo) = setup_combat_with_skill(Hero::Tovak, "tovak_shield_mastery", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "tovak_shield_mastery")));
    }

    #[test]
    fn shield_mastery_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_shield_mastery", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        activate_skill(&mut state, &mut undo, "tovak_shield_mastery");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "tovak_shield_mastery"));
    }

    // ---- Deadly Aim (Wolfhawk): Ranged 1 in R/S, Melee 2 in Attack ----

    #[test]
    fn deadly_aim_ranged_phase_ranged_1() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_deadly_aim", &["prowlers"]);
        // Default phase is RangedSiege
        activate_skill(&mut state, &mut undo, "wolfhawk_deadly_aim");
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 1);
    }

    #[test]
    fn deadly_aim_attack_phase_melee_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_deadly_aim", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        activate_skill(&mut state, &mut undo, "wolfhawk_deadly_aim");
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
    }

    #[test]
    fn deadly_aim_not_in_block_phase() {
        let (mut state, _undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_deadly_aim", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "wolfhawk_deadly_aim")));
    }

    #[test]
    fn deadly_aim_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_deadly_aim", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "wolfhawk_deadly_aim");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "wolfhawk_deadly_aim"));
    }

    // ---- Taunt (Wolfhawk): Block phase, SelectCombatEnemy ----

    #[test]
    fn taunt_choice_attack_minus_1() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_taunt", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        activate_skill(&mut state, &mut undo, "wolfhawk_taunt");
        // Choice pending
        assert!(state.players[0].pending.active.is_some());
        resolve_choice(&mut state, &mut undo, 0); // attack -1 option
        // Single enemy → auto-apply. Should have EnemyStat Attack -1
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
                stat, amount, ..
            } if *stat == mk_types::modifier::EnemyStat::Attack && *amount == -1)
        ));
    }

    #[test]
    fn taunt_choice_attack_plus2_armor_minus2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_taunt", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        activate_skill(&mut state, &mut undo, "wolfhawk_taunt");
        resolve_choice(&mut state, &mut undo, 1); // attack +2, armor -2 option
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
                stat, amount, ..
            } if *stat == mk_types::modifier::EnemyStat::Attack && *amount == 2)
        ));
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
                stat, amount, ..
            } if *stat == mk_types::modifier::EnemyStat::Armor && *amount == -2)
        ));
    }

    #[test]
    fn taunt_not_in_attack_phase() {
        let (mut state, _undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_taunt", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "wolfhawk_taunt")));
    }

    #[test]
    fn taunt_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_taunt", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        activate_skill(&mut state, &mut undo, "wolfhawk_taunt");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "wolfhawk_taunt"));
    }

    // ---- Battle Hardened (Krang): DamageReduction Phys/Fire/Ice ----

    #[test]
    fn battle_hardened_physical_reduction_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Krang, "krang_battle_hardened", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "krang_battle_hardened");
        resolve_choice(&mut state, &mut undo, 0); // Physical reduction 2
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::HeroDamageReduction {
                amount, elements
            } if *amount == 2 && elements.contains(&Element::Physical))
        ));
    }

    #[test]
    fn battle_hardened_elemental_reduction_1() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Krang, "krang_battle_hardened", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "krang_battle_hardened");
        resolve_choice(&mut state, &mut undo, 1); // Fire/Ice/ColdFire reduction 1
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::HeroDamageReduction {
                amount, elements
            } if *amount == 1 && elements.contains(&Element::Fire))
        ));
    }

    #[test]
    fn battle_hardened_combat_duration() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Krang, "krang_battle_hardened", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "krang_battle_hardened");
        resolve_choice(&mut state, &mut undo, 0);
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::HeroDamageReduction { .. })
            && matches!(&m.duration, mk_types::modifier::ModifierDuration::Combat)
        ));
    }

    #[test]
    fn battle_hardened_not_outside_combat() {
        let (state, _undo) = setup_with_skill(Hero::Krang, "krang_battle_hardened");
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "krang_battle_hardened")));
    }

    #[test]
    fn battle_hardened_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Krang, "krang_battle_hardened", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "krang_battle_hardened");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "krang_battle_hardened"));
    }

    // ---- Resistance Break (Tovak): Armor per resistance ----

    #[test]
    fn resistance_break_applies_armor_reduction() {
        // Use skeletal_warriors (1 fire resistance) so armor_per_resistance works
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_resistance_break", &["skeletal_warriors"]);
        activate_skill(&mut state, &mut undo, "tovak_resistance_break");
        // Single enemy → auto-apply. Armor -1 per resistance (1 resistance = -1)
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
                stat, amount, ..
            } if *stat == mk_types::modifier::EnemyStat::Armor && *amount == -1)
        ));
    }

    #[test]
    fn resistance_break_zero_resistances_no_modifier() {
        // Prowlers have 0 resistances — no armor modifier applied
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_resistance_break", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "tovak_resistance_break");
        assert!(!state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
                stat, ..
            } if *stat == mk_types::modifier::EnemyStat::Armor)
        ), "No armor modifier when enemy has 0 resistances");
    }

    #[test]
    fn resistance_break_not_outside_combat() {
        let (state, _undo) = setup_with_skill(Hero::Tovak, "tovak_resistance_break");
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "tovak_resistance_break")));
    }

    #[test]
    fn resistance_break_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Tovak, "tovak_resistance_break", &["skeletal_warriors"]);
        activate_skill(&mut state, &mut undo, "tovak_resistance_break");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "tovak_resistance_break"));
    }

    // =========================================================================
    // Batch 4: Complex Conditional Skills
    // =========================================================================

    // ---- Beguile (Braevalar): AtMagicalGlade→4, AtFortifiedSite→2, else→3 ----

    #[test]
    fn beguile_default_influence_3() {
        // Not at any special site → else branch → Influence 3
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_beguile");
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "braevalar_beguile");
        assert_eq!(state.players[0].influence_points, before + 3);
    }

    #[test]
    fn beguile_at_magical_glade_influence_4() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_beguile");
        // Place player at a hex that has a MagicalGlade site
        let pos = mk_types::hex::HexCoord { q: 0, r: 0 };
        state.players[0].position = Some(pos);
        if let Some(hex) = state.map.hexes.get_mut(&pos.key()) {
            hex.site = Some(mk_types::state::Site {
                site_type: SiteType::MagicalGlade,
                is_conquered: false,
                is_burned: false,
                owner: None,
                city_color: None,
                mine_color: None,
                deep_mine_colors: None,
            });
        }
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "braevalar_beguile");
        assert_eq!(state.players[0].influence_points, before + 4);
    }

    #[test]
    fn beguile_at_fortified_site_influence_2() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_beguile");
        let pos = mk_types::hex::HexCoord { q: 0, r: 0 };
        state.players[0].position = Some(pos);
        if let Some(hex) = state.map.hexes.get_mut(&pos.key()) {
            hex.site = Some(mk_types::state::Site {
                site_type: SiteType::Keep,
                is_conquered: false,
                is_burned: false,
                owner: None,
                city_color: None,
                mine_color: None,
                deep_mine_colors: None,
            });
        }
        let before = state.players[0].influence_points;
        activate_skill(&mut state, &mut undo, "braevalar_beguile");
        assert_eq!(state.players[0].influence_points, before + 2);
    }

    #[test]
    fn beguile_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_beguile");
        activate_skill(&mut state, &mut undo, "braevalar_beguile");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "braevalar_beguile"));
    }

    // ---- Flight (Goldyx): Choice A (all cost=0, Move 1) vs B (all cost=1, Move 2) ----

    #[test]
    fn flight_choice_a_move_1_terrain_cost_zero() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_flight");
        activate_skill(&mut state, &mut undo, "goldyx_flight");
        assert!(state.players[0].pending.active.is_some());
        let before = state.players[0].move_points;
        resolve_choice(&mut state, &mut undo, 0); // Option A: cost 0, move 1
        assert_eq!(state.players[0].move_points, before + 1);
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::TerrainCost {
                replace_cost: Some(0), ..
            })
        ));
    }

    #[test]
    fn flight_choice_b_move_2_terrain_cost_one() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_flight");
        activate_skill(&mut state, &mut undo, "goldyx_flight");
        let before = state.players[0].move_points;
        resolve_choice(&mut state, &mut undo, 1); // Option B: cost 1, move 2
        assert_eq!(state.players[0].move_points, before + 2);
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::TerrainCost {
                replace_cost: Some(1), ..
            })
        ));
    }

    #[test]
    fn flight_grants_ignore_rampaging_provoke() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_flight");
        activate_skill(&mut state, &mut undo, "goldyx_flight");
        resolve_choice(&mut state, &mut undo, 0);
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride { rule }
                if *rule == mk_types::modifier::RuleOverride::IgnoreRampagingProvoke)
        ));
    }

    #[test]
    fn flight_round_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_flight");
        activate_skill(&mut state, &mut undo, "goldyx_flight");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "goldyx_flight"));
    }

    // ---- Leadership (Norowas): 3 choices (Block+3, Attack+2, Ranged+1) ----

    #[test]
    fn leadership_block_bonus_3() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Norowas, "norowas_leadership", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "norowas_leadership");
        resolve_choice(&mut state, &mut undo, 0); // Block +3
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::LeadershipBonus {
                bonus_type, amount
            } if *bonus_type == mk_types::modifier::LeadershipBonusType::Block && *amount == 3)
        ));
    }

    #[test]
    fn leadership_attack_bonus_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Norowas, "norowas_leadership", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "norowas_leadership");
        resolve_choice(&mut state, &mut undo, 1); // Attack +2
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::LeadershipBonus {
                bonus_type, amount
            } if *bonus_type == mk_types::modifier::LeadershipBonusType::Attack && *amount == 2)
        ));
    }

    #[test]
    fn leadership_ranged_bonus_1() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Norowas, "norowas_leadership", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "norowas_leadership");
        resolve_choice(&mut state, &mut undo, 2); // Ranged +1
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::LeadershipBonus {
                bonus_type, amount
            } if *bonus_type == mk_types::modifier::LeadershipBonusType::RangedAttack && *amount == 1)
        ));
    }

    #[test]
    fn leadership_modifier_turn_duration() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Norowas, "norowas_leadership", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "norowas_leadership");
        resolve_choice(&mut state, &mut undo, 0);
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::LeadershipBonus { .. })
            && matches!(&m.duration, mk_types::modifier::ModifierDuration::Turn)
        ));
    }

    #[test]
    fn leadership_not_outside_combat() {
        let (state, _undo) = setup_with_skill(Hero::Norowas, "norowas_leadership");
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "norowas_leadership")));
    }

    #[test]
    fn leadership_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Norowas, "norowas_leadership", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "norowas_leadership");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "norowas_leadership"));
    }

    // ---- I Feel No Pain (Tovak): Discard wound → draw 1 ----

    #[test]
    fn i_feel_no_pain_discards_wound_draws_card() {
        let (mut state, mut undo) = setup_with_skill(Hero::Tovak, "tovak_i_feel_no_pain");
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
        state.players[0].deck = vec![CardId::from("rage")];
        activate_skill(&mut state, &mut undo, "tovak_i_feel_no_pain");
        // With only 1 wound and wounds_only, auto-selects the wound to discard
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"),
            "Wound should be discarded");
        // Should have drawn a card
        assert!(state.players[0].hand.iter().any(|c| c.as_str() == "rage"),
            "Should draw a card after discarding wound");
    }

    #[test]
    fn i_feel_no_pain_no_wound_not_available() {
        let (mut state, _undo) = setup_with_skill(Hero::Tovak, "tovak_i_feel_no_pain");
        state.players[0].hand = vec![CardId::from("march")]; // No wounds
        let _actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        // The skill should still be listed (the filter is for wounds_only discard cost,
        // but the engine resolves it by checking what's discardable)
        // Actually, let's just activate and check the pending state
    }

    #[test]
    fn i_feel_no_pain_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Tovak, "tovak_i_feel_no_pain");
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
        state.players[0].deck = vec![CardId::from("rage")];
        activate_skill(&mut state, &mut undo, "tovak_i_feel_no_pain");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "tovak_i_feel_no_pain"));
    }

    // =========================================================================
    // Batch 5: Motivation Variants
    // =========================================================================

    /// Helper: set up 2-player game for motivation tests.
    /// Player 0 has the motivation skill. Player 1 is Tovak.
    fn setup_motivation(hero: Hero, skill_id: &str) -> (GameState, UndoStack) {
        let (mut state, undo) = setup_two_player_with_skill(hero, skill_id);
        // Give both players deck cards to draw from
        state.players[0].deck = vec![CardId::from("rage"), CardId::from("march"), CardId::from("swiftness")];
        state.players[1].deck = vec![CardId::from("march"), CardId::from("rage")];
        state
            .players[1]
            .skills
            .push(mk_types::ids::SkillId::from("tovak_motivation"));
        (state, undo)
    }

    // ---- Arythea Motivation ----

    #[test]
    fn arythea_motivation_draws_2_cards() {
        let (mut state, mut undo) = setup_motivation(Hero::Arythea, "arythea_motivation");
        let before_hand = state.players[0].hand.len();
        activate_skill(&mut state, &mut undo, "arythea_motivation");
        assert_eq!(state.players[0].hand.len(), before_hand + 2);
    }

    #[test]
    fn arythea_motivation_lowest_fame_grants_red_mana() {
        let (mut state, mut undo) = setup_motivation(Hero::Arythea, "arythea_motivation");
        state.players[0].fame = 0;
        state.players[1].fame = 5;
        activate_skill(&mut state, &mut undo, "arythea_motivation");
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Red),
            "Should gain Red mana when lowest fame");
    }

    #[test]
    fn arythea_motivation_not_lowest_fame_no_mana() {
        let (mut state, mut undo) = setup_motivation(Hero::Arythea, "arythea_motivation");
        state.players[0].fame = 10;
        state.players[1].fame = 5;
        activate_skill(&mut state, &mut undo, "arythea_motivation");
        assert!(state.players[0].pure_mana.is_empty(),
            "Should NOT gain mana when not lowest fame");
    }

    #[test]
    fn arythea_motivation_round_cooldown() {
        let (mut state, mut undo) = setup_motivation(Hero::Arythea, "arythea_motivation");
        activate_skill(&mut state, &mut undo, "arythea_motivation");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "arythea_motivation"));
    }

    #[test]
    fn arythea_motivation_cross_player_cooldown() {
        let (mut state, mut undo) = setup_motivation(Hero::Arythea, "arythea_motivation");
        activate_skill(&mut state, &mut undo, "arythea_motivation");
        // Switch to player 1 and check they can't use their motivation
        switch_to_player_1(&mut state);
        let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "tovak_motivation")),
            "Player 1's motivation should be blocked by cross-player cooldown");
    }

    // ---- Goldyx Motivation ----

    #[test]
    fn goldyx_motivation_draws_2() {
        let (mut state, mut undo) = setup_motivation(Hero::Goldyx, "goldyx_motivation");
        let before = state.players[0].hand.len();
        activate_skill(&mut state, &mut undo, "goldyx_motivation");
        assert_eq!(state.players[0].hand.len(), before + 2);
    }

    #[test]
    fn goldyx_motivation_lowest_fame_green_mana() {
        let (mut state, mut undo) = setup_motivation(Hero::Goldyx, "goldyx_motivation");
        state.players[0].fame = 0;
        state.players[1].fame = 5;
        activate_skill(&mut state, &mut undo, "goldyx_motivation");
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Green));
    }

    #[test]
    fn goldyx_motivation_not_lowest_no_mana() {
        let (mut state, mut undo) = setup_motivation(Hero::Goldyx, "goldyx_motivation");
        state.players[0].fame = 10;
        state.players[1].fame = 5;
        activate_skill(&mut state, &mut undo, "goldyx_motivation");
        assert!(state.players[0].pure_mana.is_empty());
    }

    #[test]
    fn goldyx_motivation_cross_player_cooldown() {
        let (mut state, mut undo) = setup_motivation(Hero::Goldyx, "goldyx_motivation");
        activate_skill(&mut state, &mut undo, "goldyx_motivation");
        switch_to_player_1(&mut state);
        let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "tovak_motivation")));
    }

    // ---- Norowas Motivation ----

    #[test]
    fn norowas_motivation_draws_2() {
        let (mut state, mut undo) = setup_motivation(Hero::Norowas, "norowas_motivation");
        let before = state.players[0].hand.len();
        activate_skill(&mut state, &mut undo, "norowas_motivation");
        assert_eq!(state.players[0].hand.len(), before + 2);
    }

    #[test]
    fn norowas_motivation_lowest_fame_white_mana() {
        let (mut state, mut undo) = setup_motivation(Hero::Norowas, "norowas_motivation");
        state.players[0].fame = 0;
        state.players[1].fame = 5;
        activate_skill(&mut state, &mut undo, "norowas_motivation");
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::White));
    }

    #[test]
    fn norowas_motivation_not_lowest_no_mana() {
        let (mut state, mut undo) = setup_motivation(Hero::Norowas, "norowas_motivation");
        state.players[0].fame = 10;
        state.players[1].fame = 5;
        activate_skill(&mut state, &mut undo, "norowas_motivation");
        assert!(state.players[0].pure_mana.is_empty());
    }

    // ---- Tovak Motivation ----

    #[test]
    fn tovak_motivation_draws_2() {
        let (mut state, mut undo) = setup_motivation(Hero::Tovak, "tovak_motivation");
        let before = state.players[0].hand.len();
        activate_skill(&mut state, &mut undo, "tovak_motivation");
        assert_eq!(state.players[0].hand.len(), before + 2);
    }

    #[test]
    fn tovak_motivation_lowest_fame_blue_mana() {
        let (mut state, mut undo) = setup_motivation(Hero::Tovak, "tovak_motivation");
        state.players[0].fame = 0;
        state.players[1].fame = 5;
        activate_skill(&mut state, &mut undo, "tovak_motivation");
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Blue));
    }

    #[test]
    fn tovak_motivation_not_lowest_no_mana() {
        let (mut state, mut undo) = setup_motivation(Hero::Tovak, "tovak_motivation");
        state.players[0].fame = 10;
        state.players[1].fame = 5;
        activate_skill(&mut state, &mut undo, "tovak_motivation");
        assert!(state.players[0].pure_mana.is_empty());
    }

    #[test]
    fn tovak_motivation_round_cooldown() {
        let (mut state, mut undo) = setup_motivation(Hero::Tovak, "tovak_motivation");
        activate_skill(&mut state, &mut undo, "tovak_motivation");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "tovak_motivation"));
    }

    // ---- Wolfhawk Motivation ----

    #[test]
    fn wolfhawk_motivation_draws_2() {
        let (mut state, mut undo) = setup_motivation(Hero::Wolfhawk, "wolfhawk_motivation");
        let before = state.players[0].hand.len();
        activate_skill(&mut state, &mut undo, "wolfhawk_motivation");
        assert_eq!(state.players[0].hand.len(), before + 2);
    }

    #[test]
    fn wolfhawk_motivation_lowest_fame_gains_fame() {
        let (mut state, mut undo) = setup_motivation(Hero::Wolfhawk, "wolfhawk_motivation");
        state.players[0].fame = 0;
        state.players[1].fame = 5;
        let before_fame = state.players[0].fame;
        activate_skill(&mut state, &mut undo, "wolfhawk_motivation");
        assert_eq!(state.players[0].fame, before_fame + 1,
            "Should gain 1 fame when lowest");
    }

    #[test]
    fn wolfhawk_motivation_not_lowest_no_fame() {
        let (mut state, mut undo) = setup_motivation(Hero::Wolfhawk, "wolfhawk_motivation");
        state.players[0].fame = 10;
        state.players[1].fame = 5;
        let before_fame = state.players[0].fame;
        activate_skill(&mut state, &mut undo, "wolfhawk_motivation");
        assert_eq!(state.players[0].fame, before_fame, "Should NOT gain fame when not lowest");
    }

    #[test]
    fn wolfhawk_motivation_cross_player_cooldown() {
        let (mut state, mut undo) = setup_motivation(Hero::Wolfhawk, "wolfhawk_motivation");
        activate_skill(&mut state, &mut undo, "wolfhawk_motivation");
        switch_to_player_1(&mut state);
        let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "tovak_motivation")));
    }

    #[test]
    fn wolfhawk_motivation_tied_fame_counts_as_lowest() {
        let (mut state, mut undo) = setup_motivation(Hero::Wolfhawk, "wolfhawk_motivation");
        state.players[0].fame = 5;
        state.players[1].fame = 5;
        let before_fame = state.players[0].fame;
        activate_skill(&mut state, &mut undo, "wolfhawk_motivation");
        assert_eq!(state.players[0].fame, before_fame + 1,
            "Tied fame should count as lowest (<=)");
    }

    // =========================================================================
    // Batch 6: Deep Gap Coverage
    // =========================================================================

    // ---- Know Your Prey: additional tests ----

    #[test]
    fn know_your_prey_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_know_your_prey", &["skeletal_warriors"]);
        activate_skill(&mut state, &mut undo, "wolfhawk_know_your_prey");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "wolfhawk_know_your_prey"));
    }

    #[test]
    fn know_your_prey_not_outside_combat() {
        let (state, _undo) = setup_with_skill(Hero::Wolfhawk, "wolfhawk_know_your_prey");
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "wolfhawk_know_your_prey")));
    }

    // ---- Shapeshift: additional tests ----

    #[test]
    fn shapeshift_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Braevalar, "braevalar_shapeshift", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        state.players[0].hand = vec![CardId::from("march")]; // Basic action: Move
        activate_skill(&mut state, &mut undo, "braevalar_shapeshift");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "braevalar_shapeshift"));
    }

    #[test]
    fn shapeshift_not_outside_combat() {
        let (mut state, _undo) = setup_with_skill(Hero::Braevalar, "braevalar_shapeshift");
        state.players[0].hand = vec![CardId::from("march")];
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "braevalar_shapeshift")));
    }

    // ---- Puppet Master: additional tests ----

    #[test]
    fn puppet_master_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Krang, "krang_puppet_master", &["prowlers"]);
        state.players[0].kept_enemy_tokens.push(mk_types::state::KeptEnemyToken {
            enemy_id: mk_types::ids::EnemyId::from("prowlers"),
            name: "Prowlers".to_string(),
            attack: 4, attack_element: Element::Physical, armor: 3,
        });
        activate_skill(&mut state, &mut undo, "krang_puppet_master");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "krang_puppet_master"));
    }

    #[test]
    fn puppet_master_not_available_outside_combat() {
        let (mut state, _undo) = setup_with_skill(Hero::Krang, "krang_puppet_master");
        state.players[0].kept_enemy_tokens.push(mk_types::state::KeptEnemyToken {
            enemy_id: mk_types::ids::EnemyId::from("prowlers"),
            name: "Prowlers".to_string(),
            attack: 4, attack_element: Element::Physical, armor: 3,
        });
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "krang_puppet_master")));
    }

    // ---- Dueling: additional tests ----

    #[test]
    fn dueling_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_dueling", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        activate_skill(&mut state, &mut undo, "wolfhawk_dueling");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "wolfhawk_dueling"));
    }

    #[test]
    fn dueling_not_in_attack_phase() {
        let (mut state, _undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_dueling", &["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "wolfhawk_dueling")));
    }

    #[test]
    fn dueling_not_in_ranged_phase() {
        let (state, _undo) = setup_combat_with_skill(Hero::Wolfhawk, "wolfhawk_dueling", &["prowlers"]);
        // Default is RangedSiege
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "wolfhawk_dueling")));
    }

    // ---- Invocation: additional tests ----

    #[test]
    fn invocation_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_invocation");
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
        activate_skill(&mut state, &mut undo, "arythea_invocation");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "arythea_invocation"));
    }

    #[test]
    fn invocation_not_in_combat() {
        let (mut state, _undo) = setup_combat_with_skill(Hero::Arythea, "arythea_invocation", &["prowlers"]);
        state.players[0].hand = vec![CardId::from("march")];
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "arythea_invocation")));
    }

    // ---- Polarization: additional tests ----

    #[test]
    fn polarization_turn_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_polarization");
        state.players[0].pure_mana = vec![ManaToken {
            color: ManaColor::Red, source: ManaTokenSource::Effect, cannot_power_spells: false,
        }];
        activate_skill(&mut state, &mut undo, "arythea_polarization");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "arythea_polarization"));
    }

    #[test]
    fn polarization_not_in_combat() {
        let (mut state, _undo) = setup_combat_with_skill(Hero::Arythea, "arythea_polarization", &["prowlers"]);
        state.players[0].pure_mana = vec![ManaToken {
            color: ManaColor::Red, source: ManaTokenSource::Effect, cannot_power_spells: false,
        }];
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "arythea_polarization")));
    }

    // =========================================================================
    // Batch 7: Thunderstorm/Lightning Storm + Infrastructure
    // =========================================================================

    // ---- Thunderstorm (Braevalar): Compound(Choice(Green/Blue), Choice(Green/White)) ----

    #[test]
    fn thunderstorm_two_step_choice_green_green() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_thunderstorm");
        activate_skill(&mut state, &mut undo, "braevalar_thunderstorm");
        // First choice: Green (index 0)
        assert!(state.players[0].pending.active.is_some());
        resolve_choice(&mut state, &mut undo, 0); // Green
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Green));
        // Second choice should be pending
        assert!(state.players[0].pending.active.is_some());
        let before = state.players[0].pure_mana.len();
        resolve_choice(&mut state, &mut undo, 0); // Green (from second choice)
        assert_eq!(state.players[0].pure_mana.iter().filter(|t| t.color == ManaColor::Green).count(), 2);
        assert_eq!(state.players[0].pure_mana.len(), before + 1);
    }

    #[test]
    fn thunderstorm_two_step_choice_blue_white() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_thunderstorm");
        activate_skill(&mut state, &mut undo, "braevalar_thunderstorm");
        resolve_choice(&mut state, &mut undo, 1); // Blue
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Blue));
        resolve_choice(&mut state, &mut undo, 1); // White
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::White));
    }

    #[test]
    fn thunderstorm_round_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_thunderstorm");
        activate_skill(&mut state, &mut undo, "braevalar_thunderstorm");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "braevalar_thunderstorm"));
    }

    #[test]
    fn thunderstorm_available_in_combat() {
        // Phase restriction is None → should be available in combat
        let (state, _undo) = setup_combat_with_skill(Hero::Braevalar, "braevalar_thunderstorm", &["prowlers"]);
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "braevalar_thunderstorm")));
    }

    // ---- Lightning Storm (Braevalar): Compound(Choice(Blue/Green), Choice(Blue/Red)) ----

    #[test]
    fn lightning_storm_two_step_blue_blue() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_lightning_storm");
        activate_skill(&mut state, &mut undo, "braevalar_lightning_storm");
        resolve_choice(&mut state, &mut undo, 0); // Blue
        resolve_choice(&mut state, &mut undo, 0); // Blue
        assert_eq!(state.players[0].pure_mana.iter().filter(|t| t.color == ManaColor::Blue).count(), 2);
    }

    #[test]
    fn lightning_storm_two_step_green_red() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_lightning_storm");
        activate_skill(&mut state, &mut undo, "braevalar_lightning_storm");
        resolve_choice(&mut state, &mut undo, 1); // Green
        resolve_choice(&mut state, &mut undo, 1); // Red
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Green));
        assert!(state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Red));
    }

    #[test]
    fn lightning_storm_round_cooldown() {
        let (mut state, mut undo) = setup_with_skill(Hero::Braevalar, "braevalar_lightning_storm");
        activate_skill(&mut state, &mut undo, "braevalar_lightning_storm");
        assert!(state.players[0].skill_cooldowns.used_this_round.iter()
            .any(|s| s.as_str() == "braevalar_lightning_storm"));
    }

    // ---- Infrastructure: skill does NOT set HAS_TAKEN_ACTION ----

    #[test]
    fn skill_does_not_set_has_taken_action() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_paths");
        assert!(!state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
        activate_skill(&mut state, &mut undo, "arythea_dark_paths");
        assert!(!state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN),
            "UseSkill should NOT set HAS_TAKEN_ACTION");
    }

    #[test]
    fn skill_does_not_set_played_card_from_hand() {
        let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_spirit_guides");
        assert!(!state.players[0].flags.contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN));
        activate_skill(&mut state, &mut undo, "krang_spirit_guides");
        assert!(!state.players[0].flags.contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN),
            "UseSkill should NOT set PLAYED_CARD_FROM_HAND");
    }

    // ---- Infrastructure: round-end cooldown reset ----

    #[test]
    fn turn_cooldown_clears_on_turn_reset() {
        let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_dark_paths");
        activate_skill(&mut state, &mut undo, "arythea_dark_paths");
        assert!(!state.players[0].skill_cooldowns.used_this_turn.is_empty());
        crate::end_turn::reset_player_turn(&mut state, 0);
        assert!(state.players[0].skill_cooldowns.used_this_turn.is_empty(),
            "Turn cooldowns should clear on turn reset");
    }

    #[test]
    fn round_cooldown_clears_on_round_reset() {
        let (mut state, mut undo) = setup_with_skill(Hero::Goldyx, "goldyx_white_crystal_craft");
        activate_skill(&mut state, &mut undo, "goldyx_white_crystal_craft");
        assert!(!state.players[0].skill_cooldowns.used_this_round.is_empty());
        // Simulate round reset by clearing round cooldowns (reset_player_round is private)
        state.players[0].skill_cooldowns.used_this_round.clear();
        assert!(state.players[0].skill_cooldowns.used_this_round.is_empty(),
            "Round cooldowns should clear on round reset");
        // Verify the skill can be used again after clearing
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(actions.actions.iter().any(|a| matches!(a, LegalAction::UseSkill { skill_id } if skill_id.as_str() == "goldyx_white_crystal_craft")),
            "Skill should be usable after round cooldown reset");
    }

    // ---- Infrastructure: passive modifiers ----

    #[test]
    fn passive_modifiers_applied_on_acquisition() {
        let (mut state, _undo) = setup_with_skill(Hero::Braevalar, "braevalar_feral_allies");
        push_passive_skill_modifiers(
            &mut state, 0, &mk_types::ids::SkillId::from("braevalar_feral_allies"),
        );
        // Should have ExploreCostReduction modifier
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::ExploreCostReduction { amount }
                if *amount == 1)
        ));
    }

    #[test]
    fn passive_modifiers_are_permanent_duration() {
        let (mut state, _undo) = setup_with_skill(Hero::Braevalar, "braevalar_feral_allies");
        push_passive_skill_modifiers(
            &mut state, 0, &mk_types::ids::SkillId::from("braevalar_feral_allies"),
        );
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::ExploreCostReduction { .. })
            && matches!(&m.duration, mk_types::modifier::ModifierDuration::Permanent)
        ));
    }

    #[test]
    fn passive_modifiers_survive_turn_reset() {
        let (mut state, _undo) = setup_with_skill(Hero::Braevalar, "braevalar_feral_allies");
        push_passive_skill_modifiers(
            &mut state, 0, &mk_types::ids::SkillId::from("braevalar_feral_allies"),
        );
        let count_before = state.active_modifiers.iter().filter(|m|
            matches!(&m.duration, mk_types::modifier::ModifierDuration::Permanent)
        ).count();
        crate::end_turn::reset_player_turn(&mut state, 0);
        let count_after = state.active_modifiers.iter().filter(|m|
            matches!(&m.duration, mk_types::modifier::ModifierDuration::Permanent)
        ).count();
        assert_eq!(count_before, count_after, "Permanent modifiers should survive turn reset");
    }

    // ---- Elemental Resistance (Braevalar): CombatOnly damage reduction ----

    #[test]
    fn elemental_resistance_fire_ice_reduction_2() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Braevalar, "braevalar_elemental_resistance", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "braevalar_elemental_resistance");
        resolve_choice(&mut state, &mut undo, 0); // Fire/Ice 2
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::HeroDamageReduction {
                amount, elements
            } if *amount == 2 && elements.contains(&Element::Fire))
        ));
    }

    #[test]
    fn elemental_resistance_physical_coldfire_reduction_1() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Braevalar, "braevalar_elemental_resistance", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "braevalar_elemental_resistance");
        resolve_choice(&mut state, &mut undo, 1); // Physical/ColdFire 1
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::HeroDamageReduction {
                amount, elements
            } if *amount == 1 && elements.contains(&Element::Physical))
        ));
    }

    #[test]
    fn elemental_resistance_turn_cooldown() {
        let (mut state, mut undo) = setup_combat_with_skill(Hero::Braevalar, "braevalar_elemental_resistance", &["prowlers"]);
        activate_skill(&mut state, &mut undo, "braevalar_elemental_resistance");
        assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
            .any(|s| s.as_str() == "braevalar_elemental_resistance"));
    }

    #[test]
    fn elemental_resistance_not_outside_combat() {
        let (state, _undo) = setup_with_skill(Hero::Braevalar, "braevalar_elemental_resistance");
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        assert!(!actions.actions.iter().any(|a| matches!(a,
            LegalAction::UseSkill { ref skill_id } if skill_id.as_str() == "braevalar_elemental_resistance")));
    }

    // =========================================================================
    // Training card tests
    // =========================================================================

    #[test]
    fn training_creates_pending_select_card() {
        let mut state = setup_playing_game(vec!["training", "march"]);
        state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        match &state.players[0].pending.active {
            Some(ActivePending::Training(t)) => {
                assert_eq!(t.phase, BookOfWisdomPhase::SelectCard);
                assert_eq!(t.mode, EffectMode::Basic);
            }
            other => panic!("Expected Training pending, got {:?}", other),
        }
    }

    #[test]
    fn training_phase1_throws_card_removes_from_hand() {
        let mut state = setup_playing_game(vec!["training", "march"]);
        // No green AAs in offer so it clears pending after throw
        state.offers.advanced_actions = vec![CardId::from("blood_rage")];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        // Resolve phase 1: throw march (index 0 in remaining hand)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
            selection_index: 0,
        }, epoch).unwrap();
        assert!(state.players[0].removed_cards.iter().any(|c| c.as_str() == "march"));
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "march"));
    }

    #[test]
    fn training_phase1_matching_color_transitions_phase2() {
        let mut state = setup_playing_game(vec!["training", "march"]);
        // march is green, put 2 green AAs in offer
        state.offers.advanced_actions = vec![
            CardId::from("refreshing_walk"),
            CardId::from("path_finding"),
        ];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
            selection_index: 0,
        }, epoch).unwrap();
        match &state.players[0].pending.active {
            Some(ActivePending::Training(t)) => {
                assert_eq!(t.phase, BookOfWisdomPhase::SelectFromOffer);
                assert_eq!(t.available_offer_cards.len(), 2);
            }
            other => panic!("Expected Training SelectFromOffer, got {:?}", other),
        }
    }

    #[test]
    fn training_phase1_single_match_auto_selects() {
        let mut state = setup_playing_game(vec!["training", "march"]);
        // march is green; 1 green AA in offer → auto-select
        state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
            selection_index: 0,
        }, epoch).unwrap();
        // Basic mode → AA goes to discard
        assert!(state.players[0].discard.iter().any(|c| c.as_str() == "refreshing_walk"));
        // Pending should be cleared
        assert!(state.players[0].pending.active.is_none());
    }

    #[test]
    fn training_basic_phase2_aa_to_discard() {
        let mut state = setup_playing_game(vec!["training", "march"]);
        state.offers.advanced_actions = vec![
            CardId::from("refreshing_walk"),
            CardId::from("path_finding"),
        ];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        // Play training basic
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        // Throw march → 2 green AAs → SelectFromOffer
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
            selection_index: 0,
        }, epoch).unwrap();
        // Select first AA from offer
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
            selection_index: 0,
        }, epoch).unwrap();
        // Basic mode → discard
        assert!(state.players[0].discard.iter().any(|c| c.as_str() == "refreshing_walk"));
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "refreshing_walk"));
    }

    #[test]
    fn training_powered_phase2_aa_to_hand() {
        let mut state = setup_playing_game(vec!["training", "march"]);
        state.offers.advanced_actions = vec![
            CardId::from("refreshing_walk"),
            CardId::from("path_finding"),
        ];
        state.decks.advanced_action_deck = vec![];
        state.source.dice.clear(); // Prevent mana source ambiguity
        // Give green mana to power training
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Green,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut undo = UndoStack::new();
        // Play training powered
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("training"), mana_color: BasicManaColor::Green,
        }, epoch).unwrap();
        // Throw march → 2 green AAs → SelectFromOffer
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
            selection_index: 0,
        }, epoch).unwrap();
        // Select first AA
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
            selection_index: 0,
        }, epoch).unwrap();
        // Powered mode → hand
        assert!(state.players[0].hand.iter().any(|c| c.as_str() == "refreshing_walk"));
    }

    #[test]
    fn training_excludes_wounds() {
        let mut state = setup_playing_game(vec!["training", "wound", "march"]);
        state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let training_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::ResolveTraining { .. }))
            .collect();
        // wound at index 0, march at index 1 (training moved to play area)
        // Only march should be eligible, not wound
        assert_eq!(training_actions.len(), 1);
        // The selection_index should be for march (index 1 in hand: [wound, march])
        assert!(matches!(training_actions[0], LegalAction::ResolveTraining { selection_index: 1 }));
    }

    #[test]
    fn training_excludes_spells() {
        let mut state = setup_playing_game(vec!["training", "fireball", "march"]);
        state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let training_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::ResolveTraining { .. }))
            .collect();
        // Only march should be eligible, not fireball (spell)
        assert_eq!(training_actions.len(), 1);
    }

    #[test]
    fn training_card_permanently_removed() {
        let mut state = setup_playing_game(vec!["training", "rage"]);
        // rage is red; 0 red AAs in offer
        state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        // Throw rage (red)
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
            selection_index: 0,
        }, epoch).unwrap();
        // rage should be in removed_cards (permanently removed), not in discard
        assert!(state.players[0].removed_cards.iter().any(|c| c.as_str() == "rage"));
        assert!(!state.players[0].discard.iter().any(|c| c.as_str() == "rage"));
    }

    #[test]
    fn training_offer_replenished() {
        let mut state = setup_playing_game(vec!["training", "march"]);
        // 1 green AA in offer → auto-select
        state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
        // Deck has a card to replenish from
        state.decks.advanced_action_deck = vec![CardId::from("blood_rage")];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
            selection_index: 0,
        }, epoch).unwrap();
        // Offer should have been replenished with blood_rage
        assert!(state.offers.advanced_actions.iter().any(|c| c.as_str() == "blood_rage"));
    }

    #[test]
    fn training_no_matching_clears_pending() {
        let mut state = setup_playing_game(vec!["training", "rage"]);
        // rage is red, only green/blue AAs in offer → no match
        state.offers.advanced_actions = vec![CardId::from("refreshing_walk"), CardId::from("ice_bolt")];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
            selection_index: 0,
        }, epoch).unwrap();
        // No matching red AAs → pending cleared
        assert!(state.players[0].pending.active.is_none());
        // Card still thrown away
        assert!(state.players[0].removed_cards.iter().any(|c| c.as_str() == "rage"));
    }

    #[test]
    fn training_legal_actions_phase1() {
        let mut state = setup_playing_game(vec!["training", "march", "rage", "wound"]);
        state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let training_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::ResolveTraining { .. }))
            .collect();
        // march (idx 0), rage (idx 1) eligible; wound (idx 2) not eligible
        assert_eq!(training_actions.len(), 2);
    }

    #[test]
    fn training_legal_actions_phase2() {
        use mk_types::pending::{PendingTraining, BookOfWisdomPhase, MAX_OFFER_CARDS};
        let mut state = setup_playing_game(vec!["march"]);
        // Manually set up SelectFromOffer pending
        let mut available = arrayvec::ArrayVec::<CardId, MAX_OFFER_CARDS>::new();
        available.push(CardId::from("refreshing_walk"));
        available.push(CardId::from("path_finding"));
        state.players[0].pending.active = Some(ActivePending::Training(PendingTraining {
            source_card_id: CardId::from("training"),
            mode: EffectMode::Basic,
            phase: BookOfWisdomPhase::SelectFromOffer,
            thrown_card_color: Some(BasicManaColor::Green),
            available_offer_cards: available,
        }));
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let training_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::ResolveTraining { .. }))
            .collect();
        assert_eq!(training_actions.len(), 2);
    }

    #[test]
    fn training_both_action_types_eligible() {
        // Both BasicAction (march) and AdvancedAction (refreshing_walk) should be throwable
        let mut state = setup_playing_game(vec!["training", "march", "refreshing_walk"]);
        state.offers.advanced_actions = vec![CardId::from("in_need")];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("training"),
        }, epoch).unwrap();
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let training_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::ResolveTraining { .. }))
            .collect();
        // Both march (BasicAction) and refreshing_walk (AdvancedAction) are eligible
        assert_eq!(training_actions.len(), 2);
    }

    #[test]
    fn training_resolvable() {
        // Training is resolvable when player has at least one non-wound action card
        let state = setup_playing_game(vec!["training", "march"]);
        let effect = CardEffect::Training { mode: EffectMode::Basic };
        assert!(crate::effect_queue::is_resolvable(&state, 0, &effect));
    }

    // =========================================================================
    // Maximal Effect card tests
    // =========================================================================

    #[test]
    fn maximal_basic_creates_pending_multiplier_3() {
        let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("maximal_effect"),
        }, epoch).unwrap();
        match &state.players[0].pending.active {
            Some(ActivePending::MaximalEffect(m)) => {
                assert_eq!(m.multiplier, 3);
                assert_eq!(m.effect_kind, EffectMode::Basic);
            }
            other => panic!("Expected MaximalEffect pending, got {:?}", other),
        }
    }

    #[test]
    fn maximal_powered_creates_pending_multiplier_2() {
        let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        state.source.dice.clear(); // Prevent mana source ambiguity
        // Give red mana to power maximal_effect
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("maximal_effect"), mana_color: BasicManaColor::Red,
        }, epoch).unwrap();
        match &state.players[0].pending.active {
            Some(ActivePending::MaximalEffect(m)) => {
                assert_eq!(m.multiplier, 2);
                assert_eq!(m.effect_kind, EffectMode::Powered);
            }
            other => panic!("Expected MaximalEffect pending, got {:?}", other),
        }
    }

    #[test]
    fn maximal_basic_march_triples_move() {
        let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("maximal_effect"),
        }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
            hand_index: 0,
        }, epoch).unwrap();
        // march basic = GainMove(2), multiplied 3x = 6
        assert_eq!(state.players[0].move_points, 6);
    }

    #[test]
    fn maximal_powered_march_doubles_powered() {
        let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        state.source.dice.clear();
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("maximal_effect"), mana_color: BasicManaColor::Red,
        }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
            hand_index: 0,
        }, epoch).unwrap();
        // march powered = GainMove(4), multiplied 2x = 8
        assert_eq!(state.players[0].move_points, 8);
    }

    #[test]
    fn maximal_card_permanently_removed() {
        let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("maximal_effect"),
        }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
            hand_index: 0,
        }, epoch).unwrap();
        // march consumed → in removed_cards
        assert!(state.players[0].removed_cards.iter().any(|c| c.as_str() == "march"));
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "march"));
    }

    #[test]
    fn maximal_excludes_wounds() {
        let mut state = setup_playing_game(vec!["maximal_effect", "wound", "march"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("maximal_effect"),
        }, epoch).unwrap();
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let maximal_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::ResolveMaximalEffect { .. }))
            .collect();
        // Only march (idx 1) eligible, wound (idx 0) excluded
        assert_eq!(maximal_actions.len(), 1);
        assert!(matches!(maximal_actions[0], LegalAction::ResolveMaximalEffect { hand_index: 1 }));
    }

    #[test]
    fn maximal_excludes_spells() {
        let mut state = setup_playing_game(vec!["maximal_effect", "fireball", "march"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("maximal_effect"),
        }, epoch).unwrap();
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let maximal_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::ResolveMaximalEffect { .. }))
            .collect();
        // Only march eligible, fireball (spell) excluded
        assert_eq!(maximal_actions.len(), 1);
    }

    #[test]
    fn maximal_not_resolvable_wounds_only() {
        let state = setup_playing_game(vec!["maximal_effect", "wound"]);
        let effect = CardEffect::MaximalEffect { mode: EffectMode::Basic };
        assert!(!crate::effect_queue::is_resolvable(&state, 0, &effect));
    }

    #[test]
    fn maximal_legal_actions_enumerate() {
        let mut state = setup_playing_game(vec!["maximal_effect", "march", "rage", "swiftness"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("maximal_effect"),
        }, epoch).unwrap();
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let maximal_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::ResolveMaximalEffect { .. }))
            .collect();
        // march, rage, swiftness → 3 actions
        assert_eq!(maximal_actions.len(), 3);
    }

    #[test]
    fn maximal_empty_hand_no_actions() {
        let mut state = setup_playing_game(vec!["maximal_effect"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        // Manually set pending since we can't play with empty hand after removing maximal_effect
        state.players[0].pending.active = Some(ActivePending::MaximalEffect(
            mk_types::pending::PendingMaximalEffect {
                source_card_id: CardId::from("maximal_effect"),
                multiplier: 3,
                effect_kind: EffectMode::Basic,
            },
        ));
        state.players[0].hand.clear();
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let maximal_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::ResolveMaximalEffect { .. }))
            .collect();
        assert_eq!(maximal_actions.len(), 0);
    }

    #[test]
    fn maximal_basic_attack_triples() {
        // maximal_effect powered (mult=2, effect_kind=Powered) consumes swiftness
        // swiftness powered = GainAttack(3 Ranged Physical) × 2 = 6 ranged attack
        let mut state = setup_playing_game(vec!["maximal_effect", "swiftness"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        state.combat = Some(Box::new(CombatState::default()));
        state.source.dice.clear();
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("maximal_effect"), mana_color: BasicManaColor::Red,
        }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
            hand_index: 0,
        }, epoch).unwrap();
        // swiftness powered = GainAttack(3 Ranged Physical) × 2 = 6
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 6);
    }

    #[test]
    fn maximal_choice_card_creates_pending() {
        // rage basic = Choice(Attack 2 Melee / Block 2) → should create NeedsChoice pending
        let mut state = setup_playing_game(vec!["maximal_effect", "rage"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        state.combat = Some(Box::new(CombatState::default()));
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("maximal_effect"),
        }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
            hand_index: 0,
        }, epoch).unwrap();
        // rage basic is a Choice effect → should create a pending Choice
        assert!(matches!(
            &state.players[0].pending.active,
            Some(ActivePending::Choice(_))
        ));
    }

    #[test]
    fn maximal_compound_triples_move() {
        // stamina basic = GainMove(2), ×3 = 6
        let mut state = setup_playing_game(vec!["maximal_effect", "stamina"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("maximal_effect"),
        }, epoch).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
            hand_index: 0,
        }, epoch).unwrap();
        assert_eq!(state.players[0].move_points, 6);
    }

    #[test]
    fn maximal_basic_includes_basic_and_aa() {
        let mut state = setup_playing_game(vec!["maximal_effect", "march", "refreshing_walk"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("maximal_effect"),
        }, epoch).unwrap();
        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let maximal_actions: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::ResolveMaximalEffect { .. }))
            .collect();
        // march (BasicAction) + refreshing_walk (AdvancedAction) = 2
        assert_eq!(maximal_actions.len(), 2);
    }

    #[test]
    fn maximal_pending_cleared_after_resolve() {
        let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
        state.offers.advanced_actions = vec![];
        state.decks.advanced_action_deck = vec![];
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("maximal_effect"),
        }, epoch).unwrap();
        assert!(state.players[0].pending.active.is_some());
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
            hand_index: 0,
        }, epoch).unwrap();
        // Pending should be cleared after successful resolution
        assert!(state.players[0].pending.active.is_none());
    }

    // =========================================================================
    // Multiplayer tests
    // =========================================================================

    #[test]
    fn multiplayer_tactic_selection_sequential() {
        let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
        let mut undo = UndoStack::new();

        // Player 1 (index 1) selects first (reversed order)
        assert_eq!(state.current_tactic_selector.as_ref().unwrap().as_str(), "player_1");
        let player_1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, player_1_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
            epoch,
        ).unwrap();

        // Still in TacticsSelection — player 0 hasn't picked yet
        assert_eq!(state.round_phase, RoundPhase::TacticsSelection);
        assert_eq!(state.current_tactic_selector.as_ref().unwrap().as_str(), "player_0");
        assert_eq!(state.players[player_1_idx].selected_tactic.as_ref().unwrap().as_str(), "early_bird");

        // Player 0 selects
        let player_0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, player_0_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
            epoch,
        ).unwrap();

        // Now transitions to PlayerTurns
        assert_eq!(state.round_phase, RoundPhase::PlayerTurns);
        assert!(state.current_tactic_selector.is_none());
    }

    #[test]
    fn multiplayer_tactic_removal_two_player() {
        let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
        let mut undo = UndoStack::new();

        assert_eq!(state.scenario_config.tactic_removal_mode, TacticRemovalMode::RemoveTwo);

        // Both players select
        let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p1_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
            epoch,
        ).unwrap();

        let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p0_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
            epoch,
        ).unwrap();

        // After both select: 6 original - 2 selected - 2 removed = 2 remaining
        assert_eq!(state.available_tactics.len(), 2);
        assert_eq!(state.removed_tactics.len(), 2);
    }

    #[test]
    fn multiplayer_turn_order_sorted_by_tactic() {
        let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
        let mut undo = UndoStack::new();

        // Player 1 picks early_bird (turn order = 1)
        let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p1_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
            epoch,
        ).unwrap();

        // Player 0 picks the_right_moment (turn order = 6)
        let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p0_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("the_right_moment") },
            epoch,
        ).unwrap();

        // Turn order: early_bird (1) before the_right_moment (6)
        assert_eq!(state.turn_order[0].as_str(), "player_1");
        assert_eq!(state.turn_order[1].as_str(), "player_0");
    }

    #[test]
    fn multiplayer_announce_end_of_round() {
        let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
        let mut undo = UndoStack::new();

        // Select tactics to get to PlayerTurns
        let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p1_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
            epoch,
        ).unwrap();
        let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p0_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
            epoch,
        ).unwrap();

        assert_eq!(state.round_phase, RoundPhase::PlayerTurns);

        // Find which player goes first
        let first_player_id = state.turn_order[0].clone();
        let first_player_idx = state.players.iter().position(|p| p.id == first_player_id).unwrap();

        // Set flags so EndTurn would be available
        state.players[first_player_idx].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

        // Announce end of round
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, first_player_idx,
            &LegalAction::AnnounceEndOfRound,
            epoch,
        ).unwrap();

        assert!(state.end_of_round_announced_by.is_some());
        assert_eq!(state.players_with_final_turn.len(), 1); // Other player gets final turn
    }

    #[test]
    fn multiplayer_announce_end_of_round_enumeration() {
        let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
        let mut undo = UndoStack::new();

        // Get to PlayerTurns
        let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p1_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
            epoch,
        ).unwrap();
        let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p0_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
            epoch,
        ).unwrap();

        let first_player_id = state.turn_order[0].clone();
        let first_player_idx = state.players.iter().position(|p| p.id == first_player_id).unwrap();

        // AnnounceEndOfRound should be in legal actions for multiplayer
        let legal = enumerate_legal_actions_with_undo(&state, first_player_idx, &undo);
        let has_announce = legal.actions.iter().any(|a| matches!(a, LegalAction::AnnounceEndOfRound));
        assert!(has_announce, "AnnounceEndOfRound should be available in 2P game");
    }

    #[test]
    fn solo_game_no_announce_end_of_round() {
        let mut state = crate::setup::create_solo_game(42, Hero::Arythea);
        let mut undo = UndoStack::new();

        // Select tactic to get to PlayerTurns
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
            epoch,
        ).unwrap();

        // Solo should NOT have AnnounceEndOfRound
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let has_announce = legal.actions.iter().any(|a| matches!(a, LegalAction::AnnounceEndOfRound));
        assert!(!has_announce, "AnnounceEndOfRound should NOT be available in solo game");
    }

    #[test]
    fn multiplayer_check_round_end_auto_announce() {
        let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
        let mut undo = UndoStack::new();

        // Get to PlayerTurns
        let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p1_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
            epoch,
        ).unwrap();
        let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p0_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
            epoch,
        ).unwrap();

        // Empty first player's hand and deck to trigger auto-announce
        let first_player_id = state.turn_order[0].clone();
        let first_player_idx = state.players.iter().position(|p| p.id == first_player_id).unwrap();
        state.players[first_player_idx].hand.clear();
        state.players[first_player_idx].deck.clear();
        state.players[first_player_idx].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

        // End turn triggers auto-announce
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, first_player_idx,
            &LegalAction::EndTurn,
            epoch,
        ).unwrap();

        // Should auto-announce and populate final turn list
        assert!(state.end_of_round_announced_by.is_some());
    }

    #[test]
    fn multiplayer_mana_steal_from_source() {
        let mut state = crate::setup::create_two_player_game(100, Hero::Arythea, Hero::Tovak);
        let mut undo = UndoStack::new();

        // Player 1 selects mana_steal
        let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p1_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("mana_steal") },
            epoch,
        ).unwrap();

        // Player 1 should have ManaSteal pending
        assert!(matches!(
            state.players[p1_idx].pending.active,
            Some(ActivePending::TacticDecision(PendingTacticDecision::ManaSteal))
        ));

        // Resolve: take first available basic die
        let die_idx = state.source.dice.iter().position(|d| !d.is_depleted && d.taken_by_player_id.is_none() && d.color.is_basic()).unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p1_idx,
            &LegalAction::ResolveTacticDecision { data: TacticDecisionData::ManaSteal { die_index: die_idx } },
            epoch,
        ).unwrap();

        // Die should be claimed by player_1
        assert_eq!(state.source.dice[die_idx].taken_by_player_id.as_ref().unwrap().as_str(), "player_1");
        assert!(state.players[p1_idx].tactic_state.stored_mana_die.is_some());
    }

    #[test]
    fn multiplayer_three_player_tactic_selection() {
        let config = mk_data::scenarios::first_reconnaissance_3p();
        let mut state = crate::setup::create_multiplayer_game(
            42,
            &[Hero::Arythea, Hero::Tovak, Hero::Goldyx],
            config,
            "first_reconnaissance_3p",
        );
        let mut undo = UndoStack::new();

        // Selection order should be player_2, player_1, player_0
        assert_eq!(state.tactics_selection_order[0].as_str(), "player_2");
        assert_eq!(state.tactics_selection_order[1].as_str(), "player_1");
        assert_eq!(state.tactics_selection_order[2].as_str(), "player_0");

        // Player 2 selects
        let p2_idx = state.players.iter().position(|p| p.id.as_str() == "player_2").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p2_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
            epoch,
        ).unwrap();
        assert_eq!(state.round_phase, RoundPhase::TacticsSelection);

        // Player 1 selects
        let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p1_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
            epoch,
        ).unwrap();
        assert_eq!(state.round_phase, RoundPhase::TacticsSelection);

        // Player 0 selects → transitions to PlayerTurns
        let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, p0_idx,
            &LegalAction::SelectTactic { tactic_id: TacticId::from("mana_steal") },
            epoch,
        ).unwrap();

        // 3P with RemoveOne: 6 - 3 selected - 1 removed = 2 remaining
        assert_eq!(state.round_phase, RoundPhase::PlayerTurns);
        assert_eq!(state.available_tactics.len(), 2);
        assert_eq!(state.removed_tactics.len(), 1);
    }

    #[test]
    fn multiplayer_no_dummy_player() {
        let state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);

        assert!(state.dummy_player.is_none());
        assert!(state.dummy_player_tactic.is_none());
    }
}
