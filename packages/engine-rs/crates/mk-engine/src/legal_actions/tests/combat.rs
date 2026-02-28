use super::*;
use crate::legal_actions::combat::{
    enumerate_attack_declarations, enumerate_block_declarations, enumerate_cumbersome_actions,
    enumerate_resolve_attack,
};

// =========================================================================
// Combat
// =========================================================================

#[test]
fn combat_emits_combat_actions() {
    let mut state = setup_game(vec!["march", "swift_bolt"]);
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

    // swift_bolt should be playable (ranged attack)
    let swift_bolt_basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "swift_bolt"),
    );
    assert!(swift_bolt_basic, "swift_bolt basic should be playable in combat (ranged attack)");

    // RangedSiege: neither sideways Attack nor Block should be available.
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
// Melee card filtering in RangedSiege phase
// =========================================================================

#[test]
fn blood_rage_not_playable_in_ranged_siege() {
    let mut state = setup_game(vec!["blood_rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "blood_rage"),
    );
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "blood_rage"),
    );
    assert!(!basic, "blood_rage basic (all-melee Choice) should not be playable in RangedSiege");
    assert!(!powered, "blood_rage powered (all-melee Choice) should not be playable in RangedSiege");
}

#[test]
fn counterattack_not_playable_in_ranged_siege() {
    let mut state = setup_game(vec!["counterattack"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "counterattack"),
    );
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "counterattack"),
    );
    assert!(!basic, "counterattack basic (Scaling melee) should not be playable in RangedSiege");
    assert!(!powered, "counterattack powered (Scaling melee) should not be playable in RangedSiege");
}

#[test]
fn chivalry_not_playable_in_ranged_siege() {
    let mut state = setup_game(vec!["chivalry"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "chivalry"),
    );
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "chivalry"),
    );
    assert!(!basic, "chivalry basic (all-melee Choice) should not be playable in RangedSiege");
    assert!(!powered, "chivalry powered (all-melee Choice) should not be playable in RangedSiege");
}

#[test]
fn rage_basic_not_playable_in_ranged_siege() {
    // rage basic is Choice(Melee | Block) — both options dominated in RangedSiege
    let mut state = setup_game(vec!["rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "rage"),
    );
    assert!(!basic, "rage basic (Choice(Melee|Block)) should not be playable in RangedSiege — both options dominated");
}

#[test]
fn rage_powered_not_playable_in_ranged_siege() {
    // rage powered is GainAttack{Melee 4} — pure melee, should be filtered
    let mut state = setup_game(vec!["rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "rage"),
    );
    assert!(!powered, "rage powered (pure melee) should not be playable in RangedSiege");
}

#[test]
fn melee_cards_playable_in_ranged_siege_with_altem_mages_modifier() {
    use mk_types::modifier::{ActiveModifier, ModifierDuration, ModifierScope, ModifierSource};
    use mk_types::ids::ModifierId;

    let mut state = setup_game(vec!["blood_rage"]);
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
    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "blood_rage"),
    );
    assert!(basic, "blood_rage should be playable in RangedSiege with TransformAttacksColdFire modifier");
}

#[test]
fn melee_cards_playable_in_attack_phase() {
    let mut state = setup_game(vec!["blood_rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Attack,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "blood_rage"),
    );
    assert!(basic, "blood_rage should be playable in Attack phase");
}

#[test]
fn move_card_not_playable_in_ranged_siege() {
    let mut state = setup_game(vec!["stamina"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "stamina"),
    );
    assert!(!basic, "stamina (GainMove) should not be playable in RangedSiege");
}

#[test]
fn influence_card_not_playable_in_ranged_siege() {
    let mut state = setup_game(vec!["threaten"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "threaten"),
    );
    assert!(!basic, "threaten (GainInfluence) should not be playable in RangedSiege");
}

#[test]
fn block_card_not_playable_in_ranged_siege() {
    // determination basic = Choice(Melee|Block) — both dominated
    let mut state = setup_game(vec!["determination"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "determination"),
    );
    assert!(!basic, "determination basic (Choice(Melee|Block)) should not be playable in RangedSiege");
}

#[test]
fn improvisation_not_playable_in_ranged_siege() {
    // improvisation basic = Choice(Move|Influence|Melee|Block) — all dominated
    let mut state = setup_game(vec!["improvisation"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "improvisation"),
    );
    assert!(!basic, "improvisation basic (all 4 options dominated) should not be playable in RangedSiege");
}

#[test]
fn ranged_card_playable_in_ranged_siege() {
    let mut state = setup_game(vec!["swift_bolt"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "swift_bolt"),
    );
    assert!(basic, "swift_bolt (ranged attack) should be playable in RangedSiege");
}

#[test]
fn mana_card_playable_in_ranged_siege() {
    let mut state = setup_game(vec!["concentration"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "concentration"),
    );
    assert!(basic, "concentration (mana gain) should be playable in RangedSiege");
}

#[test]
fn move_playable_with_move_in_combat_rule() {
    use mk_types::modifier::{ActiveModifier, ModifierDuration, ModifierScope, ModifierSource};
    use mk_types::ids::ModifierId;

    let mut state = setup_game(vec!["stamina"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let player_id = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("test_mod"),
        source: ModifierSource::Card {
            card_id: CardId::from("agility"),
            player_id: player_id.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::RuleOverride { rule: mk_types::modifier::RuleOverride::MoveCardsInCombat },
        created_at_round: 1,
        created_by_player_id: player_id,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "stamina"),
    );
    assert!(basic, "stamina should be playable in RangedSiege with MoveCardsInCombat rule active");
}

#[test]
fn influence_playable_with_influence_in_combat_rule() {
    use mk_types::modifier::{ActiveModifier, ModifierDuration, ModifierScope, ModifierSource};
    use mk_types::ids::ModifierId;

    let mut state = setup_game(vec!["threaten"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let player_id = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("test_mod"),
        source: ModifierSource::Card {
            card_id: CardId::from("diplomacy"),
            player_id: player_id.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::RuleOverride { rule: mk_types::modifier::RuleOverride::InfluenceCardsInCombat },
        created_at_round: 1,
        created_by_player_id: player_id,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "threaten"),
    );
    assert!(basic, "threaten should be playable in RangedSiege with InfluenceCardsInCombat rule active");
}

#[test]
fn tranquility_not_playable_in_ranged_siege() {
    // tranquility basic = Choice(GainHealing | DrawCards) — healing icon means
    // the card is not playable in any combat phase (MK rules).
    let mut state = setup_game(vec!["tranquility", "wound"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "tranquility"),
    );
    assert!(!basic, "tranquility should not be playable in RangedSiege (healing card)");
}

#[test]
fn tranquility_not_playable_in_attack_phase() {
    // Healing cards are not playable in any combat phase, including Attack.
    let mut state = setup_game(vec!["tranquility", "wound"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Attack,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "tranquility"),
    );
    assert!(!basic, "tranquility should not be playable in Attack phase (healing card)");
}

#[test]
fn tranquility_not_playable_in_block_phase() {
    let mut state = setup_game(vec!["tranquility", "wound"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Block,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "tranquility"),
    );
    assert!(!basic, "tranquility should not be playable in Block phase (healing card)");
}

// =========================================================================
// Card filtering in Block phase
// =========================================================================

#[test]
fn attack_card_not_playable_in_block_phase() {
    // swift_bolt powered = GainAttack{Ranged} — attack useless in Block
    let mut state = setup_game(vec!["swift_bolt"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Block,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    // swift_bolt basic = GainCrystal(White) — useful, should be playable
    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "swift_bolt"),
    );
    assert!(basic, "swift_bolt basic (GainCrystal) should be playable in Block phase");

    // swift_bolt powered = GainAttack{Ranged} — useless in Block
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "swift_bolt"),
    );
    assert!(!powered, "swift_bolt powered (ranged attack) should not be playable in Block phase");
}

#[test]
fn blood_rage_not_playable_in_block_phase() {
    // blood_rage: both basic options are melee attack — useless in Block
    let mut state = setup_game(vec!["blood_rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Block,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "blood_rage"),
    );
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "blood_rage"),
    );
    assert!(!basic, "blood_rage basic (all-melee) should not be playable in Block phase");
    assert!(!powered, "blood_rage powered (melee) should not be playable in Block phase");
}

#[test]
fn rage_basic_playable_in_block_phase() {
    // rage basic = Choice(Melee|Block) — block option IS useful in Block phase
    let mut state = setup_game(vec!["rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Block,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "rage"),
    );
    assert!(basic, "rage basic (Choice(Melee|Block)) should be playable in Block — block option is useful");
}

#[test]
fn rage_powered_not_playable_in_block_phase() {
    // rage powered = GainAttack{Melee 4} — pure melee attack, useless in Block
    let mut state = setup_game(vec!["rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Block,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "rage"),
    );
    assert!(!powered, "rage powered (pure melee) should not be playable in Block phase");
}

#[test]
fn block_card_playable_in_block_phase() {
    // determination powered = GainBlock(3, Physical) — useful in Block
    let mut state = setup_game(vec!["determination"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Blue,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Block,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "determination"),
    );
    assert!(powered, "determination powered (GainBlock) should be playable in Block phase");
}

#[test]
fn mana_card_playable_in_block_phase() {
    let mut state = setup_game(vec!["concentration"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Block,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "concentration"),
    );
    assert!(basic, "concentration (mana gain) should be playable in Block phase");
}

#[test]
fn move_card_not_playable_in_block_without_cumbersome() {
    // No cumbersome enemies → move has no value in Block phase
    let mut state = setup_game(vec!["stamina"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Block,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "stamina"),
    );
    assert!(!basic, "stamina (GainMove) should not be playable in Block without cumbersome enemies");
}

#[test]
fn move_card_playable_in_block_with_cumbersome() {
    // Cumbersome enemies present → move IS useful (spend on cumbersome)
    let mut state = setup_combat_game(&["orc_stonethrowers"]); // Cumbersome enemy
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].hand.push(CardId::from("stamina"));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "stamina"),
    );
    assert!(basic, "stamina (GainMove) should be playable in Block with cumbersome enemies");
}

#[test]
fn influence_not_playable_in_block_without_diplomacy() {
    let mut state = setup_game(vec!["threaten"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Block,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "threaten"),
    );
    assert!(!basic, "threaten (GainInfluence) should not be playable in Block without Diplomacy");
}

#[test]
fn influence_playable_in_block_with_diplomacy() {
    use mk_types::modifier::{ActiveModifier, ModifierDuration, ModifierScope, ModifierSource};
    use mk_types::ids::ModifierId;

    let mut state = setup_game(vec!["threaten"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Block,
        ..CombatState::default()
    }));
    let player_id = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("test_mod"),
        source: ModifierSource::Card {
            card_id: CardId::from("diplomacy"),
            player_id: player_id.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::RuleOverride { rule: mk_types::modifier::RuleOverride::InfluenceCardsInCombat },
        created_at_round: 1,
        created_by_player_id: player_id,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "threaten"),
    );
    assert!(basic, "threaten should be playable in Block with InfluenceCardsInCombat (Diplomacy) active");
}

#[test]
fn counterattack_not_playable_in_block_phase() {
    // counterattack basic = Scaling(PerEnemyBlocked, base=GainAttack{Melee})
    // Even though it scales by blocked enemies, the base effect is attack — not useful in Block
    let mut state = setup_game(vec!["counterattack"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Block,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "counterattack"),
    );
    assert!(!basic, "counterattack (Scaling melee attack) should not be playable in Block phase");
}

// =========================================================================
// Card filtering in Attack phase
// =========================================================================

#[test]
fn influence_not_playable_in_attack_phase() {
    let mut state = setup_game(vec!["threaten"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Attack,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "threaten"),
    );
    assert!(!basic, "threaten (GainInfluence) should not be playable in Attack phase");
}

#[test]
fn block_card_not_playable_in_attack_phase() {
    // determination powered = GainBlock — useless in Attack
    let mut state = setup_game(vec!["determination"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Blue,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Attack,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "determination"),
    );
    assert!(!powered, "determination powered (GainBlock) should not be playable in Attack phase");
}

#[test]
fn move_card_not_playable_in_attack_phase() {
    let mut state = setup_game(vec!["stamina"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Attack,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "stamina"),
    );
    assert!(!basic, "stamina (GainMove) should not be playable in Attack phase");
}

#[test]
fn attack_card_playable_in_attack_phase() {
    let mut state = setup_game(vec!["blood_rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Attack,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "blood_rage"),
    );
    assert!(basic, "blood_rage (melee attack) should be playable in Attack phase");
}

#[test]
fn influence_not_playable_in_attack_even_with_diplomacy() {
    // Diplomacy = influence as block. Irrelevant in Attack phase.
    use mk_types::modifier::{ActiveModifier, ModifierDuration, ModifierScope, ModifierSource};
    use mk_types::ids::ModifierId;

    let mut state = setup_game(vec!["threaten"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Attack,
        ..CombatState::default()
    }));
    let player_id = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("test_mod"),
        source: ModifierSource::Card {
            card_id: CardId::from("diplomacy"),
            player_id: player_id.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::RuleOverride { rule: mk_types::modifier::RuleOverride::InfluenceCardsInCombat },
        created_at_round: 1,
        created_by_player_id: player_id,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "threaten"),
    );
    assert!(!basic, "threaten should NOT be playable in Attack even with Diplomacy (influence as block is Block phase only)");
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
fn initiate_attack_available_without_accumulated_attack() {
    let mut state = setup_combat_game(&["prowlers"]); // armor 3
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    // No attack accumulated (all zeros) — InitiateAttack should still appear (declare-first flow)

    let mut actions = Vec::new();
    enumerate_attack_declarations(&state, 0, &mut actions);

    assert!(
        !actions.is_empty(),
        "InitiateAttack should be available even without accumulated attack"
    );
}

#[test]
fn resolve_attack_not_available_without_sufficient_attack() {
    let mut state = setup_combat_game(&["prowlers"]); // armor 3
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    // Declare targets but don't accumulate enough attack
    let combat = state.combat.as_mut().unwrap();
    combat.declared_attack_targets = Some(vec![combat.enemies[0].instance_id.clone()]);
    combat.declared_attack_type = Some(CombatType::Melee);

    let mut actions = Vec::new();
    enumerate_resolve_attack(&state, 0, &mut actions);

    assert!(
        actions.is_empty(),
        "ResolveAttack should not be available when attack is insufficient"
    );
}

#[test]
fn rangedsiege_emits_single_initiate_attack() {
    // In RangedSiege, only one InitiateAttack (Siege) should be emitted
    // regardless of whether enemies are fortified.
    let mut state = setup_combat_game(&["prowlers"]); // non-fortified
    state.players[0].combat_accumulator.attack.ranged_elements = ElementalValues {
        physical: 10,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };

    let mut actions = Vec::new();
    enumerate_attack_declarations(&state, 0, &mut actions);

    assert_eq!(actions.len(), 1, "RangedSiege should emit exactly one InitiateAttack");
    assert!(matches!(
        &actions[0],
        LegalAction::InitiateAttack { attack_type: CombatType::Siege }
    ));
}

#[test]
fn rangedsiege_fortified_emits_single_initiate_attack() {
    let state = setup_combat_game(&["diggers"]); // Fortified, armor 3

    let mut actions = Vec::new();
    enumerate_attack_declarations(&state, 0, &mut actions);

    assert_eq!(actions.len(), 1, "RangedSiege should emit exactly one InitiateAttack for fortified enemies");
    assert!(matches!(
        &actions[0],
        LegalAction::InitiateAttack { attack_type: CombatType::Siege }
    ));
}

// ---- Combined ranged+siege pool tests ----

#[test]
fn rangedsiege_combined_pools_sufficient() {
    // Prowlers: armor 3. 2 siege + 2 ranged = 4 total → sufficient
    let mut state = setup_combat_game(&["prowlers"]);
    state.players[0].combat_accumulator.attack.siege_elements = ElementalValues {
        physical: 2,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };
    state.players[0].combat_accumulator.attack.ranged_elements = ElementalValues {
        physical: 2,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };

    // Declare targets
    let combat = state.combat.as_mut().unwrap();
    let target_id = combat.enemies[0].instance_id.clone();
    combat.declared_attack_targets = Some(vec![target_id.clone()]);
    combat.declared_attack_type = Some(CombatType::Siege);

    let mut actions = Vec::new();
    enumerate_resolve_attack(&state, 0, &mut actions);

    assert_eq!(actions.len(), 1, "Combined ranged+siege (4) should be sufficient vs armor 3");
}

#[test]
fn rangedsiege_siege_only_when_fortified() {
    // Diggers: Fortified, armor 3. 2 siege + 10 ranged → only 2 siege counts → insufficient
    let mut state = setup_combat_game(&["diggers"]);
    state.players[0].combat_accumulator.attack.siege_elements = ElementalValues {
        physical: 2,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };
    state.players[0].combat_accumulator.attack.ranged_elements = ElementalValues {
        physical: 10,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };

    // Declare targets
    let combat = state.combat.as_mut().unwrap();
    let target_id = combat.enemies[0].instance_id.clone();
    combat.declared_attack_targets = Some(vec![target_id.clone()]);
    combat.declared_attack_type = Some(CombatType::Siege);

    let mut actions = Vec::new();
    enumerate_resolve_attack(&state, 0, &mut actions);

    assert!(actions.is_empty(), "Only siege (2) should count vs fortified armor 3 — ranged wasted");
}

#[test]
fn rangedsiege_siege_sufficient_when_fortified() {
    // Diggers: Fortified, armor 3. 5 siege → sufficient even with fortification
    let mut state = setup_combat_game(&["diggers"]);
    state.players[0].combat_accumulator.attack.siege_elements = ElementalValues {
        physical: 5,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };

    // Declare targets
    let combat = state.combat.as_mut().unwrap();
    let target_id = combat.enemies[0].instance_id.clone();
    combat.declared_attack_targets = Some(vec![target_id.clone()]);
    combat.declared_attack_type = Some(CombatType::Siege);

    let mut actions = Vec::new();
    enumerate_resolve_attack(&state, 0, &mut actions);

    assert_eq!(actions.len(), 1, "Siege (5) should be sufficient vs fortified armor 3");
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
