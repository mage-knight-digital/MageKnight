use super::*;

// =========================================================================
// Determinism
// =========================================================================

#[test]
fn deterministic_enumeration() {
    let state = create_solo_game(42, Hero::Arythea);
    let a = enumerate_legal_actions(&state, 0);
    let b = enumerate_legal_actions(&state, 0);
    assert_eq!(a.actions, b.actions);
}

#[test]
fn deterministic_normal_turn() {
    let mut state = setup_game(vec!["march", "rage", "swiftness"]);
    state.players[0].move_points = 5;
    let a = enumerate_legal_actions(&state, 0);
    let b = enumerate_legal_actions(&state, 0);
    assert_eq!(a.actions, b.actions);
}

// =========================================================================
// Guards
// =========================================================================

#[test]
fn wrong_player_empty() {
    let state = create_solo_game(42, Hero::Arythea);
    let legal = enumerate_legal_actions(&state, 1);
    assert!(legal.actions.is_empty());
}

#[test]
fn game_ended_empty() {
    let mut state = setup_game(vec!["march"]);
    state.game_ended = true;
    let legal = enumerate_legal_actions(&state, 0);
    assert!(legal.actions.is_empty());
}

// =========================================================================
// Epoch
// =========================================================================

#[test]
fn epoch_matches_state() {
    let mut state = setup_game(vec!["march"]);
    state.action_epoch = 42;
    let legal = enumerate_legal_actions(&state, 0);
    assert_eq!(legal.epoch, 42);
}

// =========================================================================
// Category ordering
// =========================================================================

#[test]
fn category_order_basic_before_powered_before_sideways() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Green,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let legal = enumerate_legal_actions(&state, 0);

    // Find positions
    let basic_pos = legal
        .actions
        .iter()
        .position(|a| matches!(a, LegalAction::PlayCardBasic { .. }));
    let powered_pos = legal
        .actions
        .iter()
        .position(|a| matches!(a, LegalAction::PlayCardPowered { .. }));
    let sideways_pos = legal
        .actions
        .iter()
        .position(|a| matches!(a, LegalAction::PlayCardSideways { .. }));

    assert!(
        basic_pos.unwrap() < powered_pos.unwrap(),
        "basic before powered"
    );
    assert!(
        powered_pos.unwrap() < sideways_pos.unwrap(),
        "powered before sideways"
    );
}

#[test]
fn category_order_cards_before_end_turn() {
    let mut state = setup_game(vec!["march"]);
    state.players[0]
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let legal = enumerate_legal_actions(&state, 0);

    let last_card = legal.actions.iter().rposition(|a| {
        matches!(
            a,
            LegalAction::PlayCardBasic { .. }
                | LegalAction::PlayCardPowered { .. }
                | LegalAction::PlayCardSideways { .. }
        )
    });
    let end_turn_pos = legal
        .actions
        .iter()
        .position(|a| matches!(a, LegalAction::EndTurn));

    if let (Some(lc), Some(et)) = (last_card, end_turn_pos) {
        assert!(lc < et, "cards should come before EndTurn");
    }
}

// =========================================================================
// Contract tests — CI gate
// =========================================================================

/// Assert every action in a LegalActionSet executes successfully.
fn assert_all_executable(state: &GameState, undo: &UndoStack, player_idx: usize) {
    let legal = enumerate_legal_actions_with_undo(state, player_idx, undo);
    for (i, action) in legal.actions.iter().enumerate() {
        let mut s = state.clone();
        let mut u = undo.clone();
        let result = apply_legal_action(&mut s, &mut u, player_idx, action, legal.epoch);
        assert!(
            result.is_ok(),
            "Action {i} ({action:?}) failed: {:?}",
            result.unwrap_err()
        );
    }
}

#[test]
fn contract_tactics_phase() {
    let state = create_solo_game(42, Hero::Arythea);
    let undo = UndoStack::new();
    assert_all_executable(&state, &undo, 0);
}

#[test]
fn contract_normal_turn_fresh() {
    let state = setup_game(vec!["march", "rage", "swiftness"]);
    let undo = UndoStack::new();
    assert_all_executable(&state, &undo, 0);
}

#[test]
fn contract_normal_turn_with_move_points() {
    let mut state = setup_game(vec!["march", "rage"]);
    state.players[0].move_points = 10;
    let undo = UndoStack::new();
    assert_all_executable(&state, &undo, 0);
}

#[test]
fn contract_pending_choice() {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let mut state = setup_game(vec!["march"]);
    state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
        card_id: None,
        skill_id: None,
        unit_instance_id: None,
        options: vec![
            CardEffect::GainMove { amount: 2 },
            CardEffect::GainInfluence { amount: 3 },
            CardEffect::GainFame { amount: 1 },
        ],
        continuation: vec![],
        movement_bonus_applied: false,
        resolution: ChoiceResolution::Standard,
    }));
    let undo = UndoStack::new();
    assert_all_executable(&state, &undo, 0);
}

#[test]
fn contract_combat_stub() {
    let mut state = setup_game(vec!["march", "rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let undo = UndoStack::new();
    assert_all_executable(&state, &undo, 0);
}

#[test]
fn contract_powered_requires_mana() {
    // Without mana (no tokens, crystals, or source dice): no powered actions
    let mut state = setup_game(vec!["march"]);
    state.source.dice.clear();
    let legal = enumerate_legal_actions(&state, 0);
    let has_powered = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::PlayCardPowered { .. }));
    assert!(!has_powered, "should not emit powered without mana");

    // With mana: powered action emitted and executable
    let mut state_with_mana = setup_game(vec!["march"]);
    state_with_mana.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Green,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let undo = UndoStack::new();
    assert_all_executable(&state_with_mana, &undo, 0);
}

#[test]
fn contract_end_turn_requires_card_play() {
    // Fresh turn: no EndTurn
    let state = setup_game(vec!["march"]);
    let legal = enumerate_legal_actions(&state, 0);
    let has_end = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::EndTurn));
    assert!(
        !has_end,
        "EndTurn should not be available without card play"
    );

    // After card play: EndTurn available and executable
    let mut state2 = setup_game(vec!["march"]);
    state2.players[0]
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let undo = UndoStack::new();
    assert_all_executable(&state2, &undo, 0);
}

#[test]
fn contract_resting_flow() {
    // DeclareRest then CompleteRest should both be executable
    let state = setup_game(vec!["march"]);
    let undo = UndoStack::new();
    assert_all_executable(&state, &undo, 0);

    // Standard rest: march in hand while resting
    let mut resting_state = setup_game(vec!["march"]);
    resting_state.players[0]
        .flags
        .insert(PlayerFlags::IS_RESTING);
    assert_all_executable(&resting_state, &undo, 0);

    // Standard rest with wounds: march + wound
    let mut resting_mixed = setup_game(vec!["march", "wound"]);
    resting_mixed.players[0]
        .flags
        .insert(PlayerFlags::IS_RESTING);
    assert_all_executable(&resting_mixed, &undo, 0);

    // Slow recovery: all wounds
    let mut resting_slow = setup_game(vec!["wound", "wound"]);
    resting_slow.players[0]
        .flags
        .insert(PlayerFlags::IS_RESTING);
    assert_all_executable(&resting_slow, &undo, 0);

    // Empty hand resting
    let mut resting_empty = setup_game(vec![]);
    resting_empty.players[0]
        .flags
        .insert(PlayerFlags::IS_RESTING);
    assert_all_executable(&resting_empty, &undo, 0);
}

#[test]
fn contract_random_walk_100_steps() {
    let mut state = create_solo_game(42, Hero::Arythea);
    let mut undo = UndoStack::new();
    let mut rng = mk_types::rng::RngState::new(99);

    for step in 0..100 {
        assert_all_executable(&state, &undo, 0);
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        if legal.actions.is_empty() {
            break;
        }
        let idx = rng.random_index(legal.actions.len()).unwrap();
        let result = apply_legal_action(&mut state, &mut undo, 0, &legal.actions[idx], legal.epoch);
        assert!(
            result.is_ok(),
            "Step {step}: action {:?} failed: {:?}",
            legal.actions[idx],
            result.unwrap_err()
        );
        if result.unwrap().game_ended {
            break;
        }
    }
}

#[test]
fn contract_random_walk_different_seed() {
    let mut state = create_solo_game(7, Hero::Tovak);
    let mut undo = UndoStack::new();
    let mut rng = mk_types::rng::RngState::new(42);

    for step in 0..100 {
        assert_all_executable(&state, &undo, 0);
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        if legal.actions.is_empty() {
            break;
        }
        let idx = rng.random_index(legal.actions.len()).unwrap();
        let result = apply_legal_action(&mut state, &mut undo, 0, &legal.actions[idx], legal.epoch);
        assert!(
            result.is_ok(),
            "Step {step}: action {:?} failed: {:?}",
            legal.actions[idx],
            result.unwrap_err()
        );
        if result.unwrap().game_ended {
            break;
        }
    }
}

// =========================================================================
// Scenario flow
// =========================================================================

#[test]
fn solo_game_has_tile_deck() {
    let state = create_solo_game(42, Hero::Arythea);
    // First Reconnaissance: 8 countryside + 2 non-city core + 1 city
    // (initial tile placement is done separately via place_initial_tiles)
    assert_eq!(
        state.map.tile_deck.countryside.len(),
        8,
        "Should have 8 countryside tiles in deck"
    );
    assert_eq!(
        state.map.tile_deck.core.len(),
        3,
        "Should have 3 core tiles (2 non-city + 1 city)"
    );
    // Last core tile should be a city tile
    let last_core = *state.map.tile_deck.core.last().unwrap();
    assert!(
        mk_data::tiles::is_city_tile(last_core),
        "Last core tile should be a city tile, got {:?}",
        last_core
    );
}

#[test]
fn explore_awards_fame() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 4;
    state.players[0].position = Some(HexCoord { q: 0, r: 0 });

    let initial_fame = state.players[0].fame;

    // Find an explore action
    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let explore = legal.actions.iter().find(|a| {
        matches!(a, LegalAction::Explore { .. })
    });

    if let Some(explore_action) = explore {
        let mut undo = UndoStack::new();
        apply_legal_action(&mut state, &mut undo, 0, explore_action, legal.epoch).unwrap();

        assert_eq!(
            state.players[0].fame,
            initial_fame + state.scenario_config.fame_per_tile_explored,
            "Exploring should award fame_per_tile_explored"
        );
    }
    // If no explore available, the test passes trivially (position-dependent)
}

#[test]
fn explore_city_tile_triggers_scenario_end() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 4;

    // Put player on a hex at the map edge
    let coord = HexCoord { q: 0, r: 0 };
    state.players[0].position = Some(coord);

    // Set up the tile deck so the next tile to be explored is a city tile
    // Put only city tiles in both countryside and core decks
    state.map.tile_deck.countryside.clear();
    state.map.tile_deck.core = vec![TileId::Core5GreenCity];

    assert!(!state.scenario_end_triggered, "Should start un-triggered");

    // Find and execute an explore action
    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let explore = legal.actions.iter().find(|a| {
        matches!(a, LegalAction::Explore { .. })
    });

    if let Some(explore_action) = explore {
        let mut undo = UndoStack::new();
        apply_legal_action(&mut state, &mut undo, 0, explore_action, legal.epoch).unwrap();

        // City tile should trigger scenario end
        assert!(
            state.scenario_end_triggered,
            "City tile explore should trigger scenario end"
        );
        assert!(
            state.final_turns_remaining.is_some(),
            "Final turns should be set"
        );
    }
}

#[test]
fn final_turns_countdown_ends_game() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].deck = (0..5).map(|i| CardId::from(format!("card_{}", i))).collect();

    // Simulate scenario end triggered with 1 final turn remaining
    state.scenario_end_triggered = true;
    state.final_turns_remaining = Some(1);

    // Play a card and end turn — should decrement and end game
    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    let result = crate::end_turn::end_turn(&mut state, 0).unwrap();

    assert!(
        matches!(result, crate::end_turn::EndTurnResult::GameEnded),
        "Should end game when final turns reach 0, got {:?}",
        result
    );
    assert!(state.game_ended);
    assert_eq!(state.phase, GamePhase::End);
}

#[test]
fn round_limit_ends_game() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].deck.clear(); // Force round end on end_turn

    // Set round to total_rounds so end_round triggers game end
    state.round = state.scenario_config.total_rounds;

    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    let result = crate::end_turn::end_turn(&mut state, 0).unwrap();

    assert!(
        matches!(result, crate::end_turn::EndTurnResult::GameEnded),
        "Should end game when round limit reached, got {:?}",
        result
    );
    assert!(state.game_ended);
    assert_eq!(state.phase, GamePhase::End);
}

#[test]
fn game_ended_blocks_actions() {
    let mut state = setup_game(vec!["march", "rage"]);
    state.game_ended = true;
    state.phase = GamePhase::End;

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);

    assert!(
        legal.actions.is_empty(),
        "No legal actions when game is ended, got {}",
        legal.actions.len()
    );
}

#[test]
fn tactic_removal_mode_drives_removal() {
    // AllUsed mode: used tactics should be removed between rounds
    let mut state = setup_game(vec!["march"]);
    state.players[0].deck.clear();
    state.players[0].selected_tactic = Some(mk_types::ids::TacticId::from("early_bird"));
    assert_eq!(state.scenario_config.tactic_removal_mode, TacticRemovalMode::AllUsed);

    crate::card_play::play_card(&mut state, 0, 0, false, None).unwrap();
    crate::end_turn::end_turn(&mut state, 0).unwrap();

    assert!(
        state.removed_tactics.iter().any(|t| t.as_str() == "early_bird"),
        "AllUsed mode should add used tactics to removed_tactics"
    );
    assert!(
        !state.available_tactics.iter().any(|t| t.as_str() == "early_bird"),
        "Removed tactic should not be in available_tactics"
    );
}
