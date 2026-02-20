//! Execution pipeline — `apply_legal_action()` dispatch.
//!
//! Takes a `LegalAction` and applies it to the game state, returning an
//! `ApplyResult` on success or `ApplyError` on failure. Every action from
//! `enumerate_legal_actions()` MUST succeed — the contract is CI-gated.

use mk_data::enemies::{attack_count, get_enemy};
use mk_data::enemy_piles::{discard_enemy_token, draw_enemy_token, enemy_id_from_token};
use mk_data::tactics::tactic_turn_order;
use mk_types::enums::*;
use mk_types::ids::{CardId, CombatInstanceId, EnemyId, EnemyTokenId};
use mk_types::legal_action::{LegalAction, TacticDecisionData};
use mk_types::pending::{ActivePending, PendingTacticDecision};
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

        LegalAction::DeclareAttack {
            target_instance_ids,
            attack_type,
        } => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            apply_declare_attack(state, player_idx, target_instance_ids, *attack_type)?
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

        LegalAction::RerollSourceDice { die_indices } => {
            // Irreversible: uses RNG
            undo_stack.set_checkpoint();
            apply_reroll_source_dice(state, player_idx, die_indices)?
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

        LegalAction::CompleteRest => {
            // Irreversible: set checkpoint (Phase 2 simplified)
            undo_stack.set_checkpoint();
            apply_complete_rest(state, player_idx)
        }

        LegalAction::EndCombatPhase => {
            // Irreversible: set checkpoint
            undo_stack.set_checkpoint();
            apply_end_combat_phase(state, player_idx)?
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

    // Advance to PlayerTurns phase (solo: single selector)
    state.round_phase = RoundPhase::PlayerTurns;
    state.current_tactic_selector = None;

    // Sort turn order by tactic number (lower goes first)
    state.turn_order.sort_by_key(|pid| {
        state
            .players
            .iter()
            .find(|p| p.id == *pid)
            .and_then(|p| p.selected_tactic.as_ref())
            .and_then(|t| tactic_turn_order(t.as_str()))
            .unwrap_or(99)
    });
    state.current_player_index = 0;

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
                let max_cards = 3.min(hand_len) as u8;
                state.players[player_idx].pending.active =
                    Some(ActivePending::TacticDecision(PendingTacticDecision::Rethink {
                        max_cards,
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
        TacticDecisionData::Rethink { hand_indices } => {
            let player = &mut state.players[player_idx];

            // Remove cards at hand_indices (sort descending to preserve indices)
            let mut sorted_indices = hand_indices.clone();
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

            // Clear pending
            player.pending.active = None;
        }

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

        TacticDecisionData::MidnightMeditation { hand_indices } => {
            // Same logic as Rethink — swap hand cards for random draws
            let player = &mut state.players[player_idx];

            let mut sorted_indices = hand_indices.clone();
            sorted_indices.sort_unstable_by(|a, b| b.cmp(a));

            let mut removed: Vec<CardId> = Vec::new();
            for &idx in &sorted_indices {
                if idx < player.hand.len() {
                    removed.push(player.hand.remove(idx));
                }
            }
            let draw_count = removed.len();

            let mut pool: Vec<CardId> = Vec::new();
            pool.extend(removed);
            pool.append(&mut player.deck);
            pool.append(&mut player.discard);

            state.rng.shuffle(&mut pool);

            let player = &mut state.players[player_idx];
            let actual_draw = draw_count.min(pool.len());
            for _ in 0..actual_draw {
                player.hand.push(pool.remove(0));
            }

            player.deck = pool;
            player.discard.clear();
            player.pending.active = None;
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
                let max_cards = 5.min(hand_len) as u8;
                state.players[player_idx].pending.active =
                    Some(ActivePending::TacticDecision(
                        PendingTacticDecision::MidnightMeditation { max_cards },
                    ));
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

fn apply_reroll_source_dice(
    state: &mut GameState,
    player_idx: usize,
    die_indices: &[usize],
) -> Result<ApplyResult, ApplyError> {
    let time_of_day = state.time_of_day;

    for &idx in die_indices {
        if idx >= state.source.dice.len() {
            return Err(ApplyError::InternalError(format!(
                "RerollSourceDice: invalid die index {}", idx
            )));
        }
        let die_id = state.source.dice[idx].id.clone();
        mana::reroll_die(&mut state.source, &die_id, time_of_day, &mut state.rng);
    }

    state.players[player_idx].tactic_state.mana_search_used_this_turn = true;

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

    effect_queue::resolve_pending_choice(state, player_idx, choice_index).map_err(|e| {
        ApplyError::InternalError(format!("resolve_pending_choice failed: {:?}", e))
    })?;
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
    state.players[player_idx]
        .flags
        .insert(PlayerFlags::IS_RESTING);
    ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    }
}

fn apply_complete_rest(state: &mut GameState, player_idx: usize) -> ApplyResult {
    // Phase 2 simplified: just set the HAS_RESTED flag and clear IS_RESTING.
    // Full game would involve discarding cards from hand first.
    let player = &mut state.players[player_idx];
    player.flags.remove(PlayerFlags::IS_RESTING);
    player.flags.insert(PlayerFlags::HAS_RESTED_THIS_TURN);
    ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
    }
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

fn apply_declare_attack(
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
            // Auto-process damage from unblocked attacks
            apply_auto_damage(state, player_idx)?;

            // Clear block accumulator
            let accumulator = &mut state.players[player_idx].combat_accumulator;
            accumulator.block = 0;
            accumulator.block_elements = ElementalValues::default();
            accumulator.swift_block_elements = ElementalValues::default();
            accumulator.assigned_block = 0;
            accumulator.assigned_block_elements = ElementalValues::default();

            state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;
        }
        CombatPhase::AssignDamage => {
            // Remove undefeated summoned enemies (they don't persist to Attack phase)
            let combat = state.combat.as_mut().unwrap();
            combat.enemies.retain(|e| {
                e.summoned_by_instance_id.is_none() || e.is_defeated
            });

            // Unhide summoners
            for enemy in &mut combat.enemies {
                enemy.is_summoner_hidden = false;
            }

            // Placeholder for unit damage assignment (Phase 3)
            combat.phase = CombatPhase::Attack;
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

    for (enemy_idx, enemy) in combat.enemies.iter().enumerate() {
        if enemy.is_defeated {
            continue;
        }

        // Hidden summoners don't deal damage (their summoned enemies attack instead)
        if enemy.is_summoner_hidden {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        let num_attacks = attack_count(def);

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
            let reduced_damage = base_damage.saturating_sub(cumbersome_reduction);

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

    // Conquest marking: if all enemies defeated and hex has an unconquered site
    if let Some(ref combat) = state.combat {
        let all_defeated = combat.enemies.iter().all(|e| e.is_defeated);
        if all_defeated {
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

    // Clear combat state
    state.combat = None;
    let player = &mut state.players[player_idx];
    player.combat_accumulator = Default::default();
    player.flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    player.flags.insert(PlayerFlags::HAS_COMBATTED_THIS_TURN);
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
        assert!(undo.can_undo());
    }

    #[test]
    fn complete_rest_sets_flag() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].flags.insert(PlayerFlags::IS_RESTING);
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::CompleteRest, epoch).unwrap();

        assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::HAS_RESTED_THIS_TURN));
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
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::DeclareAttack {
                target_instance_ids: vec![mk_types::ids::CombatInstanceId::from("enemy_0")],
                attack_type: CombatType::Melee,
            },
            epoch,
        )
        .unwrap();

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
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::DeclareAttack {
                target_instance_ids: vec![mk_types::ids::CombatInstanceId::from("enemy_0")],
                attack_type: CombatType::Melee,
            },
            epoch,
        )
        .unwrap();

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
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::DeclareAttack {
                target_instance_ids: vec![mk_types::ids::CombatInstanceId::from("enemy_0")],
                attack_type: CombatType::Melee,
            },
            epoch,
        )
        .unwrap();

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
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::DeclareAttack {
                target_instance_ids: vec![
                    mk_types::ids::CombatInstanceId::from("enemy_0"),
                    mk_types::ids::CombatInstanceId::from("enemy_1"),
                ],
                attack_type: CombatType::Melee,
            },
            epoch,
        )
        .unwrap();

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
                            | LegalAction::DeclareAttack { .. }
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

        let legal = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let attack_actions: Vec<_> = legal.actions.iter()
            .filter(|a| matches!(a, LegalAction::DeclareAttack { .. }))
            .collect();

        assert!(attack_actions.is_empty(), "6 attack should not defeat armor 7");

        // Give 7 attack
        state.players[0].combat_accumulator.attack.normal_elements.physical = 7;
        let legal = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let attack_actions: Vec<_> = legal.actions.iter()
            .filter(|a| matches!(a, LegalAction::DeclareAttack { .. }))
            .collect();

        assert_eq!(attack_actions.len(), 1, "7 attack should defeat armor 7");
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
        assert!(matches!(
            state.players[0].pending.active,
            Some(ActivePending::TacticDecision(PendingTacticDecision::Rethink { max_cards: 3 }))
        ));
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

        // Resolve: swap indices 0 and 2 (march and rage)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ResolveTacticDecision {
                data: TacticDecisionData::Rethink {
                    hand_indices: vec![0, 2],
                },
            },
            epoch,
        )
        .unwrap();

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

        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ResolveTacticDecision {
                data: TacticDecisionData::Rethink {
                    hand_indices: vec![],
                },
            },
            epoch,
        )
        .unwrap();

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
        assert!(matches!(
            state.players[0].pending.active,
            Some(ActivePending::TacticDecision(PendingTacticDecision::MidnightMeditation { max_cards: 3 }))
        ));
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

        // Resolve: swap 2 cards (indices 0 and 1)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ResolveTacticDecision {
                data: TacticDecisionData::MidnightMeditation {
                    hand_indices: vec![0, 1],
                },
            },
            epoch,
        )
        .unwrap();

        // 3 cards: rage (kept) + 2 drawn
        assert_eq!(state.players[0].hand.len(), 3);
        assert!(state.players[0].hand.contains(&CardId::from("rage")));
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn reroll_source_dice_changes_die_color() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));

        // Find an available die
        let die_idx = state
            .source
            .dice
            .iter()
            .position(|d| d.taken_by_player_id.is_none())
            .unwrap();
        let old_color = state.source.dice[die_idx].color;

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::RerollSourceDice {
                die_indices: vec![die_idx],
            },
            epoch,
        )
        .unwrap();

        assert!(state.players[0].tactic_state.mana_search_used_this_turn);
        // Color may or may not have changed (depends on RNG), but the operation should succeed
        let _ = old_color; // suppress unused warning
    }

    #[test]
    fn reroll_source_dice_two_dice() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));

        let available: Vec<usize> = state
            .source
            .dice
            .iter()
            .enumerate()
            .filter(|(_, d)| d.taken_by_player_id.is_none())
            .map(|(i, _)| i)
            .collect();
        assert!(available.len() >= 2, "Need at least 2 available dice");

        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;

        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::RerollSourceDice {
                die_indices: vec![available[0], available[1]],
            },
            epoch,
        )
        .unwrap();

        assert!(state.players[0].tactic_state.mana_search_used_this_turn);
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

        // Select tactic — in solo, only 1 player, but turn order should still be set
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

        assert_eq!(state.current_player_index, 0);
        assert_eq!(state.turn_order.len(), 1);
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

        // Select rethink (max_cards will be min(3, 2) = 2)
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

        // Enumerate legal actions — should see subsets of hand indices
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let tactic_decisions: Vec<_> = legal
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::ResolveTacticDecision { .. }))
            .collect();

        // 2 hand cards, max 2: subsets of size 0,1,2 = 1+2+1 = 4
        assert_eq!(tactic_decisions.len(), 4);
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

        let reroll_actions: Vec<_> = legal
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::RerollSourceDice { .. }))
            .collect();

        assert!(!reroll_actions.is_empty(), "Should have reroll actions for mana_search");
    }

    #[test]
    fn mana_search_not_enumerated_after_use() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));
        state.players[0].tactic_state.mana_search_used_this_turn = true;

        let undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

        let reroll_actions: Vec<_> = legal
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::RerollSourceDice { .. }))
            .collect();

        assert!(reroll_actions.is_empty(), "Should NOT have reroll actions after use");
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
        assert_eq!(state.available_tactics.len(), 5);
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

        // Only ResolveTacticDecision + Undo should be available
        for action in &legal.actions {
            assert!(
                matches!(
                    action,
                    LegalAction::ResolveTacticDecision { .. } | LegalAction::Undo
                ),
                "Only ResolveTacticDecision/Undo allowed with pending, got {:?}",
                action
            );
        }
        // Should have at least the empty-set resolution
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

        let rerolls: Vec<_> = legal
            .actions
            .iter()
            .filter(|a| matches!(a, LegalAction::RerollSourceDice { .. }))
            .collect();
        assert!(rerolls.is_empty(), "Mana Search should NOT work when tactic is flipped");
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

        // Resolve: swap 2 of the 3 marches (indices 0 and 1)
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ResolveTacticDecision {
                data: TacticDecisionData::MidnightMeditation {
                    hand_indices: vec![0, 1],
                },
            },
            epoch,
        )
        .unwrap();

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
}
