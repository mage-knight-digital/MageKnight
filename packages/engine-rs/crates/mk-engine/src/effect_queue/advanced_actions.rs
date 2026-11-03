//! Advanced Action card effect handlers.

use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::ids::{CardId, ModifierId};
use mk_types::modifier::*;
use mk_types::pending::{
    ChoiceResolution, EffectMode, PeacefulMomentOption,
};
use mk_types::state::*;

use super::{
    ColoredHandCardScope, ResolveResult, WOUND_CARD_ID,
    MAGIC_TALENT_CARD_ID,
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

pub(super) fn apply_mana_storm_basic(state: &mut GameState, player_idx: usize) -> ResolveResult {
    resolve_eligible_noop_choice(
        available_basic_source_dice(&state.source.dice),
        |(die_id, color)| {
            // Auto-select: gain crystal + reroll
            gain_crystal_color(state, player_idx, color);
            crate::mana::reroll_die(&mut state.source, &die_id, state.time_of_day, &mut state.rng);
            ResolveResult::Applied
        },
        |eligible_dice| {
            let (die_ids, die_colors) = eligible_dice.into_iter().unzip();
            ChoiceResolution::ManaStormDieSelect { die_ids, die_colors }
        },
    )
}

pub(super) fn apply_mana_storm_powered(state: &mut GameState, player_idx: usize) -> ResolveResult {
    // Reroll ALL dice in source
    let die_ids: Vec<mk_types::ids::SourceDieId> = state.source.dice.iter().map(|d| d.id.clone()).collect();
    for die_id in &die_ids {
        crate::mana::reroll_die(&mut state.source, die_id, state.time_of_day, &mut state.rng);
    }

    // Push 3x ExtraSourceDie + BlackAsAnyColor + GoldAsAnyColor modifiers
    let modifiers = vec![
        ModifierEffect::RuleOverride { rule: RuleOverride::ExtraSourceDie },
        ModifierEffect::RuleOverride { rule: RuleOverride::ExtraSourceDie },
        ModifierEffect::RuleOverride { rule: RuleOverride::ExtraSourceDie },
        ModifierEffect::RuleOverride { rule: RuleOverride::BlackAsAnyColor },
        ModifierEffect::RuleOverride { rule: RuleOverride::GoldAsAnyColor },
    ];
    let player_id = state.players[player_idx].id.clone();
    for (i, mod_effect) in modifiers.into_iter().enumerate() {
        let mod_id = ModifierId::from(format!("mana_storm_{}", i).as_str());
        state.active_modifiers.push(ActiveModifier {
            id: mod_id,
            effect: mod_effect,
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            source: ModifierSource::Card {
                card_id: CardId::from("mana_storm"),
                player_id: player_id.clone(),
            },
            created_at_round: state.round,
            created_by_player_id: player_id.clone(),
        });
    }
    ResolveResult::Applied
}

fn apply_spell_forge(
    state: &mut GameState,
    player_idx: usize,
    allow_second_choice: bool,
) -> ResolveResult {
    let spell_entries: Vec<(usize, BasicManaColor)> = colored_card_offer_entries(
        &state.offers.spells,
        mk_data::cards::get_spell_color,
    )
    .into_iter()
    .map(|(index, _, color)| (index, color))
    .collect();

    resolve_eligible_noop_choice(
        spell_entries,
        |(_, color)| {
            gain_crystal_color(state, player_idx, color);
            ResolveResult::Applied
        },
        |spell_entries| ChoiceResolution::SpellForgeCrystal {
            spell_entries,
            is_second: false,
            allow_second_choice,
            first_spell_index: None,
        },
    )
}

pub(super) fn apply_spell_forge_basic(state: &mut GameState, player_idx: usize) -> ResolveResult {
    apply_spell_forge(state, player_idx, false)
}

pub(super) fn apply_spell_forge_powered(state: &mut GameState, player_idx: usize) -> ResolveResult {
    apply_spell_forge(state, player_idx, true)
}

pub(super) fn apply_magic_talent_basic(state: &mut GameState, player_idx: usize) -> ResolveResult {
    let spell_entries = colored_card_offer_entries(
        &state.offers.spells,
        mk_data::cards::get_spell_color,
    );

    // Check if player has any colored cards to discard (to match spell colors)
    let has_discardable = !eligible_colored_hand_cards(
        &state.players[player_idx].hand,
        MAGIC_TALENT_CARD_ID,
        ColoredHandCardScope::ActionCards,
    )
    .is_empty();

    if !has_discardable {
        return ResolveResult::Skipped;
    }

    // Present spells as choice options (player will cast the selected spell's basic effect)
    resolve_eligible_noop_choice(
        spell_entries,
        |(_, spell_id, _)| {
            if let Some(card_def) = mk_data::cards::get_card(spell_id.as_str()) {
                ResolveResult::Decomposed(vec![card_def.basic_effect])
            } else {
                ResolveResult::Skipped
            }
        },
        |spell_entries| ChoiceResolution::MagicTalentSpellSelect { spell_entries },
    )
}

pub(super) fn apply_magic_talent_powered(state: &mut GameState, player_idx: usize) -> ResolveResult {
    // Find available mana token colors with matching spells in offer
    let player = &state.players[player_idx];
    let gain_entries: Vec<(usize, CardId, BasicManaColor)> = colored_card_offer_entries(
        &state.offers.spells,
        mk_data::cards::get_spell_color,
    )
    .into_iter()
    .filter(|(_, _, spell_color)| {
        let target_mana = ManaColor::from(*spell_color);
        player.pure_mana.iter().any(|token| token.color == target_mana)
    })
    .collect();

    resolve_eligible_noop_choice(
        gain_entries,
        |(offer_idx, spell_id, mana_color)| {
            // Auto-select
            let target = ManaColor::from(mana_color);
            let player = &mut state.players[player_idx];
            if let Some(idx) = player.pure_mana.iter().position(|t| t.color == target) {
                player.pure_mana.remove(idx);
            }
            if offer_idx < state.offers.spells.len() {
                state.offers.spells.remove(offer_idx);
                replenish_spell_offer(state);
            }
            state.players[player_idx].discard.push(spell_id);
            ResolveResult::Applied
        },
        |gain_entries| ChoiceResolution::MagicTalentGainSelect { gain_entries },
    )
}

pub(super) fn apply_blood_of_ancients_basic(state: &mut GameState, player_idx: usize) -> ResolveResult {
    // Take wound to hand
    state.players[player_idx].hand.push(CardId::from(WOUND_CARD_ID));
    state.players[player_idx].wounds_received_this_turn.hand += 1;

    // Build mana options: for each basic color with available mana AND matching AAs
    let advanced_action_entries = colored_card_offer_entries(
        &state.offers.advanced_actions,
        mk_data::cards::get_card_color,
    );
    let player = &state.players[player_idx];
    let mut mana_options: Vec<(mk_types::action::ManaSourceInfo, BasicManaColor)> = Vec::new();

    for &color in &[BasicManaColor::Red, BasicManaColor::Blue, BasicManaColor::Green, BasicManaColor::White] {
        let has_matching_aa = advanced_action_entries
            .iter()
            .any(|(_, _, aa_color)| *aa_color == color);
        if !has_matching_aa { continue; }

        let target_mana = ManaColor::from(color);
        // Check token
        if player.pure_mana.iter().any(|t| t.color == target_mana) {
            mana_options.push((mk_types::action::ManaSourceInfo {
                source_type: ManaSourceType::Token,
                color: target_mana,
                die_id: None,
            }, color));
        }
        // Check crystal
        if crystal_count(&player.crystals, color) > 0 {
            mana_options.push((mk_types::action::ManaSourceInfo {
                source_type: ManaSourceType::Crystal,
                color: target_mana,
                die_id: None,
            }, color));
        }
    }

    if mana_options.is_empty() {
        return ResolveResult::Applied; // Wound taken but no AAs available
    }

    if mana_options.len() == 1 {
        // Auto-select the single mana option
        let (ref mana_source, aa_color) = mana_options[0];
        consume_mana_source(state, player_idx, mana_source);
        // Find matching AAs
        let matching: Vec<(usize, CardId)> = advanced_action_entries
            .iter()
            .filter(|(_, _, offer_color)| *offer_color == aa_color)
            .map(|(offer_index, card_id, _)| (*offer_index, card_id.clone()))
            .collect();
        if matching.len() == 1 {
            let (offer_idx, aa_id) = &matching[0];
            let aa_id = aa_id.clone();
            state.offers.advanced_actions.remove(*offer_idx);
            replenish_aa_offer(state);
            state.players[player_idx].hand.push(aa_id);
        }
        // If multiple matching AAs, would need another choice — but for auto-select we just take first
        return ResolveResult::Applied;
    }

    let options: Vec<CardEffect> = mana_options.iter().map(|_| CardEffect::Noop).collect();
    ResolveResult::NeedsChoiceWith(
        options,
        ChoiceResolution::BloodBasicManaSelect { mana_options },
    )
}

pub(super) fn apply_blood_of_ancients_powered(state: &mut GameState, _player_idx: usize) -> ResolveResult {
    // Check if any AAs in offer
    if state.offers.advanced_actions.is_empty() {
        return ResolveResult::Skipped;
    }

    // Present wound destination choice: hand or discard
    let options = vec![
        CardEffect::Noop, // wound to hand
        CardEffect::Noop, // wound to discard
    ];
    ResolveResult::NeedsChoiceWith(
        options,
        ChoiceResolution::BloodPoweredWoundSelect,
    )
}

pub(super) fn apply_peaceful_moment_action(
    state: &mut GameState,
    player_idx: usize,
    influence: u32,
    allow_refresh: bool,
) -> ResolveResult {
    // Influence is already granted by the preceding GainInfluence in the Compound.
    // In combat, healing is not allowed — skip so only the influence portion applies.
    if state.combat.is_some() {
        return ResolveResult::Skipped;
    }

    // "You MAY play this as the action for your turn" — check if there's anything
    // worth converting (wounds to heal or units to refresh). If not, skip silently.
    let player = &state.players[player_idx];
    let has_wound = player.hand.iter().any(|c| c.as_str() == WOUND_CARD_ID);
    let has_wounded_unit = player.units.iter().any(|u| {
        u.wounded && (u.level as u32 * 2) <= influence
    });
    let has_refreshable_unit = allow_refresh
        && player.units.iter().any(|u| {
            u.state == UnitState::Spent && (u.level as u32 * 2) <= influence
        });

    if !has_wound && !has_wounded_unit && !has_refreshable_unit {
        // Nothing to heal or refresh — skip silently
        return ResolveResult::Skipped;
    }

    // Set flags to open the healing accumulation window.
    // The player can now play more cards for influence before entering the
    // conversion loop via BeginPeacefulMomentHealing.
    let flags = &mut state.players[player_idx].flags;
    flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    flags.insert(PlayerFlags::IS_PEACEFUL_MOMENT_HEALING);
    if allow_refresh {
        flags.insert(PlayerFlags::PEACEFUL_MOMENT_ALLOW_REFRESH);
    }
    ResolveResult::Applied
}

pub(super) fn apply_peaceful_moment_convert(
    state: &mut GameState,
    player_idx: usize,
    influence_remaining: u32,
    allow_refresh: bool,
    refreshed: bool,
) -> ResolveResult {
    let player = &state.players[player_idx];

    // Build available conversion options with explicit option_map
    let mut options: Vec<CardEffect> = Vec::new();
    let mut option_map: Vec<PeacefulMomentOption> = Vec::new();

    // Always: Done
    options.push(CardEffect::Noop);
    option_map.push(PeacefulMomentOption::Done);

    // Heal wound from hand (2 influence = 1 healing point)
    let has_wound = player.hand.iter().any(|c| c.as_str() == WOUND_CARD_ID);
    if influence_remaining >= 2 && has_wound {
        options.push(CardEffect::Noop);
        option_map.push(PeacefulMomentOption::HealWound);
    }

    // Heal wounded units (level × 2 influence = level healing points)
    for (i, unit) in player.units.iter().enumerate() {
        if unit.wounded {
            let cost = unit.level as u32 * 2;
            if influence_remaining >= cost {
                options.push(CardEffect::Noop);
                option_map.push(PeacefulMomentOption::HealUnit { unit_index: i });
            }
        }
    }

    // Refresh spent unit (powered only, not yet refreshed)
    if allow_refresh && !refreshed {
        if let Some(unit) = player.units.iter().find(|u| u.state == UnitState::Spent) {
            let cost = unit.level as u32 * 2;
            if influence_remaining >= cost {
                options.push(CardEffect::Noop);
                option_map.push(PeacefulMomentOption::RefreshUnit);
            }
        }
    }

    if options.len() <= 1 {
        // Only "Done" available — exit loop
        return ResolveResult::Skipped;
    }

    ResolveResult::NeedsChoiceWith(
        options,
        ChoiceResolution::PeacefulMomentConversion {
            influence_remaining,
            allow_refresh,
            refreshed,
            option_map,
        },
    )
}

