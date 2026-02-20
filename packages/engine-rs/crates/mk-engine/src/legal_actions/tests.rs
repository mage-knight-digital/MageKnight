use super::*;
use crate::action_pipeline::apply_legal_action;
use crate::setup::create_solo_game;
use crate::undo::UndoStack;
use mk_types::hex::HexCoord;
use mk_types::ids::CardId;
use mk_types::pending::ActivePending;

/// Helper: create a game in player turns phase with specific hand.
fn setup_game(hand: Vec<&str>) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = hand.into_iter().map(CardId::from).collect();
    state
}

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
fn tactics_sorted_lexicographically() {
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
    let mut sorted = ids.clone();
    sorted.sort();
    assert_eq!(ids, sorted);
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
// Normal turn: cards
// =========================================================================

#[test]
fn march_basic_and_sideways_no_powered() {
    // Default state has no green mana, so powered should NOT be emitted
    let state = setup_game(vec!["march"]);
    let legal = enumerate_legal_actions(&state, 0);

    let basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "march"),
    );
    let powered = legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "march"));
    let sideways = legal.actions.iter().filter(|a| matches!(a, LegalAction::PlayCardSideways { card_id, .. } if card_id.as_str() == "march")).count();

    assert!(basic, "march basic should be available");
    assert!(
        !powered,
        "march powered should NOT be available (no green mana)"
    );
    assert_eq!(sideways, 2, "march should have Move and Influence sideways");
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
fn no_cards_when_resting() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let legal = enumerate_legal_actions(&state, 0);

    let has_card_play = legal.actions.iter().any(|a| {
        matches!(
            a,
            LegalAction::PlayCardBasic { .. }
                | LegalAction::PlayCardPowered { .. }
                | LegalAction::PlayCardSideways { .. }
        )
    });
    assert!(!has_card_play, "no cards should be playable when resting");
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
// Normal turn: moves
// =========================================================================

#[test]
fn move_targets_with_points() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 5;
    let legal = enumerate_legal_actions(&state, 0);

    let moves: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::Move { .. }))
        .collect();
    assert!(
        !moves.is_empty(),
        "should have move targets with 5 move points"
    );
}

#[test]
fn no_move_targets_without_points() {
    let state = setup_game(vec!["march"]);
    assert_eq!(state.players[0].move_points, 0);
    let legal = enumerate_legal_actions(&state, 0);

    let moves: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::Move { .. }))
        .collect();
    assert!(moves.is_empty());
}

#[test]
fn moves_sorted_by_coord() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 10;
    let legal = enumerate_legal_actions(&state, 0);

    let coords: Vec<(i32, i32)> = legal
        .actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Move { target, .. } => Some((target.q, target.r)),
            _ => None,
        })
        .collect();
    let mut sorted = coords.clone();
    sorted.sort();
    assert_eq!(coords, sorted, "move targets should be sorted by (q, r)");
}

// =========================================================================
// Normal turn: explore
// =========================================================================

#[test]
fn explore_with_tiles_available() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 5;
    state.players[0].position = Some(HexCoord::new(1, 0));
    state.map.tile_deck.countryside = vec![TileId::Countryside1];

    let legal = enumerate_legal_actions(&state, 0);
    let explores: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::Explore { .. }))
        .collect();
    assert!(
        !explores.is_empty(),
        "should have explore directions from edge"
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
        .any(|a| matches!(a, LegalAction::CompleteRest));
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
            CardEffect::GainInfluence { amount: 2 },
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
#[should_panic(expected = "Unsupported active pending in legal action pipeline")]
fn pending_non_choice_panics_fast() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].pending.active = Some(ActivePending::BannerProtectionChoice);
    let _ = enumerate_legal_actions(&state, 0);
}

// =========================================================================
// ChallengeRampaging
// =========================================================================

#[test]
fn challenge_rampaging_enumerated_for_adjacent_hex() {
    use mk_types::ids::EnemyTokenId;
    let mut state = setup_game(vec!["march"]);
    // Place rampaging enemy with drawn token on adjacent hex (1,0)
    let hex = state.map.hexes.get_mut("1,0").unwrap();
    hex.rampaging_enemies.push(RampagingEnemyType::OrcMarauder);
    hex.enemies.push(HexEnemy {
        token_id: EnemyTokenId::from("prowlers_1"),
        color: EnemyColor::Green,
        is_revealed: true,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let challenges: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ChallengeRampaging { .. }))
        .collect();
    assert_eq!(challenges.len(), 1, "should enumerate 1 challenge");
    assert!(matches!(
        challenges[0],
        LegalAction::ChallengeRampaging {
            hex: HexCoord { q: 1, r: 0 }
        }
    ));
}

#[test]
fn no_challenge_without_drawn_enemies() {
    let mut state = setup_game(vec!["march"]);
    // Rampaging type but no drawn enemy tokens
    let hex = state.map.hexes.get_mut("1,0").unwrap();
    hex.rampaging_enemies.push(RampagingEnemyType::OrcMarauder);

    let legal = enumerate_legal_actions(&state, 0);
    let challenges: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ChallengeRampaging { .. }))
        .collect();
    assert!(challenges.is_empty(), "no challenge without drawn enemies");
}

#[test]
fn no_challenge_after_action() {
    use mk_types::ids::EnemyTokenId;
    let mut state = setup_game(vec!["march"]);
    state.players[0]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    let hex = state.map.hexes.get_mut("1,0").unwrap();
    hex.rampaging_enemies.push(RampagingEnemyType::OrcMarauder);
    hex.enemies.push(HexEnemy {
        token_id: EnemyTokenId::from("prowlers_1"),
        color: EnemyColor::Green,
        is_revealed: true,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let challenges: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ChallengeRampaging { .. }))
        .collect();
    assert!(
        challenges.is_empty(),
        "no challenge after action this turn"
    );
}

#[test]
fn contract_challenge_rampaging_executable() {
    use mk_types::ids::EnemyTokenId;
    let mut state = setup_game(vec!["march"]);
    let hex = state.map.hexes.get_mut("1,0").unwrap();
    hex.rampaging_enemies.push(RampagingEnemyType::OrcMarauder);
    hex.enemies.push(HexEnemy {
        token_id: EnemyTokenId::from("prowlers_1"),
        color: EnemyColor::Green,
        is_revealed: true,
    });

    let undo = UndoStack::new();
    assert_all_executable(&state, &undo, 0);
}

// =========================================================================
// Combat
// =========================================================================

#[test]
fn combat_emits_combat_actions() {
    let mut state = setup_game(vec!["march", "rage"]);
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    let legal = enumerate_legal_actions(&state, 0);

    // Should have card plays + EndCombatPhase
    let has_end_phase = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::EndCombatPhase));
    assert!(has_end_phase, "EndCombatPhase should be present in combat");

    // Rage should have basic in combat (GainAttack is resolvable)
    let rage_basic = legal.actions.iter().any(
        |a| matches!(a, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "rage"),
    );
    assert!(rage_basic, "rage basic should be playable in combat");

    // Combat sideways should be Attack and Block
    let attack_sideways = legal.actions.iter().any(|a| {
        matches!(
            a,
            LegalAction::PlayCardSideways {
                sideways_as: SidewaysAs::Attack,
                ..
            }
        )
    });
    let block_sideways = legal.actions.iter().any(|a| {
        matches!(
            a,
            LegalAction::PlayCardSideways {
                sideways_as: SidewaysAs::Block,
                ..
            }
        )
    });
    assert!(attack_sideways, "combat should have Attack sideways");
    assert!(block_sideways, "combat should have Block sideways");
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
    // Without mana: no powered actions should be emitted
    let state = setup_game(vec!["march"]);
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

    let mut resting_state = setup_game(vec!["march"]);
    resting_state.players[0]
        .flags
        .insert(PlayerFlags::IS_RESTING);
    assert_all_executable(&resting_state, &undo, 0);
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
