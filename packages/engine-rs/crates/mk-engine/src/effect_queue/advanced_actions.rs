//! Advanced Action card effect handlers.

use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::ids::{CardId, ModifierId};
use mk_types::modifier::*;
use mk_types::pending::{
    ChoiceResolution, EffectMode,
};
use mk_types::state::*;

use super::{
    ResolveResult, WOUND_CARD_ID,
};
use super::utils::*;

// =============================================================================
// Advanced Action effect handlers
// =============================================================================

pub(super) fn apply_select_unit_for_modifier(
    state: &mut GameState,
    player_idx: usize,
    modifier: &ModifierEffect,
    duration: &ModifierDuration,
) -> ResolveResult {
    // Find eligible units (all units are either Ready or Spent — no Destroyed state)
    let eligible: Vec<usize> = state.players[player_idx].units.iter().enumerate()
        .map(|(i, _)| i)
        .collect();

    resolve_eligible_noop_choice(
        eligible,
        |unit_idx| {
            // Auto-apply to the single unit
            let unit_iid = state.players[player_idx].units[unit_idx].instance_id.clone();
            let mod_id = ModifierId::from(format!("select_unit_mod_{}", unit_iid.as_str()).as_str());
            let player_id = state.players[player_idx].id.clone();
            let source_card = state.players[player_idx].play_area.last().cloned()
                .unwrap_or_else(|| CardId::from("force_of_nature"));
            state.active_modifiers.push(ActiveModifier {
                id: mod_id,
                effect: modifier.clone(),
                duration: *duration,
                scope: ModifierScope::OneUnit { unit_index: unit_idx as u32 },
                source: ModifierSource::Card {
                    card_id: source_card,
                    player_id: player_id.clone(),
                },
                created_at_round: state.round,
                created_by_player_id: player_id,
            });
            ResolveResult::Applied
        },
        |eligible_unit_indices| ChoiceResolution::SelectUnitModifier { eligible_unit_indices },
    )
}

pub(super) fn apply_song_of_wind_powered(state: &mut GameState, player_idx: usize) -> ResolveResult {
    // Build compound: Move 2 + terrain reductions -2 + optional lake choice
    let mut effects = vec![
        CardEffect::GainMove { amount: 2 },
        CardEffect::ApplyModifier {
            effect: ModifierEffect::TerrainCost {
                terrain: TerrainOrAll::Specific(Terrain::Plains),
                amount: -2, minimum: 0, replace_cost: None,
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
        },
        CardEffect::ApplyModifier {
            effect: ModifierEffect::TerrainCost {
                terrain: TerrainOrAll::Specific(Terrain::Desert),
                amount: -2, minimum: 0, replace_cost: None,
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
        },
        CardEffect::ApplyModifier {
            effect: ModifierEffect::TerrainCost {
                terrain: TerrainOrAll::Specific(Terrain::Wasteland),
                amount: -2, minimum: 0, replace_cost: None,
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
        },
    ];

    // Check if player has blue mana available (token, crystal, or die)
    let player = &state.players[player_idx];
    let has_blue = player.pure_mana.iter().any(|t| t.color == ManaColor::Blue)
        || player.crystals.blue > 0
        || state.source.dice.iter().any(|d| {
            d.color == ManaColor::Blue && !d.is_depleted && d.taken_by_player_id.is_none()
        });

    if has_blue {
        // Add choice: skip or pay blue for lake cost 0
        effects.push(CardEffect::Choice {
            options: vec![
                CardEffect::Noop,
                // Lake cost 0 modifier (applied after mana is consumed in ChoiceResolution)
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Lake),
                        amount: 0, minimum: 0, replace_cost: Some(0),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        });
    }

    ResolveResult::Decomposed(effects)
}

pub(super) fn apply_rush_of_adrenaline(
    state: &mut GameState,
    player_idx: usize,
    mode: EffectMode,
) -> ResolveResult {
    let player = &mut state.players[player_idx];

    match mode {
        EffectMode::Basic => {
            // Retroactive: draw 1 card per wound already taken this turn (up to 3)
            let wounds_taken = player.wounds_received_this_turn.hand.min(3);
            let remaining = 3 - wounds_taken;

            // Draw retroactive cards
            for _ in 0..wounds_taken {
                draw_one_card(player);
            }

            // Apply modifier for future wounds
            if remaining > 0 {
                let mod_id = ModifierId::from("rush_of_adrenaline");
                let player_id = state.players[player_idx].id.clone();
                state.active_modifiers.push(ActiveModifier {
                    id: mod_id,
                    effect: ModifierEffect::RushOfAdrenalineActive {
                        mode: mk_types::modifier::RushOfAdrenalineMode::Basic,
                        remaining_draws: remaining,
                        thrown_first_wound: false,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                    source: ModifierSource::Card {
                        card_id: CardId::from("rush_of_adrenaline"),
                        player_id: player_id.clone(),
                    },
                    created_at_round: state.round,
                    created_by_player_id: player_id,
                });
            }
            ResolveResult::Applied
        }
        EffectMode::Powered => {
            // Powered: throw away first wound + draw 1, then retroactive for remaining (up to 3)
            let wounds_taken = player.wounds_received_this_turn.hand;

            // Throw away first wound (remove from hand if any wound exists)
            let mut thrown = false;
            if wounds_taken > 0 {
                if let Some(wound_idx) = player.hand.iter().position(|c| c.as_str() == WOUND_CARD_ID) {
                    player.hand.remove(wound_idx);
                    player.removed_cards.push(CardId::from(WOUND_CARD_ID));
                    thrown = true;
                    // Draw 1 card for the thrown wound
                    draw_one_card(player);
                }
            }

            // Retroactive draws for remaining wounds
            let already_handled = if thrown { 1 } else { 0 };
            let retroactive = wounds_taken.saturating_sub(already_handled).min(3);
            for _ in 0..retroactive {
                draw_one_card(player);
            }

            // Apply modifier for future wounds
            let remaining = 3u32.saturating_sub(retroactive);
            if remaining > 0 {
                let mod_id = ModifierId::from("rush_of_adrenaline");
                let player_id = state.players[player_idx].id.clone();
                state.active_modifiers.push(ActiveModifier {
                    id: mod_id,
                    effect: ModifierEffect::RushOfAdrenalineActive {
                        mode: mk_types::modifier::RushOfAdrenalineMode::Powered,
                        remaining_draws: remaining,
                        thrown_first_wound: thrown,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                    source: ModifierSource::Card {
                        card_id: CardId::from("rush_of_adrenaline"),
                        player_id: player_id.clone(),
                    },
                    created_at_round: state.round,
                    created_by_player_id: player_id,
                });
            }
            ResolveResult::Applied
        }
    }
}

pub(super) fn apply_power_of_crystals_basic(state: &mut GameState, player_idx: usize) -> ResolveResult {
    let eligible = eligible_crystal_gain_colors(
        &state.players[player_idx].crystals,
        CrystalGainEligibility::AnyBelowMaximum,
    );
    resolve_eligible_noop_choice(
        eligible,
        |color| {
            gain_crystal_color(state, player_idx, color);
            ResolveResult::Applied
        },
        |eligible_colors| ChoiceResolution::PowerOfCrystalsGainColor { eligible_colors },
    )
}

pub(super) fn apply_power_of_crystals_powered(state: &mut GameState, player_idx: usize) -> ResolveResult {
    // Cannot use in combat
    if state.combat.is_some() {
        return ResolveResult::Skipped;
    }

    let crystals = &state.players[player_idx].crystals;
    let complete_sets = [crystals.red, crystals.blue, crystals.green, crystals.white]
        .iter()
        .copied()
        .min()
        .unwrap_or(0) as u32;

    let options = vec![
        CardEffect::GainMove { amount: 4 + 2 * complete_sets },
        CardEffect::GainHealing { amount: 2 + complete_sets },
        CardEffect::DrawCards { count: 2 + complete_sets },
    ];
    ResolveResult::NeedsChoice(options)
}

pub(super) fn apply_crystal_mastery_basic(state: &mut GameState, player_idx: usize) -> ResolveResult {
    let eligible = eligible_crystal_gain_colors(
        &state.players[player_idx].crystals,
        CrystalGainEligibility::ExistingBelowMaximum,
    );
    resolve_eligible_noop_choice(
        eligible,
        |color| {
            gain_crystal_color(state, player_idx, color);
            ResolveResult::Applied
        },
        |eligible_colors| ChoiceResolution::CrystalMasteryGainColor { eligible_colors },
    )
}

pub(super) fn apply_crystal_mastery_powered(state: &mut GameState, player_idx: usize) -> ResolveResult {
    state.players[player_idx].flags.insert(PlayerFlags::CRYSTAL_MASTERY_POWERED_ACTIVE);
    ResolveResult::Applied
}
