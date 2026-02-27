use super::*;

// =========================================================================
// Tactics phase
// =========================================================================

#[test]
fn tactics_phase_emits_select_tactic() {
    let state = create_solo_game(42, Hero::Arythea);
    assert_eq!(state.round_phase, RoundPhase::TacticsSelection);
    let legal = enumerate_legal_actions(&state, 0);
    assert_eq!(legal.actions.len(), 6);
    for a in &legal.actions {
        assert!(matches!(a, LegalAction::SelectTactic { .. }));
    }
}

#[test]
fn tactics_use_canonical_turn_order() {
    let state = create_solo_game(42, Hero::Arythea);
    let legal = enumerate_legal_actions(&state, 0);
    let ids: Vec<&str> = legal
        .actions
        .iter()
        .map(|a| match a {
            LegalAction::SelectTactic { tactic_id } => tactic_id.as_str(),
            _ => panic!("Expected SelectTactic"),
        })
        .collect();
    // Tactics follow canonical turn order (not lexicographic).
    assert_eq!(
        ids,
        vec!["early_bird", "rethink", "mana_steal", "planning", "great_start", "the_right_moment"]
    );
}

// =========================================================================
// Turn options
// =========================================================================

#[test]
fn end_turn_not_available_without_card_play() {
    let state = setup_game(vec!["march"]);
    let legal = enumerate_legal_actions(&state, 0);

    let has_end = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::EndTurn));
    assert!(
        !has_end,
        "EndTurn should not be available without playing a card"
    );
}

#[test]
fn end_turn_available_after_card_play() {
    let mut state = setup_game(vec!["march"]);
    state.players[0]
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let legal = enumerate_legal_actions(&state, 0);

    let has_end = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::EndTurn));
    assert!(has_end, "EndTurn should be available after playing a card");
}

#[test]
fn end_turn_available_after_rest() {
    let mut state = setup_game(vec!["march"]);
    state.players[0]
        .flags
        .insert(PlayerFlags::HAS_RESTED_THIS_TURN);
    let legal = enumerate_legal_actions(&state, 0);

    let has_end = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::EndTurn));
    assert!(has_end, "EndTurn should be available after resting");
}

#[test]
fn declare_rest_available() {
    let state = setup_game(vec!["march"]);
    let legal = enumerate_legal_actions(&state, 0);

    let has_rest = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::DeclareRest));
    assert!(has_rest, "DeclareRest should be available at start of turn");
}

#[test]
fn complete_rest_available_when_resting() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let legal = enumerate_legal_actions(&state, 0);

    let has_complete = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::CompleteRest { .. }));
    assert!(
        has_complete,
        "CompleteRest should be available when resting"
    );
}

#[test]
fn no_rest_after_action() {
    let mut state = setup_game(vec!["march"]);
    state.players[0]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    let legal = enumerate_legal_actions(&state, 0);

    let has_rest = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::DeclareRest));
    assert!(
        !has_rest,
        "DeclareRest should not be available after action"
    );
}

// =========================================================================
// Resting — CompleteRest enumeration
// =========================================================================

#[test]
fn complete_rest_standard_enumerates_per_non_wound() {
    // Hand: march, wound → standard rest enumerates only march (index 0).
    let mut state = setup_game(vec!["march", "wound"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let legal = enumerate_legal_actions(&state, 0);

    let complete_rests: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::CompleteRest { .. }))
        .collect();
    assert_eq!(complete_rests.len(), 1, "should have 1 CompleteRest for the non-wound card");
    assert!(matches!(
        complete_rests[0],
        LegalAction::CompleteRest {
            discard_hand_index: Some(0)
        }
    ));
}

#[test]
fn complete_rest_standard_multiple_non_wounds() {
    // Hand: march, rage, wound → 2 CompleteRest options (indices 0 and 1).
    let mut state = setup_game(vec!["march", "rage", "wound"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let legal = enumerate_legal_actions(&state, 0);

    let complete_rests: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::CompleteRest { .. }))
        .collect();
    assert_eq!(complete_rests.len(), 2, "should have 2 CompleteRest options for non-wound cards");
}

#[test]
fn complete_rest_slow_recovery_all_wounds() {
    // Hand: wound, wound → slow recovery enumerates per wound.
    let mut state = setup_game(vec!["wound", "wound"]);
    state.players[0].deck.clear(); // empty deck for slow recovery
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let legal = enumerate_legal_actions(&state, 0);

    let complete_rests: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::CompleteRest { .. }))
        .collect();
    assert_eq!(complete_rests.len(), 2, "should have 2 CompleteRest options for slow recovery");
}

#[test]
fn complete_rest_empty_hand() {
    // Empty hand → single CompleteRest with None.
    let mut state = setup_game(vec![]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    // DeclareRest requires non-empty hand, but we test CompleteRest directly.
    let legal = enumerate_legal_actions(&state, 0);

    let complete_rests: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::CompleteRest { .. }))
        .collect();
    assert_eq!(complete_rests.len(), 1, "should have 1 CompleteRest for empty hand");
    assert!(matches!(
        complete_rests[0],
        LegalAction::CompleteRest {
            discard_hand_index: None
        }
    ));
}

#[test]
fn no_declare_rest_after_move() {
    let mut state = setup_game(vec!["march"]);
    state.players[0]
        .flags
        .insert(PlayerFlags::HAS_MOVED_THIS_TURN);
    let legal = enumerate_legal_actions(&state, 0);

    let has_rest = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::DeclareRest));
    assert!(!has_rest, "DeclareRest should not be available after move");
}

#[test]
fn end_turn_blocked_while_resting() {
    // While IS_RESTING, EndTurn should not be available (even if a card was played).
    let mut state = setup_game(vec!["march"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    state.players[0]
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let legal = enumerate_legal_actions(&state, 0);

    let has_end = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::EndTurn));
    assert!(
        !has_end,
        "EndTurn should be blocked while IS_RESTING is set"
    );
}

#[test]
fn move_blocked_while_resting() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    state.players[0].move_points = 5;
    let legal = enumerate_legal_actions(&state, 0);

    let has_move = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::Move { .. }));
    assert!(!has_move, "Move should be blocked while resting");
}

#[test]
fn sideways_influence_only_after_rest() {
    // After HAS_RESTED_THIS_TURN: only influence sideways, no move sideways.
    let mut state = setup_game(vec!["march"]);
    state.players[0]
        .flags
        .insert(PlayerFlags::HAS_RESTED_THIS_TURN);
    let legal = enumerate_legal_actions(&state, 0);

    let sideways: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::PlayCardSideways { .. }))
        .collect();
    assert!(!sideways.is_empty(), "sideways should still be available after rest");
    for a in &sideways {
        if let LegalAction::PlayCardSideways { sideways_as, .. } = a {
            assert_eq!(
                *sideways_as,
                SidewaysAs::Influence,
                "only Influence sideways should be available after rest"
            );
        }
    }
}

#[test]
fn undo_available_when_stack_has_entries() {
    let state = setup_game(vec!["march"]);
    let mut undo = UndoStack::new();
    undo.save(&state);
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    let has_undo = legal.actions.iter().any(|a| matches!(a, LegalAction::Undo));
    assert!(
        has_undo,
        "Undo should be available when undo stack non-empty"
    );
}

#[test]
fn undo_not_available_when_stack_empty() {
    let state = setup_game(vec!["march"]);
    let legal = enumerate_legal_actions(&state, 0);

    let has_undo = legal.actions.iter().any(|a| matches!(a, LegalAction::Undo));
    assert!(
        !has_undo,
        "Undo should not be available with empty undo stack"
    );
}

// =========================================================================
// Dummy player integration tests
// =========================================================================

#[test]
fn dummy_tactic_auto_selected_after_human() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();

    // During TacticsSelection, human picks a tactic
    let epoch = state.action_epoch;
    let tactic = state.available_tactics[0].clone();
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: tactic.clone(),
        },
        epoch,
    )
    .unwrap();

    // Dummy should have auto-selected a tactic
    assert!(
        state.dummy_player_tactic.is_some(),
        "Dummy should auto-select a tactic"
    );
    // Dummy's tactic should be different from human's
    assert_ne!(
        state.dummy_player_tactic.as_ref().unwrap(),
        &tactic,
        "Dummy should pick a different tactic"
    );
    // Phase should advance to PlayerTurns
    assert_eq!(state.round_phase, RoundPhase::PlayerTurns);
}

#[test]
fn dummy_in_turn_order() {
    let state = create_solo_game(42, Hero::Arythea);

    // Turn order should include both human and dummy
    assert_eq!(state.turn_order.len(), 2);
    assert!(state.turn_order.iter().any(|id| id.as_str() == "player_0"));
    assert!(
        state
            .turn_order
            .iter()
            .any(|id| id.as_str() == crate::dummy_player::DUMMY_PLAYER_ID)
    );
}

#[test]
fn dummy_turn_auto_executed_on_end_turn() {
    use crate::card_play::play_card;
    use crate::end_turn::end_turn;

    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("march"), CardId::from("rage")];

    let dummy_deck_before = state.dummy_player.as_ref().unwrap().deck.len();

    // Play a card and end turn
    play_card(&mut state, 0, 0, false, None).unwrap();
    end_turn(&mut state, 0).unwrap();

    // Dummy should have taken a turn (cards moved from deck to discard)
    let dummy = state.dummy_player.as_ref().unwrap();
    assert!(
        dummy.deck.len() < dummy_deck_before,
        "Dummy should have flipped cards: before={}, after={}",
        dummy_deck_before,
        dummy.deck.len()
    );
    assert!(
        !dummy.discard.is_empty(),
        "Dummy should have cards in discard"
    );
}

#[test]
fn dummy_deck_exhausted_announces_round_end() {
    use crate::card_play::play_card;
    use crate::end_turn::end_turn;

    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;

    // Exhaust dummy deck so next dummy turn triggers announcement
    if let Some(ref mut dummy) = state.dummy_player {
        dummy.discard.append(&mut dummy.deck);
        dummy.precomputed_turns.clear();
        dummy.current_turn_index = 0;
    }

    // Give human enough cards for 2 turns
    state.players[0].hand = vec![CardId::from("march"), CardId::from("rage")];
    state.players[0].deck = vec![
        CardId::from("stamina"),
        CardId::from("swiftness"),
        CardId::from("promise"),
    ];

    // Play a card and end turn (triggers dummy turn → announcement)
    play_card(&mut state, 0, 0, false, None).unwrap();
    end_turn(&mut state, 0).unwrap();

    // Dummy should have announced end of round
    assert_eq!(
        state.end_of_round_announced_by.as_ref().map(|id| id.as_str()),
        Some(crate::dummy_player::DUMMY_PLAYER_ID),
        "Dummy should announce end of round when deck exhausted"
    );
    // Human should be in final turns list
    assert!(
        state
            .players_with_final_turn
            .iter()
            .any(|id| id.as_str() == "player_0"),
        "Human should have a final turn"
    );

    // Human plays one more turn (final), then round ends
    play_card(&mut state, 0, 0, false, None).unwrap();
    end_turn(&mut state, 0).unwrap();

    // Round should have ended
    assert_eq!(state.round, 2, "Round should have advanced to 2");
    assert_eq!(
        state.round_phase,
        RoundPhase::TacticsSelection,
        "Should be back to TacticsSelection"
    );
}

#[test]
fn solo_tactics_removed_at_round_end() {
    use crate::card_play::play_card;
    use crate::end_turn::end_turn;

    let mut state = create_solo_game(42, Hero::Arythea);

    // Select tactic (triggers dummy auto-select too)
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    let human_tactic = state.available_tactics[0].clone();
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: human_tactic.clone(),
        },
        epoch,
    )
    .unwrap();

    let dummy_tactic = state.dummy_player_tactic.clone().unwrap();

    // Force round end: set hand to 1 card + empty deck → both empty after play
    state.players[0].hand = vec![CardId::from("march")];
    state.players[0].deck.clear();
    play_card(&mut state, 0, 0, false, None).unwrap();
    end_turn(&mut state, 0).unwrap();

    // Round ended — check tactic removal
    assert!(
        state.removed_tactics.contains(&human_tactic),
        "Human's tactic should be in removed list"
    );
    assert!(
        state.removed_tactics.contains(&dummy_tactic),
        "Dummy's tactic should be in removed list"
    );
    // Dummy tactic should be cleared for new round
    assert!(
        state.dummy_player_tactic.is_none(),
        "Dummy tactic should be cleared"
    );
    // Available tactics for new round should not contain removed ones
    assert!(
        !state.available_tactics.contains(&human_tactic),
        "Removed human tactic should not be available in new round"
    );
    // Note: day tactics won't appear in night round anyway, but the removed_tactics
    // list tracks them for when day comes back around
}
