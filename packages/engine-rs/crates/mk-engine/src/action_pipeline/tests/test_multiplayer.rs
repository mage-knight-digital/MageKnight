use super::*;

// =========================================================================
// Multiplayer tests
// =========================================================================

#[test]
fn multiplayer_tactic_selection_sequential() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();

    // Player 1 (index 1) selects first (reversed order)
    assert_eq!(state.current_tactic_selector.as_ref().unwrap().as_str(), "player_1");
    let player_1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, player_1_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
        epoch,
    ).unwrap();

    // Still in TacticsSelection — player 0 hasn't picked yet
    assert_eq!(state.round_phase, RoundPhase::TacticsSelection);
    assert_eq!(state.current_tactic_selector.as_ref().unwrap().as_str(), "player_0");
    assert_eq!(state.players[player_1_idx].selected_tactic.as_ref().unwrap().as_str(), "early_bird");

    // Player 0 selects
    let player_0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, player_0_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
        epoch,
    ).unwrap();

    // Now transitions to PlayerTurns
    assert_eq!(state.round_phase, RoundPhase::PlayerTurns);
    assert!(state.current_tactic_selector.is_none());
}

#[test]
fn multiplayer_tactic_removal_two_player() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();

    assert_eq!(state.scenario_config.tactic_removal_mode, TacticRemovalMode::RemoveTwo);

    // Both players select
    let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p1_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
        epoch,
    ).unwrap();

    let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p0_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
        epoch,
    ).unwrap();

    // After both select: 6 original - 2 selected - 2 removed = 2 remaining
    assert_eq!(state.available_tactics.len(), 2);
    assert_eq!(state.removed_tactics.len(), 2);
}

#[test]
fn multiplayer_turn_order_sorted_by_tactic() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();

    // Player 1 picks early_bird (turn order = 1)
    let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p1_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
        epoch,
    ).unwrap();

    // Player 0 picks the_right_moment (turn order = 6)
    let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p0_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("the_right_moment") },
        epoch,
    ).unwrap();

    // Turn order: early_bird (1) before the_right_moment (6)
    assert_eq!(state.turn_order[0].as_str(), "player_1");
    assert_eq!(state.turn_order[1].as_str(), "player_0");
}

#[test]
fn multiplayer_announce_end_of_round() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();

    // Select tactics to get to PlayerTurns
    let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p1_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
        epoch,
    ).unwrap();
    let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p0_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
        epoch,
    ).unwrap();

    assert_eq!(state.round_phase, RoundPhase::PlayerTurns);

    // Find which player goes first
    let first_player_id = state.turn_order[0].clone();
    let first_player_idx = state.players.iter().position(|p| p.id == first_player_id).unwrap();

    // Set flags so EndTurn would be available
    state.players[first_player_idx].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

    // Announce end of round
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, first_player_idx,
        &LegalAction::AnnounceEndOfRound,
        epoch,
    ).unwrap();

    assert!(state.end_of_round_announced_by.is_some());
    assert_eq!(state.players_with_final_turn.len(), 1); // Other player gets final turn
}

#[test]
fn multiplayer_announce_end_of_round_enumeration() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();

    // Get to PlayerTurns
    let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p1_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
        epoch,
    ).unwrap();
    let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p0_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
        epoch,
    ).unwrap();

    let first_player_id = state.turn_order[0].clone();
    let first_player_idx = state.players.iter().position(|p| p.id == first_player_id).unwrap();

    // AnnounceEndOfRound should be in legal actions for multiplayer
    let legal = enumerate_legal_actions_with_undo(&state, first_player_idx, &undo);
    let has_announce = legal.actions.iter().any(|a| matches!(a, LegalAction::AnnounceEndOfRound));
    assert!(has_announce, "AnnounceEndOfRound should be available in 2P game");
}

#[test]
fn solo_game_no_announce_end_of_round() {
    let mut state = crate::setup::create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();

    // Select tactic to get to PlayerTurns
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
        epoch,
    ).unwrap();

    // Solo should NOT have AnnounceEndOfRound
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_announce = legal.actions.iter().any(|a| matches!(a, LegalAction::AnnounceEndOfRound));
    assert!(!has_announce, "AnnounceEndOfRound should NOT be available in solo game");
}

#[test]
fn multiplayer_check_round_end_auto_announce() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();

    // Get to PlayerTurns
    let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p1_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
        epoch,
    ).unwrap();
    let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p0_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
        epoch,
    ).unwrap();

    // Empty first player's hand and deck to trigger auto-announce
    let first_player_id = state.turn_order[0].clone();
    let first_player_idx = state.players.iter().position(|p| p.id == first_player_id).unwrap();
    state.players[first_player_idx].hand.clear();
    state.players[first_player_idx].deck.clear();
    state.players[first_player_idx].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

    // End turn triggers auto-announce
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, first_player_idx,
        &LegalAction::EndTurn,
        epoch,
    ).unwrap();

    // Should auto-announce and populate final turn list
    assert!(state.end_of_round_announced_by.is_some());
}

#[test]
fn multiplayer_mana_steal_from_source() {
    let mut state = crate::setup::create_two_player_game(100, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();

    // Player 1 selects mana_steal
    let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p1_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("mana_steal") },
        epoch,
    ).unwrap();

    // Player 1 should have ManaSteal pending
    assert!(matches!(
        state.players[p1_idx].pending.active,
        Some(ActivePending::TacticDecision(PendingTacticDecision::ManaSteal))
    ));

    // Resolve: take first available basic die
    let die_idx = state.source.dice.iter().position(|d| !d.is_depleted && d.taken_by_player_id.is_none() && d.color.is_basic()).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p1_idx,
        &LegalAction::ResolveTacticDecision { data: TacticDecisionData::ManaSteal { die_index: die_idx } },
        epoch,
    ).unwrap();

    // Die should be claimed by player_1
    assert_eq!(state.source.dice[die_idx].taken_by_player_id.as_ref().unwrap().as_str(), "player_1");
    assert!(state.players[p1_idx].tactic_state.stored_mana_die.is_some());
}

#[test]
fn multiplayer_three_player_tactic_selection() {
    let config = mk_data::scenarios::first_reconnaissance_3p();
    let mut state = crate::setup::create_multiplayer_game(
        42,
        &[Hero::Arythea, Hero::Tovak, Hero::Goldyx],
        config,
        "first_reconnaissance_3p",
    );
    let mut undo = UndoStack::new();

    // Selection order should be player_2, player_1, player_0
    assert_eq!(state.tactics_selection_order[0].as_str(), "player_2");
    assert_eq!(state.tactics_selection_order[1].as_str(), "player_1");
    assert_eq!(state.tactics_selection_order[2].as_str(), "player_0");

    // Player 2 selects
    let p2_idx = state.players.iter().position(|p| p.id.as_str() == "player_2").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p2_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
        epoch,
    ).unwrap();
    assert_eq!(state.round_phase, RoundPhase::TacticsSelection);

    // Player 1 selects
    let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p1_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
        epoch,
    ).unwrap();
    assert_eq!(state.round_phase, RoundPhase::TacticsSelection);

    // Player 0 selects → transitions to PlayerTurns
    let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, p0_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("mana_steal") },
        epoch,
    ).unwrap();

    // 3P with RemoveOne: 6 - 3 selected - 1 removed = 2 remaining
    assert_eq!(state.round_phase, RoundPhase::PlayerTurns);
    assert_eq!(state.available_tactics.len(), 2);
    assert_eq!(state.removed_tactics.len(), 1);
}

#[test]
fn multiplayer_no_dummy_player() {
    let state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);

    assert!(state.dummy_player.is_none());
    assert!(state.dummy_player_tactic.is_none());
}

