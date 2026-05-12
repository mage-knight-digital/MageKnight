//! Atomic effect handlers — simple state mutations.

use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::ids::{CardId, ModifierId};
use mk_types::modifier::*;
use mk_types::state::*;

use crate::undo::UndoStack;

use mk_types::pending::ChoiceResolution;

use super::ResolveResult;
use super::utils::*;
use super::WOUND_CARD_ID;

// =============================================================================
// Spell effect stubs (hero basic action cards — to be fully implemented)
// =============================================================================

// =============================================================================
// Atomic effect handlers
// =============================================================================

pub(super) fn apply_gain_attack(
    state: &mut GameState,
    player_idx: usize,
    amount: u32,
    combat_type: CombatType,
    element: Element,
) -> ResolveResult {
    // Attack only applies in combat
    if state.combat.is_none() {
        return ResolveResult::Skipped;
    }

    // BowAttackTransformation hook: during RangedSiege, Ranged/Siege attack → choice
    if matches!(combat_type, CombatType::Ranged | CombatType::Siege) {
        if let Some(combat) = &state.combat {
            if combat.phase == CombatPhase::RangedSiege {
                let player_id = &state.players[player_idx].id;
                let has_bow = state.active_modifiers.iter().any(|m| {
                    matches!(&m.effect, ModifierEffect::BowAttackTransformation)
                        && m.created_by_player_id == *player_id
                });
                if has_bow {
                    let (opt0, opt1) = match combat_type {
                        CombatType::Ranged => (
                            CardEffect::GainAttackBowResolved {
                                amount: amount * 2,
                                combat_type: CombatType::Ranged,
                                element,
                            },
                            CardEffect::GainAttackBowResolved {
                                amount,
                                combat_type: CombatType::Siege,
                                element,
                            },
                        ),
                        CombatType::Siege => (
                            CardEffect::GainAttackBowResolved {
                                amount: amount * 2,
                                combat_type: CombatType::Siege,
                                element,
                            },
                            CardEffect::GainAttackBowResolved {
                                amount,
                                combat_type: CombatType::Ranged,
                                element,
                            },
                        ),
                        _ => unreachable!(),
                    };
                    return ResolveResult::NeedsChoice(vec![opt0, opt1]);
                }
            }
        }
    }

    // Altem Mages modifier hooks (after Bow, before writing)
    let player_id = &state.players[player_idx].id;
    let has_coldfire_transform = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::TransformAttacksColdFire)
            && m.created_by_player_id == *player_id
    });
    let has_siege_add = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::AddSiegeToAttacks)
            && m.created_by_player_id == *player_id
    });

    let effective_element = if has_coldfire_transform { Element::ColdFire } else { element };

    let acc = &mut state.players[player_idx].combat_accumulator.attack;
    match combat_type {
        CombatType::Melee => {
            acc.normal += amount;
            add_to_elemental(&mut acc.normal_elements, effective_element, amount);
        }
        CombatType::Ranged => {
            acc.ranged += amount;
            add_to_elemental(&mut acc.ranged_elements, effective_element, amount);
        }
        CombatType::Siege => {
            acc.siege += amount;
            add_to_elemental(&mut acc.siege_elements, effective_element, amount);
        }
    }

    // AddSiegeToAttacks: also mirror the attack amount as siege
    if has_siege_add {
        let acc = &mut state.players[player_idx].combat_accumulator.attack;
        acc.siege += amount;
        add_to_elemental(&mut acc.siege_elements, effective_element, amount);
    }

    ResolveResult::Applied
}

/// Apply a resolved bow attack transformation choice — writes directly to accumulator
/// without re-checking BowAttackTransformation (prevents re-entry).
pub(super) fn apply_gain_attack_bow_resolved(
    state: &mut GameState,
    player_idx: usize,
    amount: u32,
    combat_type: CombatType,
    element: Element,
) -> ResolveResult {
    if state.combat.is_none() {
        return ResolveResult::Skipped;
    }

    // Altem Mages modifier hooks
    let player_id = &state.players[player_idx].id;
    let has_coldfire_transform = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::TransformAttacksColdFire)
            && m.created_by_player_id == *player_id
    });
    let has_siege_add = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::AddSiegeToAttacks)
            && m.created_by_player_id == *player_id
    });

    let effective_element = if has_coldfire_transform { Element::ColdFire } else { element };

    let acc = &mut state.players[player_idx].combat_accumulator.attack;
    match combat_type {
        CombatType::Melee => {
            acc.normal += amount;
            add_to_elemental(&mut acc.normal_elements, effective_element, amount);
        }
        CombatType::Ranged => {
            acc.ranged += amount;
            add_to_elemental(&mut acc.ranged_elements, effective_element, amount);
        }
        CombatType::Siege => {
            acc.siege += amount;
            add_to_elemental(&mut acc.siege_elements, effective_element, amount);
        }
    }

    if has_siege_add {
        let acc = &mut state.players[player_idx].combat_accumulator.attack;
        acc.siege += amount;
        add_to_elemental(&mut acc.siege_elements, effective_element, amount);
    }

    ResolveResult::Applied
}

pub(super) fn apply_gain_block(
    state: &mut GameState,
    player_idx: usize,
    amount: u32,
    element: Element,
) -> ResolveResult {
    // Block only applies in combat
    if state.combat.is_none() {
        return ResolveResult::Skipped;
    }

    let acc = &mut state.players[player_idx].combat_accumulator;
    acc.block += amount;
    add_to_elemental(&mut acc.block_elements, element, amount);
    ResolveResult::Applied
}

pub(super) fn apply_gain_healing(state: &mut GameState, player_idx: usize, amount: u32) -> ResolveResult {
    let player = &mut state.players[player_idx];

    // Count wounds in hand
    let wound_count = player
        .hand
        .iter()
        .filter(|c| c.as_str() == WOUND_CARD_ID)
        .count() as u32;
    let to_heal = amount.min(wound_count);

    // Remove wounds from hand (back to front to preserve indices)
    let mut healed = 0u32;
    player.hand.retain(|c| {
        if healed < to_heal && c.as_str() == WOUND_CARD_ID {
            healed += 1;
            false // remove
        } else {
            true // keep
        }
    });

    player.healing_points += amount.saturating_sub(to_heal);
    player.wounds_healed_from_hand_this_turn += healed;

    // Hook: Golden Grail modifiers
    if healed > 0 {
        // GoldenGrailFameTracking: +1 fame per wound healed (up to remaining limit)
        let fame_bonus = consume_golden_grail_fame(&mut state.active_modifiers, healed);
        if fame_bonus > 0 {
            state.players[player_idx].fame += fame_bonus;
        }

        // GoldenGrailDrawOnHeal: draw 1 card per wound healed
        if has_golden_grail_draw_on_heal(&state.active_modifiers) {
            return ResolveResult::Decomposed(vec![CardEffect::DrawCards { count: healed }]);
        }
    }

    ResolveResult::Applied
}

/// Consume GoldenGrailFameTracking modifier, awarding fame and decrementing the tracker.
pub(super) fn consume_golden_grail_fame(
    modifiers: &mut Vec<ActiveModifier>,
    healed: u32,
) -> u32 {
    let mod_idx = modifiers.iter().position(|m| {
        matches!(&m.effect, ModifierEffect::GoldenGrailFameTracking { .. })
    });

    let Some(idx) = mod_idx else { return 0 };

    let remaining = match &modifiers[idx].effect {
        ModifierEffect::GoldenGrailFameTracking { remaining_healing_points } => *remaining_healing_points,
        _ => return 0,
    };

    let fame_awarded = healed.min(remaining);
    let new_remaining = remaining - fame_awarded;

    if new_remaining == 0 {
        modifiers.remove(idx);
    } else if let ModifierEffect::GoldenGrailFameTracking { ref mut remaining_healing_points } = modifiers[idx].effect {
        *remaining_healing_points = new_remaining;
    }

    fame_awarded
}

/// Check if GoldenGrailDrawOnHeal modifier is active.
pub(super) fn has_golden_grail_draw_on_heal(modifiers: &[ActiveModifier]) -> bool {
    modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::GoldenGrailDrawOnHeal)
    })
}

pub(super) fn apply_gain_mana(
    state: &mut GameState,
    player_idx: usize,
    color: ManaColor,
    amount: u32,
) -> ResolveResult {
    let player = &mut state.players[player_idx];
    for _ in 0..amount {
        player.pure_mana.push(ManaToken {
            color,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    }
    ResolveResult::Applied
}

pub(super) fn apply_draw_cards(
    state: &mut GameState,
    player_idx: usize,
    count: u32,
    undo: &mut Option<&mut UndoStack>,
) -> ResolveResult {
    let player = &mut state.players[player_idx];
    let actual_draw = (count as usize).min(player.deck.len());
    let drawn: Vec<CardId> = player.deck.drain(..actual_draw).collect();
    player.hand.extend(drawn);
    if actual_draw > 0 {
        if let Some(stack) = undo.as_mut() {
            stack.set_checkpoint();
        }
    }
    ResolveResult::Applied
}

pub(super) fn apply_gain_crystal(
    state: &mut GameState,
    player_idx: usize,
    color: Option<BasicManaColor>,
) -> ResolveResult {
    match color {
        Some(c) => {
            gain_crystal_color(state, player_idx, c);
            ResolveResult::Applied
        }
        None => {
            // Player must choose which crystal color to gain.
            // Build choice options: one per basic color.
            let options: Vec<CardEffect> = [
                BasicManaColor::Red,
                BasicManaColor::Blue,
                BasicManaColor::Green,
                BasicManaColor::White,
            ]
            .iter()
            .map(|&c| CardEffect::GainCrystal { color: Some(c) })
            .collect();
            ResolveResult::NeedsChoice(options)
        }
    }
}


pub(super) fn apply_take_wound(state: &mut GameState, player_idx: usize) -> ResolveResult {
    let player = &mut state.players[player_idx];
    // Check for wound immunity (Mist Form powered)
    if player.flags.contains(PlayerFlags::WOUND_IMMUNITY_ACTIVE) {
        player.flags.remove(PlayerFlags::WOUND_IMMUNITY_ACTIVE);
        return ResolveResult::Applied; // Wound blocked
    }
    player.hand.push(CardId::from(WOUND_CARD_ID));
    ResolveResult::Applied
}


/// Apply any modifier effect (rule overrides, terrain costs, combat bonuses, etc.).
pub(super) fn apply_modifier(
    state: &mut GameState,
    player_idx: usize,
    effect: &ModifierEffect,
    duration: &ModifierDuration,
    scope: &ModifierScope,
) -> ResolveResult {
    let player_id = state.players[player_idx].id.clone();
    let modifier_count = state.active_modifiers.len();
    let modifier_id = format!(
        "mod_{}_r{}_t{}",
        modifier_count, state.round, state.current_player_index
    );
    // Determine the source card from the last card played (top of play area),
    // falling back to a generic source.
    let source_card_id = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from("unknown"));
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from(modifier_id.as_str()),
        source: ModifierSource::Card {
            card_id: source_card_id,
            player_id: player_id.clone(),
        },
        duration: *duration,
        scope: scope.clone(),
        effect: effect.clone(),
        created_at_round: state.round,
        created_by_player_id: player_id,
    });
    ResolveResult::Applied
}

// =============================================================================
// Unit effect handlers
// =============================================================================

/// Ready a spent unit at or below the given level.
/// 0 eligible → skip. 1 eligible → auto-ready. N eligible → NeedsChoice.
///
/// The choice options are `GainHealing { amount: 0 }` as a sentinel — the actual
/// side effect (readying the unit) is done via `ReadyUnitTarget` resolution.
/// To avoid a new ChoiceResolution variant, we use a simpler approach:
/// each option is a `Noop` that carries metadata via the `ReadyUnitTarget` resolution.
///
/// Actually, to keep it simple and self-contained, we resolve inline:
/// - Build choice options as `CardEffect::Noop` (one per eligible unit)
/// - Use `ChoiceResolution::ReadyUnitTarget { eligible_unit_indices }` to track which
///   unit to ready when the player picks an option.
pub(super) fn apply_ready_unit(state: &mut GameState, player_idx: usize, max_level: u8) -> ResolveResult {
    let player = &state.players[player_idx];

    // Find spent units at or below max_level
    let eligible: Vec<usize> = player
        .units
        .iter()
        .enumerate()
        .filter(|(_, u)| u.state == UnitState::Spent && u.level <= max_level)
        .map(|(i, _)| i)
        .collect();

    match eligible.len() {
        0 => ResolveResult::Skipped,
        1 => {
            // Auto-ready the single eligible unit
            let unit_idx = eligible[0];
            state.players[player_idx].units[unit_idx].state = UnitState::Ready;
            ResolveResult::Applied
        }
        _ => {
            // Present choice: one Noop per eligible unit
            // Resolution side-effect readies the selected unit
            let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
            let eligible_indices = eligible;
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::ReadyUnitTarget {
                    eligible_unit_indices: eligible_indices,
                },
            )
        }
    }
}

pub(super) fn apply_heal_unit(state: &mut GameState, player_idx: usize, max_level: u8) -> ResolveResult {
    let player = &state.players[player_idx];

    // Find wounded units at or below max_level
    let eligible: Vec<usize> = player
        .units
        .iter()
        .enumerate()
        .filter(|(_, u)| u.wounded && u.level <= max_level)
        .map(|(i, _)| i)
        .collect();

    match eligible.len() {
        0 => ResolveResult::Skipped,
        1 => {
            let unit_idx = eligible[0];
            state.players[player_idx].units[unit_idx].wounded = false;
            ResolveResult::Applied
        }
        _ => {
            let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::HealUnitTarget {
                    eligible_unit_indices: eligible,
                },
            )
        }
    }
}
