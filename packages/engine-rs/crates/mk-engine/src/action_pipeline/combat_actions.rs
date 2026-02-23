//! Combat handlers: block, attack, damage assignment, burning shield, auto-damage.

use mk_data::enemies::{attack_count, get_enemy};
use mk_data::enemy_piles::{draw_enemy_token, enemy_id_from_token};
use mk_types::enums::*;
use mk_types::ids::{CardId, CombatInstanceId, EnemyId, PlayerId};
use mk_types::state::*;

use crate::combat_resolution;

use super::{ApplyError, ApplyResult};
use super::combat_end;
use super::sites;
use super::skills_complex;


// Rest functions delegated to turn_flow module

pub(super) fn apply_declare_block(
    state: &mut GameState,
    player_idx: usize,
    enemy_instance_id: &CombatInstanceId,
    attack_index: usize,
) -> Result<ApplyResult, ApplyError> {
    let combat = state
        .combat
        .as_mut()
        .ok_or_else(|| ApplyError::InternalError("DeclareBlock with no combat".into()))?;

    // Find the enemy
    let enemy = combat
        .enemies
        .iter_mut()
        .find(|e| e.instance_id == *enemy_instance_id)
        .ok_or_else(|| ApplyError::InternalError("DeclareBlock: enemy not found".into()))?;

    let def = get_enemy(enemy.enemy_id.as_str())
        .ok_or_else(|| ApplyError::InternalError("DeclareBlock: unknown enemy".into()))?;

    let player = &state.players[player_idx];
    let block_result = combat_resolution::resolve_block(
        &player.combat_accumulator.block_elements,
        def,
        attack_index,
    );

    if block_result.success {
        // Mark attack as blocked
        if attack_index < enemy.attacks_blocked.len() {
            enemy.attacks_blocked[attack_index] = true;
        }

        // Check if all attacks are now blocked
        let num_attacks = attack_count(def);
        let all_blocked = (0..num_attacks).all(|i| {
            enemy.attacks_blocked.get(i).copied().unwrap_or(false)
                || enemy.attacks_cancelled.get(i).copied().unwrap_or(false)
                || {
                    // Zero-damage attacks don't need blocking
                    let (dmg, _, _) = combat_resolution::get_enemy_attack_info(def, i);
                    dmg == 0
                }
        });
        if all_blocked {
            enemy.is_blocked = true;
        }

        // Burning Shield / Exploding Shield: consume modifier on successful block
        apply_burning_shield_on_block(state, player_idx, enemy_instance_id);
    }

    // Block is consumed (all accumulated block used for this declaration)
    let player = &mut state.players[player_idx];
    player.combat_accumulator.block = 0;
    player.combat_accumulator.block_elements = ElementalValues::default();
    player.combat_accumulator.assigned_block = 0;
    player.combat_accumulator.assigned_block_elements = ElementalValues::default();

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Apply Burning Shield / Exploding Shield effects after a successful block.
///
/// - Attack mode: adds fire attack to the player's combat accumulator
/// - Destroy mode: attempts to defeat the blocked enemy (blocked by fire resistance
///   or arcane immunity)
///
/// The modifier is consumed (removed) on any successful block, regardless of mode outcome.
pub(super) fn apply_burning_shield_on_block(
    state: &mut GameState,
    player_idx: usize,
    blocked_enemy_id: &CombatInstanceId,
) {
    use mk_types::modifier::{BurningShieldMode, ModifierEffect, ModifierSource};

    let pid = state.players[player_idx].id.clone();
    let shield_idx = state.active_modifiers.iter().position(|m| {
        matches!(&m.effect, ModifierEffect::BurningShieldActive { .. })
            && matches!(
                &m.source,
                ModifierSource::Card { player_id, .. } if *player_id == pid
            )
    });
    let Some(idx) = shield_idx else { return };

    let (mode, attack_value) = match &state.active_modifiers[idx].effect {
        ModifierEffect::BurningShieldActive {
            mode, attack_value, ..
        } => (*mode, *attack_value),
        _ => return,
    };
    // Consumed on ANY successful block, regardless of outcome
    state.active_modifiers.remove(idx);

    match mode {
        BurningShieldMode::Attack => {
            // Fire attack added to accumulator for Attack phase
            let acc = &mut state.players[player_idx].combat_accumulator;
            acc.attack.normal += attack_value;
            acc.attack.normal_elements.fire += attack_value;
        }
        BurningShieldMode::Destroy => {
            // Attempt to destroy the blocked enemy
            let combat = state.combat.as_mut().unwrap();
            let enemy = combat
                .enemies
                .iter_mut()
                .find(|e| e.instance_id == *blocked_enemy_id)
                .unwrap();
            let enemy_id_str = enemy.enemy_id.as_str().to_string();
            let is_summoned = enemy.summoned_by_instance_id.is_some();
            let def = get_enemy(&enemy_id_str).unwrap();

            // Destroy fails if fire-resistant or arcane immune
            let has_fire_resist = def.resistances.contains(&ResistanceElement::Fire);
            let has_arcane_immune = def
                .abilities
                .contains(&EnemyAbilityType::ArcaneImmunity);

            if !has_fire_resist && !has_arcane_immune {
                enemy.is_defeated = true;
                if !is_summoned {
                    state.players[player_idx].fame += def.fame;
                    state.combat.as_mut().unwrap().fame_gained += def.fame;
                }
            }
        }
    }
}


pub(super) fn apply_declare_attack_inner(
    state: &mut GameState,
    player_idx: usize,
    target_instance_ids: &[CombatInstanceId],
    attack_type: CombatType,
) -> Result<ApplyResult, ApplyError> {
    // Phase 1: Collect indices and compute resolution without holding borrows across mutation.
    let (target_indices, result, available, target_count, defend_assignments) = {
        let combat = state
            .combat
            .as_ref()
            .ok_or_else(|| ApplyError::InternalError("DeclareAttack with no combat".into()))?;

        // Find target indices and definitions
        let mut target_indices: Vec<usize> = Vec::new();
        let mut target_pairs: Vec<(CombatEnemy, &mk_data::enemies::EnemyDefinition)> = Vec::new();

        for target_id in target_instance_ids {
            let (idx, enemy) = combat
                .enemies
                .iter()
                .enumerate()
                .find(|(_, e)| e.instance_id == *target_id)
                .ok_or_else(|| {
                    ApplyError::InternalError(format!(
                        "DeclareAttack: enemy {} not found",
                        target_id.as_str()
                    ))
                })?;

            let def = get_enemy(enemy.enemy_id.as_str()).ok_or_else(|| {
                ApplyError::InternalError("DeclareAttack: unknown enemy".into())
            })?;

            target_indices.push(idx);
            target_pairs.push((enemy.clone(), def));
        }

        // Get available attack for this type
        let accumulator = &state.players[player_idx].combat_accumulator;
        let (total_elements, assigned_elements) = match attack_type {
            CombatType::Melee => (
                &accumulator.attack.normal_elements,
                &accumulator.assigned_attack.normal_elements,
            ),
            CombatType::Ranged => (
                &accumulator.attack.ranged_elements,
                &accumulator.assigned_attack.ranged_elements,
            ),
            CombatType::Siege => (
                &accumulator.attack.siege_elements,
                &accumulator.assigned_attack.siege_elements,
            ),
        };

        let mut available = combat_resolution::subtract_elements(total_elements, assigned_elements);

        // Hook: DoublePhysicalAttacks (Sword of Justice powered)
        let player_id = &state.players[player_idx].id;
        if state.active_modifiers.iter().any(|m| {
            matches!(&m.effect, mk_types::modifier::ModifierEffect::DoublePhysicalAttacks)
                && matches!(&m.source, mk_types::modifier::ModifierSource::Card { player_id: pid, .. }
                    | mk_types::modifier::ModifierSource::Skill { player_id: pid, .. }
                    if pid == player_id)
        }) {
            available.physical *= 2;
        }

        // Hook: Build removed resistances from modifiers
        let removed_resistances = build_removed_resistances(
            &state.active_modifiers, &target_pairs, player_idx, &state.players[player_idx].id,
        );

        // Build ref pairs for resolution
        let ref_pairs: Vec<(&CombatEnemy, &mk_data::enemies::EnemyDefinition)> =
            target_pairs.iter().map(|(e, d)| (e, *d)).collect();

        // Compute bonus armor (vampiric + defend)
        let defend_assignments = combat_resolution::auto_assign_defend(
            &combat.enemies,
            target_instance_ids,
            &combat.used_defend,
        );

        let mut bonus_armor = std::collections::BTreeMap::new();
        for (enemy, def) in &target_pairs {
            let vampiric = combat
                .vampiric_armor_bonus
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);
            let defend = defend_assignments
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);
            let _ = def; // def already used by resolve_attack via ref_pairs
            bonus_armor.insert(enemy.instance_id.as_str().to_string(), vampiric + defend);
        }

        let result = combat_resolution::resolve_attack_with_removed_resistances(
            &available, &ref_pairs, combat.phase, &bonus_armor, &removed_resistances,
        );
        let target_count = target_indices.len();

        (target_indices, result, available, target_count, defend_assignments)
    };

    // Phase 2: Apply mutations
    if result.success {
        let combat = state.combat.as_mut().unwrap();
        for &idx in &target_indices {
            combat.enemies[idx].is_defeated = true;
        }
        combat.fame_gained += result.fame_gained;

        // Record defend usage (defender instance_id → protected target instance_id)
        // We need to find which defenders were assigned by matching the auto_assign_defend logic
        // The defend_assignments map tells us target_id → bonus, but we need defender→target
        // Re-derive from the same logic: iterate defenders in order, assign to targets in order
        {
            let mut newly_used: Vec<String> = Vec::new();
            let defenders: Vec<(String, u32)> = combat
                .enemies
                .iter()
                .filter_map(|e| {
                    if e.is_defeated {
                        return None;
                    }
                    let def = get_enemy(e.enemy_id.as_str())?;
                    if !combat_resolution::has_ability(def, EnemyAbilityType::Defend) {
                        return None;
                    }
                    let defend_value = def.defend?;
                    if combat.used_defend.contains_key(e.instance_id.as_str()) {
                        return None;
                    }
                    Some((e.instance_id.as_str().to_string(), defend_value))
                })
                .collect();

            for target_id in target_instance_ids {
                if !defend_assignments.contains_key(target_id.as_str()) {
                    continue;
                }
                // Find first available defender
                if let Some(defender_id) =
                    defenders.iter().find_map(|(did, _)| {
                        if !newly_used.contains(did)
                            && !combat.used_defend.contains_key(did.as_str())
                        {
                            Some(did.clone())
                        } else {
                            None
                        }
                    })
                {
                    combat.used_defend.insert(
                        defender_id.clone(),
                        target_id.as_str().to_string(),
                    );
                    newly_used.push(defender_id);
                }
            }
        }

        // Collect summoned status for FamePerEnemyDefeated check
        let defeated_summoned_flags: Vec<bool> = target_indices.iter().map(|&idx| {
            state.combat.as_ref().unwrap().enemies[idx].summoned_by_instance_id.is_some()
        }).collect();

        let player = &mut state.players[player_idx];
        player.fame += result.fame_gained;
        player.enemies_defeated_this_turn += target_count as u32;
        player.reputation = (player.reputation as i32 + result.reputation_delta)
            .clamp(-7, 7) as i8;

        // Hook: FamePerEnemyDefeated bonus (Banner of Glory, Sword of Justice)
        let bonus_fame = count_fame_per_enemy_bonus(
            &state.active_modifiers,
            &state.players[player_idx].id,
            &defeated_summoned_flags,
        );
        if bonus_fame > 0 {
            state.players[player_idx].fame += bonus_fame;
            state.combat.as_mut().unwrap().fame_gained += bonus_fame;
        }

        // Hook: SoulHarvesterCrystalTracking — award crystals per defeated enemy
        resolve_soul_harvester_crystals(state, player_idx, &defeated_summoned_flags);

        // Hook: Track ranged/siege phase defeats for BowPhaseFameTracking
        if state.combat.as_ref().unwrap().phase == CombatPhase::RangedSiege {
            state.combat.as_mut().unwrap().ranged_siege_defeats += target_count as u32;
        }
    }

    // Mark used attack as assigned (consumed whether success or failure)
    let accumulator = &mut state.players[player_idx].combat_accumulator;
    let assigned = match attack_type {
        CombatType::Melee => &mut accumulator.assigned_attack.normal_elements,
        CombatType::Ranged => &mut accumulator.assigned_attack.ranged_elements,
        CombatType::Siege => &mut accumulator.assigned_attack.siege_elements,
    };
    *assigned = combat_resolution::add_elements(assigned, &available);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_spend_move_on_cumbersome(
    state: &mut GameState,
    player_idx: usize,
    enemy_instance_id: &CombatInstanceId,
) -> Result<ApplyResult, ApplyError> {
    // Decrement move points
    let player = &mut state.players[player_idx];
    if player.move_points == 0 {
        return Err(ApplyError::InternalError(
            "SpendMoveOnCumbersome: no move points".into(),
        ));
    }
    player.move_points -= 1;

    // Increment cumbersome reduction
    let combat = state
        .combat
        .as_mut()
        .ok_or_else(|| ApplyError::InternalError("SpendMoveOnCumbersome: no combat".into()))?;

    *combat
        .cumbersome_reductions
        .entry(enemy_instance_id.as_str().to_string())
        .or_insert(0) += 1;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Resolve summon abilities at the start of the Block phase.
///
/// For each undefeated enemy with Summon or SummonGreen:
/// - Draw from Brown (Summon) or Green (SummonGreen) pile
/// - Create CombatEnemy with summoned_by_instance_id linking to summoner
/// - Mark summoner as hidden (doesn't deal damage during Block/AssignDamage)
///
/// For enemies with per-attack Summon (like Dragon Summoner), each Summon attack
/// triggers a separate draw.
pub(super) fn resolve_summons(state: &mut GameState) -> Result<(), ApplyError> {
    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("resolve_summons: no combat".into()))?;

    // Collect summon requests before mutating
    struct SummonRequest {
        summoner_idx: usize,
        summoner_instance_id: String,
        color: EnemyColor,
        count: usize,
    }

    let mut requests: Vec<SummonRequest> = Vec::new();

    for (idx, enemy) in combat.enemies.iter().enumerate() {
        if enemy.is_defeated {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        // Check for ability-level Summon/SummonGreen
        let is_summon = combat_resolution::has_ability(def, EnemyAbilityType::Summon);
        let is_summon_green = combat_resolution::has_ability(def, EnemyAbilityType::SummonGreen);

        if is_summon || is_summon_green {
            let color = if is_summon_green {
                EnemyColor::Green
            } else {
                EnemyColor::Brown
            };

            // Count: 1 summon per ability instance, unless multi-attack with per-attack Summon
            let mut count = 1;
            if let Some(attacks) = def.attacks {
                // Count per-attack Summon abilities
                let per_attack_summons = attacks
                    .iter()
                    .filter(|a| a.ability == Some(EnemyAbilityType::Summon))
                    .count();
                if per_attack_summons > 0 {
                    count = per_attack_summons;
                }
            }

            requests.push(SummonRequest {
                summoner_idx: idx,
                summoner_instance_id: enemy.instance_id.as_str().to_string(),
                color,
                count,
            });
            continue;
        }

        // Also check per-attack Summon for enemies that don't have ability-level Summon
        // (shouldn't happen in practice, but defensive)
        if let Some(attacks) = def.attacks {
            let per_attack_summons: Vec<_> = attacks
                .iter()
                .filter(|a| {
                    a.ability == Some(EnemyAbilityType::Summon)
                        || a.ability == Some(EnemyAbilityType::SummonGreen)
                })
                .collect();

            if !per_attack_summons.is_empty() {
                let color = if per_attack_summons
                    .iter()
                    .any(|a| a.ability == Some(EnemyAbilityType::SummonGreen))
                {
                    EnemyColor::Green
                } else {
                    EnemyColor::Brown
                };

                requests.push(SummonRequest {
                    summoner_idx: idx,
                    summoner_instance_id: enemy.instance_id.as_str().to_string(),
                    color,
                    count: per_attack_summons.len(),
                });
            }
        }
    }

    if requests.is_empty() {
        return Ok(());
    }

    // Process summon requests — draw from piles (needs &mut state for rng + enemy_tokens)
    struct SummonedEnemy {
        instance_id: String,
        enemy_id: String,
        num_attacks: usize,
        summoner_instance_id: String,
    }

    let mut summoned_enemies: Vec<SummonedEnemy> = Vec::new();
    let mut summoner_indices_to_hide: Vec<usize> = Vec::new();
    let mut next_id = state.combat.as_ref().unwrap().enemies.len();

    for request in &requests {
        let mut any_summoned = false;

        for _ in 0..request.count {
            let token =
                draw_enemy_token(&mut state.enemy_tokens, request.color, &mut state.rng);

            let token_id = match token {
                Some(t) => t,
                None => continue,
            };

            let enemy_id_str = enemy_id_from_token(&token_id);
            let summoned_def = match get_enemy(&enemy_id_str) {
                Some(d) => d,
                None => continue,
            };

            let num_attacks = attack_count(summoned_def);
            let instance_id = format!("summoned_{}_{}", next_id, enemy_id_str);
            next_id += 1;

            summoned_enemies.push(SummonedEnemy {
                instance_id,
                enemy_id: enemy_id_str,
                num_attacks,
                summoner_instance_id: request.summoner_instance_id.clone(),
            });

            any_summoned = true;
        }

        if any_summoned {
            summoner_indices_to_hide.push(request.summoner_idx);
        }
    }

    // Apply mutations to combat state
    let combat = state.combat.as_mut().unwrap();

    for summoned in summoned_enemies {
        combat.enemies.push(CombatEnemy {
            instance_id: CombatInstanceId::from(summoned.instance_id),
            enemy_id: EnemyId::from(summoned.enemy_id),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: Some(CombatInstanceId::from(
                summoned.summoner_instance_id,
            )),
            is_summoner_hidden: false,
            attacks_blocked: vec![false; summoned.num_attacks],
            attacks_damage_assigned: vec![false; summoned.num_attacks],
            attacks_cancelled: vec![false; summoned.num_attacks],
        });
    }

    for &idx in &summoner_indices_to_hide {
        combat.enemies[idx].is_summoner_hidden = true;
    }

    Ok(())
}


pub(super) fn apply_end_combat_phase(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let combat = state
        .combat
        .as_mut()
        .ok_or_else(|| ApplyError::InternalError("EndCombatPhase with no combat".into()))?;

    match combat.phase {
        CombatPhase::RangedSiege => {
            // Clear ranged/siege attack pools (consumed by this phase)
            let accumulator = &mut state.players[player_idx].combat_accumulator;
            accumulator.attack.ranged = 0;
            accumulator.attack.siege = 0;
            accumulator.attack.ranged_elements = ElementalValues::default();
            accumulator.attack.siege_elements = ElementalValues::default();
            accumulator.assigned_attack.ranged = 0;
            accumulator.assigned_attack.siege = 0;
            accumulator.assigned_attack.ranged_elements = ElementalValues::default();
            accumulator.assigned_attack.siege_elements = ElementalValues::default();

            // Hook: BowPhaseFameTracking — award fame for enemies defeated in ranged/siege phase
            {
                let ranged_defeats = state.combat.as_ref().unwrap().ranged_siege_defeats;
                if ranged_defeats > 0 {
                    let player_id = state.players[player_idx].id.clone();
                    let bonus_fame: u32 = state.active_modifiers.iter()
                        .filter(|m| {
                            matches!(&m.effect, mk_types::modifier::ModifierEffect::BowPhaseFameTracking { .. })
                                && m.created_by_player_id == player_id
                        })
                        .map(|m| match &m.effect {
                            mk_types::modifier::ModifierEffect::BowPhaseFameTracking { fame_per_enemy } => {
                                fame_per_enemy * ranged_defeats
                            }
                            _ => 0,
                        })
                        .sum();
                    if bonus_fame > 0 {
                        state.players[player_idx].fame += bonus_fame;
                        state.combat.as_mut().unwrap().fame_gained += bonus_fame;
                    }
                }
            }

            state.combat.as_mut().unwrap().phase = CombatPhase::Block;

            // Resolve summons at the start of Block phase
            resolve_summons(state)?;
        }
        CombatPhase::Block => {
            // Check DefeatIfBlocked: enemies with the modifier whose ALL attacks are blocked → defeated
            {
                let combat = state.combat.as_ref().unwrap();
                let mut defeat_indices: Vec<usize> = Vec::new();
                for (idx, enemy) in combat.enemies.iter().enumerate() {
                    if enemy.is_defeated {
                        continue;
                    }
                    if !combat_resolution::has_defeat_if_blocked(
                        &state.active_modifiers,
                        enemy.instance_id.as_str(),
                    ) {
                        continue;
                    }
                    // Check if ALL attacks are blocked
                    let all_blocked = enemy
                        .attacks_blocked
                        .iter()
                        .enumerate()
                        .all(|(i, blocked)| {
                            *blocked || enemy.attacks_cancelled.get(i).copied().unwrap_or(false)
                        });
                    if all_blocked && !enemy.attacks_blocked.is_empty() {
                        defeat_indices.push(idx);
                    }
                }

                // Award fame and mark defeated
                for idx in &defeat_indices {
                    let enemy = &state.combat.as_ref().unwrap().enemies[*idx];
                    let enemy_id_str = enemy.enemy_id.as_str().to_string();
                    let is_summoned = enemy.summoned_by_instance_id.is_some();
                    if let Some(def) = get_enemy(&enemy_id_str) {
                        if !is_summoned {
                            state.players[player_idx].fame += def.fame;
                            state.combat.as_mut().unwrap().fame_gained += def.fame;
                        }
                    }
                    state.combat.as_mut().unwrap().enemies[*idx].is_defeated = true;
                }
            }

            // Clear block accumulator
            let accumulator = &mut state.players[player_idx].combat_accumulator;
            accumulator.block = 0;
            accumulator.block_elements = ElementalValues::default();
            accumulator.swift_block_elements = ElementalValues::default();
            accumulator.assigned_block = 0;
            accumulator.assigned_block_elements = ElementalValues::default();

            // Set all_damage_blocked_this_phase for conditional effects (e.g. BlockedSuccessfully)
            let all_blocked = {
                let combat = state.combat.as_ref().unwrap();
                let undefeated: Vec<&CombatEnemy> =
                    combat.enemies.iter().filter(|e| !e.is_defeated).collect();
                undefeated.is_empty()
                    || undefeated.iter().all(|e| e.is_blocked)
            };
            state.combat.as_mut().unwrap().all_damage_blocked_this_phase = all_blocked;

            // Check if there are units available and unblocked damage exists
            // If units present, enter interactive AssignDamage phase.
            // Otherwise, auto-assign all to hero (existing behavior).
            let has_eligible_units = state.combat.as_ref().unwrap().units_allowed
                && state.players[player_idx]
                    .units
                    .iter()
                    .any(|u| u.state == UnitState::Ready || u.state == UnitState::Spent);

            if has_eligible_units && has_unassigned_damage(state) {
                state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;
            } else {
                // Auto-assign all damage to hero (no units to choose)
                apply_auto_damage(state, player_idx)?;
                state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;
            }
        }
        CombatPhase::AssignDamage => {
            // Apply paralyze effect: if any unblocked Paralyze attack dealt wounds to hero,
            // discard all non-wound cards from hand
            let combat = state.combat.as_ref().unwrap();
            if combat.has_paralyze_damage_to_hero {
                let player = &mut state.players[player_idx];
                let non_wounds: Vec<CardId> = player
                    .hand
                    .iter()
                    .filter(|c| c.as_str() != "wound")
                    .cloned()
                    .collect();
                player.hand.retain(|c| c.as_str() == "wound");
                player.discard.extend(non_wounds);
            }

            // Remove undefeated summoned enemies (they don't persist to Attack phase)
            let combat = state.combat.as_mut().unwrap();
            combat.enemies.retain(|e| {
                e.summoned_by_instance_id.is_none() || e.is_defeated
            });

            // Unhide summoners
            for enemy in &mut combat.enemies {
                enemy.is_summoner_hidden = false;
            }

            combat.phase = CombatPhase::Attack;

            // Dueling: grant Attack 1 Physical at Block→Attack transition
            skills_complex::apply_dueling_attack_bonus(state, player_idx);
        }
        CombatPhase::Attack => {
            // End combat — remove defeated enemies from map, discard tokens
            combat_end::end_combat(state, player_idx);
            return Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: Vec::new(),
            });
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Auto-process damage from unblocked enemy attacks during Block→AssignDamage transition.
///
/// For each undefeated enemy with unblocked attacks:
/// - Calculate wounds (ceil(damage / hero_armor), Brutal doubles)
/// - Add wound cards to player hand
/// - If Poison: also add wound to discard pile
/// - Mark attacks as damage_assigned
pub(super) fn apply_auto_damage(
    state: &mut GameState,
    player_idx: usize,
) -> Result<(), ApplyError> {
    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("apply_auto_damage: no combat".into()))?;

    let hero_armor = state.players[player_idx].armor;

    // Collect damage info before mutating
    struct DamageInfo {
        enemy_idx: usize,
        attack_index: usize,
        wounds: u32,
        is_poison: bool,
        is_paralyze: bool,
    }

    let mut damage_entries: Vec<DamageInfo> = Vec::new();

    let active_modifiers = &state.active_modifiers;

    for (enemy_idx, enemy) in combat.enemies.iter().enumerate() {
        if enemy.is_defeated {
            continue;
        }

        // Hidden summoners don't deal damage (their summoned enemies attack instead)
        if enemy.is_summoner_hidden {
            continue;
        }

        // Check if enemy's attacks are skipped (e.g., cancel attack, freeze)
        if combat_resolution::is_enemy_attacks_skipped(active_modifiers, enemy.instance_id.as_str()) {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        let num_attacks = attack_count(def);

        // Get attack modifier for this enemy (from weaken, taunt, etc.)
        let (atk_change, atk_minimum) =
            combat_resolution::get_enemy_attack_modifier(active_modifiers, enemy.instance_id.as_str());

        for attack_index in 0..num_attacks {
            // Skip blocked, cancelled, or already-assigned attacks
            if enemy.attacks_blocked.get(attack_index).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_cancelled.get(attack_index).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_damage_assigned.get(attack_index).copied().unwrap_or(false) {
                continue;
            }

            // Apply cumbersome reduction to damage
            let cumbersome_reduction = combat
                .cumbersome_reductions
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);

            let (base_damage, _element, _is_swift) =
                combat_resolution::get_enemy_attack_info(def, attack_index);

            // Apply attack modifier (weaken, taunt, etc.)
            let modified_damage = if atk_change != 0 {
                (base_damage as i32 + atk_change).max(atk_minimum as i32) as u32
            } else {
                base_damage
            };

            let reduced_damage = modified_damage.saturating_sub(cumbersome_reduction);

            // If cumbersome reduces to 0, skip (considered blocked)
            if reduced_damage == 0 && base_damage > 0 {
                // Mark this attack as blocked for Elusive armor calculation
                // (will be handled via is_blocked flag update below)
                continue;
            }

            let (wounds, is_poison) =
                combat_resolution::calculate_hero_wounds_with_damage(
                    def, attack_index, hero_armor, reduced_damage,
                );

            let is_paralyze = combat_resolution::has_ability(def, EnemyAbilityType::Paralyze);

            if wounds > 0 || is_poison {
                damage_entries.push(DamageInfo {
                    enemy_idx,
                    attack_index,
                    wounds,
                    is_poison,
                    is_paralyze,
                });
            }
        }
    }

    // Check if cumbersome reductions make enemies count as fully blocked
    // (important for Elusive: blocked enemies use lower armor)
    {
        let combat = state.combat.as_ref().unwrap();
        let mut cumbersome_blocked: Vec<usize> = Vec::new();

        for (enemy_idx, enemy) in combat.enemies.iter().enumerate() {
            if enemy.is_defeated || enemy.is_blocked {
                continue;
            }
            let cumbersome_reduction = combat
                .cumbersome_reductions
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);
            if cumbersome_reduction == 0 {
                continue;
            }

            let def = match get_enemy(enemy.enemy_id.as_str()) {
                Some(d) => d,
                None => continue,
            };

            let num_attacks = attack_count(def);
            let all_reduced_to_zero = (0..num_attacks).all(|i| {
                if enemy.attacks_blocked.get(i).copied().unwrap_or(false) {
                    return true;
                }
                if enemy.attacks_cancelled.get(i).copied().unwrap_or(false) {
                    return true;
                }
                let (dmg, _, _) = combat_resolution::get_enemy_attack_info(def, i);
                dmg == 0 || dmg.saturating_sub(cumbersome_reduction) == 0
            });

            if all_reduced_to_zero {
                cumbersome_blocked.push(enemy_idx);
            }
        }

        let combat = state.combat.as_mut().unwrap();
        for idx in cumbersome_blocked {
            combat.enemies[idx].is_blocked = true;
        }
    }

    // Apply damage
    let mut total_wounds_to_hand = 0u32;
    let mut total_wounds_to_discard = 0u32;

    for entry in &damage_entries {
        total_wounds_to_hand += entry.wounds;
        if entry.is_poison {
            // Poison: wounds also go to discard (one extra wound per attack)
            total_wounds_to_discard += entry.wounds;
        }
    }

    // Add wound cards to hand
    let player = &mut state.players[player_idx];
    for _ in 0..total_wounds_to_hand {
        player.hand.push(CardId::from("wound"));
    }

    // Poison: add extra wounds to discard
    for _ in 0..total_wounds_to_discard {
        player.discard.push(CardId::from("wound"));
    }

    player.wounds_received_this_turn.hand += total_wounds_to_hand;
    player.wounds_received_this_turn.discard += total_wounds_to_discard;

    // Update combat state
    let combat = state.combat.as_mut().unwrap();
    combat.wounds_this_combat += total_wounds_to_hand + total_wounds_to_discard;
    if total_wounds_to_hand > 0 {
        combat.wounds_added_to_hand_this_combat = true;
    }

    // Update vampiric armor bonus: each Vampiric enemy gains +1 armor per wound to hand
    if total_wounds_to_hand > 0 {
        for enemy in &combat.enemies {
            if enemy.is_defeated {
                continue;
            }
            let def = match get_enemy(enemy.enemy_id.as_str()) {
                Some(d) => d,
                None => continue,
            };
            if combat_resolution::has_ability(def, EnemyAbilityType::Vampiric) {
                let instance_id = enemy.instance_id.as_str().to_string();
                *combat.vampiric_armor_bonus.entry(instance_id).or_insert(0) +=
                    total_wounds_to_hand;
            }
        }
    }

    // Mark attacks as damage assigned
    for entry in &damage_entries {
        if let Some(enemy) = combat.enemies.get_mut(entry.enemy_idx) {
            if entry.attack_index < enemy.attacks_damage_assigned.len() {
                enemy.attacks_damage_assigned[entry.attack_index] = true;
            }
            enemy.damage_assigned = true;
        }
    }

    // Paralyze: if any unblocked Paralyze attack dealt wounds, discard all non-wound cards from hand
    let has_paralyze_damage = damage_entries.iter().any(|e| e.is_paralyze && e.wounds > 0);
    if has_paralyze_damage {
        let player = &mut state.players[player_idx];
        let non_wounds: Vec<CardId> = player
            .hand
            .iter()
            .filter(|c| c.as_str() != "wound")
            .cloned()
            .collect();
        player.hand.retain(|c| c.as_str() == "wound");
        player.discard.extend(non_wounds);
    }

    Ok(())
}


/// Check if there are any unassigned, unblocked, uncancelled attacks with damage > 0.
pub(super) fn has_unassigned_damage(state: &GameState) -> bool {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return false,
    };
    for enemy in &combat.enemies {
        if enemy.is_defeated || enemy.is_summoner_hidden {
            continue;
        }
        if combat_resolution::is_enemy_attacks_skipped(
            &state.active_modifiers,
            enemy.instance_id.as_str(),
        ) {
            continue;
        }
        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };
        let num_attacks = attack_count(def);
        for i in 0..num_attacks {
            if enemy.attacks_blocked.get(i).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_cancelled.get(i).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_damage_assigned.get(i).copied().unwrap_or(true) {
                continue;
            }
            let (dmg, _, _) = combat_resolution::get_enemy_attack_info(def, i);
            if dmg > 0 {
                return true;
            }
        }
    }
    false
}


/// Assign a specific enemy attack's damage to the hero.
pub(super) fn apply_assign_damage_to_hero(
    state: &mut GameState,
    player_idx: usize,
    enemy_index: usize,
    attack_index: usize,
) -> Result<ApplyResult, ApplyError> {
    let combat = state.combat.as_ref().ok_or_else(|| {
        ApplyError::InternalError("AssignDamageToHero: no combat".into())
    })?;

    let enemy = combat.enemies.get(enemy_index).ok_or_else(|| {
        ApplyError::InternalError(format!("AssignDamageToHero: enemy_index {} out of range", enemy_index))
    })?;

    let def = get_enemy(enemy.enemy_id.as_str()).ok_or_else(|| {
        ApplyError::InternalError(format!("AssignDamageToHero: unknown enemy '{}'", enemy.enemy_id.as_str()))
    })?;

    let hero_armor = state.players[player_idx].armor;

    // Get attack modifier for this enemy
    let (atk_change, atk_minimum) =
        combat_resolution::get_enemy_attack_modifier(&state.active_modifiers, enemy.instance_id.as_str());

    // Apply cumbersome reduction
    let cumbersome_reduction = combat
        .cumbersome_reductions
        .get(enemy.instance_id.as_str())
        .copied()
        .unwrap_or(0);

    let (base_damage, _element, _is_swift) =
        combat_resolution::get_enemy_attack_info(def, attack_index);

    let modified_damage = if atk_change != 0 {
        (base_damage as i32 + atk_change).max(atk_minimum as i32) as u32
    } else {
        base_damage
    };

    let reduced_damage = modified_damage.saturating_sub(cumbersome_reduction);

    let (wounds, is_poison) =
        combat_resolution::calculate_hero_wounds_with_damage(def, attack_index, hero_armor, reduced_damage);

    let is_paralyze = combat_resolution::has_ability(def, EnemyAbilityType::Paralyze);

    // Apply wounds to hero
    let player = &mut state.players[player_idx];
    for _ in 0..wounds {
        player.hand.push(CardId::from("wound"));
    }
    if is_poison {
        for _ in 0..wounds {
            player.discard.push(CardId::from("wound"));
        }
    }

    player.wounds_received_this_turn.hand += wounds;
    if is_poison {
        player.wounds_received_this_turn.discard += wounds;
    }

    // Update combat state
    let combat = state.combat.as_mut().unwrap();
    combat.wounds_this_combat += wounds + if is_poison { wounds } else { 0 };
    if wounds > 0 {
        combat.wounds_added_to_hand_this_combat = true;
    }

    // Update vampiric armor bonus
    if wounds > 0 {
        for enemy in &combat.enemies {
            if enemy.is_defeated {
                continue;
            }
            let edef = match get_enemy(enemy.enemy_id.as_str()) {
                Some(d) => d,
                None => continue,
            };
            if combat_resolution::has_ability(edef, EnemyAbilityType::Vampiric) {
                let instance_id = enemy.instance_id.as_str().to_string();
                *combat.vampiric_armor_bonus.entry(instance_id).or_insert(0) += wounds;
            }
        }
    }

    // Mark attack as assigned
    combat.enemies[enemy_index].attacks_damage_assigned[attack_index] = true;
    combat.enemies[enemy_index].damage_assigned = true;

    // Track paralyze for end of assignment
    if is_paralyze && wounds > 0 {
        combat.has_paralyze_damage_to_hero = true;
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Assign a specific enemy attack's damage to a unit.
pub(super) fn apply_assign_damage_to_unit(
    state: &mut GameState,
    player_idx: usize,
    enemy_index: usize,
    attack_index: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
) -> Result<ApplyResult, ApplyError> {
    let combat = state.combat.as_ref().ok_or_else(|| {
        ApplyError::InternalError("AssignDamageToUnit: no combat".into())
    })?;

    let enemy = combat.enemies.get(enemy_index).ok_or_else(|| {
        ApplyError::InternalError(format!("AssignDamageToUnit: enemy_index {} out of range", enemy_index))
    })?;

    let def = get_enemy(enemy.enemy_id.as_str()).ok_or_else(|| {
        ApplyError::InternalError(format!("AssignDamageToUnit: unknown enemy '{}'", enemy.enemy_id.as_str()))
    })?;

    // Get attack modifier for this enemy
    let (atk_change, atk_minimum) =
        combat_resolution::get_enemy_attack_modifier(&state.active_modifiers, enemy.instance_id.as_str());

    // Apply cumbersome reduction
    let cumbersome_reduction = combat
        .cumbersome_reductions
        .get(enemy.instance_id.as_str())
        .copied()
        .unwrap_or(0);

    let (base_damage, attack_element, _is_swift) =
        combat_resolution::get_enemy_attack_info(def, attack_index);

    let modified_damage = if atk_change != 0 {
        (base_damage as i32 + atk_change).max(atk_minimum as i32) as u32
    } else {
        base_damage
    };

    let reduced_damage = modified_damage.saturating_sub(cumbersome_reduction);

    let is_poison = combat_resolution::has_ability(def, EnemyAbilityType::Poison);
    let is_paralyze = combat_resolution::has_ability(def, EnemyAbilityType::Paralyze);
    let is_brutal = combat_resolution::has_ability(def, EnemyAbilityType::Brutal);
    let effective_damage = if is_brutal { reduced_damage * 2 } else { reduced_damage };

    // Find the unit
    let unit_idx = state.players[player_idx]
        .units
        .iter()
        .position(|u| u.instance_id == *unit_instance_id)
        .ok_or_else(|| {
            ApplyError::InternalError(format!(
                "AssignDamageToUnit: unit '{}' not found",
                unit_instance_id.as_str()
            ))
        })?;

    let unit = &state.players[player_idx].units[unit_idx];
    let unit_id = unit.unit_id.clone();
    let _unit_def = mk_data::units::get_unit(unit_id.as_str()).ok_or_else(|| {
        ApplyError::InternalError(format!("AssignDamageToUnit: unknown unit def '{}'", unit_id.as_str()))
    })?;

    // Collect unit's resistances: base from definition + granted by modifiers
    let unit_resistances: Vec<ResistanceElement> = {
        let mut resistances = Vec::new();
        // Check for GrantResistances modifiers (e.g., from Altem Guardians)
        for m in &state.active_modifiers {
            if let mk_types::modifier::ModifierEffect::GrantResistances { resistances: granted } = &m.effect {
                let scope_matches = matches!(&m.scope, mk_types::modifier::ModifierScope::AllUnits)
                    || matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope);
                if scope_matches {
                    for r in granted {
                        if !resistances.contains(r) {
                            resistances.push(*r);
                        }
                    }
                }
            }
        }
        resistances
    };

    let damage_result = combat_resolution::calculate_unit_damage(
        effective_damage,
        attack_element,
        is_poison,
        is_paralyze,
        unit.level,
        unit.wounded,
        unit.used_resistance_this_combat,
        &unit_resistances,
    );

    // Apply result to unit (with Banner of Fortitude intercept)
    if damage_result.unit_destroyed {
        // Check fortitude before destruction — if wound would be negated, unit survives as wounded
        // Fortitude only prevents the wound step, not destruction from double-wound
        state.players[player_idx].units.remove(unit_idx);
    } else {
        if damage_result.unit_wounded {
            // Banner of Fortitude: negate the wound if available
            let negated = sites::try_negate_wound_with_fortitude(state, player_idx, unit_instance_id);
            if !negated {
                state.players[player_idx].units[unit_idx].wounded = true;
            }
        }
        if damage_result.resistance_used {
            state.players[player_idx].units[unit_idx].used_resistance_this_combat = true;
        }
    }

    // Mark attack as assigned
    let combat = state.combat.as_mut().unwrap();
    combat.enemies[enemy_index].attacks_damage_assigned[attack_index] = true;
    combat.enemies[enemy_index].damage_assigned = true;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


// =============================================================================
// Combat modifier hook helpers
// =============================================================================

/// Build a list of resistance elements that should be removed from targets
/// based on active modifiers (RemovePhysicalResistance, RemoveFireResistance, etc.).
pub(super) fn build_removed_resistances(
    modifiers: &[mk_types::modifier::ActiveModifier],
    _target_pairs: &[(CombatEnemy, &mk_data::enemies::EnemyDefinition)],
    _player_idx: usize,
    player_id: &PlayerId,
) -> Vec<ResistanceElement> {
    use mk_types::modifier::ModifierEffect;

    let mut removed = Vec::new();
    for m in modifiers {
        // Only consider modifiers created by the current player
        let is_player = match &m.source {
            mk_types::modifier::ModifierSource::Card { player_id: pid, .. }
            | mk_types::modifier::ModifierSource::Skill { player_id: pid, .. }
            | mk_types::modifier::ModifierSource::Unit { player_id: pid, .. }
            | mk_types::modifier::ModifierSource::Tactic { player_id: pid, .. } => pid == player_id,
            mk_types::modifier::ModifierSource::Site { .. } => false,
        };
        if !is_player {
            continue;
        }

        match &m.effect {
            ModifierEffect::RemovePhysicalResistance => {
                if !removed.contains(&ResistanceElement::Physical) {
                    removed.push(ResistanceElement::Physical);
                }
            }
            ModifierEffect::RemoveFireResistance => {
                if !removed.contains(&ResistanceElement::Fire) {
                    removed.push(ResistanceElement::Fire);
                }
            }
            ModifierEffect::RemoveIceResistance => {
                if !removed.contains(&ResistanceElement::Ice) {
                    removed.push(ResistanceElement::Ice);
                }
            }
            ModifierEffect::RemoveResistances => {
                // Already handled by are_resistances_removed() in legal_actions,
                // but for attack resolution we need to strip them here too.
                for r in &[ResistanceElement::Physical, ResistanceElement::Fire, ResistanceElement::Ice] {
                    if !removed.contains(r) {
                        removed.push(*r);
                    }
                }
            }
            _ => {}
        }
    }
    removed
}


/// Count bonus fame from FamePerEnemyDefeated modifiers for defeated enemies.
pub(super) fn count_fame_per_enemy_bonus(
    modifiers: &[mk_types::modifier::ActiveModifier],
    player_id: &PlayerId,
    defeated_summoned_flags: &[bool],
) -> u32 {
    use mk_types::modifier::ModifierEffect;

    let mut total_bonus = 0u32;
    for m in modifiers {
        if let ModifierEffect::FamePerEnemyDefeated { fame_per_enemy, exclude_summoned } = &m.effect {
            let is_player = m.created_by_player_id == *player_id;
            if !is_player {
                continue;
            }
            let eligible_count = if *exclude_summoned {
                defeated_summoned_flags.iter().filter(|&&is_summoned| !is_summoned).count()
            } else {
                defeated_summoned_flags.len()
            };
            total_bonus += fame_per_enemy * eligible_count as u32;
        }
    }
    total_bonus
}


/// Award crystals from SoulHarvesterCrystalTracking modifiers on enemy defeat.
///
/// Auto-selects crystal color based on first available non-max color.
/// Decrements the tracker limit.
pub(super) fn resolve_soul_harvester_crystals(
    state: &mut GameState,
    player_idx: usize,
    defeated_summoned_flags: &[bool],
) {
    use mk_types::modifier::ModifierEffect;

    let player_id = state.players[player_idx].id.clone();

    // Find the SoulHarvesterCrystalTracking modifier index
    let mod_idx = state.active_modifiers.iter().position(|m| {
        matches!(&m.effect, ModifierEffect::SoulHarvesterCrystalTracking { .. })
            && m.created_by_player_id == player_id
    });

    let Some(idx) = mod_idx else { return };

    let (limit, _track_by_attack) = match &state.active_modifiers[idx].effect {
        ModifierEffect::SoulHarvesterCrystalTracking { limit, track_by_attack } => (*limit, *track_by_attack),
        _ => return,
    };

    if limit == 0 {
        return;
    }

    // Count eligible defeats (non-summoned only)
    let eligible = defeated_summoned_flags.iter().filter(|&&s| !s).count() as u32;
    let to_award = eligible.min(limit);

    if to_award == 0 {
        return;
    }

    // Auto-select crystal colors (cycle through basic colors)
    let colors = [BasicManaColor::Red, BasicManaColor::Blue, BasicManaColor::Green, BasicManaColor::White];
    for _ in 0..to_award {
        // Pick the first color that isn't at max
        let player = &state.players[player_idx];
        let crystal_color = colors.iter().find(|&&c| {
            let count = match c {
                BasicManaColor::Red => player.crystals.red,
                BasicManaColor::Blue => player.crystals.blue,
                BasicManaColor::Green => player.crystals.green,
                BasicManaColor::White => player.crystals.white,
            };
            count < 3
        }).copied();
        if let Some(color) = crystal_color {
            crate::mana::gain_crystal(&mut state.players[player_idx], color);
        }
    }

    // Decrement limit on the modifier
    let new_limit = limit.saturating_sub(to_award);
    if let ModifierEffect::SoulHarvesterCrystalTracking { ref mut limit, .. } = state.active_modifiers[idx].effect {
        *limit = new_limit;
    }
}

