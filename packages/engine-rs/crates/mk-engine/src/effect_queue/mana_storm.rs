//! Mana Storm's source-die and reroll workflow.
//! Preserve source-die order, RNG consumption, pending representation and undo boundaries.

use super::utils::{available_basic_source_dice, gain_crystal_color, resolve_eligible_noop_choice};
use super::ResolveResult;
use mk_types::enums::{BasicManaColor, ManaColor};
use mk_types::ids::{CardId, ModifierId, SourceDieId};
use mk_types::modifier::{
    ActiveModifier, ModifierDuration, ModifierEffect, ModifierScope, ModifierSource, RuleOverride,
};
use mk_types::pending::ChoiceResolution;
use mk_types::state::GameState;

const MANA_STORM_CARD_ID: &str = "mana_storm";

pub(super) fn apply_mana_storm_basic(state: &mut GameState, player_idx: usize) -> ResolveResult {
    resolve_eligible_noop_choice(
        available_basic_source_dice(state),
        |(die_id, color)| {
            // Auto-select: gain crystal + reroll
            gain_crystal_and_reroll(state, player_idx, &die_id, color);
            ResolveResult::Applied
        },
        |eligible_dice| {
            let (die_ids, die_colors) = eligible_dice.into_iter().unzip();
            ChoiceResolution::ManaStormDieSelect {
                die_ids,
                die_colors,
            }
        },
    )
}

pub(super) fn apply_mana_storm_powered(state: &mut GameState, player_idx: usize) -> ResolveResult {
    // Depleted dice are still in the Source. Dice already taken are not.
    let die_ids: Vec<SourceDieId> = state.source.dice.iter()
        .filter(|die| crate::mana::is_in_source(state, die))
        .map(|die| die.id.clone())
        .collect();
    for die_id in &die_ids {
        crate::mana::reroll_die(&mut state.source, die_id, state.time_of_day, &mut state.rng);
    }

    // Push 3x ExtraSourceDie + BlackAsAnyColor + GoldAsAnyColor modifiers
    let modifiers = vec![
        ModifierEffect::RuleOverride {
            rule: RuleOverride::ExtraSourceDie,
        },
        ModifierEffect::RuleOverride {
            rule: RuleOverride::ExtraSourceDie,
        },
        ModifierEffect::RuleOverride {
            rule: RuleOverride::ExtraSourceDie,
        },
        ModifierEffect::RuleOverride {
            rule: RuleOverride::BlackAsAnyColor,
        },
        ModifierEffect::RuleOverride {
            rule: RuleOverride::GoldAsAnyColor,
        },
    ];
    let player_id = state.players[player_idx].id.clone();
    for (i, mod_effect) in modifiers.into_iter().enumerate() {
        let mod_id = ModifierId::from(format!("{}_{i}", MANA_STORM_CARD_ID).as_str());
        state.active_modifiers.push(ActiveModifier {
            id: mod_id,
            effect: mod_effect,
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            source: ModifierSource::Card {
                card_id: CardId::from(MANA_STORM_CARD_ID),
                player_id: player_id.clone(),
            },
            created_at_round: state.round,
            created_by_player_id: player_id.clone(),
        });
    }
    ResolveResult::Applied
}

fn gain_crystal_and_reroll(
    state: &mut GameState,
    player_idx: usize,
    die_id: &SourceDieId,
    color: BasicManaColor,
) {
    gain_crystal_color(state, player_idx, color);
    crate::mana::reroll_die(&mut state.source, die_id, state.time_of_day, &mut state.rng);
}

pub(super) fn select_die(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
    die_ids: &[SourceDieId],
    die_colors: &[BasicManaColor],
) -> bool {
    let Some((die_id, &color)) = die_ids.get(choice_index).zip(die_colors.get(choice_index)) else {
        return false;
    };
    if !state.source.dice.iter().any(|die| die.id == *die_id
        && die.color == ManaColor::from(color) && !die.is_depleted
        && crate::mana::is_in_source(state, die)) {
        return false;
    }
    gain_crystal_and_reroll(state, player_idx, die_id, color);
    true
}

pub(super) fn is_basic_resolvable(state: &GameState) -> bool {
    state.source.dice.iter().any(|d| {
        crate::mana::is_in_source(state, d)
            && !d.is_depleted
            && matches!(
                d.color,
                ManaColor::Red | ManaColor::Blue | ManaColor::Green | ManaColor::White
            )
    })
}

pub(crate) fn describe_mana_storm_die(color: BasicManaColor) -> String {
    format!("Take {:?} die", color)
}
