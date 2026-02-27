use super::*;

// =========================================================================
// Pending choice
// =========================================================================

#[test]
fn pending_choice_emits_resolve_choices() {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let mut state = setup_game(vec!["march"]);
    state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
        card_id: None,
        skill_id: None,
        unit_instance_id: None,
        options: vec![
            CardEffect::GainMove { amount: 2 },
            CardEffect::GainAttack {
                amount: 3,
                combat_type: CombatType::Melee,
                element: Element::Physical,
            },
        ],
        continuation: vec![],
        movement_bonus_applied: false,
        resolution: ChoiceResolution::Standard,
    }));

    let legal = enumerate_legal_actions(&state, 0);
    let choices: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ResolveChoice { .. }))
        .collect();
    assert_eq!(choices.len(), 2, "should have 2 choice options");
}

#[test]
fn pending_meditation_select_cards_enumeration() {
    let mut state = setup_game(vec!["march"]);
    // Put some cards in discard for meditation to pick from
    state.players[0].discard.push(mk_types::ids::CardId::from("rage"));
    state.players[0].discard.push(mk_types::ids::CardId::from("stamina"));
    state.players[0].pending.active = Some(ActivePending::Meditation(
        mk_types::pending::PendingMeditation {
            version: mk_types::pending::EffectMode::Powered,
            phase: mk_types::pending::MeditationPhase::SelectCards,
            selected_card_ids: vec![],
        },
    ));
    let legal = enumerate_legal_actions(&state, 0);
    let med_actions: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ResolveMeditation { .. }))
        .collect();
    // Should have 2 meditation card selections (rage + stamina)
    assert_eq!(med_actions.len(), 2, "Should enumerate 2 discard cards for meditation");
    // No MeditationDoneSelecting yet (0 selected)
    assert!(!legal.actions.iter().any(|a| matches!(a, LegalAction::MeditationDoneSelecting)));
}

// =========================================================================
// Level-up reward tests
// =========================================================================

#[test]
fn level_up_at_level_2_queues_reward() {
    let mut state = setup_level_up_game(3); // 3 fame = level 2

    // Verify player has remaining hero skills
    assert_eq!(state.players[0].remaining_hero_skills.len(), 10);

    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    crate::end_turn::end_turn(&mut state, 0).unwrap();

    // Level should be updated to 2
    assert_eq!(state.players[0].level, 2);
    // Should have an active LevelUpReward pending
    assert!(
        matches!(
            state.players[0].pending.active,
            Some(ActivePending::LevelUpReward(_))
        ),
        "Should have LevelUpReward pending after reaching level 2"
    );
    // 2 skills drawn from remaining, so 8 left
    assert_eq!(state.players[0].remaining_hero_skills.len(), 8);
    // Verify drawn skills has 2 entries
    if let Some(ActivePending::LevelUpReward(ref reward)) = state.players[0].pending.active {
        assert_eq!(reward.drawn_skills.len(), 2);
        assert_eq!(reward.level, 2);
    }
}

#[test]
fn level_up_reward_enumerates_skill_x_aa_options() {
    let mut state = setup_level_up_game(3); // level 2
    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    crate::end_turn::end_turn(&mut state, 0).unwrap();

    let legal = enumerate_legal_actions(&state, 0);
    // 2 drawn skills × 3 AAs in offer = 6 options (no common pool skills yet)
    let level_up_actions: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ChooseLevelUpReward { .. }))
        .collect();
    assert_eq!(
        level_up_actions.len(),
        2 * state.offers.advanced_actions.len(),
        "Should enumerate drawn_skills × AA_offer options"
    );
}

#[test]
fn level_up_common_pool_forces_lowest_aa() {
    let mut state = setup_level_up_game(3);
    // Pre-populate common pool with 2 skills
    state
        .offers
        .common_skills
        .push(mk_types::ids::SkillId::from("common_a"));
    state
        .offers
        .common_skills
        .push(mk_types::ids::SkillId::from("common_b"));

    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    crate::end_turn::end_turn(&mut state, 0).unwrap();

    let lowest_aa = state.offers.advanced_actions.last().unwrap().clone();
    let legal = enumerate_legal_actions(&state, 0);
    let common_pool_actions: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ChooseLevelUpReward { from_common_pool: true, .. }))
        .collect();

    // 2 common skills, each forced to lowest AA = 2 actions (not 2 × N AAs)
    assert_eq!(common_pool_actions.len(), 2);
    for action in &common_pool_actions {
        if let LegalAction::ChooseLevelUpReward { advanced_action_id, .. } = action {
            assert_eq!(
                advanced_action_id, &lowest_aa,
                "Common pool pick must take lowest-position AA"
            );
        }
    }
}

#[test]
fn choose_skill_from_drawn_pair() {
    let mut state = setup_level_up_game(3);
    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    crate::end_turn::end_turn(&mut state, 0).unwrap();

    // Get the drawn skills for comparison
    let reward = match &state.players[0].pending.active {
        Some(ActivePending::LevelUpReward(r)) => r.clone(),
        _ => panic!("Expected LevelUpReward pending"),
    };
    let skill_0 = reward.drawn_skills[0].clone();
    let skill_1 = reward.drawn_skills[1].clone();
    let aa_id = state.offers.advanced_actions[0].clone();

    // Choose skill_0 from drawn pair
    let mut undo = UndoStack::new();
    let legal = enumerate_legal_actions(&state, 0);
    let action = LegalAction::ChooseLevelUpReward {
        skill_index: 0,
        from_common_pool: false,
        advanced_action_id: aa_id.clone(),
    };
    apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

    // Chosen skill should be in player's skills
    assert!(
        state.players[0].skills.contains(&skill_0),
        "Chosen skill should be added to player.skills"
    );
    // Other skill should be in common pool
    assert!(
        state.offers.common_skills.contains(&skill_1),
        "Unchosen skill should go to common pool"
    );
}

#[test]
fn choose_skill_from_common_pool() {
    let mut state = setup_level_up_game(3);
    // Pre-populate common pool with a skill
    let common_skill = mk_types::ids::SkillId::from("test_common_skill");
    state.offers.common_skills.push(common_skill.clone());

    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    crate::end_turn::end_turn(&mut state, 0).unwrap();

    let reward = match &state.players[0].pending.active {
        Some(ActivePending::LevelUpReward(r)) => r.clone(),
        _ => panic!("Expected LevelUpReward pending"),
    };
    let drawn_0 = reward.drawn_skills[0].clone();
    let drawn_1 = reward.drawn_skills[1].clone();
    // Common pool pick is forced to take lowest-position AA per rules.
    let lowest_aa_id = state.offers.advanced_actions.last().unwrap().clone();

    // Choose from common pool (index 0 = test_common_skill)
    let mut undo = UndoStack::new();
    let legal = enumerate_legal_actions(&state, 0);
    let action = LegalAction::ChooseLevelUpReward {
        skill_index: 0,
        from_common_pool: true,
        advanced_action_id: lowest_aa_id,
    };
    apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

    // Common skill should be in player's skills
    assert!(
        state.players[0].skills.contains(&common_skill),
        "Common pool skill should be added to player.skills"
    );
    // Both drawn skills should be in common pool
    assert!(
        state.offers.common_skills.contains(&drawn_0),
        "Drawn skill 0 should go to common pool when picking from common"
    );
    assert!(
        state.offers.common_skills.contains(&drawn_1),
        "Drawn skill 1 should go to common pool when picking from common"
    );
}

#[test]
fn aa_placed_on_deck_top() {
    let mut state = setup_level_up_game(3);
    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    crate::end_turn::end_turn(&mut state, 0).unwrap();

    let aa_id = state.offers.advanced_actions[0].clone();
    let old_offer_len = state.offers.advanced_actions.len();
    let old_deck_top = state.decks.advanced_action_deck[0].clone();

    let mut undo = UndoStack::new();
    let legal = enumerate_legal_actions(&state, 0);
    let action = LegalAction::ChooseLevelUpReward {
        skill_index: 0,
        from_common_pool: false,
        advanced_action_id: aa_id.clone(),
    };
    apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

    // AA should be at front of deck (card draw hasn't happened yet from deck perspective)
    // But after card_flow runs, cards are drawn from deck.
    // The AA was inserted at position 0 of deck before card_flow, so it should be in hand now.
    let in_hand = state.players[0].hand.contains(&aa_id);
    let in_deck = state.players[0].deck.contains(&aa_id);
    assert!(
        in_hand || in_deck,
        "Chosen AA should be in hand (drawn) or deck: aa={}, hand={:?}, deck_front={:?}",
        aa_id,
        state.players[0].hand,
        state.players[0].deck.first()
    );

    // Offer should be replenished (same size or one less if deck was empty)
    assert!(
        state.offers.advanced_actions.len() >= old_offer_len - 1,
        "AA offer should be replenished"
    );
    // The old deck top should now be in the offer (replenished)
    assert!(
        state.offers.advanced_actions.contains(&old_deck_top)
            || state.players[0].hand.contains(&old_deck_top)
            || state.players[0].deck.contains(&old_deck_top),
        "Old deck top should have moved somewhere"
    );
}

#[test]
fn card_draw_after_last_reward() {
    let mut state = setup_level_up_game(3); // level 2 only
    state.players[0].deck = (0..10)
        .map(|i| CardId::from(format!("card_{}", i)))
        .collect();

    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    crate::end_turn::end_turn(&mut state, 0).unwrap();

    // Hand should be empty (was reset, card draw deferred)
    // Actually the turn was reset, play_area moved to discard
    // Hand is empty because reset_player_turn doesn't touch hand,
    // but process_card_flow was skipped.
    let hand_before = state.players[0].hand.len();

    // Resolve the level-up reward
    let aa_id = state.offers.advanced_actions[0].clone();
    let mut undo = UndoStack::new();
    let legal = enumerate_legal_actions(&state, 0);
    let action = LegalAction::ChooseLevelUpReward {
        skill_index: 0,
        from_common_pool: false,
        advanced_action_id: aa_id,
    };
    apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

    // After resolving the last reward, card_flow should have run.
    // Hand should now be drawn up to hand_limit (5 at level 2).
    assert!(
        state.players[0].hand.len() > hand_before,
        "Card draw should happen after last reward resolved (hand: {} > {})",
        state.players[0].hand.len(),
        hand_before
    );
    assert_eq!(
        state.players[0].hand.len(),
        state.players[0].hand_limit as usize,
        "Hand should be drawn up to hand limit"
    );
}

#[test]
fn card_draw_deferred_during_rewards() {
    let mut state = setup_level_up_game(3);
    state.players[0].deck = (0..10)
        .map(|i| CardId::from(format!("card_{}", i)))
        .collect();

    // Before end_turn: note play_area and hand state
    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    // After play: hand=0, play_area=1 (march), deck=10

    let result = crate::end_turn::end_turn(&mut state, 0).unwrap();
    assert!(
        matches!(result, crate::end_turn::EndTurnResult::AwaitingLevelUpRewards),
        "Should return AwaitingLevelUpRewards, got {:?}",
        result
    );

    // Card flow should NOT have run — hand should still be small
    // play_area was moved to discard by end_turn before card_flow was skipped
    // But actually reset_player_turn doesn't move play_area to discard — process_card_flow does.
    // Hmm, let me check: process_card_flow moves play_area → discard AND draws cards.
    // Since we skipped process_card_flow, play_area should still have march.
    // Actually no — looking at the code, process_card_flow is what moves play_area → discard.
    // Since we skip it, play_area is untouched. But the hand was 0 after play_card.
    // So hand should be 0 still.
    assert_eq!(
        state.players[0].hand.len(),
        0,
        "Card draw should be deferred while rewards are pending"
    );
}

#[test]
fn multiple_level_ups_chain_rewards() {
    // Get enough fame for levels 2 AND 4 simultaneously (fame 14 = level 4)
    let mut state = setup_level_up_game(14);
    state.players[0].deck = (0..10)
        .map(|i| CardId::from(format!("card_{}", i)))
        .collect();

    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    crate::end_turn::end_turn(&mut state, 0).unwrap();

    // Level should jump to 4
    assert_eq!(state.players[0].level, 4);
    // 4 skills drawn (2 for level 2 + 2 for level 4)
    assert_eq!(state.players[0].remaining_hero_skills.len(), 6);

    // First reward should be active (level 2)
    let first_reward = match &state.players[0].pending.active {
        Some(ActivePending::LevelUpReward(r)) => r.clone(),
        _ => panic!("Expected LevelUpReward pending"),
    };
    assert_eq!(first_reward.level, 2);

    // Resolve first reward
    let aa_id = state.offers.advanced_actions[0].clone();
    let mut undo = UndoStack::new();
    let legal = enumerate_legal_actions(&state, 0);
    let action = LegalAction::ChooseLevelUpReward {
        skill_index: 0,
        from_common_pool: false,
        advanced_action_id: aa_id,
    };
    apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();

    // Second reward should now be active (level 4)
    let second_reward = match &state.players[0].pending.active {
        Some(ActivePending::LevelUpReward(r)) => r.clone(),
        _ => panic!("Expected second LevelUpReward pending"),
    };
    assert_eq!(second_reward.level, 4);

    // Resolve second reward
    let aa_id2 = state.offers.advanced_actions[0].clone();
    let legal2 = enumerate_legal_actions(&state, 0);
    let action2 = LegalAction::ChooseLevelUpReward {
        skill_index: 0,
        from_common_pool: false,
        advanced_action_id: aa_id2,
    };
    apply_legal_action(&mut state, &mut undo, 0, &action2, legal2.epoch).unwrap();

    // No more pending — card draw should have happened
    assert!(
        state.players[0].pending.active.is_none(),
        "No more pending after all rewards resolved"
    );
    assert_eq!(
        state.players[0].skills.len(),
        2,
        "Should have 2 skills from 2 level-up rewards"
    );
    // Hand should be drawn up to hand limit
    assert!(
        !state.players[0].hand.is_empty(),
        "Hand should have cards after card draw"
    );
}

#[test]
fn player_starts_with_10_remaining_skills() {
    let state = create_solo_game(42, Hero::Arythea);
    assert_eq!(
        state.players[0].remaining_hero_skills.len(),
        10,
        "Player should start with 10 hero skills in remaining pool"
    );
}

#[test]
fn no_level_up_reward_at_odd_levels() {
    // Fame 8 = level 3 (odd level — stat upgrade only, no skill choice)
    let mut state = setup_level_up_game(8);
    state.players[0].level = 2; // Already at level 2, crossing to 3

    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    crate::end_turn::end_turn(&mut state, 0).unwrap();

    assert_eq!(state.players[0].level, 3);
    // No pending — odd level doesn't trigger skill choice
    assert!(
        !matches!(
            state.players[0].pending.active,
            Some(ActivePending::LevelUpReward(_))
        ),
        "Odd level (3) should not queue a LevelUpReward"
    );
}
