//! Combat-specific legal action enumeration: block and attack declarations.

use mk_data::enemies::{attack_count, get_enemy};
use mk_types::enums::*;
use mk_types::legal_action::LegalAction;
use mk_types::state::*;

use crate::combat_resolution::{
    auto_assign_defend, calculate_effective_attack, calculate_effective_block,
    get_effective_armor, get_enemy_attack_info, has_ability, subtract_elements,
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

    for enemy in &combat.enemies {
        if enemy.is_defeated {
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

            let (damage, attack_element, is_swift) = get_enemy_attack_info(def, attack_index);

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

    for enemy in &combat.enemies {
        if enemy.is_defeated {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        if !has_ability(def, EnemyAbilityType::Cumbersome) {
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
            let (damage, _, _) = get_enemy_attack_info(def, attack_index);
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
/// For each attack type with available attack and eligible enemies, emit a single
/// `InitiateAttack { attack_type }` action. The player then picks targets one at a
/// time via SubsetSelection.
pub(super) fn enumerate_attack_declarations(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return,
    };

    let player = &state.players[player_idx];
    let modifiers = &state.active_modifiers;

    match combat.phase {
        CombatPhase::RangedSiege => {
            if has_available_attack_and_targets(combat, &player.combat_accumulator, CombatType::Ranged, true, modifiers) {
                actions.push(LegalAction::InitiateAttack { attack_type: CombatType::Ranged });
            }
            if has_available_attack_and_targets(combat, &player.combat_accumulator, CombatType::Siege, false, modifiers) {
                actions.push(LegalAction::InitiateAttack { attack_type: CombatType::Siege });
            }
        }
        CombatPhase::Attack => {
            if has_available_attack_and_targets(combat, &player.combat_accumulator, CombatType::Melee, false, modifiers) {
                actions.push(LegalAction::InitiateAttack { attack_type: CombatType::Melee });
            }
        }
        _ => {}
    }
}

/// Check if there is available attack of the given type AND eligible enemies to target.
fn has_available_attack_and_targets(
    combat: &CombatState,
    accumulator: &CombatAccumulator,
    attack_type: CombatType,
    exclude_fortified: bool,
    modifiers: &[mk_types::modifier::ActiveModifier],
) -> bool {
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

    let available = subtract_elements(total_elements, assigned_elements);
    if available.total() == 0 {
        return false;
    }

    // At least one eligible (undefeated, non-fortified-if-ranged) enemy
    combat.enemies.iter().any(|enemy| {
        if enemy.is_defeated {
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
        true
    })
}

/// Compute eligible enemy instance IDs for an attack type.
pub(crate) fn eligible_attack_targets(
    combat: &CombatState,
    attack_type: CombatType,
    modifiers: &[mk_types::modifier::ActiveModifier],
) -> Vec<mk_types::ids::CombatInstanceId> {
    let exclude_fortified = attack_type == CombatType::Ranged;
    combat
        .enemies
        .iter()
        .filter(|enemy| {
            if enemy.is_defeated {
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
            true
        })
        .map(|e| e.instance_id.clone())
        .collect()
}

/// Check if the currently selected subset of enemies can be defeated with available attack.
///
/// Used by pending.rs to gate SubsetConfirm for AttackTargets.
pub(crate) fn is_attack_subset_sufficient(
    state: &GameState,
    player_idx: usize,
    ss: &mk_types::pending::SubsetSelectionState,
    eligible_instance_ids: &[mk_types::ids::CombatInstanceId],
    attack_type: CombatType,
) -> bool {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return false,
    };

    let accumulator = &state.players[player_idx].combat_accumulator;
    let modifiers = &state.active_modifiers;

    // Get available attack for this type
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

    let available = subtract_elements(total_elements, assigned_elements);

    // Resolve selected pool indices → actual instance IDs
    let mut target_ids: Vec<mk_types::ids::CombatInstanceId> = Vec::new();
    let mut targets: Vec<(&CombatEnemy, &mk_data::enemies::EnemyDefinition)> = Vec::new();

    for &pool_idx in ss.selected.iter() {
        let instance_id = match eligible_instance_ids.get(pool_idx) {
            Some(id) => id,
            None => return false,
        };
        let enemy = match combat.enemies.iter().find(|e| e.instance_id == *instance_id) {
            Some(e) => e,
            None => return false,
        };
        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => return false,
        };
        target_ids.push(instance_id.clone());
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

    // Compute defend assignments for this target subset
    let defend_assignments = auto_assign_defend(
        &combat.enemies,
        &target_ids,
        &combat.used_defend,
    );

    let total_armor: u32 = targets
        .iter()
        .map(|(enemy, def)| {
            let vampiric = combat
                .vampiric_armor_bonus
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);
            let defend = defend_assignments
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);
            let base = get_effective_armor(def, combat.phase, vampiric, defend);
            let (armor_change, armor_min) =
                crate::combat_resolution::get_enemy_armor_modifier(
                    modifiers,
                    enemy.instance_id.as_str(),
                );
            if armor_change != 0 {
                (base as i32 + armor_change).max(armor_min as i32) as u32
            } else {
                base
            }
        })
        .sum();

    effective_attack >= total_armor
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

    // Find first unassigned attack (sequential)
    for (enemy_idx, enemy) in combat.enemies.iter().enumerate() {
        if enemy.is_defeated {
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
            let (base_damage, _, _) = crate::combat_resolution::get_enemy_attack_info(def, attack_idx);
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
pub(super) fn all_damage_assigned(combat: &CombatState) -> bool {
    for enemy in &combat.enemies {
        if enemy.is_defeated || enemy.is_summoner_hidden {
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
            let (base_damage, _, _) = crate::combat_resolution::get_enemy_attack_info(def, attack_idx);
            if base_damage == 0 {
                continue;
            }
            return false; // Found an unassigned attack with damage
        }
    }
    true
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::create_solo_game;
    use mk_types::ids::*;

    fn setup_combat_game(enemy_ids: &[&str]) -> GameState {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.round_phase = RoundPhase::PlayerTurns;

        let tokens: Vec<EnemyTokenId> = enemy_ids
            .iter()
            .map(|id| EnemyTokenId::from(format!("{}_1", id)))
            .collect();

        crate::combat::execute_enter_combat(&mut state, 0, &tokens, false, None, Default::default())
            .unwrap();

        state
    }

    // ---- Block enumeration ----

    #[test]
    fn block_enumerated_when_sufficient() {
        let mut state = setup_combat_game(&["prowlers"]); // 4 physical attack
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 5,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let mut actions = Vec::new();
        enumerate_block_declarations(&state, 0, &mut actions);

        assert_eq!(actions.len(), 1);
        assert!(matches!(
            &actions[0],
            LegalAction::DeclareBlock {
                enemy_instance_id,
                attack_index: 0,
            } if enemy_instance_id.as_str() == "enemy_0"
        ));
    }

    #[test]
    fn block_not_enumerated_when_insufficient() {
        let mut state = setup_combat_game(&["prowlers"]); // 4 physical
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 3,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let mut actions = Vec::new();
        enumerate_block_declarations(&state, 0, &mut actions);

        assert!(actions.is_empty());
    }

    #[test]
    fn block_not_enumerated_for_already_blocked() {
        let mut state = setup_combat_game(&["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.combat.as_mut().unwrap().enemies[0].attacks_blocked[0] = true;
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 10,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let mut actions = Vec::new();
        enumerate_block_declarations(&state, 0, &mut actions);

        assert!(actions.is_empty());
    }

    #[test]
    fn block_not_enumerated_outside_block_phase() {
        let mut state = setup_combat_game(&["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 10,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let mut actions = Vec::new();
        enumerate_block_declarations(&state, 0, &mut actions);

        assert!(actions.is_empty());
    }

    // ---- Attack enumeration ----

    #[test]
    fn attack_enumerated_for_feasible_targets() {
        let mut state = setup_combat_game(&["prowlers"]); // armor 3
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
            physical: 5,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let mut actions = Vec::new();
        enumerate_attack_declarations(&state, 0, &mut actions);

        assert_eq!(actions.len(), 1);
        assert!(matches!(
            &actions[0],
            LegalAction::InitiateAttack {
                attack_type: CombatType::Melee,
            }
        ));
    }

    #[test]
    fn attack_not_enumerated_when_no_attack() {
        let mut state = setup_combat_game(&["prowlers"]); // armor 3
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        // No attack accumulated (all zeros)

        let mut actions = Vec::new();
        enumerate_attack_declarations(&state, 0, &mut actions);

        assert!(actions.is_empty());
    }

    #[test]
    fn fortified_excluded_from_ranged() {
        let mut state = setup_combat_game(&["diggers"]); // Fortified, armor 3
        // RangedSiege phase
        state.players[0].combat_accumulator.attack.ranged_elements = ElementalValues {
            physical: 10,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let mut actions = Vec::new();
        enumerate_attack_declarations(&state, 0, &mut actions);

        // Should have no Ranged actions (Fortified excluded) but Siege actions should work
        let ranged = actions
            .iter()
            .filter(|a| matches!(a, LegalAction::InitiateAttack { attack_type: CombatType::Ranged }))
            .count();
        assert_eq!(ranged, 0, "Fortified enemy should not be targetable by ranged");
    }

    #[test]
    fn fortified_allowed_for_siege() {
        let mut state = setup_combat_game(&["diggers"]); // Fortified, armor 3
        state.players[0].combat_accumulator.attack.siege_elements = ElementalValues {
            physical: 10,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let mut actions = Vec::new();
        enumerate_attack_declarations(&state, 0, &mut actions);

        let siege = actions
            .iter()
            .filter(|a| matches!(a, LegalAction::InitiateAttack { attack_type: CombatType::Siege }))
            .count();
        assert!(siege > 0, "Fortified enemy should be targetable by siege");
    }

    // ---- Cumbersome enumeration ----

    #[test]
    fn cumbersome_enumerated_in_block_phase_with_move_points() {
        // Orc Stonethrowers: Cumbersome, 7 physical attack
        let mut state = setup_combat_game(&["orc_stonethrowers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].move_points = 2;

        let mut actions = Vec::new();
        enumerate_cumbersome_actions(&state, 0, &mut actions);

        assert_eq!(actions.len(), 1);
        assert!(matches!(
            &actions[0],
            LegalAction::SpendMoveOnCumbersome { enemy_instance_id }
            if enemy_instance_id.as_str() == "enemy_0"
        ));
    }

    #[test]
    fn cumbersome_not_enumerated_without_move_points() {
        let mut state = setup_combat_game(&["orc_stonethrowers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].move_points = 0;

        let mut actions = Vec::new();
        enumerate_cumbersome_actions(&state, 0, &mut actions);

        assert!(actions.is_empty());
    }

    #[test]
    fn cumbersome_not_enumerated_outside_block_phase() {
        let mut state = setup_combat_game(&["orc_stonethrowers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;
        state.players[0].move_points = 2;

        let mut actions = Vec::new();
        enumerate_cumbersome_actions(&state, 0, &mut actions);

        assert!(actions.is_empty());
    }

    #[test]
    fn cumbersome_not_enumerated_when_fully_reduced() {
        // Orc Stonethrowers: 7 attack, already reduced by 7
        let mut state = setup_combat_game(&["orc_stonethrowers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].move_points = 2;
        state.combat.as_mut().unwrap().cumbersome_reductions
            .insert("enemy_0".to_string(), 7);

        let mut actions = Vec::new();
        enumerate_cumbersome_actions(&state, 0, &mut actions);

        assert!(actions.is_empty(), "Cannot reduce beyond total attack damage");
    }

    #[test]
    fn cumbersome_not_enumerated_for_non_cumbersome() {
        // Prowlers: no Cumbersome
        let mut state = setup_combat_game(&["prowlers"]);
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        state.players[0].move_points = 2;

        let mut actions = Vec::new();
        enumerate_cumbersome_actions(&state, 0, &mut actions);

        assert!(actions.is_empty());
    }
}
