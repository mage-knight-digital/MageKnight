//! Skill application: use_skill dispatcher, sideways skills, and modifier infrastructure.

use mk_types::enums::*;
use mk_types::ids::SkillId;
use mk_types::pending::ActivePending;
use mk_types::state::*;

use crate::effect_queue;

use super::{ApplyError, ApplyResult};
use super::skills_complex;
use super::skills_interactive;


// =============================================================================
// Skill activation
// =============================================================================

pub(super) fn apply_use_skill(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_data::skills::{get_skill, SkillUsageType};

    let def = get_skill(skill_id.as_str()).ok_or_else(|| {
        ApplyError::InternalError(format!("Unknown skill: {}", skill_id.as_str()))
    })?;

    let _effect = def.effect.ok_or_else(|| {
        ApplyError::InternalError(format!("Skill {} has no effect", skill_id.as_str()))
    })?;

    // Mark cooldown
    let player = &mut state.players[player_idx];
    match def.usage_type {
        SkillUsageType::OncePerTurn => {
            player
                .skill_cooldowns
                .used_this_turn
                .push(skill_id.clone());
        }
        SkillUsageType::OncePerRound | SkillUsageType::Interactive => {
            player
                .skill_cooldowns
                .used_this_round
                .push(skill_id.clone());
        }
        _ => {}
    }

    // Motivation cross-hero cooldown: mark all motivation skill IDs as used this round
    // so no other player (or this player) can use any motivation until round end.
    if def.is_motivation {
        // The skill itself is already marked above. The cross-player check happens
        // in enumeration by scanning all players' used_this_round for motivation skills.
        // No extra action needed here.
    }

    // Custom skill handlers
    match skill_id.as_str() {
        "arythea_power_of_pain" => return apply_power_of_pain(state, player_idx, skill_id),
        "tovak_i_dont_give_a_damn" => return apply_i_dont_give_a_damn(state, player_idx, skill_id),
        "tovak_who_needs_magic" => return apply_who_needs_magic(state, player_idx, skill_id),
        "goldyx_universal_power" => return apply_universal_power(state, player_idx, skill_id),
        "braevalar_secret_ways" => return skills_complex::apply_secret_ways(state, player_idx, skill_id),
        "krang_regenerate" => return skills_complex::apply_regenerate(state, player_idx, skill_id, BasicManaColor::Red),
        "braevalar_regenerate" => return skills_complex::apply_regenerate(state, player_idx, skill_id, BasicManaColor::Green),
        "wolfhawk_dueling" => return skills_complex::apply_dueling(state, player_idx, skill_id),
        "arythea_invocation" => return skills_complex::apply_invocation(state, player_idx, skill_id),
        "arythea_polarization" => return skills_complex::apply_polarization(state, player_idx, skill_id),
        "krang_curse" => return skills_complex::apply_curse(state, player_idx, skill_id),
        "braevalar_forked_lightning" => return skills_complex::apply_forked_lightning(state, player_idx, skill_id),
        "wolfhawk_know_your_prey" => return skills_complex::apply_know_your_prey(state, player_idx, skill_id),
        "wolfhawk_wolfs_howl" => return apply_wolfs_howl(state, player_idx, skill_id),
        "krang_puppet_master" => return skills_complex::apply_puppet_master(state, player_idx, skill_id),
        "braevalar_shapeshift" => return skills_complex::apply_shapeshift(state, player_idx, skill_id),
        "norowas_prayer_of_weather" => return skills_interactive::apply_prayer_of_weather(state, player_idx, skill_id),
        "arythea_ritual_of_pain" => return skills_interactive::apply_ritual_of_pain(state, player_idx, skill_id),
        "braevalar_natures_vengeance" => return skills_interactive::apply_natures_vengeance(state, player_idx, skill_id),
        "tovak_mana_overload" => return skills_interactive::apply_mana_overload(state, player_idx, skill_id),
        "goldyx_source_opening" => return skills_interactive::apply_source_opening(state, player_idx, skill_id),
        "krang_master_of_chaos" => return skills_interactive::apply_master_of_chaos(state, player_idx, skill_id),
        _ => {}
    }

    // Create effect queue and resolve
    let mut queue = effect_queue::EffectQueue::new();
    queue.push(_effect, None);
    let drain_result = queue.drain(state, player_idx);

    match drain_result {
        effect_queue::DrainResult::Complete => {}
        effect_queue::DrainResult::NeedsChoice {
            options,
            continuation,
            resolution,
        } => {
            let cont_entries: Vec<mk_types::pending::ContinuationEntry> = continuation
                .into_iter()
                .map(|qe| mk_types::pending::ContinuationEntry {
                    effect: qe.effect,
                    source_card_id: qe.source_card_id,
                })
                .collect();
            state.players[player_idx].pending.active =
                Some(ActivePending::Choice(mk_types::pending::PendingChoice {
                    card_id: None,
                    skill_id: Some(skill_id.clone()),
                    unit_instance_id: None,
                    options,
                    continuation: cont_entries,
                    movement_bonus_applied: false,
                    resolution,
                }));
        }
        effect_queue::DrainResult::PendingSet => {
            // A custom pending was set directly (e.g., SelectCombatEnemy).
        }
    }

    // Note: skills do NOT set HAS_TAKEN_ACTION_THIS_TURN or PLAYED_CARD_FROM_HAND_THIS_TURN

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


// =============================================================================
// Passive + sideways value skill handlers
// =============================================================================

/// Push passive (Permanent) modifiers for a skill when it's acquired.
pub fn push_passive_skill_modifiers(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) {
    let passives = mk_data::skills::get_passive_modifiers(skill_id.as_str());
    for effect in passives {
        push_skill_modifier(
            state,
            player_idx,
            skill_id,
            mk_types::modifier::ModifierDuration::Permanent,
            mk_types::modifier::ModifierScope::SelfScope,
            effect,
        );
    }
}


/// Push a modifier with Skill source for the current player.
pub(crate) fn push_skill_modifier(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    duration: mk_types::modifier::ModifierDuration,
    scope: mk_types::modifier::ModifierScope,
    effect: mk_types::modifier::ModifierEffect,
) {
    use mk_types::ids::ModifierId;
    use mk_types::modifier::{ActiveModifier, ModifierSource};

    let player_id = state.players[player_idx].id.clone();
    let modifier_count = state.active_modifiers.len();
    let modifier_id = format!(
        "mod_{}_r{}_t{}",
        modifier_count, state.round, state.current_player_index
    );
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from(modifier_id.as_str()),
        source: ModifierSource::Skill {
            skill_id: skill_id.clone(),
            player_id: player_id.clone(),
        },
        duration,
        scope,
        effect,
        created_at_round: state.round,
        created_by_player_id: player_id,
    });
}


pub(super) fn apply_power_of_pain(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, RuleOverride};

    // Push RuleOverride: WoundsPlayableSideways
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::RuleOverride {
            rule: RuleOverride::WoundsPlayableSideways,
        },
    );
    // Push SidewaysValue: wounds get value 2
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 2,
            for_wounds: true,
            condition: None,
            mana_color: None,
            for_card_types: vec![],
        },
    );

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_i_dont_give_a_damn(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope};

    // Base: all non-wound cards sideways value +2
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 2,
            for_wounds: false,
            condition: None,
            mana_color: None,
            for_card_types: vec![],
        },
    );
    // Bonus: AA, Spell, Artifact get +3
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 3,
            for_wounds: false,
            condition: None,
            mana_color: None,
            for_card_types: vec![
                DeedCardType::AdvancedAction,
                DeedCardType::Spell,
                DeedCardType::Artifact,
            ],
        },
    );

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_who_needs_magic(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, RuleOverride, SidewaysCondition};

    // Base: all non-wound cards sideways value +2
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 2,
            for_wounds: false,
            condition: None,
            mana_color: None,
            for_card_types: vec![],
        },
    );
    // Bonus: +3 if no mana source die used
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 3,
            for_wounds: false,
            condition: Some(SidewaysCondition::NoManaUsed),
            mana_color: None,
            for_card_types: vec![],
        },
    );
    // If no mana used yet, block Source for the rest of turn
    if !state.players[player_idx]
        .flags
        .contains(PlayerFlags::USED_MANA_FROM_SOURCE)
    {
        push_skill_modifier(
            state,
            player_idx,
            skill_id,
            ModifierDuration::Turn,
            ModifierScope::SelfScope,
            ModifierEffect::RuleOverride {
                rule: RuleOverride::SourceBlocked,
            },
        );
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_universal_power(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    // Collect available basic mana colors from tokens
    let player = &state.players[player_idx];
    let mut available_colors: Vec<BasicManaColor> = Vec::new();
    let mut seen = [false; 4];
    for token in &player.pure_mana {
        let idx = match token.color {
            ManaColor::Red => Some(0),
            ManaColor::Blue => Some(1),
            ManaColor::Green => Some(2),
            ManaColor::White => Some(3),
            _ => None,
        };
        if let Some(i) = idx {
            if !seen[i] {
                seen[i] = true;
                available_colors.push(match i {
                    0 => BasicManaColor::Red,
                    1 => BasicManaColor::Blue,
                    2 => BasicManaColor::Green,
                    _ => BasicManaColor::White,
                });
            }
        }
    }

    if available_colors.is_empty() {
        return Err(ApplyError::InternalError(
            "Universal Power: no basic mana tokens available".into(),
        ));
    }

    if available_colors.len() == 1 {
        // Auto-consume the single option
        let color = available_colors[0];
        let mana_color = ManaColor::from(color);
        let player = &mut state.players[player_idx];
        if let Some(pos) = player.pure_mana.iter().position(|t| t.color == mana_color) {
            player.pure_mana.remove(pos);
        }
        push_universal_power_modifiers(state, player_idx, skill_id, color);
    } else {
        // Multiple options: set pending choice
        let options: Vec<CardEffect> = available_colors
            .iter()
            .map(|_| CardEffect::Noop)
            .collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::UniversalPowerMana {
                    available_colors,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(crate) fn push_universal_power_modifiers(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    color: BasicManaColor,
) {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, SidewaysCondition};

    // Base: all non-wound cards sideways value +3
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 3,
            for_wounds: false,
            condition: None,
            mana_color: None,
            for_card_types: vec![],
        },
    );
    // Bonus: +4 if card color matches spent mana color (BasicAction, AA, Spell)
    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: 4,
            for_wounds: false,
            condition: Some(SidewaysCondition::WithManaMatchingColor),
            mana_color: Some(color),
            for_card_types: vec![
                DeedCardType::BasicAction,
                DeedCardType::AdvancedAction,
                DeedCardType::Spell,
            ],
        },
    );
}


pub(super) fn apply_wolfs_howl(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope};

    let player = &state.players[player_idx];
    let level_stats = mk_data::levels::get_level_stats(player.level);
    let units_count = player.units.len() as u32;
    let empty_slots = level_stats.command_slots.saturating_sub(units_count);
    let value = 4 + empty_slots;

    push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::SidewaysValue {
            new_value: value,
            for_wounds: false,
            condition: None,
            mana_color: None,
            for_card_types: vec![],
        },
    );

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


// =============================================================================
// Pub wrappers for testing
// =============================================================================

/// Public wrapper for power_of_pain handler (testing only).
pub fn apply_power_of_pain_pub(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    let _ = apply_power_of_pain(state, player_idx, skill_id);
}


/// Public wrapper for i_dont_give_a_damn handler (testing only).
pub fn apply_i_dont_give_a_damn_pub(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    let _ = apply_i_dont_give_a_damn(state, player_idx, skill_id);
}


/// Public wrapper for who_needs_magic handler (testing only).
pub fn apply_who_needs_magic_pub(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    let _ = apply_who_needs_magic(state, player_idx, skill_id);
}


/// Public wrapper for universal_power handler (testing only).
pub fn apply_universal_power_pub(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    let _ = apply_universal_power(state, player_idx, skill_id);
}

