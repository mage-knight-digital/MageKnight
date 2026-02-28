//! Combat-specific legal action enumeration: block and attack declarations.

use mk_data::enemies::{attack_count, get_enemy};
use mk_types::enums::*;
use mk_types::legal_action::LegalAction;
use mk_types::state::*;

use crate::combat_resolution::{
    auto_assign_defend, calculate_effective_attack, calculate_effective_block,
    effective_city_color_for_enemy, has_ability, subtract_elements,
};

// =============================================================================
// Block enumeration
// =============================================================================

/// Enumerate DeclareBlock actions for the Block phase.
///
/// For each unblocked, undefeated enemy attack: if accumulated block is sufficient
/// to block that attack, emit a DeclareBlock action.
pub(super) fn enumerate_block_declarations(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return,
    };

    if combat.phase != CombatPhase::Block {
        return;
    }

    let player = &state.players[player_idx];
    let block_elements = &player.combat_accumulator.block_elements;

    // No block accumulated → nothing to declare
    if block_elements.total() == 0 {
        return;
    }

    let player_id = state.players[player_idx].id.as_str();

    for enemy in &combat.enemies {
        if enemy.is_defeated {
            continue;
        }

        // Filter by cooperative assault assignments
        if !crate::cooperative_assault::is_enemy_assigned_to_player(
            &combat.enemy_assignments,
            player_id,
            enemy.instance_id.as_str(),
        ) {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        let num_attacks = attack_count(def);

        for attack_index in 0..num_attacks {
            // Skip already-blocked or cancelled attacks
            if enemy.attacks_blocked.get(attack_index).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_cancelled.get(attack_index).copied().unwrap_or(false) {
                continue;
            }

            let enemy_city_color = effective_city_color_for_enemy(combat, enemy);
            let (damage, attack_element, is_swift) = crate::combat_resolution::get_enemy_attack_info_with_city(def, attack_index, enemy_city_color);

            // Skip zero-damage attacks (e.g., summon attacks)
            if damage == 0 {
                continue;
            }

            let required = if is_swift { damage * 2 } else { damage };
            let effective_block = calculate_effective_block(block_elements, attack_element);

            if effective_block >= required {
                actions.push(LegalAction::DeclareBlock {
                    enemy_instance_id: enemy.instance_id.clone(),
                    attack_index,
                });
            }
        }
    }
}

// =============================================================================
// Cumbersome enumeration
// =============================================================================

/// Enumerate SpendMoveOnCumbersome actions during Block phase.
///
/// For each undefeated Cumbersome enemy with remaining reducible attack damage,
/// if the player has move points, emit a SpendMoveOnCumbersome action.
pub(super) fn enumerate_cumbersome_actions(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return,
    };

    if combat.phase != CombatPhase::Block {
        return;
    }

    let player = &state.players[player_idx];
    if player.move_points == 0 {
        return;
    }

    let player_id = player.id.as_str();

    for enemy in &combat.enemies {
        if enemy.is_defeated {
            continue;
        }

        // Filter by cooperative assault assignments
        if !crate::cooperative_assault::is_enemy_assigned_to_player(
            &combat.enemy_assignments,
            player_id,
            enemy.instance_id.as_str(),
        ) {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        let has_granted_cumbersome = state.active_modifiers.iter().any(|m| {
            matches!(&m.effect, mk_types::modifier::ModifierEffect::GrantEnemyAbility { ability }
                if *ability == EnemyAbilityType::Cumbersome)
            && matches!(&m.scope, mk_types::modifier::ModifierScope::OneEnemy { enemy_id }
                if enemy_id == enemy.instance_id.as_str())
        });
        if !has_ability(def, EnemyAbilityType::Cumbersome) && !has_granted_cumbersome {
            continue;
        }

        // Calculate total reducible attack damage for this enemy
        let num_attacks = attack_count(def);
        let mut total_damage = 0u32;
        for attack_index in 0..num_attacks {
            // Skip already-blocked or cancelled attacks
            if enemy.attacks_blocked.get(attack_index).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_cancelled.get(attack_index).copied().unwrap_or(false) {
                continue;
            }
            let enemy_city_color = effective_city_color_for_enemy(combat, enemy);
            let (damage, _, _) = crate::combat_resolution::get_enemy_attack_info_with_city(def, attack_index, enemy_city_color);
            total_damage += damage;
        }

        let current_reduction = combat
            .cumbersome_reductions
            .get(enemy.instance_id.as_str())
            .copied()
            .unwrap_or(0);

        // Can still reduce if current reduction hasn't zeroed out all attacks
        if current_reduction < total_damage {
            actions.push(LegalAction::SpendMoveOnCumbersome {
                enemy_instance_id: enemy.instance_id.clone(),
            });
        }
    }
}

// =============================================================================
// Attack enumeration
// =============================================================================

/// Enumerate InitiateAttack actions for RangedSiege and Attack phases.
///
/// Only available when no attack declaration is active (`declared_attack_targets` is None).
/// Does not require accumulated attack — the player declares targets first, then plays cards.
pub(super) fn enumerate_attack_declarations(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return,
    };

    // Only allow new declarations when no active declaration exists
    if combat.declared_attack_targets.is_some() {
        return;
    }

    let player_id = state.players[player_idx].id.as_str();
    let modifiers = &state.active_modifiers;

    match combat.phase {
        CombatPhase::RangedSiege => {
            // Single action — all non-defeated enemies are eligible targets.
            // Pool combination (ranged+siege vs siege-only) determined at resolution
            // based on whether any target is fortified.
            if has_eligible_targets(combat, CombatType::Siege, false, modifiers, player_id) {
                actions.push(LegalAction::InitiateAttack { attack_type: CombatType::Siege });
            }
        }
        CombatPhase::Attack => {
            if has_eligible_targets(combat, CombatType::Melee, false, modifiers, player_id) {
                actions.push(LegalAction::InitiateAttack { attack_type: CombatType::Melee });
            }
        }
        _ => {}
    }
}

/// Enumerate ResolveAttack when a declaration is active and attack is sufficient.
pub(super) fn enumerate_resolve_attack(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return,
    };

    let (target_ids, attack_type) = match (
        &combat.declared_attack_targets,
        combat.declared_attack_type,
    ) {
        (Some(targets), Some(at)) => (targets, at),
        _ => return,
    };

    if is_declared_attack_sufficient(state, player_idx, target_ids, attack_type) {
        actions.push(LegalAction::ResolveAttack);
    }
}

/// Check if there are eligible enemy targets for an attack type (ignores accumulator).
fn has_eligible_targets(
    combat: &CombatState,
    _attack_type: CombatType,
    exclude_fortified: bool,
    modifiers: &[mk_types::modifier::ActiveModifier],
    player_id: &str,
) -> bool {
    combat.enemies.iter().any(|enemy| {
        if enemy.is_defeated {
            return false;
        }
        if !crate::cooperative_assault::is_enemy_assigned_to_player(
            &combat.enemy_assignments,
            player_id,
            enemy.instance_id.as_str(),
        ) {
            return false;
        }
        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => return false,
        };
        if exclude_fortified
            && crate::combat_resolution::is_effectively_fortified(
                def,
                enemy.instance_id.as_str(),
                combat.is_at_fortified_site,
                modifiers,
            )
        {
            return false;
        }
        // Exclude already-declared targets (AttackTargets currently held)
        if let Some(ref declared) = combat.declared_attack_targets {
            if declared.contains(&enemy.instance_id) {
                return false;
            }
        }
        true
    })
}

/// Check if accumulated attack is sufficient to defeat the declared targets.
///
/// Reuses the same logic as `is_attack_subset_sufficient` but takes target IDs directly.
pub(crate) fn is_declared_attack_sufficient(
    state: &GameState,
    player_idx: usize,
    target_ids: &[mk_types::ids::CombatInstanceId],
    attack_type: CombatType,
) -> bool {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return false,
    };

    let accumulator = &state.players[player_idx].combat_accumulator;
    let modifiers = &state.active_modifiers;

    // Phase-based pool selection: in RangedSiege, combine ranged+siege pools
    // (ranged only if no target is fortified). In Attack phase, use normal pool.
    let mut available = if combat.phase == CombatPhase::RangedSiege {
        let siege_available = subtract_elements(
            &accumulator.attack.siege_elements,
            &accumulator.assigned_attack.siege_elements,
        );
        if any_target_fortified(combat, target_ids, modifiers) {
            // Fortified targets → siege only
            siege_available
        } else {
            // No fortified targets → combine ranged + siege
            let ranged_available = subtract_elements(
                &accumulator.attack.ranged_elements,
                &accumulator.assigned_attack.ranged_elements,
            );
            crate::combat_resolution::add_elements(&siege_available, &ranged_available)
        }
    } else {
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
        subtract_elements(total_elements, assigned_elements)
    };

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

    let mut targets: Vec<(&CombatEnemy, &mk_data::enemies::EnemyDefinition)> = Vec::new();
    for target_id in target_ids {
        let enemy = match combat.enemies.iter().find(|e| e.instance_id == *target_id) {
            Some(e) => e,
            None => return false,
        };
        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => return false,
        };
        targets.push((enemy, def));
    }

    // Combine resistances (accounting for RemoveResistances modifier)
    let combined_resistances = {
        let mut combined = Vec::new();
        for (enemy, def) in &targets {
            if crate::combat_resolution::are_resistances_removed(
                modifiers,
                enemy.instance_id.as_str(),
            ) {
                continue;
            }
            for &res in def.resistances {
                if !combined.contains(&res) {
                    combined.push(res);
                }
            }
        }
        combined
    };
    let effective_attack = calculate_effective_attack(&available, &combined_resistances);

    // Compute defend assignments
    let defend_assignments = auto_assign_defend(
        &combat.enemies,
        target_ids,
        &combat.used_defend,
        &combat.defend_bonuses,
    );

    let total_armor = compute_total_target_armor(combat, target_ids, modifiers, Some(&defend_assignments));

    effective_attack >= total_armor
}

/// Compute total effective armor for a set of declared attack targets.
///
/// Sums each target's armor (base + vampiric + defend + city bonuses + modifiers).
/// If `extra_defend` is provided, those assignments are added on top of stored defend bonuses.
pub(crate) fn compute_total_target_armor(
    combat: &CombatState,
    target_ids: &[mk_types::ids::CombatInstanceId],
    modifiers: &[mk_types::modifier::ActiveModifier],
    extra_defend: Option<&std::collections::BTreeMap<String, u32>>,
) -> u32 {
    target_ids
        .iter()
        .filter_map(|id| {
            let enemy = combat.enemies.iter().find(|e| e.instance_id == *id)?;
            let def = get_enemy(enemy.enemy_id.as_str())?;
            let vampiric = combat
                .vampiric_armor_bonus
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);
            let new_defend = extra_defend
                .and_then(|m| m.get(enemy.instance_id.as_str()).copied())
                .unwrap_or(0);
            let stored_defend = combat
                .defend_bonuses
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);
            let defend = new_defend + stored_defend;
            let enemy_city_color = effective_city_color_for_enemy(combat, enemy);
            let base = crate::combat_resolution::get_effective_armor_with_city(
                def,
                combat.phase,
                vampiric,
                defend,
                enemy_city_color,
            );
            let (armor_change, armor_min) =
                crate::combat_resolution::get_enemy_armor_modifier(
                    modifiers,
                    enemy.instance_id.as_str(),
                );
            if armor_change != 0 {
                Some((base as i32 + armor_change).max(armor_min as i32) as u32)
            } else {
                Some(base)
            }
        })
        .sum()
}

/// Compute eligible enemy instance IDs for an attack type.
///
/// Filters by cooperative assault assignments when `player_id` is provided.
pub(crate) fn eligible_attack_targets(
    combat: &CombatState,
    attack_type: CombatType,
    modifiers: &[mk_types::modifier::ActiveModifier],
    player_id: Option<&str>,
) -> Vec<mk_types::ids::CombatInstanceId> {
    let exclude_fortified = attack_type == CombatType::Ranged;
    combat
        .enemies
        .iter()
        .filter(|enemy| {
            if enemy.is_defeated {
                return false;
            }
            // Filter by cooperative assault assignments
            if let Some(pid) = player_id {
                if !crate::cooperative_assault::is_enemy_assigned_to_player(
                    &combat.enemy_assignments,
                    pid,
                    enemy.instance_id.as_str(),
                ) {
                    return false;
                }
            }
            let def = match get_enemy(enemy.enemy_id.as_str()) {
                Some(d) => d,
                None => return false,
            };
            if exclude_fortified
                && crate::combat_resolution::is_effectively_fortified(
                    def,
                    enemy.instance_id.as_str(),
                    combat.is_at_fortified_site,
                    modifiers,
                )
            {
                return false;
            }
            true
        })
        .map(|e| e.instance_id.clone())
        .collect()
}

/// Check if any of the given target enemies are effectively fortified.
///
/// Used during RangedSiege to determine whether ranged attacks can contribute:
/// if any target is fortified, only siege counts.
pub(crate) fn any_target_fortified(
    combat: &CombatState,
    target_ids: &[mk_types::ids::CombatInstanceId],
    modifiers: &[mk_types::modifier::ActiveModifier],
) -> bool {
    target_ids.iter().any(|id| {
        let enemy = match combat.enemies.iter().find(|e| e.instance_id == *id) {
            Some(e) => e,
            None => return false,
        };
        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => return false,
        };
        crate::combat_resolution::is_effectively_fortified(
            def,
            enemy.instance_id.as_str(),
            combat.is_at_fortified_site,
            modifiers,
        )
    })
}

// =============================================================================
// Damage assignment enumeration
// =============================================================================

/// Enumerate damage assignment actions for the AssignDamage phase.
///
/// Finds the first unassigned enemy attack and offers:
/// - AssignDamageToHero (always available)
/// - AssignDamageToUnit for each eligible unit (Ready or Spent, not destroyed)
///
/// Only enumerates for the FIRST unassigned attack (sequential assignment).
pub(super) fn enumerate_damage_assignments(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return,
    };

    if combat.phase != CombatPhase::AssignDamage {
        return;
    }

    let player = &state.players[player_idx];
    let player_id = player.id.as_str();

    // Find first unassigned attack (sequential)
    for (enemy_idx, enemy) in combat.enemies.iter().enumerate() {
        if enemy.is_defeated {
            continue;
        }

        // Filter by cooperative assault assignments
        if !crate::cooperative_assault::is_enemy_assigned_to_player(
            &combat.enemy_assignments,
            player_id,
            enemy.instance_id.as_str(),
        ) {
            continue;
        }

        // Skip hidden summoners (they don't deal damage)
        if enemy.is_summoner_hidden {
            continue;
        }

        // Skip enemies whose attacks are cancelled/skipped
        if crate::combat_resolution::is_enemy_attacks_skipped(
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

        for attack_idx in 0..num_attacks {
            // Skip already-assigned, blocked, or cancelled attacks
            if enemy.attacks_damage_assigned.get(attack_idx).copied().unwrap_or(true) {
                continue;
            }
            if enemy.attacks_blocked.get(attack_idx).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_cancelled.get(attack_idx).copied().unwrap_or(false) {
                continue;
            }

            // Check damage > 0 (zero-damage attacks skip assignment)
            let enemy_city_color = effective_city_color_for_enemy(combat, enemy);
            let (base_damage, _, _) = crate::combat_resolution::get_enemy_attack_info_with_city(def, attack_idx, enemy_city_color);
            if base_damage == 0 {
                continue;
            }

            // This is the next attack to assign
            // Option 1: Always can assign to hero
            actions.push(LegalAction::AssignDamageToHero {
                enemy_index: enemy_idx,
                attack_index: attack_idx,
            });

            // Option 2: Each eligible unit (if units_allowed)
            if combat.units_allowed {
                for unit in &player.units {
                    if unit.state != UnitState::Ready && unit.state != UnitState::Spent {
                        continue;
                    }
                    actions.push(LegalAction::AssignDamageToUnit {
                        enemy_index: enemy_idx,
                        attack_index: attack_idx,
                        unit_instance_id: unit.instance_id.clone(),
                    });
                }
            }

            return; // Only enumerate for the FIRST unassigned attack
        }
    }
}

/// Check if all damage has been assigned (no remaining unblocked, uncancelled, unassigned attacks).
///
/// In cooperative assault, only considers enemies assigned to the given player.
pub(super) fn all_damage_assigned(combat: &CombatState, player_id: &str, modifiers: &[mk_types::modifier::ActiveModifier]) -> bool {
    for enemy in &combat.enemies {
        if enemy.is_defeated || enemy.is_summoner_hidden {
            continue;
        }

        // Filter by cooperative assault assignments
        if !crate::cooperative_assault::is_enemy_assigned_to_player(
            &combat.enemy_assignments,
            player_id,
            enemy.instance_id.as_str(),
        ) {
            continue;
        }

        // Skip enemies whose attacks are cancelled/skipped (must match enumerate_damage_assignments)
        if crate::combat_resolution::is_enemy_attacks_skipped(
            modifiers,
            enemy.instance_id.as_str(),
        ) {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        let num_attacks = attack_count(def);
        for attack_idx in 0..num_attacks {
            if enemy.attacks_damage_assigned.get(attack_idx).copied().unwrap_or(true) {
                continue;
            }
            if enemy.attacks_blocked.get(attack_idx).copied().unwrap_or(false) {
                continue;
            }
            if enemy.attacks_cancelled.get(attack_idx).copied().unwrap_or(false) {
                continue;
            }
            let enemy_city_color = effective_city_color_for_enemy(combat, enemy);
            let (base_damage, _, _) = crate::combat_resolution::get_enemy_attack_info_with_city(def, attack_idx, enemy_city_color);
            if base_damage == 0 {
                continue;
            }
            return false; // Found an unassigned attack with damage
        }
    }
    true
}

// =============================================================================
// Move-to-Attack / Influence-to-Block conversions (Agility / Diplomacy)
// =============================================================================

/// Enumerate ConvertMoveToAttack actions during combat.
///
/// Scans active modifiers for MoveToAttackConversion. For each modifier,
/// checks the correct phase (Attack for Melee, RangedSiege for Ranged)
/// and emits one action per valid conversion amount (1..=max).
pub(super) fn enumerate_conversion_actions(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return,
    };

    let player = &state.players[player_idx];
    let player_id = &player.id;

    // Move-to-Attack conversions
    if player.move_points > 0 {
        for modifier in &state.active_modifiers {
            if modifier.created_by_player_id != *player_id {
                continue;
            }
            if let mk_types::modifier::ModifierEffect::MoveToAttackConversion {
                cost_per_point,
                attack_type,
            } = &modifier.effect
            {
                // Check correct combat phase
                let in_correct_phase = match attack_type {
                    mk_types::modifier::CombatValueType::Attack => {
                        combat.phase == CombatPhase::Attack
                    }
                    mk_types::modifier::CombatValueType::Ranged => {
                        combat.phase == CombatPhase::RangedSiege
                    }
                    _ => false,
                };
                if !in_correct_phase {
                    continue;
                }

                let max_points = player.move_points / cost_per_point;
                for amount in 1..=max_points {
                    actions.push(LegalAction::ConvertMoveToAttack {
                        move_points: amount * cost_per_point,
                        attack_type: *attack_type,
                    });
                }
            }
        }
    }

    // Influence-to-Block conversions
    if player.influence_points > 0 && combat.phase == CombatPhase::Block {
        for modifier in &state.active_modifiers {
            if modifier.created_by_player_id != *player_id {
                continue;
            }
            if let mk_types::modifier::ModifierEffect::InfluenceToBlockConversion {
                cost_per_point,
                element,
            } = &modifier.effect
            {
                let max_points = player.influence_points / cost_per_point;
                for amount in 1..=max_points {
                    actions.push(LegalAction::ConvertInfluenceToBlock {
                        influence_points: amount * cost_per_point,
                        element: *element,
                    });
                }
            }
        }
    }
}

// =============================================================================
// Heroes assault influence payment
// =============================================================================

/// Enumerate PayHeroesAssaultInfluence during fortified assault combat.
pub(super) fn enumerate_heroes_assault_payment(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return,
    };

    if !combat.is_at_fortified_site || combat.assault_origin.is_none() {
        return;
    }
    if combat.paid_heroes_assault_influence {
        return;
    }

    let player = &state.players[player_idx];
    if player.influence_points < 2 {
        return;
    }

    let has_heroes = player.units.iter().any(|u| u.unit_id.as_str() == "heroes");
    if has_heroes {
        actions.push(LegalAction::PayHeroesAssaultInfluence);
    }
}

// =============================================================================
// Thugs damage influence payment
// =============================================================================

/// Enumerate PayThugsDamageInfluence during AssignDamage phase.
pub(super) fn enumerate_thugs_damage_payment(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return,
    };

    if combat.phase != CombatPhase::AssignDamage {
        return;
    }

    let player = &state.players[player_idx];
    if player.influence_points < 2 {
        return;
    }

    for unit in &player.units {
        if unit.unit_id.as_str() != "thugs" {
            continue;
        }
        if unit.state != UnitState::Ready && unit.state != UnitState::Spent {
            continue;
        }
        let already_paid = combat
            .paid_thugs_damage_influence
            .get(unit.instance_id.as_str())
            .copied()
            .unwrap_or(false);
        if !already_paid {
            actions.push(LegalAction::PayThugsDamageInfluence {
                unit_instance_id: unit.instance_id.clone(),
            });
        }
    }
}

// =============================================================================
// Banner of Fear — cancel enemy attack in Block phase
// =============================================================================

/// Enumerate UseBannerFear actions during Block phase.
///
/// For each Ready unit with banner_of_fear attached (unused this round) ×
/// each non-defeated, non-cancelled enemy attack → emit UseBannerFear.
pub(super) fn enumerate_banner_fear(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return,
    };

    if combat.phase != CombatPhase::Block {
        return;
    }

    let player = &state.players[player_idx];
    let player_id = player.id.as_str();

    // Collect eligible units (Ready, banner_of_fear attached, unused this round)
    let eligible_units: Vec<_> = player
        .attached_banners
        .iter()
        .filter(|b| b.banner_id.as_str() == "banner_of_fear" && !b.is_used_this_round)
        .filter(|b| {
            player
                .units
                .iter()
                .any(|u| u.instance_id == b.unit_instance_id && u.state == UnitState::Ready)
        })
        .collect();

    if eligible_units.is_empty() {
        return;
    }

    for banner in &eligible_units {
        for enemy in &combat.enemies {
            if enemy.is_defeated {
                continue;
            }

            // Filter by cooperative assault assignments
            if !crate::cooperative_assault::is_enemy_assigned_to_player(
                &combat.enemy_assignments,
                player_id,
                enemy.instance_id.as_str(),
            ) {
                continue;
            }

            let def = match get_enemy(enemy.enemy_id.as_str()) {
                Some(d) => d,
                None => continue,
            };

            // Skip Arcane Immune enemies
            if has_ability(def, EnemyAbilityType::ArcaneImmunity) {
                continue;
            }

            let num_attacks = attack_count(def);
            for attack_index in 0..num_attacks {
                // Skip already-blocked or cancelled attacks
                if enemy
                    .attacks_blocked
                    .get(attack_index)
                    .copied()
                    .unwrap_or(false)
                {
                    continue;
                }
                if enemy
                    .attacks_cancelled
                    .get(attack_index)
                    .copied()
                    .unwrap_or(false)
                {
                    continue;
                }

                actions.push(LegalAction::UseBannerFear {
                    unit_instance_id: banner.unit_instance_id.clone(),
                    enemy_instance_id: enemy.instance_id.clone(),
                    attack_index,
                });
            }
        }
    }
}