use super::*;

// =========================================================================
// Step 2: UnitCombatBonus tests
// =========================================================================

fn setup_combat_with_unit_and_bonus(
    enemy_ids: &[&str],
    attack_bonus: i32,
    block_bonus: i32,
) -> (GameState, UndoStack) {
    use mk_types::modifier::*;
    use mk_types::ids::{ModifierId, UnitInstanceId};

    let mut state = setup_combat_game(enemy_ids);
    let undo = UndoStack::new();
    let pid = state.players[0].id.clone();

    // Add a peasants unit (Attack 2 Physical, Block 2 Physical)
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

    // Add UnitCombatBonus modifier
    if attack_bonus != 0 || block_bonus != 0 {
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("ucb_1"),
            source: ModifierSource::Card {
                card_id: CardId::from("banner_of_glory"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::AllUnits,
            effect: ModifierEffect::UnitCombatBonus {
                attack_bonus,
                block_bonus,
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });
    }

    (state, undo)
}

#[test]
fn unit_combat_bonus_adds_to_attack() {
    let (mut state, mut undo) = setup_combat_with_unit_and_bonus(&["prowlers"], 2, 0);
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 0, // Attack 2 Physical
        },
        epoch,
    )
    .unwrap();
    // Attack should be 2 (base) + 2 (bonus) = 4
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 4);
}

#[test]
fn unit_combat_bonus_adds_to_block() {
    let (mut state, mut undo) = setup_combat_with_unit_and_bonus(&["prowlers"], 0, 3);
    // Move to Block phase
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 1, // Block 2 Physical
        },
        epoch,
    )
    .unwrap();
    // Block should be 2 (base) + 3 (bonus) = 5
    assert_eq!(state.players[0].combat_accumulator.block, 5);
}

#[test]
fn unit_combat_bonus_no_modifier_baseline() {
    let (mut state, mut undo) = setup_combat_with_unit_and_bonus(&["prowlers"], 0, 0);
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 0, // Attack 2 Physical
        },
        epoch,
    )
    .unwrap();
    // Just base value, no bonus
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
}

// =========================================================================
// Step 5: Banner assignment tests
// =========================================================================

fn setup_game_with_banner_and_unit() -> (GameState, UndoStack) {
    use mk_types::ids::UnitInstanceId;

    let mut state = setup_playing_game(vec!["banner_of_courage"]);
    let undo = UndoStack::new();

    // Add a unit
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

    (state, undo)
}

#[test]
fn assign_banner_moves_card_and_creates_attachment() {
    let (mut state, mut undo) = setup_game_with_banner_and_unit();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::AssignBanner {
            hand_index: 0,
            card_id: CardId::from("banner_of_courage"),
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
        },
        epoch,
    )
    .unwrap();

    // Card removed from hand
    assert!(state.players[0].hand.is_empty());
    // Card added to play area
    assert_eq!(state.players[0].play_area.len(), 1);
    assert_eq!(state.players[0].play_area[0].as_str(), "banner_of_courage");
    // Banner attachment created
    assert_eq!(state.players[0].attached_banners.len(), 1);
    assert_eq!(
        state.players[0].attached_banners[0].banner_id.as_str(),
        "banner_of_courage"
    );
    assert_eq!(
        state.players[0].attached_banners[0]
            .unit_instance_id
            .as_str(),
        "unit_0"
    );
    assert!(!state.players[0].attached_banners[0].is_used_this_round);
}

#[test]
fn assign_banner_is_free_action() {
    let (mut state, mut undo) = setup_game_with_banner_and_unit();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::AssignBanner {
            hand_index: 0,
            card_id: CardId::from("banner_of_courage"),
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
        },
        epoch,
    )
    .unwrap();

    // HAS_TAKEN_ACTION_THIS_TURN should NOT be set
    assert!(!state.players[0]
        .flags
        .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
}

// =========================================================================
// Step 6: Banner of Courage tests
// =========================================================================

#[test]
fn banner_courage_readies_spent_unit() {
    let (mut state, mut undo) = setup_game_with_banner_and_unit();
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");

    // Manually attach banner and make unit spent
    state.players[0]
        .attached_banners
        .push(BannerAttachment {
            banner_id: CardId::from("banner_of_courage"),
            unit_instance_id: unit_iid.clone(),
            is_used_this_round: false,
        });
    state.players[0].units[0].state = UnitState::Spent;
    state.players[0].hand.clear(); // remove banner from hand

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::UseBannerCourage {
            unit_instance_id: unit_iid.clone(),
        },
        epoch,
    )
    .unwrap();

    // Unit readied
    assert_eq!(state.players[0].units[0].state, UnitState::Ready);
    // Banner marked as used
    assert!(state.players[0].attached_banners[0].is_used_this_round);
}

#[test]
fn banner_courage_cannot_use_twice() {
    let (mut state, _undo) = setup_game_with_banner_and_unit();
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");

    // Attach banner already used
    state.players[0]
        .attached_banners
        .push(BannerAttachment {
            banner_id: CardId::from("banner_of_courage"),
            unit_instance_id: unit_iid.clone(),
            is_used_this_round: true, // already used
        });
    state.players[0].units[0].state = UnitState::Spent;
    state.players[0].hand.clear();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    let result = apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::UseBannerCourage {
            unit_instance_id: unit_iid,
        },
        epoch,
    );
    assert!(result.is_err());
}

// =========================================================================
// Step 7: Banner of Fortitude tests
// =========================================================================

#[test]
fn fortitude_negates_unit_wound() {
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let mut state = setup_combat_game(&["prowlers"]);

    // Add unit
    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });

    // Attach Banner of Fortitude
    state.players[0]
        .attached_banners
        .push(BannerAttachment {
            banner_id: CardId::from("banner_of_fortitude"),
            unit_instance_id: unit_iid.clone(),
            is_used_this_round: false,
        });

    // Try to negate wound
    let negated = try_negate_wound_with_fortitude(&mut state, 0, &unit_iid);
    assert!(negated);
    assert!(state.players[0].attached_banners[0].is_used_this_round);
}

#[test]
fn fortitude_only_negates_once() {
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let mut state = setup_combat_game(&["prowlers"]);

    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });

    state.players[0]
        .attached_banners
        .push(BannerAttachment {
            banner_id: CardId::from("banner_of_fortitude"),
            unit_instance_id: unit_iid.clone(),
            is_used_this_round: false,
        });

    // First negate succeeds
    assert!(try_negate_wound_with_fortitude(&mut state, 0, &unit_iid));
    // Second negate fails
    assert!(!try_negate_wound_with_fortitude(&mut state, 0, &unit_iid));
}

#[test]
fn fortitude_no_banner_no_negate() {
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let mut state = setup_combat_game(&["prowlers"]);

    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });

    let negated = try_negate_wound_with_fortitude(&mut state, 0, &unit_iid);
    assert!(!negated);
}

// =========================================================================
// Step 8: Banner of Fear tests
// =========================================================================

#[test]
fn banner_fear_cancels_attack_and_grants_fame() {
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let enemy_iid = CombatInstanceId::from("enemy_0");
    let mut state = setup_combat_game(&["prowlers"]);
    let mut undo = UndoStack::new();

    // Add unit
    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });

    // Attach Banner of Fear
    state.players[0]
        .attached_banners
        .push(BannerAttachment {
            banner_id: CardId::from("banner_of_fear"),
            unit_instance_id: unit_iid.clone(),
            is_used_this_round: false,
        });

    // Set to Block phase
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let initial_fame = state.players[0].fame;
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::UseBannerFear {
            unit_instance_id: unit_iid.clone(),
            enemy_instance_id: enemy_iid.clone(),
            attack_index: 0,
        },
        epoch,
    )
    .unwrap();

    // Unit becomes spent
    assert_eq!(state.players[0].units[0].state, UnitState::Spent);
    // Banner marked as used
    assert!(state.players[0].attached_banners[0].is_used_this_round);
    // Enemy attack cancelled
    assert!(state.combat.as_ref().unwrap().enemies[0].attacks_cancelled[0]);
    // +1 fame
    assert_eq!(state.players[0].fame, initial_fame + 1);
}

// =========================================================================
// Banner of Glory — comprehensive behavioral tests
// =========================================================================

/// Helper: setup combat with a unit and banner of glory UnitCombatBonus modifier.
fn setup_glory_combat(attack_bonus: i32, block_bonus: i32) -> (GameState, UndoStack) {
    setup_combat_with_unit_and_bonus(&["prowlers"], attack_bonus, block_bonus)
}

#[test]
fn glory_attack_bonus_stacks_with_base() {
    // Banner of Glory powered gives +1/+1 to all units.
    // Peasants have Attack 2 Physical → with +1 bonus → 3 total.
    let (mut state, mut undo) = setup_glory_combat(1, 1);
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 0,
        },
        epoch,
    ).unwrap();
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 3);
}

#[test]
fn glory_block_bonus_stacks_with_base() {
    // Peasants Block 2 Physical → with +1 bonus → 3 total.
    let (mut state, mut undo) = setup_glory_combat(0, 1);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 1,
        },
        epoch,
    ).unwrap();
    assert_eq!(state.players[0].combat_accumulator.block, 3);
}

#[test]
fn glory_both_attack_and_block_bonus() {
    // +2 attack, +3 block stacks.
    let (mut state, mut undo) = setup_combat_with_unit_and_bonus(&["prowlers"], 2, 3);

    // Activate attack first
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 0,
        },
        epoch,
    ).unwrap();
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 4); // 2+2
}

#[test]
fn glory_multiple_modifiers_stack() {
    // Two separate UnitCombatBonus modifiers should stack.
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    let (mut state, mut undo) = setup_glory_combat(1, 0);
    let pid = state.players[0].id.clone();

    // Add a second bonus
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("ucb_2"),
        source: ModifierSource::Card {
            card_id: CardId::from("into_the_heat"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Turn,
        scope: ModifierScope::AllUnits,
        effect: ModifierEffect::UnitCombatBonus {
            attack_bonus: 2,
            block_bonus: 0,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 0,
        },
        epoch,
    ).unwrap();
    // 2 (base) + 1 (first) + 2 (second) = 5
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 5);
}

#[test]
fn glory_bonus_applies_to_ranged_attack() {
    // UnitCombatBonus also applies to RangedAttack and SiegeAttack.
    // Utem Crossbowmen: Attack 3P, Block 3P, Ranged 2P (ability indices 0,1,2).
    use mk_types::modifier::*;
    use mk_types::ids::{ModifierId, UnitInstanceId};

    let mut state = setup_combat_game(&["prowlers"]);
    let mut undo = UndoStack::new();
    let pid = state.players[0].id.clone();

    state.players[0].units.push(PlayerUnit {
        instance_id: UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("utem_crossbowmen"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });

    // Add +2 attack bonus
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("ucb_r"),
        source: ModifierSource::Card {
            card_id: CardId::from("banner_of_glory"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Turn,
        scope: ModifierScope::AllUnits,
        effect: ModifierEffect::UnitCombatBonus {
            attack_bonus: 2,
            block_bonus: 0,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ActivateUnit {
            unit_instance_id: UnitInstanceId::from("unit_0"),
            ability_index: 2, // Ranged 2 Physical
        },
        epoch,
    ).unwrap();
    // 2 (base ranged) + 2 (bonus) = 4
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 4);
}

#[test]
fn glory_negative_bonus_floors_at_zero() {
    // If bonus is negative, attack/block shouldn't go below 0.
    let (mut state, mut undo) = setup_combat_with_unit_and_bonus(&["prowlers"], -10, 0);
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 0,
        },
        epoch,
    ).unwrap();
    // 2 - 10 = -8, clamped to 0
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 0);
}

#[test]
fn glory_unit_block_bonus_adds_to_block_not_attack() {
    // UnitBlockBonus modifier should add to block only, not attack.
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;

    let mut state = setup_combat_game(&["prowlers"]);
    let mut undo = UndoStack::new();
    let pid = state.players[0].id.clone();

    state.players[0].units.push(PlayerUnit {
        instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });

    // Add UnitBlockBonus (separate from UnitCombatBonus)
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("ubb_1"),
        source: ModifierSource::Card {
            card_id: CardId::from("banner_of_protection"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Turn,
        scope: ModifierScope::AllUnits,
        effect: ModifierEffect::UnitBlockBonus { amount: 3 },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    // Activate block
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 1, // Block 2 Physical
        },
        epoch,
    ).unwrap();
    // Block: 2 (base) + 3 (UnitBlockBonus) = 5
    assert_eq!(state.players[0].combat_accumulator.block, 5);
}

#[test]
fn glory_unit_block_bonus_does_not_affect_attack() {
    // UnitBlockBonus should NOT affect attack.
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;

    let mut state = setup_combat_game(&["prowlers"]);
    let mut undo = UndoStack::new();
    let pid = state.players[0].id.clone();

    state.players[0].units.push(PlayerUnit {
        instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });

    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("ubb_2"),
        source: ModifierSource::Card {
            card_id: CardId::from("banner_of_protection"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Turn,
        scope: ModifierScope::AllUnits,
        effect: ModifierEffect::UnitBlockBonus { amount: 5 },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 0, // Attack 2 Physical (NOT block)
        },
        epoch,
    ).unwrap();
    // Attack should just be base 2 — no UnitBlockBonus applied to attack
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
}

// =========================================================================
// Banner of Fear — comprehensive tests
// =========================================================================

#[test]
fn banner_fear_unit_becomes_spent() {
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let enemy_iid = CombatInstanceId::from("enemy_0");
    let mut state = setup_combat_game(&["prowlers"]);
    let mut undo = UndoStack::new();

    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
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
        unit_instance_id: unit_iid.clone(),
        is_used_this_round: false,
    });
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::UseBannerFear {
            unit_instance_id: unit_iid,
            enemy_instance_id: enemy_iid,
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].units[0].state, UnitState::Spent);
}

#[test]
fn banner_fear_cannot_use_on_already_cancelled_attack() {
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let enemy_iid = CombatInstanceId::from("enemy_0");
    let mut state = setup_combat_game(&["prowlers"]);
    let mut undo = UndoStack::new();

    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
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
        unit_instance_id: unit_iid.clone(),
        is_used_this_round: false,
    });
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    // Use fear once (succeeds)
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::UseBannerFear {
            unit_instance_id: unit_iid.clone(),
            enemy_instance_id: enemy_iid.clone(),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Attack is now cancelled
    assert!(state.combat.as_ref().unwrap().enemies[0].attacks_cancelled[0]);

    // Banner is now used — a second attempt should fail
    let epoch2 = state.action_epoch;
    let result = apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::UseBannerFear {
            unit_instance_id: unit_iid,
            enemy_instance_id: enemy_iid,
            attack_index: 0,
        },
        epoch2,
    );
    assert!(result.is_err());
}

#[test]
fn banner_fear_multiple_enemies() {
    // Two enemies — cancel one attack from each using two different banners.
    let unit0 = mk_types::ids::UnitInstanceId::from("unit_0");
    let unit1 = mk_types::ids::UnitInstanceId::from("unit_1");
    let mut state = setup_combat_game(&["prowlers", "diggers"]);
    let mut undo = UndoStack::new();

    // Two units
    for (i, uid) in [&unit0, &unit1].iter().enumerate() {
        state.players[0].units.push(PlayerUnit {
            instance_id: (*uid).clone(),
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
            unit_instance_id: (*uid).clone(),
            is_used_this_round: false,
        });
        let _ = i;
    }
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    // Cancel prowlers attack with unit_0
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::UseBannerFear {
            unit_instance_id: unit0.clone(),
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Cancel diggers attack with unit_1
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::UseBannerFear {
            unit_instance_id: unit1.clone(),
            enemy_instance_id: CombatInstanceId::from("enemy_1"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Both attacks cancelled
    assert!(state.combat.as_ref().unwrap().enemies[0].attacks_cancelled[0]);
    assert!(state.combat.as_ref().unwrap().enemies[1].attacks_cancelled[0]);
    // Both units spent
    assert_eq!(state.players[0].units[0].state, UnitState::Spent);
    assert_eq!(state.players[0].units[1].state, UnitState::Spent);
    // +2 fame total
    assert_eq!(state.players[0].fame, 2);
}

#[test]
fn banner_fear_not_enumerated_outside_block_phase() {
    // UseBannerFear should NOT appear in legal actions during RangedSiege phase.
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let mut state = setup_combat_game(&["prowlers"]);
    let undo = UndoStack::new();

    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
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
        unit_instance_id: unit_iid.clone(),
        is_used_this_round: false,
    });
    // Phase is RangedSiege (default), not Block
    assert_eq!(
        state.combat.as_ref().unwrap().phase,
        CombatPhase::RangedSiege
    );

    let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_fear = actions.actions.iter().any(|a| matches!(a, LegalAction::UseBannerFear { .. }));
    assert!(!has_fear, "UseBannerFear should not be available during RangedSiege phase");
}

#[test]
fn banner_fear_enumerated_in_block_phase() {
    // UseBannerFear SHOULD appear in legal actions during Block phase.
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let mut state = setup_combat_game(&["prowlers"]);
    let undo = UndoStack::new();

    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
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
        unit_instance_id: unit_iid.clone(),
        is_used_this_round: false,
    });
    // Move to Block phase
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_fear = actions.actions.iter().any(|a| matches!(a, LegalAction::UseBannerFear { .. }));
    assert!(has_fear, "UseBannerFear should be available during Block phase");
}

// =========================================================================
// Banner of Fortitude — damage interaction tests
// =========================================================================

/// Helper to create a combat state with a unit that has fortitude attached,
/// facing a specific enemy, and assign damage to the unit.
fn fortitude_damage_test(
    enemy_id: &str,
    enemy_attack_index: usize,
) -> (GameState, bool) {
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let mut state = setup_combat_game(&[enemy_id]);
    let mut undo = UndoStack::new();

    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    state.players[0].attached_banners.push(BannerAttachment {
        banner_id: CardId::from("banner_of_fortitude"),
        unit_instance_id: unit_iid.clone(),
        is_used_this_round: false,
    });

    // Move to AssignDamage phase
    state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;

    let epoch = state.action_epoch;
    let _ = apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::AssignDamageToUnit {
            enemy_index: 0,
            attack_index: enemy_attack_index,
            unit_instance_id: unit_iid,
        },
        epoch,
    );

    let is_wounded = state.players[0].units.get(0).map(|u| u.wounded).unwrap_or(true);
    let banner_used = state.players[0].attached_banners.get(0)
        .map(|b| b.is_used_this_round)
        .unwrap_or(false);

    (state, is_wounded)
}

#[test]
fn fortitude_prevents_wound_from_damage_assignment() {
    // Prowlers: Attack 4 Physical, no abilities.
    // Peasants: Level 1, armor 3. Damage 4 > armor 3, so wound.
    // Fortitude prevents the wound.
    let (state, is_wounded) = fortitude_damage_test("prowlers", 0);

    // Unit survives AND is NOT wounded (fortitude negated)
    assert!(!is_wounded);
    assert_eq!(state.players[0].units.len(), 1);
    // Banner is used
    assert!(state.players[0].attached_banners[0].is_used_this_round);
}

#[test]
fn fortitude_prevents_wound_only_once_per_round() {
    // After first wound is negated, second wound goes through.
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let mut state = setup_combat_game(&["prowlers", "prowlers"]);
    let mut undo = UndoStack::new();

    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    state.players[0].attached_banners.push(BannerAttachment {
        banner_id: CardId::from("banner_of_fortitude"),
        unit_instance_id: unit_iid.clone(),
        is_used_this_round: false,
    });

    state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;

    // First damage assignment — fortitude should prevent
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::AssignDamageToUnit {
            enemy_index: 0,
            attack_index: 0,
            unit_instance_id: unit_iid.clone(),
        },
        epoch,
    ).unwrap();
    assert!(!state.players[0].units[0].wounded); // prevented
    assert!(state.players[0].attached_banners[0].is_used_this_round);

    // Second damage assignment — fortitude already used, wound goes through
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::AssignDamageToUnit {
            enemy_index: 1,
            attack_index: 0,
            unit_instance_id: unit_iid.clone(),
        },
        epoch,
    ).unwrap();
    assert!(state.players[0].units[0].wounded); // wound goes through
}

#[test]
fn fortitude_does_not_prevent_unit_destruction() {
    // When a wounded unit takes another wound, it's destroyed.
    // Fortitude only prevents wound (not destruction from double-wound).
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let mut state = setup_combat_game(&["prowlers"]);
    let mut undo = UndoStack::new();

    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: true, // Already wounded!
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    state.players[0].attached_banners.push(BannerAttachment {
        banner_id: CardId::from("banner_of_fortitude"),
        unit_instance_id: unit_iid.clone(),
        is_used_this_round: false,
    });

    state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;

    let epoch = state.action_epoch;
    let _ = apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::AssignDamageToUnit {
            enemy_index: 0,
            attack_index: 0,
            unit_instance_id: unit_iid,
        },
        epoch,
    );

    // Unit is destroyed (removed) — fortitude doesn't prevent destruction
    assert!(state.players[0].units.is_empty());
}

#[test]
fn fortitude_without_banner_unit_gets_wounded() {
    // No banner attached — unit takes wound normally.
    let unit_iid = mk_types::ids::UnitInstanceId::from("unit_0");
    let mut state = setup_combat_game(&["prowlers"]);
    let mut undo = UndoStack::new();

    state.players[0].units.push(PlayerUnit {
        instance_id: unit_iid.clone(),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });
    // No banner attached!
    state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::AssignDamageToUnit {
            enemy_index: 0,
            attack_index: 0,
            unit_instance_id: unit_iid,
        },
        epoch,
    ).unwrap();
    // Unit is wounded normally
    assert!(state.players[0].units[0].wounded);
}

// =========================================================================
// Combat Hook: FamePerEnemyDefeated (Banner of Glory, Sword of Justice)
// =========================================================================

fn add_fame_per_enemy_modifier(state: &mut GameState, player_idx: usize, fame: u32, exclude_summoned: bool) {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    let pid = state.players[player_idx].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("fame_per_enemy"),
        source: ModifierSource::Card {
            card_id: CardId::from("banner_of_glory"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::AllUnits,
        effect: ModifierEffect::FamePerEnemyDefeated { fame_per_enemy: fame, exclude_summoned },
        created_at_round: 1,
        created_by_player_id: pid,
    });
}

#[test]
fn fame_per_enemy_bonus_on_single_defeat() {
    let mut state = setup_combat_game(&["prowlers"]); // fame 2
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    add_fame_per_enemy_modifier(&mut state, 0, 1, false);

    state.players[0].combat_accumulator.attack.normal = 10;
    state.players[0].combat_accumulator.attack.normal_elements.physical = 10;
    state.players[0].fame = 0;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    // Base fame 2 + bonus 1 = 3
    assert_eq!(state.players[0].fame, 3);
}

#[test]
fn fame_per_enemy_bonus_on_multiple_defeats() {
    let mut state = setup_combat_game(&["prowlers", "prowlers"]); // each fame 2
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    add_fame_per_enemy_modifier(&mut state, 0, 1, false);

    state.players[0].combat_accumulator.attack.normal = 20;
    state.players[0].combat_accumulator.attack.normal_elements.physical = 20;
    state.players[0].fame = 0;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 2);

    // Base fame 4 (2*2) + bonus 2 (1*2) = 6
    assert_eq!(state.players[0].fame, 6);
}

#[test]
fn fame_per_enemy_excludes_summoned_when_flagged() {
    let mut state = setup_combat_game(&["prowlers", "prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    // Mark second enemy as summoned
    state.combat.as_mut().unwrap().enemies[1].summoned_by_instance_id =
        Some(mk_types::ids::CombatInstanceId::from("enemy_0"));
    add_fame_per_enemy_modifier(&mut state, 0, 2, true); // exclude_summoned=true

    state.players[0].combat_accumulator.attack.normal = 20;
    state.players[0].combat_accumulator.attack.normal_elements.physical = 20;
    state.players[0].fame = 0;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 2);

    // Base fame 2 (only non-summoned prowler) + bonus 2 (2*1 non-summoned) = 4
    assert_eq!(state.players[0].fame, 4);
}

#[test]
fn fame_per_enemy_includes_summoned_when_not_flagged() {
    let mut state = setup_combat_game(&["prowlers", "prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    state.combat.as_mut().unwrap().enemies[1].summoned_by_instance_id =
        Some(mk_types::ids::CombatInstanceId::from("enemy_0"));
    add_fame_per_enemy_modifier(&mut state, 0, 2, false); // exclude_summoned=false

    state.players[0].combat_accumulator.attack.normal = 20;
    state.players[0].combat_accumulator.attack.normal_elements.physical = 20;
    state.players[0].fame = 0;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 2);

    // Base fame 2 (summoned gives 0) + bonus 4 (2*2 — both count even summoned) = 6
    assert_eq!(state.players[0].fame, 6);
}

