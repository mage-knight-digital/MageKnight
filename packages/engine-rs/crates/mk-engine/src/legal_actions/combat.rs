//! Combat-specific legal action enumeration: block and attack declarations.

use mk_data::enemies::{attack_count, get_enemy};
use mk_types::enums::*;
use mk_types::legal_action::LegalAction;
use mk_types::state::*;

use crate::combat_resolution::{
    auto_assign_defend, calculate_effective_attack, calculate_effective_block, combine_resistances,
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

/// Enumerate DeclareAttack actions for RangedSiege and Attack phases.
///
/// For each non-empty subset of undefeated enemies (max ~4 enemies → 15 subsets):
/// - Get available attack elements (total - assigned) for each attack type
/// - Check if effective attack meets combined armor
/// - If yes, emit a DeclareAttack action
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

    match combat.phase {
        CombatPhase::RangedSiege => {
            // Ranged attacks: cannot target Fortified enemies
            enumerate_attack_type(
                combat,
                &player.combat_accumulator,
                CombatType::Ranged,
                true, // exclude fortified
                actions,
            );
            // Siege attacks: can target all enemies
            enumerate_attack_type(
                combat,
                &player.combat_accumulator,
                CombatType::Siege,
                false,
                actions,
            );
        }
        CombatPhase::Attack => {
            // Melee attacks: can target all enemies (Elusive armor used)
            enumerate_attack_type(
                combat,
                &player.combat_accumulator,
                CombatType::Melee,
                false,
                actions,
            );
        }
        _ => {}
    }
}

fn enumerate_attack_type(
    combat: &CombatState,
    accumulator: &CombatAccumulator,
    attack_type: CombatType,
    exclude_fortified: bool,
    actions: &mut Vec<LegalAction>,
) {
    let phase = combat.phase;

    // Get available attack elements for this type
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
        return;
    }

    // Collect eligible (undefeated) enemies
    let mut eligible: Vec<(usize, &CombatEnemy, &mk_data::enemies::EnemyDefinition)> = Vec::new();
    for (idx, enemy) in combat.enemies.iter().enumerate() {
        if enemy.is_defeated {
            continue;
        }

        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        if exclude_fortified && has_ability(def, EnemyAbilityType::Fortified) {
            continue;
        }

        eligible.push((idx, enemy, def));
    }

    if eligible.is_empty() {
        return;
    }

    // Enumerate non-empty subsets (bit-mask over eligible enemies)
    let n = eligible.len();
    for mask in 1..(1u32 << n) {
        let mut targets: Vec<(&CombatEnemy, &mk_data::enemies::EnemyDefinition)> = Vec::new();
        let mut target_ids: Vec<mk_types::ids::CombatInstanceId> = Vec::new();

        for (bit, &(_, enemy, def)) in eligible.iter().enumerate() {
            if mask & (1 << bit) != 0 {
                targets.push((enemy, def));
                target_ids.push(enemy.instance_id.clone());
            }
        }

        // Calculate if attack is sufficient (including vampiric + defend bonuses)
        let defs: Vec<&mk_data::enemies::EnemyDefinition> =
            targets.iter().map(|(_, def)| *def).collect();
        let combined_resistances = combine_resistances(&defs);
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
                get_effective_armor(def, phase, vampiric, defend)
            })
            .sum();

        if effective_attack >= total_armor {
            // Sort target IDs for determinism
            target_ids.sort();

            actions.push(LegalAction::DeclareAttack {
                target_instance_ids: target_ids,
                attack_type,
            });
        }
    }
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
            LegalAction::DeclareAttack {
                target_instance_ids,
                attack_type: CombatType::Melee,
            } if target_instance_ids.len() == 1
        ));
    }

    #[test]
    fn attack_not_enumerated_when_insufficient() {
        let mut state = setup_combat_game(&["prowlers"]); // armor 3
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
            physical: 2,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

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
            .filter(|a| matches!(a, LegalAction::DeclareAttack { attack_type: CombatType::Ranged, .. }))
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
            .filter(|a| matches!(a, LegalAction::DeclareAttack { attack_type: CombatType::Siege, .. }))
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
