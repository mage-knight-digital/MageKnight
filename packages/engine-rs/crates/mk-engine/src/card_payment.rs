//! Card mana costs and complete payments, shared by enumeration and execution.

use mk_data::cards::{CardDefinition, PoweredBy};
use mk_types::action::ManaSourceInfo;
use mk_types::enums::{
    BasicManaColor, DeedCardType, ManaColor, ManaSourceType, TimeOfDay, ALL_BASIC_MANA_COLORS,
};
use mk_types::modifier::{ModifierEffect, RuleOverride};
use mk_types::pending::{CardManaPayment, CardManaSource, EffectMode};
use mk_types::state::{GameState, PlayerFlags};

use crate::card_play::{
    consume_specific_mana_source_with, is_die_available_with_overrides, is_rule_active,
    modifier_applies_to_player, to_basic_mana_color,
};

#[derive(Clone, Copy)]
pub(crate) enum CardManaCost {
    Free,
    Color(BasicManaColor),
    ColorAndBlack(BasicManaColor),
}

pub(crate) fn cost(
    card: &CardDefinition,
    mode: EffectMode,
    selected_color: Option<BasicManaColor>,
) -> Option<CardManaCost> {
    use CardManaCost::{Color, ColorAndBlack, Free};

    match (card.card_type, mode, card.powered_by) {
        (DeedCardType::Spell, EffectMode::Basic, PoweredBy::Single(color)) => Some(Color(color)),
        (DeedCardType::Spell, EffectMode::Powered, PoweredBy::Single(color))
            if selected_color.is_none_or(|selected| selected == color) =>
        {
            Some(ColorAndBlack(color))
        }
        (DeedCardType::Spell, _, _) => None,
        (_, EffectMode::Basic, _) | (_, EffectMode::Powered, PoweredBy::Free) => Some(Free),
        (_, EffectMode::Powered, PoweredBy::Single(color)) => {
            Some(Color(selected_color.unwrap_or(color)))
        }
        (_, EffectMode::Powered, PoweredBy::AnyBasic) => selected_color.map(Color),
        _ => None,
    }
}

pub(crate) fn can_pay(
    state: &GameState,
    player_idx: usize,
    card: &CardDefinition,
    mode: EffectMode,
    color: Option<BasicManaColor>,
) -> bool {
    match cost(card, mode, color) {
        Some(CardManaCost::Free) => true,
        Some(cost) => payments(state, player_idx, card.card_type, cost)
            .next()
            .is_some(),
        None => false,
    }
}

pub(crate) fn payments(
    state: &GameState,
    player_idx: usize,
    card_type: DeedCardType,
    cost: CardManaCost,
) -> impl Iterator<Item = CardManaPayment> + '_ {
    let (color, strong_spell) = match cost {
        CardManaCost::Free => (None, false),
        CardManaCost::Color(color) => (Some(color), false),
        CardManaCost::ColorAndBlack(color) => (Some(color), true),
    };
    let is_spell = card_type == DeedCardType::Spell;
    let budget = source_dice_remaining(state, player_idx, is_spell);
    color.into_iter().flat_map(move |color| {
        sources(
            state,
            player_idx,
            color.into(),
            is_spell,
            strong_spell,
            budget > 0,
        )
        .flat_map(move |colored| {
            let single = (!strong_spell).then(|| CardManaPayment::Single(colored.clone()));
            let pairs = strong_spell
                .then(|| sources(state, player_idx, ManaColor::Black, true, true, budget > 0))
                .into_iter()
                .flatten()
                .filter_map(move |black| {
                    (dice_used(&colored) + dice_used(&black) <= budget
                        && !same_die(&colored, &black))
                    .then(|| CardManaPayment::WithBlack {
                        colored: colored.clone(),
                        black,
                    })
                });
            single.into_iter().chain(pairs)
        })
    })
}

pub(crate) fn spend(state: &mut GameState, player_idx: usize, payment: &CardManaPayment) {
    let strong_spell = matches!(payment, CardManaPayment::WithBlack { .. });
    let black = match payment {
        CardManaPayment::Single(_) => None,
        CardManaPayment::WithBlack { black, .. } => Some(black),
    };
    for source in std::iter::once(payment.colored_source()).chain(black) {
        if let CardManaSource::Spend(source) = source {
            consume_specific_mana_source_with(state, player_idx, source, |token| {
                !strong_spell || !token.cannot_power_spells
            });
        }
    }
}

/// Revalidate a saved payment before spending either source.
pub(crate) fn payment_is_available(
    state: &GameState,
    player_idx: usize,
    card: &CardDefinition,
    mode: EffectMode,
    payment: &CardManaPayment,
) -> bool {
    let matches_cost = |selected_color| {
        cost(card, mode, selected_color).is_some_and(|cost| {
            payments(state, player_idx, card.card_type, cost).any(|option| option == *payment)
        })
    };
    if mode == EffectMode::Powered && card.card_type != DeedCardType::Spell {
        let paid_color = to_basic_mana_color(payment.colored_source().color());
        if card.powered_by == PoweredBy::AnyBasic && paid_color.is_none() {
            return ALL_BASIC_MANA_COLORS
                .into_iter()
                .any(|color| matches_cost(Some(color)));
        }
        return matches_cost(paid_color);
    }
    matches_cost(None)
}

fn sources(
    state: &GameState,
    player_idx: usize,
    color: ManaColor,
    is_spell: bool,
    strong_spell: bool,
    allow_die: bool,
) -> impl Iterator<Item = CardManaSource> + '_ {
    let player = &state.players[player_idx];
    let night = state.time_of_day == TimeOfDay::Night
        || state
            .combat
            .as_ref()
            .is_some_and(|combat| combat.night_mana_rules);
    let gold_available =
        !is_spell || !night || is_rule_active(state, player_idx, RuleOverride::AllowGoldAtNight);
    let black_available = night || is_rule_active(state, player_idx, RuleOverride::AllowBlackAtDay);
    let can_use_color = color != ManaColor::Black || black_available;
    let is_matching = move |source_color| {
        can_use_color
            && (source_color == color
                || (color != ManaColor::Black && source_color == ManaColor::Gold && gold_available))
    };
    let has_token = |token_color| {
        is_matching(token_color)
            && player.pure_mana.iter().any(|token| {
                token.color == token_color && (!strong_spell || !token.cannot_power_spells)
            })
    };
    let from_personal_supply = |source_type, color| {
        CardManaSource::Spend(ManaSourceInfo {
            source_type,
            color,
            die_id: None,
        })
    };

    let endless = is_spell && can_use_color && state.active_modifiers.iter().any(|modifier| {
        modifier_applies_to_player(modifier, &player.id)
            && matches!(&modifier.effect, ModifierEffect::EndlessMana { colors } if colors.contains(&color))
    });
    let personal = [
        endless.then_some(CardManaSource::Endless { endless: color }),
        has_token(color).then(|| from_personal_supply(ManaSourceType::Token, color)),
        has_token(ManaColor::Gold).then(|| from_personal_supply(ManaSourceType::Token, ManaColor::Gold)),
        to_basic_mana_color(color)
            .filter(|color| match color {
                BasicManaColor::Red => player.crystals.red,
                BasicManaColor::Blue => player.crystals.blue,
                BasicManaColor::Green => player.crystals.green,
                BasicManaColor::White => player.crystals.white,
            } > 0)
            .map(|_| from_personal_supply(ManaSourceType::Crystal, color)),
    ];
    let stolen_die_id = player
        .tactic_state
        .stored_mana_die
        .as_ref()
        .map(|stored| &stored.die_id);
    let dice = state
        .source
        .dice
        .iter()
        .filter(move |die| {
            allow_die
                && is_matching(die.color)
                && (is_die_available_with_overrides(die, state, player_idx)
                    || (is_spell && night && die.color == ManaColor::Black))
                && (die.taken_by_player_id.is_none()
                    || (die.taken_by_player_id.as_ref() == Some(&player.id)
                        && stolen_die_id == Some(&die.id)
                        && !player.tactic_state.mana_steal_used_this_turn))
        })
        .map(|die| {
            CardManaSource::Spend(ManaSourceInfo {
                source_type: ManaSourceType::Die,
                color: die.color,
                die_id: Some(die.id.as_str().to_owned()),
            })
        });
    personal.into_iter().flatten().chain(dice)
}

fn source_dice_remaining(state: &GameState, player_idx: usize, is_spell: bool) -> usize {
    let player = &state.players[player_idx];
    let has_used_source = player.flags.contains(PlayerFlags::USED_MANA_FROM_SOURCE);
    let extra = if is_spell {
        state
            .active_modifiers
            .iter()
            .filter(|modifier| {
                modifier_applies_to_player(modifier, &player.id)
                    && matches!(
                        modifier.effect,
                        ModifierEffect::RuleOverride {
                            rule: RuleOverride::ExtraSourceDie
                        }
                    )
            })
            .count()
    } else {
        0
    };
    let used = player.used_die_ids.len().max(usize::from(has_used_source));
    (1 + extra).saturating_sub(used)
}

fn dice_used(source: &CardManaSource) -> usize {
    usize::from(matches!(
        source,
        CardManaSource::Spend(source) if source.source_type == ManaSourceType::Die
    ))
}

fn same_die(first: &CardManaSource, second: &CardManaSource) -> bool {
    matches!((first, second), (CardManaSource::Spend(first), CardManaSource::Spend(second))
        if first.die_id.is_some() && first.die_id == second.die_id)
}
