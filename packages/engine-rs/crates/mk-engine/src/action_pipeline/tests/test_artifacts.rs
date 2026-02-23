use super::*;

// =========================================================================
// Soul Harvester — crystal resolution tests
// =========================================================================

#[test]
fn soul_harvester_basic_grants_one_crystal() {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;

    let mut state = setup_combat_game(&["prowlers"]);
    let pid = state.players[0].id.clone();

    // Add SoulHarvesterCrystalTracking modifier (basic: limit 1)
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("sh_1"),
        source: ModifierSource::Card {
            card_id: CardId::from("soul_harvester"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::SoulHarvesterCrystalTracking {
            limit: 1,
            track_by_attack: false,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    // Simulate defeating 1 non-summoned enemy
    resolve_soul_harvester_crystals(&mut state, 0, &[false]);

    // Should have gained 1 crystal (Red, first non-max color)
    assert_eq!(state.players[0].crystals.red, 1);
}

#[test]
fn soul_harvester_basic_limits_to_one_even_with_multiple_defeats() {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;

    let mut state = setup_combat_game(&["prowlers", "diggers"]);
    let pid = state.players[0].id.clone();

    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("sh_1"),
        source: ModifierSource::Card {
            card_id: CardId::from("soul_harvester"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::SoulHarvesterCrystalTracking {
            limit: 1,
            track_by_attack: false,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    // 2 non-summoned enemies defeated
    resolve_soul_harvester_crystals(&mut state, 0, &[false, false]);

    // Only 1 crystal granted (basic limit)
    let total_crystals = state.players[0].crystals.red
        + state.players[0].crystals.blue
        + state.players[0].crystals.green
        + state.players[0].crystals.white;
    assert_eq!(total_crystals, 1);
}

#[test]
fn soul_harvester_powered_grants_one_per_defeat() {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;

    let mut state = setup_combat_game(&["prowlers", "diggers", "prowlers"]);
    let pid = state.players[0].id.clone();

    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("sh_p"),
        source: ModifierSource::Card {
            card_id: CardId::from("soul_harvester"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::SoulHarvesterCrystalTracking {
            limit: 99, // powered: unlimited
            track_by_attack: false,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    // 3 non-summoned enemies
    resolve_soul_harvester_crystals(&mut state, 0, &[false, false, false]);

    let total_crystals = state.players[0].crystals.red
        + state.players[0].crystals.blue
        + state.players[0].crystals.green
        + state.players[0].crystals.white;
    assert_eq!(total_crystals, 3);
}

#[test]
fn soul_harvester_excludes_summoned_enemies() {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;

    let mut state = setup_combat_game(&["prowlers", "diggers"]);
    let pid = state.players[0].id.clone();

    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("sh_s"),
        source: ModifierSource::Card {
            card_id: CardId::from("soul_harvester"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::SoulHarvesterCrystalTracking {
            limit: 99,
            track_by_attack: false,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    // First is non-summoned, second IS summoned
    resolve_soul_harvester_crystals(&mut state, 0, &[false, true]);

    let total_crystals = state.players[0].crystals.red
        + state.players[0].crystals.blue
        + state.players[0].crystals.green
        + state.players[0].crystals.white;
    // Only 1 crystal (summoned enemy excluded)
    assert_eq!(total_crystals, 1);
}

#[test]
fn soul_harvester_no_modifier_does_nothing() {
    let mut state = setup_combat_game(&["prowlers"]);
    // No modifier added
    resolve_soul_harvester_crystals(&mut state, 0, &[false]);

    let total = state.players[0].crystals.red
        + state.players[0].crystals.blue
        + state.players[0].crystals.green
        + state.players[0].crystals.white;
    assert_eq!(total, 0);
}

#[test]
fn soul_harvester_crystal_overflow_cycles_colors() {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;

    let mut state = setup_combat_game(&["prowlers"]);
    let pid = state.players[0].id.clone();

    // Max out red crystals
    state.players[0].crystals.red = 3;

    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("sh_o"),
        source: ModifierSource::Card {
            card_id: CardId::from("soul_harvester"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::SoulHarvesterCrystalTracking {
            limit: 1,
            track_by_attack: false,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    resolve_soul_harvester_crystals(&mut state, 0, &[false]);

    // Red is maxed, so should get blue instead
    assert_eq!(state.players[0].crystals.red, 3); // still 3
    assert_eq!(state.players[0].crystals.blue, 1); // overflow to blue
}

#[test]
fn soul_harvester_decrements_limit() {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;

    let mut state = setup_combat_game(&["prowlers"]);
    let pid = state.players[0].id.clone();

    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("sh_d"),
        source: ModifierSource::Card {
            card_id: CardId::from("soul_harvester"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::SoulHarvesterCrystalTracking {
            limit: 3,
            track_by_attack: false,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    resolve_soul_harvester_crystals(&mut state, 0, &[false, false]);

    // Limit should be decremented from 3 to 1 (2 consumed)
    let remaining = state.active_modifiers.iter().find_map(|m| {
        if let ModifierEffect::SoulHarvesterCrystalTracking { limit, .. } = &m.effect {
            Some(*limit)
        } else {
            None
        }
    });
    assert_eq!(remaining, Some(1));
}

// =========================================================================
// Combat Hook: DoublePhysicalAttacks (Sword of Justice powered)
// =========================================================================

fn add_double_physical_modifier(state: &mut GameState, player_idx: usize) {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    let pid = state.players[player_idx].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("double_phys"),
        source: ModifierSource::Card {
            card_id: CardId::from("sword_of_justice"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::DoublePhysicalAttacks,
        created_at_round: 1,
        created_by_player_id: pid,
    });
}

#[test]
fn double_physical_doubles_melee_physical_attack() {
    let mut state = setup_combat_game(&["prowlers"]); // armor 3
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    add_double_physical_modifier(&mut state, 0);

    // Set 3 physical attack — with doubling becomes 6, enough to defeat prowlers (armor 3)
    state.players[0].combat_accumulator.attack.normal = 3;
    state.players[0].combat_accumulator.attack.normal_elements.physical = 3;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    assert!(state.combat.as_ref().unwrap().enemies[0].is_defeated);
}

#[test]
fn double_physical_does_not_double_elemental_attack() {
    let mut state = setup_combat_game(&["prowlers"]); // armor 3
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    add_double_physical_modifier(&mut state, 0);

    // Only fire attack (2), doubled only affects physical
    state.players[0].combat_accumulator.attack.normal = 2;
    state.players[0].combat_accumulator.attack.normal_elements.fire = 2;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    // 2 fire (not doubled) vs 3 armor → not defeated
    assert!(!state.combat.as_ref().unwrap().enemies[0].is_defeated);
}

#[test]
fn double_physical_works_with_ranged() {
    let mut state = setup_combat_game(&["prowlers"]); // armor 3
    // RangedSiege phase for ranged attacks
    state.players[0].combat_accumulator.attack.ranged = 2;
    state.players[0].combat_accumulator.attack.ranged_elements.physical = 2;
    add_double_physical_modifier(&mut state, 0);

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Ranged, 1);

    // 2 physical * 2 = 4 vs 3 armor → defeated
    assert!(state.combat.as_ref().unwrap().enemies[0].is_defeated);
}

#[test]
fn double_physical_without_modifier_no_doubling() {
    let mut state = setup_combat_game(&["prowlers"]); // armor 3
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    // No modifier! 2 physical → stays 2

    state.players[0].combat_accumulator.attack.normal = 2;
    state.players[0].combat_accumulator.attack.normal_elements.physical = 2;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    // 2 < 3 armor → not defeated
    assert!(!state.combat.as_ref().unwrap().enemies[0].is_defeated);
}

// =========================================================================
// Combat Hook: BowPhaseFameTracking (Bow of Starsdawn powered)
// =========================================================================

fn add_bow_phase_fame_modifier(state: &mut GameState, player_idx: usize, fame_per: u32) {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    let pid = state.players[player_idx].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("bow_fame"),
        source: ModifierSource::Card {
            card_id: CardId::from("bow_of_starsdawn"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::BowPhaseFameTracking { fame_per_enemy: fame_per },
        created_at_round: 1,
        created_by_player_id: pid,
    });
}

#[test]
fn bow_phase_fame_awards_on_ranged_siege_transition() {
    let mut state = setup_combat_game(&["prowlers"]); // armor 3
    // RangedSiege phase — defeat with ranged
    add_bow_phase_fame_modifier(&mut state, 0, 2);

    state.players[0].combat_accumulator.attack.ranged = 10;
    state.players[0].combat_accumulator.attack.ranged_elements.physical = 10;
    state.players[0].fame = 0;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Ranged, 1);

    let fame_before_transition = state.players[0].fame;
    // End RangedSiege phase → Block
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    // Bow phase fame: 2 per enemy * 1 defeat = 2 extra
    assert_eq!(state.players[0].fame, fame_before_transition + 2);
}

#[test]
fn bow_phase_fame_zero_defeats_no_bonus() {
    let mut state = setup_combat_game(&["prowlers"]);
    add_bow_phase_fame_modifier(&mut state, 0, 2);
    state.players[0].fame = 0;

    // No defeats — just transition
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    // No defeat → no bonus fame
    assert_eq!(state.players[0].fame, 0);
}

#[test]
fn bow_phase_fame_multiple_defeats() {
    let mut state = setup_combat_game(&["prowlers", "prowlers"]);
    add_bow_phase_fame_modifier(&mut state, 0, 1);

    state.players[0].combat_accumulator.attack.ranged = 20;
    state.players[0].combat_accumulator.attack.ranged_elements.physical = 20;
    state.players[0].fame = 0;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Ranged, 2);

    let fame_before = state.players[0].fame;
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    // 1 fame * 2 defeats = 2 bonus
    assert_eq!(state.players[0].fame, fame_before + 2);
}

// =========================================================================
// Cross-system: Combat modifier stacking
// =========================================================================

fn add_soul_harvester_modifier(state: &mut GameState, player_idx: usize, limit: u32) {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    let pid = state.players[player_idx].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("sh_stack"),
        source: ModifierSource::Card {
            card_id: CardId::from("soul_harvester"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::SoulHarvesterCrystalTracking {
            limit,
            track_by_attack: false,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });
}

/// DoublePhysicalAttacks + FamePerEnemyDefeated both fire on the same attack.
#[test]
fn double_physical_and_fame_per_enemy_stack() {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;

    let mut state = setup_combat_game(&["prowlers"]); // armor 3, fame 2
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // Both modifiers active
    add_double_physical_modifier(&mut state, 0);
    let pid = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("fame_bonus"),
        source: ModifierSource::Card {
            card_id: CardId::from("banner_of_glory"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::AllUnits,
        effect: ModifierEffect::FamePerEnemyDefeated {
            fame_per_enemy: 1,
            exclude_summoned: false,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    // 3 physical → doubled to 6, defeats prowlers (armor 3)
    state.players[0].combat_accumulator.attack.normal = 3;
    state.players[0].combat_accumulator.attack.normal_elements.physical = 3;
    state.players[0].fame = 0;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    assert!(state.combat.as_ref().unwrap().enemies[0].is_defeated);
    // Base fame (prowlers=2) + bonus (1 per enemy) = 3
    assert_eq!(state.players[0].fame, 3);
}

/// SoulHarvesterCrystalTracking + FamePerEnemyDefeated both fire on defeat.
#[test]
fn soul_harvester_and_fame_per_enemy_both_fire() {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;

    let mut state = setup_combat_game(&["prowlers"]); // armor 3
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // Both hooks active
    add_soul_harvester_modifier(&mut state, 0, 1);
    let pid = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("fame_bonus_2"),
        source: ModifierSource::Card {
            card_id: CardId::from("banner_of_glory"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::AllUnits,
        effect: ModifierEffect::FamePerEnemyDefeated {
            fame_per_enemy: 1,
            exclude_summoned: false,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    state.players[0].combat_accumulator.attack.normal = 10;
    state.players[0].combat_accumulator.attack.normal_elements.physical = 10;
    state.players[0].fame = 0;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    // Fame: base(2) + bonus(1) = 3
    assert_eq!(state.players[0].fame, 3);
    // Crystal: 1 crystal from soul harvester
    let total_crystals = state.players[0].crystals.red
        + state.players[0].crystals.blue
        + state.players[0].crystals.green
        + state.players[0].crystals.white;
    assert_eq!(total_crystals, 1, "Soul harvester should grant 1 crystal");
}

/// Combat-duration modifiers are removed after end_combat.
#[test]
fn combat_modifiers_expire_after_end_combat() {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;

    let mut state = setup_combat_game(&["prowlers"]);
    let pid = state.players[0].id.clone();

    // Push two Combat-duration modifiers
    add_double_physical_modifier(&mut state, 0);
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("fame_combat"),
        source: ModifierSource::Card {
            card_id: CardId::from("banner_of_glory"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::AllUnits,
        effect: ModifierEffect::FamePerEnemyDefeated {
            fame_per_enemy: 1,
            exclude_summoned: false,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    assert_eq!(
        state.active_modifiers.iter()
            .filter(|m| m.duration == ModifierDuration::Combat)
            .count(),
        2,
        "Should have 2 combat modifiers before end_combat"
    );

    // End combat by cycling through all phases:
    // RangedSiege → Block → AssignDamage → Attack → end
    let mut undo = UndoStack::new();
    // Phase 1: RangedSiege → Block
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    // Phase 2: Block → AssignDamage
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    // Phase 3: AssignDamage → Attack (takes damage as wounds)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    // Phase 4: Attack → end combat
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    // Both combat-duration modifiers should be expired
    assert_eq!(
        state.active_modifiers.iter()
            .filter(|m| m.duration == ModifierDuration::Combat)
            .count(),
        0,
        "Combat modifiers should be expired after end_combat"
    );
}

/// BowPhaseFameTracking fires at RangedSiege→Block transition,
/// before combat end would expire it.
#[test]
fn bow_phase_fame_fires_before_combat_modifier_expiry() {
    let mut state = setup_combat_game(&["prowlers"]); // armor 3
    add_bow_phase_fame_modifier(&mut state, 0, 2);

    // Defeat in RangedSiege
    state.players[0].combat_accumulator.attack.ranged = 10;
    state.players[0].combat_accumulator.attack.ranged_elements.physical = 10;
    state.players[0].fame = 0;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Ranged, 1);

    // Confirm modifier exists before transition
    assert!(
        state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::BowPhaseFameTracking { .. })
        ),
        "BowPhaseFameTracking should exist before phase transition"
    );

    let fame_before = state.players[0].fame;

    // Transition RangedSiege→Block (triggers bow phase fame)
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    // Bow phase fame awarded at transition: 2 * 1 defeat = 2
    assert_eq!(state.players[0].fame, fame_before + 2);

    // Modifier still exists (it's Combat duration, persists until combat ends)
    assert!(
        state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::BowPhaseFameTracking { .. })
        ),
        "BowPhaseFameTracking should persist through phase transitions (Combat duration)"
    );
}

