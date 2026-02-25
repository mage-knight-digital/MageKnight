use super::*;

// =========================================================================
// Tactic effects — integration tests
// =========================================================================

#[test]
fn select_great_start_draws_two_cards() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let initial_hand = state.players[0].hand.len();
    let initial_deck = state.players[0].deck.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("great_start"),
        },
        epoch,
    )
    .unwrap();

    assert_eq!(state.players[0].hand.len(), initial_hand + 2);
    assert_eq!(state.players[0].deck.len(), initial_deck - 2);
    assert_eq!(state.round_phase, RoundPhase::PlayerTurns);
}

#[test]
fn select_great_start_empty_deck_draws_nothing() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.players[0].deck.clear();
    let initial_hand = state.players[0].hand.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("great_start"),
        },
        epoch,
    )
    .unwrap();

    assert_eq!(state.players[0].hand.len(), initial_hand);
}

#[test]
fn select_rethink_creates_pending() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("rethink"),
        },
        epoch,
    )
    .unwrap();

    assert!(state.players[0].pending.has_active());
    match &state.players[0].pending.active {
        Some(ActivePending::SubsetSelection(ss)) => {
            assert_eq!(ss.kind, mk_types::pending::SubsetSelectionKind::Rethink);
            assert_eq!(ss.max_selections, 3);
            assert_eq!(ss.min_selections, 0);
            assert!(ss.selected.is_empty());
        }
        other => panic!("Expected SubsetSelection, got {:?}", other),
    }
}

#[test]
fn rethink_resolution_swaps_cards() {
    let mut state = create_solo_game(42, Hero::Arythea);
    // Set up known hand
    state.players[0].hand = vec![
        CardId::from("march"),
        CardId::from("stamina"),
        CardId::from("rage"),
    ];
    state.players[0].deck = vec![
        CardId::from("swiftness"),
        CardId::from("concentration"),
    ];
    state.players[0].discard.clear();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // Select rethink
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("rethink"),
        },
        epoch,
    )
    .unwrap();

    // Resolve: select indices 0 and 2 (march and rage), then confirm
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 0 }, epoch,
    ).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 2 }, epoch,
    ).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SubsetConfirm, epoch,
    ).unwrap();

    // Should still have 3 cards in hand (stamina stayed + 2 drawn)
    assert_eq!(state.players[0].hand.len(), 3);
    // Pending should be cleared
    assert!(!state.players[0].pending.has_active());
    // march and rage were removed; stamina should still be there
    assert!(state.players[0].hand.contains(&CardId::from("stamina")));
}

#[test]
fn rethink_empty_set_keeps_hand_unchanged() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.players[0].hand = vec![
        CardId::from("march"),
        CardId::from("stamina"),
    ];

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("rethink"),
        },
        epoch,
    )
    .unwrap();

    let hand_before = state.players[0].hand.clone();

    // Confirm immediately (empty selection)
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SubsetConfirm, epoch,
    ).unwrap();

    // No cards swapped, hand unchanged
    assert_eq!(state.players[0].hand, hand_before);
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn select_mana_steal_creates_pending() {
    let mut state = create_solo_game(42, Hero::Arythea);
    // Ensure at least one basic die is available
    assert!(state.source.dice.iter().any(|d| !d.is_depleted && d.taken_by_player_id.is_none() && d.color.is_basic()));

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("mana_steal"),
        },
        epoch,
    )
    .unwrap();

    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::TacticDecision(PendingTacticDecision::ManaSteal))
    ));
}

#[test]
fn mana_steal_resolution_marks_die() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // Select mana_steal
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("mana_steal"),
        },
        epoch,
    )
    .unwrap();

    // Find first available basic die index
    let die_idx = state
        .source
        .dice
        .iter()
        .position(|d| !d.is_depleted && d.taken_by_player_id.is_none() && d.color.is_basic())
        .unwrap();

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ResolveTacticDecision {
            data: TacticDecisionData::ManaSteal { die_index: die_idx },
        },
        epoch,
    )
    .unwrap();

    // Die should be marked as taken
    assert!(state.source.dice[die_idx].taken_by_player_id.is_some());
    // Stored mana die should be set
    assert!(state.players[0].tactic_state.stored_mana_die.is_some());
    // Pending cleared
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn select_preparation_creates_pending_with_deck_snapshot() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let deck_len = state.players[0].deck.len();
    assert!(deck_len > 0);

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("preparation"),
        },
        epoch,
    )
    .unwrap();

    match &state.players[0].pending.active {
        Some(ActivePending::TacticDecision(PendingTacticDecision::Preparation { deck_snapshot })) => {
            assert_eq!(deck_snapshot.len(), deck_len);
        }
        other => panic!("Expected Preparation pending, got {:?}", other),
    }
}

#[test]
fn preparation_resolution_moves_card_to_hand() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("preparation"),
        },
        epoch,
    )
    .unwrap();

    // Get the first card from the deck snapshot
    let target_card = match &state.players[0].pending.active {
        Some(ActivePending::TacticDecision(PendingTacticDecision::Preparation { deck_snapshot })) => {
            deck_snapshot[0].clone()
        }
        _ => panic!("Expected Preparation pending"),
    };

    let initial_hand = state.players[0].hand.len();
    let initial_deck = state.players[0].deck.len();

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ResolveTacticDecision {
            data: TacticDecisionData::Preparation { deck_card_index: 0 },
        },
        epoch,
    )
    .unwrap();

    // Card moved from deck to hand
    assert_eq!(state.players[0].hand.len(), initial_hand + 1);
    assert_eq!(state.players[0].deck.len(), initial_deck - 1);
    assert!(state.players[0].hand.contains(&target_card));
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn activate_the_right_moment_sets_extra_turn() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("the_right_moment"));

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ActivateTactic,
        epoch,
    )
    .unwrap();

    assert!(state.players[0].tactic_state.extra_turn_pending);
    assert!(state.players[0].flags.contains(PlayerFlags::TACTIC_FLIPPED));
}

#[test]
fn activate_long_night_moves_discard_to_deck() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("long_night"));
    state.players[0].deck.clear();
    state.players[0].discard = vec![
        CardId::from("stamina"),
        CardId::from("rage"),
        CardId::from("swiftness"),
        CardId::from("concentration"),
    ];

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ActivateTactic,
        epoch,
    )
    .unwrap();

    // 3 cards moved from discard to deck
    assert_eq!(state.players[0].deck.len(), 3);
    assert_eq!(state.players[0].discard.len(), 1);
    assert!(state.players[0].flags.contains(PlayerFlags::TACTIC_FLIPPED));
}

#[test]
fn activate_midnight_meditation_creates_pending() {
    let mut state = setup_playing_game(vec!["march", "stamina", "rage"]);
    state.players[0].selected_tactic =
        Some(mk_types::ids::TacticId::from("midnight_meditation"));

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ActivateTactic,
        epoch,
    )
    .unwrap();

    assert!(state.players[0].flags.contains(PlayerFlags::TACTIC_FLIPPED));
    match &state.players[0].pending.active {
        Some(ActivePending::SubsetSelection(ss)) => {
            assert_eq!(ss.kind, mk_types::pending::SubsetSelectionKind::MidnightMeditation);
            assert_eq!(ss.max_selections, 3);
            assert_eq!(ss.min_selections, 0);
            assert!(ss.selected.is_empty());
        }
        other => panic!("Expected SubsetSelection, got {:?}", other),
    }
}

#[test]
fn midnight_meditation_resolution_swaps_cards() {
    let mut state = setup_playing_game(vec!["march", "stamina", "rage"]);
    state.players[0].selected_tactic =
        Some(mk_types::ids::TacticId::from("midnight_meditation"));
    state.players[0].deck = vec![CardId::from("swiftness"), CardId::from("concentration")];
    state.players[0].discard.clear();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // Activate
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ActivateTactic,
        epoch,
    )
    .unwrap();

    // Resolve: select indices 0 and 1, then confirm
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 0 }, epoch,
    ).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 1 }, epoch,
    ).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SubsetConfirm, epoch,
    ).unwrap();

    // 3 cards: rage (kept) + 2 drawn
    assert_eq!(state.players[0].hand.len(), 3);
    assert!(state.players[0].hand.contains(&CardId::from("rage")));
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn mana_search_single_die_via_subset() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));

    let mut undo = UndoStack::new();

    // Initiate
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::InitiateManaSearch, epoch).unwrap();
    assert!(state.players[0].pending.has_active());

    // Select first die, then confirm
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetConfirm, epoch).unwrap();

    assert!(state.players[0].tactic_state.mana_search_used_this_turn);
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn mana_search_two_dice_auto_confirm() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));

    let available_count = state
        .source
        .dice
        .iter()
        .filter(|d| d.taken_by_player_id.is_none())
        .count();
    assert!(available_count >= 2, "Need at least 2 available dice");

    let mut undo = UndoStack::new();

    // Initiate
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::InitiateManaSearch, epoch).unwrap();

    // Select two dice — should auto-confirm at max (2)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 1 }, epoch).unwrap();

    assert!(state.players[0].tactic_state.mana_search_used_this_turn);
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn sparing_power_stash_moves_deck_top_to_storage() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("sparing_power"));
    state.players[0].deck = vec![CardId::from("swiftness"), CardId::from("concentration")];
    state.players[0].flags.insert(PlayerFlags::BEFORE_TURN_TACTIC_PENDING);
    state.players[0].pending.active = Some(ActivePending::TacticDecision(
        PendingTacticDecision::SparingPower,
    ));

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ResolveTacticDecision {
            data: TacticDecisionData::SparingPowerStash,
        },
        epoch,
    )
    .unwrap();

    assert_eq!(state.players[0].tactic_state.sparing_power_stored.len(), 1);
    assert_eq!(
        state.players[0].tactic_state.sparing_power_stored[0],
        CardId::from("swiftness")
    );
    assert_eq!(state.players[0].deck.len(), 1);
    assert!(!state.players[0].pending.has_active());
    assert!(!state.players[0].flags.contains(PlayerFlags::BEFORE_TURN_TACTIC_PENDING));
}

#[test]
fn sparing_power_take_moves_stored_to_hand() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("sparing_power"));
    state.players[0].tactic_state.sparing_power_stored = vec![
        CardId::from("swiftness"),
        CardId::from("concentration"),
    ];
    state.players[0].flags.insert(PlayerFlags::BEFORE_TURN_TACTIC_PENDING);
    state.players[0].pending.active = Some(ActivePending::TacticDecision(
        PendingTacticDecision::SparingPower,
    ));

    let initial_hand = state.players[0].hand.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ResolveTacticDecision {
            data: TacticDecisionData::SparingPowerTake,
        },
        epoch,
    )
    .unwrap();

    assert_eq!(state.players[0].hand.len(), initial_hand + 2);
    assert!(state.players[0].hand.contains(&CardId::from("swiftness")));
    assert!(state.players[0].hand.contains(&CardId::from("concentration")));
    assert!(state.players[0].tactic_state.sparing_power_stored.is_empty());
    assert!(state.players[0].flags.contains(PlayerFlags::TACTIC_FLIPPED));
    assert!(!state.players[0].flags.contains(PlayerFlags::BEFORE_TURN_TACTIC_PENDING));
}

#[test]
fn turn_order_sorted_by_tactic_number() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // Select tactic — solo has human + dummy in turn_order
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("planning"),
        },
        epoch,
    )
    .unwrap();

    // Turn order has 2 entries: human + dummy
    assert_eq!(state.turn_order.len(), 2);
    // Dummy also selected a tactic
    assert!(state.dummy_player_tactic.is_some());
    // current_player_index should point to the human's position
    let human_id = state.players[0].id.clone();
    assert_eq!(state.turn_order[state.current_player_index as usize], human_id);
}

#[test]
fn rethink_pending_enumeration() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.players[0].hand = vec![
        CardId::from("march"),
        CardId::from("stamina"),
    ];

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // Select rethink (max_selections will be min(3, 2) = 2)
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("rethink"),
        },
        epoch,
    )
    .unwrap();

    // Enumerate legal actions — should see SubsetSelect per hand card + SubsetConfirm
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let selects: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::SubsetSelect { .. }))
        .collect();
    let confirms: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::SubsetConfirm))
        .collect();

    // 2 hand cards → 2 SubsetSelect + 1 SubsetConfirm (min_selections=0)
    assert_eq!(selects.len(), 2);
    assert_eq!(confirms.len(), 1);
}

#[test]
fn mana_steal_pending_enumeration() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("mana_steal"),
        },
        epoch,
    )
    .unwrap();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let tactic_decisions: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ResolveTacticDecision { .. }))
        .collect();

    // Each available basic die → one action
    let available_basic = state
        .source
        .dice
        .iter()
        .filter(|d| !d.is_depleted && d.taken_by_player_id.is_none() && d.color.is_basic())
        .count();
    assert_eq!(tactic_decisions.len(), available_basic);
    assert!(available_basic > 0);
}

#[test]
fn activate_tactic_enumerated_for_trm() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic =
        Some(mk_types::ids::TacticId::from("the_right_moment"));

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        legal.actions.contains(&LegalAction::ActivateTactic),
        "ActivateTactic should be available for The Right Moment"
    );
}

#[test]
fn activate_tactic_not_enumerated_after_flip() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic =
        Some(mk_types::ids::TacticId::from("the_right_moment"));
    state.players[0].flags.insert(PlayerFlags::TACTIC_FLIPPED);

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        !legal.actions.contains(&LegalAction::ActivateTactic),
        "ActivateTactic should NOT be available after flip"
    );
}

#[test]
fn mana_search_enumerated_for_mana_search_tactic() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        legal.actions.contains(&LegalAction::InitiateManaSearch),
        "Should have InitiateManaSearch for mana_search tactic"
    );
}

#[test]
fn mana_search_not_enumerated_after_use() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));
    state.players[0].tactic_state.mana_search_used_this_turn = true;

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        !legal.actions.contains(&LegalAction::InitiateManaSearch),
        "Should NOT have InitiateManaSearch after use"
    );
}

#[test]
fn activate_trm_during_combat() {
    let mut state = setup_combat_game(&["prowlers"]);
    state.players[0].selected_tactic =
        Some(mk_types::ids::TacticId::from("the_right_moment"));

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        legal.actions.contains(&LegalAction::ActivateTactic),
        "The Right Moment should be available during combat"
    );
}

#[test]
fn long_night_enumerated_when_deck_empty() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("long_night"));
    state.players[0].deck.clear();
    state.players[0].discard = vec![CardId::from("stamina")];

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        legal.actions.contains(&LegalAction::ActivateTactic),
        "Long Night should be available when deck empty and discard not empty"
    );
}

#[test]
fn long_night_not_enumerated_when_deck_not_empty() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("long_night"));
    // deck is not empty (default from setup)
    state.players[0].discard = vec![CardId::from("stamina")];

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        !legal.actions.contains(&LegalAction::ActivateTactic),
        "Long Night should NOT be available when deck not empty"
    );
}

// =========================================================================
// Tactic validation — enumeration gates
// =========================================================================

#[test]
fn tactic_selection_not_enumerated_during_player_turns() {
    let state = setup_playing_game(vec!["march"]);
    // Already in PlayerTurns phase
    assert_eq!(state.round_phase, RoundPhase::PlayerTurns);

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    let select_tactics: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::SelectTactic { .. }))
        .collect();
    assert!(
        select_tactics.is_empty(),
        "SelectTactic should NOT appear during PlayerTurns phase"
    );
}

#[test]
fn normal_actions_not_enumerated_during_tactics_phase() {
    let state = create_solo_game(42, Hero::Arythea);
    assert_eq!(state.round_phase, RoundPhase::TacticsSelection);

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    // Should only have SelectTactic actions
    for action in &legal.actions {
        assert!(
            matches!(action, LegalAction::SelectTactic { .. }),
            "Only SelectTactic should appear during TacticsSelection, got {:?}",
            action
        );
    }
    assert!(!legal.actions.is_empty(), "Should have at least one tactic to select");
}

#[test]
fn selected_tactic_removed_from_available() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let tactic = state.available_tactics[0].clone();
    assert_eq!(state.available_tactics.len(), 6);

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

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

    assert!(!state.available_tactics.contains(&tactic));
    // Human tactic + dummy auto-selected tactic = 2 removed from 6
    assert_eq!(state.available_tactics.len(), 4);
}

#[test]
fn night_tactics_available_after_round_end() {
    use crate::card_play::play_card;
    use crate::end_turn::end_turn;

    let mut state = create_solo_game(42, Hero::Arythea);

    // Select a day tactic
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    let tactic = state.available_tactics[0].clone();
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: tactic,
        },
        epoch,
    )
    .unwrap();

    // Empty deck AND reduce hand to 1 card so round ends after playing it
    state.players[0].deck.clear();
    state.players[0].hand = vec![CardId::from("march")];

    // Play the last card and end turn — hand+deck both empty triggers round end
    play_card(&mut state, 0, 0, false, None).unwrap();
    end_turn(&mut state, 0).unwrap();

    // Should now be night → night tactics available
    assert_eq!(state.time_of_day, TimeOfDay::Night);
    assert_eq!(state.round_phase, RoundPhase::TacticsSelection);

    // Verify night tactics are enumerated
    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    let tactic_ids: Vec<&str> = legal
        .actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::SelectTactic { tactic_id } => Some(tactic_id.as_str()),
            _ => None,
        })
        .collect();

    assert!(tactic_ids.contains(&"from_the_dusk"), "Night tactic should be available");
    assert!(
        !tactic_ids.contains(&"early_bird"),
        "Day tactic should NOT be available at night"
    );
}

#[test]
fn pending_rethink_blocks_all_normal_actions() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("rethink"),
        },
        epoch,
    )
    .unwrap();

    assert!(state.players[0].pending.has_active());

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    // Only SubsetSelect/SubsetConfirm/Undo should be available
    for action in &legal.actions {
        assert!(
            matches!(
                action,
                LegalAction::SubsetSelect { .. }
                    | LegalAction::SubsetConfirm
                    | LegalAction::Undo
            ),
            "Only SubsetSelect/SubsetConfirm/Undo allowed with pending, got {:?}",
            action
        );
    }
    // Should have at least SubsetConfirm (empty-set confirm)
    assert!(!legal.actions.is_empty());
}

#[test]
fn pending_mana_steal_blocks_normal_actions() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("mana_steal"),
        },
        epoch,
    )
    .unwrap();

    assert!(state.players[0].pending.has_active());

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    for action in &legal.actions {
        assert!(
            matches!(
                action,
                LegalAction::ResolveTacticDecision { .. } | LegalAction::Undo
            ),
            "Only ResolveTacticDecision/Undo allowed with ManaSteal pending, got {:?}",
            action
        );
    }
}

#[test]
fn pending_preparation_blocks_normal_actions() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("preparation"),
        },
        epoch,
    )
    .unwrap();

    assert!(state.players[0].pending.has_active());

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    for action in &legal.actions {
        assert!(
            matches!(
                action,
                LegalAction::ResolveTacticDecision { .. } | LegalAction::Undo
            ),
            "Only ResolveTacticDecision/Undo allowed with Preparation pending, got {:?}",
            action
        );
    }
}

#[test]
fn midnight_meditation_not_activatable_after_move() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic =
        Some(mk_types::ids::TacticId::from("midnight_meditation"));
    state.players[0].flags.insert(PlayerFlags::HAS_MOVED_THIS_TURN);

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        !legal.actions.contains(&LegalAction::ActivateTactic),
        "MM should NOT be activatable after moving"
    );
}

#[test]
fn midnight_meditation_not_activatable_after_action() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic =
        Some(mk_types::ids::TacticId::from("midnight_meditation"));
    state.players[0]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        !legal.actions.contains(&LegalAction::ActivateTactic),
        "MM should NOT be activatable after taking an action"
    );
}

#[test]
fn midnight_meditation_not_activatable_with_empty_hand() {
    let mut state = setup_playing_game(vec![]);
    state.players[0].selected_tactic =
        Some(mk_types::ids::TacticId::from("midnight_meditation"));

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        !legal.actions.contains(&LegalAction::ActivateTactic),
        "MM should NOT be activatable with empty hand"
    );
}

#[test]
fn the_right_moment_not_activatable_after_round_announced() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic =
        Some(mk_types::ids::TacticId::from("the_right_moment"));
    state.end_of_round_announced_by = Some(state.players[0].id.clone());

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        !legal.actions.contains(&LegalAction::ActivateTactic),
        "TRM should NOT be activatable after round end announced"
    );
}

#[test]
fn long_night_not_activatable_with_nonempty_deck() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("long_night"));
    state.players[0].discard = vec![CardId::from("stamina")];
    // deck is not empty by default

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        !legal.actions.contains(&LegalAction::ActivateTactic),
        "Long Night should NOT be activatable when deck is not empty"
    );
}

#[test]
fn long_night_not_activatable_with_empty_discard() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("long_night"));
    state.players[0].deck.clear();
    state.players[0].discard.clear();

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        !legal.actions.contains(&LegalAction::ActivateTactic),
        "Long Night should NOT be activatable when discard is empty"
    );
}

#[test]
fn mana_search_not_enumerated_when_tactic_flipped() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("mana_search"));
    state.players[0].flags.insert(PlayerFlags::TACTIC_FLIPPED);

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        !legal.actions.contains(&LegalAction::InitiateManaSearch),
        "Mana Search should NOT work when tactic is flipped"
    );
}

#[test]
fn rethink_skips_pending_with_empty_hand() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.players[0].hand.clear();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("rethink"),
        },
        epoch,
    )
    .unwrap();

    // With empty hand, Rethink should NOT create a pending
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn mana_steal_skips_pending_when_no_basic_dice() {
    let mut state = create_solo_game(42, Hero::Arythea);
    // Mark all dice as depleted
    for die in &mut state.source.dice {
        die.is_depleted = true;
    }

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("mana_steal"),
        },
        epoch,
    )
    .unwrap();

    // No basic dice available → no pending
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn preparation_skips_pending_with_empty_deck() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.players[0].deck.clear();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("preparation"),
        },
        epoch,
    )
    .unwrap();

    // Empty deck → no pending
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn midnight_meditation_duplicate_cards_in_hand() {
    // Test swapping duplicate cards from hand
    let mut state = setup_playing_game(vec!["march", "march", "march", "rage"]);
    state.players[0].selected_tactic =
        Some(mk_types::ids::TacticId::from("midnight_meditation"));
    state.players[0].deck = vec![CardId::from("stamina"), CardId::from("swiftness")];
    state.players[0].discard.clear();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // Activate MM
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ActivateTactic,
        epoch,
    )
    .unwrap();

    // Resolve: select indices 0 and 1 (2 of the 3 marches), then confirm
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 0 }, epoch,
    ).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SubsetSelect { index: 1 }, epoch,
    ).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SubsetConfirm, epoch,
    ).unwrap();

    // Should still have 4 cards in hand (rage + 1 march kept + 2 drawn)
    assert_eq!(state.players[0].hand.len(), 4);
    // Rage should still be in hand (index 3 was not swapped)
    assert!(state.players[0].hand.contains(&CardId::from("rage")));
    // At least 1 march should remain (index 2 was kept)
    let march_count = state.players[0]
        .hand
        .iter()
        .filter(|c| c.as_str() == "march")
        .count();
    assert!(march_count >= 1, "At least 1 march should remain (unswapped)");
    // Deck should have remaining pool cards
    // Pool was: 2 marches + 2 deck cards = 4, drew 2 back, so deck has 2
    assert_eq!(state.players[0].deck.len(), 2);
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn subset_select_auto_confirms_at_max() {
    // With 3-card hand and max_selections=3, selecting 3 cards should auto-confirm
    let mut state = create_solo_game(42, Hero::Arythea);
    state.players[0].hand = vec![
        CardId::from("march"),
        CardId::from("stamina"),
        CardId::from("rage"),
    ];
    state.players[0].deck = vec![CardId::from("swiftness"), CardId::from("concentration")];
    state.players[0].discard.clear();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // Select rethink (max_selections = min(3,3) = 3)
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("rethink"),
        },
        epoch,
    ).unwrap();

    // Select all 3 — third should auto-confirm (no explicit SubsetConfirm needed)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 0 }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 1 }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 2 }, epoch).unwrap();

    // Pending should be cleared (auto-confirmed)
    assert!(!state.players[0].pending.has_active());
    // All 3 were swapped, so hand should have 3 new cards
    assert_eq!(state.players[0].hand.len(), 3);
}

#[test]
fn subset_select_excludes_already_selected() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.players[0].hand = vec![
        CardId::from("march"),
        CardId::from("stamina"),
        CardId::from("rage"),
    ];

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SelectTactic {
            tactic_id: mk_types::ids::TacticId::from("rethink"),
        },
        epoch,
    ).unwrap();

    // Select index 1
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::SubsetSelect { index: 1 }, epoch).unwrap();

    // Enumerate — should have SubsetSelect for 0 and 2 (not 1) + SubsetConfirm
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let selects: Vec<usize> = legal.actions.iter().filter_map(|a| match a {
        LegalAction::SubsetSelect { index } => Some(*index),
        _ => None,
    }).collect();
    assert_eq!(selects, vec![0, 2]);
    assert!(legal.actions.contains(&LegalAction::SubsetConfirm));
}

#[test]
fn subset_select_no_confirm_below_min() {
    // If min_selections > 0, SubsetConfirm should not appear until met.
    // Currently Rethink/MM have min_selections=0, so this tests the state directly.
    use mk_types::pending::{SubsetSelectionState, SubsetSelectionKind};
    let mut state = setup_playing_game(vec!["march", "stamina"]);

    // Manually set a SubsetSelection with min_selections=1
    state.players[0].pending.active = Some(ActivePending::SubsetSelection(SubsetSelectionState {
        kind: SubsetSelectionKind::Rethink,
        pool_size: 2,
        max_selections: 2,
        min_selections: 1,
        selected: Vec::new(),
    }));

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    // No confirm yet (0 < 1)
    assert!(!legal.actions.contains(&LegalAction::SubsetConfirm));
    // But SubsetSelect is available
    assert!(legal.actions.iter().any(|a| matches!(a, LegalAction::SubsetSelect { .. })));
}

#[test]
fn non_active_player_gets_no_actions() {
    // In solo, during TacticsSelection, only the selector gets actions
    let state = create_solo_game(42, Hero::Arythea);
    assert_eq!(state.round_phase, RoundPhase::TacticsSelection);

    // Player 0 is the selector — try enumerating for an out-of-range player
    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 1, &undo);
    assert!(legal.actions.is_empty(), "Non-existent player should get no actions");
}

#[test]
fn game_ended_returns_no_actions() {
    let mut state = setup_playing_game(vec!["march"]);
    state.game_ended = true;

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    assert!(legal.actions.is_empty(), "No actions when game has ended");
}

#[test]
fn stale_epoch_rejected_for_tactic_selection() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();
    let stale_epoch = state.action_epoch + 100;
    let tactic = state.available_tactics[0].clone();

    let result = apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SelectTactic {
            tactic_id: tactic,
        },
        stale_epoch,
    );
    assert!(matches!(result, Err(ApplyError::StaleActionSet { .. })));
}

