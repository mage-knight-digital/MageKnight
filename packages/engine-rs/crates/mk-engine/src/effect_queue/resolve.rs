//! Single effect resolution dispatch and structural effect handlers.

use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::modifier::RuleOverride;
use mk_types::pending::EffectMode;
use mk_types::state::*;

use super::{MAX_REPUTATION, MIN_REPUTATION, ResolveResult};
use super::advanced_actions::*;
use super::artifacts::*;
use super::atomic::*;
use super::conditions::{evaluate_condition, evaluate_scaling, is_resolvable};
use super::multi_step::*;
use super::spells::*;
use super::utils::scale_effect;

use crate::undo::UndoStack;

pub(super) fn resolve_one(
    state: &mut GameState,
    player_idx: usize,
    effect: &CardEffect,
    undo: &mut Option<&mut UndoStack>,
) -> ResolveResult {
    match effect {
        // === Atomic effects ===
        CardEffect::GainMove { amount } => {
            state.players[player_idx].move_points += amount;
            ResolveResult::Applied
        }
        CardEffect::GainInfluence { amount } => {
            state.players[player_idx].influence_points += amount;
            ResolveResult::Applied
        }
        CardEffect::GainAttack {
            amount,
            combat_type,
            element,
        } => apply_gain_attack(state, player_idx, *amount, *combat_type, *element),
        CardEffect::GainBlock { amount, element } => {
            apply_gain_block(state, player_idx, *amount, *element)
        }
        CardEffect::GainHealing { amount } => apply_gain_healing(state, player_idx, *amount),
        CardEffect::GainMana { color, amount } => {
            apply_gain_mana(state, player_idx, *color, *amount)
        }
        CardEffect::DrawCards { count } => apply_draw_cards(state, player_idx, *count, undo),
        CardEffect::GainFame { amount } => {
            state.players[player_idx].fame += amount;
            // TODO: level-up threshold check (Phase 3)
            ResolveResult::Applied
        }
        CardEffect::ChangeReputation { amount } => {
            let player = &mut state.players[player_idx];
            let new_rep = (player.reputation as i32 + *amount)
                .clamp(MIN_REPUTATION as i32, MAX_REPUTATION as i32);
            player.reputation = new_rep as i8;
            ResolveResult::Applied
        }
        CardEffect::GainCrystal { color } => apply_gain_crystal(state, player_idx, *color),
        CardEffect::TakeWound => apply_take_wound(state, player_idx),
        CardEffect::Noop => ResolveResult::Skipped,

        // === Multi-step / cost effects ===
        CardEffect::ConvertManaToCrystal => apply_convert_mana_to_crystal(state, player_idx),
        CardEffect::CardBoost { bonus } => apply_card_boost(state, player_idx, *bonus),
        CardEffect::ManaDrawPowered {
            dice_count: _,
            tokens_per_die,
        } => {
            // Simplified: gain one mana token of each basic color per token_per_die.
            // Full implementation would involve die selection from source.
            // For now, offer a color choice for each token gained.
            apply_mana_draw_powered_simplified(state, player_idx, *tokens_per_die)
        }
        CardEffect::DiscardCost {
            count,
            filter_wounds,
            wounds_only,
            then_effect,
        } => apply_discard_cost(state, player_idx, *count, *filter_wounds, *wounds_only, then_effect),
        CardEffect::ApplyModifier {
            effect,
            duration,
            scope,
        } => apply_modifier(state, player_idx, effect, duration, scope),
        CardEffect::GainBlockElement { amount, element } => {
            apply_gain_block(state, player_idx, *amount, *element)
        }
        CardEffect::HandLimitBonus { bonus } => {
            state.players[player_idx].hand_limit += bonus;
            ResolveResult::Applied
        }
        CardEffect::ReadyUnit { max_level } => apply_ready_unit(state, player_idx, *max_level),
        CardEffect::HealUnit { max_level } => apply_heal_unit(state, player_idx, *max_level),
        CardEffect::DiscardForBonus {
            choice_options,
            bonus_per_card,
            max_discards,
            discard_filter,
        } => apply_discard_for_bonus(
            state,
            player_idx,
            choice_options,
            *bonus_per_card,
            *max_discards,
            *discard_filter,
        ),
        CardEffect::Decompose { mode } => apply_decompose(state, player_idx, *mode),
        CardEffect::DiscardForAttack { attacks_by_color } => {
            apply_discard_for_attack(state, player_idx, attacks_by_color)
        }
        CardEffect::PureMagic { amount } => apply_pure_magic(state, player_idx, *amount),
        CardEffect::AttackWithDefeatBonus {
            amount,
            combat_type,
            element,
            reputation_per_defeat,
            fame_per_defeat,
            armor_reduction_per_defeat,
        } => apply_attack_with_defeat_bonus(
            state,
            player_idx,
            *amount,
            *combat_type,
            *element,
            *reputation_per_defeat,
            *fame_per_defeat,
            *armor_reduction_per_defeat,
        ),

        // === Structural effects ===
        CardEffect::Compound { effects } => ResolveResult::Decomposed(effects.clone()),
        CardEffect::Choice { options } => resolve_choice(state, player_idx, options),
        CardEffect::Conditional {
            condition,
            then_effect,
            else_effect,
        } => resolve_conditional(state, player_idx, condition, then_effect, else_effect),
        CardEffect::Scaling {
            factor,
            base_effect,
            bonus_per_count,
            maximum,
        } => resolve_scaling(state, player_idx, factor, base_effect, *bonus_per_count, *maximum),

        // === Combat targeting ===
        CardEffect::SelectCombatEnemy { template } => {
            resolve_select_combat_enemy(state, player_idx, template)
        }

        // === Healing spells ===
        CardEffect::Cure { amount } => resolve_cure(state, player_idx, *amount),
        CardEffect::Disease => resolve_disease(state, player_idx),

        // === Spell effects ===
        CardEffect::EnergyFlow { heal } => apply_energy_flow(state, player_idx, *heal),
        CardEffect::ManaBolt { base_value } => apply_mana_bolt(state, player_idx, *base_value),
        CardEffect::DiscardForCrystal { optional } => {
            apply_discard_for_crystal(state, player_idx, *optional)
        }
        CardEffect::Sacrifice => apply_sacrifice(state, player_idx),
        CardEffect::ManaClaim { with_curse } => apply_mana_claim(state, player_idx, *with_curse),

        // === Advanced Action effects ===
        CardEffect::SelectUnitForModifier { modifier, duration } => {
            apply_select_unit_for_modifier(state, player_idx, modifier, duration)
        }
        CardEffect::SongOfWindPowered => apply_song_of_wind_powered(state, player_idx),
        CardEffect::RushOfAdrenaline { mode } => apply_rush_of_adrenaline(state, player_idx, *mode),
        CardEffect::PowerOfCrystalsBasic => apply_power_of_crystals_basic(state, player_idx),
        CardEffect::PowerOfCrystalsPowered => apply_power_of_crystals_powered(state, player_idx),
        CardEffect::CrystalMasteryBasic => apply_crystal_mastery_basic(state, player_idx),
        CardEffect::CrystalMasteryPowered => apply_crystal_mastery_powered(state, player_idx),
        CardEffect::ManaStormBasic => apply_mana_storm_basic(state, player_idx),
        CardEffect::ManaStormPowered => apply_mana_storm_powered(state, player_idx),
        CardEffect::Training { mode } => apply_training(state, player_idx, *mode),
        CardEffect::SpellForgeBasic => apply_spell_forge_basic(state, player_idx),
        CardEffect::SpellForgePowered => apply_spell_forge_powered(state, player_idx),
        CardEffect::MagicTalentBasic => apply_magic_talent_basic(state, player_idx),
        CardEffect::MagicTalentPowered => apply_magic_talent_powered(state, player_idx),
        CardEffect::BloodOfAncientsBasic => apply_blood_of_ancients_basic(state, player_idx),
        CardEffect::BloodOfAncientsPowered => apply_blood_of_ancients_powered(state, player_idx),
        CardEffect::MaximalEffect { mode } => apply_maximal_effect(state, player_idx, *mode),
        CardEffect::PeacefulMomentAction { influence, allow_refresh } => {
            apply_peaceful_moment_action(state, player_idx, *influence, *allow_refresh)
        }
        CardEffect::PeacefulMomentConvert { influence_remaining, allow_refresh, refreshed } => {
            apply_peaceful_moment_convert(state, player_idx, *influence_remaining, *allow_refresh, *refreshed)
        }

        // === Spell effects (new) ===
        CardEffect::ManaMeltdown { powered } => apply_mana_meltdown(state, player_idx, *powered),
        CardEffect::MindRead { powered } => apply_mind_read(state, player_idx, *powered),
        CardEffect::CallToArms => apply_call_to_arms(state, player_idx),
        CardEffect::FreeRecruit => apply_free_recruit(state, player_idx),
        CardEffect::WingsOfNight => apply_wings_of_night(state, player_idx),
        CardEffect::PossessEnemy => apply_possess_enemy(state, player_idx),
        CardEffect::Meditation { powered } => apply_meditation(state, player_idx, *powered),
        CardEffect::ReadyUnitsBudget { total_levels } => {
            apply_ready_units_budget(state, player_idx, *total_levels)
        }
        CardEffect::GrantWoundImmunity => {
            state.players[player_idx].flags.insert(PlayerFlags::WOUND_IMMUNITY_ACTIVE);
            ResolveResult::Applied
        }

        // === Artifact effects ===
        CardEffect::ReadyAllUnits => apply_ready_all_units(state, player_idx),
        CardEffect::HealAllUnits => apply_heal_all_units(state, player_idx),
        CardEffect::ActivateBannerProtection => {
            state.players[player_idx].flags.insert(PlayerFlags::BANNER_OF_PROTECTION_ACTIVE);
            ResolveResult::Applied
        }
        CardEffect::FamePerEnemyDefeated { amount, exclude_summoned } => {
            apply_fame_per_enemy_defeated(state, player_idx, *amount, *exclude_summoned)
        }
        CardEffect::RollDieForWound { die_count } => {
            apply_roll_die_for_wound(state, player_idx, *die_count)
        }
        CardEffect::ChooseBonusWithRisk {
            bonus_per_roll,
            combat_type,
            element,
            accumulated,
            rolled,
        } => apply_choose_bonus_with_risk(
            state, player_idx, *bonus_per_roll, *combat_type, *element, *accumulated, *rolled,
        ),
        CardEffect::RollForCrystals { die_count } => {
            apply_roll_for_crystals(state, player_idx, *die_count)
        }
        CardEffect::BookOfWisdom { mode } => apply_book_of_wisdom(state, player_idx, *mode),
        CardEffect::TomeOfAllSpells { mode } => apply_tome_of_all_spells(state, player_idx, *mode),
        CardEffect::CircletOfProficiencyBasic => apply_circlet_of_proficiency(state, player_idx, EffectMode::Basic),
        CardEffect::CircletOfProficiencyPowered => apply_circlet_of_proficiency(state, player_idx, EffectMode::Powered),
        CardEffect::MysteriousBox => apply_mysterious_box(state, player_idx),
        CardEffect::DruidicStaffBasic => apply_druidic_staff_basic(state, player_idx),
        CardEffect::DruidicStaffPowered => apply_druidic_staff_powered(state, player_idx),
        CardEffect::GainAttackBowResolved {
            amount,
            combat_type,
            element,
        } => apply_gain_attack_bow_resolved(state, player_idx, *amount, *combat_type, *element),

        // === Terrain-based block (Braevalar One With The Land) ===
        CardEffect::Other { effect_type: EffectType::TerrainBasedBlock } => {
            apply_terrain_based_block(state, player_idx)
        }

        // === Terrain cost reduction (Druidic Paths) ===
        CardEffect::Other { effect_type: EffectType::SelectHexForCostReduction } => {
            apply_select_hex_for_cost_reduction(state, player_idx)
        }
        CardEffect::Other { effect_type: EffectType::SelectTerrainForCostReduction } => {
            apply_select_terrain_for_cost_reduction(state, player_idx)
        }

        // === Unimplemented complex effects ===
        CardEffect::Other { .. } => ResolveResult::Skipped,
    }
}

fn resolve_choice(state: &GameState, player_idx: usize, options: &[CardEffect]) -> ResolveResult {
    let resolvable: Vec<CardEffect> = options
        .iter()
        .filter(|opt| is_resolvable(state, player_idx, opt))
        .filter(|opt| is_useful_in_current_combat_phase(state, player_idx, opt))
        .cloned()
        .collect();

    match resolvable.len() {
        0 => ResolveResult::Skipped,
        1 => ResolveResult::Decomposed(resolvable),
        _ => ResolveResult::NeedsChoice(resolvable),
    }
}

/// Returns true if the effect is useful in the current combat context, or if not in combat.
/// Filters out Move and Influence from choices during combat (they have no effect),
/// with exceptions for rule overrides (MoveCardsInCombat, InfluenceCardsInCombat)
/// and Cumbersome enemies in Block phase (move can be spent as block).
fn is_useful_in_current_combat_phase(
    state: &GameState,
    player_idx: usize,
    effect: &CardEffect,
) -> bool {
    let combat = match &state.combat {
        Some(c) => c,
        None => return true,
    };

    match effect {
        CardEffect::GainMove { .. } => {
            // Move is usable in Block phase with cumbersome enemies
            if combat.phase == CombatPhase::Block && has_cumbersome_enemy_in_combat(state) {
                return true;
            }
            crate::card_play::is_rule_active(state, player_idx, RuleOverride::MoveCardsInCombat)
        }
        CardEffect::GainInfluence { .. } => {
            crate::card_play::is_rule_active(
                state,
                player_idx,
                RuleOverride::InfluenceCardsInCombat,
            )
        }
        _ => true,
    }
}

/// Check if any undefeated enemy in combat has the Cumbersome ability.
fn has_cumbersome_enemy_in_combat(state: &GameState) -> bool {
    let combat = match &state.combat {
        Some(c) => c,
        None => return false,
    };
    combat.enemies.iter().any(|enemy| {
        if enemy.is_defeated {
            return false;
        }
        mk_data::enemies::get_enemy(enemy.enemy_id.as_str()).is_some_and(|def| {
            crate::combat_resolution::has_ability(def, EnemyAbilityType::Cumbersome)
        })
    })
}

/// Evaluate a conditional and decompose into the appropriate branch.
fn resolve_conditional(
    state: &GameState,
    player_idx: usize,
    condition: &EffectCondition,
    then_effect: &CardEffect,
    else_effect: &Option<Box<CardEffect>>,
) -> ResolveResult {
    if evaluate_condition(state, player_idx, condition) {
        ResolveResult::Decomposed(vec![then_effect.clone()])
    } else if let Some(else_eff) = else_effect {
        ResolveResult::Decomposed(vec![*else_eff.clone()])
    } else {
        ResolveResult::Skipped
    }
}

/// Evaluate a scaling factor and produce a scaled version of the base effect.
fn resolve_scaling(
    state: &GameState,
    player_idx: usize,
    factor: &ScalingFactor,
    base_effect: &CardEffect,
    bonus_per_count: Option<u32>,
    maximum: Option<u32>,
) -> ResolveResult {
    let count = evaluate_scaling(state, player_idx, factor);
    let per_count = bonus_per_count.unwrap_or(1);
    let bonus = count * per_count;
    let bonus = bonus.min(maximum.unwrap_or(u32::MAX));
    let scaled = scale_effect(base_effect, bonus);
    ResolveResult::Decomposed(vec![scaled])
}
