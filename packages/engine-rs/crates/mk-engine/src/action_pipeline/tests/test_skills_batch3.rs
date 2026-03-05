use super::*;

// =========================================================================
// Batch 3: Mana Overload
// =========================================================================

#[test]
fn mana_overload_creates_color_choice() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
    activate_skill(&mut state, &mut undo, "tovak_mana_overload");
    // Should have a pending choice with 5 options (Red, Blue, Green, White, Black)
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => {
            assert_eq!(c.options.len(), 5);
            assert!(matches!(c.resolution, mk_types::pending::ChoiceResolution::ManaOverloadColorSelect));
        }
        other => panic!("Expected ManaOverloadColorSelect pending, got {:?}", other),
    }
}

#[test]
fn mana_overload_color_select_sets_center() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
    activate_skill(&mut state, &mut undo, "tovak_mana_overload");
    // Choose Red (index 0)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 0 }, epoch).unwrap();
    // Center should be set with Red
    let center = state.mana_overload_center.as_ref().expect("center should be set");
    assert_eq!(center.marked_color, ManaColor::Red);
    assert_eq!(center.owner_id.as_str(), "player_0");
}

#[test]
fn mana_overload_color_select_gains_mana_token() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
    activate_skill(&mut state, &mut undo, "tovak_mana_overload");
    let initial_mana = state.players[0].pure_mana.len();
    // Choose Blue (index 1) — the GainMana effect resolves via queue
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 1 }, epoch).unwrap();
    // Should have gained 1 blue mana token
    assert_eq!(state.players[0].pure_mana.len(), initial_mana + 1);
    assert_eq!(state.players[0].pure_mana.last().unwrap().color, ManaColor::Blue);
}

#[test]
fn mana_overload_trigger_on_matching_color() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
    activate_skill(&mut state, &mut undo, "tovak_mana_overload");
    // Choose Green (index 2)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 2 }, epoch).unwrap();
    assert!(state.mana_overload_center.is_some());

    // Switch to player_1 and give them a green mana token + march card
    switch_to_player_1(&mut state);
    state.source.dice.clear(); // control mana sources explicitly
    state.players[1].hand = vec![CardId::from("march")];
    state.players[1].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Green,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let initial_move = state.players[1].move_points;
    // Play march powered (needs green = matches Mana Overload's color)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("march"),
            mana_color: mk_types::enums::BasicManaColor::Green,
        }, epoch).unwrap();
    // March powered = 4 move, Mana Overload trigger = +4 move → 8 total
    assert_eq!(state.players[1].move_points, initial_move + 4 + 4);
    // Center should be cleared
    assert!(state.mana_overload_center.is_none());
}

#[test]
fn mana_overload_no_trigger_wrong_color() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
    activate_skill(&mut state, &mut undo, "tovak_mana_overload");
    // Choose Red (index 0)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 0 }, epoch).unwrap();
    assert!(state.mana_overload_center.is_some());

    // Player 1 powers march with GREEN (not Red) → no trigger
    switch_to_player_1(&mut state);
    state.source.dice.clear(); // control mana sources explicitly
    state.players[1].hand = vec![CardId::from("march")];
    state.players[1].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Green,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("march"),
            mana_color: mk_types::enums::BasicManaColor::Green,
        }, epoch).unwrap();
    // March powered = 4 move, no bonus (wrong color)
    assert_eq!(state.players[1].move_points, 4);
    // Center should still be set
    assert!(state.mana_overload_center.is_some());
}

#[test]
fn mana_overload_skill_flipped_after_activation() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
    activate_skill(&mut state, &mut undo, "tovak_mana_overload");
    // Choose any color
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 0 }, epoch).unwrap();
    // Skill should be flipped
    assert!(state.players[0].skill_flip_state.flipped_skills.iter()
        .any(|s| s.as_str() == "tovak_mana_overload"));
}

// =========================================================================
// Batch 3: Mana Enhancement
// =========================================================================

#[test]
fn mana_enhancement_trigger_on_basic_mana() {
    let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");
    state.source.dice.clear(); // control mana sources explicitly
    state.players[0].hand = vec![CardId::from("march")];
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Green,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let initial_green_crystals = state.players[0].crystals.green;
    let mut undo = UndoStack::new();
    // Play march powered with green mana
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("march"),
            mana_color: mk_types::enums::BasicManaColor::Green,
        }, epoch).unwrap();
    // Should gain 1 green crystal
    assert_eq!(state.players[0].crystals.green, initial_green_crystals + 1);
    // Center should be set
    assert!(state.mana_enhancement_center.is_some());
    let center = state.mana_enhancement_center.as_ref().unwrap();
    assert_eq!(center.marked_color, mk_types::enums::BasicManaColor::Green);
}

#[test]
fn mana_enhancement_no_trigger_gold_mana() {
    let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");
    state.players[0].hand = vec![CardId::from("march")];
    // Give gold mana token (not a basic color)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Gold,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let initial_crystals = state.players[0].crystals;
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("march"),
            mana_color: mk_types::enums::BasicManaColor::Green,
        }, epoch).unwrap();
    // No crystal gain (gold mana not basic)
    assert_eq!(state.players[0].crystals, initial_crystals);
    assert!(state.mana_enhancement_center.is_none());
}

#[test]
fn mana_enhancement_return_gives_mana_token() {
    let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");
    state.source.dice.clear(); // control mana sources explicitly
    state.players[0].hand = vec![CardId::from("march")];
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Green,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("march"),
            mana_color: mk_types::enums::BasicManaColor::Green,
        }, epoch).unwrap();
    assert!(state.mana_enhancement_center.is_some());

    // Player 1 returns the skill
    switch_to_player_1(&mut state);
    let initial_p1_mana = state.players[1].pure_mana.len();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("krang_mana_enhancement"),
        }, epoch).unwrap();
    // Player 1 should gain 1 green mana token
    assert_eq!(state.players[1].pure_mana.len(), initial_p1_mana + 1);
    assert_eq!(state.players[1].pure_mana.last().unwrap().color, ManaColor::Green);
    // Center should be cleared
    assert!(state.mana_enhancement_center.is_none());
}

#[test]
fn mana_enhancement_cooldown() {
    let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");
    state.source.dice.clear(); // control mana sources explicitly
    state.players[0].hand = vec![CardId::from("march"), CardId::from("march")];
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Green,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("march"),
            mana_color: mk_types::enums::BasicManaColor::Green,
        }, epoch).unwrap();
    // Should be in used_this_round cooldown
    assert!(state.players[0].skill_cooldowns.used_this_round.iter()
        .any(|s| s.as_str() == "krang_mana_enhancement"));

    // Second powered play should NOT trigger again
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Green,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let green_crystals_after_first = state.players[0].crystals.green;
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("march"),
            mana_color: mk_types::enums::BasicManaColor::Green,
        }, epoch).unwrap();
    // Crystals unchanged (cooldown prevents second trigger)
    assert_eq!(state.players[0].crystals.green, green_crystals_after_first);
}

// =========================================================================
// Batch 3: Source Opening
// =========================================================================

#[test]
fn source_opening_creates_die_select() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    // Ensure there are available dice
    assert!(!state.source.dice.is_empty());
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => {
            // Options = number of available dice + 1 skip
            let available = state.source.dice.iter()
                .filter(|d| d.taken_by_player_id.is_none() && !d.is_depleted)
                .count();
            assert!(matches!(c.resolution, mk_types::pending::ChoiceResolution::SourceOpeningDieSelect { .. }));
            assert_eq!(c.options.len(), available + 1); // +1 for skip
        }
        other => panic!("Expected SourceOpeningDieSelect pending, got {:?}", other),
    }
}

#[test]
fn source_opening_skip_reroll_sets_center() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    // Choose skip (last option)
    let skip_idx = match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
        _ => panic!("Expected choice"),
    };
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();
    // Center should be set
    assert!(state.source_opening_center.is_some());
    let center = state.source_opening_center.as_ref().unwrap();
    assert_eq!(center.owner_id.as_str(), "player_0");
}

#[test]
fn source_opening_reroll_die_sets_center() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    let initial_rng_counter = state.rng.counter;
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    // Choose first die (index 0)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 0 }, epoch).unwrap();
    // Center should be set
    assert!(state.source_opening_center.is_some());
    // RNG should have been consumed (reroll)
    assert!(state.rng.counter > initial_rng_counter);
}

#[test]
fn source_opening_return_grants_extra_die() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    // Skip reroll
    let skip_idx = match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
        _ => panic!("Expected choice"),
    };
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

    // Player 1 returns the skill
    switch_to_player_1(&mut state);
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
        }, epoch).unwrap();
    // Player 1 should have ExtraSourceDie modifier
    assert!(state.active_modifiers.iter().any(|m|
        matches!(&m.effect, mk_types::modifier::ModifierEffect::RuleOverride {
            rule: mk_types::modifier::RuleOverride::ExtraSourceDie })
        && m.created_by_player_id.as_str() == "player_1"
    ));
}

#[test]
fn source_opening_no_dice_skips_to_center() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    // Clear all dice so none are available
    state.source.dice.clear();
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    // Should skip straight to center (no pending choice)
    assert!(state.players[0].pending.active.is_none());
    assert!(state.source_opening_center.is_some());
}

// =========================================================================
// Batch 3: Master of Chaos
// =========================================================================

#[test]
fn master_of_chaos_initial_position_set() {
    let mut state = create_solo_game(42, Hero::Krang);
    state.round_phase = RoundPhase::PlayerTurns;
    state.phase = GamePhase::Round;
    let skill_id = mk_types::ids::SkillId::from("krang_master_of_chaos");
    state.players[0].skills.push(skill_id.clone());
    // Initialize MoC state (simulating skill acquisition)
    init_master_of_chaos_if_needed(&mut state, 0, &skill_id);
    assert!(state.players[0].master_of_chaos_state.is_some());
}

#[test]
fn master_of_chaos_rotates_clockwise() {
    assert_eq!(rotate_clockwise(ManaColor::Blue), ManaColor::Green);
    assert_eq!(rotate_clockwise(ManaColor::Green), ManaColor::Black);
    assert_eq!(rotate_clockwise(ManaColor::Black), ManaColor::White);
    assert_eq!(rotate_clockwise(ManaColor::White), ManaColor::Red);
    assert_eq!(rotate_clockwise(ManaColor::Red), ManaColor::Gold);
    assert_eq!(rotate_clockwise(ManaColor::Gold), ManaColor::Blue);
}

#[test]
fn master_of_chaos_white_gives_influence_2() {
    let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
    // Set position to Black so rotating lands on White = Influence 2
    state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
        position: ManaColor::Black,
        free_rotate_available: false,
    });
    state.players[0].hand = vec![CardId::from("march")];
    activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
    assert_eq!(state.players[0].influence_points, 2);
    assert_eq!(state.players[0].master_of_chaos_state.as_ref().unwrap().position, ManaColor::White);
}

#[test]
fn master_of_chaos_green_gives_move_1() {
    let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
    // Set position to Blue so rotating lands on Green
    state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
        position: ManaColor::Blue,
        free_rotate_available: false,
    });
    state.players[0].hand = vec![CardId::from("march")];
    activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
    assert_eq!(state.players[0].move_points, 1);
    assert_eq!(state.players[0].master_of_chaos_state.as_ref().unwrap().position, ManaColor::Green);
}

#[test]
fn master_of_chaos_gold_gives_choice() {
    let (mut state, mut undo) = setup_two_player_combat_with_skill(
        Hero::Krang, "krang_master_of_chaos", &["prowlers"],
    );
    // Use Attack phase so melee option is resolvable
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    // Set position to Red so rotating lands on Gold
    state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
        position: ManaColor::Red,
        free_rotate_available: false,
    });
    activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
    // In combat, Move and Influence are filtered out → 3 options remain (Block, Ranged, Melee)
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => {
            assert_eq!(c.options.len(), 3);
            assert!(matches!(c.resolution, mk_types::pending::ChoiceResolution::MasterOfChaosGoldChoice));
        }
        other => panic!("Expected MasterOfChaosGoldChoice pending, got {:?}", other),
    }
}

#[test]
fn master_of_chaos_once_per_turn_cooldown() {
    let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
    state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
        position: ManaColor::Blue,
        free_rotate_available: false,
    });
    state.players[0].hand = vec![CardId::from("march"), CardId::from("march")];
    activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
    // Used this turn
    assert!(state.players[0].skill_cooldowns.used_this_turn.iter()
        .any(|s| s.as_str() == "krang_master_of_chaos"));
    // Second activation should not be available
    let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
    assert!(!actions.actions.iter().any(|a|
        matches!(a, LegalAction::UseSkill { skill_id }
            if skill_id.as_str() == "krang_master_of_chaos")
    ));
}

// =========================================================================
// Batch 3: Effect detection helpers
// =========================================================================

// =========================================================================
// Batch 3 Edge Cases: Mana Overload
// =========================================================================

#[test]
fn mana_overload_no_trigger_on_basic_play() {
    // Playing a card as basic (not powered) should NOT trigger Mana Overload
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
    activate_skill(&mut state, &mut undo, "tovak_mana_overload");
    // Choose Red (index 0)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 0 }, epoch).unwrap();
    assert!(state.mana_overload_center.is_some());

    // Player 1 plays march BASIC (not powered) → should NOT trigger
    switch_to_player_1(&mut state);
    state.players[1].hand = vec![CardId::from("march")];
    let initial_move = state.players[1].move_points;
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::PlayCardBasic {
            hand_index: 0, card_id: CardId::from("march"),
        }, epoch).unwrap();
    // March basic = 2 move, no overload bonus
    assert_eq!(state.players[1].move_points, initial_move + 2);
    // Center should still be set
    assert!(state.mana_overload_center.is_some());
}

#[test]
fn mana_overload_no_trigger_on_effect_without_applicable_type() {
    // Powered effect with only Heal/Draw (no Move/Influence/Attack/Block) → no trigger
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
    activate_skill(&mut state, &mut undo, "tovak_mana_overload");
    // Choose White (index 3)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 3 }, epoch).unwrap();
    assert!(state.mana_overload_center.is_some());

    // Player 1 powers "tranquility" (White card: powered = Heal 2 → no Move/Influence/Attack/Block)
    switch_to_player_1(&mut state);
    state.players[1].hand = vec![CardId::from("tranquility")];
    state.players[1].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("tranquility"),
            mana_color: mk_types::enums::BasicManaColor::White,
        }, epoch).unwrap();
    // Center should still be set (no applicable bonus type)
    assert!(state.mana_overload_center.is_some());
}

#[test]
fn mana_overload_no_trigger_on_gold_mana() {
    // Powering with a Gold mana token should NOT match any Mana Overload color
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
    activate_skill(&mut state, &mut undo, "tovak_mana_overload");
    // Choose Green (index 2)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 2 }, epoch).unwrap();
    assert!(state.mana_overload_center.is_some());

    // Player 1 powers march with Gold mana (not Green)
    switch_to_player_1(&mut state);
    state.source.dice.clear(); // control mana sources explicitly
    state.players[1].hand = vec![CardId::from("march")];
    state.players[1].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Gold,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("march"),
            mana_color: mk_types::enums::BasicManaColor::Green,
        }, epoch).unwrap();
    // March powered = 4 move, no overload bonus (Gold mana used, not Green)
    assert_eq!(state.players[1].move_points, 4);
    assert!(state.mana_overload_center.is_some());
}

#[test]
fn mana_overload_round_cooldown() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Tovak, "tovak_mana_overload");
    activate_skill(&mut state, &mut undo, "tovak_mana_overload");
    // Should be on round cooldown (Interactive = used_this_round)
    assert!(state.players[0].skill_cooldowns.used_this_round.iter()
        .any(|s| s.as_str() == "tovak_mana_overload"));
}

// =========================================================================
// Batch 3 Edge Cases: Mana Enhancement
// =========================================================================

#[test]
fn mana_enhancement_trigger_on_unit_activation() {
    // Mana Enhancement should trigger when Krang spends basic mana to activate a unit
    let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");

    // Put Krang in combat so unit activation works
    use mk_types::state::PlayerUnit;
    state.combat = Some(Box::new(CombatState::default()));

    // Add a unit with Green mana cost (Herbalist — Heal 2, costed Green)
    state.players[0].units.push(PlayerUnit {
        unit_id: mk_types::ids::UnitId::from("herbalist"),
        instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });

    // Give Krang a green mana token for the unit cost
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Green,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let initial_green_crystals = state.players[0].crystals.green;
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 0,
        }, epoch).unwrap();
    // Should gain 1 green crystal from Mana Enhancement
    assert_eq!(state.players[0].crystals.green, initial_green_crystals + 1);
    assert!(state.mana_enhancement_center.is_some());
}

#[test]
fn mana_enhancement_no_trigger_on_unit_gold_mana() {
    // Unit activation with Gold mana should NOT trigger Mana Enhancement
    let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");

    use mk_types::state::PlayerUnit;
    state.combat = Some(Box::new(CombatState::default()));

    state.players[0].units.push(PlayerUnit {
        unit_id: mk_types::ids::UnitId::from("peasants"),
        instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: vec![],
        mana_token: None,
    });

    // Give only Gold mana
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Gold,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let initial_crystals = state.players[0].crystals;
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ActivateUnit {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            ability_index: 0,
        }, epoch).unwrap();
    // No crystal gain (Gold mana not basic)
    assert_eq!(state.players[0].crystals, initial_crystals);
    assert!(state.mana_enhancement_center.is_none());
}

#[test]
fn mana_enhancement_expires_at_owner_turn_start() {
    let (mut state, _undo) = setup_two_player_with_skill(Hero::Krang, "krang_mana_enhancement");
    state.source.dice.clear(); // control mana sources explicitly
    state.players[0].hand = vec![CardId::from("march")];
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Green,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    // Trigger Mana Enhancement
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::PlayCardPowered {
            hand_index: 0, card_id: CardId::from("march"),
            mana_color: mk_types::enums::BasicManaColor::Green,
        }, epoch).unwrap();
    assert!(state.mana_enhancement_center.is_some());

    // Simulate advance_turn twice: player_0 → player_1 → back to player_0
    // First advance: player_0 to player_1 (mana enhancement should persist)
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    crate::end_turn::advance_turn_pub(&mut state, 0);
    // Now it's player_1's turn. Center should still exist because it's not owner's turn yet.
    assert!(state.mana_enhancement_center.is_some());

    // Second advance: player_1 to player_0 (should expire)
    state.players[1].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    crate::end_turn::advance_turn_pub(&mut state, 1);
    // Now it's player_0 (Krang) again. Center should be cleared.
    assert!(state.mana_enhancement_center.is_none());
}

// =========================================================================
// Batch 3 Edge Cases: Source Opening
// =========================================================================

#[test]
fn source_opening_no_crystal_when_no_extra_die_used() {
    // If returning player doesn't use the extra die, no crystal is granted
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    let skip_idx = match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
        _ => panic!("Expected choice"),
    };
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();
    assert!(state.source_opening_center.is_some());

    // Player 1 returns the skill
    switch_to_player_1(&mut state);
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
        }, epoch).unwrap();

    // Player 1 does NOT use any extra die — used_die_ids is empty
    let initial_crystals = state.players[0].crystals;

    // End turn for player 1 (simulate by calling check_source_opening_crystal directly)
    let got_crystal = crate::end_turn::check_source_opening_crystal(&mut state, 1);
    assert!(!got_crystal);
    // Goldyx should NOT have gained any crystals
    assert_eq!(state.players[0].crystals, initial_crystals);
}

#[test]
fn source_opening_no_crystal_when_gold_die_used() {
    // If the extra die is Gold (non-basic), no crystal is granted
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    // Set up source dice: one basic + one gold
    state.source.dice = vec![
        mk_types::state::SourceDie {
            id: mk_types::ids::SourceDieId::from("die_0"),
            color: ManaColor::Red,
            is_depleted: false,
            taken_by_player_id: None,
        },
        mk_types::state::SourceDie {
            id: mk_types::ids::SourceDieId::from("die_1"),
            color: ManaColor::Gold,
            is_depleted: false,
            taken_by_player_id: None,
        },
    ];
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    let skip_idx = match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
        _ => panic!("Expected choice"),
    };
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

    // Player 1 returns
    switch_to_player_1(&mut state);
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
        }, epoch).unwrap();

    // Simulate player 1 using 2 dice: die_0 (normal) + die_1 (gold, extra)
    state.players[1].used_die_ids.push(mk_types::ids::SourceDieId::from("die_0"));
    state.players[1].used_die_ids.push(mk_types::ids::SourceDieId::from("die_1"));
    state.source.dice[0].taken_by_player_id = Some(mk_types::ids::PlayerId::from("player_1"));
    state.source.dice[1].taken_by_player_id = Some(mk_types::ids::PlayerId::from("player_1"));

    let initial_crystals = state.players[0].crystals;
    let got_crystal = crate::end_turn::check_source_opening_crystal(&mut state, 1);
    // Gold die → no crystal (non-basic color), but reroll may still be offered
    // The gold die doesn't produce a basic-color crystal
    if got_crystal {
        // If it did trigger, the crystal should NOT have changed (gold → None basic)
        assert_eq!(state.players[0].crystals, initial_crystals);
    }
    // Either way, no crystal gained
    assert_eq!(state.players[0].crystals, initial_crystals);
}

#[test]
fn source_opening_no_crystal_when_only_normal_die_used() {
    // If returning player had already used their normal die before returning,
    // and uses no additional die after return, no crystal is granted.
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    let skip_idx = match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
        _ => panic!("Expected choice"),
    };
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

    switch_to_player_1(&mut state);
    // Player 1 uses their normal die BEFORE returning (baseline)
    let die_id = state.source.dice[0].id.clone();
    state.players[1].used_die_ids.push(die_id);

    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
        }, epoch).unwrap();

    // No additional die used after return — extra_dice_used = 1 - 1 = 0
    let initial_crystals = state.players[0].crystals;
    let got_crystal = crate::end_turn::check_source_opening_crystal(&mut state, 1);
    assert!(!got_crystal);
    assert_eq!(state.players[0].crystals, initial_crystals);
}

#[test]
fn source_opening_crystal_capped_at_max() {
    // If Goldyx is at max crystals for the die color, no extra crystal gained
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    // Set Goldyx to max red crystals
    state.players[0].crystals.red = 3;
    // Ensure source has a red die
    state.source.dice = vec![
        mk_types::state::SourceDie {
            id: mk_types::ids::SourceDieId::from("die_0"),
            color: ManaColor::Blue,
            is_depleted: false,
            taken_by_player_id: None,
        },
        mk_types::state::SourceDie {
            id: mk_types::ids::SourceDieId::from("die_1"),
            color: ManaColor::Red,
            is_depleted: false,
            taken_by_player_id: None,
        },
    ];
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    let skip_idx = match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
        _ => panic!("Expected choice"),
    };
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

    switch_to_player_1(&mut state);
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
        }, epoch).unwrap();

    // Player 1 uses 2 dice: die_0 (normal) + die_1 (red, extra)
    state.players[1].used_die_ids.push(mk_types::ids::SourceDieId::from("die_0"));
    state.players[1].used_die_ids.push(mk_types::ids::SourceDieId::from("die_1"));
    state.source.dice[0].taken_by_player_id = Some(mk_types::ids::PlayerId::from("player_1"));
    state.source.dice[1].taken_by_player_id = Some(mk_types::ids::PlayerId::from("player_1"));

    let got_crystal = crate::end_turn::check_source_opening_crystal(&mut state, 1);
    // Crystal was granted but capped at 3 (gain_crystal handles overflow)
    if got_crystal {
        assert_eq!(state.players[0].crystals.red, 3); // Still 3 (capped)
    }
}

#[test]
fn source_opening_center_cleared_after_end_turn_no_extra_die() {
    // If returning player doesn't use extra die, center is cleared at end of turn
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    let skip_idx = match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
        _ => panic!("Expected choice"),
    };
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

    switch_to_player_1(&mut state);
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
        }, epoch).unwrap();
    assert!(state.source_opening_center.is_some());

    // End turn check with no extra die → should clear center
    let got_crystal = crate::end_turn::check_source_opening_crystal(&mut state, 1);
    assert!(!got_crystal);
    assert!(state.source_opening_center.is_none());
}

#[test]
fn source_opening_return_tracks_returning_player() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    let skip_idx = match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
        _ => panic!("Expected choice"),
    };
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

    switch_to_player_1(&mut state);
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 1,
        &LegalAction::ReturnInteractiveSkill {
            skill_id: mk_types::ids::SkillId::from("goldyx_source_opening"),
        }, epoch).unwrap();

    let center = state.source_opening_center.as_ref().expect("center should exist");
    assert_eq!(center.returning_player_id.as_ref().unwrap().as_str(), "player_1");
    assert_eq!(center.owner_id.as_str(), "player_0");
}

#[test]
fn source_opening_skill_flipped_on_owner() {
    let (mut state, mut undo) = setup_two_player_with_skill(Hero::Goldyx, "goldyx_source_opening");
    activate_skill(&mut state, &mut undo, "goldyx_source_opening");
    let skip_idx = match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => c.options.len() - 1,
        _ => panic!("Expected choice"),
    };
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: skip_idx }, epoch).unwrap();

    // Skill should be flipped on the owner
    assert!(state.players[0].skill_flip_state.flipped_skills.iter()
        .any(|s| s.as_str() == "goldyx_source_opening"));
}

// =========================================================================
// Batch 3 Edge Cases: Master of Chaos
// =========================================================================

#[test]
fn master_of_chaos_green_to_black_ranged_coldfire_1() {
    // Green→Black gives Ranged ColdFire Attack 1 (requires combat)
    let (mut state, mut undo) = setup_two_player_combat_with_skill(
        Hero::Krang, "krang_master_of_chaos", &["prowlers"],
    );
    state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
        position: ManaColor::Green,
        free_rotate_available: false,
    });
    activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
    assert_eq!(state.players[0].master_of_chaos_state.as_ref().unwrap().position, ManaColor::Black);
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 1);
    assert_eq!(state.players[0].combat_accumulator.attack.ranged_elements.cold_fire, 1);
}

#[test]
fn master_of_chaos_white_to_red_attack_2() {
    // White→Red gives Melee Attack 2 (requires combat)
    let (mut state, mut undo) = setup_two_player_combat_with_skill(
        Hero::Krang, "krang_master_of_chaos", &["prowlers"],
    );
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
        position: ManaColor::White,
        free_rotate_available: false,
    });
    activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
    assert_eq!(state.players[0].master_of_chaos_state.as_ref().unwrap().position, ManaColor::Red);
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 2);
}

#[test]
fn master_of_chaos_gold_to_blue_block_3() {
    // Gold→Blue gives Block 3 (requires combat)
    let (mut state, mut undo) = setup_two_player_combat_with_skill(
        Hero::Krang, "krang_master_of_chaos", &["prowlers"],
    );
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
        position: ManaColor::Gold,
        free_rotate_available: false,
    });
    activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
    assert_eq!(state.players[0].master_of_chaos_state.as_ref().unwrap().position, ManaColor::Blue);
    assert_eq!(state.players[0].combat_accumulator.block, 3);
    assert_eq!(state.players[0].combat_accumulator.block_elements.physical, 3);
}

#[test]
fn master_of_chaos_gold_choice_filters_outside_combat() {
    // Outside combat, Gold choice should only show Move + Influence (2 options)
    let (mut state, mut undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
    state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
        position: ManaColor::Red,
        free_rotate_available: false,
    });
    state.players[0].hand = vec![CardId::from("march")];
    activate_skill(&mut state, &mut undo, "krang_master_of_chaos");
    // Not in combat → Block, Attack, Ranged ColdFire all filtered → only Move + Influence
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(c)) => {
            assert_eq!(c.options.len(), 2, "Gold choice outside combat should have 2 options (Move + Influence)");
        }
        other => panic!("Expected choice pending, got {:?}", other),
    }
    // Resolve with Influence (index 1)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0,
        &LegalAction::ResolveChoice { choice_index: 1 }, epoch).unwrap();
    assert_eq!(state.players[0].influence_points, 2);
}

#[test]
fn master_of_chaos_free_rotate_window_opens_on_turn_reset() {
    // After a turn where MoC was NOT used, free_rotate_available should be set to true
    let (mut state, _undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
    state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
        position: ManaColor::Blue,
        free_rotate_available: false,
    });
    // Simulate end-turn reset (skill was NOT used)
    crate::end_turn::reset_player_turn(&mut state, 0);
    let moc = state.players[0].master_of_chaos_state.as_ref().unwrap();
    assert!(moc.free_rotate_available, "free_rotate should open when skill not used");
}

#[test]
fn master_of_chaos_free_rotate_not_opened_when_used() {
    // After a turn where MoC WAS used, free_rotate_available should stay false
    let (mut state, _undo) = setup_with_skill(Hero::Krang, "krang_master_of_chaos");
    state.players[0].master_of_chaos_state = Some(MasterOfChaosState {
        position: ManaColor::Green,
        free_rotate_available: false,
    });
    state.players[0].skill_cooldowns.used_this_turn.push(
        mk_types::ids::SkillId::from("krang_master_of_chaos"));
    crate::end_turn::reset_player_turn(&mut state, 0);
    let moc = state.players[0].master_of_chaos_state.as_ref().unwrap();
    assert!(!moc.free_rotate_available, "free_rotate should NOT open when skill was used");
}

// =========================================================================
// Batch 3: Effect detection helpers
// =========================================================================

#[test]
fn effect_has_move_detects_gain_move() {
    use mk_types::effect::CardEffect;
    assert!(crate::card_play::effect_has_move(&CardEffect::GainMove { amount: 2 }));
    assert!(!crate::card_play::effect_has_move(&CardEffect::GainAttack {
        amount: 2, combat_type: CombatType::Melee, element: Element::Physical
    }));
}

#[test]
fn effect_has_attack_detects_compound() {
    use mk_types::effect::CardEffect;
    let compound = CardEffect::Compound {
        effects: vec![
            CardEffect::GainMove { amount: 1 },
            CardEffect::GainAttack { amount: 2, combat_type: CombatType::Melee, element: Element::Physical },
        ],
    };
    assert!(crate::card_play::effect_has_attack(&compound));
    assert!(crate::card_play::effect_has_move(&compound));
    assert!(!crate::card_play::effect_has_block(&compound));
}

#[test]
fn effect_has_block_negative_for_gain_mana() {
    use mk_types::effect::CardEffect;
    let mana = CardEffect::GainMana { color: ManaColor::Red, amount: 1 };
    assert!(!crate::card_play::effect_has_move(&mana));
    assert!(!crate::card_play::effect_has_attack(&mana));
    assert!(!crate::card_play::effect_has_block(&mana));
    assert!(!crate::card_play::effect_has_influence(&mana));
}

