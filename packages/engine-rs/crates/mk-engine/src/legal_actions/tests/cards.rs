use super::*;

// =========================================================================
// Normal turn: cards
// =========================================================================

#[test]
fn march_basic_and_sideways_no_powered() {
    // No tokens, crystals, or source dice — powered should NOT be emitted
    let mut state = setup_game(vec!["march"]);
    state.source.dice.clear();

    // Not interacting: only move sideways (influence gated)
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "march"),
    );
    let powered = legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"));
    let sideways_move = legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardSideways { sideways_as: SidewaysAs::Move, card_id, .. } if card_id.as_str() == "march"));
    let sideways_inf = legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardSideways { sideways_as: SidewaysAs::Influence, card_id, .. } if card_id.as_str() == "march"));

    assert!(basic, "march basic should be available");
    assert!(!powered, "march powered should NOT be available (no green mana)");
    assert!(sideways_move, "march sideways move should be available");
    assert!(!sideways_inf, "march sideways influence should NOT be available (not interacting)");

    // Interacting: only influence sideways (move gated)
    state.players[0].flags.insert(PlayerFlags::IS_INTERACTING);
    let legal = enumerate_legal_actions(&state, 0);

    let sideways_move = legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardSideways { sideways_as: SidewaysAs::Move, card_id, .. } if card_id.as_str() == "march"));
    let sideways_inf = legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardSideways { sideways_as: SidewaysAs::Influence, card_id, .. } if card_id.as_str() == "march"));

    assert!(!sideways_move, "march sideways move should NOT be available (interacting)");
    assert!(sideways_inf, "march sideways influence should be available (interacting)");
}

#[test]
fn march_powered_available_with_green_mana() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Green,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let legal = enumerate_legal_actions(&state, 0);

    let powered = legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"));
    assert!(powered, "march powered should be available with green mana");
}

#[test]
fn march_powered_available_with_gold_mana() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Gold,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let legal = enumerate_legal_actions(&state, 0);

    let powered = legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"));
    assert!(powered, "march powered should be available with gold mana");
}

#[test]
fn march_powered_available_with_green_crystal() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].crystals.green = 1;
    let legal = enumerate_legal_actions(&state, 0);

    let powered = legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"));
    assert!(
        powered,
        "march powered should be available with green crystal"
    );
}

#[test]
fn rage_outside_combat_only_sideways() {
    let state = setup_game(vec!["rage"]);
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "rage"),
    );
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "rage"),
    );
    let sideways = legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardSideways { card_id, .. } if card_id.as_str() == "rage"));

    assert!(
        !basic,
        "rage basic (GainAttack choice) not playable outside combat"
    );
    assert!(!powered, "rage powered not playable outside combat");
    assert!(sideways, "rage sideways should be available");
}

#[test]
fn wound_not_sideways_playable() {
    let state = setup_game(vec!["wound"]);
    let legal = enumerate_legal_actions(&state, 0);

    let sideways = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::PlayCardSideways { .. }));
    assert!(!sideways, "wound should not be sideways-playable (value 0)");
}

#[test]
fn no_sideways_when_resting() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let legal = enumerate_legal_actions(&state, 0);

    let has_sideways = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::PlayCardSideways { .. }));
    assert!(
        !has_sideways,
        "sideways should not be playable while resting"
    );

    // But basic/powered plays are still allowed during rest (FAQ S3).
    let has_basic = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::PlayCardBasic { .. }));
    assert!(has_basic, "basic plays should be allowed while resting");
}

#[test]
fn concentration_powered_filtered_when_only_discard_target_unpayable() {
    let mut state = setup_game(vec!["concentration", "improvisation"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Green,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let concentration_powered = legal.actions.iter().any(|a| {
        matches!(
            a,
            LegalAction::PlayCardPowered {
                card_id,
                ..
            } if card_id.as_str() == "concentration"
        )
    });
    let concentration_basic = legal.actions.iter().any(|a| {
        matches!(
            a,
            LegalAction::PlayCardBasic {
                card_id,
                ..
            } if card_id.as_str() == "concentration"
        )
    });

    assert!(
            !concentration_powered,
            "concentration powered should be filtered when its only boost target has unpayable discard cost"
        );
    assert!(
        concentration_basic,
        "concentration should remain playable in basic mode"
    );
}

#[test]
fn concentration_powered_available_when_discard_target_is_payable() {
    let mut state = setup_game(vec!["concentration", "improvisation", "march"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Green,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let concentration_powered = legal.actions.iter().any(|a| {
        matches!(
            a,
            LegalAction::PlayCardPowered {
                card_id,
                ..
            } if card_id.as_str() == "concentration"
        )
    });

    assert!(
            concentration_powered,
            "concentration powered should be available when boosted discard-cost target remains payable"
        );
}

// =========================================================================
// Card-based SelectCombatEnemy effects
// =========================================================================

#[test]
fn whirlwind_basic_skip_attack_single_enemy() {
    // Whirlwind basic: select enemy → skip its attack. Single enemy = auto-resolve.
    let (mut state, mut undo) = setup_card_combat("whirlwind", &["prowlers"]);
    // Add white mana to power whirlwind (it's a white spell)
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "whirlwind"
    )).expect("whirlwind basic should be playable in combat");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Single enemy → auto-resolve, should have EnemySkipAttack modifier
    // Combat instance IDs are "enemy_0", "enemy_1", etc.
    let has_skip = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_skip, "whirlwind basic should skip prowlers attack");
    // No pending — auto-resolved
    assert!(state.players[0].pending.active.is_none());
}

#[test]
fn whirlwind_powered_defeats_single_enemy() {
    // Whirlwind powered: select enemy → defeat outright. Attack phase only.
    let (mut state, mut undo) = setup_card_combat("whirlwind", &["prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "whirlwind"
    )).expect("whirlwind powered should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Enemy should be defeated
    let combat = state.combat.as_ref().unwrap();
    assert!(combat.enemies[0].is_defeated, "whirlwind powered should defeat prowlers");
    // Fame should be earned
    assert!(state.players[0].fame > 0, "should earn fame for defeated enemy");
}

#[test]
fn whirlwind_powered_not_playable_in_ranged_siege_phase() {
    // Whirlwind powered says "Play this only in the Attack Phase of combat."
    // It should NOT be playable during RangedSiege phase.
    let (mut state, _undo) = setup_card_combat("whirlwind", &["prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    // Default combat phase is RangedSiege
    assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::RangedSiege);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &_undo);
    let has_powered = legal.actions.iter().any(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "whirlwind"
    ));
    assert!(!has_powered, "whirlwind powered should NOT be playable in RangedSiege phase");

    // Basic whirlwind (skip attack) should still be playable in RangedSiege
    let has_basic = legal.actions.iter().any(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "whirlwind"
    ));
    assert!(has_basic, "whirlwind basic should be playable in RangedSiege phase");
}

#[test]
fn whirlwind_powered_playable_in_attack_phase() {
    // Whirlwind powered should be playable in the Attack phase.
    let (mut state, mut undo) = setup_card_combat("whirlwind", &["prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "whirlwind"
    )).expect("whirlwind powered should be playable in Attack phase");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    let combat = state.combat.as_ref().unwrap();
    assert!(combat.enemies[0].is_defeated, "whirlwind powered should defeat enemy in Attack phase");
}

#[test]
fn whirlwind_basic_multiple_enemies_creates_pending() {
    // Two enemies → pending choice needed
    let (mut state, mut undo) = setup_card_combat("whirlwind", &["prowlers", "diggers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "whirlwind"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have pending SelectCombatEnemy with 2 eligible enemies
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::SelectCombatEnemy { eligible_enemy_ids, .. }) => {
            assert_eq!(eligible_enemy_ids.len(), 2);
        }
        other => panic!("Expected SelectCombatEnemy pending, got {:?}", other),
    }

    // Resolve choice: pick first enemy (prowlers)
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ResolveChoice { choice_index: 0 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal.epoch);

    // Prowlers should have skip-attack modifier
    let has_skip = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_skip, "chosen prowlers should have skip attack");
}

#[test]
fn chill_basic_excludes_ice_resistant_enemies() {
    // Chill basic: exclude_arcane_immune + exclude_resistance(Ice).
    // zombie_horde has Ice resistance → should be excluded.
    let (mut state, mut undo) = setup_card_combat("chill", &["prowlers", "zombie_horde"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Blue,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "chill"
    )).expect("chill basic should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Only prowlers eligible (zombie_horde excluded for Ice resistance)
    // → auto-resolve on prowlers
    assert!(state.players[0].pending.active.is_none(), "should auto-resolve single eligible");
    let has_skip = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_skip, "prowlers should have skip attack from chill");

    // Should also have remove_fire_resistance modifier
    let has_remove_fire = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::RemoveFireResistance)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_remove_fire, "chill basic should remove fire resistance");
}

#[test]
fn chill_powered_reduces_armor() {
    // Chill powered: skip attack + armor -4 (min 1)
    let (mut state, mut undo) = setup_card_combat("chill", &["prowlers"]);
    state.source.dice.clear(); // control mana sources explicitly
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Blue,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "chill"
    )).expect("chill powered should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Check armor modifier on prowlers
    let (armor_change, armor_min) = crate::combat_resolution::get_enemy_armor_modifier(
        &state.active_modifiers, "enemy_0"
    );
    assert_eq!(armor_change, -4, "chill powered should reduce armor by 4");
    assert_eq!(armor_min, 1, "minimum armor should be 1");
}

#[test]
fn tremor_basic_choice_single_enemy_or_all() {
    // Tremor basic: Choice between SelectCombatEnemy(-3) and AllEnemies(-2).
    let (mut state, mut undo) = setup_card_combat("tremor", &["prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Red,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "tremor"
    )).expect("tremor basic should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should create a pending choice (Choice between two options)
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(choice)) => {
            assert_eq!(choice.options.len(), 2, "tremor should offer 2 options");
        }
        other => panic!("Expected Choice pending, got {:?}", other),
    }

    // Choose option 1 (AllEnemies -2 armor)
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ResolveChoice { choice_index: 1 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal.epoch);

    // Should have AllEnemies scope armor modifier
    let has_all_enemy_armor = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Armor, amount: -2, minimum: 1, ..
        }) && matches!(&m.scope, ModifierScope::AllEnemies)
    });
    assert!(has_all_enemy_armor, "all-enemies -2 armor modifier should be present");
}

#[test]
fn expose_basic_select_enemy_then_ranged_attack() {
    // Expose basic: Compound([SelectCombatEnemy { nullify_fortified, remove_resistances }, GainAttack(2, Ranged)])
    // Single enemy → auto-resolve select, then continuation gives ranged attack 2.
    let (mut state, mut undo) = setup_card_combat("expose", &["diggers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "expose"
    )).expect("expose basic should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Single enemy → auto-resolve, no pending
    assert!(state.players[0].pending.active.is_none(), "single enemy should auto-resolve");

    // Diggers should have nullify_fortified + remove_resistances modifiers
    let has_nullify_fort = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::AbilityNullifier {
            ability: Some(EnemyAbilityType::Fortified), ..
        }) && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_nullify_fort, "expose should nullify diggers' fortification");

    let has_remove_res = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::RemoveResistances)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_remove_res, "expose should remove diggers' resistances");

    // Continuation: GainAttack 2 Ranged should have been applied
    assert_eq!(
        state.players[0].combat_accumulator.attack.ranged, 2,
        "expose basic should grant Ranged Attack 2 via continuation"
    );
}

#[test]
fn expose_basic_multi_enemy_pending_then_continuation() {
    // Two enemies: SelectCombatEnemy creates pending. After resolving, continuation gives ranged attack.
    let (mut state, mut undo) = setup_card_combat("expose", &["diggers", "prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "expose"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have SelectCombatEnemy pending with continuation
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::SelectCombatEnemy { eligible_enemy_ids, continuation, .. }) => {
            assert_eq!(eligible_enemy_ids.len(), 2);
            assert!(!continuation.is_empty(), "should have GainAttack continuation");
        }
        other => panic!("Expected SelectCombatEnemy pending, got {:?}", other),
    }

    // Resolve choice: pick diggers
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ResolveChoice { choice_index: 0 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal.epoch);

    // After resolution, continuation should have fired: ranged attack 2
    assert_eq!(
        state.players[0].combat_accumulator.attack.ranged, 2,
        "expose continuation should grant Ranged Attack 2"
    );
    // No more pending
    assert!(state.players[0].pending.active.is_none());
}

#[test]
fn chilling_stare_basic_is_choice() {
    use mk_types::modifier::{ActiveModifier, ModifierDuration, ModifierScope, ModifierSource};
    use mk_types::ids::ModifierId;

    // Chilling stare basic: Choice([Influence 3, SelectCombatEnemy { nullify_all_attack_abilities }])
    let (mut state, mut undo) = setup_card_combat("chilling_stare", &["prowlers"]);
    // Use Block phase with Diplomacy so influence option is not pruned.
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    let player_id = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("test_diplomacy"),
        source: ModifierSource::Card {
            card_id: CardId::from("diplomacy"),
            player_id: player_id.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::RuleOverride {
            rule: mk_types::modifier::RuleOverride::InfluenceCardsInCombat,
        },
        created_at_round: 1,
        created_by_player_id: player_id,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "chilling_stare"
    )).expect("chilling_stare basic should be playable in combat");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should be a Choice pending (influence or select enemy)
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(choice)) => {
            assert_eq!(choice.options.len(), 2);
        }
        other => panic!("Expected Choice pending, got {:?}", other),
    }

    // Choose option 0 (influence 3)
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ResolveChoice { choice_index: 0 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal.epoch);

    assert_eq!(state.players[0].influence_points, 3, "should gain 3 influence");
}

#[test]
fn chilling_stare_basic_select_enemy_nullifies_abilities() {
    // Without Diplomacy, Influence is filtered in combat → SelectCombatEnemy auto-resolves.
    let (mut state, mut undo) = setup_card_combat("chilling_stare", &["prowlers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "chilling_stare"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Influence filtered out in combat → SelectCombatEnemy is only option → auto-resolves.
    // Single enemy → auto-resolve. Should have AbilityNullifier modifiers.
    let nullifier_count = state.active_modifiers.iter().filter(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::AbilityNullifier { .. })
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    }).count();
    // 7 ability nullifiers: Swift, Brutal, Poison, Paralyze, Vampiric, Assassination, Cumbersome
    assert_eq!(nullifier_count, 7, "should push 7 AbilityNullifier modifiers");
}

#[test]
fn expose_powered_all_enemies_fortification_nullified() {
    // Expose powered: Compound([Choice([all nullify fort, all remove res]), GainAttack(3, Ranged)])
    let (mut state, mut undo) = setup_card_combat("expose", &["diggers", "prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "expose"
    )).expect("expose powered should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have Choice pending (nullify fortification OR remove resistances)
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(choice)) => {
            assert_eq!(choice.options.len(), 2);
        }
        other => panic!("Expected Choice pending, got {:?}", other),
    }

    // Choose option 0 (nullify fortification for all)
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ResolveChoice { choice_index: 0 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal.epoch);

    // AllEnemies scope nullify-fortified modifier
    let has_nullify_fort = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::AbilityNullifier {
            ability: Some(EnemyAbilityType::Fortified), ..
        }) && matches!(&m.scope, ModifierScope::AllEnemies)
    });
    assert!(has_nullify_fort, "should have AllEnemies fortification nullifier");

    // Continuation: GainAttack 3 Ranged
    assert_eq!(
        state.players[0].combat_accumulator.attack.ranged, 3,
        "expose powered should grant Ranged Attack 3"
    );
}

#[test]
fn card_data_whirlwind_template_fields() {
    let card = mk_data::cards::get_spell_card("whirlwind").unwrap();
    match &card.basic_effect {
        CardEffect::SelectCombatEnemy { template } => {
            assert!(template.skip_attack);
            assert!(!template.defeat);
        }
        _ => panic!("Expected SelectCombatEnemy"),
    }
    match &card.powered_effect {
        CardEffect::SelectCombatEnemy { template } => {
            assert!(template.defeat);
            assert!(!template.skip_attack);
        }
        _ => panic!("Expected SelectCombatEnemy"),
    }
}

#[test]
fn card_data_chill_template_fields() {
    let card = mk_data::cards::get_spell_card("chill").unwrap();
    match &card.basic_effect {
        CardEffect::SelectCombatEnemy { template } => {
            assert!(template.exclude_arcane_immune);
            assert_eq!(template.exclude_resistance, Some(ResistanceElement::Ice));
            assert!(template.skip_attack);
            assert!(template.remove_fire_resistance);
        }
        _ => panic!("Expected SelectCombatEnemy"),
    }
    match &card.powered_effect {
        CardEffect::SelectCombatEnemy { template } => {
            assert!(template.skip_attack);
            assert_eq!(template.armor_change, -4);
            assert_eq!(template.armor_minimum, 1);
        }
        _ => panic!("Expected SelectCombatEnemy"),
    }
}

#[test]
fn card_data_tremor_template_fields() {
    let card = mk_data::cards::get_spell_card("tremor").unwrap();
    // Basic: Choice of two
    match &card.basic_effect {
        CardEffect::Choice { options } => {
            assert_eq!(options.len(), 2);
            assert!(matches!(&options[0], CardEffect::SelectCombatEnemy { .. }));
            assert!(matches!(&options[1], CardEffect::ApplyModifier { .. }));
        }
        _ => panic!("Expected Choice"),
    }
    // Powered: fortified_armor_change on SelectCombatEnemy option
    match &card.powered_effect {
        CardEffect::Choice { options } => {
            match &options[0] {
                CardEffect::SelectCombatEnemy { template } => {
                    assert_eq!(template.armor_change, -3);
                    assert_eq!(template.fortified_armor_change, Some(-6));
                }
                _ => panic!("Expected SelectCombatEnemy"),
            }
        }
        _ => panic!("Expected Choice"),
    }
}

#[test]
fn card_data_expose_structure() {
    let card = mk_data::cards::get_spell_card("expose").unwrap();
    // Basic: Compound([SelectCombatEnemy, GainAttack])
    match &card.basic_effect {
        CardEffect::Compound { effects } => {
            assert_eq!(effects.len(), 2);
            match &effects[0] {
                CardEffect::SelectCombatEnemy { template } => {
                    assert!(template.nullify_fortified);
                    assert!(template.remove_resistances);
                }
                _ => panic!("Expected SelectCombatEnemy"),
            }
            assert!(matches!(&effects[1], CardEffect::GainAttack { amount: 2, combat_type: CombatType::Ranged, .. }));
        }
        _ => panic!("Expected Compound"),
    }
    // Powered: Compound([Choice, GainAttack])
    match &card.powered_effect {
        CardEffect::Compound { effects } => {
            assert_eq!(effects.len(), 2);
            assert!(matches!(&effects[0], CardEffect::Choice { .. }));
            assert!(matches!(&effects[1], CardEffect::GainAttack { amount: 3, combat_type: CombatType::Ranged, .. }));
        }
        _ => panic!("Expected Compound"),
    }
}

#[test]
fn card_data_chilling_stare_structure() {
    let card = mk_data::cards::get_card("chilling_stare").unwrap();
    match &card.basic_effect {
        CardEffect::Choice { options } => {
            assert_eq!(options.len(), 2);
            assert!(matches!(&options[0], CardEffect::GainInfluence { amount: 3 }));
            assert!(matches!(&options[1], CardEffect::SelectCombatEnemy { .. }));
        }
        _ => panic!("Expected Choice"),
    }
    match &card.powered_effect {
        CardEffect::Choice { options } => {
            assert_eq!(options.len(), 2);
            assert!(matches!(&options[0], CardEffect::GainInfluence { amount: 5 }));
            match &options[1] {
                CardEffect::SelectCombatEnemy { template } => {
                    assert!(template.skip_attack);
                    assert!(template.exclude_arcane_immune);
                }
                _ => panic!("Expected SelectCombatEnemy"),
            }
        }
        _ => panic!("Expected Choice"),
    }
}

// =============================================================================
// Cure/Disease tests
// =============================================================================

#[test]
fn cure_basic_removes_wounds_and_draws_cards() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![
        CardId::from("cure"),
        CardId::from("wound"),
        CardId::from("wound"),
    ];
    state.players[0].deck = vec![CardId::from("march"), CardId::from("stamina")];
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "cure"
    )).expect("cure basic should be playable with wounds in hand");
    let mut undo = UndoStack::new();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // 2 wounds removed, 2 cards drawn
    assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"),
        "wounds should be removed from hand");
    assert!(state.players[0].hand.iter().any(|c| c.as_str() == "march"));
    assert!(state.players[0].hand.iter().any(|c| c.as_str() == "stamina"));
    assert!(state.players[0].deck.is_empty(), "deck should be empty after drawing");
}

#[test]
fn cure_basic_heals_partial_wounds() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![
        CardId::from("cure"),
        CardId::from("wound"),
        CardId::from("march"),
    ];
    state.players[0].deck = vec![CardId::from("stamina"), CardId::from("rage")];
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "cure"
    )).unwrap();
    let mut undo = UndoStack::new();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
    assert!(state.players[0].hand.iter().any(|c| c.as_str() == "march"));
    assert!(state.players[0].hand.iter().any(|c| c.as_str() == "stamina"));
    assert_eq!(state.players[0].deck.len(), 1);
}

#[test]
fn cure_not_playable_without_wounds() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("cure"), CardId::from("march")];
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_cure_basic = legal.actions.iter().any(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "cure"
    ));
    assert!(!has_cure_basic, "cure basic should not be playable without wounds");
}

#[test]
fn disease_powered_sets_armor_to_1_for_blocked_enemies() {
    let (mut state, _undo) = setup_card_combat("cure", &["prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.combat.as_mut().unwrap().enemies[0].is_blocked = true;
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "cure"
    )).expect("cure powered (disease) should be playable in combat");
    let mut undo = UndoStack::new();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    let has_armor_mod = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::EnemyStat { stat: ModEnemyStat::Armor, amount, minimum, .. }
            if *amount == -100 && *minimum == 1)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_armor_mod, "disease should set armor to 1 for blocked enemy");
}

#[test]
fn disease_skipped_when_no_enemies_blocked() {
    let (mut state, _undo) = setup_card_combat("cure", &["prowlers"]);
    // Disease is dominated in RangedSiege; use Attack phase for this test.
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "cure"
    )).expect("cure powered should be playable in combat");
    let mut undo = UndoStack::new();
    let modifiers_before = state.active_modifiers.len();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    assert_eq!(state.active_modifiers.len(), modifiers_before,
        "disease should not add modifiers when no enemies blocked");
}

#[test]
fn disease_not_playable_outside_combat() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("cure")];
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_disease = legal.actions.iter().any(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "cure"
    ));
    assert!(!has_disease, "cure powered (disease) should not be playable outside combat");
}

#[test]
fn disease_affects_multiple_blocked_enemies() {
    let (mut state, _undo) = setup_card_combat("cure", &["prowlers", "diggers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let combat = state.combat.as_mut().unwrap();
    combat.enemies[0].is_blocked = true;
    combat.enemies[1].is_blocked = true;
    combat.phase = CombatPhase::Block;

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "cure"
    )).unwrap();
    let mut undo = UndoStack::new();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    let enemy_0_mod = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::EnemyStat { stat: ModEnemyStat::Armor, .. })
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    let enemy_1_mod = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::EnemyStat { stat: ModEnemyStat::Armor, .. })
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_1")
    });
    assert!(enemy_0_mod, "disease should affect enemy_0");
    assert!(enemy_1_mod, "disease should affect enemy_1");
}

// =========================================================================
// Mana source die powering
// =========================================================================

#[test]
fn march_powered_available_with_green_source_die() {
    let mut state = setup_game(vec!["march"]);
    setup_source_dice(&mut state, vec![(ManaColor::Green, false)]);

    let legal = enumerate_legal_actions(&state, 0);
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"),
    );
    assert!(
        powered,
        "march powered should be available with green source die"
    );
}

#[test]
fn march_powered_available_with_gold_source_die_during_day() {
    let mut state = setup_game(vec!["march"]);
    state.time_of_day = TimeOfDay::Day;
    setup_source_dice(&mut state, vec![(ManaColor::Gold, false)]);

    let legal = enumerate_legal_actions(&state, 0);
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"),
    );
    assert!(
        powered,
        "march powered should be available with gold source die during day"
    );
}

#[test]
fn march_powered_not_available_with_depleted_source_die() {
    let mut state = setup_game(vec!["march"]);
    setup_source_dice(&mut state, vec![(ManaColor::Green, true)]);

    let legal = enumerate_legal_actions(&state, 0);
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"),
    );
    assert!(
        !powered,
        "march powered should NOT be available with depleted source die"
    );
}

#[test]
fn march_powered_not_available_with_taken_source_die() {
    let mut state = setup_game(vec!["march"]);
    setup_source_dice(&mut state, vec![(ManaColor::Green, false)]);
    // Mark die as taken by another player
    state.source.dice[0].taken_by_player_id = Some(PlayerId::from("other_player"));

    let legal = enumerate_legal_actions(&state, 0);
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"),
    );
    assert!(
        !powered,
        "march powered should NOT be available when source die is taken by another player"
    );
}

#[test]
fn march_powered_not_available_with_wrong_color_source_die() {
    let mut state = setup_game(vec!["march"]);
    // March needs green, source only has red
    setup_source_dice(&mut state, vec![(ManaColor::Red, false)]);

    let legal = enumerate_legal_actions(&state, 0);
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"),
    );
    assert!(
        !powered,
        "march powered should NOT be available with wrong color source die"
    );
}

#[test]
fn march_powered_not_available_after_source_die_already_used_this_turn() {
    let mut state = setup_game(vec!["march"]);
    setup_source_dice(&mut state, vec![(ManaColor::Green, false)]);
    // Player already used a source die this turn
    state.players[0]
        .flags
        .insert(PlayerFlags::USED_MANA_FROM_SOURCE);

    let legal = enumerate_legal_actions(&state, 0);
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"),
    );
    assert!(
        !powered,
        "march powered should NOT be available when source die already used this turn"
    );
}

#[test]
fn march_powered_not_available_with_black_source_die_for_action_card() {
    // Black mana can only power spells, not action cards
    let mut state = setup_game(vec!["march"]);
    state.time_of_day = TimeOfDay::Night;
    setup_source_dice(&mut state, vec![(ManaColor::Black, false)]);

    let legal = enumerate_legal_actions(&state, 0);
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"),
    );
    assert!(
        !powered,
        "march powered should NOT be available with black source die (action cards can't use black)"
    );
}

#[test]
fn gold_source_die_depleted_at_night() {
    let mut state = setup_game(vec!["march"]);
    state.time_of_day = TimeOfDay::Night;
    // Gold die should be depleted at night
    setup_source_dice(&mut state, vec![(ManaColor::Gold, true)]);

    let legal = enumerate_legal_actions(&state, 0);
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"),
    );
    assert!(
        !powered,
        "gold source die should be depleted at night and not available for powering"
    );
}

#[test]
fn source_die_preferred_when_token_also_available() {
    // Both a green token and a green source die are available.
    // Powered should definitely be available.
    let mut state = setup_game(vec!["march"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Green,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    setup_source_dice(&mut state, vec![(ManaColor::Green, false)]);

    let legal = enumerate_legal_actions(&state, 0);
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"),
    );
    assert!(powered, "march powered should be available with both token and source die");
}

// =========================================================================
// Mana source die: execution (consume_mana_payment integration)
// =========================================================================

#[test]
fn play_card_powered_consumes_source_die() {
    let mut state = setup_game(vec!["march"]);
    setup_source_dice(&mut state, vec![(ManaColor::Green, false)]);

    crate::card_play::play_card(&mut state, 0, 0, true, None).unwrap();

    // Die should be marked as taken
    assert_eq!(
        state.source.dice[0].taken_by_player_id,
        Some(state.players[0].id.clone()),
        "source die should be marked as taken by player after powered play"
    );
    // Player should have the die ID tracked
    assert!(
        state.players[0].used_die_ids.contains(&state.source.dice[0].id),
        "player should track used die ID"
    );
    // USED_MANA_FROM_SOURCE flag should be set
    assert!(
        state.players[0]
            .flags
            .contains(PlayerFlags::USED_MANA_FROM_SOURCE),
        "USED_MANA_FROM_SOURCE flag should be set after using source die"
    );
    // Card effect should have resolved (march powered = 4 move)
    assert_eq!(state.players[0].move_points, 4);
}

#[test]
fn play_card_powered_with_token_and_die_creates_pending_choice() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Green,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    setup_source_dice(&mut state, vec![(ManaColor::Green, false)]);

    let result = crate::card_play::play_card(&mut state, 0, 0, true, None).unwrap();

    // Multiple mana sources → pending choice
    assert!(
        matches!(result, crate::card_play::CardPlayResult::PendingChoice),
        "should create pending choice when multiple mana sources available"
    );
    // Pending should be a ManaSourceSelect choice
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(choice)) => {
            assert_eq!(choice.options.len(), 2, "should have 2 mana source options (token + die)");
            match &choice.resolution {
                mk_types::pending::ChoiceResolution::ManaSourceSelect { sources, .. } => {
                    assert_eq!(sources.len(), 2);
                    assert_eq!(sources[0].source_type, mk_types::enums::ManaSourceType::Token);
                    assert_eq!(sources[1].source_type, mk_types::enums::ManaSourceType::Die);
                }
                other => panic!("Expected ManaSourceSelect resolution, got {:?}", other),
            }
        }
        other => panic!("Expected Choice pending, got {:?}", other),
    }
    // Neither source should be consumed yet
    assert_eq!(state.players[0].pure_mana.len(), 1, "token not consumed yet");
    assert!(state.source.dice[0].taken_by_player_id.is_none(), "die not taken yet");
}

#[test]
fn play_card_powered_uses_source_die_when_only_wrong_color_tokens() {
    let mut state = setup_game(vec!["march"]);
    // Has red token (wrong color for march which needs green)
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Red,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    // Has green source die (correct color)
    setup_source_dice(&mut state, vec![(ManaColor::Green, false)]);

    crate::card_play::play_card(&mut state, 0, 0, true, None).unwrap();

    // Red token should still be there (wrong color, not consumed)
    assert_eq!(state.players[0].pure_mana.len(), 1);
    assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Red);
    // Source die should be taken
    assert_eq!(
        state.source.dice[0].taken_by_player_id,
        Some(state.players[0].id.clone()),
    );
    assert_eq!(state.players[0].move_points, 4);
}

// =========================================================================
// Crystal Joy (PoweredBy::AnyBasic) — multi-color powered card
// =========================================================================

#[test]
fn crystal_joy_emits_4_powered_actions_when_all_colors_affordable() {
    let mut state = setup_game(vec!["goldyx_crystal_joy"]);
    // Give 4 different mana tokens so all colors are affordable
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Red,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Blue,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Green,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let powered_count = legal
        .actions
        .iter()
        .filter(|a| {
            matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "goldyx_crystal_joy")
        })
        .count();
    assert_eq!(powered_count, 4, "Crystal Joy should emit 4 powered actions (one per basic color)");
}

#[test]
fn crystal_joy_emits_1_powered_action_when_only_1_color_affordable() {
    let mut state = setup_game(vec!["goldyx_crystal_joy"]);
    // Clear source dice so only tokens matter
    state.source.dice.clear();
    // Only give a blue mana token
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Blue,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let powered: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| {
            matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "goldyx_crystal_joy")
        })
        .collect();
    assert_eq!(powered.len(), 1, "Only 1 powered action when only blue mana available");
    match &powered[0] {
        LegalAction::PlayCardPowered { mana_color, .. } => {
            assert_eq!(*mana_color, BasicManaColor::Blue);
        }
        _ => unreachable!(),
    }
}

#[test]
fn crystal_joy_powered_play_consumes_specified_color() {
    let mut state = setup_game(vec!["goldyx_crystal_joy"]);
    // Clear source dice so only tokens are mana sources
    state.source.dice.clear();
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Red,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Green,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    // Play powered with Red override — single source for Red means auto-consume
    crate::card_play::play_card(&mut state, 0, 0, true, Some(BasicManaColor::Red)).unwrap();

    // Red token consumed, green token remains
    assert_eq!(state.players[0].pure_mana.len(), 1);
    assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Green);
}

#[test]
fn crystal_joy_gold_token_affords_all_colors() {
    let mut state = setup_game(vec!["goldyx_crystal_joy"]);
    // Only a gold token — should still enable all 4 colors
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Gold,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let powered_count = legal
        .actions
        .iter()
        .filter(|a| {
            matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "goldyx_crystal_joy")
        })
        .count();
    assert_eq!(powered_count, 4, "Gold token should afford all 4 basic colors");
}

// =========================================================================
// Cross-system: Amulet mana override flows through to legal actions
// =========================================================================

/// AllowGoldAtNight override makes gold-die-powered cards appear in legal actions at night.
#[test]
fn amulet_override_flows_through_to_can_afford_powered() {
    use mk_types::ids::{ModifierId, SourceDieId};
    use mk_types::modifier::*;
    use mk_types::state::SourceDie;
    use mk_types::legal_action::LegalAction;

    // march: powered by green (4 move)
    let mut state = setup_game(vec!["march"]);
    state.time_of_day = TimeOfDay::Night;
    state.round_phase = RoundPhase::PlayerTurns;

    // Clear all dice, then add only a depleted gold die
    state.source.dice.clear();
    state.source.dice.push(SourceDie {
        id: SourceDieId::from("gold_die_1"),
        color: ManaColor::Gold,
        is_depleted: true,
        taken_by_player_id: None,
    });
    // Clear any mana tokens/crystals so only the die matters
    state.players[0].pure_mana.clear();
    state.players[0].crystals = Default::default();

    // Without override: gold die depleted → no powered play available
    let legal_no_override = enumerate_legal_actions(&state, 0);
    let has_powered_without = legal_no_override.actions.iter().any(|a| matches!(
        a,
        LegalAction::PlayCardPowered { .. }
    ));
    assert!(!has_powered_without, "Without override, gold die depleted → no powered play");

    // Add AllowGoldAtNight override
    let pid = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("sun_amulet"),
        source: ModifierSource::Card {
            card_id: CardId::from("amulet_of_the_sun"),
            player_id: pid.clone(),
        },
        duration: ModifierDuration::Turn,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::RuleOverride {
            rule: RuleOverride::AllowGoldAtNight,
        },
        created_at_round: 1,
        created_by_player_id: pid,
    });

    // With override: gold die available → powered play should appear
    let legal_with_override = enumerate_legal_actions(&state, 0);
    let has_powered_with = legal_with_override.actions.iter().any(|a| matches!(
        a,
        LegalAction::PlayCardPowered { .. }
    ));
    assert!(has_powered_with, "With AllowGoldAtNight, gold die should be available for powered plays");
}

#[test]
fn improvisation_powered_available_in_combat_with_red_source_die() {
    // Improvisation is a red card. In combat (attack phase) with a red source die
    // available and USED_MANA_FROM_SOURCE not set, PlayCardPowered should be offered.
    // Improvisation powered = CardBoost { bonus: 2 }, which needs a target action card
    // whose powered effect is resolvable in combat.
    let mut state = setup_game(vec!["improvisation", "arythea_battle_versatility"]);
    setup_source_dice(&mut state, vec![(ManaColor::Red, false)]);

    // Enter combat so GainAttack/GainBlock are resolvable
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Attack,
        ..CombatState::default()
    }));

    // Verify flag is NOT set
    assert!(
        !state.players[0]
            .flags
            .contains(PlayerFlags::USED_MANA_FROM_SOURCE),
        "precondition: USED_MANA_FROM_SOURCE should be false"
    );

    let legal = enumerate_legal_actions(&state, 0);
    let powered = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "improvisation"),
    );
    assert!(
        powered,
        "improvisation powered should be available in combat with red source die; actions: {:?}",
        legal.actions
    );
}
