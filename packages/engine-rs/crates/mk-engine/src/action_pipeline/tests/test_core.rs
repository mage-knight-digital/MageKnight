use super::*;

#[test]
fn stale_epoch_rejected() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    let result = apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndTurn, 999);
    assert!(matches!(result, Err(ApplyError::StaleActionSet { .. })));
}

#[test]
fn epoch_increments_after_action() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from("march"),
        },
        epoch,
    )
    .unwrap();

    assert_eq!(state.action_epoch, epoch + 1);
}

#[test]
fn select_tactic_transitions_to_player_turns() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();
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

    assert_eq!(state.round_phase, RoundPhase::PlayerTurns);
    assert!(state.players[0].selected_tactic.is_some());
    assert!(!state.available_tactics.contains(&tactic));
}

#[test]
fn play_card_basic_works() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    let result = apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from("march"),
        },
        epoch,
    )
    .unwrap();

    assert!(result.needs_reenumeration);
    assert!(!result.game_ended);
    assert_eq!(state.players[0].move_points, 2);
    assert!(undo.can_undo());
}

#[test]
fn play_card_powered_works() {
    let mut state = setup_playing_game(vec!["march"]);
    state.source.dice.clear(); // control mana sources explicitly
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Green,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    let result = apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id: CardId::from("march"),
            mana_color: BasicManaColor::Green,
        },
        epoch,
    )
    .unwrap();

    assert!(result.needs_reenumeration);
    assert_eq!(state.players[0].move_points, 4);
    assert!(state.players[0].pure_mana.is_empty());
}

#[test]
fn play_card_sideways_works() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::PlayCardSideways {
            hand_index: 0,
            card_id: CardId::from("march"),
            sideways_as: SidewaysAs::Move,
        },
        epoch,
    )
    .unwrap();

    assert_eq!(state.players[0].move_points, 1);
}

#[test]
fn move_works() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].move_points = 5;
    let mut undo = UndoStack::new();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let move_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::Move { .. }));
    if let Some(action) = move_action {
        let result = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch).unwrap();
        assert!(result.needs_reenumeration);
    }
}

#[test]
fn declare_rest_sets_flag() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::DeclareRest, epoch).unwrap();

    assert!(state.players[0].flags.contains(PlayerFlags::IS_RESTING));
    assert!(state.players[0]
        .flags
        .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
    assert!(undo.can_undo());
}

#[test]
fn complete_rest_sets_flag() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::CompleteRest {
            discard_hand_index: Some(0),
        },
        epoch,
    )
    .unwrap();

    assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
    assert!(state.players[0]
        .flags
        .contains(PlayerFlags::HAS_RESTED_THIS_TURN));
    assert!(state.players[0]
        .flags
        .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN));
    // march (non-wound) discarded + no wounds → hand empty, discard has march
    assert!(state.players[0].hand.is_empty());
    assert!(state.players[0]
        .discard
        .iter()
        .any(|c| c.as_str() == "march"));
}

#[test]
fn complete_rest_standard_enters_wound_discard_selection() {
    // Hand: march, wound → standard rest discarding march (index 0)
    // should enter SubsetSelection for wound discard.
    let mut state = setup_playing_game(vec!["march", "wound"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::CompleteRest {
            discard_hand_index: Some(0),
        },
        epoch,
    )
    .unwrap();

    // march discarded, wound remains in hand, SubsetSelection active.
    assert_eq!(state.players[0].hand.len(), 1);
    assert_eq!(state.players[0].hand[0].as_str(), "wound");
    assert!(state.players[0].discard.iter().any(|c| c.as_str() == "march"));
    assert!(state.players[0].flags.contains(PlayerFlags::IS_RESTING));
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::SubsetSelection(_))
    ));

    // Select the wound (pool index 0) → auto-confirms (max=1).
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SubsetSelect { index: 0 },
        epoch,
    )
    .unwrap();

    // Rest complete: wound discarded, flags set.
    assert!(state.players[0].hand.is_empty());
    assert_eq!(state.players[0].discard.len(), 2);
    assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
    assert!(state.players[0].flags.contains(PlayerFlags::HAS_RESTED_THIS_TURN));
}

#[test]
fn complete_rest_standard_skip_wound_discard() {
    // Hand: march, wound → standard rest discarding march, then confirm with 0 wounds.
    let mut state = setup_playing_game(vec!["march", "wound"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::CompleteRest {
            discard_hand_index: Some(0),
        },
        epoch,
    )
    .unwrap();

    // Confirm with no wounds selected.
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SubsetConfirm,
        epoch,
    )
    .unwrap();

    // Rest complete: wound still in hand, march discarded.
    assert_eq!(state.players[0].hand.len(), 1);
    assert_eq!(state.players[0].hand[0].as_str(), "wound");
    assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
    assert!(state.players[0].flags.contains(PlayerFlags::HAS_RESTED_THIS_TURN));
}

#[test]
fn complete_rest_slow_recovery_discards_one_wound() {
    // Hand: wound, wound → slow recovery discarding index 0
    // should remove only that wound.
    let mut state = setup_playing_game(vec!["wound", "wound"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::CompleteRest {
            discard_hand_index: Some(0),
        },
        epoch,
    )
    .unwrap();

    assert_eq!(state.players[0].hand.len(), 1); // one wound remains
    assert_eq!(state.players[0].hand[0].as_str(), "wound");
    assert_eq!(state.players[0].discard.len(), 1);
    assert_eq!(state.players[0].discard[0].as_str(), "wound");
}

#[test]
fn complete_rest_empty_hand_sets_flags() {
    let mut state = setup_playing_game(vec![]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::CompleteRest {
            discard_hand_index: None,
        },
        epoch,
    )
    .unwrap();

    assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
    assert!(state.players[0]
        .flags
        .contains(PlayerFlags::HAS_RESTED_THIS_TURN));
    assert!(state.players[0]
        .flags
        .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN));
    assert!(state.players[0].hand.is_empty());
    assert!(state.players[0].discard.is_empty());
}

#[test]
fn undo_complete_rest_restores_hand() {
    // DeclareRest + CompleteRest + SubsetSelect (wound), then undo all.
    let mut state = setup_playing_game(vec!["march", "wound"]);
    let original_hand = state.players[0].hand.clone();
    let mut undo = UndoStack::new();

    // DeclareRest
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::DeclareRest, epoch).unwrap();

    // CompleteRest — enters SubsetSelection for wound discard
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::CompleteRest {
            discard_hand_index: Some(0),
        },
        epoch,
    )
    .unwrap();

    // Select wound (auto-confirms at max=1)
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::SubsetSelect { index: 0 },
        epoch,
    )
    .unwrap();

    assert!(state.players[0].hand.is_empty());

    // Undo SubsetSelect+CompleteRest (snapshot restores to IS_RESTING with original hand)
    state = undo.undo().expect("should have undo snapshot");
    assert!(state.players[0].flags.contains(PlayerFlags::IS_RESTING));
    assert_eq!(state.players[0].hand, original_hand);

    // Undo DeclareRest
    state = undo.undo().expect("should have undo snapshot");
    assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
    assert!(!state.players[0]
        .flags
        .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
}

#[test]
fn full_rest_flow_declare_complete_end() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();

    // DeclareRest
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::DeclareRest, epoch).unwrap();
    assert!(state.players[0].flags.contains(PlayerFlags::IS_RESTING));

    // CompleteRest
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::CompleteRest {
            discard_hand_index: Some(0),
        },
        epoch,
    )
    .unwrap();
    assert!(!state.players[0].flags.contains(PlayerFlags::IS_RESTING));
    assert!(state.players[0]
        .flags
        .contains(PlayerFlags::HAS_RESTED_THIS_TURN));

    // EndTurn should now be available via legal actions
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_end = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::EndTurn));
    assert!(has_end, "EndTurn should be available after resting");
}

#[test]
fn end_turn_after_card_play() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;

    // Play a card first
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from("march"),
        },
        epoch,
    )
    .unwrap();

    let epoch = state.action_epoch;
    let result =
        apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndTurn, epoch).unwrap();

    assert!(result.needs_reenumeration);
}

#[test]
fn undo_restores_state() {
    let mut state = setup_playing_game(vec!["march", "rage"]);
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    let original_hand_len = state.players[0].hand.len();

    // Play a card (saves snapshot)
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from("march"),
        },
        epoch,
    )
    .unwrap();

    assert_eq!(state.players[0].hand.len(), original_hand_len - 1);

    // Undo
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::Undo, epoch).unwrap();

    assert_eq!(state.players[0].hand.len(), original_hand_len);
}

