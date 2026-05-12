//! Shared utility functions for the effect queue module.

use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::ids::CardId;
use mk_types::pending::{
    ActivePending, ContinuationEntry, PendingChoice,
};
use mk_types::state::*;

use crate::undo::UndoStack;

use super::{DrainResult, EffectQueue, QueuedEffect, MAX_CRYSTALS_PER_COLOR, WOUND_CARD_ID};

pub(super) fn discard_eligible_cards(
    state: &mut GameState,
    player_idx: usize,
    discard_count: usize,
    filter: DiscardForBonusFilter,
) {
    let player = &mut state.players[player_idx];
    let initial_hand_size = player.hand.len();
    let mut remaining = discard_count;

    match filter {
        DiscardForBonusFilter::WoundOnly => {
            // Discard wounds only
            let mut i = 0;
            while i < player.hand.len() && remaining > 0 {
                if player.hand[i].as_str() == WOUND_CARD_ID {
                    let discarded = player.hand.remove(i);
                    player.discard.push(discarded);
                    remaining -= 1;
                } else {
                    i += 1;
                }
            }
        }
        DiscardForBonusFilter::AnyMaxOneWound => {
            // Discard any cards (up to 1 wound). Prefer non-wounds first.
            // First pass: discard non-wound cards
            let mut i = 0;
            while i < player.hand.len() && remaining > 0 {
                if player.hand[i].as_str() != WOUND_CARD_ID {
                    let discarded = player.hand.remove(i);
                    player.discard.push(discarded);
                    remaining -= 1;
                } else {
                    i += 1;
                }
            }
            // Second pass: discard one wound if still needed
            if remaining > 0 {
                if let Some(wound_idx) = player
                    .hand
                    .iter()
                    .position(|c| c.as_str() == WOUND_CARD_ID)
                {
                    let discarded = player.hand.remove(wound_idx);
                    player.discard.push(discarded);
                }
            }
        }
    }

    if player.hand.len() < initial_hand_size {
        player
            .flags
            .insert(PlayerFlags::DISCARDED_CARD_THIS_TURN);
    }
}

pub(super) fn draw_one_card(player: &mut PlayerState) {
    if let Some(card_id) = player.deck.pop() {
        player.hand.push(card_id);
    }
}

/// Consume a mana source (token, crystal, or die).
pub(super) fn consume_mana_source(
    state: &mut GameState,
    player_idx: usize,
    source: &mk_types::action::ManaSourceInfo,
) {
    let player = &mut state.players[player_idx];
    match source.source_type {
        ManaSourceType::Token => {
            if let Some(idx) = player.pure_mana.iter().position(|t| t.color == source.color) {
                player.pure_mana.remove(idx);
            }
        }
        ManaSourceType::Crystal => {
            if let Some(basic) = to_basic_mana_color(source.color) {
                decrement_crystal(&mut player.crystals, basic);
                increment_crystal(&mut player.spent_crystals_this_turn, basic);
            }
        }
        ManaSourceType::Die => {
            if let Some(ref die_id_str) = source.die_id {
                if let Some(die) = state.source.dice.iter_mut().find(|d| d.id.as_str() == die_id_str.as_str()) {
                    die.taken_by_player_id = Some(state.players[player_idx].id.clone());
                    die.is_depleted = true;
                }
            }
        }
    }
}

pub(super) fn increment_crystal(c: &mut Crystals, color: BasicManaColor) {
    let slot = match color {
        BasicManaColor::Red => &mut c.red,
        BasicManaColor::Blue => &mut c.blue,
        BasicManaColor::Green => &mut c.green,
        BasicManaColor::White => &mut c.white,
    };
    *slot += 1;
}

/// Replenish the spell offer from the deck.
pub fn replenish_spell_offer(state: &mut GameState) {
    if let Some(card_id) = state.decks.spell_deck.pop() {
        state.offers.spells.push(card_id);
    }
}

pub(crate) fn gain_crystal_color(state: &mut GameState, player_idx: usize, color: BasicManaColor) {
    let crystals = &mut state.players[player_idx].crystals;
    let slot = match color {
        BasicManaColor::Red => &mut crystals.red,
        BasicManaColor::Blue => &mut crystals.blue,
        BasicManaColor::Green => &mut crystals.green,
        BasicManaColor::White => &mut crystals.white,
    };
    if *slot < MAX_CRYSTALS_PER_COLOR {
        *slot += 1;
    } else {
        // Overflow: gain mana token instead
        let mana_color = ManaColor::from(color);
        state.players[player_idx].pure_mana.push(ManaToken {
            color: mana_color,
            source: ManaTokenSource::Crystal,
            cannot_power_spells: false,
        });
    }
}

/// Helper: convert ManaColor to BasicManaColor if it's a basic color.
pub(super) fn to_basic_mana_color(color: ManaColor) -> Option<BasicManaColor> {
    match color {
        ManaColor::Red => Some(BasicManaColor::Red),
        ManaColor::Blue => Some(BasicManaColor::Blue),
        ManaColor::Green => Some(BasicManaColor::Green),
        ManaColor::White => Some(BasicManaColor::White),
        _ => None, // Gold and Black are not crystallizable
    }
}

pub(super) fn add_to_elemental(values: &mut ElementalValues, element: Element, amount: u32) {
    match element {
        Element::Physical => values.physical += amount,
        Element::Fire => values.fire += amount,
        Element::Ice => values.ice += amount,
        Element::ColdFire => values.cold_fire += amount,
    }
}

/// Add amount to the appropriate element field of ElementalValues.
pub(super) fn is_enemy_arcane_immune_by_id(enemy_id: &str) -> bool {
    mk_data::enemies::get_enemy(enemy_id)
        .map(|d| d.abilities.contains(&EnemyAbilityType::ArcaneImmunity))
        .unwrap_or(false)
}

/// Convert a unit ability to a CardEffect for Call to Arms.
pub(super) fn unit_ability_to_card_effect(ability: &mk_data::units::UnitAbility) -> Option<CardEffect> {
    use mk_data::units::UnitAbility;
    match ability {
        UnitAbility::Attack { value, element } => Some(CardEffect::GainAttack {
            amount: *value,
            combat_type: CombatType::Melee,
            element: *element,
        }),
        UnitAbility::Block { value, element } => Some(CardEffect::GainBlock {
            amount: *value,
            element: *element,
        }),
        UnitAbility::RangedAttack { value, element } => Some(CardEffect::GainAttack {
            amount: *value,
            combat_type: CombatType::Ranged,
            element: *element,
        }),
        UnitAbility::SiegeAttack { value, element } => Some(CardEffect::GainAttack {
            amount: *value,
            combat_type: CombatType::Siege,
            element: *element,
        }),
        UnitAbility::Move { value } => Some(CardEffect::GainMove { amount: *value }),
        UnitAbility::Influence { value } => Some(CardEffect::GainInfluence { amount: *value }),
        UnitAbility::Heal { value } => Some(CardEffect::GainHealing { amount: *value }),
        _ => None, // Passive abilities (Swift, Brutal, etc.) not borrowable
    }
}

/// Wrapper for gain_crystal_color (no return value, for use in ChoiceResolution handlers).
pub(super) fn apply_gain_crystal_color(state: &mut GameState, player_idx: usize, color: BasicManaColor) {
    gain_crystal_color(state, player_idx, color);
}

/// Resume continuation after a ChoiceResolution is fully handled.
pub(super) fn resume_continuation(
    state: &mut GameState,
    player_idx: usize,
    source_card_id: Option<CardId>,
    continuation: Vec<ContinuationEntry>,
    undo: Option<&mut UndoStack>,
) {
    if continuation.is_empty() {
        return;
    }
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
    match queue.drain_with_undo(state, player_idx, undo) {
        DrainResult::Complete => {}
        DrainResult::NeedsChoice {
            options,
            continuation,
            resolution: new_res,
        } => {
            state.players[player_idx].pending.active =
                Some(ActivePending::Choice(PendingChoice {
                    card_id: source_card_id,
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
                    resolution: new_res,
                }));
        }
        DrainResult::PendingSet => {}
    }
}

/// Create a scaled copy of an effect with bonus added to its amount.
pub(super) fn scale_effect(effect: &CardEffect, bonus: u32) -> CardEffect {
    match effect {
        CardEffect::GainMove { amount } => CardEffect::GainMove {
            amount: amount + bonus,
        },
        CardEffect::GainInfluence { amount } => CardEffect::GainInfluence {
            amount: amount + bonus,
        },
        CardEffect::GainAttack {
            amount,
            combat_type,
            element,
        } => CardEffect::GainAttack {
            amount: amount + bonus,
            combat_type: *combat_type,
            element: *element,
        },
        CardEffect::GainBlock { amount, element } => CardEffect::GainBlock {
            amount: amount + bonus,
            element: *element,
        },
        CardEffect::GainHealing { amount } => CardEffect::GainHealing {
            amount: amount + bonus,
        },
        CardEffect::GainMana { color, amount } => CardEffect::GainMana {
            color: *color,
            amount: amount + bonus,
        },
        CardEffect::DrawCards { count } => CardEffect::DrawCards {
            count: count + bonus,
        },
        CardEffect::GainFame { amount } => CardEffect::GainFame {
            amount: amount + bonus,
        },
        CardEffect::ChangeReputation { amount } => CardEffect::ChangeReputation {
            amount: amount + bonus as i32,
        },
        CardEffect::AttackWithDefeatBonus {
            amount,
            combat_type,
            element,
            reputation_per_defeat,
            fame_per_defeat,
            armor_reduction_per_defeat,
        } => CardEffect::AttackWithDefeatBonus {
            amount: amount + bonus,
            combat_type: *combat_type,
            element: *element,
            reputation_per_defeat: *reputation_per_defeat,
            fame_per_defeat: *fame_per_defeat,
            armor_reduction_per_defeat: *armor_reduction_per_defeat,
        },
        // Recursive structural handling
        CardEffect::Compound { effects } => CardEffect::Compound {
            effects: effects.iter().map(|e| scale_effect(e, bonus)).collect(),
        },
        CardEffect::Choice { options } => CardEffect::Choice {
            options: options.iter().map(|o| scale_effect(o, bonus)).collect(),
        },
        CardEffect::Conditional {
            condition,
            then_effect,
            else_effect,
        } => CardEffect::Conditional {
            condition: condition.clone(),
            then_effect: Box::new(scale_effect(then_effect, bonus)),
            else_effect: else_effect
                .as_ref()
                .map(|e| Box::new(scale_effect(e, bonus))),
        },
        CardEffect::Scaling {
            factor,
            base_effect,
            bonus_per_count,
            maximum,
        } => CardEffect::Scaling {
            factor: factor.clone(),
            base_effect: Box::new(scale_effect(base_effect, bonus)),
            bonus_per_count: *bonus_per_count,
            maximum: *maximum,
        },
        // For effects without a simple "amount", return unchanged.
        other => other.clone(),
    }
}

/// Replenish the advanced action offer from the deck after one is taken.
pub fn replenish_aa_offer(state: &mut GameState) {
    if !state.decks.advanced_action_deck.is_empty() {
        let new_card = state.decks.advanced_action_deck.remove(0);
        state.offers.advanced_actions.insert(0, new_card);
    }
}

pub(super) fn crystal_count(c: &Crystals, color: BasicManaColor) -> u8 {
    match color {
        BasicManaColor::Red => c.red,
        BasicManaColor::Blue => c.blue,
        BasicManaColor::Green => c.green,
        BasicManaColor::White => c.white,
    }
}

pub(super) fn decrement_crystal(c: &mut Crystals, color: BasicManaColor) {
    let slot = match color {
        BasicManaColor::Red => &mut c.red,
        BasicManaColor::Blue => &mut c.blue,
        BasicManaColor::Green => &mut c.green,
        BasicManaColor::White => &mut c.white,
    };
    *slot = slot.saturating_sub(1);
}
