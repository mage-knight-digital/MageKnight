//! Multi-step and cost-based effect handlers.

use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::ids::CardId;
use mk_types::pending::{
    ActivePending, AttackDefeatFameTracker, ChoiceResolution, DeferredPending,
    PendingDecompose, PendingMaximalEffect, PendingTraining, BookOfWisdomPhase, EffectMode,
};
use mk_types::state::*;
use arrayvec::ArrayVec;

use super::{ResolveResult, WOUND_CARD_ID};
use super::atomic::apply_gain_attack;
use super::conditions::is_resolvable;
use super::utils::*;

pub(super) fn apply_discard_for_bonus(
    state: &mut GameState,
    player_idx: usize,
    choice_options: &[CardEffect],
    bonus_per_card: u32,
    max_discards: u32,
    discard_filter: DiscardForBonusFilter,
) -> ResolveResult {
    use mk_types::pending::PendingDiscardForBonus;

    // Filter to resolvable options only
    let resolvable: Vec<CardEffect> = choice_options
        .iter()
        .filter(|opt| is_resolvable(state, player_idx, opt))
        .cloned()
        .collect();

    if resolvable.is_empty() {
        return ResolveResult::Skipped;
    }

    // Get the source card from the play area (most recently played)
    let source_card_id = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from("unknown"));

    // Set ActivePending::DiscardForBonus directly
    let pending = PendingDiscardForBonus {
        source_card_id,
        choice_options: resolvable,
        bonus_per_card,
        max_discards,
        discard_filter,
    };
    state.players[player_idx].pending.active =
        Some(ActivePending::DiscardForBonus(pending));

    // Return PendingSet to pause the queue
    ResolveResult::PendingSet
}

/// Apply Decompose effect — set pending so player can select which card to decompose.
///
/// Finds eligible hand cards (BasicAction or AdvancedAction), presents as pending.
/// 0 eligible → skip. 1 eligible → auto-select (the player still sees pending).
/// N eligible → pending with all options.
pub(super) fn apply_decompose(
    state: &mut GameState,
    player_idx: usize,
    mode: EffectMode,
) -> ResolveResult {
    let player = &state.players[player_idx];

    // Find eligible hand cards: BasicAction or AdvancedAction (not wounds, spells, artifacts)
    let has_eligible = !eligible_action_hand_indices(&player.hand).is_empty();

    if !has_eligible {
        return ResolveResult::Skipped;
    }

    // Get the source card from the play area
    let source_card_id = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from("unknown"));

    // Set ActivePending::Decompose
    state.players[player_idx].pending.active =
        Some(ActivePending::Decompose(PendingDecompose {
            source_card_id,
            mode,
        }));

    ResolveResult::PendingSet
}

/// Apply Training effect — select a non-wound action card to discard, then gain an AA
/// of matching color from the offer.
/// Basic: gained AA goes to discard. Powered: gained AA goes to hand.
pub(super) fn apply_training(
    state: &mut GameState,
    player_idx: usize,
    mode: EffectMode,
) -> ResolveResult {
    let player = &state.players[player_idx];

    // Check if there are any eligible hand cards (non-wound action cards)
    let has_eligible = !eligible_action_hand_indices(&player.hand).is_empty();

    if !has_eligible {
        return ResolveResult::Skipped;
    }

    let source_card_id = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from("training"));

    state.players[player_idx].pending.active =
        Some(ActivePending::Training(PendingTraining {
            source_card_id,
            mode,
            phase: BookOfWisdomPhase::SelectCard,
            thrown_card_color: None,
            available_offer_cards: ArrayVec::new(),
        }));

    ResolveResult::PendingSet
}

/// Apply MaximalEffect — select a non-wound action card in hand, then play its
/// basic/powered effect multiplied.
/// Basic: multiplier 3. Powered: multiplier 2 (uses powered effect).
pub(super) fn apply_maximal_effect(
    state: &mut GameState,
    player_idx: usize,
    mode: EffectMode,
) -> ResolveResult {
    let player = &state.players[player_idx];

    let has_eligible = !eligible_action_hand_indices(&player.hand).is_empty();

    if !has_eligible {
        return ResolveResult::Skipped;
    }

    let source_card_id = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from("maximal_effect"));

    let multiplier = match mode {
        EffectMode::Basic => 3,
        EffectMode::Powered => 2,
    };

    state.players[player_idx].pending.active =
        Some(ActivePending::MaximalEffect(PendingMaximalEffect {
            source_card_id,
            multiplier,
            effect_kind: mode,
        }));

    ResolveResult::PendingSet
}

/// Apply DiscardForAttack effect — discard an action card, then gain attack based on card color.
///
/// Finds eligible hand cards (BasicAction or AdvancedAction), presents as choice.
/// Each choice option is the attack effect for the card's color.
/// 0 eligible → skip. 1 eligible → auto-discard + resolve. N → NeedsChoice.
pub(super) fn apply_discard_for_attack(
    state: &mut GameState,
    player_idx: usize,
    attacks_by_color: &[(BasicManaColor, CardEffect)],
) -> ResolveResult {
    if state.combat.is_none() {
        return ResolveResult::Skipped;
    }

    let player = &state.players[player_idx];

    // Find eligible hand cards and their color-based attack effects
    let (eligible_indices, options) = hand_card_effect_choices(
        &player.hand,
        |card_id| {
            is_action_card(card_id)
                && mk_data::cards::get_card_color(card_id.as_str()).is_some_and(|color| {
                    attacks_by_color.iter().any(|(attack_color, _)| *attack_color == color)
                })
        },
        |card_id| {
            mk_data::cards::get_card_color(card_id.as_str())
                .and_then(|color| {
                    attacks_by_color
                        .iter()
                        .find(|(attack_color, _)| *attack_color == color)
                })
                .map(|(_, effect)| effect.clone())
                .unwrap_or(CardEffect::Noop)
        },
    );

    resolve_choice_options(
        eligible_indices,
        options,
        |hand_idx, attack_effect| {
            // Auto-discard the only eligible card
            let player = &mut state.players[player_idx];
            let discarded = player.hand.remove(hand_idx);
            player.discard.push(discarded);
            ResolveResult::Decomposed(vec![attack_effect])
        },
        |eligible_indices| ChoiceResolution::DiscardThenContinue { eligible_indices },
    )
}

/// Apply Pure Magic effect — pay a mana token, gain effect based on its color.
///
/// Green→Move, White→Influence, Blue→Block(combat), Red→Attack(combat).
/// Gold allows all four choices. Token consumption via PureMagicConsume resolution.
pub(super) fn apply_pure_magic(
    state: &mut GameState,
    player_idx: usize,
    amount: u32,
) -> ResolveResult {
    let player = &state.players[player_idx];
    let in_combat = state.combat.is_some();

    if player.pure_mana.is_empty() {
        return ResolveResult::Skipped;
    }

    // Collect unique basic colors from tokens
    let mut available_colors: Vec<BasicManaColor> = Vec::new();
    let mut has_gold = false;
    for token in &player.pure_mana {
        match token.color {
            ManaColor::Gold => {
                has_gold = true;
            }
            ManaColor::Red | ManaColor::Blue | ManaColor::Green | ManaColor::White => {
                if let Some(basic) = to_basic_mana_color(token.color) {
                    if !available_colors.contains(&basic) {
                        available_colors.push(basic);
                    }
                }
            }
            _ => {} // Black: not usable for pure magic
        }
    }

    // Build parallel arrays: options (gain effects) + token_colors (which token to consume)
    let mut options: Vec<CardEffect> = Vec::new();
    let mut token_colors: Vec<ManaColor> = Vec::new();

    for &basic_color in &available_colors {
        if let Some(eff) = pure_magic_effect_for_color(basic_color, amount, in_combat) {
            options.push(eff);
            token_colors.push(ManaColor::from(basic_color));
        }
    }

    // Gold: one option per basic color not already covered
    if has_gold {
        for &basic_color in &ALL_BASIC_MANA_COLORS {
            if available_colors.contains(&basic_color) {
                continue;
            }
            if let Some(eff) = pure_magic_effect_for_color(basic_color, amount, in_combat) {
                options.push(eff);
                token_colors.push(ManaColor::Gold);
            }
        }
    }

    resolve_choice_options(
        token_colors,
        options,
        |color, effect| {
            // Auto-select: consume the token and decompose
            let player = &mut state.players[player_idx];
            if let Some(idx) = player.pure_mana.iter().position(|t| t.color == color) {
                player.pure_mana.remove(idx);
            }
            ResolveResult::Decomposed(vec![effect])
        },
        |token_colors| ChoiceResolution::PureMagicConsume { token_colors },
    )
}

/// Get the effect for Pure Magic given a color.
/// Green→Move, White→Influence, Blue→Block(combat only), Red→Attack(combat only).
pub(super) fn pure_magic_effect_for_color(
    color: BasicManaColor,
    amount: u32,
    in_combat: bool,
) -> Option<CardEffect> {
    match color {
        BasicManaColor::Green => Some(CardEffect::GainMove { amount }),
        BasicManaColor::White => Some(CardEffect::GainInfluence { amount }),
        BasicManaColor::Blue => {
            if in_combat {
                Some(CardEffect::GainBlock {
                    amount,
                    element: Element::Physical,
                })
            } else {
                None
            }
        }
        BasicManaColor::Red => {
            if in_combat {
                Some(CardEffect::GainAttack {
                    amount,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                })
            } else {
                None
            }
        }
    }
}

// =============================================================================
// Multi-step / cost effect handlers
// =============================================================================

/// Find an available basic-color source die for crystallization.
///
/// Returns `Some(ManaSourceInfo)` for the first matching die (basic color, unclaimed
/// or stolen, `USED_MANA_FROM_SOURCE` not set).
pub(super) fn find_crystallizable_die(
    state: &GameState,
    player_idx: usize,
    target_color: BasicManaColor,
) -> Option<mk_types::action::ManaSourceInfo> {
    let player = &state.players[player_idx];
    if player.flags.contains(PlayerFlags::USED_MANA_FROM_SOURCE) {
        return None;
    }
    let player_id = &player.id;
    let stolen_die_id = player
        .tactic_state
        .stored_mana_die
        .as_ref()
        .map(|s| &s.die_id);
    let target_mana = ManaColor::from(target_color);

    for die in &state.source.dice {
        if !crate::card_play::is_die_available_with_overrides(die, state, player_idx) {
            continue;
        }
        let is_available = die.taken_by_player_id.is_none()
            || (die.taken_by_player_id.as_ref() == Some(player_id)
                && stolen_die_id == Some(&die.id));
        if !is_available {
            continue;
        }
        if die.color == target_mana {
            return Some(mk_types::action::ManaSourceInfo {
                source_type: ManaSourceType::Die,
                color: die.color,
                die_id: Some(die.id.as_str().to_string()),
            });
        }
    }
    None
}

/// Consume a crystallize source for the given color: prefer token, fall back to die.
fn consume_crystallize_source(state: &mut GameState, player_idx: usize, color: BasicManaColor) {
    // Try token first
    let token_idx = state.players[player_idx]
        .pure_mana
        .iter()
        .position(|t| to_basic_mana_color(t.color) == Some(color));
    if let Some(idx) = token_idx {
        state.players[player_idx].pure_mana.remove(idx);
        return;
    }
    // Fall back to source die
    if let Some(source_info) = find_crystallizable_die(state, player_idx, color) {
        crate::card_play::consume_specific_mana_source(state, player_idx, &source_info);
    }
}

/// Convert one mana source (token or source die) to a crystal of the same color.
/// If no sources, skip. If one color, auto-crystallize. If multiple, offer choice.
pub(super) fn apply_convert_mana_to_crystal(state: &mut GameState, player_idx: usize) -> ResolveResult {
    let player = &state.players[player_idx];

    // Collect unique basic colors from tokens
    let mut available_colors: Vec<BasicManaColor> = Vec::new();
    for token in &player.pure_mana {
        if let Some(basic) = to_basic_mana_color(token.color) {
            if !available_colors.contains(&basic) {
                available_colors.push(basic);
            }
        }
    }

    // Also collect basic colors from available source dice
    if !player.flags.contains(PlayerFlags::USED_MANA_FROM_SOURCE) {
        let player_id = &player.id;
        let stolen_die_id = player
            .tactic_state
            .stored_mana_die
            .as_ref()
            .map(|s| &s.die_id);

        for die in &state.source.dice {
            if !crate::card_play::is_die_available_with_overrides(die, state, player_idx) {
                continue;
            }
            let is_available = die.taken_by_player_id.is_none()
                || (die.taken_by_player_id.as_ref() == Some(player_id)
                    && stolen_die_id == Some(&die.id));
            if !is_available {
                continue;
            }
            if let Some(basic) = to_basic_mana_color(die.color) {
                if !available_colors.contains(&basic) {
                    available_colors.push(basic);
                }
            }
        }
    }

    let options: Vec<CardEffect> = available_colors
        .iter()
        .map(|&color| CardEffect::GainCrystal { color: Some(color) })
        .collect();

    resolve_choice_options(
        available_colors,
        options,
        |color, _effect| {
            // Auto-crystallize the only color (prefer token over die).
            consume_crystallize_source(state, player_idx, color);
            gain_crystal_color(state, player_idx, color);
            ResolveResult::Applied
        },
        |_| ChoiceResolution::CrystallizeConsume,
    )
}

/// Apply CardBoost — find eligible hand cards, present boosted powered effects.
///
/// Eligible cards: BasicAction or AdvancedAction (not wounds, spells, artifacts).
/// - 0 eligible → skip
/// - 1 eligible → auto-select (move to play_area, resolve boosted powered_effect)
/// - N eligible → NeedsChoice with BoostTarget resolution
pub(super) fn apply_card_boost(state: &mut GameState, player_idx: usize, bonus: u32) -> ResolveResult {
    let player = &state.players[player_idx];

    // Find eligible hand cards: BasicAction or AdvancedAction
    let (eligible_indices, options) = hand_card_effect_choices(
        &player.hand,
        is_action_card,
        |card_id| {
            mk_data::cards::get_card(card_id.as_str())
                .map(|def| scale_effect(&def.powered_effect, bonus))
                .unwrap_or(CardEffect::Noop)
        },
    );

    resolve_choice_options(
        eligible_indices,
        options,
        |hand_idx, boosted_effect| {
            // Auto-select: move card to play_area, resolve boosted powered_effect
            let player = &mut state.players[player_idx];
            let card = player.hand.remove(hand_idx);
            player.play_area.push(card);

            ResolveResult::Decomposed(vec![boosted_effect])
        },
        |eligible_hand_indices| ChoiceResolution::BoostTarget {
            eligible_hand_indices,
        },
    )
}

/// Mana Draw Powered — pick an available source die, then choose a color.
///
/// Finds the first available (not taken, not depleted) die, presents 4 basic
/// color options. The die is marked as taken via ManaDrawTakeDie resolution.
pub(super) fn apply_mana_draw_powered_simplified(
    state: &mut GameState,
    _player_idx: usize,
    tokens_per_die: u32,
) -> ResolveResult {
    // Find an available die
    let available_die = state
        .source
        .dice
        .iter()
        .find(|d| d.taken_by_player_id.is_none() && !d.is_depleted);

    let die = match available_die {
        Some(d) => d,
        None => return ResolveResult::Skipped,
    };

    let die_id = die.id.clone();

    // Count remaining available dice (excluding the one we're about to take)
    let remaining = state
        .source
        .dice
        .iter()
        .filter(|d| d.taken_by_player_id.is_none() && !d.is_depleted && d.id != die_id)
        .count() as u32;

    // Offer a choice of basic mana colors, each giving `tokens_per_die` tokens
    let options: Vec<CardEffect> = vec![
        CardEffect::GainMana {
            color: ManaColor::Red,
            amount: tokens_per_die,
        },
        CardEffect::GainMana {
            color: ManaColor::Blue,
            amount: tokens_per_die,
        },
        CardEffect::GainMana {
            color: ManaColor::Green,
            amount: tokens_per_die,
        },
        CardEffect::GainMana {
            color: ManaColor::White,
            amount: tokens_per_die,
        },
    ];

    ResolveResult::NeedsChoiceWith(
        options,
        ChoiceResolution::ManaDrawTakeDie {
            die_id,
            tokens_per_die,
            remaining_dice: remaining,
        },
    )
}

/// Apply a discard cost — player must discard a card, then the then_effect resolves.
///
/// For count == 1:
/// - 0 eligible cards → skip
/// - 1 eligible card → auto-discard and resolve then_effect
/// - N eligible cards → present choice with DiscardThenContinue resolution
pub(super) fn apply_discard_cost(
    state: &mut GameState,
    player_idx: usize,
    count: u32,
    filter_wounds: bool,
    wounds_only: bool,
    then_effect: &CardEffect,
) -> ResolveResult {
    let player = &state.players[player_idx];

    // Build eligible hand indices
    let eligible_indices = eligible_hand_card_indices(&player.hand, |c| {
        let is_wound = c.as_str() == WOUND_CARD_ID;
        if wounds_only {
            is_wound
        } else if filter_wounds {
            !is_wound
        } else {
            true
        }
    });

    if count == 1 {
        let options = vec![then_effect.clone(); eligible_indices.len()];
        resolve_choice_options(
            eligible_indices,
            options,
            |idx, effect| {
                // Auto-discard the only eligible card
                let player = &mut state.players[player_idx];
                let discarded = player.hand.remove(idx);
                player.discard.push(discarded);
                player
                    .flags
                    .insert(PlayerFlags::DISCARDED_CARD_THIS_TURN);
                ResolveResult::Decomposed(vec![effect])
            },
            |eligible_indices| ChoiceResolution::DiscardThenContinue { eligible_indices },
        )
    } else {
        // Multi-card discard: not yet implemented, skip for Phase 2
        ResolveResult::Skipped
    }
}

#[allow(clippy::too_many_arguments)] // attack + per-defeat bonus params are cohesive
pub(super) fn apply_attack_with_defeat_bonus(
    state: &mut GameState,
    player_idx: usize,
    amount: u32,
    combat_type: CombatType,
    element: Element,
    reputation_per_defeat: i32,
    fame_per_defeat: u32,
    armor_reduction_per_defeat: u32,
) -> ResolveResult {
    // Step 1: Apply the attack via normal GainAttack logic
    let attack_result = apply_gain_attack(state, player_idx, amount, combat_type, element);
    if matches!(attack_result, ResolveResult::Skipped) {
        return ResolveResult::Skipped;
    }

    // Step 2: Register a tracker for per-enemy-defeated bonuses
    let tracker = AttackDefeatFameTracker {
        source_card_id: None, // Set by the queue's source tracking
        attack_type: combat_type,
        element: AttackElement::Physical,
        amount,
        remaining: amount,
        fame: 0,
        reputation_per_defeat: if reputation_per_defeat != 0 {
            Some(reputation_per_defeat)
        } else {
            None
        },
        fame_per_defeat: if fame_per_defeat != 0 {
            Some(fame_per_defeat)
        } else {
            None
        },
        armor_reduction_per_defeat: if armor_reduction_per_defeat != 0 {
            Some(armor_reduction_per_defeat)
        } else {
            None
        },
    };

    // Add to deferred pending as AttackDefeatFame
    let player = &mut state.players[player_idx];
    let mut found = false;
    for d in player.pending.deferred.iter_mut() {
        if let DeferredPending::AttackDefeatFame(trackers) = d {
            if !trackers.is_full() {
                trackers.push(tracker.clone());
            }
            found = true;
            break;
        }
    }
    if !found && !player.pending.deferred.is_full() {
        let mut trackers = arrayvec::ArrayVec::new();
        trackers.push(tracker);
        player
            .pending
            .deferred
            .push(DeferredPending::AttackDefeatFame(trackers));
    }

    ResolveResult::Applied
}
