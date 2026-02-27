use mk_data::cards::{get_card, PoweredBy};
use mk_types::effect::CardEffect;
use mk_types::enums::*;
use mk_types::ids::CardId;
use mk_types::legal_action::LegalAction;
use mk_types::modifier::{ModifierEffect, RuleOverride};
use mk_types::state::{GameState, PlayerFlags};

use crate::card_play::{get_effective_sideways_value, is_rule_active};
use crate::effect_queue::is_resolvable;

use super::utils::WOUND_CARD_ID;

/// Check if the player has an active attack conversion modifier
/// (TransformAttacksColdFire or AddSiegeToAttacks) that makes sideways melee
/// attacks useful in RangedSiege phase.
fn has_attack_conversion_modifier(state: &GameState, player_idx: usize) -> bool {
    let player_id = &state.players[player_idx].id;
    state.active_modifiers.iter().any(|m| {
        m.created_by_player_id == *player_id
            && matches!(
                m.effect,
                ModifierEffect::TransformAttacksColdFire | ModifierEffect::AddSiegeToAttacks
            )
    })
}

pub(super) fn enumerate_normal_cards(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];
    let is_resting = player.flags.contains(PlayerFlags::IS_RESTING);
    let has_rested = player.flags.contains(PlayerFlags::HAS_RESTED_THIS_TURN);
    let is_interacting = player.flags.contains(PlayerFlags::IS_INTERACTING);

    // Collect basic, powered, sideways separately to emit in category order.
    let mut basic_actions = Vec::new();
    let mut powered_actions = Vec::new();
    let mut sideways_actions = Vec::new();

    for (hand_index, card_id) in player.hand.iter().enumerate() {
        let card_def = match get_card(card_id.as_str()) {
            Some(def) => def,
            None => continue,
        };

        let is_wound = card_id.as_str() == WOUND_CARD_ID;

        // Wounds have no basic/powered effect — skip to sideways.
        if !is_wound {
            // Category 2: PlayCardBasic — allowed during rest (FAQ S3).
            if is_effect_playable_for_enumeration(
                state,
                player_idx,
                hand_index,
                &card_def.basic_effect,
            ) {
                let dominated = (!is_interacting && is_influence_only(&card_def.basic_effect))
                    || (is_interacting && is_move_only(&card_def.basic_effect));
                if !dominated {
                    basic_actions.push(LegalAction::PlayCardBasic {
                        hand_index,
                        card_id: card_id.clone(),
                    });
                }
            }

            // Category 3: PlayCardPowered — allowed during rest (FAQ S3).
            // Time Bending chain prevention: cannot play Space Bending powered during a time-bent turn.
            let time_bending_blocked = player.flags.contains(PlayerFlags::IS_TIME_BENT_TURN)
                && card_id.as_str() == "space_bending";
            let powered_dominated =
                (!is_interacting && is_influence_only(&card_def.powered_effect))
                    || (is_interacting && is_move_only(&card_def.powered_effect));
            match card_def.powered_by {
            PoweredBy::Single(color) => {
                if !time_bending_blocked
                    && !powered_dominated
                    && is_effect_playable_for_enumeration(
                        state,
                        player_idx,
                        hand_index,
                        &card_def.powered_effect,
                    )
                    && can_afford_powered(state, player_idx, color)
                {
                    powered_actions.push(LegalAction::PlayCardPowered {
                        hand_index,
                        card_id: card_id.clone(),
                        mana_color: color,
                    });
                }
            }
            PoweredBy::AnyBasic => {
                if !powered_dominated
                    && is_effect_playable_for_enumeration(
                        state,
                        player_idx,
                        hand_index,
                        &card_def.powered_effect,
                    )
                {
                    for &color in &ALL_BASIC_MANA_COLORS {
                        if can_afford_powered(state, player_idx, color) {
                            powered_actions.push(LegalAction::PlayCardPowered {
                                hand_index,
                                card_id: card_id.clone(),
                                mana_color: color,
                            });
                        }
                    }
                }
            }
            PoweredBy::None => {}
            }
        }

        // Category 4: PlayCardSideways.
        // While resting: NO sideways at all.
        // After rest: influence only (no move).
        // After combat: influence only (no move — moving after combat is nearly worthless).
        // Normal: both move and influence.
        // Wounds: only if WoundsPlayableSideways rule active + effective value > 0.
        if !is_resting {
            let eff_value = if is_wound {
                if is_rule_active(state, player_idx, RuleOverride::WoundsPlayableSideways) {
                    get_effective_sideways_value(
                        state,
                        player_idx,
                        true,
                        card_def.card_type,
                        card_def.powered_by.primary_color(),
                    )
                } else {
                    0
                }
            } else {
                get_effective_sideways_value(
                    state,
                    player_idx,
                    false,
                    card_def.card_type,
                    card_def.powered_by.primary_color(),
                )
            };
            if eff_value > 0 {
                if has_rested {
                    // After rest: influence only (FAQ S3 — unchanged by IS_INTERACTING).
                    sideways_actions.push(LegalAction::PlayCardSideways {
                        hand_index,
                        card_id: card_id.clone(),
                        sideways_as: SidewaysAs::Influence,
                    });
                } else if player.flags.contains(PlayerFlags::IS_INTERACTING) {
                    // Interacting: influence only (no movement while at site).
                    sideways_actions.push(LegalAction::PlayCardSideways {
                        hand_index,
                        card_id: card_id.clone(),
                        sideways_as: SidewaysAs::Influence,
                    });
                } else if player.flags.contains(PlayerFlags::HAS_COMBATTED_THIS_TURN) {
                    // After combat: skip sideways move (nearly worthless to move 1 after combat).
                } else {
                    // Not interacting: move only (no influence outside site).
                    sideways_actions.push(LegalAction::PlayCardSideways {
                        hand_index,
                        card_id: card_id.clone(),
                        sideways_as: SidewaysAs::Move,
                    });
                }
            }
        }
    }

    actions.extend(basic_actions);
    actions.extend(powered_actions);
    actions.extend(sideways_actions);
}

pub(super) fn enumerate_combat_cards(
    state: &GameState,
    player_idx: usize,
    combat_phase: CombatPhase,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];

    let mut basic_actions = Vec::new();
    let mut powered_actions = Vec::new();
    let mut sideways_actions = Vec::new();

    for (hand_index, card_id) in player.hand.iter().enumerate() {
        let card_def = match get_card(card_id.as_str()) {
            Some(def) => def,
            None => continue,
        };

        let is_wound = card_id.as_str() == WOUND_CARD_ID;

        // Wounds have no basic/powered effect — skip to sideways.
        if !is_wound {
            // Category 2: PlayCardBasic.
            if is_effect_playable_for_enumeration(
                state,
                player_idx,
                hand_index,
                &card_def.basic_effect,
            ) {
                basic_actions.push(LegalAction::PlayCardBasic {
                    hand_index,
                    card_id: card_id.clone(),
                });
            }

            // Category 3: PlayCardPowered.
            // Time Bending chain prevention: cannot play Space Bending powered during a time-bent turn.
            let time_bending_blocked = player.flags.contains(PlayerFlags::IS_TIME_BENT_TURN)
                && card_id.as_str() == "space_bending";
            match card_def.powered_by {
                PoweredBy::Single(color) => {
                    if !time_bending_blocked
                        && is_effect_playable_for_enumeration(
                            state,
                            player_idx,
                            hand_index,
                            &card_def.powered_effect,
                        )
                        && can_afford_powered(state, player_idx, color)
                    {
                        powered_actions.push(LegalAction::PlayCardPowered {
                            hand_index,
                            card_id: card_id.clone(),
                            mana_color: color,
                        });
                    }
                }
                PoweredBy::AnyBasic => {
                    if !time_bending_blocked
                        && is_effect_playable_for_enumeration(
                            state,
                            player_idx,
                            hand_index,
                            &card_def.powered_effect,
                        )
                    {
                        for &color in &ALL_BASIC_MANA_COLORS {
                            if can_afford_powered(state, player_idx, color) {
                                powered_actions.push(LegalAction::PlayCardPowered {
                                    hand_index,
                                    card_id: card_id.clone(),
                                    mana_color: color,
                                });
                            }
                        }
                    }
                }
                PoweredBy::None => {}
            }
        }

        // Category 4: PlayCardSideways (combat: Attack and Block).
        // Wounds: only if WoundsPlayableSideways rule active + effective value > 0.
        {
            let eff_value = if is_wound {
                if is_rule_active(state, player_idx, RuleOverride::WoundsPlayableSideways) {
                    get_effective_sideways_value(
                        state,
                        player_idx,
                        true,
                        card_def.card_type,
                        card_def.powered_by.primary_color(),
                    )
                } else {
                    0
                }
            } else {
                get_effective_sideways_value(
                    state,
                    player_idx,
                    false,
                    card_def.card_type,
                    card_def.powered_by.primary_color(),
                )
            };
            if eff_value > 0 {
                // Sideways Attack: Attack phase always, RangedSiege only when modifiers
                // convert melee → useful type (ColdFire or Siege).
                if combat_phase == CombatPhase::Attack
                    || (combat_phase == CombatPhase::RangedSiege
                        && has_attack_conversion_modifier(state, player_idx))
                {
                    sideways_actions.push(LegalAction::PlayCardSideways {
                        hand_index,
                        card_id: card_id.clone(),
                        sideways_as: SidewaysAs::Attack,
                    });
                }
                if combat_phase == CombatPhase::Block {
                    sideways_actions.push(LegalAction::PlayCardSideways {
                        hand_index,
                        card_id: card_id.clone(),
                        sideways_as: SidewaysAs::Block,
                    });
                }
            }
        }
    }

    actions.extend(basic_actions);
    actions.extend(powered_actions);
    actions.extend(sideways_actions);
}

fn is_effect_playable_for_enumeration(
    state: &GameState,
    player_idx: usize,
    source_hand_index: usize,
    effect: &CardEffect,
) -> bool {
    match effect {
        CardEffect::CardBoost { .. } => {
            has_playable_card_boost_target(state, player_idx, source_hand_index)
        }
        _ => is_resolvable(state, player_idx, effect),
    }
}

fn has_playable_card_boost_target(
    state: &GameState,
    player_idx: usize,
    source_hand_index: usize,
) -> bool {
    let player = &state.players[player_idx];

    player
        .hand
        .iter()
        .enumerate()
        .any(|(target_hand_index, target_card_id)| {
            if target_hand_index == source_hand_index {
                return false;
            }

            let target_def = match get_card(target_card_id.as_str()) {
                Some(def) => def,
                None => return false,
            };

            // CardBoost can target only action cards (not wounds/spells/artifacts).
            if !matches!(
                target_def.card_type,
                DeedCardType::BasicAction | DeedCardType::AdvancedAction
            ) {
                return false;
            }
            if target_def.card_type == DeedCardType::Wound {
                return false;
            }

            // Powered target effect itself must be resolvable in current context.
            if !is_resolvable(state, player_idx, &target_def.powered_effect) {
                return false;
            }

            // For discard-cost targets, both source and target leave hand before
            // resolving the boosted powered effect. Ensure costs remain payable.
            let remaining_hand: Vec<CardId> = player
                .hand
                .iter()
                .enumerate()
                .filter_map(|(idx, id)| {
                    (idx != source_hand_index && idx != target_hand_index).then_some(id.clone())
                })
                .collect();

            discard_costs_payable_with_hand(&target_def.powered_effect, &remaining_hand)
        })
}

fn discard_costs_payable_with_hand(effect: &CardEffect, remaining_hand: &[CardId]) -> bool {
    match effect {
        CardEffect::DiscardCost {
            count,
            filter_wounds,
            wounds_only,
            then_effect,
        } => {
            let eligible = remaining_hand
                .iter()
                .filter(|id| {
                    let is_wound = id.as_str() == WOUND_CARD_ID;
                    if *wounds_only {
                        is_wound
                    } else if *filter_wounds {
                        !is_wound
                    } else {
                        true
                    }
                })
                .count() as u32;
            eligible >= *count && discard_costs_payable_with_hand(then_effect, remaining_hand)
        }
        CardEffect::Choice { options } => options
            .iter()
            .any(|option| discard_costs_payable_with_hand(option, remaining_hand)),
        CardEffect::Compound { effects } => effects
            .iter()
            .any(|sub| discard_costs_payable_with_hand(sub, remaining_hand)),
        CardEffect::Conditional {
            then_effect,
            else_effect,
            ..
        } => {
            discard_costs_payable_with_hand(then_effect, remaining_hand)
                || else_effect.as_ref().is_some_and(|else_branch| {
                    discard_costs_payable_with_hand(else_branch, remaining_hand)
                })
        }
        CardEffect::Scaling { base_effect, .. } => {
            discard_costs_payable_with_hand(base_effect, remaining_hand)
        }
        _ => true,
    }
}

/// Returns true if the effect tree produces only influence (no move/attack/block/other value)
/// AND contains at least one influence-producing leaf.
///
/// Used to suppress basic/powered card plays for pure-influence cards when not at a site
/// (`!IS_INTERACTING`), since influence is useless outside site interactions.
///
/// Purely neutral effects (e.g. Cure, ConvertManaToCrystal) return false — they should
/// always be available regardless of interaction mode.
pub(super) fn is_influence_only(effect: &CardEffect) -> bool {
    has_influence_leaf(effect) && no_non_influence_value(effect)
}

/// Returns true if the effect tree produces only movement (no influence/attack/block/other value)
/// AND contains at least one move-producing leaf.
///
/// Used to suppress basic/powered card plays for pure-move cards when at a site
/// (`IS_INTERACTING`), since movement is useless during site interaction.
pub(super) fn is_move_only(effect: &CardEffect) -> bool {
    has_move_leaf(effect) && no_non_move_value(effect)
}

/// Returns true if the tree contains at least one influence-producing leaf.
fn has_influence_leaf(effect: &CardEffect) -> bool {
    match effect {
        CardEffect::GainInfluence { .. } | CardEffect::PeacefulMomentAction { .. } => true,
        CardEffect::Compound { effects } => effects.iter().any(has_influence_leaf),
        CardEffect::Choice { options } => options.iter().any(has_influence_leaf),
        CardEffect::Conditional {
            then_effect,
            else_effect,
            ..
        } => {
            has_influence_leaf(then_effect)
                || else_effect.as_ref().is_some_and(|e| has_influence_leaf(e))
        }
        CardEffect::Scaling { base_effect, .. } => has_influence_leaf(base_effect),
        CardEffect::DiscardCost { then_effect, .. } => has_influence_leaf(then_effect),
        _ => false,
    }
}

/// Returns true if the tree contains no non-influence value-producing effects.
fn no_non_influence_value(effect: &CardEffect) -> bool {
    match effect {
        // Influence producers — OK
        CardEffect::GainInfluence { .. } | CardEffect::PeacefulMomentAction { .. } => true,

        // Non-influence value producers → false
        CardEffect::GainMove { .. }
        | CardEffect::GainAttack { .. }
        | CardEffect::GainBlock { .. }
        | CardEffect::GainBlockElement { .. }
        | CardEffect::GainHealing { .. }
        | CardEffect::GainMana { .. }
        | CardEffect::DrawCards { .. }
        | CardEffect::CardBoost { .. }
        | CardEffect::ManaBolt { .. }
        | CardEffect::PureMagic { .. }
        | CardEffect::AttackWithDefeatBonus { .. }
        | CardEffect::GainAttackBowResolved { .. }
        | CardEffect::SelectCombatEnemy { .. }
        | CardEffect::SongOfWindPowered => false,

        // Neutral — doesn't produce move/attack/block value
        CardEffect::ChangeReputation { .. }
        | CardEffect::GainFame { .. }
        | CardEffect::GainCrystal { .. }
        | CardEffect::ConvertManaToCrystal
        | CardEffect::TakeWound
        | CardEffect::Noop
        | CardEffect::ApplyModifier { .. }
        | CardEffect::HandLimitBonus { .. }
        | CardEffect::ReadyUnit { .. }
        | CardEffect::HealUnit { .. }
        | CardEffect::ReadyAllUnits
        | CardEffect::HealAllUnits
        | CardEffect::ActivateBannerProtection
        | CardEffect::FamePerEnemyDefeated { .. }
        | CardEffect::GrantWoundImmunity
        | CardEffect::RushOfAdrenaline { .. }
        | CardEffect::EnergyFlow { .. }
        | CardEffect::ReadyUnitsBudget { .. }
        | CardEffect::SelectUnitForModifier { .. }
        | CardEffect::Cure { .. }
        | CardEffect::Disease => true,

        // Structural — recurse
        CardEffect::Compound { effects } => effects.iter().all(no_non_influence_value),
        CardEffect::Choice { options } => options.iter().all(no_non_influence_value),
        CardEffect::Conditional {
            then_effect,
            else_effect,
            ..
        } => {
            no_non_influence_value(then_effect)
                && else_effect
                    .as_ref()
                    .is_none_or(|e| no_non_influence_value(e))
        }
        CardEffect::Scaling { base_effect, .. } => no_non_influence_value(base_effect),
        CardEffect::DiscardCost { then_effect, .. } => no_non_influence_value(then_effect),

        // Complex / unknown → conservative false (don't gate)
        _ => false,
    }
}

/// Returns true if the tree contains at least one move-producing leaf.
fn has_move_leaf(effect: &CardEffect) -> bool {
    match effect {
        CardEffect::GainMove { .. } | CardEffect::SongOfWindPowered => true,
        CardEffect::Compound { effects } => effects.iter().any(has_move_leaf),
        CardEffect::Choice { options } => options.iter().any(has_move_leaf),
        CardEffect::Conditional {
            then_effect,
            else_effect,
            ..
        } => {
            has_move_leaf(then_effect)
                || else_effect.as_ref().is_some_and(|e| has_move_leaf(e))
        }
        CardEffect::Scaling { base_effect, .. } => has_move_leaf(base_effect),
        CardEffect::DiscardCost { then_effect, .. } => has_move_leaf(then_effect),
        _ => false,
    }
}

/// Returns true if the tree contains no non-move value-producing effects.
fn no_non_move_value(effect: &CardEffect) -> bool {
    match effect {
        // Move producers — OK
        CardEffect::GainMove { .. } | CardEffect::SongOfWindPowered => true,

        // Non-move value producers → false
        CardEffect::GainInfluence { .. }
        | CardEffect::GainAttack { .. }
        | CardEffect::GainBlock { .. }
        | CardEffect::GainBlockElement { .. }
        | CardEffect::GainHealing { .. }
        | CardEffect::GainMana { .. }
        | CardEffect::DrawCards { .. }
        | CardEffect::CardBoost { .. }
        | CardEffect::ManaBolt { .. }
        | CardEffect::PureMagic { .. }
        | CardEffect::AttackWithDefeatBonus { .. }
        | CardEffect::GainAttackBowResolved { .. }
        | CardEffect::SelectCombatEnemy { .. }
        | CardEffect::PeacefulMomentAction { .. } => false,

        // Neutral — doesn't produce influence/attack/block value
        CardEffect::ChangeReputation { .. }
        | CardEffect::GainFame { .. }
        | CardEffect::GainCrystal { .. }
        | CardEffect::ConvertManaToCrystal
        | CardEffect::TakeWound
        | CardEffect::Noop
        | CardEffect::ApplyModifier { .. }
        | CardEffect::HandLimitBonus { .. }
        | CardEffect::ReadyUnit { .. }
        | CardEffect::HealUnit { .. }
        | CardEffect::ReadyAllUnits
        | CardEffect::HealAllUnits
        | CardEffect::ActivateBannerProtection
        | CardEffect::FamePerEnemyDefeated { .. }
        | CardEffect::GrantWoundImmunity
        | CardEffect::RushOfAdrenaline { .. }
        | CardEffect::EnergyFlow { .. }
        | CardEffect::ReadyUnitsBudget { .. }
        | CardEffect::SelectUnitForModifier { .. }
        | CardEffect::Cure { .. }
        | CardEffect::Disease => true,

        // Structural — recurse
        CardEffect::Compound { effects } => effects.iter().all(no_non_move_value),
        CardEffect::Choice { options } => options.iter().all(no_non_move_value),
        CardEffect::Conditional {
            then_effect,
            else_effect,
            ..
        } => {
            no_non_move_value(then_effect)
                && else_effect
                    .as_ref()
                    .is_none_or(|e| no_non_move_value(e))
        }
        CardEffect::Scaling { base_effect, .. } => no_non_move_value(base_effect),
        CardEffect::DiscardCost { then_effect, .. } => no_non_move_value(then_effect),

        // Complex / unknown → conservative false (don't gate)
        _ => false,
    }
}

/// Check if player can afford to power a card requiring the given color.
///
/// Mirrors `collect_mana_sources` logic but doesn't mutate state.
fn can_afford_powered(state: &GameState, player_idx: usize, color: BasicManaColor) -> bool {
    let player = &state.players[player_idx];
    let target = ManaColor::from(color);

    // 1. Matching-color mana token.
    if player.pure_mana.iter().any(|t| t.color == target) {
        return true;
    }

    // 2. Gold mana token (wild).
    if player.pure_mana.iter().any(|t| t.color == ManaColor::Gold) {
        return true;
    }

    // 3. Matching-color crystal.
    let crystal_count = match color {
        BasicManaColor::Red => player.crystals.red,
        BasicManaColor::Blue => player.crystals.blue,
        BasicManaColor::Green => player.crystals.green,
        BasicManaColor::White => player.crystals.white,
    };
    if crystal_count > 0 {
        return true;
    }

    // 4. Available mana source die (1 per turn limit).
    if !player
        .flags
        .contains(PlayerFlags::USED_MANA_FROM_SOURCE)
    {
        let has_matching_die = state.source.dice.iter().any(|die| {
            crate::card_play::is_die_available_with_overrides(die, state, player_idx)
                && die.taken_by_player_id.is_none()
                && (die.color == target || die.color == ManaColor::Gold)
        });
        if has_matching_die {
            return true;
        }
    }

    false
}
