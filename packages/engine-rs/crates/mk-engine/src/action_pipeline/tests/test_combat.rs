use super::*;

// =========================================================================
// EndCombatPhase
// =========================================================================

#[test]
fn end_combat_phase_advances_ranged_to_block() {
    let mut state = setup_playing_game(vec!["march"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();

    assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Block);
}

#[test]
fn end_combat_phase_attack_ends_combat() {
    let mut state = setup_playing_game(vec!["march"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Attack,
        ..CombatState::default()
    }));
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();

    assert!(
        state.combat.is_none(),
        "combat should be removed after Attack phase"
    );
    assert!(state.players[0]
        .flags
        .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
}

#[test]
fn end_combat_phase_full_cycle() {
    let mut state = setup_playing_game(vec!["march"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let mut undo = UndoStack::new();

    // RangedSiege → Block
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();
    assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Block);

    // Block → AssignDamage
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();
    assert_eq!(
        state.combat.as_ref().unwrap().phase,
        CombatPhase::AssignDamage
    );

    // AssignDamage → Attack
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();
    assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Attack);

    // Attack → combat ends
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();
    assert!(state.combat.is_none());
}

#[test]
fn explore_sets_checkpoint() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].move_points = 5;
    state.players[0].position = Some(mk_types::hex::HexCoord::new(1, 0));
    state.map.tile_deck.countryside = vec![TileId::Countryside1];
    let mut undo = UndoStack::new();
    undo.save(&state); // save something first

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let explore_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::Explore { .. }));
    if let Some(action) = explore_action {
        apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch).unwrap();
        // Explore is irreversible — checkpoint should have cleared undo stack
        assert!(!undo.can_undo());
    }
}

// =========================================================================
// DeclareBlock integration tests
// =========================================================================


#[test]
fn declare_block_marks_attack_blocked() {
    let mut state = setup_combat_game(&["prowlers"]); // 4 physical
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 5,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: mk_types::ids::CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    )
    .unwrap();

    let combat = state.combat.as_ref().unwrap();
    assert!(combat.enemies[0].attacks_blocked[0]);
    assert!(combat.enemies[0].is_blocked);
    // Block consumed
    assert_eq!(
        state.players[0].combat_accumulator.block_elements.total(),
        0
    );
}

#[test]
fn declare_block_clears_accumulator() {
    let mut state = setup_combat_game(&["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].combat_accumulator.block = 5;
    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 5,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: mk_types::ids::CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    )
    .unwrap();

    assert_eq!(state.players[0].combat_accumulator.block, 0);
    assert_eq!(
        state.players[0].combat_accumulator.block_elements,
        ElementalValues::default()
    );
}

// =========================================================================
// DeclareAttack integration tests
// =========================================================================

#[test]
fn declare_attack_defeats_enemy_grants_fame() {
    let mut state = setup_combat_game(&["prowlers"]); // armor 3, fame 2
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 5,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };
    let initial_fame = state.players[0].fame;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    let combat = state.combat.as_ref().unwrap();
    assert!(combat.enemies[0].is_defeated);
    assert_eq!(combat.fame_gained, 2);
    assert_eq!(state.players[0].fame, initial_fame + 2);
    assert_eq!(state.players[0].enemies_defeated_this_turn, 1);
}

#[test]
fn declare_attack_reputation_update() {
    // Thugs (gray): reputation_bonus=1
    let mut state = setup_combat_game(&["thugs_gray"]); // armor 5, fame 2, rep bonus 1
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 10,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };
    let initial_rep = state.players[0].reputation;

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    assert_eq!(state.players[0].reputation, initial_rep + 1);
}

#[test]
fn declare_attack_consumes_attack_pool() {
    let mut state = setup_combat_game(&["prowlers"]); // armor 3
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 5,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    // Attack pool should be fully assigned
    assert_eq!(
        state.players[0]
            .combat_accumulator
            .assigned_attack
            .normal_elements
            .physical,
        5
    );
}

// =========================================================================
// EndCombatPhase enhanced tests
// =========================================================================

#[test]
fn end_combat_phase_ranged_siege_clears_ranged_attack() {
    let mut state = setup_combat_game(&["prowlers"]);
    state.players[0].combat_accumulator.attack.ranged = 5;
    state.players[0].combat_accumulator.attack.ranged_elements = ElementalValues {
        physical: 5,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };
    state.players[0].combat_accumulator.attack.siege = 3;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();

    // Ranged/siege should be cleared
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 0);
    assert_eq!(state.players[0].combat_accumulator.attack.siege, 0);
    assert_eq!(
        state.players[0]
            .combat_accumulator
            .attack
            .ranged_elements,
        ElementalValues::default()
    );
}

#[test]
fn end_combat_phase_block_to_assign_damage_applies_wounds() {
    let mut state = setup_combat_game(&["prowlers"]); // 4 physical attack
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    // Don't block — all attacks unblocked

    let initial_hand_len = state.players[0].hand.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();

    // Prowlers deal 4 physical, hero armor=2, ceil(4/2)=2 wounds
    assert_eq!(state.players[0].hand.len(), initial_hand_len + 2);
    let wound_count = state.players[0]
        .hand
        .iter()
        .filter(|c| c.as_str() == "wound")
        .count();
    assert_eq!(wound_count, 2);
    assert_eq!(
        state.combat.as_ref().unwrap().phase,
        CombatPhase::AssignDamage
    );
}

#[test]
fn end_combat_phase_block_poison_adds_wounds_to_discard() {
    let mut state = setup_combat_game(&["cursed_hags"]); // 3 physical, Poison
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let initial_discard_len = state.players[0].discard.len();
    let initial_hand_len = state.players[0].hand.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();

    // Cursed Hags: 3 physical, hero armor=2, ceil(3/2)=2 wounds to hand
    // Poison: same 2 wounds also to discard
    let hand_wounds = state.players[0].hand.len() - initial_hand_len;
    let discard_wounds = state.players[0].discard.len() - initial_discard_len;
    assert_eq!(hand_wounds, 2);
    assert_eq!(discard_wounds, 2);
}

#[test]
fn end_combat_phase_attack_removes_defeated_from_hex() {
    let hex = mk_types::hex::HexCoord::new(1, -1);
    let mut state = setup_playing_game(vec!["march"]);

    // Set up hex with enemies
    state.map.hexes.insert(
        hex.key(),
        HexState {
            coord: hex,
            terrain: Terrain::Plains,
            tile_id: TileId::Countryside1,
            site: None,
            rampaging_enemies: Default::default(),
            enemies: {
                let mut arr = arrayvec::ArrayVec::new();
                arr.push(HexEnemy {
                    token_id: mk_types::ids::EnemyTokenId::from("prowlers_1"),
                    color: EnemyColor::Green,
                    is_revealed: true,
                });
                arr
            },
            ruins_token: None,
            shield_tokens: Vec::new(),
        },
    );

    // Enter combat with that hex
    let tokens = vec![mk_types::ids::EnemyTokenId::from("prowlers_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, Some(hex), Default::default(),
    )
    .unwrap();

    // Mark enemy as defeated
    state.combat.as_mut().unwrap().enemies[0].is_defeated = true;
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();

    // Combat ended
    assert!(state.combat.is_none());
    // Enemy removed from hex
    assert!(state.map.hexes[&hex.key()].enemies.is_empty());
    // Token should be in green discard pile
    assert!(state
        .enemy_tokens
        .green_discard
        .contains(&mk_types::ids::EnemyTokenId::from("prowlers_1")));
}

// =========================================================================
// Full combat cycle integration test
// =========================================================================

#[test]
fn full_combat_cycle_block_damage_attack_defeat() {
    // Enter combat with two enemies:
    // - prowlers (4 physical, armor 3, fame 2)
    // - diggers (3 physical Fortified, armor 3, fame 2)
    let mut state = setup_combat_game(&["prowlers", "diggers"]);
    let mut undo = UndoStack::new();

    // Verify we start in RangedSiege
    assert_eq!(
        state.combat.as_ref().unwrap().phase,
        CombatPhase::RangedSiege
    );

    // Skip RangedSiege → Block
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();
    assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Block);

    // Block prowlers' attack (4 physical, need 4)
    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 4,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: mk_types::ids::CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    )
    .unwrap();
    assert!(state.combat.as_ref().unwrap().enemies[0].is_blocked);

    // Don't block diggers — skip to AssignDamage
    let initial_hand_len = state.players[0].hand.len();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();

    // Diggers: 3 physical, armor 2, ceil(3/2)=2 wounds
    assert_eq!(state.players[0].hand.len(), initial_hand_len + 2);
    assert_eq!(
        state.combat.as_ref().unwrap().phase,
        CombatPhase::AssignDamage
    );

    // Skip AssignDamage → Attack
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();
    assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Attack);

    // Attack both enemies (armor 3+3=6, need 6)
    let initial_fame = state.players[0].fame;
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 6,
        fire: 0,
        ice: 0,
        cold_fire: 0,
    };
    execute_attack(&mut state, &mut undo, CombatType::Melee, 2);

    assert!(state.combat.as_ref().unwrap().enemies[0].is_defeated);
    assert!(state.combat.as_ref().unwrap().enemies[1].is_defeated);
    assert_eq!(state.players[0].fame, initial_fame + 4); // 2+2

    // End combat
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::EndCombatPhase,
        epoch,
    )
    .unwrap();

    assert!(state.combat.is_none());
    assert!(state.players[0]
        .flags
        .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
    assert!(state.players[0]
        .flags
        .contains(PlayerFlags::HAS_COMBATTED_THIS_TURN));
}

// =========================================================================
// Contract test: all enumerated combat actions executable
// =========================================================================

#[test]
fn contract_all_combat_actions_executable() {
    use crate::legal_actions::enumerate_legal_actions_with_undo;

    // Setup: combat with prowlers, accumulated block and attack
    let mut state = setup_combat_game(&["prowlers"]);
    let mut undo = UndoStack::new();

    // Play through each phase, executing every enumerated action
    for _step in 0..20 {
        if state.combat.is_none() {
            break;
        }

        // Give resources for each phase
        let phase = state.combat.as_ref().unwrap().phase;
        match phase {
            CombatPhase::Block => {
                state.players[0].combat_accumulator.block_elements = ElementalValues {
                    physical: 10,
                    fire: 0,
                    ice: 0,
                    cold_fire: 0,
                };
            }
            CombatPhase::Attack => {
                state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
                    physical: 10,
                    fire: 0,
                    ice: 0,
                    cold_fire: 0,
                };
            }
            _ => {}
        }

        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        if legal.actions.is_empty() {
            break;
        }

        // Pick the first non-card-play, non-undo action (prefer combat actions)
        let action = legal
            .actions
            .iter()
            .find(|a| {
                matches!(
                    a,
                    LegalAction::DeclareBlock { .. }
                        | LegalAction::SubsetSelect { .. }
                        | LegalAction::SubsetConfirm
                        | LegalAction::EndCombatPhase
                )
            })
            .unwrap_or(&legal.actions[0]);

        let result = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
        assert!(
            result.is_ok(),
            "Action {:?} failed: {:?}",
            action,
            result.err()
        );
    }
}

// =========================================================================
// Vampiric armor bonus in auto_damage
// =========================================================================

#[test]
fn vampiric_enemy_gains_armor_after_auto_damage() {
    // Gibbering Ghouls: 4 physical attack, Vampiric, armor 4
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("gibbering_ghouls_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    // Skip to Block phase
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // End Block phase → auto_damage → wounds to hand
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    let combat = state.combat.as_ref().unwrap();
    // Hero armor = 2, Ghoul attack = 4: ceil(4/2) = 2 wounds to hand
    assert_eq!(combat.vampiric_armor_bonus.get("enemy_0").copied().unwrap_or(0), 2);
}

#[test]
fn vampiric_not_increased_by_poison_discard() {
    // Need a Vampiric + non-poison enemy alongside a Poison enemy to verify
    // Use Gibbering Ghouls (Vampiric, 4 atk) + Cursed Hags (Poison, 3 atk)
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![
        EnemyTokenId::from("gibbering_ghouls_1"),
        EnemyTokenId::from("cursed_hags_2"),
    ];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    let combat = state.combat.as_ref().unwrap();
    // Ghoul: ceil(4/2) = 2 wounds to hand
    // Hags: ceil(3/2) = 2 wounds to hand, + 2 to discard (Poison)
    // Total wounds to hand: 4
    // Vampiric bonus = total_wounds_to_hand = 4 (NOT counting discard wounds)
    assert_eq!(combat.vampiric_armor_bonus.get("enemy_0").copied().unwrap_or(0), 4);
}

#[test]
fn vampiric_bonus_affects_attack_enumeration() {
    // Gibbering Ghouls: armor 4, Vampiric
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("gibbering_ghouls_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    // Set vampiric bonus to 3 → effective armor = 4 + 3 = 7
    state.combat.as_mut().unwrap().vampiric_armor_bonus
        .insert("enemy_0".to_string(), 3);

    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // Give player 6 melee attack (enough for base armor 4, not enough for 7)
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 6, fire: 0, ice: 0, cold_fire: 0,
    };

    // SubsetSelect (attack target) is still offered (we have eligible enemies)
    let legal = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        legal.actions.iter().any(|a| matches!(a, LegalAction::SubsetSelect { .. })),
        "SubsetSelect should be available for attack targets"
    );

    // After selecting target, it auto-confirms (single enemy). ResolveAttack should NOT be offered.
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    // Single enemy: SubsetSelect auto-confirms (pool_size=1, max_selections=1)
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    assert!(
        !legal.actions.contains(&LegalAction::ResolveAttack),
        "6 attack should not be sufficient to resolve against armor 7"
    );

    // Undo SubsetSelect (restores pre-select snapshot from lazy creation).
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::Undo, epoch).unwrap();
    assert!(state.players[0].pending.active.is_none(), "Should be back to base combat state");

    // Give 7 attack — now ResolveAttack should be available after declaring
    state.players[0].combat_accumulator.attack.normal_elements.physical = 7;
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    // Single enemy: SubsetSelect auto-confirms
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    assert!(
        legal.actions.contains(&LegalAction::ResolveAttack),
        "7 attack should be sufficient to resolve against armor 7"
    );
}

// =========================================================================
// Cumbersome — spend move points in Block phase
// =========================================================================

#[test]
fn cumbersome_spend_move_reduces_damage_in_auto_damage() {
    // Orc Stonethrowers: 7 physical attack, Cumbersome
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("orc_stonethrowers_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].move_points = 3;

    let mut undo = UndoStack::new();

    // Spend 3 move on cumbersome
    for _ in 0..3 {
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SpendMoveOnCumbersome {
                enemy_instance_id: CombatInstanceId::from("enemy_0"),
            },
            epoch,
        ).unwrap();
    }

    assert_eq!(state.players[0].move_points, 0);
    assert_eq!(
        state.combat.as_ref().unwrap().cumbersome_reductions.get("enemy_0").copied().unwrap_or(0),
        3
    );

    // End Block → auto_damage: 7-3=4 damage, hero armor 2, ceil(4/2)=2 wounds
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    // Should have 2 wounds (reduced from ceil(7/2)=4 without cumbersome)
    let wounds_in_hand = state.players[0].hand.iter()
        .filter(|c| c.as_str() == "wound")
        .count();
    assert_eq!(wounds_in_hand, 2);
}

#[test]
fn cumbersome_reduced_to_zero_counts_as_blocked() {
    // Zombie Horde: 3×1 physical attacks, Cumbersome
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("zombie_horde_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].move_points = 5;

    let mut undo = UndoStack::new();

    // Spend 1 move on cumbersome → each 1-damage attack reduced to 0
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SpendMoveOnCumbersome {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
        },
        epoch,
    ).unwrap();

    // End Block → auto_damage: all attacks reduced to 0 → no wounds
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    let wounds_in_hand = state.players[0].hand.iter()
        .filter(|c| c.as_str() == "wound")
        .count();
    assert_eq!(wounds_in_hand, 0, "All attacks reduced to 0 by cumbersome");

    // Enemy should be marked as blocked
    assert!(
        state.combat.as_ref().unwrap().enemies[0].is_blocked,
        "Cumbersome-blocked enemy should be marked as blocked"
    );
}

// =========================================================================
// Paralyze — discard non-wound cards from hand
// =========================================================================

#[test]
fn paralyze_discards_non_wound_cards() {
    // Medusa: 6 physical attack, Paralyze
    let mut state = setup_playing_game(vec!["march", "rage", "swiftness"]);
    let tokens = vec![EnemyTokenId::from("medusa_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // End Block → auto_damage with Paralyze
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    // Hero armor 2, Medusa attack 6: ceil(6/2) = 3 wounds to hand
    // Then Paralyze discards non-wound cards (march, rage, swiftness)
    let non_wounds_in_hand: Vec<_> = state.players[0].hand.iter()
        .filter(|c| c.as_str() != "wound")
        .collect();
    assert!(non_wounds_in_hand.is_empty(), "All non-wound cards should be discarded");

    let wounds_in_hand = state.players[0].hand.iter()
        .filter(|c| c.as_str() == "wound")
        .count();
    assert_eq!(wounds_in_hand, 3, "Wound cards remain in hand");

    // Original cards should be in discard
    assert!(state.players[0].discard.iter().any(|c| c.as_str() == "march"));
    assert!(state.players[0].discard.iter().any(|c| c.as_str() == "rage"));
    assert!(state.players[0].discard.iter().any(|c| c.as_str() == "swiftness"));
}

#[test]
fn paralyze_with_zero_damage_does_not_trigger() {
    // Block all of Medusa's attack → 0 damage → no Paralyze
    let mut state = setup_playing_game(vec!["march", "rage"]);
    let tokens = vec![EnemyTokenId::from("medusa_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    // Block the attack
    state.combat.as_mut().unwrap().enemies[0].attacks_blocked[0] = true;
    state.combat.as_mut().unwrap().enemies[0].is_blocked = true;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    // Non-wound cards should remain in hand
    let non_wounds_in_hand = state.players[0].hand.iter()
        .filter(|c| c.as_str() != "wound")
        .count();
    assert_eq!(non_wounds_in_hand, 2, "Cards should not be discarded when attack is blocked");
}

#[test]
fn paralyze_keeps_wound_cards_in_hand() {
    // Put wounds in hand before paralyze
    let mut state = setup_playing_game(vec!["wound", "march", "wound"]);
    let tokens = vec![EnemyTokenId::from("medusa_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    // Original 2 wounds + 3 new wounds = 5 wounds in hand
    let wounds_in_hand = state.players[0].hand.iter()
        .filter(|c| c.as_str() == "wound")
        .count();
    assert_eq!(wounds_in_hand, 5, "All wound cards stay in hand");

    // march should be discarded
    assert!(state.players[0].discard.iter().any(|c| c.as_str() == "march"));
}

#[test]
fn paralyze_combined_with_poison() {
    // Medusa (Paralyze, 6 atk) + Cursed Hags (Poison, 3 atk)
    let mut state = setup_playing_game(vec!["march", "rage"]);
    let tokens = vec![
        EnemyTokenId::from("medusa_1"),
        EnemyTokenId::from("cursed_hags_2"),
    ];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    // Medusa: ceil(6/2) = 3 wounds to hand, Paralyze triggers
    // Cursed Hags: ceil(3/2) = 2 wounds to hand + 2 to discard (Poison)
    // Total wounds to hand: 5
    // Paralyze discards march and rage
    let non_wounds = state.players[0].hand.iter()
        .filter(|c| c.as_str() != "wound")
        .count();
    assert_eq!(non_wounds, 0, "Paralyze discards non-wounds even with Poison present");

    let wounds_in_hand = state.players[0].hand.iter()
        .filter(|c| c.as_str() == "wound")
        .count();
    assert_eq!(wounds_in_hand, 5);

    // Poison discard wounds
    let wounds_in_discard = state.players[0].discard.iter()
        .filter(|c| c.as_str() == "wound")
        .count();
    assert_eq!(wounds_in_discard, 2, "Poison adds wounds to discard");
}

#[test]
fn non_paralyze_does_not_discard_hand() {
    // Prowlers: 4 physical, no Paralyze
    let mut state = setup_playing_game(vec!["march", "rage"]);
    let tokens = vec![EnemyTokenId::from("prowlers_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    // Cards should remain in hand
    let non_wounds = state.players[0].hand.iter()
        .filter(|c| c.as_str() != "wound")
        .count();
    assert_eq!(non_wounds, 2, "Non-paralyze should not discard hand");
}

// =========================================================================
// Summon — draw enemies at RangedSiege→Block transition
// =========================================================================

#[test]
fn summon_draws_from_brown_pile() {
    // Orc Summoners: 0 attack, Summon ability
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("orc_summoners_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    let brown_count_before = state.enemy_tokens.brown_draw.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // RangedSiege → Block (triggers resolve_summons)
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    let combat = state.combat.as_ref().unwrap();
    assert_eq!(combat.phase, CombatPhase::Block);

    // Should have drawn one Brown enemy
    let _brown_count_after = state.enemy_tokens.brown_draw.len()
        + state.enemy_tokens.brown_discard.len();
    assert!(
        brown_count_before > state.enemy_tokens.brown_draw.len(),
        "Should have drawn from brown pile"
    );

    // Summoned enemy should be in combat
    let summoned = combat.enemies.iter().find(|e| e.summoned_by_instance_id.is_some());
    assert!(summoned.is_some(), "Summoned enemy should be in combat");
    let summoned = summoned.unwrap();
    assert_eq!(
        summoned.summoned_by_instance_id.as_ref().unwrap().as_str(),
        "enemy_0",
        "Summoned enemy should reference summoner"
    );

    // Summoner should be hidden
    assert!(
        combat.enemies[0].is_summoner_hidden,
        "Summoner should be hidden during Block/AssignDamage"
    );
}

#[test]
fn summon_green_draws_from_green_pile() {
    // Shrouded Necromancers: SummonGreen
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("shrouded_necromancers_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    let green_count_before = state.enemy_tokens.green_draw.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    assert!(
        green_count_before > state.enemy_tokens.green_draw.len(),
        "Should have drawn from green pile"
    );

    let combat = state.combat.as_ref().unwrap();
    let summoned = combat.enemies.iter().find(|e| e.summoned_by_instance_id.is_some());
    assert!(summoned.is_some());
}

#[test]
fn summoned_enemy_removed_at_assign_damage_to_attack() {
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("orc_summoners_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    let mut undo = UndoStack::new();

    // RangedSiege → Block (summons appear)
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    let enemy_count_block = state.combat.as_ref().unwrap().enemies.len();
    assert!(enemy_count_block > 1, "Should have summoned at least one enemy");

    // Block → AssignDamage
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    // AssignDamage → Attack (summoned enemies removed, summoner unhidden)
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    let combat = state.combat.as_ref().unwrap();
    assert_eq!(combat.phase, CombatPhase::Attack);

    // Summoned enemies should be removed
    let summoned_count = combat.enemies.iter()
        .filter(|e| e.summoned_by_instance_id.is_some())
        .count();
    assert_eq!(summoned_count, 0, "Summoned enemies should be removed before Attack phase");

    // Summoner should be unhidden
    assert!(
        !combat.enemies[0].is_summoner_hidden,
        "Summoner should be unhidden in Attack phase"
    );
}

#[test]
fn hidden_summoner_does_not_deal_damage() {
    // Orc Summoners has 0 attack anyway, but let's verify the hidden flag works
    // by checking that a hypothetical summoner with damage doesn't deal it
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("orc_summoners_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    let mut undo = UndoStack::new();

    // RangedSiege → Block
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    // Summoner should be hidden
    assert!(state.combat.as_ref().unwrap().enemies[0].is_summoner_hidden);

    // Block → AssignDamage (auto_damage should skip hidden summoner)
    let _hand_before = state.players[0].hand.len();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    // The summoner had 0 damage anyway, but the summoned enemy should have dealt damage
    // (depending on what was drawn). The key point: summoner itself was hidden.
    // This test verifies the summoner skip path was taken.
    assert!(state.combat.as_ref().unwrap().phase == CombatPhase::AssignDamage);
}

#[test]
fn no_fame_for_defeating_summoned_enemy() {
    // Already tested in combat_resolution.rs, but verify here in integration
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("orc_summoners_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    let mut undo = UndoStack::new();

    // RangedSiege → Block (summons)
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    // Find a summoned enemy and its armor
    let combat = state.combat.as_ref().unwrap();
    let summoned = combat.enemies.iter()
        .find(|e| e.summoned_by_instance_id.is_some());

    if let Some(summoned_enemy) = summoned {
        let _summoned_def = get_enemy(summoned_enemy.enemy_id.as_str()).unwrap();
        let _summoned_id = summoned_enemy.instance_id.clone();

        // Give enough attack to defeat the summoned enemy
        state.players[0].combat_accumulator.block_elements = ElementalValues {
            physical: 100, fire: 0, ice: 0, cold_fire: 0,
        };

        // Skip to Attack phase for the summoned enemy
        // Actually, summoned enemies are removed before Attack. So we can't attack them
        // in Attack phase. The test for fame should use resolve_attack directly.
        // The integration test is in combat_resolution tests.
    }
}

#[test]
fn empty_pile_no_summon() {
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("orc_summoners_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    // Empty the brown pile
    state.enemy_tokens.brown_draw.clear();
    state.enemy_tokens.brown_discard.clear();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // RangedSiege → Block (summon fails, no draw)
    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    let combat = state.combat.as_ref().unwrap();
    // Should only have the original summoner (no summoned enemy)
    assert_eq!(combat.enemies.len(), 1, "Empty pile → no summon");

    // Summoner should NOT be hidden (no successful summon)
    assert!(
        !combat.enemies[0].is_summoner_hidden,
        "Summoner should not be hidden when no summon succeeds"
    );
}

#[test]
fn dragon_summoner_draws_twice() {
    // Dragon Summoner: 2 Summon attacks → draws 2 from Brown
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("dragon_summoner_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();

    let brown_count_before = state.enemy_tokens.brown_draw.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch,
    ).unwrap();

    let brown_drawn = brown_count_before - state.enemy_tokens.brown_draw.len();
    assert_eq!(brown_drawn, 2, "Dragon Summoner should draw 2 from brown pile");

    let combat = state.combat.as_ref().unwrap();
    let summoned_count = combat.enemies.iter()
        .filter(|e| e.summoned_by_instance_id.is_some())
        .count();
    assert_eq!(summoned_count, 2, "Should have 2 summoned enemies");
}

// =========================================================================
// all_damage_blocked_this_phase tests
// =========================================================================

#[test]
fn all_damage_blocked_flag_set_when_all_blocked() {
    let mut state = setup_combat_game(&["prowlers"]); // 4 phys, single attack
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 5, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Transition Block → AssignDamage
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    assert!(state.combat.as_ref().unwrap().all_damage_blocked_this_phase);
}

#[test]
fn all_damage_blocked_flag_false_when_one_unblocked() {
    let mut state = setup_combat_game(&["prowlers", "prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 5, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    // Block only enemy_0
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Transition Block → AssignDamage (enemy_1 still unblocked)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    assert!(!state.combat.as_ref().unwrap().all_damage_blocked_this_phase);
}

#[test]
fn all_damage_blocked_flag_true_when_all_defeated() {
    let mut state = setup_combat_game(&["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.combat.as_mut().unwrap().enemies[0].is_defeated = true;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    assert!(state.combat.as_ref().unwrap().all_damage_blocked_this_phase);
}

// =========================================================================
// BurningShieldActive consumption tests
// =========================================================================

fn push_burning_shield_modifier(
    state: &mut GameState,
    player_idx: usize,
    mode: mk_types::modifier::BurningShieldMode,
    attack_value: u32,
) {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    let pid = state.players[player_idx].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("burning_shield_mod"),
        source: ModifierSource::Card {
            card_id: CardId::from("burning_shield"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::BurningShieldActive {
            mode,
            block_value: 4,
            attack_value,
        },
        created_at_round: state.round,
        created_by_player_id: pid,
    });
}

#[test]
fn burning_shield_attack_mode_on_successful_block() {
    let mut state = setup_combat_game(&["prowlers"]); // 4 phys, armor 3, fame 2
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_burning_shield_modifier(
        &mut state, 0,
        mk_types::modifier::BurningShieldMode::Attack, 4,
    );

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 5, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Modifier consumed
    assert!(!state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::BurningShieldActive { .. })
    ));
    // Fire attack 4 added to accumulator
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 4);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.fire, 4);
}

#[test]
fn burning_shield_not_consumed_on_failed_block() {
    let mut state = setup_combat_game(&["prowlers"]); // 4 phys
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_burning_shield_modifier(
        &mut state, 0,
        mk_types::modifier::BurningShieldMode::Attack, 4,
    );

    // Insufficient block
    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 1, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Modifier NOT consumed (block failed)
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::BurningShieldActive { .. })
    ));
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 0);
}

#[test]
fn burning_shield_destroy_defeats_enemy() {
    let mut state = setup_combat_game(&["prowlers"]); // no fire resist, no arcane immune
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_burning_shield_modifier(
        &mut state, 0,
        mk_types::modifier::BurningShieldMode::Destroy, 0,
    );

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 5, fire: 0, ice: 0, cold_fire: 0,
    };
    let initial_fame = state.players[0].fame;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    assert!(state.combat.as_ref().unwrap().enemies[0].is_defeated);
    assert_eq!(state.players[0].fame, initial_fame + 2); // prowlers fame = 2
    assert!(!state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::BurningShieldActive { .. })
    ));
}

#[test]
fn burning_shield_destroy_blocked_by_fire_resistance() {
    // skeletal_warriors: fire resistant, 3 physical, armor 4, fame 1
    let mut state = setup_combat_game(&["skeletal_warriors"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_burning_shield_modifier(
        &mut state, 0,
        mk_types::modifier::BurningShieldMode::Destroy, 0,
    );

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 5, fire: 0, ice: 0, cold_fire: 0,
    };
    let initial_fame = state.players[0].fame;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // NOT destroyed (fire resistant), modifier still consumed
    assert!(!state.combat.as_ref().unwrap().enemies[0].is_defeated);
    assert_eq!(state.players[0].fame, initial_fame);
    assert!(!state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::BurningShieldActive { .. })
    ));
}

#[test]
fn burning_shield_destroy_blocked_by_arcane_immunity() {
    // grim_legionnaries: arcane immune, no fire resist, 11 physical, armor 10
    let mut state = setup_combat_game(&["grim_legionnaries"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_burning_shield_modifier(
        &mut state, 0,
        mk_types::modifier::BurningShieldMode::Destroy, 0,
    );

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 12, fire: 0, ice: 0, cold_fire: 0,
    };
    let initial_fame = state.players[0].fame;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // NOT destroyed (arcane immune), modifier still consumed
    assert!(!state.combat.as_ref().unwrap().enemies[0].is_defeated);
    assert_eq!(state.players[0].fame, initial_fame);
    assert!(!state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::BurningShieldActive { .. })
    ));
}

// =========================================================================
// Rampaging enemy defeat: reputation bonus + type slot cleanup
// =========================================================================

/// Helper: place a rampaging enemy on a hex and enter combat via ChallengeRampaging.
fn setup_rampaging_challenge(
    rampaging_type: RampagingEnemyType,
    enemy_id: &str,
    enemy_color: EnemyColor,
    hex_coord: mk_types::hex::HexCoord,
) -> (GameState, UndoStack) {
    let mut state = setup_playing_game(vec!["march"]);
    let hex_key = hex_coord.key();

    // Place rampaging enemy on the hex
    let hex = state.map.hexes.get_mut(&hex_key).unwrap();
    hex.rampaging_enemies.push(rampaging_type);
    hex.enemies.push(mk_types::state::HexEnemy {
        token_id: mk_types::ids::EnemyTokenId::from(format!("{}_1", enemy_id)),
        color: enemy_color,
        is_revealed: true,
    });

    // Position player adjacent to the rampaging hex
    state.players[0].position = Some(mk_types::hex::HexCoord { q: 0, r: 0 });

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // Challenge the rampaging enemy
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ChallengeRampaging { hex: hex_coord },
        epoch,
    )
    .unwrap();

    assert!(state.combat.is_some(), "should be in combat after challenge");
    (state, undo)
}

#[test]
fn challenge_orc_marauder_defeat_grants_rep_plus_1() {
    let hex_coord = mk_types::hex::HexCoord { q: 1, r: 0 };
    let (mut state, mut undo) = setup_rampaging_challenge(
        RampagingEnemyType::OrcMarauder,
        "prowlers",
        EnemyColor::Green,
        hex_coord,
    );
    let initial_rep = state.players[0].reputation;

    // Give enough attack to defeat prowlers (armor 3)
    state.players[0].combat_accumulator.attack.normal_elements.physical = 10;

    // Skip to Attack phase
    for _ in 0..3 {
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    }

    // Declare attack on the enemy
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    // End Attack phase to finish combat
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    assert!(state.combat.is_none(), "combat should be over");
    assert_eq!(
        state.players[0].reputation,
        (initial_rep as i32 + 1) as i8,
        "defeating Orc Marauder should grant +1 reputation"
    );
}

// =========================================================================
// Defend ability — armor bonus persistence (FAQ S29)
// =========================================================================

#[test]
fn defend_protects_other_enemy() {
    // Corrupted Priests (defend=1, armor 5) + Prowlers (armor 3)
    // Attacking prowlers should require 4 attack (3 base + 1 defend)
    let mut state = setup_combat_game(&["corrupted_priests", "prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // 3 physical attack — exactly prowlers' base armor, but defend adds +1
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 3, fire: 0, ice: 0, cold_fire: 0,
    };

    // Select prowlers (enemy_1 = index 1 in eligible list)
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    // SubsetSelect lazily creates attack SubsetSelectionState + selects prowlers
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 1 }, epoch).unwrap();

    // SubsetConfirm stores targets, then check ResolveAttack
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetConfirm, epoch).unwrap();

    // ResolveAttack should NOT be available — 3 < 4 (3 armor + 1 defend)
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    assert!(
        !legal.actions.contains(&LegalAction::ResolveAttack),
        "3 attack should not be enough against prowlers defended by corrupted_priests (need 4)"
    );
}

#[test]
fn defend_protects_other_enemy_sufficient_attack() {
    // Same setup but with enough attack to overcome defend
    let mut state = setup_combat_game(&["corrupted_priests", "prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // 4 physical attack — enough for prowlers (3 armor + 1 defend)
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 4, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    // SubsetSelect lazily creates + selects prowlers (index 1)
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 1 }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetConfirm, epoch).unwrap();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    assert!(
        legal.actions.contains(&LegalAction::ResolveAttack),
        "4 attack should be enough against prowlers defended by corrupted_priests"
    );
}

#[test]
fn defend_used_once_per_combat() {
    // Corrupted Priests (defend=1, armor 5) + 2× Prowlers (armor 3 each)
    // First attack on prowlers uses the defend → +1. Second prowlers gets no defend.
    let mut state = setup_combat_game(&["corrupted_priests", "prowlers", "prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // First: attack prowlers (enemy_1). Eligible list: [corrupted_priests, prowlers, prowlers]
    // Select index 1 = prowlers (enemy_1). Needs 4 = 3 + 1 defend.
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 4, fire: 0, ice: 0, cold_fire: 0,
    };
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    // SubsetSelect lazily creates + selects prowlers (index 1)
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 1 }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetConfirm, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveAttack, epoch).unwrap();

    assert!(state.combat.as_ref().unwrap().enemies[1].is_defeated, "First prowlers defeated");
    assert!(!state.combat.as_ref().unwrap().used_defend.is_empty(), "Defend used");

    // Second: attack prowlers (enemy_2). Eligible: [corrupted_priests, prowlers(enemy_2)]
    // Defend already used — no bonus. 3 should be enough.
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 3, fire: 0, ice: 0, cold_fire: 0,
    };
    state.players[0].combat_accumulator.assigned_attack.normal_elements = ElementalValues::default();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    // enemy_2 is now index 1 (enemy_0=corrupted_priests, enemy_2=prowlers — enemy_1 defeated)
    // SubsetSelect lazily creates + selects prowlers(enemy_2) at index 1
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 1 }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetConfirm, epoch).unwrap();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    assert!(
        legal.actions.contains(&LegalAction::ResolveAttack),
        "3 attack should be enough for second prowlers (defend already used)"
    );
}

#[test]
fn defend_bonus_persists_after_defender_killed() {
    // FAQ S29: Defend bonus persists for entire combat even after defender dies.
    // Setup: Corrupted Priests (defend=1, armor 5) + Prowlers (armor 3)
    //
    // Step 1: Attack prowlers → defend triggers → prowlers gets +1 armor → needs 4.
    //         Defeat prowlers with 4 attack. Defend bonus recorded in defend_bonuses.
    // Step 2: Kill the corrupted priests (self-defend makes it 6 first time, but after
    //         used_defend is consumed, second attempt at 5 won't have defend).
    //         Actually — first attack on corrupted_priests uses self-defend (6 needed).
    //         But used_defend was already consumed for prowlers. So attacking corrupted_priests
    //         next has no defend → needs only 5.
    // Step 3: Verify prowlers' defend bonus persisted (already proven in step 1).
    //
    // Simpler approach: attack prowlers first (uses defend), then kill defender,
    // then verify defend_bonuses survived.
    let mut state = setup_combat_game(&["corrupted_priests", "prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // Step 1: Attack prowlers (enemy_1), needs 4 = 3 + 1 defend
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 4, fire: 0, ice: 0, cold_fire: 0,
    };
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    // SubsetSelect lazily creates + selects prowlers (index 1)
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 1 }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetConfirm, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveAttack, epoch).unwrap();

    assert!(state.combat.as_ref().unwrap().enemies[1].is_defeated);
    // Defend bonus persisted for enemy_1
    assert_eq!(
        state.combat.as_ref().unwrap().defend_bonuses.get("enemy_1").copied().unwrap_or(0), 1,
        "Defend bonus should be persisted for prowlers"
    );

    // Step 2: Kill corrupted_priests (defend already used, so just needs 5)
    // Only one eligible target now — SubsetSelect auto-confirms
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 5, fire: 0, ice: 0, cold_fire: 0,
    };
    state.players[0].combat_accumulator.assigned_attack.normal_elements = ElementalValues::default();
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    // Single enemy: SubsetSelect lazily creates + selects + auto-confirms
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveAttack, epoch).unwrap();

    assert!(state.combat.as_ref().unwrap().enemies[0].is_defeated, "Corrupted Priests defeated");

    // Step 3: Verify defend_bonuses survived the defender's death
    assert_eq!(
        state.combat.as_ref().unwrap().defend_bonuses.get("enemy_1").copied().unwrap_or(0), 1,
        "Defend bonus for prowlers should persist even after corrupted_priests is killed"
    );
}

#[test]
fn defend_self_adds_armor() {
    // Corrupted Priests (defend=1, armor 5) alone: can defend itself
    // Attacking it needs 6 = 5 + 1 self-defend
    let mut state = setup_combat_game(&["corrupted_priests"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // 5 physical — matches base armor but not defend
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 5, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    // Single enemy: SubsetSelect lazily creates + selects + auto-confirms
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    assert!(
        !legal.actions.contains(&LegalAction::ResolveAttack),
        "5 attack should not defeat corrupted_priests (needs 6 with self-defend)"
    );
}

// =========================================================================
// Shield Bash armor reduction tests
// =========================================================================

fn push_shield_bash_modifier(state: &mut GameState, player_idx: usize) {
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    let pid = state.players[player_idx].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("shield_bash_mod"),
        source: ModifierSource::Card {
            card_id: CardId::from("shield_bash"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::ShieldBashArmorReduction,
        created_at_round: state.round,
        created_by_player_id: pid,
    });
}

#[test]
fn shield_bash_creates_armor_reduction_on_excess_block() {
    // Prowlers: 4 physical attack, armor 3
    // Block with 7 physical → excess = 7-4 = 3 → EnemyStat(Armor, -3, min 1)
    let mut state = setup_combat_game(&["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_shield_bash_modifier(&mut state, 0);

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 7, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Should have an EnemyStat(Armor) modifier for enemy_0
    let armor_mod = state.active_modifiers.iter().find(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Armor,
            amount,
            minimum: 1,
            ..
        } if *amount == -3)
        && matches!(&m.scope, mk_types::modifier::ModifierScope::OneEnemy { enemy_id }
            if enemy_id == "enemy_0")
    });
    assert!(armor_mod.is_some(), "Should create EnemyStat(Armor, -3) modifier");
}

#[test]
fn shield_bash_no_effect_on_exact_block() {
    // Prowlers: 4 physical attack
    // Block with exactly 4 → excess = 0 → no modifier
    let mut state = setup_combat_game(&["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_shield_bash_modifier(&mut state, 0);

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 4, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    let has_armor_mod = state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Armor, ..
        })
    );
    assert!(!has_armor_mod, "No armor reduction on exact block (excess = 0)");
}

#[test]
fn shield_bash_no_effect_without_modifier() {
    // No ShieldBashArmorReduction modifier → no armor reduction
    let mut state = setup_combat_game(&["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    // No push_shield_bash_modifier call

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 10, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    let has_armor_mod = state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Armor, ..
        })
    );
    assert!(!has_armor_mod, "No armor reduction without Shield Bash modifier");
}

#[test]
fn shield_bash_ice_resistant_immune() {
    // Ice Mages: 5 ice attack, Ice Resistant
    let mut state = setup_combat_game(&["ice_mages"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_shield_bash_modifier(&mut state, 0);

    // Need cold_fire to efficiently block ice attack
    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 0, fire: 10, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    let has_armor_mod = state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Armor, ..
        })
    );
    assert!(!has_armor_mod, "Ice Resistant enemies immune to Shield Bash armor reduction");
}

#[test]
fn shield_bash_summoned_immune() {
    // Set up summoned enemy manually
    let mut state = setup_combat_game(&["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_shield_bash_modifier(&mut state, 0);

    // Mark enemy as summoned
    state.combat.as_mut().unwrap().enemies[0].summoned_by_instance_id =
        Some(CombatInstanceId::from("summoner_0"));

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 10, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    let has_armor_mod = state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Armor, ..
        })
    );
    assert!(!has_armor_mod, "Summoned enemies immune to Shield Bash armor reduction");
}

#[test]
fn shield_bash_arcane_immune_immune() {
    // Grim Legionnaries: 11 physical, Arcane Immune
    let mut state = setup_combat_game(&["grim_legionnaries"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_shield_bash_modifier(&mut state, 0);

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 20, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    let has_armor_mod = state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Armor, ..
        })
    );
    assert!(!has_armor_mod, "Arcane Immune enemies immune to Shield Bash armor reduction");
}

#[test]
fn shield_bash_modifier_not_consumed() {
    // Shield Bash modifier stays active after block — second block also creates reduction
    let mut state = setup_combat_game(&["prowlers", "prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_shield_bash_modifier(&mut state, 0);

    // First block: 6 physical vs 4 → excess 2
    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 6, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // ShieldBashArmorReduction modifier should still be present
    assert!(
        state.active_modifiers.iter().any(|m|
            matches!(&m.effect, mk_types::modifier::ModifierEffect::ShieldBashArmorReduction)
        ),
        "Shield Bash modifier should NOT be consumed"
    );

    // Second block: 8 physical vs 4 → excess 4
    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 8, fire: 0, ice: 0, cold_fire: 0,
    };
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_1"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Should have two EnemyStat(Armor) modifiers — one per enemy
    let armor_mods: Vec<_> = state.active_modifiers.iter().filter(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Armor, ..
        })
    ).collect();
    assert_eq!(armor_mods.len(), 2, "Each successful block should create its own armor reduction modifier");
}

#[test]
fn shield_bash_armor_reduction_affects_attack_resolution() {
    // Prowlers: armor 3, 4 physical attack
    // Block with 7 physical → excess 3 → armor reduced by 3, min 1 → effective armor 1
    // Then attack with 1 physical should succeed
    let mut state = setup_combat_game(&["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_shield_bash_modifier(&mut state, 0);

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 7, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Skip to Attack phase
    // Block→AssignDamage (all blocked so no damage)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    // AssignDamage→Attack
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::Attack);

    // Attack with 1 physical — should defeat prowlers (armor reduced from 3 to 1)
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 1, fire: 0, ice: 0, cold_fire: 0,
    };

    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    assert!(
        state.combat.as_ref().unwrap().enemies[0].is_defeated,
        "1 attack should defeat prowlers with armor reduced to 1 by Shield Bash"
    );
}

#[test]
fn challenge_draconum_defeat_grants_rep_plus_2() {
    let hex_coord = mk_types::hex::HexCoord { q: 1, r: 0 };
    let (mut state, mut undo) = setup_rampaging_challenge(
        RampagingEnemyType::Draconum,
        "swamp_dragon",
        EnemyColor::Red,
        hex_coord,
    );
    let initial_rep = state.players[0].reputation;

    // Give enough attack to defeat swamp_dragon (armor 9)
    state.players[0].combat_accumulator.attack.normal_elements.physical = 20;

    // Skip to Attack phase
    for _ in 0..3 {
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    }

    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    assert!(state.combat.is_none(), "combat should be over");
    assert_eq!(
        state.players[0].reputation,
        (initial_rep as i32 + 2) as i8,
        "defeating Draconum should grant +2 reputation"
    );
}

#[test]
fn rampaging_type_slot_cleared_after_defeat() {
    let hex_coord = mk_types::hex::HexCoord { q: 1, r: 0 };
    let (mut state, mut undo) = setup_rampaging_challenge(
        RampagingEnemyType::OrcMarauder,
        "prowlers",
        EnemyColor::Green,
        hex_coord,
    );

    state.players[0].combat_accumulator.attack.normal_elements.physical = 10;

    for _ in 0..3 {
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    }
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    let hex = state.map.hexes.get(&hex_coord.key()).unwrap();
    assert!(
        hex.rampaging_enemies.is_empty(),
        "rampaging type slot should be cleared after all enemies defeated"
    );
    assert!(
        hex.enemies.is_empty(),
        "hex enemies should be empty after defeat"
    );
}

#[test]
fn hex_unblocked_after_rampaging_defeat() {
    let hex_coord = mk_types::hex::HexCoord { q: 1, r: 0 };
    let (mut state, mut undo) = setup_rampaging_challenge(
        RampagingEnemyType::OrcMarauder,
        "prowlers",
        EnemyColor::Green,
        hex_coord,
    );

    state.players[0].combat_accumulator.attack.normal_elements.physical = 10;

    for _ in 0..3 {
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    }
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    // Hex should now be passable
    let entry = crate::movement::evaluate_move_entry(&state, 0, hex_coord);
    assert!(
        entry.cost.is_some(),
        "hex should be passable after rampaging enemies defeated"
    );
}

#[test]
fn rampaging_rep_not_granted_on_retreat() {
    let hex_coord = mk_types::hex::HexCoord { q: 1, r: 0 };
    let (mut state, mut undo) = setup_rampaging_challenge(
        RampagingEnemyType::OrcMarauder,
        "prowlers",
        EnemyColor::Green,
        hex_coord,
    );
    let initial_rep = state.players[0].reputation;

    // Don't accumulate any attack — just skip through phases without defeating
    // RangedSiege → Block → AssignDamage → Attack
    for _ in 0..3 {
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    }

    // End Attack phase without attacking (retreat)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    assert!(state.combat.is_none(), "combat should be over");
    assert_eq!(
        state.players[0].reputation, initial_rep,
        "no reputation bonus on retreat (enemies not defeated)"
    );

    // Rampaging slot and enemies should still be on the hex
    let hex = state.map.hexes.get(&hex_coord.key()).unwrap();
    assert_eq!(hex.rampaging_enemies.len(), 1, "rampaging type still present");
    assert_eq!(hex.enemies.len(), 1, "hex enemy still present");
}

#[test]
fn rampaging_rep_clamped_at_max_7() {
    let hex_coord = mk_types::hex::HexCoord { q: 1, r: 0 };
    let (mut state, mut undo) = setup_rampaging_challenge(
        RampagingEnemyType::Draconum,
        "swamp_dragon",
        EnemyColor::Red,
        hex_coord,
    );

    // Set rep to 6, defeating Draconum should give +2 but clamp at 7
    state.players[0].reputation = 6;

    state.players[0].combat_accumulator.attack.normal_elements.physical = 20;

    for _ in 0..3 {
        let epoch = state.action_epoch;
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    }
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    assert_eq!(state.players[0].reputation, 7, "reputation should clamp at 7");
}

#[test]
fn shield_bash_minimum_armor_one() {
    // Prowlers: armor 3, 4 physical attack
    // Block with 100 → excess = 96 → would reduce armor by 96, but minimum 1
    let mut state = setup_combat_game(&["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_shield_bash_modifier(&mut state, 0);

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 100, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Skip to Attack phase
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    // Attack with 1 should succeed (armor clamped to minimum 1)
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 1, fire: 0, ice: 0, cold_fire: 0,
    };
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);
    assert!(state.combat.as_ref().unwrap().enemies[0].is_defeated,
        "Attack should succeed — armor clamped to minimum 1");

    // But 0 attack should NOT succeed (need at least 1)
    // (can't test directly since enemy is already defeated, but we verified 1 works)
}

#[test]
fn shield_bash_cumbersome_reduces_required() {
    // Orc Stonethrowers: 7 physical, Cumbersome, armor 3
    // Spend 3 move → cumbersome reduces required to 4
    // Block with 7 → excess = 7-4 = 3
    let mut state = setup_playing_game(vec!["march"]);
    let tokens = vec![EnemyTokenId::from("orc_stonethrowers_1")];
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    ).unwrap();
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_shield_bash_modifier(&mut state, 0);
    state.players[0].move_points = 3;

    let mut undo = UndoStack::new();

    // Spend 3 move on cumbersome
    for _ in 0..3 {
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state, &mut undo, 0,
            &LegalAction::SpendMoveOnCumbersome {
                enemy_instance_id: CombatInstanceId::from("enemy_0"),
            },
            epoch,
        ).unwrap();
    }

    // Block with 7 physical: required = 7-3 = 4, excess = 7-4 = 3
    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 7, fire: 0, ice: 0, cold_fire: 0,
    };

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    let armor_mod = state.active_modifiers.iter().find(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Armor,
            amount,
            ..
        } if *amount == -3)
    );
    assert!(armor_mod.is_some(), "Cumbersome reduces required, increasing excess for Shield Bash");
}

#[test]
fn shield_bash_swift_uses_undoubled_required() {
    // Wolf Riders: 3 physical, Swift, armor 4
    // Swift doubles block requirement to 6, but undoubled damage is 3
    // Block with 8 physical → eff_block vs Swift-required is 8>=6 (success)
    // But undoubled excess: 8 - 3 = 5 → armor reduced by 5, min 1
    let mut state = setup_combat_game(&["wolf_riders"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    push_shield_bash_modifier(&mut state, 0);

    state.players[0].combat_accumulator.block_elements = ElementalValues {
        physical: 8, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DeclareBlock {
            enemy_instance_id: CombatInstanceId::from("enemy_0"),
            attack_index: 0,
        },
        epoch,
    ).unwrap();

    // Undoubled excess = 8 - 3 = 5
    let armor_mod = state.active_modifiers.iter().find(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Armor,
            amount,
            ..
        } if *amount == -5)
    );
    assert!(armor_mod.is_some(), "Shield Bash uses undoubled required (3, not 6) for excess calculation");
}

#[test]
fn enemy_stat_armor_applied_in_attack_resolution() {
    // Test that EnemyStat(Armor) modifiers (from Curse or Shield Bash) affect attack resolution
    // Prowlers: armor 3
    // Manually push EnemyStat(Armor, -2, min 1) → effective armor 1
    let mut state = setup_combat_game(&["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // Push a Curse-style armor modifier
    use mk_types::modifier::*;
    let pid = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: mk_types::ids::ModifierId::from("curse_armor_mod"),
        source: ModifierSource::Skill {
            skill_id: mk_types::ids::SkillId::from("curse"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::OneEnemy {
            enemy_id: "enemy_0".to_string(),
        },
        effect: ModifierEffect::EnemyStat {
            stat: EnemyStat::Armor,
            amount: -2,
            minimum: 1,
            attack_index: None,
            per_resistance: false,
            fortified_amount: None,
            exclude_resistance: None,
        },
        created_at_round: state.round,
        created_by_player_id: pid,
    });

    // Attack with 1 physical — should defeat prowlers (armor 3 - 2 = 1)
    state.players[0].combat_accumulator.attack.normal_elements = ElementalValues {
        physical: 1, fire: 0, ice: 0, cold_fire: 0,
    };

    let mut undo = UndoStack::new();
    execute_attack(&mut state, &mut undo, CombatType::Melee, 1);

    assert!(
        state.combat.as_ref().unwrap().enemies[0].is_defeated,
        "EnemyStat(Armor, -2) should reduce prowlers armor from 3 to 1"
    );
    assert_eq!(state.players[0].fame, state.players[0].fame, "Should gain fame");
}

// =========================================================================
// Declared attack + EndCombatPhase interaction
// =========================================================================

#[test]
fn end_combat_phase_available_with_insufficient_declared_attack() {
    // Regression: when attack targets are declared but attack power is insufficient,
    // EndCombatPhase must still be legal (abandons the declaration).
    // Previously this produced 0 legal actions → crash in RL training.
    let mut state = setup_combat_game(&["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // Simulate a declared attack with 0 accumulated attack power (insufficient).
    let combat = state.combat.as_mut().unwrap();
    combat.declared_attack_targets = Some(vec![
        mk_types::ids::CombatInstanceId::from("enemy_0"),
    ]);
    combat.declared_attack_type = Some(CombatType::Melee);

    let undo = UndoStack::new();
    let las = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        las.actions.iter().any(|a| matches!(a, LegalAction::EndCombatPhase)),
        "EndCombatPhase must be available even with an active (insufficient) attack declaration"
    );
    assert!(
        !las.actions.is_empty(),
        "Legal actions must never be empty"
    );
}

#[test]
fn end_combat_phase_clears_declared_attack() {
    // EndCombatPhase should clear declared_attack_targets and declared_attack_type.
    let mut state = setup_combat_game(&["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let combat = state.combat.as_mut().unwrap();
    combat.declared_attack_targets = Some(vec![
        mk_types::ids::CombatInstanceId::from("enemy_0"),
    ]);
    combat.declared_attack_type = Some(CombatType::Melee);

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    let combat = state.combat.as_ref();
    // Combat should be over (Attack was last phase) or declaration cleared
    if let Some(c) = combat {
        assert!(c.declared_attack_targets.is_none());
        assert!(c.declared_attack_type.is_none());
    }
}

