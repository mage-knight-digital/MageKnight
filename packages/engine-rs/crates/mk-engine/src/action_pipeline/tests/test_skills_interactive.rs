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

// =========================================================================
// Ritual of Pain: OtherPlayers scope must NOT apply to owner
// =========================================================================

#[test]
fn ritual_of_pain_owner_wounds_not_playable_sideways() {
    // Bug: OtherPlayers-scoped modifiers from Ritual of Pain incorrectly apply
    // to Arythea (the owner). The scope means only OTHER players should benefit.
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
    state.players[0].hand = vec![CardId::from("march")]; // no wounds → skip to center
    activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");

    // Confirm OtherPlayers-scoped modifiers exist in the center
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride {
            rule: mk_types::modifier::RuleOverride::WoundsPlayableSideways
        })
        && matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
    ));

    // Now give Arythea a wound to test sideways play
    state.players[0].hand.push(CardId::from("wound"));

    // WoundsPlayableSideways should NOT be active for the owner
    assert!(
        !crate::card_play::is_rule_active(
            &state, 0,
            mk_types::modifier::RuleOverride::WoundsPlayableSideways,
        ),
        "WoundsPlayableSideways should NOT be active for the skill owner (OtherPlayers scope)",
    );

    // Wound sideways value should remain 0 for the owner
    let sw_val = crate::card_play::get_effective_sideways_value(
        &state, 0, true,
        mk_types::enums::DeedCardType::Wound,
        None,
    );
    assert_eq!(sw_val, 0, "Wound sideways value should be 0 for the skill owner");
}

// =========================================================================
// Solo interactive skill self-return
// =========================================================================

/// Helper: set up a solo game with a skill (uses create_solo_game → has dummy_player).
/// Simulates advancing to the next turn by calling advance_turn_pub.
fn solo_advance_turn(state: &mut GameState) {
    // Reset turn state for current player before advancing
    let player_idx = state.current_player_index as usize;
    crate::end_turn::advance_turn_pub(state, player_idx);
}

#[test]
fn solo_self_return_available_next_turn() {
    let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");

    // On the same turn, return should NOT be available (owner == self, same turn)
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(!actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { .. })
    ), "Should NOT be able to self-return on the same turn");

    // Advance to next turn
    solo_advance_turn(&mut state);

    // Now return should be available
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { skill_id }
            if skill_id.as_str() == "norowas_prayer_of_weather")
    ), "Should be able to self-return on the next turn in solo");
}

#[test]
fn solo_self_return_not_available_same_turn() {
    let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(!actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { .. })
    ), "Should NOT see self-return on the same turn");
}

#[test]
fn solo_self_return_expired_after_window() {
    let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");

    // Placement was at turn_number=0. Set turn_number=2 to simulate two turns later.
    // The return window is placement_turn + 1, so turn_number > pt + 1 means expired.
    state.turn_number = 2;

    // solo_return_window_open checks placement_turn < turn_number (0 < 2 = true),
    // but the EXPIRY logic in advance_turn cleans up the modifiers. Since we're testing
    // the enumeration logic directly, the modifiers still exist here.
    // The return should still be offered if modifiers exist and window is open.
    // What we really want to test is that advance_turn expires them.
    // Simulate the expiry that advance_turn would do:
    solo_advance_turn(&mut state);

    // After advance with turn_number > pt + 1, modifiers should be expired
    let has_center_modifier = state.active_modifiers.iter().any(|m|
        matches!(&m.source, mk_types::modifier::ModifierSource::Skill { skill_id, .. }
            if skill_id.as_str() == "norowas_prayer_of_weather")
        && matches!(m.duration, mk_types::modifier::ModifierDuration::Round)
        && matches!(m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
    );
    assert!(!has_center_modifier,
        "Center modifiers should be expired after return window passes");

    // And return should not be available (no modifiers to return)
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(!actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { .. })
    ), "Should NOT see self-return after return window expires");
}

#[test]
fn solo_self_return_grants_terrain_cost_benefit() {
    let (mut state, mut undo) = setup_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
    solo_advance_turn(&mut state);

    // Return the skill
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("norowas_prayer_of_weather"),
        },
        epoch,
    ).unwrap();

    // Returner (self) gets Turn/SelfScope TerrainCost -1
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::TerrainCost {
            amount, minimum, ..
        } if *amount == -1 && *minimum == 1)
        && matches!(&m.duration, mk_types::modifier::ModifierDuration::Turn)
        && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
    ), "Solo self-return of Prayer of Weather should grant TerrainCost -1");
}

#[test]
fn solo_ritual_of_pain_self_return() {
    let (mut state, mut undo) = setup_with_skill(Hero::Arythea, "arythea_ritual_of_pain");
    state.players[0].hand = vec![CardId::from("march")]; // no wounds → skip to center
    activate_skill(&mut state, &mut undo, "arythea_ritual_of_pain");
    solo_advance_turn(&mut state);

    // Return the skill
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("arythea_ritual_of_pain"),
        },
        epoch,
    ).unwrap();

    // Returner gets WoundsPlayableSideways + SidewaysValue(3)
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride {
            rule: mk_types::modifier::RuleOverride::WoundsPlayableSideways
        })
        && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
        && matches!(&m.duration, mk_types::modifier::ModifierDuration::Turn)
    ), "Solo self-return of Ritual of Pain should grant WoundsPlayableSideways");

    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::SidewaysValue {
            new_value, for_wounds, ..
        } if *new_value == 3 && *for_wounds)
        && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
    ), "Solo self-return of Ritual of Pain should grant SidewaysValue(3)");
}

#[test]
fn solo_mana_enhancement_available_next_turn() {
    let (mut state, _undo) = setup_with_skill(Hero::Krang, "krang_mana_enhancement");

    // Manually trigger mana enhancement (simulating card play with mana consumption)
    let skill_id = mk_types::ids::SkillId::from("krang_mana_enhancement");
    state.mana_enhancement_center = Some(mk_types::state::ManaEnhancementCenter {
        marked_color: BasicManaColor::Red,
        owner_id: state.players[0].id.clone(),
        skill_id: skill_id.clone(),
        placement_turn: state.turn_number,
    });
    // Push the dummy center marker modifier
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("me_marker"),
        effect: ModifierEffect::TerrainCost {
            terrain: TerrainOrAll::All, amount: 0, minimum: 0, replace_cost: None,
        },
        source: ModifierSource::Skill {
            skill_id,
            player_id: state.players[0].id.clone(),
        },
        duration: ModifierDuration::Round,
        scope: ModifierScope::OtherPlayers,
        created_at_round: 1,
        created_by_player_id: state.players[0].id.clone(),
    });

    // Same turn: NOT available
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(!actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { skill_id }
            if skill_id.as_str() == "krang_mana_enhancement")
    ), "Mana Enhancement return should NOT be available on same turn");

    // Advance turn
    solo_advance_turn(&mut state);

    // Next turn: available
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { skill_id }
            if skill_id.as_str() == "krang_mana_enhancement")
    ), "Mana Enhancement return should be available on next turn in solo");
}

#[test]
fn solo_mana_enhancement_expired_after_window() {
    let (mut state, _undo) = setup_with_skill(Hero::Krang, "krang_mana_enhancement");

    let skill_id = mk_types::ids::SkillId::from("krang_mana_enhancement");
    state.mana_enhancement_center = Some(mk_types::state::ManaEnhancementCenter {
        marked_color: BasicManaColor::Red,
        owner_id: state.players[0].id.clone(),
        skill_id: skill_id.clone(),
        placement_turn: state.turn_number,
    });
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("me_marker"),
        effect: ModifierEffect::TerrainCost {
            terrain: TerrainOrAll::All, amount: 0, minimum: 0, replace_cost: None,
        },
        source: ModifierSource::Skill {
            skill_id,
            player_id: state.players[0].id.clone(),
        },
        duration: ModifierDuration::Round,
        scope: ModifierScope::OtherPlayers,
        created_at_round: 1,
        created_by_player_id: state.players[0].id.clone(),
    });

    // Advance twice — should expire
    solo_advance_turn(&mut state);
    solo_advance_turn(&mut state);

    // Mana Enhancement center should be cleared
    assert!(state.mana_enhancement_center.is_none(),
        "Mana Enhancement should be expired after return window passes");
}

#[test]
fn time_bending_expires_center_skills() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");

    // Confirm center modifiers exist
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
        && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { skill_id, .. }
            if skill_id.as_str() == "norowas_prayer_of_weather")
    ), "Center modifiers should exist before Time Bending");

    // Simulate Time Bending: set the flag and call advance_turn with is_time_bending
    state.players[0].flags.insert(PlayerFlags::IS_TIME_BENT_TURN);
    // Use advance_turn_pub which calls advance_turn(state, idx, false)
    // But we need Time Bending path. Let's manually trigger via end_turn with the right state.
    // Actually the Time Bending flag is checked in advance_turn, so let's simulate it:
    // The tactic state's extra_turn_pending + IS_TIME_BENT_TURN logic is different.
    // Time Bending in advance_turn is via the `is_time_bending` parameter.
    // We can't easily trigger it via the public API in a unit test, so let's verify
    // that expire_interactive_skills_for_player works correctly.
    crate::end_turn::expire_interactive_skills_for_player_pub(&state.players[0].id.clone(), &mut state);

    // Center modifiers should be cleared
    assert!(!state.active_modifiers.iter().any(|m|
        matches!(&m.scope, mk_types::modifier::ModifierScope::OtherPlayers)
        && matches!(&m.source, mk_types::modifier::ModifierSource::Skill { skill_id, .. }
            if skill_id.as_str() == "norowas_prayer_of_weather")
    ), "Center modifiers should be cleared by Time Bending expiry");
}

#[test]
fn multiplayer_return_still_works_after_solo_changes() {
    // Regression: ensure multiplayer return is unaffected by the solo changes
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Norowas, "norowas_prayer_of_weather");
    activate_skill(&mut state, &mut undo, "norowas_prayer_of_weather");
    switch_to_player_1(&mut state);

    // Player 1 should see return option
    let actions = enumerate_legal_actions_with_undo(&state, 1, &UndoStack::new());
    assert!(actions.actions.iter().any(|a|
        matches!(a, LegalAction::ReturnInteractiveSkill { skill_id }
            if skill_id.as_str() == "norowas_prayer_of_weather")
    ), "Multiplayer return should still work");

    // Execute the return
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("norowas_prayer_of_weather"),
        },
        epoch,
    ).unwrap();

    // Player 1 gets the benefit
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::TerrainCost {
            amount, ..
        } if *amount == -1)
        && matches!(&m.scope, mk_types::modifier::ModifierScope::SelfScope)
    ), "Multiplayer return benefit should be granted");
}

