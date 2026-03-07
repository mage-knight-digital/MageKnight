//! Interactive skills: prayer of weather, ritual of pain, nature's vengeance,
//! return interactive skill, master of chaos, mana overload, source opening.

use mk_types::enums::*;
use mk_types::ids::{SkillId, SourceDieId};
use mk_types::state::*;
use mk_types::pending::ActivePending;

use crate::{combat_resolution, effect_queue};

use super::{ApplyError, ApplyResult};
use super::skills;


// =============================================================================
// Interactive skill handlers
// =============================================================================

/// Public wrapper for `place_skill_in_center` (used by card_play.rs).
pub fn place_skill_in_center_pub(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    place_skill_in_center(state, player_idx, skill_id);
}


/// Place an interactive skill in the center (flip + push Round/OtherPlayers markers).
pub(super) fn place_skill_in_center(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, RuleOverride, TerrainOrAll};

    // Flip skill face-down and record placement turn
    let player = &mut state.players[player_idx];
    if !player.skill_flip_state.flipped_skills.contains(skill_id) {
        player.skill_flip_state.flipped_skills.push(skill_id.clone());
    }
    player.skill_flip_state.placement_turn = state.turn_number;

    // Add center marker modifiers (Round duration, OtherPlayers scope)
    match skill_id.as_str() {
        "norowas_prayer_of_weather" => {
            skills::push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::All, amount: 0, minimum: 0, replace_cost: None,
                });
        }
        "arythea_ritual_of_pain" => {
            skills::push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::RuleOverride { rule: RuleOverride::WoundsPlayableSideways });
            skills::push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::SidewaysValue {
                    new_value: 3, for_wounds: true, condition: None,
                    mana_color: None, for_card_types: vec![],
                });
        }
        "braevalar_natures_vengeance" => {
            skills::push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::NaturesVengeanceAttackBonus { amount: 1 });
        }
        "tovak_mana_overload" => {
            // No OtherPlayers modifier — center state is in state.mana_overload_center.
            // Auto-returns on trigger, not manually returnable.
        }
        "krang_mana_enhancement" => {
            // Dummy marker for returnable_skills detection
            skills::push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::All, amount: 0, minimum: 0, replace_cost: None,
                });
        }
        "goldyx_source_opening" => {
            // Dummy marker for returnable_skills detection
            skills::push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Round, ModifierScope::OtherPlayers,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::All, amount: 0, minimum: 0, replace_cost: None,
                });
        }
        _ => {}
    }
}


/// Prayer of Weather: terrain cost -2 for owner, place in center.
pub(super) fn apply_prayer_of_weather(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, TerrainOrAll};

    // Owner benefit: all terrain costs -2 (min 1) this turn
    skills::push_skill_modifier(state, player_idx, skill_id,
        ModifierDuration::Turn, ModifierScope::SelfScope,
        ModifierEffect::TerrainCost {
            terrain: TerrainOrAll::All, amount: -2, minimum: 1, replace_cost: None,
        });

    place_skill_in_center(state, player_idx, skill_id);

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: Vec::new() })
}


/// Ritual of Pain: optionally discard 0-2 wounds, place in center.
pub(super) fn apply_ritual_of_pain(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::ChoiceResolution;

    let wound_count = state.players[player_idx].hand.iter()
        .filter(|c| c.as_str() == "wound")
        .count();

    if wound_count == 0 {
        // No wounds — skip straight to center placement
        place_skill_in_center(state, player_idx, skill_id);
    } else {
        // Build options: "Discard 0", "Discard 1", optionally "Discard 2"
        let max_wounds = wound_count.min(2);
        let mut options = Vec::new();
        for _i in 0..=max_wounds {
            options.push(CardEffect::Noop); // placeholder — choice_index IS the discard count
        }

        state.players[player_idx].pending.active = Some(ActivePending::Choice(
            mk_types::pending::PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::RitualOfPainDiscard { max_wounds },
            },
        ));
    }

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: Vec::new() })
}


/// Execute Ritual of Pain discard resolution.
pub(crate) fn execute_ritual_of_pain_discard(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
    _max_wounds: usize,
) {
    let skill_id = SkillId::from("arythea_ritual_of_pain");

    // Discard `choice_index` wounds from hand
    let mut wounds_to_remove = choice_index;
    let player = &mut state.players[player_idx];
    player.hand.retain(|c| {
        if wounds_to_remove > 0 && c.as_str() == "wound" {
            wounds_to_remove -= 1;
            false
        } else {
            true
        }
    });

    place_skill_in_center(state, player_idx, &skill_id);
}


/// Nature's Vengeance: target an enemy for attack -1 + cumbersome.
pub(super) fn apply_natures_vengeance(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::ChoiceResolution;

    let combat = state.combat.as_ref()
        .ok_or_else(|| ApplyError::InternalError("Nature's Vengeance: no combat".into()))?;

    let eligible: Vec<String> = combat.enemies.iter()
        .filter(|e| {
            !e.is_defeated && !e.is_summoner_hidden
            && mk_data::enemies::get_enemy(e.enemy_id.as_str()).is_some_and( |def| {
                !combat_resolution::has_ability(def, EnemyAbilityType::Summon)
                && !combat_resolution::has_ability(def, EnemyAbilityType::SummonGreen)
            })
        })
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    match eligible.len() {
        0 => {
            // Fizzle — don't place in center
        }
        1 => {
            apply_natures_vengeance_effects(state, player_idx, &eligible[0]);
            place_skill_in_center(state, player_idx, skill_id);
        }
        _ => {
            let mut options = Vec::new();
            for _ in &eligible {
                options.push(CardEffect::Noop); // placeholder
            }
            state.players[player_idx].pending.active = Some(ActivePending::Choice(
                mk_types::pending::PendingChoice {
                    card_id: None,
                    skill_id: Some(skill_id.clone()),
                    unit_instance_id: None,
                    options,
                    continuation: vec![],
                    movement_bonus_applied: false,
                    resolution: ChoiceResolution::NaturesVengeanceTarget {
                        eligible_enemy_ids: eligible,
                        is_return: false,
                    },
                },
            ));
        }
    }

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: Vec::new() })
}


/// Apply Nature's Vengeance effects to a target enemy: Attack -1 + Cumbersome.
pub(super) fn apply_natures_vengeance_effects(state: &mut GameState, player_idx: usize, enemy_instance_id: &str) {
    let skill_id = SkillId::from("braevalar_natures_vengeance");

    // Attack -1 modifier
    skills::push_skill_modifier(state, player_idx, &skill_id,
        mk_types::modifier::ModifierDuration::Combat,
        mk_types::modifier::ModifierScope::OneEnemy { enemy_id: enemy_instance_id.to_string() },
        mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Attack,
            amount: -1,
            minimum: 0,
            attack_index: None,
            per_resistance: false,
            fortified_amount: None,
            exclude_resistance: None,
        });

    // GrantEnemyAbility(Cumbersome) modifier
    skills::push_skill_modifier(state, player_idx, &skill_id,
        mk_types::modifier::ModifierDuration::Combat,
        mk_types::modifier::ModifierScope::OneEnemy { enemy_id: enemy_instance_id.to_string() },
        mk_types::modifier::ModifierEffect::GrantEnemyAbility {
            ability: EnemyAbilityType::Cumbersome,
        });
}


/// Execute Nature's Vengeance target resolution (from choice).
pub(crate) fn execute_natures_vengeance_target(
    state: &mut GameState,
    player_idx: usize,
    eligible_enemy_ids: &[String],
    choice_index: usize,
    is_return: bool,
) {
    if let Some(enemy_id) = eligible_enemy_ids.get(choice_index) {
        apply_natures_vengeance_effects(state, player_idx, enemy_id);
        if !is_return {
            let skill_id = SkillId::from("braevalar_natures_vengeance");
            place_skill_in_center(state, player_idx, &skill_id);
        }
    }
}


/// Return an interactive skill from the center to its owner, giving the returner a benefit.
pub(super) fn apply_return_interactive_skill(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::modifier::*;
    use mk_types::pending::ChoiceResolution;

    // Find owner by scanning modifiers (prefer different-player owner; fallback to self in solo)
    let returner_id = &state.players[player_idx].id;
    let owner_id = state.active_modifiers.iter()
        .find_map(|m| {
            if let ModifierSource::Skill { skill_id: sid, player_id: owner } = &m.source {
                if sid.as_str() == skill_id.as_str() && *owner != *returner_id {
                    return Some(owner.clone());
                }
            }
            None
        })
        .or_else(|| {
            // Solo self-return: owner == returner
            if state.dummy_player.is_some() {
                state.active_modifiers.iter().find_map(|m| {
                    if let ModifierSource::Skill { skill_id: sid, player_id: owner } = &m.source {
                        if sid.as_str() == skill_id.as_str() && *owner == *returner_id {
                            return Some(owner.clone());
                        }
                    }
                    None
                })
            } else {
                None
            }
        })
        .ok_or_else(|| ApplyError::InternalError(
            format!("ReturnInteractiveSkill: no center modifier for {}", skill_id.as_str())
        ))?;

    // Remove ALL center modifiers matching this skill + owner
    let skill_str = skill_id.as_str().to_string();
    let owner_clone = owner_id.clone();
    state.active_modifiers.retain(|m| {
        !matches!(&m.source, ModifierSource::Skill { skill_id: sid, player_id: owner }
            if sid.as_str() == skill_str && *owner == owner_clone)
    });

    // Apply return benefit per skill
    match skill_id.as_str() {
        "norowas_prayer_of_weather" => {
            skills::push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Turn, ModifierScope::SelfScope,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::All, amount: -1, minimum: 1, replace_cost: None,
                });
        }
        "arythea_ritual_of_pain" => {
            skills::push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Turn, ModifierScope::SelfScope,
                ModifierEffect::RuleOverride { rule: RuleOverride::WoundsPlayableSideways });
            skills::push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Turn, ModifierScope::SelfScope,
                ModifierEffect::SidewaysValue {
                    new_value: 3, for_wounds: true, condition: None,
                    mana_color: None, for_card_types: vec![],
                });
        }
        "braevalar_natures_vengeance" => {
            // Trigger enemy selection for returner
            let combat = state.combat.as_ref()
                .ok_or_else(|| ApplyError::InternalError("ReturnNaturesVengeance: no combat".into()))?;

            let eligible: Vec<String> = combat.enemies.iter()
                .filter(|e| {
                    !e.is_defeated && !e.is_summoner_hidden
                    && mk_data::enemies::get_enemy(e.enemy_id.as_str()).is_some_and( |def| {
                        !combat_resolution::has_ability(def, EnemyAbilityType::Summon)
                        && !combat_resolution::has_ability(def, EnemyAbilityType::SummonGreen)
                    })
                })
                .map(|e| e.instance_id.as_str().to_string())
                .collect();

            match eligible.len() {
                0 => {} // No eligible → benefit fizzles
                1 => {
                    apply_natures_vengeance_effects(state, player_idx, &eligible[0]);
                }
                _ => {
                    let mut options = Vec::new();
                    for _ in &eligible {
                        options.push(mk_types::effect::CardEffect::Noop);
                    }
                    state.players[player_idx].pending.active = Some(ActivePending::Choice(
                        mk_types::pending::PendingChoice {
                            card_id: None,
                            skill_id: Some(skill_id.clone()),
                            unit_instance_id: None,
                            options,
                            continuation: vec![],
                            movement_bonus_applied: false,
                            resolution: ChoiceResolution::NaturesVengeanceTarget {
                                eligible_enemy_ids: eligible,
                                is_return: true,
                            },
                        },
                    ));
                }
            }
        }
        "krang_mana_enhancement" => {
            // Grant returner 1 mana token of marked color
            if let Some(center) = state.mana_enhancement_center.take() {
                let mana_color = ManaColor::from(center.marked_color);
                state.players[player_idx].pure_mana.push(ManaToken {
                    color: mana_color,
                    source: ManaTokenSource::Effect,
                    cannot_power_spells: false,
                });
            }
        }
        "goldyx_source_opening" => {
            // Grant ExtraSourceDie modifier to returner
            skills::push_skill_modifier(state, player_idx, skill_id,
                ModifierDuration::Turn, ModifierScope::SelfScope,
                ModifierEffect::RuleOverride { rule: RuleOverride::ExtraSourceDie });

            // Track returning player for end-of-turn crystal grant
            if let Some(ref mut center) = state.source_opening_center {
                center.returning_player_id = Some(state.players[player_idx].id.clone());
                center.used_die_count_at_return = state.players[player_idx].used_die_ids.len() as u32;
            }
        }
        _ => {}
    }

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: Vec::new() })
}


// =============================================================================
// Batch 3 skills — Mana Overload, Source Opening, Master of Chaos
// =============================================================================

/// Initialize Master of Chaos wheel position when the skill is acquired.
pub(super) fn init_master_of_chaos_if_needed(state: &mut GameState, player_idx: usize, skill_id: &SkillId) {
    if skill_id.as_str() == "krang_master_of_chaos" {
        let position = roll_master_of_chaos_initial_position(&mut state.rng);
        state.players[player_idx].master_of_chaos_state = Some(MasterOfChaosState {
            position,
            free_rotate_available: false,
        });
    }
}


pub(super) fn roll_master_of_chaos_initial_position(rng: &mut mk_types::rng::RngState) -> ManaColor {
    const POSITIONS: [ManaColor; 6] = [
        ManaColor::Blue, ManaColor::Green, ManaColor::Black,
        ManaColor::White, ManaColor::Red, ManaColor::Gold,
    ];
    let idx = rng.random_index(POSITIONS.len()).unwrap();
    POSITIONS[idx]
}


const CLOCKWISE: [ManaColor; 6] = [
    ManaColor::Blue, ManaColor::Green, ManaColor::Black,
    ManaColor::White, ManaColor::Red, ManaColor::Gold,
];

pub(super) fn rotate_clockwise(current: ManaColor) -> ManaColor {
    let idx = CLOCKWISE.iter().position(|&c| c == current).unwrap_or(0);
    CLOCKWISE[(idx + 1) % 6]
}


pub(super) fn master_of_chaos_effect(position: ManaColor) -> mk_types::effect::CardEffect {
    use mk_types::effect::CardEffect;
    match position {
        ManaColor::Blue => CardEffect::GainBlock { amount: 3, element: Element::Physical },
        ManaColor::Green => CardEffect::GainMove { amount: 1 },
        ManaColor::Black => CardEffect::GainAttack { amount: 1, combat_type: CombatType::Ranged, element: Element::ColdFire },
        ManaColor::White => CardEffect::GainInfluence { amount: 2 },
        ManaColor::Red => CardEffect::GainAttack { amount: 2, combat_type: CombatType::Melee, element: Element::Physical },
        ManaColor::Gold => CardEffect::Choice {
            options: vec![
                CardEffect::GainBlock { amount: 3, element: Element::Physical },
                CardEffect::GainMove { amount: 1 },
                CardEffect::GainAttack { amount: 1, combat_type: CombatType::Ranged, element: Element::ColdFire },
                CardEffect::GainInfluence { amount: 2 },
                CardEffect::GainAttack { amount: 2, combat_type: CombatType::Melee, element: Element::Physical },
            ],
        },
    }
}


/// Mana Overload: choose non-Gold mana color → gain mana → center.
pub(super) fn apply_mana_overload(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::ChoiceResolution;

    // Build 5 options: GainMana for each non-Gold color
    let options = vec![
        CardEffect::GainMana { color: ManaColor::Red, amount: 1 },
        CardEffect::GainMana { color: ManaColor::Blue, amount: 1 },
        CardEffect::GainMana { color: ManaColor::Green, amount: 1 },
        CardEffect::GainMana { color: ManaColor::White, amount: 1 },
        CardEffect::GainMana { color: ManaColor::Black, amount: 1 },
    ];

    state.players[player_idx].pending.active = Some(ActivePending::Choice(
        mk_types::pending::PendingChoice {
            card_id: None,
            skill_id: Some(skill_id.clone()),
            unit_instance_id: None,
            options,
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::ManaOverloadColorSelect,
        },
    ));

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: Vec::new() })
}


/// Execute Mana Overload color selection.
pub(crate) fn execute_mana_overload_color_select(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
) {
    const COLORS: [ManaColor; 5] = [
        ManaColor::Red, ManaColor::Blue, ManaColor::Green,
        ManaColor::White, ManaColor::Black,
    ];
    let color = COLORS.get(choice_index).copied().unwrap_or(ManaColor::Red);
    let skill_id = SkillId::from("tovak_mana_overload");

    // Set center state
    state.mana_overload_center = Some(ManaOverloadCenter {
        marked_color: color,
        owner_id: state.players[player_idx].id.clone(),
        skill_id: skill_id.clone(),
    });

    place_skill_in_center(state, player_idx, &skill_id);
}


/// Source Opening: choose a die to reroll → center.
pub(super) fn apply_source_opening(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::ChoiceResolution;

    // Find available dice
    let die_ids: Vec<SourceDieId> = state.source.dice.iter()
        .filter(|d| d.taken_by_player_id.is_none() && !d.is_depleted)
        .map(|d| d.id.clone())
        .collect();

    if die_ids.is_empty() {
        // No dice to reroll — skip straight to center placement
        state.source_opening_center = Some(SourceOpeningCenter {
            owner_id: state.players[player_idx].id.clone(),
            skill_id: skill_id.clone(),
            returning_player_id: None,
            used_die_count_at_return: 0,
        });
        place_skill_in_center(state, player_idx, skill_id);
    } else {
        // Build options: one per die + one "skip" (last index)
        let mut options = Vec::new();
        for _ in &die_ids {
            options.push(CardEffect::Noop);
        }
        options.push(CardEffect::Noop); // skip option

        state.players[player_idx].pending.active = Some(ActivePending::Choice(
            mk_types::pending::PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::SourceOpeningDieSelect { die_ids },
            },
        ));
    }

    Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: Vec::new() })
}


/// Execute Source Opening die selection.
pub(crate) fn execute_source_opening_die_select(
    state: &mut GameState,
    player_idx: usize,
    die_ids: &[SourceDieId],
    choice_index: usize,
) {
    let skill_id = SkillId::from("goldyx_source_opening");

    if choice_index < die_ids.len() {
        // Reroll the chosen die
        crate::mana::reroll_die(&mut state.source, &die_ids[choice_index], state.time_of_day, &mut state.rng);
    }
    // else: skip (no reroll)

    // Set center state
    state.source_opening_center = Some(SourceOpeningCenter {
        owner_id: state.players[player_idx].id.clone(),
        skill_id: skill_id.clone(),
        returning_player_id: None,
        used_die_count_at_return: 0,
    });
    place_skill_in_center(state, player_idx, &skill_id);
}


/// Master of Chaos: rotate wheel 1 step, apply effect.
pub(super) fn apply_master_of_chaos(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::ChoiceResolution;

    let current_pos = state.players[player_idx].master_of_chaos_state
        .as_ref()
        .map(|s| s.position)
        .unwrap_or(ManaColor::Blue);

    let new_pos = rotate_clockwise(current_pos);

    state.players[player_idx].master_of_chaos_state = Some(MasterOfChaosState {
        position: new_pos,
        free_rotate_available: false,
    });

    let effect = master_of_chaos_effect(new_pos);

    // Resolve via effect queue
    let mut queue = effect_queue::EffectQueue::new();
    queue.push(effect, None);
    match queue.drain(state, player_idx) {
        effect_queue::DrainResult::Complete => Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: Vec::new() }),
        effect_queue::DrainResult::NeedsChoice { options, continuation, resolution: _ } => {
            // Gold position → choice
            state.players[player_idx].pending.active = Some(ActivePending::Choice(
                mk_types::pending::PendingChoice {
                    card_id: None,
                    skill_id: Some(skill_id.clone()),
                    unit_instance_id: None,
                    options,
                    continuation: continuation.into_iter().map(|q| mk_types::pending::ContinuationEntry {
                        effect: q.effect,
                        source_card_id: q.source_card_id,
                    }).collect(),
                    movement_bonus_applied: false,
                    resolution: ChoiceResolution::MasterOfChaosGoldChoice,
                },
            ));
            Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: Vec::new() })
        }
        effect_queue::DrainResult::PendingSet => Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: Vec::new() }),
    }
}


/// Resolve Source Opening reroll choice at end-of-turn.
pub(crate) fn apply_resolve_source_opening_reroll(
    state: &mut GameState,
    player_idx: usize,
    reroll: bool,
) -> Result<ApplyResult, ApplyError> {
    let pending = state.players[player_idx].pending.active.take();
    let die_id = match pending {
        Some(ActivePending::SourceOpeningReroll { die_id }) => die_id,
        other => {
            state.players[player_idx].pending.active = other;
            return Err(ApplyError::InternalError("No SourceOpeningReroll pending".into()));
        }
    };

    if reroll {
        crate::mana::reroll_die(&mut state.source, &die_id, state.time_of_day, &mut state.rng);
    }

    // Resume end-turn flow
    match crate::end_turn::end_turn(state, player_idx) {
        Ok(_) => Ok(ApplyResult { needs_reenumeration: true, game_ended: false, events: Vec::new() }),
        Err(e) => Err(ApplyError::InternalError(format!("end_turn after source opening reroll: {:?}", e))),
    }
}

