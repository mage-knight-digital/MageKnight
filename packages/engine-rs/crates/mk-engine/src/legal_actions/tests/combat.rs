use super::*;
use crate::legal_actions::combat::{
    enumerate_attack_declarations, enumerate_block_declarations, enumerate_cumbersome_actions,
};

// =========================================================================
// Combat
// =========================================================================

#[test]
fn combat_emits_combat_actions() {
    let mut state = setup_game(vec!["march", "rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    // Should have card plays + EndCombatPhase
    let has_end_phase = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::EndCombatPhase));
    assert!(has_end_phase, "EndCombatPhase should be present in combat");

    // Rage should have basic in combat (GainAttack is resolvable)
    let rage_basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "rage"),
    );
    assert!(rage_basic, "rage basic should be playable in combat");

    // RangedSiege: neither sideways Attack nor Block should be available.
    // Sideways Attack produces melee points which can't be used until the Attack phase,
    // so offering it here just bloats the action space with no tactical value.
    let attack_sideways = legal.actions.iter().any(|a| {
        matches!(
            a,
            LegalAction::PlayCardSideways {
                sideways_as: SidewaysAs::Attack,
                ..
            }
        )
    });
    let block_sideways = legal.actions.iter().any(|a| {
        matches!(
            a,
            LegalAction::PlayCardSideways {
                sideways_as: SidewaysAs::Block,
                ..
            }
        )
    });
    assert!(!attack_sideways, "RangedSiege should NOT have Attack sideways (melee points unusable)");
    assert!(!block_sideways, "RangedSiege should NOT have Block sideways");
}

#[test]
fn wound_not_playable_basic_in_combat() {
    let mut state = setup_game(vec!["wound"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let wound_basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "wound"),
    );
    assert!(
        !wound_basic,
        "wound should not be playable as basic in combat"
    );
}

#[test]
fn wound_not_playable_basic_outside_combat() {
    let state = setup_game(vec!["wound"]);
    let legal = enumerate_legal_actions(&state, 0);

    let wound_basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "wound"),
    );
    assert!(
        !wound_basic,
        "wound should not be playable as basic outside combat"
    );
}

// =========================================================================
// Banner assignment enumeration
// =========================================================================

#[test]
fn assign_banner_enumerated_when_banner_in_hand_and_unit_present() {
    use mk_types::ids::UnitInstanceId;

    let mut state = setup_game(vec!["banner_of_courage"]);
    state.players[0].units.push(PlayerUnit {
        instance_id: UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let assign_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::AssignBanner { .. })).count();
    assert_eq!(assign_count, 1, "Should have 1 AssignBanner action for 1 banner × 1 unit");
}

#[test]
fn assign_banner_not_enumerated_without_units() {
    let state = setup_game(vec!["banner_of_courage"]);
    // No units
    let legal = enumerate_legal_actions(&state, 0);
    let assign_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::AssignBanner { .. })).count();
    assert_eq!(assign_count, 0);
}

#[test]
fn assign_banner_not_enumerated_for_non_banner_cards() {
    use mk_types::ids::UnitInstanceId;

    let mut state = setup_game(vec!["march"]);
    state.players[0].units.push(PlayerUnit {
        instance_id: UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let assign_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::AssignBanner { .. })).count();
    assert_eq!(assign_count, 0, "march is not a banner card");
}

#[test]
fn assign_banner_multiple_units_get_multiple_actions() {
    use mk_types::ids::UnitInstanceId;

    let mut state = setup_game(vec!["banner_of_courage"]);
    for i in 0..3 {
        state.players[0].units.push(PlayerUnit {
            instance_id: UnitInstanceId::from(format!("unit_{}", i).as_str()),
            unit_id: mk_types::ids::UnitId::from("peasants"),
            level: 1,
            state: UnitState::Ready,
            wounded: false,
            used_resistance_this_combat: false,
            used_ability_indices: vec![],
            mana_token: None,
        });
    }

    let legal = enumerate_legal_actions(&state, 0);
    let assign_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::AssignBanner { .. })).count();
    assert_eq!(assign_count, 3, "1 banner × 3 units = 3 AssignBanner actions");
}

#[test]
fn assign_banner_already_attached_skipped() {
    use mk_types::ids::UnitInstanceId;
    use mk_types::state::BannerAttachment;

    let mut state = setup_game(vec!["banner_of_courage"]);
    state.players[0].units.push(PlayerUnit {
        instance_id: UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    // Already attached
    state.players[0].attached_banners.push(BannerAttachment {
        banner_id: CardId::from("banner_of_courage"),
        unit_instance_id: UnitInstanceId::from("unit_0"),
        is_used_this_round: false,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let assign_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::AssignBanner { .. })).count();
    assert_eq!(assign_count, 0, "Banner already attached to this unit — no duplicate");
}

// =========================================================================
// Banner of Courage enumeration
// =========================================================================

#[test]
fn banner_courage_enumerated_for_spent_unit() {
    use mk_types::ids::UnitInstanceId;
    use mk_types::state::BannerAttachment;

    let mut state = setup_game(vec!["march"]); // some card so turn is valid
    state.players[0].units.push(PlayerUnit {
        instance_id: UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Spent,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    state.players[0].attached_banners.push(BannerAttachment {
        banner_id: CardId::from("banner_of_courage"),
        unit_instance_id: UnitInstanceId::from("unit_0"),
        is_used_this_round: false,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let courage_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::UseBannerCourage { .. })).count();
    assert_eq!(courage_count, 1);
}

#[test]
fn banner_courage_not_enumerated_for_ready_unit() {
    use mk_types::ids::UnitInstanceId;
    use mk_types::state::BannerAttachment;

    let mut state = setup_game(vec!["march"]);
    state.players[0].units.push(PlayerUnit {
        instance_id: UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready, // Already ready
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    state.players[0].attached_banners.push(BannerAttachment {
        banner_id: CardId::from("banner_of_courage"),
        unit_instance_id: UnitInstanceId::from("unit_0"),
        is_used_this_round: false,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let courage_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::UseBannerCourage { .. })).count();
    assert_eq!(courage_count, 0, "Unit is already ready, courage not needed");
}

#[test]
fn banner_courage_not_enumerated_when_used_this_round() {
    use mk_types::ids::UnitInstanceId;
    use mk_types::state::BannerAttachment;

    let mut state = setup_game(vec!["march"]);
    state.players[0].units.push(PlayerUnit {
        instance_id: UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Spent,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    state.players[0].attached_banners.push(BannerAttachment {
        banner_id: CardId::from("banner_of_courage"),
        unit_instance_id: UnitInstanceId::from("unit_0"),
        is_used_this_round: true, // Already used
    });

    let legal = enumerate_legal_actions(&state, 0);
    let courage_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::UseBannerCourage { .. })).count();
    assert_eq!(courage_count, 0, "Banner already used this round");
}

// =========================================================================
// Banner of Fear enumeration in combat
// =========================================================================

#[test]
fn banner_fear_arcane_immune_enemies_excluded() {
    use mk_types::ids::UnitInstanceId;
    use mk_types::state::BannerAttachment;

    // Sorcerers have ArcaneImmunity
    let mut state = setup_fear_combat(&["sorcerers"]);

    state.players[0].units.push(PlayerUnit {
        instance_id: UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    state.players[0].attached_banners.push(BannerAttachment {
        banner_id: CardId::from("banner_of_fear"),
        unit_instance_id: UnitInstanceId::from("unit_0"),
        is_used_this_round: false,
    });
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions(&state, 0);
    let fear_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::UseBannerFear { .. })).count();
    assert_eq!(fear_count, 0, "Arcane Immune enemies cannot be targeted by Banner of Fear");
}

#[test]
fn banner_fear_spent_unit_not_eligible() {
    use mk_types::ids::UnitInstanceId;
    use mk_types::state::BannerAttachment;

    let mut state = setup_fear_combat(&["prowlers"]);

    state.players[0].units.push(PlayerUnit {
        instance_id: UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Spent, // Spent!
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    state.players[0].attached_banners.push(BannerAttachment {
        banner_id: CardId::from("banner_of_fear"),
        unit_instance_id: UnitInstanceId::from("unit_0"),
        is_used_this_round: false,
    });
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions(&state, 0);
    let fear_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::UseBannerFear { .. })).count();
    assert_eq!(fear_count, 0, "Spent unit cannot use Banner of Fear");
}

#[test]
fn banner_fear_defeated_enemy_not_targetable() {
    use mk_types::ids::UnitInstanceId;
    use mk_types::state::BannerAttachment;

    let mut state = setup_fear_combat(&["prowlers"]);

    state.players[0].units.push(PlayerUnit {
        instance_id: UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    state.players[0].attached_banners.push(BannerAttachment {
        banner_id: CardId::from("banner_of_fear"),
        unit_instance_id: UnitInstanceId::from("unit_0"),
        is_used_this_round: false,
    });
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    // Mark enemy as defeated
    state.combat.as_mut().unwrap().enemies[0].is_defeated = true;

    let legal = enumerate_legal_actions(&state, 0);
    let fear_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::UseBannerFear { .. })).count();
    assert_eq!(fear_count, 0, "Defeated enemy cannot be targeted by fear");
}

#[test]
fn banner_fear_already_cancelled_attack_excluded() {
    use mk_types::ids::UnitInstanceId;
    use mk_types::state::BannerAttachment;

    let mut state = setup_fear_combat(&["prowlers"]);

    state.players[0].units.push(PlayerUnit {
        instance_id: UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    state.players[0].attached_banners.push(BannerAttachment {
        banner_id: CardId::from("banner_of_fear"),
        unit_instance_id: UnitInstanceId::from("unit_0"),
        is_used_this_round: false,
    });
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    // Mark attack as already cancelled
    state.combat.as_mut().unwrap().enemies[0].attacks_cancelled[0] = true;

    let legal = enumerate_legal_actions(&state, 0);
    let fear_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::UseBannerFear { .. })).count();
    assert_eq!(fear_count, 0, "Already cancelled attack cannot be targeted");
}

#[test]
fn banner_fear_multiple_units_multiple_enemies() {
    use mk_types::ids::UnitInstanceId;
    use mk_types::state::BannerAttachment;

    let mut state = setup_fear_combat(&["prowlers", "diggers"]);

    for i in 0..2 {
        state.players[0].units.push(PlayerUnit {
            instance_id: UnitInstanceId::from(format!("unit_{}", i).as_str()),
            unit_id: mk_types::ids::UnitId::from("peasants"),
            level: 1,
            state: UnitState::Ready,
            wounded: false,
            used_resistance_this_combat: false,
            used_ability_indices: vec![],
            mana_token: None,
        });
        state.players[0].attached_banners.push(BannerAttachment {
            banner_id: CardId::from("banner_of_fear"),
            unit_instance_id: UnitInstanceId::from(format!("unit_{}", i).as_str()),
            is_used_this_round: false,
        });
    }
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions(&state, 0);
    let fear_count = legal.actions.iter().filter(|a| matches!(a, LegalAction::UseBannerFear { .. })).count();
    // 2 units × 2 enemies × 1 attack each = 4
    assert_eq!(fear_count, 4, "2 units × 2 enemies = 4 UseBannerFear actions");
}

// =========================================================================
// Sideways masking with modifiers
// =========================================================================

#[test]
fn no_sideways_attack_in_rangedsiege_by_default() {
    let mut state = setup_game(vec!["rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);
    let has_sideways_atk = legal.actions.iter().any(|a| matches!(a,
        LegalAction::PlayCardSideways { sideways_as: SidewaysAs::Attack, .. }
    ));
    assert!(!has_sideways_atk, "No sideways Attack in RangedSiege without modifier");
}

#[test]
fn sideways_attack_in_rangedsiege_with_coldfire_modifier() {
    use mk_types::modifier::{ActiveModifier, ModifierDuration, ModifierScope, ModifierSource};
    use mk_types::ids::ModifierId;
    let mut state = setup_game(vec!["rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let player_id = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("test_mod"),
        source: ModifierSource::Card {
            card_id: CardId::from("altem_mages"),
            player_id: player_id.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::TransformAttacksColdFire,
        created_at_round: 1,
        created_by_player_id: player_id,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let has_sideways_atk = legal.actions.iter().any(|a| matches!(a,
        LegalAction::PlayCardSideways { sideways_as: SidewaysAs::Attack, .. }
    ));
    assert!(has_sideways_atk, "Sideways Attack should be available in RangedSiege with ColdFire modifier");
}

#[test]
fn sideways_attack_in_rangedsiege_with_siege_modifier() {
    use mk_types::modifier::{ActiveModifier, ModifierDuration, ModifierScope, ModifierSource};
    use mk_types::ids::ModifierId;
    let mut state = setup_game(vec!["rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let player_id = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("test_mod"),
        source: ModifierSource::Card {
            card_id: CardId::from("altem_mages"),
            player_id: player_id.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::AddSiegeToAttacks,
        created_at_round: 1,
        created_by_player_id: player_id,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let has_sideways_atk = legal.actions.iter().any(|a| matches!(a,
        LegalAction::PlayCardSideways { sideways_as: SidewaysAs::Attack, .. }
    ));
    assert!(has_sideways_atk, "Sideways Attack should be available in RangedSiege with Siege modifier");
}

// =========================================================================
// Block declarations (from combat.rs inline tests)
// =========================================================================

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
