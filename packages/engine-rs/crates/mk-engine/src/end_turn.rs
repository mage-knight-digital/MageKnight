//! End turn and round management.
//!
//! Matches the TS end turn flow in:
//! - `packages/core/src/engine/commands/endTurn/index.ts`
//! - `packages/core/src/engine/commands/endTurn/cardFlow.ts`
//! - `packages/core/src/engine/commands/endTurn/playerReset.ts`
//! - `packages/core/src/engine/commands/endTurn/turnAdvancement.ts`
//! - `packages/core/src/engine/commands/endRound/index.ts`
//! - `packages/core/src/engine/commands/endRound/playerRoundReset.ts`
//! - `packages/core/src/engine/commands/endRound/timeTransition.ts`

use arrayvec::ArrayVec;
use mk_data::levels::{get_level_from_fame, get_level_stats, is_skill_level_up};
use mk_data::tactics::get_tactics_for_time;
use mk_types::enums::*;
use mk_types::ids::*;
use mk_types::modifier::ModifierEffect;
use mk_types::pending::{
    ActivePending, DeferredPending, PendingCrystalJoyReclaim, PendingLevelUpReward,
    PendingSteadyTempoDeckPlacement, MAX_DEEP_MINE_COLORS, MAX_DRAWN_SKILLS,
};
use mk_types::state::*;

use crate::mana;
use crate::mana::return_player_dice;
use crate::setup::create_mana_source;

// =============================================================================
// End turn result
// =============================================================================

/// Result of ending a turn.
#[derive(Debug)]
pub enum EndTurnResult {
    /// Turn ended, next player's turn.
    NextPlayer { next_player_idx: usize },
    /// Turn ended, round ended, new round starting (tactics selection).
    RoundEnded { new_round: u32 },
    /// Turn ended, game is over.
    GameEnded,
    /// Level-up rewards pending — player must resolve before card draw + turn advance.
    AwaitingLevelUpRewards,
    /// End-turn artifact choice pending (Crystal Joy, Steady Tempo, Banner Protection).
    AwaitingEndTurnChoice,
}

/// Errors from end turn.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EndTurnError {
    /// Player hasn't played or discarded any card this turn (minimum turn requirement).
    MinimumTurnRequirementNotMet,
    /// Invalid player index.
    InvalidPlayerIndex,
}

// =============================================================================
// End turn — main entry point
// =============================================================================

/// End the current player's turn.
///
/// Re-entrant: uses `end_turn_step` on the player to track progress through
/// end-turn phases. When an artifact step creates a pending choice, we return
/// `AwaitingEndTurnChoice` and the handler re-calls this function after
/// resolving. Completed steps are skipped on re-entry.
///
/// Steps:
///   0 — Minimum turn requirement (only on first entry)
///   1 — Magical Glade wound + Mine/Deep Mine
///   2 — Crystal Joy reclaim (may create pending)
///   3 — Steady Tempo deck placement (may create pending)
///   4 — Banner of Protection wound removal (may create pending)
///   5+ — Automated: Mysterious Box, Crystal Mastery, Ring fame, level-ups,
///         Mountain Lore, card flow, reset, advance
pub fn end_turn(state: &mut GameState, player_idx: usize) -> Result<EndTurnResult, EndTurnError> {
    if player_idx >= state.players.len() {
        return Err(EndTurnError::InvalidPlayerIndex);
    }

    let step = state.players[player_idx].end_turn_step;

    // Step 0: Minimum turn requirement (only on first entry)
    if step == 0 {
        let player = &state.players[player_idx];
        if !player
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN)
            && !player.flags.contains(PlayerFlags::HAS_RESTED_THIS_TURN)
        {
            return Err(EndTurnError::MinimumTurnRequirementNotMet);
        }
    }

    // Step 1: Magical Glade wound + Mine/Deep Mine
    if step < 1 {
        apply_magical_glade_wound(state, player_idx);
        apply_mine_crystal(state, player_idx);
        if apply_deep_mine_choice(state, player_idx) {
            // Deep mine pending — blocks enumeration until resolved
        }
        state.players[player_idx].end_turn_step = 1;
    }

    // Step 2: Crystal Joy reclaim
    if step < 2 {
        if check_crystal_joy_reclaim(state, player_idx) {
            state.players[player_idx].end_turn_step = 2;
            return Ok(EndTurnResult::AwaitingEndTurnChoice);
        }
        state.players[player_idx].end_turn_step = 2;
    }

    // Step 3: Steady Tempo deck placement
    if step < 3 {
        if check_steady_tempo_placement(state, player_idx) {
            state.players[player_idx].end_turn_step = 3;
            return Ok(EndTurnResult::AwaitingEndTurnChoice);
        }
        state.players[player_idx].end_turn_step = 3;
    }

    // Step 4: Banner of Protection wound removal
    if step < 4 {
        if apply_banner_protection_choice(state, player_idx) {
            state.players[player_idx].end_turn_step = 4;
            return Ok(EndTurnResult::AwaitingEndTurnChoice);
        }
        state.players[player_idx].end_turn_step = 4;
    }

    // Step 5+: All automated (no pending)
    apply_mysterious_box_cleanup(state, player_idx);
    apply_crystal_mastery_return(state, player_idx);
    apply_ring_fame_bonus(state, player_idx);

    // Level-ups
    process_level_ups(state, player_idx);
    if promote_level_up_reward(state, player_idx) {
        reset_player_turn(&mut state.players[player_idx]);
        cleanup_end_turn_mana(state, player_idx);
        return Ok(EndTurnResult::AwaitingLevelUpRewards);
    }

    // Mountain Lore hand limit bonus (before card draw)
    apply_mountain_lore_bonus(state, player_idx);

    // Card flow: play area → discard, draw up to hand limit
    process_card_flow(state, player_idx);

    // Reset player turn state
    reset_player_turn(&mut state.players[player_idx]);

    // Mana/dice/modifier cleanup
    cleanup_end_turn_mana(state, player_idx);

    // Determine next player or round end
    let result = advance_turn(state, player_idx);

    Ok(result)
}

// =============================================================================
// Artifact end-turn steps
// =============================================================================

/// Crystal Joy reclaim: offer to reclaim a card from discard to hand.
/// Returns true if a pending choice was created.
fn check_crystal_joy_reclaim(state: &mut GameState, player_idx: usize) -> bool {
    let version = match state.players[player_idx].crystal_joy_reclaim_version.take() {
        Some(v) => v,
        None => return false,
    };
    state.players[player_idx].pending.active =
        Some(ActivePending::CrystalJoyReclaim(PendingCrystalJoyReclaim { version }));
    true
}

/// Steady Tempo deck placement: offer to place the card on deck.
/// Returns true if a pending choice was created.
fn check_steady_tempo_placement(state: &mut GameState, player_idx: usize) -> bool {
    let version = match state.players[player_idx].steady_tempo_version.take() {
        Some(v) => v,
        None => return false,
    };
    state.players[player_idx].pending.active = Some(
        ActivePending::SteadyTempoDeckPlacement(PendingSteadyTempoDeckPlacement { version }),
    );
    true
}

/// Banner of Protection: offer to remove wounds received this turn.
/// Returns true if a pending choice was created.
fn apply_banner_protection_choice(state: &mut GameState, player_idx: usize) -> bool {
    if !state.players[player_idx]
        .flags
        .contains(PlayerFlags::BANNER_OF_PROTECTION_ACTIVE)
    {
        return false;
    }
    let wounds = state.players[player_idx].wounds_received_this_turn;
    if wounds.hand == 0 && wounds.discard == 0 {
        return false;
    }
    state.players[player_idx].pending.active = Some(ActivePending::BannerProtectionChoice);
    true
}

/// Mysterious Box cleanup: return revealed artifact to deck, handle card fate.
fn apply_mysterious_box_cleanup(state: &mut GameState, player_idx: usize) {
    let box_state = match state.players[player_idx].mysterious_box_state.take() {
        Some(bs) => bs,
        None => return,
    };

    // Return revealed artifact to bottom of artifact deck
    state
        .decks
        .artifact_deck
        .push(box_state.revealed_artifact_id);

    // Remove any temporary banner attachment for mysterious_box
    state.players[player_idx]
        .attached_banners
        .retain(|b| b.banner_id.as_str() != "mysterious_box");

    let player = &mut state.players[player_idx];
    match box_state.used_as {
        MysteriousBoxUsage::Unused => {
            // Return mysterious_box from play_area to hand
            if let Some(idx) = player
                .play_area
                .iter()
                .position(|c| c.as_str() == "mysterious_box")
            {
                player.play_area.remove(idx);
                player.hand.push(CardId::from("mysterious_box"));
            }
        }
        MysteriousBoxUsage::Powered => {
            // Remove mysterious_box from play_area to removed_cards
            if let Some(idx) = player
                .play_area
                .iter()
                .position(|c| c.as_str() == "mysterious_box")
            {
                player.play_area.remove(idx);
                player.removed_cards.push(CardId::from("mysterious_box"));
            }
        }
        MysteriousBoxUsage::Banner => {
            // Move mysterious_box from play_area to discard
            if let Some(idx) = player
                .play_area
                .iter()
                .position(|c| c.as_str() == "mysterious_box")
            {
                player.play_area.remove(idx);
                player.discard.push(CardId::from("mysterious_box"));
            }
        }
        MysteriousBoxUsage::Basic => {
            // Basic: stays in play_area, normal card flow moves it to discard
        }
    }
}

/// Crystal Mastery return: return spent crystals if powered was active.
fn apply_crystal_mastery_return(state: &mut GameState, player_idx: usize) {
    let player = &mut state.players[player_idx];
    if !player
        .flags
        .contains(PlayerFlags::CRYSTAL_MASTERY_POWERED_ACTIVE)
    {
        return;
    }
    let spent = player.spent_crystals_this_turn;
    player.crystals.red = (player.crystals.red + spent.red).min(mana::MAX_CRYSTALS_PER_COLOR);
    player.crystals.blue = (player.crystals.blue + spent.blue).min(mana::MAX_CRYSTALS_PER_COLOR);
    player.crystals.green =
        (player.crystals.green + spent.green).min(mana::MAX_CRYSTALS_PER_COLOR);
    player.crystals.white =
        (player.crystals.white + spent.white).min(mana::MAX_CRYSTALS_PER_COLOR);
}

/// Ring artifact fame bonus: +1 fame per spell cast of the ring's color.
fn apply_ring_fame_bonus(state: &mut GameState, player_idx: usize) {
    let player_id = state.players[player_idx].id.clone();
    let mut total_fame: u32 = 0;

    for m in &state.active_modifiers {
        if m.created_by_player_id != player_id {
            continue;
        }
        if !matches!(m.duration, mk_types::modifier::ModifierDuration::Turn) {
            continue;
        }
        if let ModifierEffect::EndlessMana { ref colors } = m.effect {
            // Find the ring's color (first non-Black color)
            let ring_color = colors.iter().find(|c| **c != ManaColor::Black);
            if let Some(color) = ring_color {
                let spell_count = state.players[player_idx]
                    .spells_cast_by_color_this_turn
                    .get(color)
                    .copied()
                    .unwrap_or(0);
                total_fame += spell_count;
            }
        }
    }

    if total_fame > 0 {
        state.players[player_idx].fame += total_fame;
    }
}

/// Mountain Lore hand limit bonus: +1 on hills, +2 on mountains.
fn apply_mountain_lore_bonus(state: &mut GameState, player_idx: usize) {
    let terrain = player_hex(state, player_idx).map(|h| h.terrain);
    let terrain = match terrain {
        Some(t) => t,
        None => return,
    };

    let player_id = state.players[player_idx].id.clone();
    let mut bonus: u32 = 0;

    for m in &state.active_modifiers {
        if m.created_by_player_id != player_id {
            continue;
        }
        if let ModifierEffect::MountainLoreHandLimit {
            hills_bonus,
            mountain_bonus,
        } = m.effect
        {
            match terrain {
                Terrain::Mountain => bonus += mountain_bonus,
                Terrain::Hills => bonus += hills_bonus,
                _ => {}
            }
        }
    }

    if bonus > 0 {
        state.players[player_idx].meditation_hand_limit_bonus += bonus;
    }
}

// =============================================================================
// Level-up processing
// =============================================================================

/// Public wrapper for process_level_ups (used by movement.rs on explore fame).
pub fn process_level_ups_pub(state: &mut GameState, player_idx: usize) {
    process_level_ups(state, player_idx);
}

/// Public wrapper for process_card_flow (used by action_pipeline after level-up rewards).
pub fn process_card_flow_pub(state: &mut GameState, player_idx: usize) {
    process_card_flow(state, player_idx);
}

/// Public wrapper for advance_turn (used by action_pipeline after level-up rewards).
pub fn advance_turn_pub(state: &mut GameState, player_idx: usize) -> EndTurnResult {
    advance_turn(state, player_idx)
}

/// Process any level-ups earned by the player based on current fame.
///
/// Updates level, armor, hand_limit, and command_tokens from the level stats table.
/// For even levels (2, 4, 6, 8, 10), draws hero skills and queues level-up rewards
/// as deferred pending entries.
fn process_level_ups(state: &mut GameState, player_idx: usize) {
    let old_level = state.players[player_idx].level;
    let new_level = get_level_from_fame(state.players[player_idx].fame);

    if new_level <= old_level {
        return;
    }

    // Use the final level's stats
    let stats = get_level_stats(new_level);
    let player = &mut state.players[player_idx];
    player.level = new_level;
    player.armor = stats.armor;
    player.hand_limit = stats.hand_limit;
    player.command_tokens = stats.command_slots;

    // Queue skill choices for each even level crossed
    let mut rewards: Vec<PendingLevelUpReward> = Vec::new();
    for level in (old_level + 1)..=new_level {
        if is_skill_level_up(level) {
            // Shuffle remaining_hero_skills, draw min(2, len)
            let player = &mut state.players[player_idx];
            state.rng.shuffle(&mut player.remaining_hero_skills);
            let draw_count = player.remaining_hero_skills.len().min(MAX_DRAWN_SKILLS);
            let mut drawn: ArrayVec<SkillId, MAX_DRAWN_SKILLS> = ArrayVec::new();
            for _ in 0..draw_count {
                drawn.push(player.remaining_hero_skills.pop().unwrap());
            }
            rewards.push(PendingLevelUpReward {
                level: level as u8,
                drawn_skills: drawn,
            });
        }
    }

    // Add as deferred pending — promoted to active when end_turn flow processes them
    if !rewards.is_empty() {
        state.players[player_idx]
            .pending
            .deferred
            .push(DeferredPending::LevelUpRewards(rewards));
    }
}

/// Promote the first deferred level-up reward to active pending.
/// Returns true if a reward was promoted (caller should defer card draw).
fn promote_level_up_reward(state: &mut GameState, player_idx: usize) -> bool {
    let player = &mut state.players[player_idx];

    // Find the LevelUpRewards entry in deferred
    let deferred_idx = player
        .pending
        .deferred
        .iter()
        .position(|d| matches!(d, DeferredPending::LevelUpRewards(_)));

    let Some(idx) = deferred_idx else {
        return false;
    };

    // Extract the rewards vec
    let DeferredPending::LevelUpRewards(ref mut rewards) =
        player.pending.deferred[idx]
    else {
        return false;
    };

    if rewards.is_empty() {
        player.pending.deferred.remove(idx);
        return false;
    }

    // Pop the first reward and set as active pending
    let reward = rewards.remove(0);
    if rewards.is_empty() {
        player.pending.deferred.remove(idx);
    }

    player.pending.active = Some(ActivePending::LevelUpReward(reward));
    true
}

/// Public wrapper for promote_level_up_reward (used by action_pipeline after final reward).
pub fn promote_level_up_reward_pub(state: &mut GameState, player_idx: usize) -> bool {
    promote_level_up_reward(state, player_idx)
}

/// Mana steal cleanup, return dice, and expire turn-duration modifiers.
/// Extracted to avoid duplication between normal end-turn and level-up-reward path.
fn cleanup_end_turn_mana(state: &mut GameState, player_idx: usize) {
    // Mana Steal cleanup — return stolen die
    if let Some(stolen_die) = state.players[player_idx]
        .tactic_state
        .stored_mana_die
        .take()
    {
        mana::reroll_die(
            &mut state.source,
            &stolen_die.die_id,
            state.time_of_day,
            &mut state.rng,
        );
    }

    // Return mana dice
    return_player_dice(state, player_idx);

    // Expire turn-duration modifiers
    let player_id = state.players[player_idx].id.clone();
    crate::action_pipeline::expire_modifiers_turn_end(&mut state.active_modifiers, &player_id);
}

// =============================================================================
// Card flow
// =============================================================================

/// Move play area to discard, draw up to hand limit.
///
/// Matches TS `processCardFlow()` in `cardFlow.ts`.
/// No mid-round reshuffle — stops drawing if deck empties.
fn process_card_flow(state: &mut GameState, player_idx: usize) {
    let player = &mut state.players[player_idx];

    // Move play area → discard
    player.discard.append(&mut player.play_area);

    // Draw up to hand limit (base hand_limit from level stats)
    // Planning tactic: +1 hand limit when drawing up (if hand has ≥2 cards)
    let planning_bonus = if player.selected_tactic.as_ref().map(|t| t.as_str()) == Some("planning")
        && player.hand.len() >= 2
    {
        1
    } else {
        0
    };
    // TODO: Keep bonus (adjacent to owned keep)
    let draw_limit =
        (player.hand_limit as usize) + planning_bonus + (player.meditation_hand_limit_bonus as usize);

    while player.hand.len() < draw_limit {
        if player.deck.is_empty() {
            break; // No mid-round reshuffle
        }
        let card = player.deck.remove(0);
        player.hand.push(card);
    }
}

// =============================================================================
// Player turn reset
// =============================================================================

/// Reset all turn-specific state on a player.
///
/// Matches TS `createResetPlayer()` in `playerReset.ts`.
/// Fields that persist across turns (fame, level, crystals, skills, units, etc.)
/// are left unchanged.
fn reset_player_turn(player: &mut PlayerState) {
    player.move_points = 0;
    player.influence_points = 0;
    player.healing_points = 0;

    // Clear all turn flags (preserve non-turn flags)
    player.flags.remove(PlayerFlags::HAS_MOVED_THIS_TURN);
    player.flags.remove(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    player.flags.remove(PlayerFlags::HAS_COMBATTED_THIS_TURN);
    player
        .flags
        .remove(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    player.flags.remove(PlayerFlags::HAS_PLUNDERED_THIS_TURN);
    player
        .flags
        .remove(PlayerFlags::HAS_RECRUITED_UNIT_THIS_TURN);
    player.flags.remove(PlayerFlags::IS_RESTING);
    player.flags.remove(PlayerFlags::HAS_RESTED_THIS_TURN);
    player.flags.remove(PlayerFlags::WOUND_IMMUNITY_ACTIVE);
    player
        .flags
        .remove(PlayerFlags::BANNER_OF_PROTECTION_ACTIVE);
    player
        .flags
        .remove(PlayerFlags::CRYSTAL_MASTERY_POWERED_ACTIVE);

    // Clear mana state (crystals persist, tokens don't)
    player.pure_mana.clear();
    player.used_die_ids.clear();
    player.mana_draw_die_ids.clear();
    player.mana_used_this_turn.clear();

    // Clear combat accumulator
    player.combat_accumulator = CombatAccumulator::default();

    // Clear turn tracking
    player.enemies_defeated_this_turn = 0;
    player.wounds_healed_from_hand_this_turn = 0;
    player.units_healed_this_turn.clear();
    player.units_recruited_this_interaction.clear();
    player.spell_colors_cast_this_turn.clear();
    player.spells_cast_by_color_this_turn.clear();
    player.meditation_hand_limit_bonus = 0;
    player.wounds_received_this_turn = WoundsReceived::default();
    player.spent_crystals_this_turn = Crystals::default();

    // Clear tactic per-turn state (but preserve stored_mana_die across turns)
    player.tactic_state.mana_steal_used_this_turn = false;
    player.tactic_state.mana_search_used_this_turn = false;

    // Clear skill cooldowns (active_until_next_turn expires)
    player.skill_cooldowns.active_until_next_turn.clear();
    player.skill_cooldowns.used_this_turn.clear();

    // TODO: pendingSourceOpeningRerollChoice, pendingMeditation
    player.mysterious_box_state = None;
    player.end_turn_step = 0;
    player.crystal_joy_reclaim_version = None;
    player.steady_tempo_version = None;
}

// =============================================================================
// Turn advancement
// =============================================================================

/// Determine next player or trigger round end.
fn advance_turn(state: &mut GameState, current_player_idx: usize) -> EndTurnResult {
    // Check if round should end
    let should_end_round = check_round_end(state, current_player_idx);

    if should_end_round {
        end_round(state);
        if state.game_ended {
            return EndTurnResult::GameEnded;
        }
        return EndTurnResult::RoundEnded {
            new_round: state.round,
        };
    }

    // Final turns countdown (scenario end was triggered, e.g. city revealed)
    if state.scenario_end_triggered {
        if let Some(ref mut remaining) = state.final_turns_remaining {
            *remaining = remaining.saturating_sub(1);
            if *remaining == 0 {
                finalize_game_end(state);
                return EndTurnResult::GameEnded;
            }
        }
    }

    // Extra turn check (The Right Moment tactic)
    if state.players[current_player_idx].tactic_state.extra_turn_pending {
        state.players[current_player_idx].tactic_state.extra_turn_pending = false;
        return EndTurnResult::NextPlayer {
            next_player_idx: current_player_idx,
        };
    }

    // Advance through turn_order, auto-executing dummy player turns
    let turn_order_len = state.turn_order.len();
    let mut next_turn_idx = (state.current_player_index as usize + 1) % turn_order_len;

    // Auto-execute dummy player turns (skip over them)
    while crate::dummy_player::is_dummy_player(state.turn_order[next_turn_idx].as_str()) {
        if let Some(ref mut dummy) = state.dummy_player {
            if crate::dummy_player::execute_dummy_turn(dummy).is_none() {
                // Dummy deck exhausted → announce end of round
                state.end_of_round_announced_by =
                    Some(PlayerId::from(crate::dummy_player::DUMMY_PLAYER_ID));
                state.players_with_final_turn =
                    state.players.iter().map(|p| p.id.clone()).collect();
            }
        }
        next_turn_idx = (next_turn_idx + 1) % turn_order_len;
    }

    state.current_player_index = next_turn_idx as u32;

    // Find the player index in state.players for this turn_order entry
    let next_player_id = &state.turn_order[next_turn_idx];
    let next_player_idx = state
        .players
        .iter()
        .position(|p| &p.id == next_player_id)
        .expect("Turn order entry not found in players");

    // Expire UntilNextTurn modifiers for the next player (at their turn start)
    {
        let player_id = state.players[next_player_idx].id.clone();
        crate::action_pipeline::expire_modifiers_turn_start(
            &mut state.active_modifiers,
            &player_id,
        );
    }

    // Setup next player: Magical Glade mana
    apply_magical_glade_mana(state, next_player_idx);

    // Setup next player: Plunder decision at unconquered inhabited sites
    apply_plunder_decision(state, next_player_idx);

    // Sparing Power before-turn setup: if next player has sparing_power and hasn't flipped
    {
        let next_player = &state.players[next_player_idx];
        if next_player.selected_tactic.as_ref().map(|t| t.as_str()) == Some("sparing_power")
            && !next_player.flags.contains(PlayerFlags::TACTIC_FLIPPED)
        {
            let player = &mut state.players[next_player_idx];
            player.flags.insert(PlayerFlags::BEFORE_TURN_TACTIC_PENDING);
            player.pending.active = Some(mk_types::pending::ActivePending::TacticDecision(
                mk_types::pending::PendingTacticDecision::SparingPower,
            ));
        }
    }

    EndTurnResult::NextPlayer {
        next_player_idx,
    }
}

/// Check if the round should end after this player's turn.
///
/// In solo mode: round ends when the player's hand AND deck are both empty,
/// or when end_of_round_announced_by is set and all final turns are done.
fn check_round_end(state: &mut GameState, current_player_idx: usize) -> bool {
    let player = &state.players[current_player_idx];

    // Auto-announce if hand and deck are both empty
    if player.hand.is_empty() && player.deck.is_empty() && state.end_of_round_announced_by.is_none()
    {
        state.end_of_round_announced_by = Some(player.id.clone());
        // In solo, all players get final turns — but solo only has 1 player,
        // so the round ends immediately.
        // In multiplayer: other players get their final turns.
    }

    // If announced, check if all final turns are done
    if state.end_of_round_announced_by.is_some() {
        // In solo mode, the round ends immediately after announcement
        if state.players.len() == 1 {
            return true;
        }
        // In multiplayer: check if playersWithFinalTurn is empty
        // Remove current player from final turn list
        let player_id = state.players[current_player_idx].id.clone();
        state.players_with_final_turn.retain(|id| *id != player_id);
        if state.players_with_final_turn.is_empty() {
            return true;
        }
    }

    false
}

// =============================================================================
// Game end finalization
// =============================================================================

/// Finalize game end: set game_ended, phase, winning_player_id, final_score_result.
///
/// Uses the full scoring system (achievements, modules) from the scenario config.
fn finalize_game_end(state: &mut GameState) {
    state.game_ended = true;
    state.phase = GamePhase::End;
    state.final_turns_remaining = Some(0);

    // Calculate full scoring result
    let result = crate::scoring::calculate_final_scores(state);

    // Determine winning player from rankings
    state.winning_player_id = if result.is_tied {
        None
    } else {
        result
            .rankings
            .first()
            .map(|id| PlayerId::from(id.as_str()))
    };

    state.final_score_result = Some(result);
}

// =============================================================================
// End round
// =============================================================================

/// Process end of round: day/night toggle, mana reset, deck reshuffle, new tactics.
///
/// Matches TS `createEndRoundCommand()` in `endRound/index.ts`.
fn end_round(state: &mut GameState) {
    let reached_round_limit = state.round >= state.scenario_config.total_rounds;

    // Rulebook: "If the Round ends during [final turns], the game ends immediately."
    // This matches TS `checkGameEnd()` in `endRound/gameEnd.ts`.
    let should_end_from_final_turns = state.scenario_end_triggered
        && state.final_turns_remaining.is_some_and(|r| r > 0);

    if reached_round_limit || should_end_from_final_turns {
        finalize_game_end(state);
        return;
    }

    // 0. Capture used tactics before player reset clears them
    let mut used_tactics_this_round = Vec::new();
    if let Some(ref t) = state.dummy_player_tactic {
        used_tactics_this_round.push(t.clone());
    }
    for p in &state.players {
        if let Some(ref t) = p.selected_tactic {
            used_tactics_this_round.push(t.clone());
        }
    }

    // 1. Toggle day/night
    state.time_of_day = match state.time_of_day {
        TimeOfDay::Day => TimeOfDay::Night,
        TimeOfDay::Night => TimeOfDay::Day,
    };

    // TODO: Dawn effect — reveal face-down ruins tokens when Night → Day

    // 2. Reset mana source (reroll all dice for new time of day)
    let player_count = state.players.len() as u32;
    state.source = create_mana_source(player_count, state.time_of_day, &mut state.rng);

    // 3. Dummy offer gains (solo mode — before offer refresh)
    if let Some(ref mut dummy) = state.dummy_player {
        crate::dummy_player::process_dummy_offer_gains(
            dummy,
            &mut state.offers.advanced_actions,
            &state.offers.spells,
        );
    }

    // 4. Offer refresh
    mk_data::offers::refresh_offer(
        &mut state.offers.advanced_actions,
        &mut state.decks.advanced_action_deck,
    );
    mk_data::offers::refresh_offer(
        &mut state.offers.spells,
        &mut state.decks.spell_deck,
    );
    // Unit offer: clear and redraw (player_count + 2)
    let unit_offer_size = state.players.len() + 2;
    mk_data::unit_offers::refresh_unit_offer(
        &mut state.offers.units,
        &mut state.decks.unit_deck,
        unit_offer_size,
    );

    // 5. Player round reset (reshuffle + draw)
    for player_idx in 0..state.players.len() {
        reset_player_round(state, player_idx);
    }

    // 5a. Dummy player reset for new round
    if let Some(ref mut dummy) = state.dummy_player {
        crate::dummy_player::reset_dummy_for_new_round(dummy, &mut state.rng);
    }

    // 6. Increment round
    state.round += 1;

    // 7. Clear round-end state
    state.end_of_round_announced_by = None;
    state.players_with_final_turn.clear();

    // 8. Set up tactics selection for new round
    let new_time = state.time_of_day;
    let tactic_ids = get_tactics_for_time(new_time);
    state.available_tactics = tactic_ids.iter().map(|&s| TacticId::from(s)).collect();

    // 8a. Remove used tactics based on scenario config
    match state.scenario_config.tactic_removal_mode {
        TacticRemovalMode::AllUsed => {
            state.removed_tactics.extend(used_tactics_this_round);
            state
                .available_tactics
                .retain(|t| !state.removed_tactics.contains(t));
        }
        TacticRemovalMode::None | TacticRemovalMode::VoteOne => {
            // None: tactics recycled each round
            // VoteOne: cooperative mode, not yet implemented
        }
    }
    state.dummy_player_tactic = None;

    state.round_phase = RoundPhase::TacticsSelection;
    // Tactic selection order: humans only (dummy auto-selects in apply_select_tactic)
    state.tactics_selection_order = state
        .turn_order
        .iter()
        .filter(|pid| !crate::dummy_player::is_dummy_player(pid.as_str()))
        .cloned()
        .collect();
    state.current_tactic_selector = state.tactics_selection_order.first().cloned();

    // Expire round-duration modifiers
    crate::action_pipeline::expire_modifiers_round_end(&mut state.active_modifiers);
}

/// Reset a single player for a new round: reshuffle all cards, draw up to hand limit.
///
/// Matches TS `processPlayerRoundReset()` in `playerRoundReset.ts`.
fn reset_player_round(state: &mut GameState, player_idx: usize) {
    let player = &mut state.players[player_idx];

    // Collect all cards: hand + discard + play_area + deck (minus removedCards)
    let mut all_cards: Vec<CardId> = Vec::new();
    all_cards.append(&mut player.hand);
    all_cards.append(&mut player.discard);
    all_cards.append(&mut player.play_area);
    all_cards.append(&mut player.deck);
    all_cards.append(&mut player.time_bending_set_aside_cards);

    // Shuffle all cards
    state.rng.shuffle(&mut all_cards);

    // Draw up to effective hand limit
    let hand_limit = player.hand_limit as usize;
    let hand_size = hand_limit.min(all_cards.len());

    player.hand = all_cards.drain(..hand_size).collect();
    player.deck = all_cards; // remaining cards go to deck
    player.discard.clear();
    player.play_area.clear();

    // Ready all units
    for unit in player.units.iter_mut() {
        unit.state = UnitState::Ready;
        // Note: wounded units stay wounded but become ready
    }

    // Reset round-specific state
    player.selected_tactic = None;
    player.flags.remove(PlayerFlags::TACTIC_FLIPPED);
    player.flags.remove(PlayerFlags::BEFORE_TURN_TACTIC_PENDING);
    player.flags.remove(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED);
    player.flags.remove(PlayerFlags::IS_TIME_BENT_TURN);
    player.tactic_state = TacticState::default();

    // Reset skill cooldowns
    player.skill_cooldowns.used_this_round.clear();
    player.skill_cooldowns.used_this_turn.clear();
    player.skill_cooldowns.used_this_combat.clear();
    player.skill_cooldowns.active_until_next_turn.clear();

    // Reset skill flip state
    player.skill_flip_state.flipped_skills.clear();

    // Reset banner usage
    for banner in player.attached_banners.iter_mut() {
        banner.is_used_this_round = false;
    }

    // TODO: Set pendingUnitMaintenance if Magic Familiars present
}

// =============================================================================
// Site passive effects
// =============================================================================

/// Helper: get the hex state at the player's position.
fn player_hex(state: &GameState, player_idx: usize) -> Option<&HexState> {
    let pos = state.players[player_idx].position?;
    state.map.hexes.get(&pos.key())
}

/// Magical Glade: remove a wound at end of turn.
///
/// Checks both hand and discard pile. If wounds in both, sets GladeWoundChoice
/// pending for the player to choose. If only one has wounds, auto-removes.
/// Returns true if a pending choice was created (caller should block).
fn apply_magical_glade_wound(state: &mut GameState, player_idx: usize) -> bool {
    let on_glade = player_hex(state, player_idx)
        .and_then(|h| h.site.as_ref())
        .is_some_and(|s| s.site_type == SiteType::MagicalGlade && !s.is_burned);

    if !on_glade {
        return false;
    }

    let player = &mut state.players[player_idx];
    let has_hand_wound = player.hand.iter().any(|c| c.as_str() == "wound");
    let has_discard_wound = player.discard.iter().any(|c| c.as_str() == "wound");

    if has_hand_wound && has_discard_wound {
        // Both have wounds — player must choose
        player.pending.active = Some(ActivePending::GladeWoundChoice);
        return true;
    } else if has_hand_wound {
        // Only hand — auto-remove
        if let Some(idx) = player.hand.iter().position(|c| c.as_str() == "wound") {
            player.hand.remove(idx);
        }
    } else if has_discard_wound {
        // Only discard — auto-remove
        if let Some(idx) = player.discard.iter().position(|c| c.as_str() == "wound") {
            player.discard.remove(idx);
        }
    }
    false
}

/// Mine: gain crystal of mine color at end of turn.
fn apply_mine_crystal(state: &mut GameState, player_idx: usize) {
    let mine_color = player_hex(state, player_idx)
        .and_then(|h| h.site.as_ref())
        .and_then(|s| {
            if s.site_type == SiteType::Mine && !s.is_burned {
                s.mine_color
            } else {
                None
            }
        });

    if let Some(color) = mine_color {
        mana::gain_crystal(&mut state.players[player_idx], color);
    }
}

/// Deep Mine: set pending choice if player is on a deep mine.
/// Returns true if a pending choice was created.
fn apply_deep_mine_choice(state: &mut GameState, player_idx: usize) -> bool {
    let colors = player_hex(state, player_idx)
        .and_then(|h| h.site.as_ref())
        .and_then(|s| {
            if s.site_type == SiteType::DeepMine && !s.is_burned {
                s.deep_mine_colors.clone()
            } else {
                None
            }
        });

    if let Some(colors) = colors {
        // Filter out colors where player already has max crystals
        let player = &state.players[player_idx];
        let gainable: ArrayVec<BasicManaColor, MAX_DEEP_MINE_COLORS> = colors
            .iter()
            .filter(|c| {
                let count = match c {
                    BasicManaColor::Red => player.crystals.red,
                    BasicManaColor::Blue => player.crystals.blue,
                    BasicManaColor::Green => player.crystals.green,
                    BasicManaColor::White => player.crystals.white,
                };
                count < mana::MAX_CRYSTALS_PER_COLOR
            })
            .copied()
            .collect();

        if gainable.len() > 1 {
            // Multiple valid colors — player must choose
            state.players[player_idx].pending.active =
                Some(ActivePending::DeepMineChoice { colors: gainable });
            return true;
        } else if gainable.len() == 1 {
            // Single valid color — auto-grant
            mana::gain_crystal(&mut state.players[player_idx], gainable[0]);
        }
        // 0 gainable — all maxed, skip
    }
    false
}

/// Magical Glade: gain gold (day) or black (night) mana token at turn start.
fn apply_magical_glade_mana(state: &mut GameState, player_idx: usize) {
    let on_glade = player_hex(state, player_idx)
        .and_then(|h| h.site.as_ref())
        .is_some_and(|s| s.site_type == SiteType::MagicalGlade && !s.is_burned);

    if !on_glade {
        return;
    }

    let mana_color = match state.time_of_day {
        TimeOfDay::Day => ManaColor::Gold,
        TimeOfDay::Night => ManaColor::Black,
    };

    state.players[player_idx].pure_mana.push(ManaToken {
        color: mana_color,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
}

/// Plunder decision: if player starts turn at an unconquered inhabited site.
fn apply_plunder_decision(state: &mut GameState, player_idx: usize) {
    // Don't set plunder if player already has a pending active
    if state.players[player_idx].pending.has_active() {
        return;
    }

    let should_plunder = player_hex(state, player_idx)
        .and_then(|h| h.site.as_ref())
        .is_some_and(|s| {
            mk_data::sites::is_inhabited(s.site_type)
                && !s.is_conquered
                && !s.is_burned
        });

    if should_plunder {
        state.players[player_idx].pending.active = Some(ActivePending::PlunderDecision);
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::card_play::{play_card, play_card_sideways};
    use crate::setup::create_solo_game;
    use mk_types::ids::{CardId, TacticId};

    /// Helper: create a game in player turns phase with specific hand.
    fn setup_playing_game(hand: Vec<&str>) -> GameState {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.round_phase = RoundPhase::PlayerTurns;
        state.players[0].hand = hand.into_iter().map(CardId::from).collect();
        state
    }

    // =========================================================================
    // End turn basic flow
    // =========================================================================

    #[test]
    fn end_turn_requires_card_played() {
        let mut state = setup_playing_game(vec!["march", "rage"]);
        // Haven't played any card
        let result = end_turn(&mut state, 0);
        assert_eq!(
            result.unwrap_err(),
            EndTurnError::MinimumTurnRequirementNotMet
        );
    }

    #[test]
    fn end_turn_succeeds_after_card_play() {
        let mut state = setup_playing_game(vec!["march", "rage"]);
        play_card(&mut state, 0, 0, false).unwrap(); // play march

        let result = end_turn(&mut state, 0).unwrap();
        // Solo player with cards remaining → next player (wraps to self)
        // But with 1 player, if deck and hand aren't empty, still loops.
        match result {
            EndTurnResult::NextPlayer { next_player_idx } => {
                assert_eq!(next_player_idx, 0); // wraps to self in solo
            }
            EndTurnResult::RoundEnded { .. } => {
                // Also valid if hand+deck emptied
            }
            _ => panic!("Unexpected result: {:?}", result),
        }
    }

    #[test]
    fn end_turn_moves_play_area_to_discard() {
        let mut state = setup_playing_game(vec!["march", "rage"]);
        play_card(&mut state, 0, 0, false).unwrap(); // march → play area

        assert_eq!(state.players[0].play_area.len(), 1);
        assert_eq!(state.players[0].play_area[0].as_str(), "march");

        end_turn(&mut state, 0).unwrap();

        assert!(state.players[0].play_area.is_empty());
        // march should be in discard now
        assert!(state.players[0]
            .discard
            .iter()
            .any(|c| c.as_str() == "march"));
    }

    #[test]
    fn end_turn_draws_up_to_hand_limit() {
        let mut state = setup_playing_game(vec!["march"]);
        // Start with 1 card in hand, deck has ~15 cards
        // Ensure deck has cards
        state.players[0].deck = (0..10)
            .map(|i| CardId::from(format!("card_{}", i)))
            .collect();

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        // Now: hand=0, play_area=1, deck=10

        end_turn(&mut state, 0).unwrap();

        // Should draw up to hand_limit (5 at level 1)
        assert_eq!(state.players[0].hand.len(), 5);
        assert_eq!(state.players[0].deck.len(), 5); // 10 - 5 drawn, + 1 from play area moved to discard
    }

    #[test]
    fn end_turn_doesnt_reshuffle_mid_round() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = vec![CardId::from("only_card")];
        // hand=1, deck=1

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        // hand=0, play_area=1, deck=1

        end_turn(&mut state, 0).unwrap();

        // play_area(1) → discard, draw 1 from deck → hand has 1, deck empty
        assert_eq!(state.players[0].hand.len(), 1);
        assert!(state.players[0].deck.is_empty());
        assert_eq!(state.players[0].discard.len(), 1); // march
    }

    // =========================================================================
    // Player state reset
    // =========================================================================

    #[test]
    fn end_turn_resets_move_points() {
        let mut state = setup_playing_game(vec!["march"]);
        play_card(&mut state, 0, 0, false).unwrap();
        assert_eq!(state.players[0].move_points, 2);

        end_turn(&mut state, 0).unwrap();
        assert_eq!(state.players[0].move_points, 0);
    }

    #[test]
    fn end_turn_resets_influence_points() {
        let mut state = setup_playing_game(vec!["promise"]);
        play_card(&mut state, 0, 0, false).unwrap();
        assert_eq!(state.players[0].influence_points, 2);

        end_turn(&mut state, 0).unwrap();
        assert_eq!(state.players[0].influence_points, 0);
    }

    #[test]
    fn end_turn_clears_flags() {
        let mut state = setup_playing_game(vec!["march"]);
        play_card(&mut state, 0, 0, false).unwrap();
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN));

        end_turn(&mut state, 0).unwrap();
        assert!(!state.players[0]
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN));
        assert!(!state.players[0]
            .flags
            .contains(PlayerFlags::HAS_MOVED_THIS_TURN));
    }

    #[test]
    fn end_turn_clears_mana_tokens() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        play_card(&mut state, 0, 0, false).unwrap();

        end_turn(&mut state, 0).unwrap();
        assert!(state.players[0].pure_mana.is_empty());
    }

    #[test]
    fn end_turn_preserves_crystals() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].crystals.red = 2;
        state.players[0].crystals.blue = 1;

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert_eq!(state.players[0].crystals.red, 2);
        assert_eq!(state.players[0].crystals.blue, 1);
    }

    // =========================================================================
    // Dice return
    // =========================================================================

    #[test]
    fn end_turn_returns_dice() {
        let mut state = setup_playing_game(vec!["march"]);
        let die_id = state.source.dice[0].id.clone();
        let player_id = state.players[0].id.clone();

        // Simulate taking a die
        state.source.dice[0].taken_by_player_id = Some(player_id);
        state.players[0].used_die_ids.push(die_id);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Die should be released
        assert!(state.source.dice[0].taken_by_player_id.is_none());
        // Player die tracking should be cleared
        assert!(state.players[0].used_die_ids.is_empty());
    }

    // =========================================================================
    // Level-up processing
    // =========================================================================

    #[test]
    fn end_turn_level_up_from_fame() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].fame = 8; // Level 3 threshold
        state.players[0].level = 1; // But still at level 1

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert_eq!(state.players[0].level, 3);
        assert_eq!(state.players[0].armor, 3); // Level 3 armor
        assert_eq!(state.players[0].hand_limit, 5); // Level 3 hand limit
        assert_eq!(state.players[0].command_tokens, 2); // Level 3 command slots
    }

    #[test]
    fn end_turn_no_level_down() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].fame = 3; // Level 2
        state.players[0].level = 3; // Already higher (shouldn't happen, but be safe)

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Level should stay at 3 (no downgrade)
        assert_eq!(state.players[0].level, 3);
    }

    // =========================================================================
    // Round end
    // =========================================================================

    #[test]
    fn end_turn_triggers_round_end_when_empty() {
        let mut state = setup_playing_game(vec!["march"]);
        // Make deck empty so hand+deck = 0 after card flow
        state.players[0].deck.clear();

        play_card(&mut state, 0, 0, false).unwrap();
        // After play: hand=0, play_area=1, deck=0

        let result = end_turn(&mut state, 0).unwrap();
        match result {
            EndTurnResult::RoundEnded { new_round } => {
                assert_eq!(new_round, 2);
            }
            _ => panic!("Expected RoundEnded, got {:?}", result),
        }
    }

    #[test]
    fn round_end_toggles_time_of_day() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();
        assert_eq!(state.time_of_day, TimeOfDay::Day);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert_eq!(state.time_of_day, TimeOfDay::Night);
    }

    #[test]
    fn round_end_increments_round() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();
        assert_eq!(state.round, 1);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert_eq!(state.round, 2);
    }

    #[test]
    fn round_end_reshuffles_deck() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();
        state.players[0].discard = vec![
            CardId::from("card_a"),
            CardId::from("card_b"),
            CardId::from("card_c"),
            CardId::from("card_d"),
            CardId::from("card_e"),
            CardId::from("card_f"),
            CardId::from("card_g"),
            CardId::from("card_h"),
        ];
        // hand=1 (march), deck=0, discard=8

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        // hand=0, play_area=1 (march), deck=0, discard=8

        end_turn(&mut state, 0).unwrap();

        // After round end: all 9 cards (8 discard + 1 play area) shuffled
        // Draw up to hand_limit (5)
        assert_eq!(state.players[0].hand.len(), 5);
        assert_eq!(state.players[0].deck.len(), 4); // 9 - 5
        assert!(state.players[0].discard.is_empty());
        assert!(state.players[0].play_area.is_empty());
    }

    #[test]
    fn round_end_resets_mana_source() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();
        // Mark a die as taken
        state.source.dice[0].taken_by_player_id = Some(state.players[0].id.clone());

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // All dice should be fresh (none taken)
        for die in &state.source.dice {
            assert!(
                die.taken_by_player_id.is_none(),
                "Die {} should not be taken after round end",
                die.id.as_str()
            );
        }
    }

    #[test]
    fn round_end_night_depletes_gold() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();
        assert_eq!(state.time_of_day, TimeOfDay::Day);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Now night: gold should be depleted, black available
        assert_eq!(state.time_of_day, TimeOfDay::Night);
        for die in &state.source.dice {
            if die.color == ManaColor::Gold {
                assert!(die.is_depleted, "Gold die should be depleted at night");
            }
            if die.color == ManaColor::Black {
                assert!(!die.is_depleted, "Black die should be available at night");
            }
        }
    }

    #[test]
    fn round_end_sets_tactics_selection_phase() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert_eq!(state.round_phase, RoundPhase::TacticsSelection);
    }

    #[test]
    fn round_end_updates_available_tactics() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();
        // Currently day tactics
        assert_eq!(state.available_tactics[0].as_str(), "early_bird");

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Now should have night tactics
        assert_eq!(state.available_tactics[0].as_str(), "from_the_dusk");
    }

    #[test]
    fn round_end_clears_announcement() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert!(state.end_of_round_announced_by.is_none());
        assert!(state.players_with_final_turn.is_empty());
    }

    #[test]
    fn round_end_units_readied() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();
        state.players[0].units.push(PlayerUnit {
            instance_id: UnitInstanceId::from("unit_0"),
            unit_id: UnitId::from("peasants"),
            level: 1,
            state: UnitState::Spent,
            wounded: true,
            used_resistance_this_combat: false,
            used_ability_indices: Vec::new(),
            mana_token: None,
        });

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Unit should be readied but still wounded
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
        assert!(state.players[0].units[0].wounded);
    }

    #[test]
    fn round_end_clears_selected_tactic() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();
        state.players[0].selected_tactic = Some(TacticId::from("planning"));

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert!(state.players[0].selected_tactic.is_none());
    }

    // =========================================================================
    // Multiple turns within a round
    // =========================================================================

    #[test]
    fn multiple_turns_drain_deck() {
        let mut state = setup_playing_game(vec!["march", "stamina"]);
        state.players[0].deck = vec![
            CardId::from("rage"),
            CardId::from("promise"),
            CardId::from("threaten"),
        ];
        // hand=2, deck=3

        // Turn 1: play march, draw up
        play_card(&mut state, 0, 0, false).unwrap();
        // hand=1 (stamina), play_area=1 (march), deck=3
        end_turn(&mut state, 0).unwrap();
        // card_flow: play_area→discard, draw 4 from deck (to reach hand_limit=5)
        // but deck only has 3, so hand=1+3=4, deck=0, discard=1(march)
        assert_eq!(state.players[0].hand.len(), 4); // stamina + 3 drawn
        assert_eq!(state.players[0].deck.len(), 0);
        assert_eq!(state.players[0].discard.len(), 1); // march

        // Turn 2: play one card
        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        end_turn(&mut state, 0).unwrap();
        // After: hand=3 (was 3 after removing 1), play_area→discard
        // deck empty, can't draw → hand stays at 3
        // But now hand(3)+deck(0) still not empty... hand isn't empty
        // So next turn, not round end yet
        assert_eq!(state.players[0].hand.len(), 3);
    }

    #[test]
    fn two_round_cycle() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();

        // Round 1, Day
        assert_eq!(state.round, 1);
        assert_eq!(state.time_of_day, TimeOfDay::Day);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap(); // triggers round end

        // Round 2, Night
        assert_eq!(state.round, 2);
        assert_eq!(state.time_of_day, TimeOfDay::Night);

        // Simulate round 2 — play a card from the reshuffled hand
        state.round_phase = RoundPhase::PlayerTurns;
        // Deck should have march (1 card reshuffled, drawn into hand of 1 since only 1 card)
        assert_eq!(state.players[0].hand.len(), 1);
        state.players[0].deck.clear(); // force empty for round end

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        end_turn(&mut state, 0).unwrap(); // triggers round end again

        // Round 3, Day again
        assert_eq!(state.round, 3);
        assert_eq!(state.time_of_day, TimeOfDay::Day);
    }

    // =========================================================================
    // Invalid player index
    // =========================================================================

    #[test]
    fn end_turn_invalid_player_index() {
        let mut state = setup_playing_game(vec!["march"]);
        let result = end_turn(&mut state, 5);
        assert_eq!(result.unwrap_err(), EndTurnError::InvalidPlayerIndex);
    }

    // =========================================================================
    // Planning tactic bonus
    // =========================================================================

    #[test]
    fn planning_tactic_gives_plus_one_hand_limit() {
        let mut state = setup_playing_game(vec!["march", "rage"]);
        state.players[0].selected_tactic = Some(TacticId::from("planning"));
        state.players[0].deck = (0..10)
            .map(|i| CardId::from(format!("card_{}", i)))
            .collect();

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        // hand=1 ("rage"), play_area=1 ("march"), deck=10
        // After end turn: play_area→discard, draw up
        // hand.len() = 1 (rage) ≥ 2? No → no planning bonus
        // Actually hand has only 1 card when draw starts → no bonus
        // Let's set up properly: hand has 2 cards
        let mut state2 = setup_playing_game(vec!["march", "rage", "swiftness"]);
        state2.players[0].selected_tactic = Some(TacticId::from("planning"));
        state2.players[0].deck = (0..10)
            .map(|i| CardId::from(format!("card_{}", i)))
            .collect();

        play_card_sideways(&mut state2, 0, 0, SidewaysAs::Move).unwrap();
        // hand=2 (rage, swiftness), deck=10
        // hand.len() >= 2 → planning bonus applies → draw limit = 5 + 1 = 6
        // Already have 2 in hand, draw 4 more

        end_turn(&mut state2, 0).unwrap();

        assert_eq!(state2.players[0].hand.len(), 6); // 5 (base) + 1 (planning)
    }

    #[test]
    fn planning_no_bonus_when_hand_less_than_two() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(TacticId::from("planning"));
        state.players[0].deck = (0..10)
            .map(|i| CardId::from(format!("card_{}", i)))
            .collect();

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        // hand=0, deck=10

        end_turn(&mut state, 0).unwrap();

        // No planning bonus (hand was 0 < 2)
        assert_eq!(state.players[0].hand.len(), 5); // base hand_limit
    }

    // =========================================================================
    // Extra turn (The Right Moment)
    // =========================================================================

    #[test]
    fn extra_turn_keeps_same_player() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].tactic_state.extra_turn_pending = true;

        play_card(&mut state, 0, 0, false).unwrap();
        let result = end_turn(&mut state, 0).unwrap();

        match result {
            EndTurnResult::NextPlayer { next_player_idx } => {
                assert_eq!(next_player_idx, 0, "Extra turn should keep same player");
            }
            _ => panic!("Expected NextPlayer, got {:?}", result),
        }

        // Flag should be cleared after use
        assert!(!state.players[0].tactic_state.extra_turn_pending);
    }

    // =========================================================================
    // Mana Steal cleanup
    // =========================================================================

    #[test]
    fn mana_steal_die_returned_at_end_turn() {
        let mut state = setup_playing_game(vec!["march"]);
        // Simulate a stolen die
        let die_id = state.source.dice[0].id.clone();
        state.players[0].tactic_state.stored_mana_die = Some(StoredManaDie {
            die_id: die_id.clone(),
            color: ManaColor::Red,
        });
        state.source.dice[0].taken_by_player_id = Some(state.players[0].id.clone());

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Die should be returned (rerolled)
        assert!(state.players[0].tactic_state.stored_mana_die.is_none());
        assert!(state.source.dice.iter().find(|d| d.id == die_id).unwrap().taken_by_player_id.is_none());
    }

    // =========================================================================
    // Sparing Power before-turn setup
    // =========================================================================

    #[test]
    fn sparing_power_before_turn_sets_pending() {
        // Need 2-player scenario to test advance_turn properly
        // In solo, advance wraps to same player
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].selected_tactic = Some(TacticId::from("sparing_power"));

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Since solo wraps to same player, sparing power pending should be set
        assert!(state.players[0].flags.contains(PlayerFlags::BEFORE_TURN_TACTIC_PENDING));
        assert!(state.players[0].pending.has_active());
    }

    // =========================================================================
    // Site passive effects
    // =========================================================================

    use arrayvec::ArrayVec;
    use mk_types::hex::HexCoord;
    use mk_types::pending::ActivePending;

    /// Helper: place player on a hex with a specific site.
    fn place_on_site(state: &mut GameState, site_type: SiteType) -> HexCoord {
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

    #[test]
    fn mine_grants_crystal_at_end_turn() {
        let mut state = setup_playing_game(vec!["march"]);
        place_on_site(&mut state, SiteType::Mine);
        assert_eq!(state.players[0].crystals.red, 0);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert_eq!(state.players[0].crystals.red, 1, "Mine should grant red crystal");
    }

    #[test]
    fn mine_no_crystal_when_burned() {
        let mut state = setup_playing_game(vec!["march"]);
        let coord = place_on_site(&mut state, SiteType::Mine);
        state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_burned = true;

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert_eq!(state.players[0].crystals.red, 0, "Burned mine: no crystal");
    }

    #[test]
    fn deep_mine_creates_pending_multiple_colors() {
        let mut state = setup_playing_game(vec!["march"]);
        place_on_site(&mut state, SiteType::DeepMine);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert!(
            matches!(
                state.players[0].pending.active,
                Some(ActivePending::DeepMineChoice { .. })
            ),
            "DeepMine should create pending choice with multiple colors"
        );
    }

    #[test]
    fn deep_mine_auto_grants_single_valid_color() {
        let mut state = setup_playing_game(vec!["march"]);
        place_on_site(&mut state, SiteType::DeepMine);
        // Test helper sets deep mine colors = [Blue, Green]
        // Max out blue, leave green open
        state.players[0].crystals.blue = 3; // maxed

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Should auto-grant green crystal, no pending
        assert_eq!(state.players[0].crystals.green, 1, "Should auto-grant green");
        assert!(
            !matches!(
                state.players[0].pending.active,
                Some(ActivePending::DeepMineChoice { .. })
            ),
            "No pending when only 1 valid color"
        );
    }

    #[test]
    fn deep_mine_skips_all_maxed() {
        let mut state = setup_playing_game(vec!["march"]);
        place_on_site(&mut state, SiteType::DeepMine);
        // Test helper sets deep mine colors = [Blue, Green]
        state.players[0].crystals.blue = 3;
        state.players[0].crystals.green = 3;

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Should skip — no pending, no new crystals
        assert!(
            !matches!(
                state.players[0].pending.active,
                Some(ActivePending::DeepMineChoice { .. })
            ),
            "No pending when all colors maxed"
        );
    }

    #[test]
    fn glade_discards_wound_from_hand_only() {
        let mut state = setup_playing_game(vec!["wound", "march"]);
        place_on_site(&mut state, SiteType::MagicalGlade);
        // No wounds in discard — should auto-remove from hand
        assert!(state.players[0].discard.iter().all(|c| c.as_str() != "wound"));

        play_card_sideways(&mut state, 0, 1, SidewaysAs::Move).unwrap(); // play march sideways
        end_turn(&mut state, 0).unwrap();

        // Wound should be removed from hand (auto — no pending)
        assert!(
            !state.players[0].hand.iter().any(|c| c.as_str() == "wound"),
            "Glade should auto-remove wound from hand"
        );
        assert!(!state.players[0].pending.has_active(), "No pending when only hand has wounds");
    }

    #[test]
    fn glade_discards_wound_from_discard_only() {
        let mut state = setup_playing_game(vec!["march"]);
        place_on_site(&mut state, SiteType::MagicalGlade);
        // Put a wound in discard but not hand
        state.players[0].discard.push(CardId::from("wound"));

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Wound should be auto-removed from discard
        assert!(
            !state.players[0].discard.iter().any(|c| c.as_str() == "wound"),
            "Glade should auto-remove wound from discard"
        );
        assert!(!state.players[0].pending.has_active(), "No pending when only discard has wounds");
    }

    #[test]
    fn glade_creates_pending_when_both_have_wounds() {
        let mut state = setup_playing_game(vec!["wound", "march"]);
        place_on_site(&mut state, SiteType::MagicalGlade);
        // Put a wound in discard too
        state.players[0].discard.push(CardId::from("wound"));

        play_card_sideways(&mut state, 0, 1, SidewaysAs::Move).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Should create GladeWoundChoice pending
        assert!(
            matches!(
                state.players[0].pending.active,
                Some(ActivePending::GladeWoundChoice)
            ),
            "Should have GladeWoundChoice pending when both hand and discard have wounds"
        );
    }

    #[test]
    fn glade_no_wound_no_op() {
        let mut state = setup_playing_game(vec!["march"]);
        place_on_site(&mut state, SiteType::MagicalGlade);
        play_card(&mut state, 0, 0, false).unwrap();
        // After play: hand empty, play_area has march
        end_turn(&mut state, 0).unwrap();

        // No wound to remove — no crash, no pending
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn glade_mana_at_turn_start_day() {
        let mut state = setup_playing_game(vec!["march"]);
        place_on_site(&mut state, SiteType::MagicalGlade);
        state.time_of_day = TimeOfDay::Day;

        // Trigger advance_turn by ending turn (solo wraps)
        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Should have gained gold mana token
        assert!(
            state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Gold),
            "Glade should grant gold mana during day"
        );
    }

    #[test]
    fn glade_mana_at_turn_start_night() {
        let mut state = setup_playing_game(vec!["march"]);
        place_on_site(&mut state, SiteType::MagicalGlade);
        state.time_of_day = TimeOfDay::Night;

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Should have gained black mana token
        assert!(
            state.players[0].pure_mana.iter().any(|t| t.color == ManaColor::Black),
            "Glade should grant black mana during night"
        );
    }

    #[test]
    fn plunder_decision_at_unconquered_village_on_turn_start() {
        let mut state = setup_playing_game(vec!["march"]);
        place_on_site(&mut state, SiteType::Village);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Solo wraps → next turn for same player → plunder decision should be set
        assert!(
            matches!(
                state.players[0].pending.active,
                Some(ActivePending::PlunderDecision)
            ),
            "Should have plunder decision at unconquered Village"
        );
    }

    #[test]
    fn no_plunder_at_conquered_village() {
        let mut state = setup_playing_game(vec!["march"]);
        let coord = place_on_site(&mut state, SiteType::Village);
        state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // No plunder decision at conquered village
        assert!(
            !matches!(
                state.players[0].pending.active,
                Some(ActivePending::PlunderDecision)
            ),
            "No plunder at conquered Village"
        );
    }

    // =========================================================================
    // Modifier expiration
    // =========================================================================

    fn make_modifier(
        duration: mk_types::modifier::ModifierDuration,
        player_id: &str,
    ) -> mk_types::modifier::ActiveModifier {
        use mk_types::modifier::*;
        ActiveModifier {
            id: ModifierId::from(format!("mod_{:?}_{}", duration, player_id)),
            effect: ModifierEffect::TerrainCost {
                terrain: TerrainOrAll::All,
                amount: -1,
                minimum: 0,
                replace_cost: None,
            },
            duration,
            scope: ModifierScope::SelfScope,
            source: ModifierSource::Unit {
                unit_index: 0,
                player_id: PlayerId::from(player_id),
            },
            created_at_round: 0,
            created_by_player_id: PlayerId::from(player_id),
        }
    }

    #[test]
    fn turn_end_expires_turn_modifiers_for_player() {
        use mk_types::modifier::ModifierDuration;

        let mut state = setup_playing_game(vec!["march"]);
        let player_id = state.players[0].id.clone();

        // Add modifiers of various durations
        state.active_modifiers.push(make_modifier(ModifierDuration::Turn, player_id.as_str()));
        state.active_modifiers.push(make_modifier(ModifierDuration::Combat, player_id.as_str()));
        state.active_modifiers.push(make_modifier(ModifierDuration::Round, player_id.as_str()));
        state.active_modifiers.push(make_modifier(ModifierDuration::Permanent, player_id.as_str()));

        assert_eq!(state.active_modifiers.len(), 4);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Turn modifier should be expired, others remain
        assert_eq!(state.active_modifiers.len(), 3, "Turn modifier should be expired");
        assert!(state.active_modifiers.iter().all(|m| m.duration != ModifierDuration::Turn));
    }

    #[test]
    fn round_end_expires_round_modifiers() {
        use mk_types::modifier::ModifierDuration;

        let mut state = setup_playing_game(vec!["march"]);
        let player_id = state.players[0].id.clone();

        state.active_modifiers.push(make_modifier(ModifierDuration::Round, player_id.as_str()));
        state.active_modifiers.push(make_modifier(ModifierDuration::Permanent, player_id.as_str()));

        assert_eq!(state.active_modifiers.len(), 2);

        // Make hand+deck empty to trigger round end
        play_card(&mut state, 0, 0, false).unwrap();
        state.players[0].hand.clear();
        state.players[0].deck.clear();
        let result = end_turn(&mut state, 0).unwrap();
        assert!(matches!(result, EndTurnResult::RoundEnded { .. }));

        // Round modifier should be expired, permanent remains
        assert_eq!(state.active_modifiers.len(), 1, "Round modifier should be expired");
        assert_eq!(state.active_modifiers[0].duration, ModifierDuration::Permanent);
    }

    #[test]
    fn combat_end_expires_combat_modifiers() {
        use mk_types::modifier::ModifierDuration;

        let mut state = setup_playing_game(vec!["march"]);
        let player_id = state.players[0].id.clone();

        // Add combat and turn modifiers
        state.active_modifiers.push(make_modifier(ModifierDuration::Combat, player_id.as_str()));
        state.active_modifiers.push(make_modifier(ModifierDuration::Turn, player_id.as_str()));

        // Enter and immediately end combat
        let tokens = vec![mk_types::ids::EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        // Mark enemy defeated and end attack phase to trigger end_combat
        state.combat.as_mut().unwrap().enemies[0].is_defeated = true;
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

        // Execute EndCombatPhase to trigger end_combat
        let mut undo = crate::undo::UndoStack::new();
        let legal = crate::legal_actions::enumerate_legal_actions_with_undo(&state, 0, &undo);
        let end_phase = legal.actions.iter().find(|a| matches!(a, mk_types::legal_action::LegalAction::EndCombatPhase)).unwrap();
        let _ = crate::action_pipeline::apply_legal_action(&mut state, &mut undo, 0, end_phase, legal.epoch);

        // Combat modifier should be expired, turn modifier should remain
        assert_eq!(state.active_modifiers.len(), 1, "Combat modifier should be expired");
        assert_eq!(state.active_modifiers[0].duration, ModifierDuration::Turn);
    }

    #[test]
    fn combat_end_resets_unit_resistance() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].units.clear();
        state.players[0].units.push(mk_types::state::PlayerUnit {
            instance_id: mk_types::ids::UnitInstanceId::from("unit_test"),
            unit_id: mk_types::ids::UnitId::from("peasants"),
            level: 1,
            state: UnitState::Ready,
            wounded: false,
            used_resistance_this_combat: true,  // Used during combat
            used_ability_indices: Vec::new(),
            mana_token: None,
        });

        // Enter and immediately end combat
        let tokens = vec![mk_types::ids::EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        state.combat.as_mut().unwrap().enemies[0].is_defeated = true;
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

        let mut undo = crate::undo::UndoStack::new();
        let legal = crate::legal_actions::enumerate_legal_actions_with_undo(&state, 0, &undo);
        let end_phase = legal.actions.iter().find(|a| matches!(a, mk_types::legal_action::LegalAction::EndCombatPhase)).unwrap();
        let _ = crate::action_pipeline::apply_legal_action(&mut state, &mut undo, 0, end_phase, legal.epoch);

        assert!(!state.players[0].units[0].used_resistance_this_combat,
            "used_resistance_this_combat should reset after combat");
    }

    // =========================================================================
    // Scenario ending — game end finalization
    // =========================================================================

    #[test]
    fn round_end_during_final_turns_ends_game() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear(); // Force round end on end_turn

        // Simulate scenario end triggered with 2 final turns remaining
        state.scenario_end_triggered = true;
        state.final_turns_remaining = Some(2);

        // Play a card and end turn — deck+hand empty triggers round end,
        // and round end during final turns should end game immediately
        play_card(&mut state, 0, 0, false).unwrap();
        let result = end_turn(&mut state, 0).unwrap();

        assert!(
            matches!(result, EndTurnResult::GameEnded),
            "Should end game when round ends during final turns, got {:?}",
            result
        );
        assert!(state.game_ended);
        assert_eq!(state.phase, GamePhase::End);
    }

    #[test]
    fn finalize_sets_winning_player_id() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("card_{}", i))).collect();
        state.players[0].fame = 15;
        state.players[0].level = 4; // Match level to fame to avoid pending level-up rewards

        // Trigger game end via final turns countdown
        state.scenario_end_triggered = true;
        state.final_turns_remaining = Some(1);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert!(state.game_ended);
        assert_eq!(
            state.winning_player_id.as_ref().map(|id| id.as_str()),
            Some(state.players[0].id.as_str()),
            "Solo player should be winning player"
        );
    }

    #[test]
    fn finalize_populates_final_score_result() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("card_{}", i))).collect();
        state.players[0].fame = 20;
        state.players[0].level = 4; // Match level to fame to avoid pending level-up rewards

        // Trigger game end via final turns countdown
        state.scenario_end_triggered = true;
        state.final_turns_remaining = Some(1);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert!(state.game_ended);
        let score_result = state.final_score_result.as_ref()
            .expect("final_score_result should be populated");
        assert_eq!(
            score_result.player_results[0].base_score,
            20,
            "Base score should equal player fame"
        );
    }

    #[test]
    fn round_limit_game_end_sets_scores() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();
        state.players[0].fame = 12;
        state.players[0].level = 3; // Match level to fame to avoid pending level-up rewards

        // Set round to total_rounds so end_round triggers game end
        state.round = state.scenario_config.total_rounds;

        play_card(&mut state, 0, 0, false).unwrap();
        let result = end_turn(&mut state, 0).unwrap();

        assert!(matches!(result, EndTurnResult::GameEnded));
        assert!(state.game_ended);
        assert!(state.winning_player_id.is_some(), "Should set winning player");
        assert!(state.final_score_result.is_some(), "Should set final scores");
    }

    #[test]
    fn finalize_sets_final_turns_remaining_to_zero() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck.clear();

        state.scenario_end_triggered = true;
        state.final_turns_remaining = Some(2);

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert!(state.game_ended);
        assert_eq!(
            state.final_turns_remaining,
            Some(0),
            "final_turns_remaining should be set to 0 on game end"
        );
    }

    // =========================================================================
    // Crystal Mastery return
    // =========================================================================

    #[test]
    fn crystal_mastery_returns_spent_crystals() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0]
            .flags
            .insert(PlayerFlags::CRYSTAL_MASTERY_POWERED_ACTIVE);
        state.players[0].crystals.red = 1;
        state.players[0].crystals.blue = 0;
        state.players[0].spent_crystals_this_turn = Crystals {
            red: 1,
            blue: 2,
            green: 0,
            white: 0,
        };

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // red: 1 + 1 = 2, blue: 0 + 2 = 2
        assert_eq!(state.players[0].crystals.red, 2);
        assert_eq!(state.players[0].crystals.blue, 2);
    }

    #[test]
    fn crystal_mastery_caps_at_max() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0]
            .flags
            .insert(PlayerFlags::CRYSTAL_MASTERY_POWERED_ACTIVE);
        state.players[0].crystals.green = 2;
        state.players[0].spent_crystals_this_turn = Crystals {
            red: 0,
            blue: 0,
            green: 3,
            white: 0,
        };

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // green: 2 + 3 = 5, capped at 3
        assert_eq!(state.players[0].crystals.green, 3);
    }

    #[test]
    fn crystal_mastery_no_flag_no_return() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        // No CRYSTAL_MASTERY_POWERED_ACTIVE flag
        state.players[0].crystals.red = 0;
        state.players[0].spent_crystals_this_turn = Crystals {
            red: 2,
            blue: 0,
            green: 0,
            white: 0,
        };

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // No return without flag
        assert_eq!(state.players[0].crystals.red, 0);
    }

    // =========================================================================
    // Ring fame bonus
    // =========================================================================

    #[test]
    fn ring_fame_bonus_adds_spells_cast() {
        use mk_types::modifier::*;
        use std::collections::BTreeMap;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        let pid = state.players[0].id.clone();

        // Ring of Red: EndlessMana with [Red, Black], Turn duration
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("ring_red"),
            source: ModifierSource::Skill {
                skill_id: SkillId::from("ring"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::EndlessMana {
                colors: vec![ManaColor::Red, ManaColor::Black],
            },
            created_at_round: 1,
            created_by_player_id: pid.clone(),
        });

        // Player cast 3 red spells this turn
        let mut spell_map = BTreeMap::new();
        spell_map.insert(ManaColor::Red, 3);
        state.players[0].spells_cast_by_color_this_turn = spell_map;
        state.players[0].fame = 0;

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Should get +3 fame from ring
        assert_eq!(state.players[0].fame, 3);
    }

    #[test]
    fn ring_fame_no_spells_no_bonus() {
        use mk_types::modifier::*;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        let pid = state.players[0].id.clone();

        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("ring_blue"),
            source: ModifierSource::Skill {
                skill_id: SkillId::from("ring"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::EndlessMana {
                colors: vec![ManaColor::Blue, ManaColor::Black],
            },
            created_at_round: 1,
            created_by_player_id: pid.clone(),
        });

        // No spells cast
        state.players[0].fame = 5;

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        assert_eq!(state.players[0].fame, 5, "No bonus when no spells cast");
    }

    // =========================================================================
    // Mountain Lore hand limit bonus
    // =========================================================================

    #[test]
    fn mountain_lore_mountain_adds_2_to_hand_limit() {
        use mk_types::modifier::*;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..10).map(|i| CardId::from(format!("c{}", i))).collect();
        let pid = state.players[0].id.clone();

        // Place player on mountain
        let coord = HexCoord { q: 50, r: 50 };
        state.map.hexes.insert(
            coord.key(),
            HexState {
                coord,
                terrain: Terrain::Mountain,
                tile_id: TileId::StartingA,
                site: None,
                rampaging_enemies: ArrayVec::new(),
                enemies: ArrayVec::new(),
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );
        state.players[0].position = Some(coord);

        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("mt_lore"),
            source: ModifierSource::Skill {
                skill_id: SkillId::from("mountain_lore"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Permanent,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::MountainLoreHandLimit {
                hills_bonus: 1,
                mountain_bonus: 2,
            },
            created_at_round: 1,
            created_by_player_id: pid.clone(),
        });

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Base hand limit 5 + 2 mountain bonus = 7
        assert_eq!(state.players[0].hand.len(), 7);
    }

    #[test]
    fn mountain_lore_hills_adds_1_to_hand_limit() {
        use mk_types::modifier::*;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..10).map(|i| CardId::from(format!("c{}", i))).collect();
        let pid = state.players[0].id.clone();

        // Place player on hills
        let coord = HexCoord { q: 50, r: 50 };
        state.map.hexes.insert(
            coord.key(),
            HexState {
                coord,
                terrain: Terrain::Hills,
                tile_id: TileId::StartingA,
                site: None,
                rampaging_enemies: ArrayVec::new(),
                enemies: ArrayVec::new(),
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );
        state.players[0].position = Some(coord);

        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("mt_lore"),
            source: ModifierSource::Skill {
                skill_id: SkillId::from("mountain_lore"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Permanent,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::MountainLoreHandLimit {
                hills_bonus: 1,
                mountain_bonus: 2,
            },
            created_at_round: 1,
            created_by_player_id: pid.clone(),
        });

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Base hand limit 5 + 1 hills bonus = 6
        assert_eq!(state.players[0].hand.len(), 6);
    }

    #[test]
    fn mountain_lore_plains_no_bonus() {
        use mk_types::modifier::*;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..10).map(|i| CardId::from(format!("c{}", i))).collect();
        let pid = state.players[0].id.clone();

        // Player starts on plains (default starting position)
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("mt_lore"),
            source: ModifierSource::Skill {
                skill_id: SkillId::from("mountain_lore"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Permanent,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::MountainLoreHandLimit {
                hills_bonus: 1,
                mountain_bonus: 2,
            },
            created_at_round: 1,
            created_by_player_id: pid.clone(),
        });

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Base hand limit 5, no bonus on plains
        assert_eq!(state.players[0].hand.len(), 5);
    }

    // =========================================================================
    // Mysterious Box cleanup
    // =========================================================================

    #[test]
    fn mysterious_box_unused_returns_to_hand() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0]
            .play_area
            .push(CardId::from("mysterious_box"));
        state.players[0].mysterious_box_state = Some(MysteriousBoxState {
            revealed_artifact_id: CardId::from("some_artifact"),
            used_as: MysteriousBoxUsage::Unused,
            played_card_from_hand_before_play: false,
        });
        state.decks.artifact_deck.clear();

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // mysterious_box should be in hand (removed from play_area before card flow)
        assert!(
            state.players[0]
                .hand
                .iter()
                .any(|c| c.as_str() == "mysterious_box"),
            "Unused: mysterious_box should be in hand"
        );
        // Artifact returned to deck
        assert!(state.decks.artifact_deck.contains(&CardId::from("some_artifact")));
    }

    #[test]
    fn mysterious_box_powered_goes_to_removed() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0]
            .play_area
            .push(CardId::from("mysterious_box"));
        state.players[0].mysterious_box_state = Some(MysteriousBoxState {
            revealed_artifact_id: CardId::from("some_artifact"),
            used_as: MysteriousBoxUsage::Powered,
            played_card_from_hand_before_play: false,
        });

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // mysterious_box should be in removed_cards
        assert!(
            state.players[0]
                .removed_cards
                .iter()
                .any(|c| c.as_str() == "mysterious_box"),
            "Powered: mysterious_box should be in removed_cards"
        );
        assert!(
            !state.players[0]
                .hand
                .iter()
                .any(|c| c.as_str() == "mysterious_box"),
            "Powered: mysterious_box should NOT be in hand"
        );
    }

    #[test]
    fn mysterious_box_banner_goes_to_discard() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0]
            .play_area
            .push(CardId::from("mysterious_box"));
        state.players[0].mysterious_box_state = Some(MysteriousBoxState {
            revealed_artifact_id: CardId::from("some_artifact"),
            used_as: MysteriousBoxUsage::Banner,
            played_card_from_hand_before_play: false,
        });
        // Add banner attachment
        state.players[0].attached_banners.push(BannerAttachment {
            banner_id: CardId::from("mysterious_box"),
            unit_instance_id: UnitInstanceId::from("unit_0"),
            is_used_this_round: false,
        });

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // mysterious_box in discard (moved there before card flow, then card flow moves it again)
        // Actually: moved to discard by cleanup, then play_area→discard in card flow
        // The card should end up in discard
        assert!(
            state.players[0]
                .discard
                .iter()
                .any(|c| c.as_str() == "mysterious_box"),
            "Banner: mysterious_box should be in discard"
        );
        // Banner attachment should be removed
        assert!(
            !state.players[0]
                .attached_banners
                .iter()
                .any(|b| b.banner_id.as_str() == "mysterious_box"),
            "Banner attachment should be removed"
        );
    }

    #[test]
    fn mysterious_box_basic_stays_in_play_area_for_normal_flow() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0]
            .play_area
            .push(CardId::from("mysterious_box"));
        state.players[0].mysterious_box_state = Some(MysteriousBoxState {
            revealed_artifact_id: CardId::from("some_artifact"),
            used_as: MysteriousBoxUsage::Basic,
            played_card_from_hand_before_play: false,
        });

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Basic: stays in play_area → card flow moves it to discard
        assert!(
            state.players[0]
                .discard
                .iter()
                .any(|c| c.as_str() == "mysterious_box"),
            "Basic: mysterious_box should end up in discard via normal card flow"
        );
    }

    // =========================================================================
    // Crystal Joy reclaim (via end-turn pending)
    // =========================================================================

    #[test]
    fn crystal_joy_creates_pending_on_end_turn() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0].crystal_joy_reclaim_version =
            Some(mk_types::pending::EffectMode::Basic);

        play_card(&mut state, 0, 0, false).unwrap();
        let result = end_turn(&mut state, 0).unwrap();

        assert!(
            matches!(result, EndTurnResult::AwaitingEndTurnChoice),
            "Should return AwaitingEndTurnChoice, got {:?}",
            result,
        );
        assert!(matches!(
            state.players[0].pending.active,
            Some(ActivePending::CrystalJoyReclaim(_))
        ));
    }

    #[test]
    fn crystal_joy_reclaim_basic_non_wound_only() {
        use crate::legal_actions::enumerate_legal_actions;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].crystal_joy_reclaim_version =
            Some(mk_types::pending::EffectMode::Basic);
        state.players[0].discard = vec![
            CardId::from("rage"),
            CardId::from("wound"),
            CardId::from("stamina"),
        ];

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        // Enumerate legal actions
        let legal = enumerate_legal_actions(&state, 0);
        // Should have: rage(0), stamina(2) as eligible, plus skip(None), plus Undo
        let reclaim_actions: Vec<_> = legal
            .actions
            .iter()
            .filter(|a| matches!(a, mk_types::legal_action::LegalAction::ResolveCrystalJoyReclaim { .. }))
            .collect();
        // 2 non-wound cards + 1 skip = 3
        assert_eq!(reclaim_actions.len(), 3, "2 non-wound + 1 skip");
    }

    #[test]
    fn crystal_joy_reclaim_powered_all_eligible() {
        use crate::legal_actions::enumerate_legal_actions;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].crystal_joy_reclaim_version =
            Some(mk_types::pending::EffectMode::Powered);
        state.players[0].discard = vec![
            CardId::from("rage"),
            CardId::from("wound"),
        ];

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        let legal = enumerate_legal_actions(&state, 0);
        let reclaim_actions: Vec<_> = legal
            .actions
            .iter()
            .filter(|a| matches!(a, mk_types::legal_action::LegalAction::ResolveCrystalJoyReclaim { .. }))
            .collect();
        // Powered: all cards eligible (rage + wound) + skip = 3
        assert_eq!(reclaim_actions.len(), 3, "Powered: 2 cards + 1 skip");
    }

    #[test]
    fn crystal_joy_resolve_moves_card_to_hand() {
        use crate::action_pipeline::apply_legal_action;
        use crate::legal_actions::enumerate_legal_actions;
        use crate::undo::UndoStack;
        use mk_types::legal_action::LegalAction;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0].crystal_joy_reclaim_version =
            Some(mk_types::pending::EffectMode::Basic);
        state.players[0].discard = vec![CardId::from("rage"), CardId::from("stamina")];

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();
        // Now pending CrystalJoyReclaim

        let legal = enumerate_legal_actions(&state, 0);
        let mut undo = UndoStack::new();

        // Resolve: pick rage (index 0)
        let action = LegalAction::ResolveCrystalJoyReclaim {
            discard_index: Some(0),
        };
        apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

        // rage should be in hand now
        assert!(
            state.players[0]
                .hand
                .iter()
                .any(|c| c.as_str() == "rage"),
            "Reclaimed card should be in hand"
        );
        // stamina stays in discard (moved to discard by card flow)
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn crystal_joy_skip_no_card_moved() {
        use crate::action_pipeline::apply_legal_action;
        use crate::legal_actions::enumerate_legal_actions;
        use crate::undo::UndoStack;
        use mk_types::legal_action::LegalAction;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0].crystal_joy_reclaim_version =
            Some(mk_types::pending::EffectMode::Basic);
        state.players[0].discard = vec![CardId::from("rage")];

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        let legal = enumerate_legal_actions(&state, 0);
        let mut undo = UndoStack::new();

        // Resolve: skip (None)
        let action = LegalAction::ResolveCrystalJoyReclaim {
            discard_index: None,
        };
        apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

        // No card reclaimed, rage should be in discard (from card flow)
        assert!(
            state.players[0]
                .discard
                .iter()
                .any(|c| c.as_str() == "rage"),
            "rage should stay in discard after skip"
        );
        assert!(!state.players[0].pending.has_active());
    }

    // =========================================================================
    // Steady Tempo deck placement (via end-turn pending)
    // =========================================================================

    #[test]
    fn steady_tempo_creates_pending_on_end_turn() {
        let mut state = setup_playing_game(vec!["steady_tempo"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();

        play_card(&mut state, 0, 0, false).unwrap();
        // play_card should set steady_tempo_version
        assert!(state.players[0].steady_tempo_version.is_some());

        let result = end_turn(&mut state, 0).unwrap();
        assert!(
            matches!(result, EndTurnResult::AwaitingEndTurnChoice),
            "Should return AwaitingEndTurnChoice, got {:?}",
            result,
        );
        assert!(matches!(
            state.players[0].pending.active,
            Some(ActivePending::SteadyTempoDeckPlacement(_))
        ));
    }

    #[test]
    fn steady_tempo_basic_places_at_bottom() {
        use crate::action_pipeline::apply_legal_action;
        use crate::legal_actions::enumerate_legal_actions;
        use crate::undo::UndoStack;
        use mk_types::legal_action::LegalAction;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0].steady_tempo_version =
            Some(mk_types::pending::EffectMode::Basic);
        state.players[0]
            .play_area
            .push(CardId::from("steady_tempo"));

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();
        // Pending SteadyTempoDeckPlacement

        let legal = enumerate_legal_actions(&state, 0);
        let mut undo = UndoStack::new();

        let action = LegalAction::ResolveSteadyTempoDeckPlacement { place: true };
        apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

        // steady_tempo should be at the bottom of deck
        assert_eq!(
            state.players[0].deck.last().map(|c| c.as_str()),
            Some("steady_tempo"),
            "Basic: steady_tempo should be at bottom of deck"
        );
    }

    #[test]
    fn steady_tempo_powered_places_at_top() {
        use crate::action_pipeline::apply_legal_action;
        use crate::legal_actions::enumerate_legal_actions;
        use crate::undo::UndoStack;
        use mk_types::legal_action::LegalAction;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0].steady_tempo_version =
            Some(mk_types::pending::EffectMode::Powered);
        state.players[0]
            .play_area
            .push(CardId::from("steady_tempo"));

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        let legal = enumerate_legal_actions(&state, 0);
        let mut undo = UndoStack::new();

        let action = LegalAction::ResolveSteadyTempoDeckPlacement { place: true };
        apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

        // After resolve, end_turn resumes → card flow → draw up
        // steady_tempo was placed at top of deck, so it would be drawn first
        // Check that it was drawn into hand
        assert!(
            state.players[0]
                .hand
                .iter()
                .any(|c| c.as_str() == "steady_tempo"),
            "Powered: steady_tempo placed at top should be drawn into hand"
        );
    }

    #[test]
    fn steady_tempo_skip_stays_in_discard() {
        use crate::action_pipeline::apply_legal_action;
        use crate::legal_actions::enumerate_legal_actions;
        use crate::undo::UndoStack;
        use mk_types::legal_action::LegalAction;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0].steady_tempo_version =
            Some(mk_types::pending::EffectMode::Basic);
        state.players[0]
            .play_area
            .push(CardId::from("steady_tempo"));

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        let legal = enumerate_legal_actions(&state, 0);
        let mut undo = UndoStack::new();

        let action = LegalAction::ResolveSteadyTempoDeckPlacement { place: false };
        apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

        // Skip: steady_tempo stays in play_area → card flow moves to discard
        assert!(
            state.players[0]
                .discard
                .iter()
                .any(|c| c.as_str() == "steady_tempo"),
            "Skip: steady_tempo should end up in discard"
        );
    }

    // =========================================================================
    // Banner of Protection (via end-turn pending)
    // =========================================================================

    #[test]
    fn banner_protection_creates_pending_when_wounds_received() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0]
            .flags
            .insert(PlayerFlags::BANNER_OF_PROTECTION_ACTIVE);
        state.players[0].wounds_received_this_turn = WoundsReceived {
            hand: 1,
            discard: 0,
        };

        play_card(&mut state, 0, 0, false).unwrap();
        let result = end_turn(&mut state, 0).unwrap();

        assert!(
            matches!(result, EndTurnResult::AwaitingEndTurnChoice),
            "Should create pending, got {:?}",
            result,
        );
        assert!(matches!(
            state.players[0].pending.active,
            Some(ActivePending::BannerProtectionChoice)
        ));
    }

    #[test]
    fn banner_protection_no_wounds_no_pending() {
        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0]
            .flags
            .insert(PlayerFlags::BANNER_OF_PROTECTION_ACTIVE);
        state.players[0].wounds_received_this_turn = WoundsReceived {
            hand: 0,
            discard: 0,
        };

        play_card(&mut state, 0, 0, false).unwrap();
        let result = end_turn(&mut state, 0).unwrap();

        // No wounds → no pending → normal end turn
        assert!(
            !matches!(result, EndTurnResult::AwaitingEndTurnChoice),
            "No pending when no wounds received"
        );
    }

    #[test]
    fn banner_protection_remove_all_removes_wounds() {
        use crate::action_pipeline::apply_legal_action;
        use crate::legal_actions::enumerate_legal_actions;
        use crate::undo::UndoStack;
        use mk_types::legal_action::LegalAction;

        let mut state = setup_playing_game(vec!["march", "wound"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0]
            .flags
            .insert(PlayerFlags::BANNER_OF_PROTECTION_ACTIVE);
        state.players[0].wounds_received_this_turn = WoundsReceived {
            hand: 1,
            discard: 1,
        };
        state.players[0].discard.push(CardId::from("wound"));
        state.players[0]
            .play_area
            .push(CardId::from("banner_of_protection"));

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();
        // Pending BannerProtectionChoice

        let legal = enumerate_legal_actions(&state, 0);
        let mut undo = UndoStack::new();

        let action = LegalAction::ResolveBannerProtection { remove_all: true };
        apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

        // Wounds should be removed from hand and discard
        assert!(
            !state.players[0]
                .hand
                .iter()
                .any(|c| c.as_str() == "wound"),
            "Wounds should be removed from hand"
        );
        // banner_of_protection should be in removed_cards
        assert!(
            state.players[0]
                .removed_cards
                .iter()
                .any(|c| c.as_str() == "banner_of_protection"),
            "Banner should be destroyed (removed_cards)"
        );
    }

    #[test]
    fn banner_protection_decline_keeps_wounds() {
        use crate::action_pipeline::apply_legal_action;
        use crate::legal_actions::enumerate_legal_actions;
        use crate::undo::UndoStack;
        use mk_types::legal_action::LegalAction;

        let mut state = setup_playing_game(vec!["march", "wound"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();
        state.players[0]
            .flags
            .insert(PlayerFlags::BANNER_OF_PROTECTION_ACTIVE);
        state.players[0].wounds_received_this_turn = WoundsReceived {
            hand: 1,
            discard: 0,
        };
        state.players[0]
            .play_area
            .push(CardId::from("banner_of_protection"));

        play_card(&mut state, 0, 0, false).unwrap();
        end_turn(&mut state, 0).unwrap();

        let legal = enumerate_legal_actions(&state, 0);
        let mut undo = UndoStack::new();

        let action = LegalAction::ResolveBannerProtection { remove_all: false };
        apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

        // Wound stays in hand (drawn back from card flow)
        // banner_of_protection NOT destroyed (goes through normal card flow → discard)
        assert!(
            !state.players[0]
                .removed_cards
                .iter()
                .any(|c| c.as_str() == "banner_of_protection"),
            "Banner should NOT be destroyed on decline"
        );
    }

    // =========================================================================
    // End-turn step re-entrancy
    // =========================================================================

    #[test]
    fn end_turn_step_reentrancy_skips_completed_steps() {
        use crate::action_pipeline::apply_legal_action;
        use crate::legal_actions::enumerate_legal_actions;
        use crate::undo::UndoStack;
        use mk_types::legal_action::LegalAction;

        let mut state = setup_playing_game(vec!["march"]);
        state.players[0].deck = (0..5).map(|i| CardId::from(format!("c{}", i))).collect();

        // Set both crystal joy and steady tempo
        state.players[0].crystal_joy_reclaim_version =
            Some(mk_types::pending::EffectMode::Basic);
        state.players[0].steady_tempo_version =
            Some(mk_types::pending::EffectMode::Basic);
        state.players[0]
            .play_area
            .push(CardId::from("steady_tempo"));
        state.players[0].discard = vec![CardId::from("rage")];

        play_card(&mut state, 0, 0, false).unwrap();

        // First end_turn: should stop at Crystal Joy (step 2)
        let result = end_turn(&mut state, 0).unwrap();
        assert!(matches!(result, EndTurnResult::AwaitingEndTurnChoice));
        assert_eq!(state.players[0].end_turn_step, 2);
        assert!(matches!(
            state.players[0].pending.active,
            Some(ActivePending::CrystalJoyReclaim(_))
        ));

        // Resolve Crystal Joy (skip)
        let legal = enumerate_legal_actions(&state, 0);
        let mut undo = UndoStack::new();
        let action = LegalAction::ResolveCrystalJoyReclaim {
            discard_index: None,
        };
        apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

        // After resolve, end_turn resumes → hits Steady Tempo (step 3)
        assert_eq!(state.players[0].end_turn_step, 3);
        assert!(matches!(
            state.players[0].pending.active,
            Some(ActivePending::SteadyTempoDeckPlacement(_))
        ));

        // Resolve Steady Tempo (skip)
        let legal2 = enumerate_legal_actions(&state, 0);
        let action2 = LegalAction::ResolveSteadyTempoDeckPlacement { place: false };
        apply_legal_action(&mut state, &mut undo, 0, &action2, legal2.epoch).unwrap();

        // Turn should complete normally now
        assert!(!state.players[0].pending.has_active());
        assert_eq!(state.players[0].end_turn_step, 0, "Step should reset after turn ends");
    }

    // =========================================================================
    // Card play flag tracking
    // =========================================================================

    #[test]
    fn steady_tempo_card_play_sets_version_flag() {
        let mut state = setup_playing_game(vec!["steady_tempo"]);
        assert!(state.players[0].steady_tempo_version.is_none());

        play_card(&mut state, 0, 0, false).unwrap();
        assert_eq!(
            state.players[0].steady_tempo_version,
            Some(mk_types::pending::EffectMode::Basic)
        );
    }

    #[test]
    fn steady_tempo_powered_sets_powered_version() {
        let mut state = setup_playing_game(vec!["steady_tempo"]);
        // steady_tempo is powered by blue
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Blue,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });

        play_card(&mut state, 0, 0, true).unwrap();
        assert_eq!(
            state.players[0].steady_tempo_version,
            Some(mk_types::pending::EffectMode::Powered)
        );
    }
}
