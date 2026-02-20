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

use mk_data::levels::{get_level_from_fame, get_level_stats, get_levels_crossed};
use mk_data::tactics::get_tactics_for_time;
use mk_types::enums::*;
use mk_types::ids::*;
use mk_types::state::*;

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
/// Simplified Phase 2 flow:
/// 1. Check minimum turn requirement (must have played a card)
/// 2. Process level-ups from fame gained
/// 3. Card flow: play area → discard, draw up to hand limit
/// 4. Return mana dice
/// 5. Reset player turn state
/// 6. Determine next player or trigger round end
///
/// Many TS steps are deferred to later phases (TODOs below).
pub fn end_turn(state: &mut GameState, player_idx: usize) -> Result<EndTurnResult, EndTurnError> {
    if player_idx >= state.players.len() {
        return Err(EndTurnError::InvalidPlayerIndex);
    }

    // Step 0: Minimum turn requirement
    // Player must have played at least 1 card or rested.
    // In Phase 2, we check the flag. In the full game, this would trigger
    // a mandatory discard if not met.
    let player = &state.players[player_idx];
    if !player
        .flags
        .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN)
        && !player.flags.contains(PlayerFlags::HAS_RESTED_THIS_TURN)
    {
        return Err(EndTurnError::MinimumTurnRequirementNotMet);
    }

    // TODO: Step 1 — Magical Glade wound check
    // TODO: Step 2 — Auto-announce end of round (hand+deck empty)
    // TODO: Step 3 — Mine crystal rewards
    // TODO: Step 3a — Crystal Joy reclaim
    // TODO: Step 3b — Steady Tempo deck placement
    // TODO: Step 3c — Banner of Protection wound removal
    // TODO: Step 4 — Mysterious Box cleanup
    // TODO: Step 5 — Crystal Mastery return
    // TODO: Step 6 — Ring artifact fame bonus

    // Step 7: Process level-ups
    process_level_ups(state, player_idx);

    // TODO: Step 8 — Mountain Lore hand limit bonus

    // Step 9: Card flow — play area → discard, draw up to hand limit
    process_card_flow(state, player_idx);

    // Step 10: Reset player turn state
    reset_player_turn(&mut state.players[player_idx]);

    // TODO: Step 11 — Source Opening crystal

    // Step 12: Return mana dice
    return_player_dice(state, player_idx);

    // TODO: Step 13 — Expire turn-duration modifiers

    // Step 14-16: Determine next player or round end
    let result = advance_turn(state, player_idx);

    Ok(result)
}

// =============================================================================
// Level-up processing
// =============================================================================

/// Process any level-ups earned by the player based on current fame.
///
/// Updates level, armor, hand_limit, and command_tokens from the level stats table.
/// Even-level skill choices are deferred (TODO: pending level-up rewards).
fn process_level_ups(state: &mut GameState, player_idx: usize) {
    let player = &state.players[player_idx];
    let old_fame_level = player.level;
    let new_level = get_level_from_fame(player.fame);

    if new_level <= old_fame_level {
        return;
    }

    let crossed = get_levels_crossed(
        // Compute old fame threshold that gave old_fame_level
        // Actually just pass current fame with old level info
        0, // doesn't matter — we already know the levels crossed
        player.fame,
    );

    // Use the final level's stats
    let stats = get_level_stats(new_level);
    let player = &mut state.players[player_idx];
    player.level = new_level;
    player.armor = stats.armor;
    player.hand_limit = stats.hand_limit;
    player.command_tokens = stats.command_slots;

    // TODO: For even levels (2, 4, 6, 8, 10), queue skill choice to pendingLevelUpRewards
    // For now, we just update stats. Skill selection requires the pending state system.
    let _crossed = crossed; // suppress unused warning
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
    // TODO: Keep bonus (adjacent to owned keep), Planning tactic bonus, Meditation bonus
    let draw_limit = player.hand_limit as usize;

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

    // TODO: pendingSourceOpeningRerollChoice, pendingMeditation, mysteriousBoxState
    player.mysterious_box_state = None;
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
        return EndTurnResult::RoundEnded {
            new_round: state.round,
        };
    }

    // Check for game end
    if state.game_ended {
        return EndTurnResult::GameEnded;
    }

    // TODO: Extra turn check (The Right Moment tactic, Time Bending)

    // Advance to next player
    let next_idx = ((current_player_idx as u32 + 1) % state.turn_order.len() as u32) as usize;
    state.current_player_index = next_idx as u32;

    // TODO: Skip dummy player (auto-execute their turn)
    // TODO: Setup next player (Magical Glade mana, Sparing Power, Plunder decision)

    EndTurnResult::NextPlayer {
        next_player_idx: next_idx,
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
// End round
// =============================================================================

/// Process end of round: day/night toggle, mana reset, deck reshuffle, new tactics.
///
/// Matches TS `createEndRoundCommand()` in `endRound/index.ts`.
fn end_round(state: &mut GameState) {
    // TODO: Game end check (scenario total rounds reached)

    // 1. Toggle day/night
    state.time_of_day = match state.time_of_day {
        TimeOfDay::Day => TimeOfDay::Night,
        TimeOfDay::Night => TimeOfDay::Day,
    };

    // TODO: Dawn effect — reveal face-down ruins tokens when Night → Day

    // 2. Reset mana source (reroll all dice for new time of day)
    let player_count = state.players.len() as u32;
    state.source = create_mana_source(player_count, state.time_of_day, &mut state.rng);

    // TODO: 3. Dummy offer gains (solo mode)
    // TODO: 4. Offer refresh

    // 5. Player round reset (reshuffle + draw)
    for player_idx in 0..state.players.len() {
        reset_player_round(state, player_idx);
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
    // TODO: Remove used tactics in solo mode (TACTIC_REMOVAL_ALL_USED)

    state.round_phase = RoundPhase::TacticsSelection;
    // TODO: Determine tactic selection order from previous round's tactic numbers
    // For now, keep current turn order
    state.tactics_selection_order = state.turn_order.clone();
    state.current_tactic_selector = state.tactics_selection_order.first().cloned();

    // TODO: Expire round-duration modifiers
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
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::card_play::{play_card, play_card_sideways};
    use crate::setup::create_solo_game;
    use mk_types::ids::CardId;

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
}
