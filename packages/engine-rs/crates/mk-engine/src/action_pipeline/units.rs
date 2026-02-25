//! Unit recruitment, activation, ability resolution, and combat enemy selection.

use metrics::counter;
use mk_data::enemies::get_enemy;
use mk_types::enums::*;
use mk_types::pending::ActivePending;
use mk_types::state::*;

use crate::{combat_resolution, mana};

use super::{ApplyError, ApplyResult};
use super::skills_complex;


// =============================================================================
// Unit recruitment
// =============================================================================

pub(super) fn apply_recruit_unit(
    state: &mut GameState,
    player_idx: usize,
    unit_id: &mk_types::ids::UnitId,
    influence_cost: u32,
) -> Result<ApplyResult, ApplyError> {
    // Apply blanket reputation + shield bonus (once per turn)
    crate::action_pipeline::sites::apply_interaction_bonus_if_needed(state, player_idx);

    let player = &mut state.players[player_idx];

    if player.influence_points < influence_cost {
        return Err(ApplyError::InternalError(
            "RecruitUnit: insufficient influence".into(),
        ));
    }
    player.influence_points -= influence_cost;

    let instance_id =
        mk_types::ids::UnitInstanceId::from(format!("unit_{}", state.next_instance_counter));
    state.next_instance_counter += 1;

    let level = mk_data::units::get_unit(unit_id.as_str())
        .map(|u| u.level)
        .unwrap_or(1);

    let unit = PlayerUnit {
        instance_id,
        unit_id: unit_id.clone(),
        level,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    };

    // Push unit — ArrayVec panics if over capacity, but enumeration
    // already checked command_slots so this should always fit.
    state.players[player_idx].units.push(unit);
    counter!("mk_unit_recruited", "unit" => unit_id.as_str().to_string()).increment(1);

    // Bonds of Loyalty: track the bonds unit if this fills the extra slot
    if state.players[player_idx].bonds_of_loyalty_unit_instance_id.is_none()
        && state.players[player_idx].skills.iter().any(|s| s.as_str() == "norowas_bonds_of_loyalty")
    {
        let normal_slots = mk_data::levels::get_level_stats(
            state.players[player_idx].level,
        ).command_slots as usize;
        if state.players[player_idx].units.len() > normal_slots {
            let inst_id = state.players[player_idx].units.last().unwrap().instance_id.clone();
            state.players[player_idx].bonds_of_loyalty_unit_instance_id = Some(inst_id);
        }
    }

    state.players[player_idx]
        .units_recruited_this_interaction
        .push(unit_id.clone());
    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_RECRUITED_UNIT_THIS_TURN);
    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    mk_data::unit_offers::take_from_unit_offer(&mut state.offers.units, unit_id.as_str());

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn consume_mana_for_unit(
    state: &mut GameState,
    player_idx: usize,
    color: BasicManaColor,
) -> Result<ManaColor, ApplyError> {
    let target_mana = ManaColor::from(color);
    let player = &mut state.players[player_idx];

    // 1. Try matching-color mana token
    if let Some(idx) = player.pure_mana.iter().position(|t| t.color == target_mana) {
        player.pure_mana.remove(idx);
        return Ok(target_mana);
    }

    // 2. Try gold mana token (wild)
    if let Some(idx) = player
        .pure_mana
        .iter()
        .position(|t| t.color == ManaColor::Gold)
    {
        player.pure_mana.remove(idx);
        return Ok(ManaColor::Gold);
    }

    // 3. Try matching-color crystal
    let crystal = match color {
        BasicManaColor::Red => &mut player.crystals.red,
        BasicManaColor::Blue => &mut player.crystals.blue,
        BasicManaColor::Green => &mut player.crystals.green,
        BasicManaColor::White => &mut player.crystals.white,
    };
    if *crystal > 0 {
        *crystal -= 1;
        return Ok(target_mana);
    }

    Err(ApplyError::InternalError(format!(
        "ActivateUnit: cannot afford mana cost {:?}",
        color
    )))
}


pub(super) fn apply_activate_unit(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
    ability_index: usize,
) -> Result<ApplyResult, ApplyError> {
    // Find the unit
    let unit_idx = state.players[player_idx]
        .units
        .iter()
        .position(|u| u.instance_id == *unit_instance_id)
        .ok_or_else(|| {
            ApplyError::InternalError(format!(
                "ActivateUnit: unit '{}' not found",
                unit_instance_id.as_str()
            ))
        })?;

    let unit_id = state.players[player_idx].units[unit_idx].unit_id.clone();
    let unit_def = mk_data::units::get_unit(unit_id.as_str()).ok_or_else(|| {
        ApplyError::InternalError(format!("ActivateUnit: unknown unit def '{}'", unit_id.as_str()))
    })?;

    if ability_index >= unit_def.abilities.len() {
        return Err(ApplyError::InternalError(format!(
            "ActivateUnit: ability_index {} out of range (unit '{}' has {} abilities)",
            ability_index,
            unit_id.as_str(),
            unit_def.abilities.len()
        )));
    }

    let slot = &unit_def.abilities[ability_index];

    // Consume mana if needed
    if let Some(color) = slot.mana_cost {
        let consumed_color = consume_mana_for_unit(state, player_idx, color)?;
        // Mana Enhancement trigger on mana-powered unit activation
        crate::card_play::check_mana_enhancement_trigger(state, player_idx, consumed_color);
    }

    // Compute UnitCombatBonus and UnitBlockBonus from active modifiers
    use mk_types::modifier::{ModifierEffect, ModifierScope};
    let player_id = &state.players[player_idx].id;
    let (unit_attack_bonus, unit_block_bonus): (i32, i32) = state
        .active_modifiers
        .iter()
        .filter(|m| {
            m.created_by_player_id == *player_id
                && matches!(m.scope, ModifierScope::AllUnits)
        })
        .fold((0i32, 0i32), |(atk, blk), m| {
            if let ModifierEffect::UnitCombatBonus {
                attack_bonus,
                block_bonus,
            } = &m.effect
            {
                (atk + *attack_bonus, blk + *block_bonus)
            } else {
                (atk, blk)
            }
        });

    let extra_block_bonus: i32 = state
        .active_modifiers
        .iter()
        .filter(|m| {
            m.created_by_player_id == *player_id
                && matches!(m.scope, ModifierScope::AllUnits)
        })
        .filter_map(|m| {
            if let ModifierEffect::UnitBlockBonus { amount } = &m.effect {
                Some(*amount)
            } else {
                None
            }
        })
        .sum();

    // Apply the ability effect
    use mk_data::units::UnitAbility;
    match slot.ability {
        UnitAbility::Attack { value, element } => {
            let boosted = (value as i32 + unit_attack_bonus).max(0) as u32;
            let acc = &mut state.players[player_idx].combat_accumulator.attack;
            acc.normal += boosted;
            add_to_elemental(&mut acc.normal_elements, element, boosted);
        }
        UnitAbility::Block { value, element } => {
            let boosted = (value as i32 + unit_block_bonus + extra_block_bonus).max(0) as u32;
            let acc = &mut state.players[player_idx].combat_accumulator;
            acc.block += boosted;
            add_to_elemental(&mut acc.block_elements, element, boosted);
        }
        UnitAbility::RangedAttack { value, element } => {
            let boosted = (value as i32 + unit_attack_bonus).max(0) as u32;
            let acc = &mut state.players[player_idx].combat_accumulator.attack;
            acc.ranged += boosted;
            add_to_elemental(&mut acc.ranged_elements, element, boosted);
        }
        UnitAbility::SiegeAttack { value, element } => {
            let boosted = (value as i32 + unit_attack_bonus).max(0) as u32;
            let acc = &mut state.players[player_idx].combat_accumulator.attack;
            acc.siege += boosted;
            add_to_elemental(&mut acc.siege_elements, element, boosted);
        }
        UnitAbility::Move { value } => {
            state.players[player_idx].move_points += value;
        }
        UnitAbility::Influence { value } => {
            state.players[player_idx].influence_points += value;
        }
        UnitAbility::Heal { value } => {
            let player = &mut state.players[player_idx];
            let wound_count = player
                .hand
                .iter()
                .filter(|c| c.as_str() == "wound")
                .count() as u32;
            let to_heal = value.min(wound_count);
            let mut healed = 0u32;
            player.hand.retain(|c| {
                if healed < to_heal && c.as_str() == "wound" {
                    healed += 1;
                    false
                } else {
                    true
                }
            });
            player.healing_points += value.saturating_sub(to_heal);
            player.wounds_healed_from_hand_this_turn += healed;
        }
        UnitAbility::GainMana { color } => {
            state.players[player_idx].pure_mana.push(ManaToken {
                color: ManaColor::from(color),
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            });
        }
        UnitAbility::GainCrystal { color } => {
            mana::gain_crystal(&mut state.players[player_idx], color);
        }
        UnitAbility::GainManaAndCrystal { color } => {
            state.players[player_idx].pure_mana.push(ManaToken {
                color: ManaColor::from(color),
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            });
            mana::gain_crystal(&mut state.players[player_idx], color);
        }
        UnitAbility::AttackWithRepCost { value, element, rep_change } => {
            let boosted = (value as i32 + unit_attack_bonus).max(0) as u32;
            let acc = &mut state.players[player_idx].combat_accumulator.attack;
            acc.normal += boosted;
            add_to_elemental(&mut acc.normal_elements, element, boosted);
            let new_rep = (state.players[player_idx].reputation as i16 + rep_change as i16)
                .clamp(-7, 7) as i8;
            state.players[player_idx].reputation = new_rep;
        }
        UnitAbility::InfluenceWithRepCost { value, rep_change } => {
            state.players[player_idx].influence_points += value;
            let new_rep = (state.players[player_idx].reputation as i16 + rep_change as i16)
                .clamp(-7, 7) as i8;
            state.players[player_idx].reputation = new_rep;
        }
        UnitAbility::MoveOrInfluence { value } => {
            use mk_types::pending::{ActivePending, UnitAbilityChoiceOption};
            // Mark unit spent first, then create pending choice
            state.players[player_idx].units[unit_idx].state = UnitState::Spent;
            state.players[player_idx].pending.active =
                Some(ActivePending::UnitAbilityChoice {
                    unit_instance_id: unit_instance_id.clone(),
                    options: vec![
                        UnitAbilityChoiceOption::GainMove { value },
                        UnitAbilityChoiceOption::GainInfluence { value },
                    ],
                    wound_self: false,
                });
            // Return early — unit already marked spent
            return Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: Vec::new(),
            });
        }
        UnitAbility::AttackOrBlockWoundSelf { value, element } => {
            use mk_types::pending::{ActivePending, UnitAbilityChoiceOption};
            // Mark unit spent first, then create pending choice
            state.players[player_idx].units[unit_idx].state = UnitState::Spent;
            state.players[player_idx].pending.active =
                Some(ActivePending::UnitAbilityChoice {
                    unit_instance_id: unit_instance_id.clone(),
                    options: vec![
                        UnitAbilityChoiceOption::GainAttack { value, element },
                        UnitAbilityChoiceOption::GainBlock { value, element },
                    ],
                    wound_self: true,
                });
            // Return early — unit already marked spent
            return Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: Vec::new(),
            });
        }
        UnitAbility::ReadyUnit { max_level } => {
            // Find spent units at or below max_level
            let eligible: Vec<usize> = state.players[player_idx]
                .units
                .iter()
                .enumerate()
                .filter(|(_, u)| u.state == UnitState::Spent && u.level <= max_level)
                .map(|(i, _)| i)
                .collect();

            match eligible.len() {
                0 => {
                    // No eligible units — should not reach here due to enumeration guard
                }
                1 => {
                    // Auto-ready the single eligible unit
                    let target_idx = eligible[0];
                    state.players[player_idx].units[target_idx].state = UnitState::Ready;
                }
                _ => {
                    use mk_types::pending::ActivePending;
                    use mk_types::effect::CardEffect;
                    use mk_types::pending::{ChoiceResolution, PendingChoice};
                    // Multiple eligible — present choice via existing ReadyUnitTarget mechanism
                    let options: Vec<CardEffect> =
                        eligible.iter().map(|_| CardEffect::Noop).collect();
                    state.players[player_idx].pending.active =
                        Some(ActivePending::Choice(PendingChoice {
                            card_id: None,
                            skill_id: None,
                            unit_instance_id: Some(unit_instance_id.clone()),
                            options,
                            continuation: vec![],
                            movement_bonus_applied: false,
                            resolution: ChoiceResolution::ReadyUnitTarget {
                                eligible_unit_indices: eligible,
                            },
                        }));
                }
            }
        }
        UnitAbility::SelectCombatEnemy(template) => {
            return apply_select_combat_enemy_activation(
                state, player_idx, unit_idx, unit_instance_id, template,
            );
        }
        UnitAbility::CoordinatedFire { ranged_value, element, unit_attack_bonus } => {
            // Add ranged attack to accumulator
            let acc = &mut state.players[player_idx].combat_accumulator.attack;
            acc.ranged += ranged_value;
            add_to_elemental(&mut acc.ranged_elements, element, ranged_value);

            // Add UnitAttackBonus modifier
            use mk_types::modifier::{
                ActiveModifier, ModifierDuration, ModifierEffect, ModifierScope, ModifierSource,
            };
            use mk_types::ids::ModifierId;
            let player_id = state.players[player_idx].id.clone();
            let modifier_count = state.active_modifiers.len();
            let modifier_id = format!(
                "mod_{}_r{}_t{}",
                modifier_count, state.round, state.current_player_index
            );
            state.active_modifiers.push(ActiveModifier {
                id: ModifierId::from(modifier_id.as_str()),
                source: ModifierSource::Unit {
                    unit_index: unit_idx as u32,
                    player_id: player_id.clone(),
                },
                duration: ModifierDuration::Combat,
                scope: ModifierScope::AllUnits,
                effect: ModifierEffect::UnitAttackBonus {
                    amount: unit_attack_bonus,
                },
                created_at_round: state.round,
                created_by_player_id: player_id,
            });
        }
        UnitAbility::GrantAllResistances => {
            use mk_types::modifier::{
                ActiveModifier, ModifierDuration, ModifierEffect, ModifierScope, ModifierSource,
            };
            use mk_types::ids::ModifierId;
            let player_id = state.players[player_idx].id.clone();
            let modifier_count = state.active_modifiers.len();
            let modifier_id = format!(
                "mod_{}_r{}_t{}",
                modifier_count, state.round, state.current_player_index
            );
            state.active_modifiers.push(ActiveModifier {
                id: ModifierId::from(modifier_id.as_str()),
                source: ModifierSource::Unit {
                    unit_index: unit_idx as u32,
                    player_id: player_id.clone(),
                },
                duration: ModifierDuration::Turn,
                scope: ModifierScope::AllUnits,
                effect: ModifierEffect::GrantResistances {
                    resistances: vec![
                        ResistanceElement::Physical,
                        ResistanceElement::Fire,
                        ResistanceElement::Ice,
                    ],
                },
                created_at_round: state.round,
                created_by_player_id: player_id,
            });
        }
        UnitAbility::MoveWithTerrainReduction { move_value, terrain_reductions } => {
            state.players[player_idx].move_points += move_value;
            // Push terrain cost reduction modifiers
            use mk_types::modifier::{
                ActiveModifier, ModifierDuration, ModifierEffect, ModifierScope, ModifierSource,
                TerrainOrAll,
            };
            use mk_types::ids::ModifierId;
            let player_id = state.players[player_idx].id.clone();
            for &(terrain, amount, minimum) in terrain_reductions {
                let modifier_count = state.active_modifiers.len();
                let modifier_id = format!(
                    "mod_{}_r{}_t{}",
                    modifier_count, state.round, state.current_player_index
                );
                state.active_modifiers.push(ActiveModifier {
                    id: ModifierId::from(modifier_id.as_str()),
                    source: ModifierSource::Unit {
                        unit_index: unit_idx as u32,
                        player_id: player_id.clone(),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(terrain),
                        amount,
                        minimum,
                        replace_cost: None,
                    },
                    created_at_round: state.round,
                    created_by_player_id: player_id.clone(),
                });
            }
        }
        UnitAbility::Other { .. } => {
            return Err(ApplyError::InternalError(
                "ActivateUnit: Other abilities not executable".into(),
            ));
        }
    }

    // Mark unit spent
    state.players[player_idx].units[unit_idx].state = UnitState::Spent;

    // Dueling: mark unit involvement if a combat ability was used
    if state.combat.is_some() {
        skills_complex::mark_dueling_unit_involvement(state, player_idx);
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Resolve a UnitAbilityChoice pending (MoveOrInfluence, AttackOrBlockWoundSelf).
pub(super) fn apply_resolve_unit_ability_choice(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
) -> Result<ApplyResult, ApplyError> {
    // Extract the pending
    let pending = state.players[player_idx]
        .pending
        .active
        .take()
        .ok_or_else(|| ApplyError::InternalError("No active pending".into()))?;

    if let ActivePending::UnitAbilityChoice {
        unit_instance_id,
        options,
        wound_self,
    } = pending
    {
        if choice_index >= options.len() {
            return Err(ApplyError::InternalError(format!(
                "UnitAbilityChoice: invalid choice_index {} (options len {})",
                choice_index,
                options.len()
            )));
        }

        let chosen = options[choice_index];

        // Apply the chosen option
        use mk_types::pending::UnitAbilityChoiceOption;
        match chosen {
            UnitAbilityChoiceOption::GainMove { value } => {
                state.players[player_idx].move_points += value;
            }
            UnitAbilityChoiceOption::GainInfluence { value } => {
                state.players[player_idx].influence_points += value;
            }
            UnitAbilityChoiceOption::GainAttack { value, element } => {
                let acc = &mut state.players[player_idx].combat_accumulator.attack;
                acc.normal += value;
                add_to_elemental(&mut acc.normal_elements, element, value);
            }
            UnitAbilityChoiceOption::GainBlock { value, element } => {
                let acc = &mut state.players[player_idx].combat_accumulator;
                acc.block += value;
                add_to_elemental(&mut acc.block_elements, element, value);
            }
        }

        // Wound the unit if needed (AttackOrBlockWoundSelf)
        if wound_self {
            if let Some(unit) = state.players[player_idx]
                .units
                .iter_mut()
                .find(|u| u.instance_id == unit_instance_id)
            {
                unit.wounded = true;
            }
        }

        Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: Vec::new(),
        })
    } else {
        // Put back what we took and error
        state.players[player_idx].pending.active = Some(pending);
        Err(ApplyError::InternalError(
            "Expected UnitAbilityChoice pending".into(),
        ))
    }
}


// =============================================================================
// SelectCombatEnemy activation + resolution
// =============================================================================

/// Activate a SelectCombatEnemy ability: filter eligible enemies, auto-resolve or create pending.
pub(super) fn apply_select_combat_enemy_activation(
    state: &mut GameState,
    player_idx: usize,
    unit_idx: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
    template: mk_types::pending::SelectEnemyTemplate,
) -> Result<ApplyResult, ApplyError> {
    // Mark unit spent first
    state.players[player_idx].units[unit_idx].state = UnitState::Spent;

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("SelectCombatEnemy: no combat".into()))?;

    // Filter eligible enemies
    let mut eligible_ids: Vec<String> = Vec::new();
    for enemy in &combat.enemies {
        if enemy.is_defeated || enemy.is_summoner_hidden {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        // Apply template filters
        if template.exclude_fortified
            && combat_resolution::is_effectively_fortified(
                def,
                enemy.instance_id.as_str(),
                combat.is_at_fortified_site,
                &state.active_modifiers,
            )
        {
            continue;
        }

        if template.exclude_arcane_immune
            && combat_resolution::has_ability(def, EnemyAbilityType::ArcaneImmunity)
        {
            continue;
        }

        if template.exclude_summoners
            && (combat_resolution::has_ability(def, EnemyAbilityType::Summon)
                || combat_resolution::has_ability(def, EnemyAbilityType::SummonGreen))
        {
            continue;
        }

        if let Some(resist) = template.exclude_resistance {
            if def.resistances.contains(&resist) {
                continue;
            }
        }

        eligible_ids.push(enemy.instance_id.as_str().to_string());
    }

    match eligible_ids.len() {
        0 => {
            // No eligible enemies — ability fizzles (unit still spent)
        }
        1 => {
            // Auto-resolve with the single eligible enemy
            let uid_opt = Some(unit_instance_id.clone());
            apply_select_enemy_effects(state, player_idx, &uid_opt, &eligible_ids[0], &template)?;
        }
        _ => {
            // Multiple eligible — create pending
            state.players[player_idx].pending.active =
                Some(ActivePending::SelectCombatEnemy {
                    unit_instance_id: Some(unit_instance_id.clone()),
                    eligible_enemy_ids: eligible_ids,
                    template,
                    continuation: Vec::new(),
                });
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Resolve a SelectCombatEnemy pending choice.
pub(super) fn apply_resolve_select_enemy(
    state: &mut GameState,
    player_idx: usize,
    choice_index: usize,
) -> Result<ApplyResult, ApplyError> {
    let pending = state.players[player_idx]
        .pending
        .active
        .take()
        .ok_or_else(|| ApplyError::InternalError("No active pending".into()))?;

    if let ActivePending::SelectCombatEnemy {
        unit_instance_id,
        eligible_enemy_ids,
        template,
        continuation,
    } = pending
    {
        if choice_index >= eligible_enemy_ids.len() {
            return Err(ApplyError::InternalError(format!(
                "SelectCombatEnemy: invalid choice_index {} (eligible len {})",
                choice_index,
                eligible_enemy_ids.len()
            )));
        }

        let enemy_id = &eligible_enemy_ids[choice_index];
        apply_select_enemy_effects(state, player_idx, &unit_instance_id, enemy_id, &template)?;

        // Replay any continuation effects from the effect queue
        if !continuation.is_empty() {
            use crate::effect_queue::{EffectQueue, QueuedEffect, DrainResult};
            use mk_types::pending::{ContinuationEntry, PendingChoice};

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

            match queue.drain(state, player_idx) {
                DrainResult::Complete => {}
                DrainResult::NeedsChoice {
                    options,
                    continuation: cont,
                    resolution,
                } => {
                    state.players[player_idx].pending.active =
                        Some(ActivePending::Choice(PendingChoice {
                            card_id: None,
                            skill_id: None,
                            unit_instance_id: None,
                            options,
                            continuation: cont
                                .into_iter()
                                .map(|q| ContinuationEntry {
                                    effect: q.effect,
                                    source_card_id: q.source_card_id,
                                })
                                .collect(),
                            movement_bonus_applied: false,
                            resolution,
                        }));
                }
                DrainResult::PendingSet => {}
            }
        }

        Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: Vec::new(),
        })
    } else {
        state.players[player_idx].pending.active = Some(pending);
        Err(ApplyError::InternalError(
            "Expected SelectCombatEnemy pending".into(),
        ))
    }
}


/// Public wrapper for apply_select_enemy_effects (used by effect_queue).
pub fn apply_select_enemy_effects_pub(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &Option<mk_types::ids::UnitInstanceId>,
    enemy_instance_id: &str,
    template: &mk_types::pending::SelectEnemyTemplate,
) -> Result<(), ApplyError> {
    apply_select_enemy_effects(state, player_idx, unit_instance_id, enemy_instance_id, template)
}


/// Apply the template effects to a chosen enemy.
pub(super) fn apply_select_enemy_effects(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &Option<mk_types::ids::UnitInstanceId>,
    enemy_instance_id: &str,
    template: &mk_types::pending::SelectEnemyTemplate,
) -> Result<(), ApplyError> {
    use mk_types::modifier::{
        ActiveModifier, ModifierDuration, ModifierEffect, ModifierScope, ModifierSource,
        EnemyStat as ModEnemyStat,
    };
    use mk_types::ids::ModifierId;

    let player_id = state.players[player_idx].id.clone();

    // Determine source: unit or card
    let source = if let Some(uid) = unit_instance_id {
        let unit_idx = state.players[player_idx]
            .units
            .iter()
            .position(|u| u.instance_id == *uid)
            .unwrap_or(0) as u32;
        ModifierSource::Unit {
            unit_index: unit_idx,
            player_id: player_id.clone(),
        }
    } else {
        ModifierSource::Card {
            card_id: mk_types::ids::CardId::from("select_combat_enemy"),
            player_id: player_id.clone(),
        }
    };

    // Check if target has ArcaneImmunity
    let has_ai = {
        let combat = state.combat.as_ref().ok_or_else(|| {
            ApplyError::InternalError("SelectCombatEnemy: no combat".into())
        })?;
        combat
            .enemies
            .iter()
            .find(|e| e.instance_id.as_str() == enemy_instance_id)
            .and_then(|e| get_enemy(e.enemy_id.as_str()))
            .is_some_and(|def| {
                combat_resolution::has_ability(def, EnemyAbilityType::ArcaneImmunity)
            })
    };

    // Check if target is fortified (for fortified_armor_change)
    let is_fortified = {
        let combat = state.combat.as_ref().unwrap();
        combat
            .enemies
            .iter()
            .find(|e| e.instance_id.as_str() == enemy_instance_id)
            .and_then(|e| get_enemy(e.enemy_id.as_str()))
            .is_some_and(|def| {
                combat_resolution::is_effectively_fortified(
                    def,
                    enemy_instance_id,
                    combat.is_at_fortified_site,
                    &state.active_modifiers,
                )
            })
    };

    let mut push_modifier = |effect: ModifierEffect| {
        let modifier_count = state.active_modifiers.len();
        let modifier_id = format!(
            "mod_{}_r{}_t{}",
            modifier_count, state.round, state.current_player_index
        );
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from(modifier_id.as_str()),
            source: source.clone(),
            duration: ModifierDuration::Combat,
            scope: ModifierScope::OneEnemy {
                enemy_id: enemy_instance_id.to_string(),
            },
            effect,
            created_at_round: state.round,
            created_by_player_id: player_id.clone(),
        });
    };

    // skip_attack — blocked by ArcaneImmunity
    if template.skip_attack && !has_ai {
        push_modifier(ModifierEffect::EnemySkipAttack);
    }

    // armor_change — blocked by ArcaneImmunity
    let effective_armor_change = if template.armor_per_resistance {
        // resistance_break: multiply armor_change by number of resistances
        let num_resistances = {
            let combat = state.combat.as_ref().unwrap();
            combat
                .enemies
                .iter()
                .find(|e| e.instance_id.as_str() == enemy_instance_id)
                .and_then(|e| get_enemy(e.enemy_id.as_str()))
                .map_or(0, |def| def.resistances.len() as i32)
        };
        template.armor_change * num_resistances
    } else {
        template.armor_change
    };
    if effective_armor_change != 0 && !has_ai {
        // Use fortified_armor_change when enemy is fortified and template specifies it
        let effective_amount = if is_fortified {
            template.fortified_armor_change.unwrap_or(effective_armor_change)
        } else {
            effective_armor_change
        };
        push_modifier(ModifierEffect::EnemyStat {
            stat: ModEnemyStat::Armor,
            amount: effective_amount,
            minimum: template.armor_minimum,
            attack_index: None,
            per_resistance: template.armor_per_resistance,
            fortified_amount: template.fortified_armor_change,
            exclude_resistance: None,
        });
    }

    // attack_change — NOT blocked by ArcaneImmunity (FAQ S1)
    if template.attack_change != 0 {
        push_modifier(ModifierEffect::EnemyStat {
            stat: ModEnemyStat::Attack,
            amount: template.attack_change,
            minimum: template.attack_minimum,
            attack_index: None,
            per_resistance: false,
            fortified_amount: None,
            exclude_resistance: None,
        });
    }

    // nullify_fortified — blocked by ArcaneImmunity
    if template.nullify_fortified && !has_ai {
        push_modifier(ModifierEffect::AbilityNullifier {
            ability: Some(EnemyAbilityType::Fortified),
            ignore_arcane_immunity: false,
        });
    }

    // remove_resistances — blocked by ArcaneImmunity
    if template.remove_resistances && !has_ai {
        push_modifier(ModifierEffect::RemoveResistances);
    }

    // defeat_if_blocked — blocked by ArcaneImmunity
    if template.defeat_if_blocked && !has_ai {
        push_modifier(ModifierEffect::DefeatIfBlocked);
    }

    // damage_redirect — NOT blocked by ArcaneImmunity (defensive effect)
    if template.damage_redirect_from_unit {
        if let Some(uid) = unit_instance_id {
            let combat = state.combat.as_mut().ok_or_else(|| {
                ApplyError::InternalError("SelectCombatEnemy: no combat for redirect".into())
            })?;
            combat.damage_redirects.insert(
                enemy_instance_id.to_string(),
                uid.as_str().to_string(),
            );
        }
    }

    // bundled_ranged_attack — NOT blocked by ArcaneImmunity (always resolves)
    if template.bundled_ranged_attack > 0 {
        let acc = &mut state.players[player_idx].combat_accumulator.attack;
        acc.ranged += template.bundled_ranged_attack;
        acc.ranged_elements.physical += template.bundled_ranged_attack;
    }

    // remove_fire_resistance — blocked by ArcaneImmunity
    if template.remove_fire_resistance && !has_ai {
        push_modifier(ModifierEffect::RemoveFireResistance);
    }

    // defeat — NOT blocked by ArcaneImmunity (physical destruction)
    if template.defeat {
        // Mark enemy as defeated and grant fame
        let (fame_gain, rep_bonus) = {
            let combat = state.combat.as_ref().unwrap();
            if let Some(enemy) = combat.enemies.iter().find(|e| e.instance_id.as_str() == enemy_instance_id) {
                let is_summoned = enemy.summoned_by_instance_id.is_some();
                if !is_summoned {
                    if let Some(def) = get_enemy(enemy.enemy_id.as_str()) {
                        (def.fame, def.reputation_bonus.map(|b| b as i8).unwrap_or(0))
                    } else {
                        (0, 0)
                    }
                } else {
                    (0, 0)
                }
            } else {
                (0, 0)
            }
        };

        if let Some(combat) = state.combat.as_mut() {
            if let Some(enemy) = combat.enemies.iter_mut().find(|e| e.instance_id.as_str() == enemy_instance_id) {
                enemy.is_defeated = true;
            }
        }

        state.players[player_idx].fame += fame_gain;
        if rep_bonus != 0 {
            state.players[player_idx].reputation = (state.players[player_idx].reputation + rep_bonus)
                .clamp(-7, 7);
        }
    }

    // nullify_all_attack_abilities — bypasses ArcaneImmunity (ignore_arcane_immunity: true)
    if template.nullify_all_attack_abilities {
        use mk_types::enums::EnemyAbilityType as EAT;
        for ability in &[
            EAT::Swift, EAT::Brutal, EAT::Poison, EAT::Paralyze,
            EAT::Vampiric, EAT::Assassination, EAT::Cumbersome,
        ] {
            push_modifier(ModifierEffect::AbilityNullifier {
                ability: Some(*ability),
                ignore_arcane_immunity: true,
            });
        }
    }

    Ok(())
}


/// Helper to add elemental damage values.
pub(super) fn add_to_elemental(ev: &mut ElementalValues, element: Element, amount: u32) {
    match element {
        Element::Physical => ev.physical += amount,
        Element::Fire => ev.fire += amount,
        Element::Ice => ev.ice += amount,
        Element::ColdFire => ev.cold_fire += amount,
    }
}

