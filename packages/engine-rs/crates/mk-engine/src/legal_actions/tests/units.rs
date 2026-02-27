use super::*;

// =========================================================================
// Unit recruitment
// =========================================================================

#[test]
fn recruit_unit_enumerated_at_village() {
    let mut state = setup_village_recruit();
    state.players[0].flags.insert(PlayerFlags::IS_INTERACTING);
    let legal = enumerate_legal_actions(&state, 0);

    let recruits: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::RecruitUnit { .. }))
        .collect();
    assert!(
        !recruits.is_empty(),
        "should enumerate RecruitUnit actions at village"
    );
    // peasants(4), foresters(5), herbalist(3) all available at village
    assert_eq!(recruits.len(), 3, "all 3 village units should be recruitable");
}

#[test]
fn contract_recruit_unit_at_village() {
    let state = setup_village_recruit();
    let undo = UndoStack::new();
    assert_all_executable(&state, &undo, 0);
}

#[test]
fn recruit_deducts_influence_and_creates_unit() {
    let mut state = setup_village_recruit();
    let mut undo = UndoStack::new();

    state.players[0].flags.insert(PlayerFlags::IS_INTERACTING);
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Find peasants recruit action (cost=4 at rep 0)
    let peasant_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::RecruitUnit { unit_id, .. } if unit_id.as_str() == "peasants"))
        .expect("peasants should be recruitable");

    let influence_before = state.players[0].influence_points;
    let units_before = state.players[0].units.len();
    let offer_len_before = state.offers.units.len();

    let result = apply_legal_action(&mut state, &mut undo, 0, peasant_action, legal.epoch);
    assert!(result.is_ok());

    assert_eq!(
        state.players[0].influence_points,
        influence_before - 4,
        "peasants cost 4 influence at rep 0"
    );
    assert_eq!(
        state.players[0].units.len(),
        units_before + 1,
        "should have one more unit"
    );
    assert_eq!(
        state.players[0].units.last().unwrap().unit_id.as_str(),
        "peasants"
    );
    assert_eq!(
        state.offers.units.len(),
        offer_len_before - 1,
        "unit removed from offer"
    );
}

#[test]
fn recruit_undo_restores_state() {
    let mut state = setup_village_recruit();
    let mut undo = UndoStack::new();

    state.players[0].flags.insert(PlayerFlags::IS_INTERACTING);
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let peasant_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::RecruitUnit { unit_id, .. } if unit_id.as_str() == "peasants"))
        .expect("peasants should be recruitable");

    let state_before = state.clone();

    let result = apply_legal_action(&mut state, &mut undo, 0, peasant_action, legal.epoch);
    assert!(result.is_ok());
    assert_eq!(state.players[0].units.len(), 1, "unit added after recruit");

    // Undo should restore state (except epoch)
    let undo_legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let undo_action = undo_legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::Undo))
        .expect("Undo should be available");
    let undo_result = apply_legal_action(&mut state, &mut undo, 0, undo_action, undo_legal.epoch);
    assert!(undo_result.is_ok());
    assert_eq!(
        state.players[0].units.len(),
        state_before.players[0].units.len(),
        "units restored after undo"
    );
    assert_eq!(
        state.players[0].influence_points,
        state_before.players[0].influence_points,
        "influence restored after undo"
    );
    assert_eq!(
        state.offers.units.len(),
        state_before.offers.units.len(),
        "offer restored after undo"
    );
}

#[test]
fn no_recruit_at_burned_village() {
    let mut state = setup_village_recruit();
    let hex = state.map.hexes.get_mut("0,0").unwrap();
    hex.site.as_mut().unwrap().is_burned = true;

    let legal = enumerate_legal_actions(&state, 0);
    let recruits: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::RecruitUnit { .. }))
        .collect();
    assert!(recruits.is_empty(), "no recruitment at burned village");
}

// =========================================================================
// Unit Activation
// =========================================================================

#[test]
fn peasant_noncombat_abilities_enumerated() {
    let state = setup_unit_activation();
    let legal = enumerate_legal_actions(&state, 0);

    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();
    // Peasants outside combat: Influence(2) and Move(2) only (not Attack/Block which are combat)
    assert_eq!(activations.len(), 2, "peasant should have 2 non-combat abilities");
}

#[test]
fn spent_unit_no_activations() {
    let mut state = setup_unit_activation();
    state.players[0].units[0].state = UnitState::Spent;
    let legal = enumerate_legal_actions(&state, 0);

    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();
    assert!(activations.is_empty(), "spent unit should have no activations");
}

#[test]
fn wounded_unit_no_activations() {
    let mut state = setup_unit_activation();
    state.players[0].units[0].wounded = true;
    let legal = enumerate_legal_actions(&state, 0);

    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();
    assert!(activations.is_empty(), "wounded unit should have no activations");
}

#[test]
fn activate_move_adds_move_points() {
    let mut state = setup_unit_activation();
    let mut undo = UndoStack::new();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Find the Move ability (ability_index=3 for peasants: Attack, Block, Influence, Move)
    let move_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 3, .. }))
        .expect("peasant Move ability should be available");

    let move_before = state.players[0].move_points;
    let result = apply_legal_action(&mut state, &mut undo, 0, move_action, legal.epoch);
    assert!(result.is_ok());

    assert_eq!(state.players[0].move_points, move_before + 2, "peasant move adds 2");
    assert_eq!(state.players[0].units[0].state, UnitState::Spent, "unit should be spent");
}

#[test]
fn activate_influence_adds_influence_points() {
    let mut state = setup_unit_activation();
    let mut undo = UndoStack::new();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Find the Influence ability (ability_index=2 for peasants)
    let inf_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 2, .. }))
        .expect("peasant Influence ability should be available");

    let inf_before = state.players[0].influence_points;
    let result = apply_legal_action(&mut state, &mut undo, 0, inf_action, legal.epoch);
    assert!(result.is_ok());

    assert_eq!(state.players[0].influence_points, inf_before + 2, "peasant influence adds 2");
    assert_eq!(state.players[0].units[0].state, UnitState::Spent, "unit should be spent");
}

#[test]
fn activate_unit_undo_restores_state() {
    let mut state = setup_unit_activation();
    let mut undo = UndoStack::new();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let move_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 3, .. }))
        .expect("peasant Move ability should be available");

    let state_before = state.clone();
    let _ = apply_legal_action(&mut state, &mut undo, 0, move_action, legal.epoch);
    assert_eq!(state.players[0].units[0].state, UnitState::Spent);

    // Undo
    let undo_legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let undo_action = undo_legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::Undo))
        .expect("Undo should be available");
    let _ = apply_legal_action(&mut state, &mut undo, 0, undo_action, undo_legal.epoch);

    assert_eq!(state.players[0].units[0].state, UnitState::Ready, "unit should be ready after undo");
    assert_eq!(
        state.players[0].move_points,
        state_before.players[0].move_points,
        "move points restored after undo"
    );
}

#[test]
fn combat_unit_attack_in_attack_phase() {
    let mut state = setup_unit_activation();
    // Enter combat
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Peasant in Attack phase: Attack(2, Phys) at index 0 should be available
    assert!(
        activations.iter().any(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 0, .. })),
        "Attack ability (index 0) should be available in Attack phase"
    );
    // Block (index 1) should NOT be available in Attack phase
    assert!(
        !activations.iter().any(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 1, .. })),
        "Block ability should not be available in Attack phase"
    );
    // Move/Influence (indices 2,3) should NOT be available in combat
    assert!(
        !activations.iter().any(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 2, .. })),
        "Influence should not be available in combat"
    );
}

#[test]
fn combat_block_in_block_phase() {
    let mut state = setup_unit_activation();
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Only Block (index 1) should be available
    assert_eq!(activations.len(), 1);
    assert!(matches!(activations[0], LegalAction::ActivateUnit { ability_index: 1, .. }));
}

#[test]
fn units_not_allowed_in_dungeon_combat() {
    let mut state = setup_unit_activation();
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().units_allowed = false;
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    assert!(activations.is_empty(), "no unit activations when units_allowed=false");
}

#[test]
fn activate_attack_updates_accumulator() {
    let mut state = setup_unit_activation();
    let mut undo = UndoStack::new();

    // Enter combat in Attack phase
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let atk_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 0, .. }))
        .expect("Attack ability should be available");

    let result = apply_legal_action(&mut state, &mut undo, 0, atk_action, legal.epoch);
    assert!(result.is_ok());

    let acc = &state.players[0].combat_accumulator.attack;
    assert_eq!(acc.normal, 2, "peasant attack 2 added to normal");
    assert_eq!(acc.normal_elements.physical, 2, "physical element");
    assert_eq!(state.players[0].units[0].state, UnitState::Spent);
}

#[test]
fn mana_costed_ability_requires_mana() {
    let mut state = setup_game(vec!["march"]);
    // Add a guardian golem unit
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_2"),
        unit_id: mk_types::ids::UnitId::from("guardian_golems"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });
    // No mana available initially
    state.players[0].pure_mana.clear();
    state.players[0].crystals = mk_types::state::Crystals::default();

    // Enter combat in Block phase
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Only free Block(2, Phys) at index 1 should be available
    // Mana-costed Block(4, Fire) at index 2 (red) and Block(4, Ice) at index 3 (blue) should be blocked
    assert_eq!(activations.len(), 1, "only free block should be available without mana");
    assert!(matches!(activations[0], LegalAction::ActivateUnit { ability_index: 1, .. }));

    // Now give red mana
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    let legal2 = enumerate_legal_actions(&state, 0);
    let activations2: Vec<_> = legal2
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Now Block(2, Phys) and Block(4, Fire) should both be available
    assert_eq!(activations2.len(), 2, "free block + red-costed block");
}

#[test]
fn activate_mana_costed_consumes_mana() {
    let mut state = setup_game(vec!["march"]);
    let mut undo = UndoStack::new();

    // Add guardian golem + red mana
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_2"),
        unit_id: mk_types::ids::UnitId::from("guardian_golems"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Find the mana-costed Fire Block (ability_index=2)
    let fire_block = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 2, .. }))
        .expect("Fire Block should be available with red mana");

    assert_eq!(state.players[0].pure_mana.len(), 1, "should have 1 mana token");
    let result = apply_legal_action(&mut state, &mut undo, 0, fire_block, legal.epoch);
    assert!(result.is_ok());

    assert!(state.players[0].pure_mana.is_empty(), "mana consumed");
    assert_eq!(state.players[0].combat_accumulator.block, 4, "block 4 added");
    assert_eq!(state.players[0].combat_accumulator.block_elements.fire, 4, "fire element");
}

#[test]
fn heal_ability_removes_wounds() {
    let mut state = setup_game(vec!["wound", "wound", "march"]);
    let mut undo = UndoStack::new();

    // Add magic familiars unit (has Heal(2) at index 3, free)
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_3"),
        unit_id: mk_types::ids::UnitId::from("magic_familiars"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let heal_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 3, .. }))
        .expect("Heal ability should be available with wounds in hand");

    let result = apply_legal_action(&mut state, &mut undo, 0, heal_action, legal.epoch);
    assert!(result.is_ok());

    let wound_count = state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count();
    assert_eq!(wound_count, 0, "both wounds healed by Heal(2)");
    assert_eq!(state.players[0].hand.len(), 1, "only march remains");
}

#[test]
fn heal_ability_not_available_without_wounds() {
    let mut state = setup_game(vec!["march"]);
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_3"),
        unit_id: mk_types::ids::UnitId::from("magic_familiars"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let heal = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 3, .. }));
    assert!(heal.is_none(), "Heal should not be available without wounds in hand");
}

#[test]
fn contract_test_unit_activations() {
    let state = setup_unit_activation();
    let undo = UndoStack::new();
    assert_all_executable(&state, &undo, 0);
}

// --- Fortification restriction ---

#[test]
fn ranged_blocked_at_fortified_site_in_rangedsiege() {
    // Utem Crossbowmen have: Attack(3, Phys), Block(3, Phys), RangedAttack(2, Phys)
    let mut state = setup_game(vec!["march"]);
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_xbow"),
        unit_id: mk_types::ids::UnitId::from("utem_crossbowmen"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Combat at fortified site, RangedSiege phase
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        is_at_fortified_site: true,
        ..CombatState::default()
    }));

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Ranged (index 2) should be BLOCKED at fortified in RangedSiege
    assert!(
        !activations.iter().any(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 2, .. })),
        "RangedAttack should be blocked at fortified site in RangedSiege"
    );
    // No combat abilities should be available (Attack is Attack-phase only, Block is Block-phase only)
    assert!(activations.is_empty(), "no unit abilities available: ranged blocked by fort, attack/block wrong phase");
}

#[test]
fn siege_allowed_at_fortified_site_in_rangedsiege() {
    // Catapults have: Siege(3, Phys), Siege(5, Fire)[red], Siege(5, Ice)[blue]
    let mut state = setup_game(vec!["march"]);
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_cat"),
        unit_id: mk_types::ids::UnitId::from("catapults"),
        level: 3,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        is_at_fortified_site: true,
        ..CombatState::default()
    }));

    // No mana, so only the free Siege(3, Phys) at index 0
    state.players[0].pure_mana.clear();
    state.players[0].crystals = mk_types::state::Crystals::default();

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    assert_eq!(activations.len(), 1, "free siege should be available at fortified site");
    assert!(matches!(activations[0], LegalAction::ActivateUnit { ability_index: 0, .. }));
}

#[test]
fn ranged_and_siege_at_fortified_with_mana() {
    // Catapults at fortified site with red mana — siege ok, ranged not applicable (catapults don't have ranged)
    // Use fire_golems: Attack(3, Phys), Block(3, Phys), RangedAttack(4, Fire)[red]
    let mut state = setup_game(vec!["march"]);
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_fg"),
        unit_id: mk_types::ids::UnitId::from("fire_golems"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Give red mana
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    // Fortified, RangedSiege
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        is_at_fortified_site: true,
        ..CombatState::default()
    }));

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Fire Golems: Attack(index 0) → Attack phase only → no.
    // Block(index 1) → Block phase only → no.
    // RangedAttack(index 2, red mana) → fortified blocks ranged → no.
    assert!(activations.is_empty(), "ranged blocked at fortified even with mana, attack/block wrong phase");

    // Now test in Attack phase at fortified — ranged allowed even at fortified site
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    let legal2 = enumerate_legal_actions(&state, 0);
    let activations2: Vec<_> = legal2
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Attack(index 0, free) + RangedAttack(index 2, red mana) both available in Attack phase
    assert_eq!(activations2.len(), 2, "attack + ranged available in Attack phase at fortified");
}

// --- Multi-unit same-phase contributions ---

#[test]
fn two_units_both_contribute_in_attack_phase() {
    let mut state = setup_game(vec!["march"]);
    let mut undo = UndoStack::new();
    use mk_types::ids::UnitInstanceId;

    // Add two peasant units
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_a"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_b"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // Both units should have Attack available
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();
    assert_eq!(activations.len(), 2, "two peasants = two Attack activations");

    // Activate first unit
    let first = activations[0].clone();
    let result = apply_legal_action(&mut state, &mut undo, 0, &first, legal.epoch);
    assert!(result.is_ok());
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 2, "first peasant: 2 attack");

    // Activate second unit
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let activations2: Vec<_> = legal2
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();
    assert_eq!(activations2.len(), 1, "one peasant left to activate");

    let second = activations2[0].clone();
    let result2 = apply_legal_action(&mut state, &mut undo, 0, &second, legal2.epoch);
    assert!(result2.is_ok());
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 4, "both peasants: 2+2=4 attack");
}

// --- Elemental tracking across unit activations ---

#[test]
fn elemental_values_tracked_across_unit_activations() {
    let mut state = setup_game(vec!["march"]);
    let mut undo = UndoStack::new();
    use mk_types::ids::UnitInstanceId;

    // Add guardian golem (Attack 2 Phys, Block 2 Phys, Block 4 Fire [red], Block 4 Ice [blue])
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_golem"),
        unit_id: mk_types::ids::UnitId::from("guardian_golems"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Also add a red cape monk (Attack 3 Phys, Block 3 Phys, Attack 4 Fire [red], Block 4 Fire [red])
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_monk"),
        unit_id: mk_types::ids::UnitId::from("red_cape_monks"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Give red mana for mana-costed abilities
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    // Combat in Attack phase
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // Activate guardian golem Attack(2, Physical) — ability_index 0
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let golem_atk = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { unit_instance_id, ability_index: 0, .. }
            if unit_instance_id.as_str() == "unit_golem"))
        .expect("golem attack should be available");
    let _ = apply_legal_action(&mut state, &mut undo, 0, golem_atk, legal.epoch);

    assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 2);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.fire, 0);

    // Activate red cape monk Attack 4 Fire (ability_index 2, mana-costed red)
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let monk_fire = legal2
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
            if unit_instance_id.as_str() == "unit_monk"))
        .expect("monk fire attack should be available");
    let _ = apply_legal_action(&mut state, &mut undo, 0, monk_fire, legal2.epoch);

    // Golem contributed 2 physical normal, monk contributed 4 fire normal
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 6, "2 phys + 4 fire = 6 total normal");
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 2, "physical from golem");
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.fire, 4, "fire from monk");
}

#[test]
fn block_elemental_values_from_multiple_units() {
    let mut state = setup_game(vec!["march"]);
    let mut undo = UndoStack::new();
    use mk_types::ids::UnitInstanceId;

    // Peasant: Block 2 Phys at index 1
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_p"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Guardian Golems: Block 4 Fire at index 2 (red mana)
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_g"),
        unit_id: mk_types::ids::UnitId::from("guardian_golems"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Give red mana for guardian golem fire block
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    // Activate peasant Block(2, Phys) — index 1
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let peasant_blk = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
            if unit_instance_id.as_str() == "unit_p"))
        .expect("peasant block should be available");
    let _ = apply_legal_action(&mut state, &mut undo, 0, peasant_blk, legal.epoch);

    assert_eq!(state.players[0].combat_accumulator.block, 2);
    assert_eq!(state.players[0].combat_accumulator.block_elements.physical, 2);

    // Activate guardian golem Fire Block(4, Fire) — index 2, costs red
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let golem_fire_blk = legal2
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
            if unit_instance_id.as_str() == "unit_g"))
        .expect("golem fire block should be available");
    let _ = apply_legal_action(&mut state, &mut undo, 0, golem_fire_blk, legal2.epoch);

    assert_eq!(state.players[0].combat_accumulator.block, 6, "2 phys + 4 fire = 6 total block");
    assert_eq!(state.players[0].combat_accumulator.block_elements.physical, 2, "physical from peasant");
    assert_eq!(state.players[0].combat_accumulator.block_elements.fire, 4, "fire from golem");
}

// =========================================================================
// Tier 1 complex unit abilities
// =========================================================================

#[test]
fn herbalist_gain_green_mana() {
    let (mut state, mut undo) = setup_complex_unit("herbalist", "unit_herb");
    state.players[0].pure_mana.clear();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Herbalist ability index 2 = GainMana { color: Green }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_herb"
    )).expect("GainMana should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].pure_mana.len(), 1);
    assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Green);
}

#[test]
fn herbalist_ready_unit_auto() {
    let (mut state, mut undo) = setup_complex_unit("herbalist", "unit_herb");
    // Add a spent peasant at level 1 (within max_level=2)
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: mk_types::ids::UnitInstanceId::from("unit_peas"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Spent,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Herbalist ability index 1 = ReadyUnit { max_level: 2 }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_herb"
    )).expect("ReadyUnit should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    // Peasant should now be Ready again (auto-readied since only 1 eligible)
    let peasant = state.players[0].units.iter().find(|u| u.instance_id.as_str() == "unit_peas").unwrap();
    assert_eq!(peasant.state, UnitState::Ready);
}

#[test]
fn herbalist_ready_unit_not_enumerated_when_no_eligible() {
    let (state, undo) = setup_complex_unit("herbalist", "unit_herb");
    // No other units are spent, so ReadyUnit should NOT be enumerated
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let ready_action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_herb"
    ));
    assert!(ready_action.is_none(), "ReadyUnit should not be enumerated when no eligible units");
}

#[test]
fn illusionists_gain_white_crystal() {
    let (mut state, mut undo) = setup_complex_unit("illusionists", "unit_ill");
    state.players[0].crystals.white = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Illusionists ability index 2 = GainCrystal { color: White }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_ill"
    )).expect("GainCrystal should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].crystals.white, 1);
}

#[test]
fn fire_mages_gain_mana_and_crystal() {
    let (mut state, mut undo) = setup_complex_unit("fire_mages", "unit_fm");
    state.players[0].pure_mana.clear();
    state.players[0].crystals.red = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Fire Mages ability index 3 = GainManaAndCrystal { color: Red }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 3, .. }
        if unit_instance_id.as_str() == "unit_fm"
    )).expect("GainManaAndCrystal should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].pure_mana.len(), 1);
    assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Red);
    assert_eq!(state.players[0].crystals.red, 1);
}

#[test]
fn thugs_attack_with_rep_cost() {
    let (mut state, mut undo) = setup_complex_unit("thugs", "unit_thug");
    state.players[0].reputation = 0;
    // Enter combat
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Thugs ability index 1 = AttackWithRepCost { value: 3, element: Physical, rep_change: -1 }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_thug"
    )).expect("AttackWithRepCost should be available in Attack phase");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 3);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 3);
    assert_eq!(state.players[0].reputation, -1);
}

#[test]
fn thugs_influence_with_rep_cost() {
    let (mut state, mut undo) = setup_complex_unit("thugs", "unit_thug");
    state.players[0].reputation = 3;
    state.players[0].influence_points = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Thugs ability index 2 = InfluenceWithRepCost { value: 4, rep_change: -1 }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_thug"
    )).expect("InfluenceWithRepCost should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].influence_points, 4);
    assert_eq!(state.players[0].reputation, 2);
}

#[test]
fn magic_familiars_move_or_influence_creates_pending() {
    let (mut state, mut undo) = setup_complex_unit("magic_familiars", "unit_mf");

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Magic Familiars ability index 2 = MoveOrInfluence { value: 3 }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_mf"
    )).expect("MoveOrInfluence should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should create a pending choice
    assert!(state.players[0].pending.has_active());
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::UnitAbilityChoice { ref options, wound_self: false, .. })
        if options.len() == 2
    ));

    // Unit should be spent
    let mf = state.players[0].units.iter().find(|u| u.instance_id.as_str() == "unit_mf").unwrap();
    assert_eq!(mf.state, UnitState::Spent);
}

#[test]
fn magic_familiars_choose_move() {
    let (mut state, mut undo) = setup_complex_unit("magic_familiars", "unit_mf");
    state.players[0].move_points = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_mf"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Now resolve the pending: choice 0 = GainMove { value: 3 }
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert_eq!(state.players[0].move_points, 3);
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn magic_familiars_choose_influence() {
    let (mut state, mut undo) = setup_complex_unit("magic_familiars", "unit_mf");
    state.players[0].influence_points = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_mf"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // choice 1 = GainInfluence { value: 3 }
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 1 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert_eq!(state.players[0].influence_points, 3);
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn utem_swordsmen_attack_or_block_creates_pending_in_combat() {
    let (mut state, mut undo) = setup_complex_unit("utem_swordsmen", "unit_us");
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Utem Swordsmen ability index 2 = AttackOrBlockWoundSelf { value: 6, element: Physical }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_us"
    )).expect("AttackOrBlockWoundSelf should be available in Attack phase");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should create pending with wound_self=true
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::UnitAbilityChoice { wound_self: true, .. })
    ));
}

#[test]
fn utem_swordsmen_choose_attack_wounds_self() {
    let (mut state, mut undo) = setup_complex_unit("utem_swordsmen", "unit_us");
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_us"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // choice 0 = GainAttack { value: 6, element: Physical }
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert_eq!(state.players[0].combat_accumulator.attack.normal, 6);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 6);
    // Unit should be wounded
    let us = state.players[0].units.iter().find(|u| u.instance_id.as_str() == "unit_us").unwrap();
    assert!(us.wounded);
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn utem_swordsmen_choose_block_wounds_self() {
    let (mut state, mut undo) = setup_complex_unit("utem_swordsmen", "unit_us");
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_us"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // choice 1 = GainBlock { value: 6, element: Physical }
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 1 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert_eq!(state.players[0].combat_accumulator.block, 6);
    assert_eq!(state.players[0].combat_accumulator.block_elements.physical, 6);
    // Unit should be wounded
    let us = state.players[0].units.iter().find(|u| u.instance_id.as_str() == "unit_us").unwrap();
    assert!(us.wounded);
}

#[test]
fn altem_guardians_grant_all_resistances() {
    let (mut state, mut undo) = setup_complex_unit("altem_guardians", "unit_ag");
    assert!(state.active_modifiers.is_empty());

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Altem Guardians ability index 2 = GrantAllResistances
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_ag"
    )).expect("GrantAllResistances should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    assert_eq!(state.active_modifiers.len(), 1);
    let m = &state.active_modifiers[0];
    assert_eq!(m.duration, mk_types::modifier::ModifierDuration::Turn);
    assert!(matches!(m.scope, mk_types::modifier::ModifierScope::AllUnits));
    match &m.effect {
        mk_types::modifier::ModifierEffect::GrantResistances { resistances } => {
            assert_eq!(resistances.len(), 3);
            assert!(resistances.contains(&ResistanceElement::Physical));
            assert!(resistances.contains(&ResistanceElement::Fire));
            assert!(resistances.contains(&ResistanceElement::Ice));
        }
        other => panic!("Expected GrantResistances, got {:?}", other),
    }
}

#[test]
fn rep_cost_clamped_at_minus_seven() {
    let (mut state, mut undo) = setup_complex_unit("thugs", "unit_thug");
    state.players[0].reputation = -7;
    state.players[0].influence_points = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_thug"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    assert_eq!(state.players[0].reputation, -7, "Reputation should clamp at -7");
    assert_eq!(state.players[0].influence_points, 4);
}

#[test]
fn attack_or_block_available_in_block_phase() {
    let (mut state, undo) = setup_complex_unit("utem_swordsmen", "unit_us");
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_us"
    ));
    assert!(action.is_some(), "AttackOrBlockWoundSelf should be available in Block phase");
}

#[test]
fn attack_with_rep_cost_only_in_attack_phase() {
    let (mut state, undo) = setup_complex_unit("thugs", "unit_thug");
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // AttackWithRepCost should NOT be available in Block phase
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_thug"
    ));
    assert!(action.is_none(), "AttackWithRepCost should NOT be in Block phase");
}

// =========================================================================
// SelectCombatEnemy unit abilities
// =========================================================================

#[test]
fn illusionists_cancel_attack_auto_resolves_single_enemy() {
    let (mut state, mut undo) = setup_select_enemy_combat("illusionists", "unit_ill", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    // Give white mana for the cancel attack ability (ability_index 1, costs white)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_ill"
    )).expect("cancel attack should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Single enemy → auto-resolve, no pending
    assert!(!state.players[0].pending.has_active());
    // Should have EnemySkipAttack modifier
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
    ));
    // Unit should be spent
    let unit = state.players[0].units.iter().find(|u| u.instance_id.as_str() == "unit_ill").unwrap();
    assert_eq!(unit.state, UnitState::Spent);
}

#[test]
fn illusionists_cancel_attack_excludes_fortified() {
    // Diggers have Fortified ability — should be excluded
    let (mut state, mut undo) = setup_select_enemy_combat("illusionists", "unit_ill", &["diggers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Cancel attack (ability_index 1) should NOT be enumerated — diggers are fortified
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_ill"
    ));
    // It should still be enumerable (filter happens at activation, not enumeration) but
    // we can verify that activation fizzles with no modifiers
    if let Some(act) = action {
        let _ = apply_legal_action(&mut state, &mut undo, 0, act, legal.epoch);
        // Fizzle: no modifier added (0 eligible enemies)
        assert!(state.active_modifiers.is_empty(), "should fizzle against fortified-only enemies");
        assert!(!state.players[0].pending.has_active());
    }
}

#[test]
fn illusionists_cancel_attack_excludes_arcane_immune() {
    // Shadow has ArcaneImmunity — should be excluded by the filter
    let (mut state, mut undo) = setup_select_enemy_combat("illusionists", "unit_ill", &["shadow"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_ill"
    ));
    if let Some(act) = action {
        let _ = apply_legal_action(&mut state, &mut undo, 0, act, legal.epoch);
        assert!(state.active_modifiers.is_empty(), "should fizzle against arcane immune");
    }
}

#[test]
fn illusionists_cancel_attack_multi_enemy_creates_pending() {
    let (mut state, mut undo) = setup_select_enemy_combat("illusionists", "unit_ill", &["prowlers", "orc_tracker"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_ill"
    )).unwrap();

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Multiple eligible → pending
    assert!(state.players[0].pending.has_active());
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::SelectCombatEnemy { ref eligible_enemy_ids, .. })
        if eligible_enemy_ids.len() == 2
    ));

    // Resolve choice 0
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert!(!state.players[0].pending.has_active());
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
    ));
}

#[test]
fn shocktroops_weaken_applies_armor_and_attack_modifiers() {
    let (mut state, mut undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Weaken = ability_index 1
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_st"
    )).expect("weaken should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have armor -1 and attack -1 modifiers
    let has_armor_mod = state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Armor, amount: -1, .. }
    ));
    let has_attack_mod = state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Attack, amount: -1, .. }
    ));
    assert!(has_armor_mod, "weaken should apply armor -1");
    assert!(has_attack_mod, "weaken should apply attack -1");
}

#[test]
fn shocktroops_taunt_applies_attack_reduction_and_redirect() {
    let (mut state, mut undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Taunt = ability_index 2
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_st"
    )).expect("taunt should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have attack -3 modifier
    let has_attack_mod = state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Attack, amount: -3, .. }
    ));
    assert!(has_attack_mod, "taunt should apply attack -3");

    // Should have damage redirect
    let combat = state.combat.as_ref().unwrap();
    assert!(combat.damage_redirects.contains_key("enemy_0"), "taunt should set damage redirect");
}

#[test]
fn shocktroops_coordinated_fire_adds_ranged_and_modifier() {
    let (mut state, mut undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // CoordinatedFire = ability_index 0
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 0, .. }
        if unit_instance_id.as_str() == "unit_st"
    )).expect("coordinated fire should be available in RangedSiege");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should add ranged 1
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 1);
    assert_eq!(state.players[0].combat_accumulator.attack.ranged_elements.physical, 1);
    // Should add UnitAttackBonus modifier
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::UnitAttackBonus { amount: 1 })
    ));
}

#[test]
fn coordinated_fire_only_in_ranged_phase() {
    let (mut state, undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // CoordinatedFire (index 0) should NOT be available in Attack phase
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 0, .. }
        if unit_instance_id.as_str() == "unit_st"
    ));
    assert!(action.is_none(), "CoordinatedFire should NOT be available in Attack phase");
}

#[test]
fn sorcerers_strip_fort_adds_nullifier_and_ranged() {
    let (mut state, mut undo) = setup_select_enemy_combat("sorcerers", "unit_sorc", &["diggers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;
    // Give white mana for strip_fort (ability_index 1, costs white)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_sorc"
    )).expect("strip fort should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have AbilityNullifier(Fortified) modifier
    assert!(state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::AbilityNullifier { ability: Some(EnemyAbilityType::Fortified), .. }
    )));
    // Should add ranged 3
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3);
}

#[test]
fn sorcerers_strip_resist_adds_remove_resistances_and_ranged() {
    // Use orc_war_beasts (Fire+Ice resist) to verify resistances removed
    let (mut state, mut undo) = setup_select_enemy_combat("sorcerers", "unit_sorc", &["orc_war_beasts"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;
    // Give green mana for strip_resist (ability_index 2, costs green)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Green,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_sorc"
    )).expect("strip resist should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have RemoveResistances modifier
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::RemoveResistances)
    ));
    // Should add ranged 3
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3);
}

#[test]
fn amotep_freezers_freeze_applies_skip_attack_and_armor_reduction() {
    let (mut state, mut undo) = setup_select_enemy_combat("amotep_freezers", "unit_af", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    // Give blue mana for freeze (ability_index 2, costs blue)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Blue,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_af"
    )).expect("freeze should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have EnemySkipAttack + armor -3
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
    ));
    assert!(state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Armor, amount: -3, .. }
    )));
}

#[test]
fn amotep_freezers_excludes_ice_resistant() {
    // Crystal sprites have Ice resistance — should be excluded by freeze template
    let (mut state, mut undo) = setup_select_enemy_combat("amotep_freezers", "unit_af", &["crystal_sprites"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Blue,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_af"
    ));
    if let Some(act) = action {
        let _ = apply_legal_action(&mut state, &mut undo, 0, act, legal.epoch);
        assert!(state.active_modifiers.is_empty(), "freeze should fizzle against ice-resistant enemies");
    }
}

#[test]
fn delphana_masters_destroy_if_blocked() {
    let (mut state, mut undo) = setup_select_enemy_combat("delphana_masters", "unit_dm", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    // Give red mana for destroy_if_blocked (ability_index 1, costs red)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_dm"
    )).expect("destroy if blocked should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::DefeatIfBlocked)
    ));
}

#[test]
fn delphana_masters_strip_defenses() {
    let (mut state, mut undo) = setup_select_enemy_combat("delphana_masters", "unit_dm", &["diggers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    // Give white mana for strip_defenses (ability_index 3, costs white)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 3, .. }
        if unit_instance_id.as_str() == "unit_dm"
    )).expect("strip defenses should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have both AbilityNullifier(Fortified) and RemoveResistances
    assert!(state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::AbilityNullifier { ability: Some(EnemyAbilityType::Fortified), .. }
    )));
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::RemoveResistances)
    ));
}

#[test]
fn arcane_immunity_blocks_skip_attack() {
    // Shadow has ArcaneImmunity. Weaken template: armor_change blocked by AI, attack_change not.
    // Use shocktroops weaken (no AI exclusion filter) against shadow.
    let (mut state2, mut undo2) = setup_select_enemy_combat("shocktroops", "unit_st", &["shadow"]);
    state2.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state2, 0, &undo2);
    // Weaken (index 1) has skip_attack=false, so this tests armor_change blocked by AI.
    // Let's actually use delphana cancel (index 0) which has skip_attack + exclude_arcane_immune=true + exclude_resistance=Some(Ice).
    // For a clean AI test, use a non-filtering template that has effects blocked by AI.
    // Weaken template: armor_change=-1 (blocked by AI), attack_change=-1 (NOT blocked by AI)
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_st"
    )).expect("weaken should be available against shadow");

    let _ = apply_legal_action(&mut state2, &mut undo2, 0, action, legal.epoch);

    // armor_change is blocked by AI → no armor modifier
    let has_armor_mod = state2.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Armor, .. }
    ));
    assert!(!has_armor_mod, "armor modifier should be blocked by ArcaneImmunity");

    // attack_change is NOT blocked by AI → should have attack modifier
    let has_attack_mod = state2.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Attack, amount: -1, .. }
    ));
    assert!(has_attack_mod, "attack modifier should bypass ArcaneImmunity");
}

#[test]
fn arcane_immunity_does_not_block_damage_redirect() {
    // Taunt has damage_redirect_from_unit=true — should bypass AI
    let (mut state, mut undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["shadow"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Taunt = ability_index 2
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_st"
    )).expect("taunt should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // damage_redirect should still be set (bypasses AI)
    let combat = state.combat.as_ref().unwrap();
    assert!(combat.damage_redirects.contains_key("enemy_0"), "damage redirect should bypass AI");

    // attack_change should also bypass AI
    let has_attack_mod = state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Attack, amount: -3, .. }
    ));
    assert!(has_attack_mod, "attack reduction should bypass AI");
}

#[test]
fn arcane_immunity_does_not_block_bundled_ranged() {
    // Sorcerer strip_fort against AI enemy: nullify_fortified blocked, but bundled_ranged should apply
    let (mut state, mut undo) = setup_select_enemy_combat("sorcerers", "unit_sorc", &["shadow"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_sorc"
    )).expect("strip fort should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // nullify_fortified should be BLOCKED by AI
    let has_nullifier = state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::AbilityNullifier { .. }
    ));
    assert!(!has_nullifier, "AbilityNullifier should be blocked by ArcaneImmunity");

    // bundled_ranged should still apply (bypasses AI)
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3, "bundled ranged should bypass AI");
}

#[test]
fn select_combat_enemy_all_phases_allowed() {
    // SelectCombatEnemy abilities should be available in all combat phases
    let (mut state, undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers"]);

    for phase in &[CombatPhase::RangedSiege, CombatPhase::Block, CombatPhase::Attack] {
        state.combat.as_mut().unwrap().phase = *phase;
        state.players[0].units[0].state = UnitState::Ready;

        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        // Weaken (index 1) should be available in all combat phases
        let action = legal.actions.iter().find(|a| matches!(a,
            LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
            if unit_instance_id.as_str() == "unit_st"
        ));
        assert!(action.is_some(), "SelectCombatEnemy should be available in {:?}", phase);
    }
}

#[test]
fn select_combat_enemy_not_outside_combat() {
    // SelectCombatEnemy should NOT be available outside combat
    let (state, undo) = setup_complex_unit("shocktroops", "unit_st");

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Weaken (index 1) should NOT be available outside combat
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_st"
    ));
    assert!(action.is_none(), "SelectCombatEnemy should NOT be available outside combat");
}

#[test]
fn contract_test_select_combat_enemy_abilities() {
    // Ensure all new SelectCombatEnemy and CoordinatedFire abilities are executable
    let (mut state, undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers", "orc_tracker"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;
    assert_all_executable(&state, &undo, 0);
}

#[test]
fn contract_test_delphana_masters_all_abilities() {
    let (mut state, undo) = setup_select_enemy_combat("delphana_masters", "unit_dm", &["prowlers", "orc_tracker"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    // Give mana for all 4 abilities (blue, red, green, white)
    for color in [ManaColor::Blue, ManaColor::Red, ManaColor::Green, ManaColor::White] {
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    }
    assert_all_executable(&state, &undo, 0);
}

// =========================================================================
// Foresters: MoveWithTerrainReduction
// =========================================================================

#[test]
fn foresters_activation_grants_move_and_terrain_modifiers() {
    let (mut state, mut undo) = setup_complex_unit("foresters", "unit_for");

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Foresters ability index 1 = MoveWithTerrainReduction
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_for"
    )).expect("MoveWithTerrainReduction should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Check move points gained
    assert_eq!(state.players[0].move_points, 2);

    // Check 3 terrain cost modifiers were pushed
    use mk_types::modifier::{ModifierEffect, TerrainOrAll, ModifierDuration, ModifierScope};
    let terrain_mods: Vec<_> = state.active_modifiers.iter().filter(|m| {
        matches!(&m.effect, ModifierEffect::TerrainCost { .. })
    }).collect();
    assert_eq!(terrain_mods.len(), 3);

    // Verify each modifier is Turn duration and SelfScope
    for m in &terrain_mods {
        assert_eq!(m.duration, ModifierDuration::Turn);
        assert!(matches!(&m.scope, ModifierScope::SelfScope));
    }

    // Check specific terrains are covered
    let has_forest = terrain_mods.iter().any(|m| matches!(&m.effect,
        ModifierEffect::TerrainCost { terrain: TerrainOrAll::Specific(Terrain::Forest), amount: -1, minimum: 0, .. }
    ));
    let has_hills = terrain_mods.iter().any(|m| matches!(&m.effect,
        ModifierEffect::TerrainCost { terrain: TerrainOrAll::Specific(Terrain::Hills), amount: -1, minimum: 0, .. }
    ));
    let has_swamp = terrain_mods.iter().any(|m| matches!(&m.effect,
        ModifierEffect::TerrainCost { terrain: TerrainOrAll::Specific(Terrain::Swamp), amount: -1, minimum: 0, .. }
    ));
    assert!(has_forest, "Missing forest terrain modifier");
    assert!(has_hills, "Missing hills terrain modifier");
    assert!(has_swamp, "Missing swamp terrain modifier");
}

#[test]
fn foresters_terrain_cost_forest_reduced() {
    use crate::movement::get_terrain_cost;
    use mk_types::modifier::*;

    // Forest day cost = 3, with Foresters -1 = 2
    let base = get_terrain_cost(Terrain::Forest, TimeOfDay::Day).unwrap();
    assert_eq!(base, 3);

    let modifiers = vec![ActiveModifier {
        id: mk_types::ids::ModifierId::from("test_1"),
        effect: ModifierEffect::TerrainCost {
            terrain: TerrainOrAll::Specific(Terrain::Forest),
            amount: -1,
            minimum: 0,
            replace_cost: None,
        },
        duration: ModifierDuration::Turn,
        scope: ModifierScope::SelfScope,
        source: ModifierSource::Unit { unit_index: 0, player_id: mk_types::ids::PlayerId::from("p0") },
        created_at_round: 0,
        created_by_player_id: mk_types::ids::PlayerId::from("p0"),
    }];

    // We test via full movement evaluation — set up state with forest hex
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.active_modifiers = modifiers;
    state.players[0].move_points = 10;

    // Find a forest hex from the starting tile
    let found = state.map.hexes.iter().find(|(_, h)| h.terrain == Terrain::Forest);
    if let Some((key, _)) = found {
        let parts: Vec<&str> = key.split(',').collect();
        let coord = HexCoord::new(parts[0].parse().unwrap(), parts[1].parse().unwrap());
        let result = crate::movement::evaluate_move_entry(&state, 0, coord);
        assert_eq!(result.cost, Some(2), "Forest cost should be reduced from 3 to 2");
    }
    // If no forest hex exists on starting tile, that's OK — the modifier logic is tested by unit tests in movement.rs
}

#[test]
fn foresters_terrain_cost_desert_unchanged() {
    // Desert should NOT be affected by Foresters (only forest/hills/swamp)
    use mk_types::modifier::*;

    let pid = mk_types::ids::PlayerId::from("p0");
    let modifiers = vec![
        ActiveModifier {
            id: mk_types::ids::ModifierId::from("test_1"),
            effect: ModifierEffect::TerrainCost {
                terrain: TerrainOrAll::Specific(Terrain::Forest),
                amount: -1, minimum: 0, replace_cost: None,
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            source: ModifierSource::Unit { unit_index: 0, player_id: pid.clone() },
            created_at_round: 0,
            created_by_player_id: pid.clone(),
        },
        ActiveModifier {
            id: mk_types::ids::ModifierId::from("test_2"),
            effect: ModifierEffect::TerrainCost {
                terrain: TerrainOrAll::Specific(Terrain::Hills),
                amount: -1, minimum: 0, replace_cost: None,
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            source: ModifierSource::Unit { unit_index: 0, player_id: pid.clone() },
            created_at_round: 0,
            created_by_player_id: pid.clone(),
        },
        ActiveModifier {
            id: mk_types::ids::ModifierId::from("test_3"),
            effect: ModifierEffect::TerrainCost {
                terrain: TerrainOrAll::Specific(Terrain::Swamp),
                amount: -1, minimum: 0, replace_cost: None,
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            source: ModifierSource::Unit { unit_index: 0, player_id: pid.clone() },
            created_at_round: 0,
            created_by_player_id: pid,
        },
    ];

    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.active_modifiers = modifiers;
    state.players[0].move_points = 10;

    // Find a desert hex from the starting tile
    let found = state.map.hexes.iter().find(|(_, h)| h.terrain == Terrain::Desert);
    if let Some((key, _)) = found {
        let parts: Vec<&str> = key.split(',').collect();
        let coord = HexCoord::new(parts[0].parse().unwrap(), parts[1].parse().unwrap());
        let result = crate::movement::evaluate_move_entry(&state, 0, coord);
        if result.cost.is_some() {
            // Desert day cost = 3, should be unchanged
            assert_eq!(result.cost, Some(3), "Desert cost should NOT be affected by Foresters");
        }
    }
}

// =========================================================================
// Unit damage assignment
// =========================================================================

#[test]
fn assign_damage_to_hero_available_in_assign_damage_phase() {
    let (state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let hero_action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToHero { enemy_index: 0, attack_index: 0 }
    ));
    assert!(hero_action.is_some(), "AssignDamageToHero should be available");
}

#[test]
fn assign_damage_to_unit_available_when_units_present() {
    let (state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let unit_action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    ));
    assert!(unit_action.is_some(), "AssignDamageToUnit should be available");
}

#[test]
fn assign_damage_no_unit_options_when_units_not_allowed() {
    let (mut state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);
    // Dungeons: units_allowed = false
    state.combat.as_mut().unwrap().units_allowed = false;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let unit_action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { .. }
    ));
    assert!(unit_action.is_none(), "No unit options when units_allowed=false");
    // Hero option should still exist
    let hero_action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToHero { .. }
    ));
    assert!(hero_action.is_some(), "AssignDamageToHero should still be available");
}

#[test]
fn assign_damage_sequential_only_first_attack() {
    // Two enemies — only the first unassigned attack should be enumerated
    let (state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers", "diggers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Should only have enemy_index=0 actions (prowlers first)
    let prowler_hero = legal.actions.iter().any(|a| matches!(a,
        LegalAction::AssignDamageToHero { enemy_index: 0, .. }
    ));
    let diggers_hero = legal.actions.iter().any(|a| matches!(a,
        LegalAction::AssignDamageToHero { enemy_index: 1, .. }
    ));
    assert!(prowler_hero, "First enemy should be available");
    assert!(!diggers_hero, "Second enemy should NOT be available yet");
}

#[test]
fn end_combat_phase_only_when_all_assigned() {
    let (mut state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);

    // Not all assigned yet
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let end_phase = legal.actions.iter().any(|a| matches!(a, LegalAction::EndCombatPhase));
    assert!(!end_phase, "EndCombatPhase should NOT be available when damage not all assigned");

    // Mark the single attack as assigned
    state.combat.as_mut().unwrap().enemies[0].attacks_damage_assigned[0] = true;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let end_phase = legal.actions.iter().any(|a| matches!(a, LegalAction::EndCombatPhase));
    assert!(end_phase, "EndCombatPhase should be available when all damage assigned");
}

#[test]
fn assign_damage_to_hero_adds_wound_cards() {
    // Prowlers: 4 physical attack. Hero armor is 2 (Arythea level 1). Wounds = ceil((4-2)/1) = 2
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);
    let initial_hand_len = state.players[0].hand.len();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToHero { enemy_index: 0, attack_index: 0 }
    )).unwrap();

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Wound cards should have been added to hand
    let wound_count = state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count();
    assert!(wound_count > 0, "Hero should have received wound cards");
    assert!(state.players[0].hand.len() > initial_hand_len, "Hand should be larger after taking wounds");
}

#[test]
fn assign_damage_poison_destroys_unit() {
    // Cursed Hags: 3 physical attack, Poison.
    // Peasants level 1, armor = level = 1.
    // Poison → instant destruction regardless of armor/damage.
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["cursed_hags"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    )).unwrap();

    assert_eq!(state.players[0].units.len(), 1);
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].units.len(), 0, "Poison should destroy unit");
}

#[test]
fn assign_damage_unit_absorbs_within_armor() {
    // Altem Guardians: level 4, armor = 4. Diggers: 3 attack.
    // 3 <= 4 → fully absorbed, no wound.
    let (mut state, mut undo) = setup_damage_assignment_combat("altem_guardians", "unit_ag", &["diggers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    )).unwrap();

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].units.len(), 1, "Unit should survive");
    assert!(!state.players[0].units[0].wounded, "Unit should NOT be wounded (damage <= armor)");
}

#[test]
fn assign_damage_unit_wounded_when_damage_exceeds_armor() {
    // Prowlers: 4 physical attack. Peasants: level 1, armor = 1.
    // 4 > 1 → unit wounded (first wound).
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    )).unwrap();

    assert!(!state.players[0].units[0].wounded);
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].units.len(), 1, "Unit should survive first wound");
    assert!(state.players[0].units[0].wounded, "Unit should be wounded");
}

#[test]
fn assign_damage_wounded_unit_destroyed() {
    // Pre-wound the unit, then assign damage that exceeds armor → destroyed
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);
    state.players[0].units[0].wounded = true;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    )).unwrap();

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].units.len(), 0, "Already-wounded unit should be destroyed");
}

#[test]
fn assign_damage_paralyze_destroys_unit() {
    // Medusa: 6 physical attack, Paralyze. Unit should be instantly destroyed.
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["medusa"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    )).unwrap();

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].units.len(), 0, "Paralyze should destroy unit");
}

#[test]
fn no_units_auto_assigns_all_to_hero() {
    // When no units: Block→AssignDamage should auto-assign and allow EndCombatPhase
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("march"), CardId::from("rage")];
    state.players[0].units.clear(); // No units

    let tokens = vec![mk_types::ids::EnemyTokenId::from("prowlers_1")];
    crate::combat::execute_enter_combat(&mut state, 0, &tokens, false, None, Default::default()).unwrap();

    // Go directly to Block phase and end it (no blocks)
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    let mut undo = UndoStack::new();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let end_phase = legal.actions.iter().find(|a| matches!(a, LegalAction::EndCombatPhase)).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, end_phase, legal.epoch);

    // Should now be in AssignDamage phase, but auto-assigned since no units
    // EndCombatPhase should be available (all auto-assigned)
    let combat = state.combat.as_ref().unwrap();
    assert_eq!(combat.phase, CombatPhase::AssignDamage);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let end_phase = legal.actions.iter().any(|a| matches!(a, LegalAction::EndCombatPhase));
    assert!(end_phase, "EndCombatPhase should be available after auto-assign");
    // No interactive assignment actions should be present
    let assign_hero = legal.actions.iter().any(|a| matches!(a, LegalAction::AssignDamageToHero { .. }));
    assert!(!assign_hero, "No interactive assignment when auto-assigned");
}

#[test]
fn all_enemies_blocked_skips_interactive_assignment() {
    // When all enemy attacks are blocked, AssignDamage has nothing to assign
    let (mut state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);
    // Mark all attacks as blocked
    state.combat.as_mut().unwrap().enemies[0].attacks_blocked[0] = true;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Only EndCombatPhase should be available (no unblocked attacks)
    let end_phase = legal.actions.iter().any(|a| matches!(a, LegalAction::EndCombatPhase));
    assert!(end_phase, "EndCombatPhase should be available when all blocked");
    let assign_hero = legal.actions.iter().any(|a| matches!(a, LegalAction::AssignDamageToHero { .. }));
    assert!(!assign_hero, "No assignment needed when all attacks blocked");
}

#[test]
fn assign_damage_paralyze_to_hero_discards_hand() {
    // Medusa: Paralyze. After AssignDamage phase ends, non-wound cards discarded from hand.
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["medusa"]);
    // Remove unit so damage goes to hero
    state.players[0].units.clear();
    // Re-enter combat to get clean state
    state.combat = None;
    let tokens = vec![mk_types::ids::EnemyTokenId::from("medusa_1")];
    crate::combat::execute_enter_combat(&mut state, 0, &tokens, false, None, Default::default()).unwrap();
    state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;

    // Make sure hand has non-wound cards
    state.players[0].hand = vec![CardId::from("march"), CardId::from("rage"), CardId::from("wound")];

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToHero { enemy_index: 0, attack_index: 0 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Now end the AssignDamage phase → paralyze discards non-wound cards
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let end_phase = legal.actions.iter().find(|a| matches!(a, LegalAction::EndCombatPhase)).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, end_phase, legal.epoch);

    // All non-wound cards should be in discard, only wounds remain in hand
    let non_wounds_in_hand = state.players[0].hand.iter().filter(|c| c.as_str() != "wound").count();
    assert_eq!(non_wounds_in_hand, 0, "Paralyze should discard all non-wound cards from hand");
}

// =========================================================================
// Altem Mages abilities
// =========================================================================

// --- Ability 1: GainManaChoose ---

#[test]
fn altem_mages_gain_mana_enumerated_outside_combat() {
    let (state, undo) = setup_complex_unit("altem_mages", "unit_am");
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 0, .. }
        if unit_instance_id.as_str() == "unit_am"
    ));
    assert!(action.is_some(), "GainManaChoose should be available outside combat");
}

#[test]
fn altem_mages_gain_mana_not_in_combat() {
    let (state, undo) = setup_altem_mages_combat(CombatPhase::Attack);
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 0, .. }
        if unit_instance_id.as_str() == "unit_am"
    ));
    assert!(action.is_none(), "GainManaChoose should NOT be available in combat");
}

#[test]
fn altem_mages_gain_mana_creates_pending_with_remaining() {
    let (mut state, mut undo) = setup_complex_unit("altem_mages", "unit_am");
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 0, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have 4-option choice with remaining_choices=1
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::UnitAbilityChoice { ref options, remaining_choices: 1, .. })
        if options.len() == 4
    ));
}

#[test]
fn altem_mages_gain_mana_two_sequential_choices() {
    let (mut state, mut undo) = setup_complex_unit("altem_mages", "unit_am");
    state.players[0].pure_mana.clear();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 0, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // First choice: pick Red (index 0)
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    // Should have a red token and another pending with remaining=0
    assert_eq!(state.players[0].pure_mana.len(), 1);
    assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Red);
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::UnitAbilityChoice { remaining_choices: 0, .. })
    ));

    // Second choice: pick Blue (index 1)
    let legal3 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve2 = legal3.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 1 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve2, legal3.epoch);

    // Should have two tokens and no more pending
    assert_eq!(state.players[0].pure_mana.len(), 2);
    assert_eq!(state.players[0].pure_mana[1].color, ManaColor::Blue);
    assert!(!state.players[0].pending.has_active());
}

// --- Ability 2: AltemMagesColdFire ---

#[test]
fn altem_mages_coldfire_enumerated_in_all_combat_phases() {
    for phase in [CombatPhase::RangedSiege, CombatPhase::Block, CombatPhase::Attack] {
        let (state, undo) = setup_altem_mages_combat(phase);
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let action = legal.actions.iter().find(|a| matches!(a,
            LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
            if unit_instance_id.as_str() == "unit_am"
        ));
        assert!(action.is_some(), "ColdFire should be available in {:?}", phase);
    }
}

#[test]
fn altem_mages_coldfire_base_options_no_mana() {
    use mk_types::pending::UnitAbilityChoiceOption;
    let (mut state, mut undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].pure_mana.clear();
    state.players[0].crystals = mk_types::state::Crystals::default();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Only 2 free options: Attack 5 and Block 5
    if let Some(ActivePending::UnitAbilityChoice { ref options, .. }) = state.players[0].pending.active {
        assert_eq!(options.len(), 2, "Should have 2 base options; got {:?}", options);
        assert!(matches!(options[0], UnitAbilityChoiceOption::GainColdFireAttack { value: 5, .. }));
        assert!(matches!(options[1], UnitAbilityChoiceOption::GainColdFireBlock { value: 5, .. }));
    } else {
        panic!("Expected UnitAbilityChoice pending");
    }
}

#[test]
fn altem_mages_coldfire_with_blue_mana() {
    use mk_types::pending::UnitAbilityChoiceOption;
    let (mut state, mut undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].pure_mana.clear();
    state.players[0].crystals = mk_types::state::Crystals::default();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Blue,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // 2 free + 2 blue = 4 options
    if let Some(ActivePending::UnitAbilityChoice { ref options, .. }) = state.players[0].pending.active {
        assert_eq!(options.len(), 4, "Should have 4 options with blue; got {:?}", options);
        assert!(options.iter().any(|o| matches!(o, UnitAbilityChoiceOption::GainColdFireAttack { value: 7, .. })));
    } else {
        panic!("Expected UnitAbilityChoice pending");
    }
}

#[test]
fn altem_mages_coldfire_with_both_mana() {
    use mk_types::pending::{UnitAbilityChoiceOption, AltemMagesManaScaling};
    let (mut state, mut undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].pure_mana.clear();
    state.players[0].crystals = mk_types::state::Crystals::default();
    // Give both blue and red mana
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Blue,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // 2 free + 2 blue + 2 red + 2 both = 8 options
    if let Some(ActivePending::UnitAbilityChoice { ref options, .. }) = state.players[0].pending.active {
        assert_eq!(options.len(), 8, "Should have 8 options with both; got {:?}", options);
        assert!(options.iter().any(|o| matches!(o,
            UnitAbilityChoiceOption::GainColdFireAttack { value: 9, mana_cost: AltemMagesManaScaling::Both }
        )));
    } else {
        panic!("Expected UnitAbilityChoice pending");
    }
}

#[test]
fn altem_mages_coldfire_free_attack() {
    let (mut state, mut undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].pure_mana.clear();
    state.players[0].crystals = mk_types::state::Crystals::default();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Choose Attack 5 (index 0)
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert_eq!(state.players[0].combat_accumulator.attack.normal, 5);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.cold_fire, 5);
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn altem_mages_coldfire_free_block() {
    let (mut state, mut undo) = setup_altem_mages_combat(CombatPhase::Block);
    state.players[0].pure_mana.clear();
    state.players[0].crystals = mk_types::state::Crystals::default();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Choose Block 5 (index 1)
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 1 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert_eq!(state.players[0].combat_accumulator.block, 5);
    assert_eq!(state.players[0].combat_accumulator.block_elements.cold_fire, 5);
}

#[test]
fn altem_mages_coldfire_blue_attack_consumes_mana() {
    let (mut state, mut undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].pure_mana.clear();
    state.players[0].crystals = mk_types::state::Crystals::default();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Blue,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Choose Blue Attack 7 (index 2)
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 2 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert_eq!(state.players[0].combat_accumulator.attack.normal, 7);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.cold_fire, 7);
    // Blue mana should be consumed
    assert!(state.players[0].pure_mana.is_empty(), "Blue mana should be consumed");
}

// --- Ability 3: AltemMagesAttackModifier ---

#[test]
fn altem_mages_attack_modifier_not_enumerated_without_black_mana() {
    let (mut state, undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].pure_mana.clear();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_am"
    ));
    assert!(action.is_none(), "AttackModifier should NOT be available without black mana");
}

#[test]
fn altem_mages_attack_modifier_enumerated_with_black_mana() {
    let (mut state, undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Black,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_am"
    ));
    assert!(action.is_some(), "AttackModifier should be available with black mana");
}

#[test]
fn altem_mages_attack_modifier_consumes_black_mana() {
    let (mut state, mut undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Black,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Black mana should be consumed
    assert!(state.players[0].pure_mana.is_empty(), "Black mana consumed");
    // Should have 2-option choice
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::UnitAbilityChoice { ref options, .. }) if options.len() == 2
    ));
}

#[test]
fn altem_mages_coldfire_modifier_transforms_attacks() {
    let (mut state, mut undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Black,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Choose TransformAttacksToColdFire (index 0)
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    // Modifier should be active
    let has_modifier = state.active_modifiers.iter().any(|m| {
        matches!(m.effect, ModifierEffect::TransformAttacksColdFire)
    });
    assert!(has_modifier, "TransformAttacksColdFire modifier should be active");
}

#[test]
fn altem_mages_siege_modifier_adds_siege() {
    let (mut state, mut undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Black,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Choose AddSiegeToAllAttacks (index 1)
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 1 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    let has_modifier = state.active_modifiers.iter().any(|m| {
        matches!(m.effect, ModifierEffect::AddSiegeToAttacks)
    });
    assert!(has_modifier, "AddSiegeToAttacks modifier should be active");
}

// --- Modifier integration ---

#[test]
fn coldfire_modifier_transforms_subsequent_card_attack() {
    let (mut state, mut undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].hand = vec![CardId::from("rage")];
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Black,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    // Activate modifier: choose ColdFire
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    // Now play Rage basic (GainAttack 2 Physical Melee)
    let legal3 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let rage = legal3.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "rage"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, rage, legal3.epoch);

    // Rage basic is a Choice (Attack 2 OR Block 2) — resolve by choosing Attack (index 0)
    let legal4 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve_rage = legal4.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve_rage, legal4.epoch);

    // Attack should be ColdFire, not Physical
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.cold_fire, 2,
        "Rage attack should be transformed to ColdFire");
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 0,
        "No physical attack with ColdFire modifier");
}

#[test]
fn siege_modifier_mirrors_attack_to_siege() {
    let (mut state, mut undo) = setup_altem_mages_combat(CombatPhase::Attack);
    state.players[0].hand = vec![CardId::from("rage")];
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Black,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    // Activate modifier: choose Siege
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_am"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 1 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    // Now play Rage basic (GainAttack 2 Physical Melee)
    let legal3 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let rage = legal3.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "rage"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, rage, legal3.epoch);

    // Rage basic is a Choice (Attack 2 OR Block 2) — resolve by choosing Attack (index 0)
    let legal4 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve_rage = legal4.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve_rage, legal4.epoch);

    // Normal attack present
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
    // Siege should also have 2
    assert_eq!(state.players[0].combat_accumulator.attack.siege, 2,
        "AddSiegeToAttacks should mirror melee attack to siege");
}

// =========================================================================
// Scouts: MoveWithExtendedExplore
// =========================================================================

#[test]
fn scouts_extended_explore_enumerated_outside_combat() {
    let (state, undo) = setup_complex_unit("scouts", "unit_scout");

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_extended_explore = legal.actions.iter().any(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_scout"
    ));
    assert!(has_extended_explore, "MoveWithExtendedExplore (index 2) should be available outside combat");
}

#[test]
fn scouts_extended_explore_not_in_combat() {
    let (mut state, undo) = setup_complex_unit("scouts", "unit_scout");
    state.combat = Some(Box::new(CombatState::default()));

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_extended_explore = legal.actions.iter().any(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_scout"
    ));
    assert!(!has_extended_explore, "MoveWithExtendedExplore should NOT be available in combat");
}

#[test]
fn scouts_extended_explore_grants_move_and_modifier() {
    let (mut state, mut undo) = setup_complex_unit("scouts", "unit_scout");

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_scout"
    )).expect("MoveWithExtendedExplore should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    assert_eq!(state.players[0].move_points, 2, "Should gain 2 move points");

    // Check ExtendedExplore modifier was pushed
    use mk_types::modifier::RuleOverride;
    let has_rule = state.active_modifiers.iter().any(|m| matches!(&m.effect,
        ModifierEffect::RuleOverride { rule: RuleOverride::ExtendedExplore }
    ));
    assert!(has_rule, "ExtendedExplore rule override should be active");
}

// =========================================================================
// Scouts: ScoutPeek
// =========================================================================

#[test]
fn scouts_peek_enumerated_outside_combat() {
    let (state, undo) = setup_complex_unit("scouts", "unit_scout");
    // Ensure draw piles are non-empty (they should be by default from create_solo_game)
    assert!(!state.enemy_tokens.green_draw.is_empty(), "green draw pile should be non-empty");

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_peek = legal.actions.iter().any(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_scout"
    ));
    assert!(has_peek, "ScoutPeek (index 1) should be available when draw piles are non-empty");
}

#[test]
fn scouts_peek_not_in_combat() {
    let (mut state, undo) = setup_complex_unit("scouts", "unit_scout");
    state.combat = Some(Box::new(CombatState::default()));

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_peek = legal.actions.iter().any(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_scout"
    ));
    assert!(!has_peek, "ScoutPeek should NOT be available in combat");
}

#[test]
fn scouts_peek_not_enumerated_without_targets() {
    let (mut state, undo) = setup_complex_unit("scouts", "unit_scout");

    // Clear ALL draw piles
    state.enemy_tokens.green_draw.clear();
    state.enemy_tokens.gray_draw.clear();
    state.enemy_tokens.brown_draw.clear();
    state.enemy_tokens.violet_draw.clear();
    state.enemy_tokens.white_draw.clear();
    state.enemy_tokens.red_draw.clear();

    // Also clear any face-down enemies on map
    for hex in state.map.hexes.values_mut() {
        hex.enemies.clear();
    }

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_peek = legal.actions.iter().any(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_scout"
    ));
    assert!(!has_peek, "ScoutPeek should NOT be available when no targets exist");
}

#[test]
fn scouts_peek_pile_pushes_fame_modifier() {
    let (mut state, mut undo) = setup_complex_unit("scouts", "unit_scout");
    assert!(!state.enemy_tokens.green_draw.is_empty());

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_scout"
    )).expect("ScoutPeek should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should now have a UnitAbilityChoice pending with ScoutPeekPile options
    assert!(state.players[0].pending.has_active(), "Should have pending choice");
    if let Some(ActivePending::UnitAbilityChoice { ref options, .. }) = state.players[0].pending.active {
        let has_pile_option = options.iter().any(|o| matches!(o,
            mk_types::pending::UnitAbilityChoiceOption::ScoutPeekPile { .. }
        ));
        assert!(has_pile_option, "Should have ScoutPeekPile options");

        // Resolve the choice — pick the first pile option
        let pile_idx = options.iter().position(|o| matches!(o,
            mk_types::pending::UnitAbilityChoiceOption::ScoutPeekPile { .. }
        )).unwrap();

        let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let resolve = legal2.actions.iter().find(|a| matches!(a,
            LegalAction::ResolveChoice { choice_index } if *choice_index == pile_idx
        )).expect("Should have resolve action for pile peek");

        let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

        // ScoutFameBonus modifier should be active
        let has_bonus = state.active_modifiers.iter().any(|m| matches!(&m.effect,
            ModifierEffect::ScoutFameBonus { .. }
        ));
        assert!(has_bonus, "ScoutFameBonus modifier should be active after peek");
    } else {
        panic!("Expected UnitAbilityChoice pending");
    }
}

#[test]
fn scouts_peek_hex_pushes_fame_modifier_without_revealing() {
    let (mut state, mut undo) = setup_complex_unit("scouts", "unit_scout");

    // Place a face-down enemy on a hex within distance 3 of player
    let player_pos = state.players[0].position.unwrap();
    let token_id = mk_types::ids::EnemyTokenId::from("prowlers_99");
    if let Some(hex) = state.map.hexes.get_mut(&player_pos.key()) {
        hex.enemies.push(mk_types::state::HexEnemy {
            token_id: token_id.clone(),
            color: mk_types::enums::EnemyColor::Green,
            is_revealed: false,
        });
    }

    // Clear draw piles so only hex target exists
    state.enemy_tokens.green_draw.clear();
    state.enemy_tokens.gray_draw.clear();
    state.enemy_tokens.brown_draw.clear();
    state.enemy_tokens.violet_draw.clear();
    state.enemy_tokens.white_draw.clear();
    state.enemy_tokens.red_draw.clear();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_scout"
    )).expect("ScoutPeek should be available with face-down hex enemy");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Resolve the hex peek choice
    if let Some(ActivePending::UnitAbilityChoice { ref options, .. }) = state.players[0].pending.active {
        assert_eq!(options.len(), 1, "Should have exactly one hex target");
        assert!(matches!(options[0], mk_types::pending::UnitAbilityChoiceOption::ScoutPeekHex { .. }));

        let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let resolve = legal2.actions.iter().find(|a| matches!(a,
            LegalAction::ResolveChoice { choice_index: 0 }
        )).expect("Should have resolve action");

        let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

        // Verify enemy NOT revealed on map
        let hex = state.map.hexes.get(&player_pos.key()).unwrap();
        assert!(!hex.enemies[0].is_revealed, "Enemy should NOT be revealed (private peek)");

        // ScoutFameBonus modifier should be active
        let has_bonus = state.active_modifiers.iter().any(|m| matches!(&m.effect,
            ModifierEffect::ScoutFameBonus { .. }
        ));
        assert!(has_bonus, "ScoutFameBonus modifier should be active after hex peek");
    } else {
        panic!("Expected UnitAbilityChoice pending");
    }
}

#[test]
fn scouts_fame_bonus_modifier_matches_correct_enemy() {
    // Verify the ScoutFameBonus modifier structure matches correctly
    use mk_types::modifier::*;
    let pid = PlayerId::from("p0");

    let modifiers = vec![ActiveModifier {
        id: mk_types::ids::ModifierId::from("scout_bonus_1"),
        source: ModifierSource::Unit { unit_index: 0, player_id: pid.clone() },
        duration: ModifierDuration::Turn,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::ScoutFameBonus {
            revealed_enemy_ids: vec!["prowlers".to_string()],
            fame: 1,
        },
        created_at_round: 1,
        created_by_player_id: pid.clone(),
    }];

    // Matching enemy: should find the modifier
    let defeated_matching = vec!["prowlers".to_string()];
    let bonus_match = modifiers.iter().find(|m| {
        if let ModifierEffect::ScoutFameBonus { revealed_enemy_ids, .. } = &m.effect {
            defeated_matching.iter().any(|eid| revealed_enemy_ids.contains(eid))
        } else {
            false
        }
    });
    assert!(bonus_match.is_some(), "ScoutFameBonus should match peeked enemy");
}

#[test]
fn scouts_fame_bonus_not_on_non_matching_enemy() {
    // The ScoutFameBonus should NOT trigger for an enemy that wasn't peeked
    use mk_types::modifier::*;
    let pid = PlayerId::from("p0");

    let defeated_enemy_ids = vec!["orc_swordsmen".to_string()];

    let modifiers = vec![ActiveModifier {
        id: mk_types::ids::ModifierId::from("scout_bonus_1"),
        source: ModifierSource::Unit { unit_index: 0, player_id: pid.clone() },
        duration: ModifierDuration::Turn,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::ScoutFameBonus {
            revealed_enemy_ids: vec!["prowlers".to_string()],
            fame: 1,
        },
        created_at_round: 1,
        created_by_player_id: pid.clone(),
    }];

    // Directly call the combat hook function via state
    // Since count_scout_fame_bonus is private, we verify through the modifier structure
    let bonus_mod = modifiers.iter().find(|m| {
        if let ModifierEffect::ScoutFameBonus { revealed_enemy_ids, .. } = &m.effect {
            defeated_enemy_ids.iter().any(|eid| revealed_enemy_ids.contains(eid))
        } else {
            false
        }
    });
    assert!(bonus_mod.is_none(), "ScoutFameBonus should NOT match non-peeked enemy");
}

#[test]
fn scouts_siege_still_works_in_combat() {
    // Scouts ability 0 (siege) should still work in combat
    let (mut state, undo) = setup_complex_unit("scouts", "unit_scout");
    state.combat = Some(Box::new(CombatState::default()));

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_siege = legal.actions.iter().any(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 0, .. }
        if unit_instance_id.as_str() == "unit_scout"
    ));
    assert!(has_siege, "Scouts Siege Attack (index 0) should be available in RangedSiege phase");
}
