use super::*;

// =========================================================================
// Interactive Skill tests
// =========================================================================

/// Helper: set up a 2-player game where player 0 has a specific skill and it's their turn.

/// Helper: activate a skill for player 0.

/// Helper: switch current player to player_1 (index 1).

// ---- Prayer of Weather ----

#[test]
fn prayer_of_weather_owner_terrain_cost_minus_2() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
    // Owner should have Turn/SelfScope TerrainCost -2
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::TerrainCost {
            amount, minimum, ..
        } if *amount == -2 && *minimum == 1)
        && matches!(&m.duration, mk_types::modifier::ModifierDuration::Turn)
        && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
    ));
}

#[test]
fn prayer_of_weather_center_marker() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
    // Should have Round/OtherPlayers center marker
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.duration, mk_types::modifier::ModifierDuration::Round)
        && matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
        && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { skill_id, .. }
            if skill_id.as_str() == "norowas_prayer_of_weather")
    ));
}

#[test]
fn prayer_of_weather_skill_flipped() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
    assert!(state.players[0].skill_flip_state.flipped_skills.iter()
        .any(|s| s.as_str() == "norowas_prayer_of_weather"));
}

#[test]
fn prayer_of_weather_return_gives_minus_1() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
    // Switch to player 1 and return it
    switch_to_player_1(&mut state);
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("norowas_prayer_of_weather"),
        },
        epoch,
    ).unwrap();
    // Returner gets Turn/SelfScope TerrainCost -1
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::TerrainCost {
            amount, minimum, ..
        } if *amount == -1 && *minimum == 1)
        && matches!(&m.duration, mk_types::modifier::ModifierDuration::Turn)
        && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
        && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { player_id, .. }
            if player_id.as_str() == "player_1")
    ));
}

#[test]
fn prayer_of_weather_center_cleared_on_return() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
    switch_to_player_1(&mut state);
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("norowas_prayer_of_weather"),
        },
        epoch,
    ).unwrap();
    // No more OtherPlayers modifiers from player_0
    assert!(!state.active_modifiers.iter().any(|m|
        matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
        && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { player_id, .. }
            if player_id.as_str() == "player_0")
    ));
}

// ---- Ritual of Pain ----

#[test]
fn ritual_of_pain_discard_0_wounds() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
    state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
    activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");
    // Should have pending choice with 2 options (0 or 1 wound)
    assert!(state.players[0].pending.has_active());
    // Choose 0 wounds
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 0 },
        epoch,
    ).unwrap();
    // Wound still in hand
    assert_eq!(state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count(), 1);
    // Skill placed in center
    assert!(state.players[0].skill_flip_state.flipped_skills.iter()
        .any(|s| s.as_str() == "arythea_ritual_of_pain"));
}

#[test]
fn ritual_of_pain_discard_1_wound() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
    state.players[0].hand = vec![CardId::from("wound"), CardId::from("march")];
    activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");
    // Choose 1 wound (index 1)
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 1 },
        epoch,
    ).unwrap();
    // Wound removed
    assert_eq!(state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count(), 0);
    assert_eq!(state.players[0].hand.len(), 1); // only march
}

#[test]
fn ritual_of_pain_discard_2_wounds() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
    state.players[0].hand = vec![
        CardId::from("wound"), CardId::from("wound"), CardId::from("march"),
    ];
    activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");
    // Should have 3 options: 0, 1, 2 wounds
    // Choose 2 (index 2)
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 2 },
        epoch,
    ).unwrap();
    assert_eq!(state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count(), 0);
    assert_eq!(state.players[0].hand.len(), 1); // only march
}

#[test]
fn ritual_of_pain_center_modifiers() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
    state.players[0].hand = vec![CardId::from("march")]; // no wounds → skip to center
    activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");
    // Center markers: WoundsPlayableSideways + SidewaysValue(3)
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride {
            rule: mk_types::modifier::RuleOverride::WoundsPlayableSideways
        })
        && matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
    ));
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::SidewaysValue {
            new_value, for_wounds, ..
        } if *new_value == 3 && *for_wounds)
        && matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
    ));
}

#[test]
fn ritual_of_pain_return_wounds_sideways() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
    state.players[0].hand = vec![CardId::from("march")]; // no wounds
    activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");
    switch_to_player_1(&mut state);
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("arythea_ritual_of_pain"),
        },
        epoch,
    ).unwrap();
    // Returner gets Turn/SelfScope wound modifiers
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride {
            rule: mk_types::modifier::RuleOverride::WoundsPlayableSideways
        })
        && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
        && matches!(&m.duration, mk_types::modifier::ModifierDuration::Turn)
        && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { player_id, .. }
            if player_id.as_str() == "player_1")
    ));
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::SidewaysValue {
            new_value, for_wounds, ..
        } if *new_value == 3 && *for_wounds)
        && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
        && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { player_id, .. }
            if player_id.as_str() == "player_1")
    ));
}

// ---- Nature's Vengeance ----

/// Helper: set up a combat game with specified enemy ids for 2-player skill tests.

#[test]
fn natures_vengeance_attack_minus_1() {
    let (mut state, mut undo) = setup_two_player_combat_with_skill(
        Hero::Braevalar, "braevalar_natures_vengeance", &["prowlers"],
    );
    activate_skill(&mut state, &mut undo, "braevalar_natures_vengeance");
    // Single enemy → auto-apply. Should have EnemyStat Attack -1
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat, amount, ..
        } if *stat == mk_types::modifier::EnemyStat::Attack && *amount == -1)
    ));
}

#[test]
fn natures_vengeance_grants_cumbersome() {
    let (mut state, mut undo) = setup_two_player_combat_with_skill(
        Hero::Braevalar, "braevalar_natures_vengeance", &["prowlers"],
    );
    activate_skill(&mut state, &mut undo, "braevalar_natures_vengeance");
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::GrantEnemyAbility {
            ability
        } if *ability == EnemyAbilityType::Cumbersome)
    ));
}

#[test]
fn natures_vengeance_cumbersome_spend_move() {
    let (mut state, mut undo) = setup_two_player_combat_with_skill(
        Hero::Braevalar, "braevalar_natures_vengeance", &["prowlers"],
    );
    activate_skill(&mut state, &mut undo, "braevalar_natures_vengeance");
    // Player needs move points + correct combat phase to spend on cumbersome
    state.players[0].move_points = 2;
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let enemy_id = state.combat.as_ref().unwrap().enemies[0].instance_id.clone();
    assert!(actions.actions.iter().any(|a|
        matches!(a, LegalAction::SpendMoveOnCumbersome { enemy_instance_id }
            if *enemy_instance_id == enemy_id)
    ));
}

#[test]
fn natures_vengeance_excludes_summoners() {
    let (state, _undo) = setup_two_player_combat_with_skill(
        Hero::Braevalar, "braevalar_natures_vengeance", &["orc_summoners"],
    );
    // orc_summoners has Summon ability → should NOT show UseSkill
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(!actions.actions.iter().any(|a|
        matches!(a, LegalAction::UseSkill { skill_id }
            if skill_id.as_str() == "braevalar_natures_vengeance")
    ));
}

#[test]
fn natures_vengeance_allows_arcane_immune() {
    // shadow has ArcaneImmunity — NV should still target it
    let (mut state, mut undo) = setup_two_player_combat_with_skill(
        Hero::Braevalar, "braevalar_natures_vengeance", &["shadow"],
    );
    activate_skill(&mut state, &mut undo, "braevalar_natures_vengeance");
    // Auto-apply (single enemy). Should have the modifiers
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat, amount, ..
        } if *stat == mk_types::modifier::EnemyStat::Attack && *amount == -1)
    ));
}

#[test]
fn natures_vengeance_center_penalty() {
    let (mut state, mut undo) = setup_two_player_combat_with_skill(
        Hero::Braevalar, "braevalar_natures_vengeance", &["prowlers"],
    );
    activate_skill(&mut state, &mut undo, "braevalar_natures_vengeance");
    // NaturesVengeanceAttackBonus marker in center
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::NaturesVengeanceAttackBonus {
            amount
        } if *amount == 1)
        && matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
        && matches!(&m.duration, mk_types::modifier::ModifierDuration::Round)
    ));
}

// ---- Infrastructure ----

#[test]
fn interactive_skill_cooldown() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
    // Skill in used_this_round → should not be usable again
    assert!(state.players[0].skill_cooldowns.used_this_round.iter()
        .any(|s| s.as_str() == "norowas_prayer_of_weather"));
}

#[test]
fn interactive_skill_not_available_when_flipped() {
    let (mut state, _undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    // Pre-flip the skill
    state.players[0].skill_flip_state.flipped_skills.push(
        mk_types::ids::SkillId::from("norowas_prayer_of_weather")
    );
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(!actions.actions.iter().any(|a|
        matches!(a, LegalAction::UseSkill { skill_id }
            if skill_id.as_str() == "norowas_prayer_of_weather")
    ));
}

#[test]
fn returnable_skill_not_shown_for_owner() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
    // Owner (player 0) should NOT see ReturnInteractiveSkill
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(!actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { .. })
    ));
    // But player 1 should
    switch_to_player_1(&mut state);
    let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
    assert!(actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { skill_id }
            if skill_id.as_str() == "norowas_prayer_of_weather")
    ));
}

// =========================================================================
// Step 2: Block returns after last turn
// =========================================================================

#[test]
fn cannot_return_skill_after_last_turn_complete() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");

    // Simulate: player_0 announced end of round, player_1 took their final turn.
    // Now player_1's last turn is over (not in players_with_final_turn).
    state.end_of_round_announced_by = Some(mk_types::ids::PlayerId::from("player_0"));
    state.players_with_final_turn.clear(); // Both final turns done

    // Player 1 should NOT be able to return the skill
    let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
    assert!(!actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { .. })
    ), "Should not be able to return skill after last turn is over");
}

#[test]
fn can_return_skill_during_final_turn() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");

    // Player_0 announced end of round, player_1 still has final turn.
    state.end_of_round_announced_by = Some(mk_types::ids::PlayerId::from("player_0"));
    state.players_with_final_turn = vec![mk_types::ids::PlayerId::from("player_1")];

    // Switch to player 1's turn
    switch_to_player_1(&mut state);
    let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
    assert!(actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { skill_id }
            if skill_id.as_str() == "norowas_prayer_of_weather")
    ), "Should be able to return skill during final turn");
}

#[test]
fn announcer_cannot_return_after_their_turn_ends() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");

    // Player 0 activates prayer, then switch to player_1 who also has a skill
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");

    // Player 1 announced end of round (so they still need to end their turn,
    // but after they do, they can't return).
    state.end_of_round_announced_by = Some(mk_types::ids::PlayerId::from("player_1"));
    state.players_with_final_turn = vec![mk_types::ids::PlayerId::from("player_0")];

    // Switch to player_0's final turn — player_1 is done (they announced, not in final_turn list)
    state.current_player_index = 0;
    let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
    assert!(!actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { .. })
    ), "Announcer should not be able to return skills after announcing");
}

// =========================================================================
// Step 3: Interactive skills returnable out-of-turn
// =========================================================================

#[test]
fn non_active_player_can_return_prayer_of_weather() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");

    // Player 0 is current player. Player 1 should be able to return out-of-turn.
    assert_eq!(state.current_player_index, 0);
    let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
    assert!(actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { skill_id }
            if skill_id.as_str() == "norowas_prayer_of_weather")
    ), "Non-active player should be able to return interactive skill out-of-turn");
}

#[test]
fn non_active_player_can_return_ritual_of_pain() {
    let (mut state, _undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");

    // Manually place ritual of pain center modifiers (simulating activation)
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("test_mod"),
        effect: ModifierEffect::RuleOverride { rule: RuleOverride::WoundsPlayableSideways },
        source: ModifierSource::Skill {
            skill_id: SkillId::from("arythea_ritual_of_pain"),
            player_id: mk_types::ids::PlayerId::from("player_0"),
        },
        duration: ModifierDuration::Round,
        scope: ModifierScope::OtherPlayers,
        created_at_round: 1,
        created_by_player_id: mk_types::ids::PlayerId::from("player_0"),
    });

    // Player 1 should see return option out-of-turn
    assert_eq!(state.current_player_index, 0);
    let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
    assert!(actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { skill_id }
            if skill_id.as_str() == "arythea_ritual_of_pain")
    ), "Non-active player should be able to return Ritual of Pain out-of-turn");
}

#[test]
fn natures_vengeance_gated_on_combat_even_out_of_turn() {
    let (mut state, _undo) = setup_two_player_with_skill(Hero::Braevalar, "braevalar_natures_vengeance");

    // Manually place natures_vengeance center modifiers (simulating activation)
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("test_mod"),
        effect: ModifierEffect::RuleOverride { rule: RuleOverride::WoundsPlayableSideways },
        source: ModifierSource::Skill {
            skill_id: SkillId::from("braevalar_natures_vengeance"),
            player_id: mk_types::ids::PlayerId::from("player_0"),
        },
        duration: ModifierDuration::Round,
        scope: ModifierScope::OtherPlayers,
        created_at_round: 1,
        created_by_player_id: mk_types::ids::PlayerId::from("player_0"),
    });

    // Outside combat: return should NOT be available (requires combat)
    assert!(state.combat.is_none());
    let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
    assert!(!actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { skill_id }
            if skill_id.as_str() == "braevalar_natures_vengeance")
    ), "Should NOT see return outside combat for natures_vengeance");

    // Enter combat: now should be available
    let tokens: Vec<mk_types::ids::EnemyTokenId> = vec![mk_types::ids::EnemyTokenId::from("prowlers_1")];
    crate::combat::execute_enter_combat(&mut state, 0, &tokens, false, None, Default::default()).unwrap();
    assert!(state.combat.is_some());
    let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
    assert!(actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { skill_id }
            if skill_id.as_str() == "braevalar_natures_vengeance")
    ), "Should see return in combat for natures_vengeance");
}

