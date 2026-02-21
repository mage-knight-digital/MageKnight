//! Card play commands — PLAY_CARD (basic/powered) and PLAY_CARD_SIDEWAYS.
//!
//! Matches TS `playCardCommand.ts` and `playCardSidewaysCommand.ts`.

use mk_data::cards::get_card;
use mk_types::enums::*;
use mk_types::modifier::{ModifierEffect, ModifierSource, RuleOverride, SidewaysCondition};
use mk_types::pending::{ActivePending, ContinuationEntry, PendingChoice};
use mk_types::state::*;

use crate::effect_queue::{DrainResult, EffectQueue};

// =============================================================================
// Error types
// =============================================================================

/// Errors from card play validation/execution.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CardPlayError {
    CardNotInHand,
    InvalidHandIndex,
    CardNotFound,
    NotPowerable,
    ManaSourceRequired,
    InvalidManaSource,
    NotInCombat,
}

// =============================================================================
// Card play result
// =============================================================================

/// Result of playing a card.
#[derive(Debug)]
pub enum CardPlayResult {
    /// Effect resolved completely (no pending choice).
    Complete,
    /// Effect paused — player.pending.active is now set with a choice.
    /// Caller should check state.players[idx].pending.has_active().
    PendingChoice,
}

// =============================================================================
// Play card (basic or powered)
// =============================================================================

/// Play a card from hand (basic or powered mode).
///
/// Steps:
/// 1. Validate card is in hand at the given index
/// 2. Look up card definition
/// 3. If powered, validate and consume mana (token or crystal)
/// 4. Move card from hand to play area
/// 5. Resolve the card's effect via effect queue
pub fn play_card(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
    powered: bool,
) -> Result<CardPlayResult, CardPlayError> {
    let player = &state.players[player_idx];

    // Validate hand index
    if hand_index >= player.hand.len() {
        return Err(CardPlayError::InvalidHandIndex);
    }

    let card_id = player.hand[hand_index].clone();

    // Look up card definition
    let card_def = get_card(card_id.as_str()).ok_or(CardPlayError::CardNotFound)?;

    // Determine which effect to use
    let effect = if powered {
        // Validate the card can be powered
        let required_color = card_def.powered_by.ok_or(CardPlayError::NotPowerable)?;

        // Try to consume mana payment (token first, then crystal)
        consume_mana_payment(state, player_idx, required_color)?;

        card_def.powered_effect.clone()
    } else {
        card_def.basic_effect.clone()
    };

    // Move card from hand to play area
    let player = &mut state.players[player_idx];
    player.hand.remove(hand_index);
    player.play_area.push(card_id.clone());
    player
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

    // Resolve the effect via effect queue
    let mut queue = EffectQueue::new();
    queue.push(effect, Some(card_id.clone()));
    match queue.drain(state, player_idx) {
        DrainResult::Complete => Ok(CardPlayResult::Complete),
        DrainResult::NeedsChoice {
            options,
            continuation,
            resolution,
        } => {
            // Store the choice in player pending state
            state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                card_id: Some(card_id),
                skill_id: None,
                unit_instance_id: None,
                options,
                continuation: continuation
                    .into_iter()
                    .map(|q| ContinuationEntry {
                        effect: q.effect,
                        source_card_id: q.source_card_id,
                    })
                    .collect(),
                movement_bonus_applied: false,
                resolution,
            }));
            Ok(CardPlayResult::PendingChoice)
        }
        DrainResult::PendingSet => {
            // A custom pending (e.g., DiscardForBonus) was set directly on the player.
            Ok(CardPlayResult::PendingChoice)
        }
    }
}

// =============================================================================
// Mana payment
// =============================================================================

/// Consume mana payment for a powered card play.
///
/// Phase 2 simplified: auto-consume first matching source in priority order:
/// 1. Matching-color mana token from pure_mana
/// 2. Gold mana token (wild)
/// 3. Matching-color crystal (spend crystal → mana token → consumed)
///
/// Full implementation (Phase 4) would accept a `ManaSourceInfo` specifying
/// exactly which source to use (token index, crystal color, or source die ID).
fn consume_mana_payment(
    state: &mut GameState,
    player_idx: usize,
    required_color: BasicManaColor,
) -> Result<(), CardPlayError> {
    let target_mana = ManaColor::from(required_color);
    let player = &mut state.players[player_idx];

    // 1. Try matching-color mana token
    if let Some(idx) = player.pure_mana.iter().position(|t| t.color == target_mana) {
        player.pure_mana.remove(idx);
        return Ok(());
    }

    // 2. Try gold mana token (wild, powers any card)
    if let Some(idx) = player
        .pure_mana
        .iter()
        .position(|t| t.color == ManaColor::Gold)
    {
        player.pure_mana.remove(idx);
        return Ok(());
    }

    // 3. Try matching-color crystal
    let crystal = match required_color {
        BasicManaColor::Red => &mut player.crystals.red,
        BasicManaColor::Blue => &mut player.crystals.blue,
        BasicManaColor::Green => &mut player.crystals.green,
        BasicManaColor::White => &mut player.crystals.white,
    };
    if *crystal > 0 {
        *crystal -= 1;
        player.spent_crystals_this_turn = {
            let mut spent = player.spent_crystals_this_turn;
            match required_color {
                BasicManaColor::Red => spent.red += 1,
                BasicManaColor::Blue => spent.blue += 1,
                BasicManaColor::Green => spent.green += 1,
                BasicManaColor::White => spent.white += 1,
            }
            spent
        };
        return Ok(());
    }

    Err(CardPlayError::ManaSourceRequired)
}

// =============================================================================
// Sideways value resolution
// =============================================================================

/// Check if a rule override is active for the given player.
pub fn is_rule_active(state: &GameState, player_idx: usize, rule: RuleOverride) -> bool {
    let player_id = &state.players[player_idx].id;
    state.active_modifiers.iter().any(|m| {
        m.created_by_player_id == *player_id
            && matches!(&m.effect, ModifierEffect::RuleOverride { rule: r } if *r == rule)
    })
}

/// Compute the effective sideways value for a card, considering active modifiers.
///
/// Base value: 0 for wounds, `card_def.sideways_value` for others.
/// Modifiers can increase the value via `ModifierEffect::SidewaysValue`.
pub fn get_effective_sideways_value(
    state: &GameState,
    player_idx: usize,
    is_wound: bool,
    card_type: DeedCardType,
    card_powered_by: Option<BasicManaColor>,
) -> u32 {
    let base_value: u32 = if is_wound { 0 } else { 1 };
    let player_id = &state.players[player_idx].id;
    let used_mana = state.players[player_idx]
        .flags
        .contains(PlayerFlags::USED_MANA_FROM_SOURCE);
    let mut best = base_value;
    for m in &state.active_modifiers {
        if m.created_by_player_id != *player_id {
            continue;
        }
        if let ModifierEffect::SidewaysValue {
            new_value,
            for_wounds,
            condition,
            mana_color,
            ref for_card_types,
        } = m.effect
        {
            if is_wound && !for_wounds {
                continue;
            }
            if !is_wound && for_wounds {
                continue;
            }
            if !for_card_types.is_empty() && !for_card_types.contains(&card_type) {
                continue;
            }
            match condition {
                Some(SidewaysCondition::NoManaUsed) if used_mana => continue,
                Some(SidewaysCondition::WithManaMatchingColor) => {
                    if card_powered_by != mana_color {
                        continue;
                    }
                }
                _ => {}
            }
            best = best.max(new_value);
        }
    }
    best
}

// =============================================================================
// Play card sideways
// =============================================================================

/// Play a card sideways from hand for 1 move/influence/attack/block.
///
/// Steps:
/// 1. Validate card is in hand at the given index
/// 2. Move card from hand to play area
/// 3. Apply sideways resource (move/influence/attack/block points)
pub fn play_card_sideways(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
    sideways_as: SidewaysAs,
) -> Result<(), CardPlayError> {
    let player = &state.players[player_idx];

    // Validate hand index
    if hand_index >= player.hand.len() {
        return Err(CardPlayError::InvalidHandIndex);
    }

    let card_id = player.hand[hand_index].clone();

    // Look up card definition for sideways value
    let card_def = get_card(card_id.as_str()).ok_or(CardPlayError::CardNotFound)?;
    let is_wound = card_id.as_str() == "wound";
    let value = get_effective_sideways_value(
        state,
        player_idx,
        is_wound,
        card_def.card_type,
        card_def.powered_by,
    );

    // Move card from hand to play area
    let player = &mut state.players[player_idx];
    player.hand.remove(hand_index);
    player.play_area.push(card_id);
    player
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

    // Apply sideways effect
    apply_sideways_effect(state, player_idx, sideways_as, value);

    // Power of Pain: one-shot consumption after wound sideways play
    if is_wound {
        let pid = state.players[player_idx].id.clone();
        state.active_modifiers.retain(|m| {
            !matches!(&m.source, ModifierSource::Skill { skill_id, player_id }
                if skill_id.as_str() == "arythea_power_of_pain" && *player_id == pid)
        });
    }

    Ok(())
}

/// Apply the sideways resource gain to the player.
fn apply_sideways_effect(
    state: &mut GameState,
    player_idx: usize,
    sideways_as: SidewaysAs,
    value: u32,
) {
    let player = &mut state.players[player_idx];
    match sideways_as {
        SidewaysAs::Move => {
            player.move_points += value;
        }
        SidewaysAs::Influence => {
            player.influence_points += value;
        }
        SidewaysAs::Attack => {
            // Sideways attack is always physical melee
            player.combat_accumulator.attack.normal += value;
            player.combat_accumulator.attack.normal_elements.physical += value;
        }
        SidewaysAs::Block => {
            // Sideways block is always physical
            player.combat_accumulator.block += value;
            player.combat_accumulator.block_elements.physical += value;
        }
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use mk_types::ids::CardId;

    /// Helper to create a game state with one player holding specific cards.
    fn setup_game(hand: Vec<&str>) -> GameState {
        use crate::setup::create_solo_game;

        let mut state = create_solo_game(42, Hero::Arythea);
        // Replace hand with specified cards
        state.players[0].hand = hand.into_iter().map(CardId::from).collect();
        state
    }

    /// Give the player a mana token of the specified color.
    fn give_mana(state: &mut GameState, color: ManaColor) {
        state.players[0].pure_mana.push(ManaToken {
            color,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    }

    #[test]
    fn play_march_basic_gains_2_move() {
        let mut state = setup_game(vec!["march", "rage"]);
        assert_eq!(state.players[0].move_points, 0);

        let result = play_card(&mut state, 0, 0, false).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));

        assert_eq!(state.players[0].move_points, 2);
        assert_eq!(state.players[0].hand.len(), 1); // rage remains
        assert_eq!(state.players[0].play_area.len(), 1);
        assert_eq!(state.players[0].play_area[0].as_str(), "march");
    }

    #[test]
    fn play_march_powered_gains_4_move() {
        let mut state = setup_game(vec!["march"]);
        give_mana(&mut state, ManaColor::Green); // march powered by green

        let result = play_card(&mut state, 0, 0, true).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));

        assert_eq!(state.players[0].move_points, 4);
        assert!(state.players[0].pure_mana.is_empty()); // mana consumed
    }

    #[test]
    fn play_promise_basic_gains_2_influence() {
        let mut state = setup_game(vec!["promise"]);

        play_card(&mut state, 0, 0, false).unwrap();
        assert_eq!(state.players[0].influence_points, 2);
    }

    #[test]
    fn play_threaten_basic_gains_2_influence() {
        let mut state = setup_game(vec!["threaten"]);

        play_card(&mut state, 0, 0, false).unwrap();
        assert_eq!(state.players[0].influence_points, 2);
    }

    #[test]
    fn play_threaten_powered_gains_5_influence_minus_1_rep() {
        let mut state = setup_game(vec!["threaten"]);
        give_mana(&mut state, ManaColor::Red); // threaten powered by red

        play_card(&mut state, 0, 0, true).unwrap();
        assert_eq!(state.players[0].influence_points, 5);
        assert_eq!(state.players[0].reputation, -1);
    }

    #[test]
    fn play_rage_basic_returns_choice() {
        let mut state = setup_game(vec!["rage"]);
        // Rage basic is a choice (attack or block), but no combat
        // so attack isn't resolvable. Only block might be if in combat.
        // Actually: both attack and block require combat.
        // With no combat, neither is resolvable, so the choice may be skipped.

        // Without combat: GainAttack and GainBlock are only resolvable in combat.
        // The choice should skip (0 resolvable options).
        let result = play_card(&mut state, 0, 0, false).unwrap();
        // No combat = no options resolvable = skip
        assert!(matches!(result, CardPlayResult::Complete));
    }

    #[test]
    fn play_tranquility_basic_returns_choice() {
        let mut state = setup_game(vec!["tranquility"]);
        // Tranquility basic: choice of heal 1 or draw 1
        // Heal requires wounds in hand or wounded units (false here)
        // Draw requires cards in deck (true)
        // So 1 option resolvable → auto-resolve draw
        let result = play_card(&mut state, 0, 0, false).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        // Should have drawn 1 card
        assert_eq!(state.players[0].hand.len(), 1); // was 0 after play, drew 1
    }

    #[test]
    fn play_sideways_as_move() {
        let mut state = setup_game(vec!["rage", "march"]);
        assert_eq!(state.players[0].move_points, 0);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();

        assert_eq!(state.players[0].move_points, 1);
        assert_eq!(state.players[0].hand.len(), 1); // march remains
        assert_eq!(state.players[0].play_area[0].as_str(), "rage");
    }

    #[test]
    fn play_sideways_as_influence() {
        let mut state = setup_game(vec!["march"]);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Influence).unwrap();
        assert_eq!(state.players[0].influence_points, 1);
    }

    #[test]
    fn play_sideways_as_attack_adds_physical_melee() {
        let mut state = setup_game(vec!["march"]);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Attack).unwrap();
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 1);
        assert_eq!(
            state.players[0]
                .combat_accumulator
                .attack
                .normal_elements
                .physical,
            1
        );
    }

    #[test]
    fn play_sideways_as_block_adds_physical() {
        let mut state = setup_game(vec!["march"]);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Block).unwrap();
        assert_eq!(state.players[0].combat_accumulator.block, 1);
        assert_eq!(
            state.players[0].combat_accumulator.block_elements.physical,
            1
        );
    }

    #[test]
    fn invalid_hand_index_returns_error() {
        let mut state = setup_game(vec!["march"]);

        let result = play_card(&mut state, 0, 5, false);
        assert_eq!(result.unwrap_err(), CardPlayError::InvalidHandIndex);
    }

    #[test]
    fn unknown_card_returns_error() {
        let mut state = setup_game(vec![]);
        state.players[0].hand.push(CardId::from("nonexistent_card"));

        let result = play_card(&mut state, 0, 0, false);
        assert_eq!(result.unwrap_err(), CardPlayError::CardNotFound);
    }

    #[test]
    fn card_moves_to_play_area() {
        let mut state = setup_game(vec!["march", "stamina", "rage"]);

        play_card(&mut state, 0, 1, false).unwrap(); // play stamina (index 1)

        assert_eq!(state.players[0].hand.len(), 2);
        assert_eq!(state.players[0].hand[0].as_str(), "march");
        assert_eq!(state.players[0].hand[1].as_str(), "rage");
        assert_eq!(state.players[0].play_area.len(), 1);
        assert_eq!(state.players[0].play_area[0].as_str(), "stamina");
    }

    #[test]
    fn played_card_from_hand_flag_set() {
        let mut state = setup_game(vec!["march"]);
        assert!(!state.players[0]
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN));

        play_card(&mut state, 0, 0, false).unwrap();

        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN));
    }

    #[test]
    fn multiple_cards_can_be_played() {
        let mut state = setup_game(vec!["march", "stamina", "promise"]);

        play_card(&mut state, 0, 0, false).unwrap(); // play march
        play_card(&mut state, 0, 0, false).unwrap(); // play stamina (now at index 0)
        play_card(&mut state, 0, 0, false).unwrap(); // play promise (now at index 0)

        assert_eq!(state.players[0].hand.len(), 0);
        assert_eq!(state.players[0].play_area.len(), 3);
        assert_eq!(state.players[0].move_points, 4); // march(2) + stamina(2)
        assert_eq!(state.players[0].influence_points, 2); // promise(2)
    }

    #[test]
    fn concentration_basic_sets_pending_choice() {
        let mut state = setup_game(vec!["concentration"]);

        let result = play_card(&mut state, 0, 0, false).unwrap();
        // Concentration basic: choice of blue/white/red mana
        // All 3 options are always resolvable (GainMana is always OK)
        // So it should set pending choice with 3 options
        assert!(matches!(result, CardPlayResult::PendingChoice));
        assert!(state.players[0].pending.has_active());
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 3);
        } else {
            panic!("Expected ActivePending::Choice");
        }
    }

    #[test]
    fn krang_ruthless_coercion_powered_compound() {
        let mut state = setup_game(vec!["krang_ruthless_coercion"]);
        give_mana(&mut state, ManaColor::Red); // krang_ruthless_coercion powered by red

        play_card(&mut state, 0, 0, true).unwrap();
        assert_eq!(state.players[0].influence_points, 7);
        assert_eq!(state.players[0].reputation, -2);
    }

    #[test]
    fn sideways_wound_has_zero_value() {
        let mut state = setup_game(vec!["wound"]);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        assert_eq!(state.players[0].move_points, 0); // wound sideways value = 0
    }

    // ---- P0 starting-deck card integration tests ----

    #[test]
    fn concentration_resolve_choice_gains_mana() {
        use crate::effect_queue::resolve_pending_choice;

        let mut state = setup_game(vec!["concentration"]);
        let result = play_card(&mut state, 0, 0, false).unwrap();
        assert!(matches!(result, CardPlayResult::PendingChoice));

        // Resolve: pick blue mana (index 0)
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert_eq!(
            state.players[0].pure_mana[0].color,
            mk_types::enums::ManaColor::Blue
        );
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn concentration_powered_card_boost_no_targets_skips() {
        // Only "concentration" in hand — after playing it, hand is empty → boost skips
        let mut state = setup_game(vec!["concentration"]);
        give_mana(&mut state, ManaColor::Green); // concentration powered by green
        let result = play_card(&mut state, 0, 0, true).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert!(state.players[0].pure_mana.is_empty()); // mana consumed
    }

    #[test]
    fn concentration_powered_card_boost_with_target() {
        // "concentration" + "march" in hand — plays concentration powered,
        // CardBoost auto-selects march (only eligible), resolves march powered +2
        let mut state = setup_game(vec!["concentration", "march"]);
        give_mana(&mut state, ManaColor::Green);
        let result = play_card(&mut state, 0, 0, true).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        // march powered_effect = GainMove{4}, boosted by 2 → GainMove{6}
        assert_eq!(state.players[0].move_points, 6);
        // Both cards in play area
        assert_eq!(state.players[0].play_area.len(), 2);
        assert!(state.players[0].hand.is_empty());
    }

    #[test]
    fn concentration_powered_card_boost_chains_to_pending_choice_in_combat() {
        use crate::effect_queue::resolve_pending_choice;
        use mk_types::effect::CardEffect;

        let mut state = setup_game(vec!["concentration", "wolfhawk_swift_reflexes"]);
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::RangedSiege,
            ..CombatState::default()
        }));
        give_mana(&mut state, ManaColor::Green); // concentration powered by green

        let result = play_card(&mut state, 0, 0, true).unwrap();
        assert!(matches!(result, CardPlayResult::PendingChoice));
        assert_eq!(state.players[0].play_area.len(), 2);
        assert!(state.players[0].hand.is_empty());

        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2);
            let mut saw_attack = false;
            let mut saw_block = false;
            for opt in &choice.options {
                match opt {
                    CardEffect::GainAttack { amount, .. } => {
                        saw_attack = true;
                        assert_eq!(*amount, 5); // Swift Reflexes powered 3 + Concentration bonus 2
                    }
                    CardEffect::GainBlock { amount, .. } => {
                        saw_block = true;
                        assert_eq!(*amount, 5); // Swift Reflexes powered 3 + Concentration bonus 2
                    }
                    other => panic!("Unexpected boosted swift reflexes option: {:?}", other),
                }
            }
            assert!(saw_attack && saw_block);
        } else {
            panic!("Expected pending choice from boosted Swift Reflexes in combat");
        }

        // Resolve attack option and verify boosted value is applied.
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 5);
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn crystallize_basic_no_mana_skips() {
        let mut state = setup_game(vec!["crystallize"]);
        // No mana tokens → ConvertManaToCrystal skips
        let result = play_card(&mut state, 0, 0, false).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
    }

    #[test]
    fn crystallize_basic_with_mana_crystallizes() {
        let mut state = setup_game(vec!["crystallize"]);
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color: mk_types::enums::ManaColor::Red,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let result = play_card(&mut state, 0, 0, false).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].crystals.red, 1);
        assert!(state.players[0].pure_mana.is_empty());
    }

    #[test]
    fn crystallize_powered_offers_crystal_choice() {
        use crate::effect_queue::resolve_pending_choice;

        let mut state = setup_game(vec!["crystallize"]);
        give_mana(&mut state, ManaColor::Blue); // crystallize powered by blue
        let result = play_card(&mut state, 0, 0, true).unwrap();
        // Powered crystallize: choice of 4 crystal colors
        assert!(matches!(result, CardPlayResult::PendingChoice));

        // Resolve: pick green (index 2)
        resolve_pending_choice(&mut state, 0, 2).unwrap();
        assert_eq!(state.players[0].crystals.green, 1);
    }

    #[test]
    fn mana_draw_basic_adds_rule_modifier() {
        let mut state = setup_game(vec!["mana_draw"]);
        let result = play_card(&mut state, 0, 0, false).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.active_modifiers.len(), 1);
    }

    #[test]
    fn mana_draw_powered_offers_color_choice() {
        use crate::effect_queue::resolve_pending_choice;

        let mut state = setup_game(vec!["mana_draw"]);
        give_mana(&mut state, ManaColor::White); // mana_draw powered by white
        let result = play_card(&mut state, 0, 0, true).unwrap();
        assert!(matches!(result, CardPlayResult::PendingChoice));

        // Resolve: pick red (index 0) — should gain 2 red mana tokens
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].pure_mana.len(), 2);
        assert_eq!(
            state.players[0].pure_mana[0].color,
            mk_types::enums::ManaColor::Red
        );
    }

    #[test]
    fn improvisation_basic_discard_and_choice() {
        let mut state = setup_game(vec!["improvisation", "march"]);
        let result = play_card(&mut state, 0, 0, false).unwrap();
        // Improvisation: discard 1 non-wound, then choice of move/influence/attack/block
        // Only march left in hand → discard it → then present choice
        // Attack and block require combat → 2 of 4 options filtered
        // Move and influence both resolvable → pending choice
        assert!(matches!(result, CardPlayResult::PendingChoice));
        assert_eq!(state.players[0].hand.len(), 0); // march discarded + improvisation played
        assert_eq!(state.players[0].discard.len(), 1); // march discarded
    }

    #[test]
    fn improvisation_no_non_wound_cards_skips() {
        let mut state = setup_game(vec!["improvisation"]);
        // After improvisation is played from hand, hand is empty → can't discard
        let result = play_card(&mut state, 0, 0, false).unwrap();
        assert!(matches!(result, CardPlayResult::Complete)); // skipped
    }

    // ---- Mana payment tests ----

    #[test]
    fn powered_without_mana_returns_error() {
        let mut state = setup_game(vec!["march"]);
        let result = play_card(&mut state, 0, 0, true);
        assert_eq!(result.unwrap_err(), CardPlayError::ManaSourceRequired);
        // Card should still be in hand (not moved to play area)
        assert_eq!(state.players[0].hand.len(), 1);
        assert!(state.players[0].play_area.is_empty());
    }

    #[test]
    fn powered_with_gold_mana_succeeds() {
        let mut state = setup_game(vec!["march"]);
        give_mana(&mut state, ManaColor::Gold); // gold is wild
        let result = play_card(&mut state, 0, 0, true).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 4);
        assert!(state.players[0].pure_mana.is_empty());
    }

    #[test]
    fn powered_with_crystal_payment() {
        let mut state = setup_game(vec!["march"]);
        state.players[0].crystals.green = 2; // march powered by green
        let result = play_card(&mut state, 0, 0, true).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 4);
        assert_eq!(state.players[0].crystals.green, 1); // one spent
        assert_eq!(state.players[0].spent_crystals_this_turn.green, 1);
    }

    #[test]
    fn powered_prefers_token_over_crystal() {
        let mut state = setup_game(vec!["march"]);
        give_mana(&mut state, ManaColor::Green);
        state.players[0].crystals.green = 2;
        play_card(&mut state, 0, 0, true).unwrap();
        // Should consume token, not crystal
        assert!(state.players[0].pure_mana.is_empty());
        assert_eq!(state.players[0].crystals.green, 2); // crystal untouched
    }

    #[test]
    fn powered_wrong_color_mana_fails() {
        let mut state = setup_game(vec!["march"]);
        give_mana(&mut state, ManaColor::Red); // march needs green, not red
        let result = play_card(&mut state, 0, 0, true);
        assert_eq!(result.unwrap_err(), CardPlayError::ManaSourceRequired);
    }

    // ---- get_effective_sideways_value tests ----

    #[test]
    fn get_effective_sideways_value_base_returns_1() {
        let state = setup_game(vec!["march"]);
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::BasicAction, Some(BasicManaColor::Green));
        assert_eq!(val, 1);
    }

    #[test]
    fn get_effective_sideways_value_wound_returns_0() {
        let state = setup_game(vec!["wound"]);
        let val = get_effective_sideways_value(&state, 0, true, DeedCardType::Wound, None);
        assert_eq!(val, 0);
    }

    #[test]
    fn get_effective_sideways_value_with_modifier() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let mut state = setup_game(vec!["march"]);
        let pid = state.players[0].id.clone();
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("test_1"),
            source: ModifierSource::Skill { skill_id: mk_types::ids::SkillId::from("test"), player_id: pid.clone() },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::SidewaysValue {
                new_value: 2, for_wounds: false, condition: None, mana_color: None, for_card_types: vec![],
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::BasicAction, Some(BasicManaColor::Green));
        assert_eq!(val, 2);
    }

    #[test]
    fn get_effective_sideways_value_wound_with_for_wounds() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let mut state = setup_game(vec!["wound"]);
        let pid = state.players[0].id.clone();
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("test_1"),
            source: ModifierSource::Skill { skill_id: mk_types::ids::SkillId::from("test"), player_id: pid.clone() },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::SidewaysValue {
                new_value: 2, for_wounds: true, condition: None, mana_color: None, for_card_types: vec![],
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });
        let val = get_effective_sideways_value(&state, 0, true, DeedCardType::Wound, None);
        assert_eq!(val, 2);
    }

    #[test]
    fn get_effective_sideways_value_card_type_filter() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let mut state = setup_game(vec!["march"]);
        let pid = state.players[0].id.clone();
        // Modifier only for AA/Spell/Artifact
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("test_1"),
            source: ModifierSource::Skill { skill_id: mk_types::ids::SkillId::from("test"), player_id: pid.clone() },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::SidewaysValue {
                new_value: 3, for_wounds: false, condition: None, mana_color: None,
                for_card_types: vec![DeedCardType::AdvancedAction, DeedCardType::Spell, DeedCardType::Artifact],
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });
        // BasicAction: doesn't match filter, stays at base 1
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::BasicAction, Some(BasicManaColor::Green));
        assert_eq!(val, 1);
        // AdvancedAction: matches filter, gets 3
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::AdvancedAction, Some(BasicManaColor::Red));
        assert_eq!(val, 3);
    }

    #[test]
    fn get_effective_sideways_value_no_mana_condition() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let mut state = setup_game(vec!["march"]);
        let pid = state.players[0].id.clone();
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("test_1"),
            source: ModifierSource::Skill { skill_id: mk_types::ids::SkillId::from("test"), player_id: pid.clone() },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::SidewaysValue {
                new_value: 3, for_wounds: false, condition: Some(SidewaysCondition::NoManaUsed), mana_color: None, for_card_types: vec![],
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });
        // No mana used: value = 3
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::BasicAction, None);
        assert_eq!(val, 3);
        // After mana used: value = 1 (base)
        state.players[0].flags.insert(PlayerFlags::USED_MANA_FROM_SOURCE);
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::BasicAction, None);
        assert_eq!(val, 1);
    }

    #[test]
    fn power_of_pain_wound_sideways_enhanced() {
        use crate::action_pipeline;
        let mut state = setup_game(vec!["wound"]);
        let skill_id = mk_types::ids::SkillId::from("arythea_power_of_pain");
        state.players[0].skills.push(skill_id.clone());
        // Activate skill
        action_pipeline::apply_power_of_pain_pub(&mut state, 0, &skill_id);
        // Wound sideways value should now be 2
        let val = get_effective_sideways_value(&state, 0, true, DeedCardType::Wound, None);
        assert_eq!(val, 2);
        assert!(is_rule_active(&state, 0, RuleOverride::WoundsPlayableSideways));
    }

    #[test]
    fn power_of_pain_consumed_after_wound_play() {
        use crate::action_pipeline;
        let mut state = setup_game(vec!["wound"]);
        let skill_id = mk_types::ids::SkillId::from("arythea_power_of_pain");
        state.players[0].skills.push(skill_id.clone());
        // Activate skill
        action_pipeline::apply_power_of_pain_pub(&mut state, 0, &skill_id);
        assert_eq!(state.active_modifiers.len(), 2); // RuleOverride + SidewaysValue
        // Play wound sideways
        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        assert_eq!(state.players[0].move_points, 2); // wound sideways = 2
        // Modifiers consumed (one-shot)
        assert_eq!(state.active_modifiers.len(), 0);
    }
}
