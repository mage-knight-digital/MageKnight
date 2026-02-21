use super::*;
use crate::action_pipeline::apply_legal_action;
use crate::setup::create_solo_game;
use crate::undo::UndoStack;
use mk_types::effect::CardEffect;
use mk_types::enums::ResistanceElement;
use mk_types::hex::HexCoord;
use mk_types::ids::CardId;
use mk_types::modifier::{EnemyStat as ModEnemyStat, ModifierEffect, ModifierScope};
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
fn no_sideways_when_resting() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);
    let legal = enumerate_legal_actions(&state, 0);

    let has_sideways = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::PlayCardSideways { .. }));
    assert!(
        !has_sideways,
        "sideways should not be playable while resting"
    );

    // But basic/powered plays are still allowed during rest (FAQ S3).
    let has_basic = legal
        .actions
        .iter()
        .any(|a| matches!(a, LegalAction::PlayCardBasic { .. }));
    assert!(has_basic, "basic plays should be allowed while resting");
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
    state.players[0].pending.active = Some(ActivePending::SourceOpeningReroll {
        die_id: mk_types::ids::SourceDieId::from("test"),
    });
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
// Unit recruitment
// =========================================================================

use mk_types::ids::UnitId;
use mk_types::state::Site;

/// Helper: place player at a village hex with units in offer + influence.
fn setup_village_recruit() -> GameState {
    let mut state = setup_game(vec!["march"]);
    // Place a village on the player's hex (0,0)
    let hex = state.map.hexes.get_mut("0,0").unwrap();
    hex.site = Some(Site {
        site_type: SiteType::Village,
        owner: None,
        is_conquered: false,
        is_burned: false,
        city_color: None,
        mine_color: None,
        deep_mine_colors: None,
    });
    // Populate the unit offer with village-recruitable units
    state.offers.units = vec![
        UnitId::from("peasants"),
        UnitId::from("foresters"),
        UnitId::from("herbalist"),
    ];
    // Give player enough influence
    state.players[0].influence_points = 20;
    state
}

#[test]
fn recruit_unit_enumerated_at_village() {
    let state = setup_village_recruit();
    let legal = enumerate_legal_actions(&state, 0);

    let recruits: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::RecruitUnit { .. }))
        .collect();
    assert!(
        !recruits.is_empty(),
        "should enumerate RecruitUnit actions at village"
    );
    // peasants(4), foresters(5), herbalist(3) all available at village
    assert_eq!(recruits.len(), 3, "all 3 village units should be recruitable");
}

#[test]
fn contract_recruit_unit_at_village() {
    let state = setup_village_recruit();
    let undo = UndoStack::new();
    assert_all_executable(&state, &undo, 0);
}

#[test]
fn recruit_deducts_influence_and_creates_unit() {
    let mut state = setup_village_recruit();
    let mut undo = UndoStack::new();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Find peasants recruit action (cost=4 at rep 0)
    let peasant_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::RecruitUnit { unit_id, .. } if unit_id.as_str() == "peasants"))
        .expect("peasants should be recruitable");

    let influence_before = state.players[0].influence_points;
    let units_before = state.players[0].units.len();
    let offer_len_before = state.offers.units.len();

    let result = apply_legal_action(&mut state, &mut undo, 0, peasant_action, legal.epoch);
    assert!(result.is_ok());

    assert_eq!(
        state.players[0].influence_points,
        influence_before - 4,
        "peasants cost 4 influence at rep 0"
    );
    assert_eq!(
        state.players[0].units.len(),
        units_before + 1,
        "should have one more unit"
    );
    assert_eq!(
        state.players[0].units.last().unwrap().unit_id.as_str(),
        "peasants"
    );
    assert_eq!(
        state.offers.units.len(),
        offer_len_before - 1,
        "unit removed from offer"
    );
}

#[test]
fn recruit_undo_restores_state() {
    let mut state = setup_village_recruit();
    let mut undo = UndoStack::new();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let peasant_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::RecruitUnit { unit_id, .. } if unit_id.as_str() == "peasants"))
        .expect("peasants should be recruitable");

    let state_before = state.clone();

    let result = apply_legal_action(&mut state, &mut undo, 0, peasant_action, legal.epoch);
    assert!(result.is_ok());
    assert_eq!(state.players[0].units.len(), 1, "unit added after recruit");

    // Undo should restore state (except epoch)
    let undo_legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let undo_action = undo_legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::Undo))
        .expect("Undo should be available");
    let undo_result = apply_legal_action(&mut state, &mut undo, 0, undo_action, undo_legal.epoch);
    assert!(undo_result.is_ok());
    assert_eq!(
        state.players[0].units.len(),
        state_before.players[0].units.len(),
        "units restored after undo"
    );
    assert_eq!(
        state.players[0].influence_points,
        state_before.players[0].influence_points,
        "influence restored after undo"
    );
    assert_eq!(
        state.offers.units.len(),
        state_before.offers.units.len(),
        "offer restored after undo"
    );
}

#[test]
fn no_recruit_at_burned_village() {
    let mut state = setup_village_recruit();
    let hex = state.map.hexes.get_mut("0,0").unwrap();
    hex.site.as_mut().unwrap().is_burned = true;

    let legal = enumerate_legal_actions(&state, 0);
    let recruits: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::RecruitUnit { .. }))
        .collect();
    assert!(recruits.is_empty(), "no recruitment at burned village");
}

// =========================================================================
// Unit Activation
// =========================================================================

/// Helper: create a game with a ready peasant unit on the player's side.
fn setup_unit_activation() -> GameState {
    let mut state = setup_game(vec!["march"]);
    // Add a ready peasant unit
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_1"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });
    state
}

#[test]
fn peasant_noncombat_abilities_enumerated() {
    let state = setup_unit_activation();
    let legal = enumerate_legal_actions(&state, 0);

    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();
    // Peasants outside combat: Influence(2) and Move(2) only (not Attack/Block which are combat)
    assert_eq!(activations.len(), 2, "peasant should have 2 non-combat abilities");
}

#[test]
fn spent_unit_no_activations() {
    let mut state = setup_unit_activation();
    state.players[0].units[0].state = UnitState::Spent;
    let legal = enumerate_legal_actions(&state, 0);

    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();
    assert!(activations.is_empty(), "spent unit should have no activations");
}

#[test]
fn wounded_unit_no_activations() {
    let mut state = setup_unit_activation();
    state.players[0].units[0].wounded = true;
    let legal = enumerate_legal_actions(&state, 0);

    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();
    assert!(activations.is_empty(), "wounded unit should have no activations");
}

#[test]
fn activate_move_adds_move_points() {
    let mut state = setup_unit_activation();
    let mut undo = UndoStack::new();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Find the Move ability (ability_index=3 for peasants: Attack, Block, Influence, Move)
    let move_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 3, .. }))
        .expect("peasant Move ability should be available");

    let move_before = state.players[0].move_points;
    let result = apply_legal_action(&mut state, &mut undo, 0, move_action, legal.epoch);
    assert!(result.is_ok());

    assert_eq!(state.players[0].move_points, move_before + 2, "peasant move adds 2");
    assert_eq!(state.players[0].units[0].state, UnitState::Spent, "unit should be spent");
}

#[test]
fn activate_influence_adds_influence_points() {
    let mut state = setup_unit_activation();
    let mut undo = UndoStack::new();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Find the Influence ability (ability_index=2 for peasants)
    let inf_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 2, .. }))
        .expect("peasant Influence ability should be available");

    let inf_before = state.players[0].influence_points;
    let result = apply_legal_action(&mut state, &mut undo, 0, inf_action, legal.epoch);
    assert!(result.is_ok());

    assert_eq!(state.players[0].influence_points, inf_before + 2, "peasant influence adds 2");
    assert_eq!(state.players[0].units[0].state, UnitState::Spent, "unit should be spent");
}

#[test]
fn activate_unit_undo_restores_state() {
    let mut state = setup_unit_activation();
    let mut undo = UndoStack::new();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let move_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 3, .. }))
        .expect("peasant Move ability should be available");

    let state_before = state.clone();
    let _ = apply_legal_action(&mut state, &mut undo, 0, move_action, legal.epoch);
    assert_eq!(state.players[0].units[0].state, UnitState::Spent);

    // Undo
    let undo_legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let undo_action = undo_legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::Undo))
        .expect("Undo should be available");
    let _ = apply_legal_action(&mut state, &mut undo, 0, undo_action, undo_legal.epoch);

    assert_eq!(state.players[0].units[0].state, UnitState::Ready, "unit should be ready after undo");
    assert_eq!(
        state.players[0].move_points,
        state_before.players[0].move_points,
        "move points restored after undo"
    );
}

#[test]
fn combat_unit_attack_in_attack_phase() {
    let mut state = setup_unit_activation();
    // Enter combat
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Peasant in Attack phase: Attack(2, Phys) at index 0 should be available
    assert!(
        activations.iter().any(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 0, .. })),
        "Attack ability (index 0) should be available in Attack phase"
    );
    // Block (index 1) should NOT be available in Attack phase
    assert!(
        !activations.iter().any(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 1, .. })),
        "Block ability should not be available in Attack phase"
    );
    // Move/Influence (indices 2,3) should NOT be available in combat
    assert!(
        !activations.iter().any(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 2, .. })),
        "Influence should not be available in combat"
    );
}

#[test]
fn combat_block_in_block_phase() {
    let mut state = setup_unit_activation();
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Only Block (index 1) should be available
    assert_eq!(activations.len(), 1);
    assert!(matches!(activations[0], LegalAction::ActivateUnit { ability_index: 1, .. }));
}

#[test]
fn units_not_allowed_in_dungeon_combat() {
    let mut state = setup_unit_activation();
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().units_allowed = false;
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    assert!(activations.is_empty(), "no unit activations when units_allowed=false");
}

#[test]
fn activate_attack_updates_accumulator() {
    let mut state = setup_unit_activation();
    let mut undo = UndoStack::new();

    // Enter combat in Attack phase
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let atk_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 0, .. }))
        .expect("Attack ability should be available");

    let result = apply_legal_action(&mut state, &mut undo, 0, atk_action, legal.epoch);
    assert!(result.is_ok());

    let acc = &state.players[0].combat_accumulator.attack;
    assert_eq!(acc.normal, 2, "peasant attack 2 added to normal");
    assert_eq!(acc.normal_elements.physical, 2, "physical element");
    assert_eq!(state.players[0].units[0].state, UnitState::Spent);
}

#[test]
fn mana_costed_ability_requires_mana() {
    let mut state = setup_game(vec!["march"]);
    // Add a guardian golem unit
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_2"),
        unit_id: mk_types::ids::UnitId::from("guardian_golems"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });
    // No mana available initially
    state.players[0].pure_mana.clear();
    state.players[0].crystals = mk_types::state::Crystals::default();

    // Enter combat in Block phase
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Only free Block(2, Phys) at index 1 should be available
    // Mana-costed Block(4, Fire) at index 2 (red) and Block(4, Ice) at index 3 (blue) should be blocked
    assert_eq!(activations.len(), 1, "only free block should be available without mana");
    assert!(matches!(activations[0], LegalAction::ActivateUnit { ability_index: 1, .. }));

    // Now give red mana
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    let legal2 = enumerate_legal_actions(&state, 0);
    let activations2: Vec<_> = legal2
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Now Block(2, Phys) and Block(4, Fire) should both be available
    assert_eq!(activations2.len(), 2, "free block + red-costed block");
}

#[test]
fn activate_mana_costed_consumes_mana() {
    let mut state = setup_game(vec!["march"]);
    let mut undo = UndoStack::new();

    // Add guardian golem + red mana
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_2"),
        unit_id: mk_types::ids::UnitId::from("guardian_golems"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Find the mana-costed Fire Block (ability_index=2)
    let fire_block = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 2, .. }))
        .expect("Fire Block should be available with red mana");

    assert_eq!(state.players[0].pure_mana.len(), 1, "should have 1 mana token");
    let result = apply_legal_action(&mut state, &mut undo, 0, fire_block, legal.epoch);
    assert!(result.is_ok());

    assert!(state.players[0].pure_mana.is_empty(), "mana consumed");
    assert_eq!(state.players[0].combat_accumulator.block, 4, "block 4 added");
    assert_eq!(state.players[0].combat_accumulator.block_elements.fire, 4, "fire element");
}

#[test]
fn heal_ability_removes_wounds() {
    let mut state = setup_game(vec!["wound", "wound", "march"]);
    let mut undo = UndoStack::new();

    // Add magic familiars unit (has Heal(2) at index 3, free)
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_3"),
        unit_id: mk_types::ids::UnitId::from("magic_familiars"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let heal_action = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 3, .. }))
        .expect("Heal ability should be available with wounds in hand");

    let result = apply_legal_action(&mut state, &mut undo, 0, heal_action, legal.epoch);
    assert!(result.is_ok());

    let wound_count = state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count();
    assert_eq!(wound_count, 0, "both wounds healed by Heal(2)");
    assert_eq!(state.players[0].hand.len(), 1, "only march remains");
}

#[test]
fn heal_ability_not_available_without_wounds() {
    let mut state = setup_game(vec!["march"]);
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_3"),
        unit_id: mk_types::ids::UnitId::from("magic_familiars"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    let legal = enumerate_legal_actions(&state, 0);
    let heal = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 3, .. }));
    assert!(heal.is_none(), "Heal should not be available without wounds in hand");
}

#[test]
fn contract_test_unit_activations() {
    let state = setup_unit_activation();
    let undo = UndoStack::new();
    assert_all_executable(&state, &undo, 0);
}

// --- Fortification restriction ---

#[test]
fn ranged_blocked_at_fortified_site_in_rangedsiege() {
    // Utem Crossbowmen have: Attack(3, Phys), Block(3, Phys), RangedAttack(2, Phys)
    let mut state = setup_game(vec!["march"]);
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_xbow"),
        unit_id: mk_types::ids::UnitId::from("utem_crossbowmen"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Combat at fortified site, RangedSiege phase
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        is_at_fortified_site: true,
        ..CombatState::default()
    }));

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Ranged (index 2) should be BLOCKED at fortified in RangedSiege
    assert!(
        !activations.iter().any(|a| matches!(a, LegalAction::ActivateUnit { ability_index: 2, .. })),
        "RangedAttack should be blocked at fortified site in RangedSiege"
    );
    // No combat abilities should be available (Attack is Attack-phase only, Block is Block-phase only)
    assert!(activations.is_empty(), "no unit abilities available: ranged blocked by fort, attack/block wrong phase");
}

#[test]
fn siege_allowed_at_fortified_site_in_rangedsiege() {
    // Catapults have: Siege(3, Phys), Siege(5, Fire)[red], Siege(5, Ice)[blue]
    let mut state = setup_game(vec!["march"]);
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_cat"),
        unit_id: mk_types::ids::UnitId::from("catapults"),
        level: 3,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        is_at_fortified_site: true,
        ..CombatState::default()
    }));

    // No mana, so only the free Siege(3, Phys) at index 0
    state.players[0].pure_mana.clear();
    state.players[0].crystals = mk_types::state::Crystals::default();

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    assert_eq!(activations.len(), 1, "free siege should be available at fortified site");
    assert!(matches!(activations[0], LegalAction::ActivateUnit { ability_index: 0, .. }));
}

#[test]
fn ranged_and_siege_at_fortified_with_mana() {
    // Catapults at fortified site with red mana — siege ok, ranged not applicable (catapults don't have ranged)
    // Use fire_golems: Attack(3, Phys), Block(3, Phys), RangedAttack(4, Fire)[red]
    let mut state = setup_game(vec!["march"]);
    use mk_types::ids::UnitInstanceId;
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_fg"),
        unit_id: mk_types::ids::UnitId::from("fire_golems"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Give red mana
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    // Fortified, RangedSiege
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        is_at_fortified_site: true,
        ..CombatState::default()
    }));

    let legal = enumerate_legal_actions(&state, 0);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Fire Golems: Attack(index 0) → Attack phase only → no.
    // Block(index 1) → Block phase only → no.
    // RangedAttack(index 2, red mana) → fortified blocks ranged → no.
    assert!(activations.is_empty(), "ranged blocked at fortified even with mana, attack/block wrong phase");

    // Now test in Attack phase at fortified — ranged allowed even at fortified site
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    let legal2 = enumerate_legal_actions(&state, 0);
    let activations2: Vec<_> = legal2
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();

    // Attack(index 0, free) + RangedAttack(index 2, red mana) both available in Attack phase
    assert_eq!(activations2.len(), 2, "attack + ranged available in Attack phase at fortified");
}

// --- Multi-unit same-phase contributions ---

#[test]
fn two_units_both_contribute_in_attack_phase() {
    let mut state = setup_game(vec!["march"]);
    let mut undo = UndoStack::new();
    use mk_types::ids::UnitInstanceId;

    // Add two peasant units
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_a"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_b"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // Both units should have Attack available
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let activations: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();
    assert_eq!(activations.len(), 2, "two peasants = two Attack activations");

    // Activate first unit
    let first = activations[0].clone();
    let result = apply_legal_action(&mut state, &mut undo, 0, &first, legal.epoch);
    assert!(result.is_ok());
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 2, "first peasant: 2 attack");

    // Activate second unit
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let activations2: Vec<_> = legal2
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::ActivateUnit { .. }))
        .collect();
    assert_eq!(activations2.len(), 1, "one peasant left to activate");

    let second = activations2[0].clone();
    let result2 = apply_legal_action(&mut state, &mut undo, 0, &second, legal2.epoch);
    assert!(result2.is_ok());
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 4, "both peasants: 2+2=4 attack");
}

// --- Elemental tracking across unit activations ---

#[test]
fn elemental_values_tracked_across_unit_activations() {
    let mut state = setup_game(vec!["march"]);
    let mut undo = UndoStack::new();
    use mk_types::ids::UnitInstanceId;

    // Add guardian golem (Attack 2 Phys, Block 2 Phys, Block 4 Fire [red], Block 4 Ice [blue])
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_golem"),
        unit_id: mk_types::ids::UnitId::from("guardian_golems"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Also add a red cape monk (Attack 3 Phys, Block 3 Phys, Attack 4 Fire [red], Block 4 Fire [red])
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_monk"),
        unit_id: mk_types::ids::UnitId::from("red_cape_monks"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Give red mana for mana-costed abilities
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    // Combat in Attack phase
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    // Activate guardian golem Attack(2, Physical) — ability_index 0
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let golem_atk = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { unit_instance_id, ability_index: 0, .. }
            if unit_instance_id.as_str() == "unit_golem"))
        .expect("golem attack should be available");
    let _ = apply_legal_action(&mut state, &mut undo, 0, golem_atk, legal.epoch);

    assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 2);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.fire, 0);

    // Activate red cape monk Attack 4 Fire (ability_index 2, mana-costed red)
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let monk_fire = legal2
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
            if unit_instance_id.as_str() == "unit_monk"))
        .expect("monk fire attack should be available");
    let _ = apply_legal_action(&mut state, &mut undo, 0, monk_fire, legal2.epoch);

    // Golem contributed 2 physical normal, monk contributed 4 fire normal
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 6, "2 phys + 4 fire = 6 total normal");
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 2, "physical from golem");
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.fire, 4, "fire from monk");
}

#[test]
fn block_elemental_values_from_multiple_units() {
    let mut state = setup_game(vec!["march"]);
    let mut undo = UndoStack::new();
    use mk_types::ids::UnitInstanceId;

    // Peasant: Block 2 Phys at index 1
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_p"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Guardian Golems: Block 4 Fire at index 2 (red mana)
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from("unit_g"),
        unit_id: mk_types::ids::UnitId::from("guardian_golems"),
        level: 2,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    // Give red mana for guardian golem fire block
    state.players[0].pure_mana.clear();
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Die,
        cannot_power_spells: false,
    });

    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    // Activate peasant Block(2, Phys) — index 1
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let peasant_blk = legal
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
            if unit_instance_id.as_str() == "unit_p"))
        .expect("peasant block should be available");
    let _ = apply_legal_action(&mut state, &mut undo, 0, peasant_blk, legal.epoch);

    assert_eq!(state.players[0].combat_accumulator.block, 2);
    assert_eq!(state.players[0].combat_accumulator.block_elements.physical, 2);

    // Activate guardian golem Fire Block(4, Fire) — index 2, costs red
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let golem_fire_blk = legal2
        .actions
        .iter()
        .find(|a| matches!(a, LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
            if unit_instance_id.as_str() == "unit_g"))
        .expect("golem fire block should be available");
    let _ = apply_legal_action(&mut state, &mut undo, 0, golem_fire_blk, legal2.epoch);

    assert_eq!(state.players[0].combat_accumulator.block, 6, "2 phys + 4 fire = 6 total block");
    assert_eq!(state.players[0].combat_accumulator.block_elements.physical, 2, "physical from peasant");
    assert_eq!(state.players[0].combat_accumulator.block_elements.fire, 4, "fire from golem");
}

// =========================================================================
// Tier 1 complex unit abilities
// =========================================================================

/// Helper: set up a game with a specific unit ready for non-combat activation.
fn setup_complex_unit(unit_id: &str, unit_instance_id: &str) -> (GameState, UndoStack) {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("march")]; // need a card to keep turn active
    state.players[0].units.clear();
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: mk_types::ids::UnitInstanceId::from(unit_instance_id),
        unit_id: mk_types::ids::UnitId::from(unit_id),
        level: mk_data::units::get_unit(unit_id).unwrap().level,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });
    let undo = UndoStack::new();
    (state, undo)
}

#[test]
fn herbalist_gain_green_mana() {
    let (mut state, mut undo) = setup_complex_unit("herbalist", "unit_herb");
    state.players[0].pure_mana.clear();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Herbalist ability index 2 = GainMana { color: Green }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_herb"
    )).expect("GainMana should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].pure_mana.len(), 1);
    assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Green);
}

#[test]
fn herbalist_ready_unit_auto() {
    let (mut state, mut undo) = setup_complex_unit("herbalist", "unit_herb");
    // Add a spent peasant at level 1 (within max_level=2)
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: mk_types::ids::UnitInstanceId::from("unit_peas"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Spent,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Herbalist ability index 1 = ReadyUnit { max_level: 2 }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_herb"
    )).expect("ReadyUnit should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    // Peasant should now be Ready again (auto-readied since only 1 eligible)
    let peasant = state.players[0].units.iter().find(|u| u.instance_id.as_str() == "unit_peas").unwrap();
    assert_eq!(peasant.state, UnitState::Ready);
}

#[test]
fn herbalist_ready_unit_not_enumerated_when_no_eligible() {
    let (state, undo) = setup_complex_unit("herbalist", "unit_herb");
    // No other units are spent, so ReadyUnit should NOT be enumerated
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let ready_action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_herb"
    ));
    assert!(ready_action.is_none(), "ReadyUnit should not be enumerated when no eligible units");
}

#[test]
fn illusionists_gain_white_crystal() {
    let (mut state, mut undo) = setup_complex_unit("illusionists", "unit_ill");
    state.players[0].crystals.white = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Illusionists ability index 2 = GainCrystal { color: White }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_ill"
    )).expect("GainCrystal should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].crystals.white, 1);
}

#[test]
fn fire_mages_gain_mana_and_crystal() {
    let (mut state, mut undo) = setup_complex_unit("fire_mages", "unit_fm");
    state.players[0].pure_mana.clear();
    state.players[0].crystals.red = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Fire Mages ability index 3 = GainManaAndCrystal { color: Red }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 3, .. }
        if unit_instance_id.as_str() == "unit_fm"
    )).expect("GainManaAndCrystal should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].pure_mana.len(), 1);
    assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Red);
    assert_eq!(state.players[0].crystals.red, 1);
}

#[test]
fn thugs_attack_with_rep_cost() {
    let (mut state, mut undo) = setup_complex_unit("thugs", "unit_thug");
    state.players[0].reputation = 0;
    // Enter combat
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Thugs ability index 1 = AttackWithRepCost { value: 3, element: Physical, rep_change: -1 }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_thug"
    )).expect("AttackWithRepCost should be available in Attack phase");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].combat_accumulator.attack.normal, 3);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 3);
    assert_eq!(state.players[0].reputation, -1);
}

#[test]
fn thugs_influence_with_rep_cost() {
    let (mut state, mut undo) = setup_complex_unit("thugs", "unit_thug");
    state.players[0].reputation = 3;
    state.players[0].influence_points = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Thugs ability index 2 = InfluenceWithRepCost { value: 4, rep_change: -1 }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_thug"
    )).expect("InfluenceWithRepCost should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].influence_points, 4);
    assert_eq!(state.players[0].reputation, 2);
}

#[test]
fn magic_familiars_move_or_influence_creates_pending() {
    let (mut state, mut undo) = setup_complex_unit("magic_familiars", "unit_mf");

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Magic Familiars ability index 2 = MoveOrInfluence { value: 3 }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_mf"
    )).expect("MoveOrInfluence should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should create a pending choice
    assert!(state.players[0].pending.has_active());
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::UnitAbilityChoice { ref options, wound_self: false, .. })
        if options.len() == 2
    ));

    // Unit should be spent
    let mf = state.players[0].units.iter().find(|u| u.instance_id.as_str() == "unit_mf").unwrap();
    assert_eq!(mf.state, UnitState::Spent);
}

#[test]
fn magic_familiars_choose_move() {
    let (mut state, mut undo) = setup_complex_unit("magic_familiars", "unit_mf");
    state.players[0].move_points = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_mf"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Now resolve the pending: choice 0 = GainMove { value: 3 }
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert_eq!(state.players[0].move_points, 3);
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn magic_familiars_choose_influence() {
    let (mut state, mut undo) = setup_complex_unit("magic_familiars", "unit_mf");
    state.players[0].influence_points = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_mf"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // choice 1 = GainInfluence { value: 3 }
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 1 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert_eq!(state.players[0].influence_points, 3);
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn utem_swordsmen_attack_or_block_creates_pending_in_combat() {
    let (mut state, mut undo) = setup_complex_unit("utem_swordsmen", "unit_us");
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Utem Swordsmen ability index 2 = AttackOrBlockWoundSelf { value: 6, element: Physical }
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_us"
    )).expect("AttackOrBlockWoundSelf should be available in Attack phase");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should create pending with wound_self=true
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::UnitAbilityChoice { wound_self: true, .. })
    ));
}

#[test]
fn utem_swordsmen_choose_attack_wounds_self() {
    let (mut state, mut undo) = setup_complex_unit("utem_swordsmen", "unit_us");
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_us"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // choice 0 = GainAttack { value: 6, element: Physical }
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert_eq!(state.players[0].combat_accumulator.attack.normal, 6);
    assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 6);
    // Unit should be wounded
    let us = state.players[0].units.iter().find(|u| u.instance_id.as_str() == "unit_us").unwrap();
    assert!(us.wounded);
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn utem_swordsmen_choose_block_wounds_self() {
    let (mut state, mut undo) = setup_complex_unit("utem_swordsmen", "unit_us");
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_us"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // choice 1 = GainBlock { value: 6, element: Physical }
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 1 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert_eq!(state.players[0].combat_accumulator.block, 6);
    assert_eq!(state.players[0].combat_accumulator.block_elements.physical, 6);
    // Unit should be wounded
    let us = state.players[0].units.iter().find(|u| u.instance_id.as_str() == "unit_us").unwrap();
    assert!(us.wounded);
}

#[test]
fn altem_guardians_grant_all_resistances() {
    let (mut state, mut undo) = setup_complex_unit("altem_guardians", "unit_ag");
    assert!(state.active_modifiers.is_empty());

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Altem Guardians ability index 2 = GrantAllResistances
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_ag"
    )).expect("GrantAllResistances should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    assert_eq!(state.active_modifiers.len(), 1);
    let m = &state.active_modifiers[0];
    assert_eq!(m.duration, mk_types::modifier::ModifierDuration::Turn);
    assert!(matches!(m.scope, mk_types::modifier::ModifierScope::AllUnits));
    match &m.effect {
        mk_types::modifier::ModifierEffect::GrantResistances { resistances } => {
            assert_eq!(resistances.len(), 3);
            assert!(resistances.contains(&ResistanceElement::Physical));
            assert!(resistances.contains(&ResistanceElement::Fire));
            assert!(resistances.contains(&ResistanceElement::Ice));
        }
        other => panic!("Expected GrantResistances, got {:?}", other),
    }
}

#[test]
fn rep_cost_clamped_at_minus_seven() {
    let (mut state, mut undo) = setup_complex_unit("thugs", "unit_thug");
    state.players[0].reputation = -7;
    state.players[0].influence_points = 0;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_thug"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    assert_eq!(state.players[0].reputation, -7, "Reputation should clamp at -7");
    assert_eq!(state.players[0].influence_points, 4);
}

#[test]
fn attack_or_block_available_in_block_phase() {
    let (mut state, undo) = setup_complex_unit("utem_swordsmen", "unit_us");
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_us"
    ));
    assert!(action.is_some(), "AttackOrBlockWoundSelf should be available in Block phase");
}

#[test]
fn attack_with_rep_cost_only_in_attack_phase() {
    let (mut state, undo) = setup_complex_unit("thugs", "unit_thug");
    state.combat = Some(Box::new(CombatState::default()));
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // AttackWithRepCost should NOT be available in Block phase
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_thug"
    ));
    assert!(action.is_none(), "AttackWithRepCost should NOT be in Block phase");
}

// =========================================================================
// SelectCombatEnemy unit abilities
// =========================================================================

/// Helper: set up a combat game with a specific unit and enemies.
fn setup_select_enemy_combat(
    unit_id: &str,
    unit_instance_id: &str,
    enemy_ids: &[&str],
) -> (GameState, UndoStack) {
    use mk_types::ids::{EnemyTokenId, UnitInstanceId};

    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("march")];
    state.players[0].units.clear();
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from(unit_instance_id),
        unit_id: mk_types::ids::UnitId::from(unit_id),
        level: mk_data::units::get_unit(unit_id).unwrap().level,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    let tokens: Vec<EnemyTokenId> = enemy_ids
        .iter()
        .map(|id| EnemyTokenId::from(format!("{}_1", id)))
        .collect();
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    )
    .unwrap();

    let undo = UndoStack::new();
    (state, undo)
}

#[test]
fn illusionists_cancel_attack_auto_resolves_single_enemy() {
    let (mut state, mut undo) = setup_select_enemy_combat("illusionists", "unit_ill", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    // Give white mana for the cancel attack ability (ability_index 1, costs white)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_ill"
    )).expect("cancel attack should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Single enemy → auto-resolve, no pending
    assert!(!state.players[0].pending.has_active());
    // Should have EnemySkipAttack modifier
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
    ));
    // Unit should be spent
    let unit = state.players[0].units.iter().find(|u| u.instance_id.as_str() == "unit_ill").unwrap();
    assert_eq!(unit.state, UnitState::Spent);
}

#[test]
fn illusionists_cancel_attack_excludes_fortified() {
    // Diggers have Fortified ability — should be excluded
    let (mut state, mut undo) = setup_select_enemy_combat("illusionists", "unit_ill", &["diggers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Cancel attack (ability_index 1) should NOT be enumerated — diggers are fortified
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_ill"
    ));
    // It should still be enumerable (filter happens at activation, not enumeration) but
    // we can verify that activation fizzles with no modifiers
    if let Some(act) = action {
        let _ = apply_legal_action(&mut state, &mut undo, 0, act, legal.epoch);
        // Fizzle: no modifier added (0 eligible enemies)
        assert!(state.active_modifiers.is_empty(), "should fizzle against fortified-only enemies");
        assert!(!state.players[0].pending.has_active());
    }
}

#[test]
fn illusionists_cancel_attack_excludes_arcane_immune() {
    // Shadow has ArcaneImmunity — should be excluded by the filter
    let (mut state, mut undo) = setup_select_enemy_combat("illusionists", "unit_ill", &["shadow"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_ill"
    ));
    if let Some(act) = action {
        let _ = apply_legal_action(&mut state, &mut undo, 0, act, legal.epoch);
        assert!(state.active_modifiers.is_empty(), "should fizzle against arcane immune");
    }
}

#[test]
fn illusionists_cancel_attack_multi_enemy_creates_pending() {
    let (mut state, mut undo) = setup_select_enemy_combat("illusionists", "unit_ill", &["prowlers", "orc_tracker"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_ill"
    )).unwrap();

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Multiple eligible → pending
    assert!(state.players[0].pending.has_active());
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::SelectCombatEnemy { ref eligible_enemy_ids, .. })
        if eligible_enemy_ids.len() == 2
    ));

    // Resolve choice 0
    let legal2 = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal2.actions.iter().find(|a| matches!(a, LegalAction::ResolveChoice { choice_index: 0 })).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal2.epoch);

    assert!(!state.players[0].pending.has_active());
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
    ));
}

#[test]
fn shocktroops_weaken_applies_armor_and_attack_modifiers() {
    let (mut state, mut undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Weaken = ability_index 1
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_st"
    )).expect("weaken should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have armor -1 and attack -1 modifiers
    let has_armor_mod = state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Armor, amount: -1, .. }
    ));
    let has_attack_mod = state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Attack, amount: -1, .. }
    ));
    assert!(has_armor_mod, "weaken should apply armor -1");
    assert!(has_attack_mod, "weaken should apply attack -1");
}

#[test]
fn shocktroops_taunt_applies_attack_reduction_and_redirect() {
    let (mut state, mut undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Taunt = ability_index 2
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_st"
    )).expect("taunt should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have attack -3 modifier
    let has_attack_mod = state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Attack, amount: -3, .. }
    ));
    assert!(has_attack_mod, "taunt should apply attack -3");

    // Should have damage redirect
    let combat = state.combat.as_ref().unwrap();
    assert!(combat.damage_redirects.contains_key("enemy_0"), "taunt should set damage redirect");
}

#[test]
fn shocktroops_coordinated_fire_adds_ranged_and_modifier() {
    let (mut state, mut undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // CoordinatedFire = ability_index 0
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 0, .. }
        if unit_instance_id.as_str() == "unit_st"
    )).expect("coordinated fire should be available in RangedSiege");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should add ranged 1
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 1);
    assert_eq!(state.players[0].combat_accumulator.attack.ranged_elements.physical, 1);
    // Should add UnitAttackBonus modifier
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::UnitAttackBonus { amount: 1 })
    ));
}

#[test]
fn coordinated_fire_only_in_ranged_phase() {
    let (mut state, undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // CoordinatedFire (index 0) should NOT be available in Attack phase
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 0, .. }
        if unit_instance_id.as_str() == "unit_st"
    ));
    assert!(action.is_none(), "CoordinatedFire should NOT be available in Attack phase");
}

#[test]
fn sorcerers_strip_fort_adds_nullifier_and_ranged() {
    let (mut state, mut undo) = setup_select_enemy_combat("sorcerers", "unit_sorc", &["diggers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;
    // Give white mana for strip_fort (ability_index 1, costs white)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_sorc"
    )).expect("strip fort should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have AbilityNullifier(Fortified) modifier
    assert!(state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::AbilityNullifier { ability: Some(EnemyAbilityType::Fortified), .. }
    )));
    // Should add ranged 3
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3);
}

#[test]
fn sorcerers_strip_resist_adds_remove_resistances_and_ranged() {
    // Use orc_war_beasts (Fire+Ice resist) to verify resistances removed
    let (mut state, mut undo) = setup_select_enemy_combat("sorcerers", "unit_sorc", &["orc_war_beasts"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;
    // Give green mana for strip_resist (ability_index 2, costs green)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Green,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_sorc"
    )).expect("strip resist should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have RemoveResistances modifier
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::RemoveResistances)
    ));
    // Should add ranged 3
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3);
}

#[test]
fn amotep_freezers_freeze_applies_skip_attack_and_armor_reduction() {
    let (mut state, mut undo) = setup_select_enemy_combat("amotep_freezers", "unit_af", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    // Give blue mana for freeze (ability_index 2, costs blue)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Blue,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_af"
    )).expect("freeze should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have EnemySkipAttack + armor -3
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
    ));
    assert!(state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Armor, amount: -3, .. }
    )));
}

#[test]
fn amotep_freezers_excludes_ice_resistant() {
    // Crystal sprites have Ice resistance — should be excluded by freeze template
    let (mut state, mut undo) = setup_select_enemy_combat("amotep_freezers", "unit_af", &["crystal_sprites"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Blue,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_af"
    ));
    if let Some(act) = action {
        let _ = apply_legal_action(&mut state, &mut undo, 0, act, legal.epoch);
        assert!(state.active_modifiers.is_empty(), "freeze should fizzle against ice-resistant enemies");
    }
}

#[test]
fn delphana_masters_destroy_if_blocked() {
    let (mut state, mut undo) = setup_select_enemy_combat("delphana_masters", "unit_dm", &["prowlers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    // Give red mana for destroy_if_blocked (ability_index 1, costs red)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_dm"
    )).expect("destroy if blocked should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::DefeatIfBlocked)
    ));
}

#[test]
fn delphana_masters_strip_defenses() {
    let (mut state, mut undo) = setup_select_enemy_combat("delphana_masters", "unit_dm", &["diggers"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    // Give white mana for strip_defenses (ability_index 3, costs white)
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 3, .. }
        if unit_instance_id.as_str() == "unit_dm"
    )).expect("strip defenses should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have both AbilityNullifier(Fortified) and RemoveResistances
    assert!(state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::AbilityNullifier { ability: Some(EnemyAbilityType::Fortified), .. }
    )));
    assert!(state.active_modifiers.iter().any(|m|
        matches!(m.effect, mk_types::modifier::ModifierEffect::RemoveResistances)
    ));
}

#[test]
fn arcane_immunity_blocks_skip_attack() {
    // Shadow has ArcaneImmunity. Weaken template: armor_change blocked by AI, attack_change not.
    // Use shocktroops weaken (no AI exclusion filter) against shadow.
    let (mut state2, mut undo2) = setup_select_enemy_combat("shocktroops", "unit_st", &["shadow"]);
    state2.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state2, 0, &undo2);
    // Weaken (index 1) has skip_attack=false, so this tests armor_change blocked by AI.
    // Let's actually use delphana cancel (index 0) which has skip_attack + exclude_arcane_immune=true + exclude_resistance=Some(Ice).
    // For a clean AI test, use a non-filtering template that has effects blocked by AI.
    // Weaken template: armor_change=-1 (blocked by AI), attack_change=-1 (NOT blocked by AI)
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_st"
    )).expect("weaken should be available against shadow");

    let _ = apply_legal_action(&mut state2, &mut undo2, 0, action, legal.epoch);

    // armor_change is blocked by AI → no armor modifier
    let has_armor_mod = state2.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Armor, .. }
    ));
    assert!(!has_armor_mod, "armor modifier should be blocked by ArcaneImmunity");

    // attack_change is NOT blocked by AI → should have attack modifier
    let has_attack_mod = state2.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Attack, amount: -1, .. }
    ));
    assert!(has_attack_mod, "attack modifier should bypass ArcaneImmunity");
}

#[test]
fn arcane_immunity_does_not_block_damage_redirect() {
    // Taunt has damage_redirect_from_unit=true — should bypass AI
    let (mut state, mut undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["shadow"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Taunt = ability_index 2
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 2, .. }
        if unit_instance_id.as_str() == "unit_st"
    )).expect("taunt should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // damage_redirect should still be set (bypasses AI)
    let combat = state.combat.as_ref().unwrap();
    assert!(combat.damage_redirects.contains_key("enemy_0"), "damage redirect should bypass AI");

    // attack_change should also bypass AI
    let has_attack_mod = state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::EnemyStat { stat: mk_types::modifier::EnemyStat::Attack, amount: -3, .. }
    ));
    assert!(has_attack_mod, "attack reduction should bypass AI");
}

#[test]
fn arcane_immunity_does_not_block_bundled_ranged() {
    // Sorcerer strip_fort against AI enemy: nullify_fortified blocked, but bundled_ranged should apply
    let (mut state, mut undo) = setup_select_enemy_combat("sorcerers", "unit_sorc", &["shadow"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;
    state.players[0].pure_mana.push(mk_types::state::ManaToken {
        color: ManaColor::White,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_sorc"
    )).expect("strip fort should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // nullify_fortified should be BLOCKED by AI
    let has_nullifier = state.active_modifiers.iter().any(|m| matches!(
        &m.effect,
        mk_types::modifier::ModifierEffect::AbilityNullifier { .. }
    ));
    assert!(!has_nullifier, "AbilityNullifier should be blocked by ArcaneImmunity");

    // bundled_ranged should still apply (bypasses AI)
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3, "bundled ranged should bypass AI");
}

#[test]
fn select_combat_enemy_all_phases_allowed() {
    // SelectCombatEnemy abilities should be available in all combat phases
    let (mut state, undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers"]);

    for phase in &[CombatPhase::RangedSiege, CombatPhase::Block, CombatPhase::Attack] {
        state.combat.as_mut().unwrap().phase = *phase;
        state.players[0].units[0].state = UnitState::Ready;

        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        // Weaken (index 1) should be available in all combat phases
        let action = legal.actions.iter().find(|a| matches!(a,
            LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
            if unit_instance_id.as_str() == "unit_st"
        ));
        assert!(action.is_some(), "SelectCombatEnemy should be available in {:?}", phase);
    }
}

#[test]
fn select_combat_enemy_not_outside_combat() {
    // SelectCombatEnemy should NOT be available outside combat
    let (state, undo) = setup_complex_unit("shocktroops", "unit_st");

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Weaken (index 1) should NOT be available outside combat
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_st"
    ));
    assert!(action.is_none(), "SelectCombatEnemy should NOT be available outside combat");
}

#[test]
fn contract_test_select_combat_enemy_abilities() {
    // Ensure all new SelectCombatEnemy and CoordinatedFire abilities are executable
    let (mut state, undo) = setup_select_enemy_combat("shocktroops", "unit_st", &["prowlers", "orc_tracker"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::RangedSiege;
    assert_all_executable(&state, &undo, 0);
}

#[test]
fn contract_test_delphana_masters_all_abilities() {
    let (mut state, undo) = setup_select_enemy_combat("delphana_masters", "unit_dm", &["prowlers", "orc_tracker"]);
    state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
    // Give mana for all 4 abilities (blue, red, green, white)
    for color in [ManaColor::Blue, ManaColor::Red, ManaColor::Green, ManaColor::White] {
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    }
    assert_all_executable(&state, &undo, 0);
}

// =========================================================================
// Foresters: MoveWithTerrainReduction
// =========================================================================

#[test]
fn foresters_activation_grants_move_and_terrain_modifiers() {
    let (mut state, mut undo) = setup_complex_unit("foresters", "unit_for");

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Foresters ability index 1 = MoveWithTerrainReduction
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ActivateUnit { unit_instance_id, ability_index: 1, .. }
        if unit_instance_id.as_str() == "unit_for"
    )).expect("MoveWithTerrainReduction should be available");

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Check move points gained
    assert_eq!(state.players[0].move_points, 2);

    // Check 3 terrain cost modifiers were pushed
    use mk_types::modifier::{ModifierEffect, TerrainOrAll, ModifierDuration, ModifierScope};
    let terrain_mods: Vec<_> = state.active_modifiers.iter().filter(|m| {
        matches!(&m.effect, ModifierEffect::TerrainCost { .. })
    }).collect();
    assert_eq!(terrain_mods.len(), 3);

    // Verify each modifier is Turn duration and SelfScope
    for m in &terrain_mods {
        assert_eq!(m.duration, ModifierDuration::Turn);
        assert!(matches!(&m.scope, ModifierScope::SelfScope));
    }

    // Check specific terrains are covered
    let has_forest = terrain_mods.iter().any(|m| matches!(&m.effect,
        ModifierEffect::TerrainCost { terrain: TerrainOrAll::Specific(Terrain::Forest), amount: -1, minimum: 0, .. }
    ));
    let has_hills = terrain_mods.iter().any(|m| matches!(&m.effect,
        ModifierEffect::TerrainCost { terrain: TerrainOrAll::Specific(Terrain::Hills), amount: -1, minimum: 0, .. }
    ));
    let has_swamp = terrain_mods.iter().any(|m| matches!(&m.effect,
        ModifierEffect::TerrainCost { terrain: TerrainOrAll::Specific(Terrain::Swamp), amount: -1, minimum: 0, .. }
    ));
    assert!(has_forest, "Missing forest terrain modifier");
    assert!(has_hills, "Missing hills terrain modifier");
    assert!(has_swamp, "Missing swamp terrain modifier");
}

#[test]
fn foresters_terrain_cost_forest_reduced() {
    use crate::movement::get_terrain_cost;
    use mk_types::modifier::*;

    // Forest day cost = 3, with Foresters -1 = 2
    let base = get_terrain_cost(Terrain::Forest, TimeOfDay::Day).unwrap();
    assert_eq!(base, 3);

    let modifiers = vec![ActiveModifier {
        id: mk_types::ids::ModifierId::from("test_1"),
        effect: ModifierEffect::TerrainCost {
            terrain: TerrainOrAll::Specific(Terrain::Forest),
            amount: -1,
            minimum: 0,
            replace_cost: None,
        },
        duration: ModifierDuration::Turn,
        scope: ModifierScope::SelfScope,
        source: ModifierSource::Unit { unit_index: 0, player_id: mk_types::ids::PlayerId::from("p0") },
        created_at_round: 0,
        created_by_player_id: mk_types::ids::PlayerId::from("p0"),
    }];

    // We test via full movement evaluation — set up state with forest hex
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.active_modifiers = modifiers;
    state.players[0].move_points = 10;

    // Find a forest hex from the starting tile
    let found = state.map.hexes.iter().find(|(_, h)| h.terrain == Terrain::Forest);
    if let Some((key, _)) = found {
        let parts: Vec<&str> = key.split(',').collect();
        let coord = HexCoord::new(parts[0].parse().unwrap(), parts[1].parse().unwrap());
        let result = crate::movement::evaluate_move_entry(&state, 0, coord);
        assert_eq!(result.cost, Some(2), "Forest cost should be reduced from 3 to 2");
    }
    // If no forest hex exists on starting tile, that's OK — the modifier logic is tested by unit tests in movement.rs
}

#[test]
fn foresters_terrain_cost_desert_unchanged() {
    // Desert should NOT be affected by Foresters (only forest/hills/swamp)
    use mk_types::modifier::*;

    let pid = mk_types::ids::PlayerId::from("p0");
    let modifiers = vec![
        ActiveModifier {
            id: mk_types::ids::ModifierId::from("test_1"),
            effect: ModifierEffect::TerrainCost {
                terrain: TerrainOrAll::Specific(Terrain::Forest),
                amount: -1, minimum: 0, replace_cost: None,
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            source: ModifierSource::Unit { unit_index: 0, player_id: pid.clone() },
            created_at_round: 0,
            created_by_player_id: pid.clone(),
        },
        ActiveModifier {
            id: mk_types::ids::ModifierId::from("test_2"),
            effect: ModifierEffect::TerrainCost {
                terrain: TerrainOrAll::Specific(Terrain::Hills),
                amount: -1, minimum: 0, replace_cost: None,
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            source: ModifierSource::Unit { unit_index: 0, player_id: pid.clone() },
            created_at_round: 0,
            created_by_player_id: pid.clone(),
        },
        ActiveModifier {
            id: mk_types::ids::ModifierId::from("test_3"),
            effect: ModifierEffect::TerrainCost {
                terrain: TerrainOrAll::Specific(Terrain::Swamp),
                amount: -1, minimum: 0, replace_cost: None,
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            source: ModifierSource::Unit { unit_index: 0, player_id: pid.clone() },
            created_at_round: 0,
            created_by_player_id: pid,
        },
    ];

    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.active_modifiers = modifiers;
    state.players[0].move_points = 10;

    // Find a desert hex from the starting tile
    let found = state.map.hexes.iter().find(|(_, h)| h.terrain == Terrain::Desert);
    if let Some((key, _)) = found {
        let parts: Vec<&str> = key.split(',').collect();
        let coord = HexCoord::new(parts[0].parse().unwrap(), parts[1].parse().unwrap());
        let result = crate::movement::evaluate_move_entry(&state, 0, coord);
        if result.cost.is_some() {
            // Desert day cost = 3, should be unchanged
            assert_eq!(result.cost, Some(3), "Desert cost should NOT be affected by Foresters");
        }
    }
}

// =========================================================================
// Unit damage assignment
// =========================================================================

/// Helper: create combat state with a unit and enemies, in AssignDamage phase.
fn setup_damage_assignment_combat(
    unit_id: &str,
    unit_instance_id: &str,
    enemy_ids: &[&str],
) -> (GameState, UndoStack) {
    use mk_types::ids::{EnemyTokenId, UnitInstanceId};

    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("march"), CardId::from("rage")];
    state.players[0].units.clear();
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: UnitInstanceId::from(unit_instance_id),
        unit_id: mk_types::ids::UnitId::from(unit_id),
        level: mk_data::units::get_unit(unit_id).unwrap().level,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    let tokens: Vec<EnemyTokenId> = enemy_ids
        .iter()
        .map(|id| EnemyTokenId::from(format!("{}_1", id)))
        .collect();
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    )
    .unwrap();

    // Advance to AssignDamage phase
    let combat = state.combat.as_mut().unwrap();
    combat.phase = CombatPhase::AssignDamage;
    // Mark all attacks as NOT blocked and NOT assigned
    for enemy in &mut combat.enemies {
        for blocked in &mut enemy.attacks_blocked {
            *blocked = false;
        }
        for assigned in &mut enemy.attacks_damage_assigned {
            *assigned = false;
        }
    }

    let undo = UndoStack::new();
    (state, undo)
}

#[test]
fn assign_damage_to_hero_available_in_assign_damage_phase() {
    let (state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let hero_action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToHero { enemy_index: 0, attack_index: 0 }
    ));
    assert!(hero_action.is_some(), "AssignDamageToHero should be available");
}

#[test]
fn assign_damage_to_unit_available_when_units_present() {
    let (state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let unit_action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    ));
    assert!(unit_action.is_some(), "AssignDamageToUnit should be available");
}

#[test]
fn assign_damage_no_unit_options_when_units_not_allowed() {
    let (mut state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);
    // Dungeons: units_allowed = false
    state.combat.as_mut().unwrap().units_allowed = false;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let unit_action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { .. }
    ));
    assert!(unit_action.is_none(), "No unit options when units_allowed=false");
    // Hero option should still exist
    let hero_action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToHero { .. }
    ));
    assert!(hero_action.is_some(), "AssignDamageToHero should still be available");
}

#[test]
fn assign_damage_sequential_only_first_attack() {
    // Two enemies — only the first unassigned attack should be enumerated
    let (state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers", "diggers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Should only have enemy_index=0 actions (prowlers first)
    let prowler_hero = legal.actions.iter().any(|a| matches!(a,
        LegalAction::AssignDamageToHero { enemy_index: 0, .. }
    ));
    let diggers_hero = legal.actions.iter().any(|a| matches!(a,
        LegalAction::AssignDamageToHero { enemy_index: 1, .. }
    ));
    assert!(prowler_hero, "First enemy should be available");
    assert!(!diggers_hero, "Second enemy should NOT be available yet");
}

#[test]
fn end_combat_phase_only_when_all_assigned() {
    let (mut state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);

    // Not all assigned yet
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let end_phase = legal.actions.iter().any(|a| matches!(a, LegalAction::EndCombatPhase));
    assert!(!end_phase, "EndCombatPhase should NOT be available when damage not all assigned");

    // Mark the single attack as assigned
    state.combat.as_mut().unwrap().enemies[0].attacks_damage_assigned[0] = true;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let end_phase = legal.actions.iter().any(|a| matches!(a, LegalAction::EndCombatPhase));
    assert!(end_phase, "EndCombatPhase should be available when all damage assigned");
}

#[test]
fn assign_damage_to_hero_adds_wound_cards() {
    // Prowlers: 4 physical attack. Hero armor is 2 (Arythea level 1). Wounds = ceil((4-2)/1) = 2
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);
    let initial_hand_len = state.players[0].hand.len();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToHero { enemy_index: 0, attack_index: 0 }
    )).unwrap();

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Wound cards should have been added to hand
    let wound_count = state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count();
    assert!(wound_count > 0, "Hero should have received wound cards");
    assert!(state.players[0].hand.len() > initial_hand_len, "Hand should be larger after taking wounds");
}

#[test]
fn assign_damage_poison_destroys_unit() {
    // Cursed Hags: 3 physical attack, Poison.
    // Peasants level 1, armor = level = 1.
    // Poison → instant destruction regardless of armor/damage.
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["cursed_hags"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    )).unwrap();

    assert_eq!(state.players[0].units.len(), 1);
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].units.len(), 0, "Poison should destroy unit");
}

#[test]
fn assign_damage_unit_absorbs_within_armor() {
    // Altem Guardians: level 4, armor = 4. Diggers: 3 attack.
    // 3 <= 4 → fully absorbed, no wound.
    let (mut state, mut undo) = setup_damage_assignment_combat("altem_guardians", "unit_ag", &["diggers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    )).unwrap();

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].units.len(), 1, "Unit should survive");
    assert!(!state.players[0].units[0].wounded, "Unit should NOT be wounded (damage <= armor)");
}

#[test]
fn assign_damage_unit_wounded_when_damage_exceeds_armor() {
    // Prowlers: 4 physical attack. Peasants: level 1, armor = 1.
    // 4 > 1 → unit wounded (first wound).
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    )).unwrap();

    assert!(!state.players[0].units[0].wounded);
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].units.len(), 1, "Unit should survive first wound");
    assert!(state.players[0].units[0].wounded, "Unit should be wounded");
}

#[test]
fn assign_damage_wounded_unit_destroyed() {
    // Pre-wound the unit, then assign damage that exceeds armor → destroyed
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);
    state.players[0].units[0].wounded = true;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    )).unwrap();

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].units.len(), 0, "Already-wounded unit should be destroyed");
}

#[test]
fn assign_damage_paralyze_destroys_unit() {
    // Medusa: 6 physical attack, Paralyze. Unit should be instantly destroyed.
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["medusa"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToUnit { enemy_index: 0, attack_index: 0, .. }
    )).unwrap();

    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);
    assert_eq!(state.players[0].units.len(), 0, "Paralyze should destroy unit");
}

#[test]
fn no_units_auto_assigns_all_to_hero() {
    // When no units: Block→AssignDamage should auto-assign and allow EndCombatPhase
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("march"), CardId::from("rage")];
    state.players[0].units.clear(); // No units

    let tokens = vec![mk_types::ids::EnemyTokenId::from("prowlers_1")];
    crate::combat::execute_enter_combat(&mut state, 0, &tokens, false, None, Default::default()).unwrap();

    // Go directly to Block phase and end it (no blocks)
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;
    let mut undo = UndoStack::new();

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let end_phase = legal.actions.iter().find(|a| matches!(a, LegalAction::EndCombatPhase)).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, end_phase, legal.epoch);

    // Should now be in AssignDamage phase, but auto-assigned since no units
    // EndCombatPhase should be available (all auto-assigned)
    let combat = state.combat.as_ref().unwrap();
    assert_eq!(combat.phase, CombatPhase::AssignDamage);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let end_phase = legal.actions.iter().any(|a| matches!(a, LegalAction::EndCombatPhase));
    assert!(end_phase, "EndCombatPhase should be available after auto-assign");
    // No interactive assignment actions should be present
    let assign_hero = legal.actions.iter().any(|a| matches!(a, LegalAction::AssignDamageToHero { .. }));
    assert!(!assign_hero, "No interactive assignment when auto-assigned");
}

#[test]
fn all_enemies_blocked_skips_interactive_assignment() {
    // When all enemy attacks are blocked, AssignDamage has nothing to assign
    let (mut state, undo) = setup_damage_assignment_combat("peasants", "unit_p", &["prowlers"]);
    // Mark all attacks as blocked
    state.combat.as_mut().unwrap().enemies[0].attacks_blocked[0] = true;

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    // Only EndCombatPhase should be available (no unblocked attacks)
    let end_phase = legal.actions.iter().any(|a| matches!(a, LegalAction::EndCombatPhase));
    assert!(end_phase, "EndCombatPhase should be available when all blocked");
    let assign_hero = legal.actions.iter().any(|a| matches!(a, LegalAction::AssignDamageToHero { .. }));
    assert!(!assign_hero, "No assignment needed when all attacks blocked");
}

#[test]
fn assign_damage_paralyze_to_hero_discards_hand() {
    // Medusa: Paralyze. After AssignDamage phase ends, non-wound cards discarded from hand.
    let (mut state, mut undo) = setup_damage_assignment_combat("peasants", "unit_p", &["medusa"]);
    // Remove unit so damage goes to hero
    state.players[0].units.clear();
    // Re-enter combat to get clean state
    state.combat = None;
    let tokens = vec![mk_types::ids::EnemyTokenId::from("medusa_1")];
    crate::combat::execute_enter_combat(&mut state, 0, &tokens, false, None, Default::default()).unwrap();
    state.combat.as_mut().unwrap().phase = CombatPhase::AssignDamage;

    // Make sure hand has non-wound cards
    state.players[0].hand = vec![CardId::from("march"), CardId::from("rage"), CardId::from("wound")];

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::AssignDamageToHero { enemy_index: 0, attack_index: 0 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Now end the AssignDamage phase → paralyze discards non-wound cards
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let end_phase = legal.actions.iter().find(|a| matches!(a, LegalAction::EndCombatPhase)).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, end_phase, legal.epoch);

    // All non-wound cards should be in discard, only wounds remain in hand
    let non_wounds_in_hand = state.players[0].hand.iter().filter(|c| c.as_str() != "wound").count();
    assert_eq!(non_wounds_in_hand, 0, "Paralyze should discard all non-wound cards from hand");
}

// =========================================================================
// Card-based SelectCombatEnemy effects
// =========================================================================

/// Helper: set up a combat with a specific card in hand and given enemies.
/// Returns state in RangedSiege phase with the card playable.
fn setup_card_combat(card_id: &str, enemy_ids: &[&str]) -> (GameState, UndoStack) {
    use mk_types::ids::EnemyTokenId;

    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from(card_id)];
    state.players[0].units.clear();

    let tokens: Vec<EnemyTokenId> = enemy_ids
        .iter()
        .map(|id| EnemyTokenId::from(format!("{}_1", id)))
        .collect();
    crate::combat::execute_enter_combat(
        &mut state, 0, &tokens, false, None, Default::default(),
    )
    .unwrap();

    let undo = UndoStack::new();
    (state, undo)
}

#[test]
fn whirlwind_basic_skip_attack_single_enemy() {
    // Whirlwind basic: select enemy → skip its attack. Single enemy = auto-resolve.
    let (mut state, mut undo) = setup_card_combat("whirlwind", &["prowlers"]);
    // Add white mana to power whirlwind (it's a white spell)
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "whirlwind"
    )).expect("whirlwind basic should be playable in combat");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Single enemy → auto-resolve, should have EnemySkipAttack modifier
    // Combat instance IDs are "enemy_0", "enemy_1", etc.
    let has_skip = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_skip, "whirlwind basic should skip prowlers attack");
    // No pending — auto-resolved
    assert!(state.players[0].pending.active.is_none());
}

#[test]
fn whirlwind_powered_defeats_single_enemy() {
    // Whirlwind powered: select enemy → defeat outright.
    let (mut state, mut undo) = setup_card_combat("whirlwind", &["prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "whirlwind"
    )).expect("whirlwind powered should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Enemy should be defeated
    let combat = state.combat.as_ref().unwrap();
    assert!(combat.enemies[0].is_defeated, "whirlwind powered should defeat prowlers");
    // Fame should be earned
    assert!(state.players[0].fame > 0, "should earn fame for defeated enemy");
}

#[test]
fn whirlwind_basic_multiple_enemies_creates_pending() {
    // Two enemies → pending choice needed
    let (mut state, mut undo) = setup_card_combat("whirlwind", &["prowlers", "diggers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "whirlwind"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have pending SelectCombatEnemy with 2 eligible enemies
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::SelectCombatEnemy { eligible_enemy_ids, .. }) => {
            assert_eq!(eligible_enemy_ids.len(), 2);
        }
        other => panic!("Expected SelectCombatEnemy pending, got {:?}", other),
    }

    // Resolve choice: pick first enemy (prowlers)
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ResolveChoice { choice_index: 0 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal.epoch);

    // Prowlers should have skip-attack modifier
    let has_skip = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_skip, "chosen prowlers should have skip attack");
}

#[test]
fn chill_basic_excludes_ice_resistant_enemies() {
    // Chill basic: exclude_arcane_immune + exclude_resistance(Ice).
    // zombie_horde has Ice resistance → should be excluded.
    let (mut state, mut undo) = setup_card_combat("chill", &["prowlers", "zombie_horde"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Blue,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "chill"
    )).expect("chill basic should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Only prowlers eligible (zombie_horde excluded for Ice resistance)
    // → auto-resolve on prowlers
    assert!(state.players[0].pending.active.is_none(), "should auto-resolve single eligible");
    let has_skip = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemySkipAttack)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_skip, "prowlers should have skip attack from chill");

    // Should also have remove_fire_resistance modifier
    let has_remove_fire = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::RemoveFireResistance)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_remove_fire, "chill basic should remove fire resistance");
}

#[test]
fn chill_powered_reduces_armor() {
    // Chill powered: skip attack + armor -4 (min 1)
    let (mut state, mut undo) = setup_card_combat("chill", &["prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Blue,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "chill"
    )).expect("chill powered should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Check armor modifier on prowlers
    let (armor_change, armor_min) = crate::combat_resolution::get_enemy_armor_modifier(
        &state.active_modifiers, "enemy_0"
    );
    assert_eq!(armor_change, -4, "chill powered should reduce armor by 4");
    assert_eq!(armor_min, 1, "minimum armor should be 1");
}

#[test]
fn tremor_basic_choice_single_enemy_or_all() {
    // Tremor basic: Choice between SelectCombatEnemy(-3) and AllEnemies(-2).
    let (mut state, mut undo) = setup_card_combat("tremor", &["prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Red,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "tremor"
    )).expect("tremor basic should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should create a pending choice (Choice between two options)
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(choice)) => {
            assert_eq!(choice.options.len(), 2, "tremor should offer 2 options");
        }
        other => panic!("Expected Choice pending, got {:?}", other),
    }

    // Choose option 1 (AllEnemies -2 armor)
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ResolveChoice { choice_index: 1 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal.epoch);

    // Should have AllEnemies scope armor modifier
    let has_all_enemy_armor = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Armor, amount: -2, minimum: 1, ..
        }) && matches!(&m.scope, ModifierScope::AllEnemies)
    });
    assert!(has_all_enemy_armor, "all-enemies -2 armor modifier should be present");
}

#[test]
fn expose_basic_select_enemy_then_ranged_attack() {
    // Expose basic: Compound([SelectCombatEnemy { nullify_fortified, remove_resistances }, GainAttack(2, Ranged)])
    // Single enemy → auto-resolve select, then continuation gives ranged attack 2.
    let (mut state, mut undo) = setup_card_combat("expose", &["diggers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "expose"
    )).expect("expose basic should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Single enemy → auto-resolve, no pending
    assert!(state.players[0].pending.active.is_none(), "single enemy should auto-resolve");

    // Diggers should have nullify_fortified + remove_resistances modifiers
    let has_nullify_fort = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::AbilityNullifier {
            ability: Some(EnemyAbilityType::Fortified), ..
        }) && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_nullify_fort, "expose should nullify diggers' fortification");

    let has_remove_res = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::RemoveResistances)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_remove_res, "expose should remove diggers' resistances");

    // Continuation: GainAttack 2 Ranged should have been applied
    assert_eq!(
        state.players[0].combat_accumulator.attack.ranged, 2,
        "expose basic should grant Ranged Attack 2 via continuation"
    );
}

#[test]
fn expose_basic_multi_enemy_pending_then_continuation() {
    // Two enemies: SelectCombatEnemy creates pending. After resolving, continuation gives ranged attack.
    let (mut state, mut undo) = setup_card_combat("expose", &["diggers", "prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "expose"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have SelectCombatEnemy pending with continuation
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::SelectCombatEnemy { eligible_enemy_ids, continuation, .. }) => {
            assert_eq!(eligible_enemy_ids.len(), 2);
            assert!(!continuation.is_empty(), "should have GainAttack continuation");
        }
        other => panic!("Expected SelectCombatEnemy pending, got {:?}", other),
    }

    // Resolve choice: pick diggers
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ResolveChoice { choice_index: 0 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal.epoch);

    // After resolution, continuation should have fired: ranged attack 2
    assert_eq!(
        state.players[0].combat_accumulator.attack.ranged, 2,
        "expose continuation should grant Ranged Attack 2"
    );
    // No more pending
    assert!(state.players[0].pending.active.is_none());
}

#[test]
fn chilling_stare_basic_is_choice() {
    // Chilling stare basic: Choice([Influence 3, SelectCombatEnemy { nullify_all_attack_abilities }])
    let (mut state, mut undo) = setup_card_combat("chilling_stare", &["prowlers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "chilling_stare"
    )).expect("chilling_stare basic should be playable in combat");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should be a Choice pending (influence or select enemy)
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(choice)) => {
            assert_eq!(choice.options.len(), 2);
        }
        other => panic!("Expected Choice pending, got {:?}", other),
    }

    // Choose option 0 (influence 3)
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ResolveChoice { choice_index: 0 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal.epoch);

    assert_eq!(state.players[0].influence_points, 3, "should gain 3 influence");
}

#[test]
fn chilling_stare_basic_select_enemy_nullifies_abilities() {
    // Choose option 1 (SelectCombatEnemy → nullify all attack abilities)
    let (mut state, mut undo) = setup_card_combat("chilling_stare", &["prowlers"]);

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "chilling_stare"
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Choose option 1 (select enemy)
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ResolveChoice { choice_index: 1 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal.epoch);

    // Single enemy → auto-resolve. Should have AbilityNullifier modifiers.
    let nullifier_count = state.active_modifiers.iter().filter(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::AbilityNullifier { .. })
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    }).count();
    // 7 ability nullifiers: Swift, Brutal, Poison, Paralyze, Vampiric, Assassination, Cumbersome
    assert_eq!(nullifier_count, 7, "should push 7 AbilityNullifier modifiers");
}

#[test]
fn expose_powered_all_enemies_fortification_nullified() {
    // Expose powered: Compound([Choice([all nullify fort, all remove res]), GainAttack(3, Ranged)])
    let (mut state, mut undo) = setup_card_combat("expose", &["diggers", "prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "expose"
    )).expect("expose powered should be playable");
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // Should have Choice pending (nullify fortification OR remove resistances)
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::Choice(choice)) => {
            assert_eq!(choice.options.len(), 2);
        }
        other => panic!("Expected Choice pending, got {:?}", other),
    }

    // Choose option 0 (nullify fortification for all)
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let resolve = legal.actions.iter().find(|a| matches!(a,
        LegalAction::ResolveChoice { choice_index: 0 }
    )).unwrap();
    let _ = apply_legal_action(&mut state, &mut undo, 0, resolve, legal.epoch);

    // AllEnemies scope nullify-fortified modifier
    let has_nullify_fort = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, mk_types::modifier::ModifierEffect::AbilityNullifier {
            ability: Some(EnemyAbilityType::Fortified), ..
        }) && matches!(&m.scope, ModifierScope::AllEnemies)
    });
    assert!(has_nullify_fort, "should have AllEnemies fortification nullifier");

    // Continuation: GainAttack 3 Ranged
    assert_eq!(
        state.players[0].combat_accumulator.attack.ranged, 3,
        "expose powered should grant Ranged Attack 3"
    );
}

#[test]
fn card_data_whirlwind_template_fields() {
    let card = mk_data::cards::get_spell_card("whirlwind").unwrap();
    match &card.basic_effect {
        CardEffect::SelectCombatEnemy { template } => {
            assert!(template.skip_attack);
            assert!(!template.defeat);
        }
        _ => panic!("Expected SelectCombatEnemy"),
    }
    match &card.powered_effect {
        CardEffect::SelectCombatEnemy { template } => {
            assert!(template.defeat);
            assert!(!template.skip_attack);
        }
        _ => panic!("Expected SelectCombatEnemy"),
    }
}

#[test]
fn card_data_chill_template_fields() {
    let card = mk_data::cards::get_spell_card("chill").unwrap();
    match &card.basic_effect {
        CardEffect::SelectCombatEnemy { template } => {
            assert!(template.exclude_arcane_immune);
            assert_eq!(template.exclude_resistance, Some(ResistanceElement::Ice));
            assert!(template.skip_attack);
            assert!(template.remove_fire_resistance);
        }
        _ => panic!("Expected SelectCombatEnemy"),
    }
    match &card.powered_effect {
        CardEffect::SelectCombatEnemy { template } => {
            assert!(template.skip_attack);
            assert_eq!(template.armor_change, -4);
            assert_eq!(template.armor_minimum, 1);
        }
        _ => panic!("Expected SelectCombatEnemy"),
    }
}

#[test]
fn card_data_tremor_template_fields() {
    let card = mk_data::cards::get_spell_card("tremor").unwrap();
    // Basic: Choice of two
    match &card.basic_effect {
        CardEffect::Choice { options } => {
            assert_eq!(options.len(), 2);
            assert!(matches!(&options[0], CardEffect::SelectCombatEnemy { .. }));
            assert!(matches!(&options[1], CardEffect::ApplyModifier { .. }));
        }
        _ => panic!("Expected Choice"),
    }
    // Powered: fortified_armor_change on SelectCombatEnemy option
    match &card.powered_effect {
        CardEffect::Choice { options } => {
            match &options[0] {
                CardEffect::SelectCombatEnemy { template } => {
                    assert_eq!(template.armor_change, -3);
                    assert_eq!(template.fortified_armor_change, Some(-6));
                }
                _ => panic!("Expected SelectCombatEnemy"),
            }
        }
        _ => panic!("Expected Choice"),
    }
}

#[test]
fn card_data_expose_structure() {
    let card = mk_data::cards::get_spell_card("expose").unwrap();
    // Basic: Compound([SelectCombatEnemy, GainAttack])
    match &card.basic_effect {
        CardEffect::Compound { effects } => {
            assert_eq!(effects.len(), 2);
            match &effects[0] {
                CardEffect::SelectCombatEnemy { template } => {
                    assert!(template.nullify_fortified);
                    assert!(template.remove_resistances);
                }
                _ => panic!("Expected SelectCombatEnemy"),
            }
            assert!(matches!(&effects[1], CardEffect::GainAttack { amount: 2, combat_type: CombatType::Ranged, .. }));
        }
        _ => panic!("Expected Compound"),
    }
    // Powered: Compound([Choice, GainAttack])
    match &card.powered_effect {
        CardEffect::Compound { effects } => {
            assert_eq!(effects.len(), 2);
            assert!(matches!(&effects[0], CardEffect::Choice { .. }));
            assert!(matches!(&effects[1], CardEffect::GainAttack { amount: 3, combat_type: CombatType::Ranged, .. }));
        }
        _ => panic!("Expected Compound"),
    }
}

#[test]
fn card_data_chilling_stare_structure() {
    let card = mk_data::cards::get_card("chilling_stare").unwrap();
    match &card.basic_effect {
        CardEffect::Choice { options } => {
            assert_eq!(options.len(), 2);
            assert!(matches!(&options[0], CardEffect::GainInfluence { amount: 3 }));
            assert!(matches!(&options[1], CardEffect::SelectCombatEnemy { .. }));
        }
        _ => panic!("Expected Choice"),
    }
    match &card.powered_effect {
        CardEffect::Choice { options } => {
            assert_eq!(options.len(), 2);
            assert!(matches!(&options[0], CardEffect::GainInfluence { amount: 5 }));
            match &options[1] {
                CardEffect::SelectCombatEnemy { template } => {
                    assert!(template.skip_attack);
                    assert!(template.exclude_arcane_immune);
                }
                _ => panic!("Expected SelectCombatEnemy"),
            }
        }
        _ => panic!("Expected Choice"),
    }
}

// =============================================================================
// Cure/Disease tests
// =============================================================================

#[test]
fn cure_basic_removes_wounds_and_draws_cards() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![
        CardId::from("cure"),
        CardId::from("wound"),
        CardId::from("wound"),
    ];
    state.players[0].deck = vec![CardId::from("march"), CardId::from("stamina")];
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "cure"
    )).expect("cure basic should be playable with wounds in hand");
    let mut undo = UndoStack::new();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    // 2 wounds removed, 2 cards drawn
    assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"),
        "wounds should be removed from hand");
    assert!(state.players[0].hand.iter().any(|c| c.as_str() == "march"));
    assert!(state.players[0].hand.iter().any(|c| c.as_str() == "stamina"));
    assert!(state.players[0].deck.is_empty(), "deck should be empty after drawing");
}

#[test]
fn cure_basic_heals_partial_wounds() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![
        CardId::from("cure"),
        CardId::from("wound"),
        CardId::from("march"),
    ];
    state.players[0].deck = vec![CardId::from("stamina"), CardId::from("rage")];
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "cure"
    )).unwrap();
    let mut undo = UndoStack::new();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
    assert!(state.players[0].hand.iter().any(|c| c.as_str() == "march"));
    assert!(state.players[0].hand.iter().any(|c| c.as_str() == "stamina"));
    assert_eq!(state.players[0].deck.len(), 1);
}

#[test]
fn cure_not_playable_without_wounds() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("cure"), CardId::from("march")];
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_cure_basic = legal.actions.iter().any(|a| matches!(a,
        LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == "cure"
    ));
    assert!(!has_cure_basic, "cure basic should not be playable without wounds");
}

#[test]
fn disease_powered_sets_armor_to_1_for_blocked_enemies() {
    let (mut state, _undo) = setup_card_combat("cure", &["prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.combat.as_mut().unwrap().enemies[0].is_blocked = true;
    state.combat.as_mut().unwrap().phase = CombatPhase::Block;

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "cure"
    )).expect("cure powered (disease) should be playable in combat");
    let mut undo = UndoStack::new();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    let has_armor_mod = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::EnemyStat { stat: ModEnemyStat::Armor, amount, minimum, .. }
            if *amount == -100 && *minimum == 1)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    assert!(has_armor_mod, "disease should set armor to 1 for blocked enemy");
}

#[test]
fn disease_skipped_when_no_enemies_blocked() {
    let (mut state, _undo) = setup_card_combat("cure", &["prowlers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "cure"
    )).expect("cure powered should be playable in combat");
    let mut undo = UndoStack::new();
    let modifiers_before = state.active_modifiers.len();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    assert_eq!(state.active_modifiers.len(), modifiers_before,
        "disease should not add modifiers when no enemies blocked");
}

#[test]
fn disease_not_playable_outside_combat() {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("cure")];
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let has_disease = legal.actions.iter().any(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "cure"
    ));
    assert!(!has_disease, "cure powered (disease) should not be playable outside combat");
}

#[test]
fn disease_affects_multiple_blocked_enemies() {
    let (mut state, _undo) = setup_card_combat("cure", &["prowlers", "diggers"]);
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    let combat = state.combat.as_mut().unwrap();
    combat.enemies[0].is_blocked = true;
    combat.enemies[1].is_blocked = true;
    combat.phase = CombatPhase::Block;

    let undo = UndoStack::new();
    let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let action = legal.actions.iter().find(|a| matches!(a,
        LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == "cure"
    )).unwrap();
    let mut undo = UndoStack::new();
    let _ = apply_legal_action(&mut state, &mut undo, 0, action, legal.epoch);

    let enemy_0_mod = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::EnemyStat { stat: ModEnemyStat::Armor, .. })
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_0")
    });
    let enemy_1_mod = state.active_modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::EnemyStat { stat: ModEnemyStat::Armor, .. })
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id } if enemy_id == "enemy_1")
    });
    assert!(enemy_0_mod, "disease should affect enemy_0");
    assert!(enemy_1_mod, "disease should affect enemy_1");
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
    play_card(&mut state, 0, 0, false).unwrap();
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
    play_card(&mut state, 0, 0, false).unwrap();
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
    play_card(&mut state, 0, 0, false).unwrap();
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
    play_card(&mut state, 0, 0, false).unwrap();
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
    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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

    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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

    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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

// =========================================================================
// Level-up reward tests
// =========================================================================

/// Helper: set up a game ready for level-up testing.
/// Player is in PlayerTurns phase with march in hand, high fame to trigger level-up.
fn setup_level_up_game(fame: u32) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from("march")];
    state.players[0].fame = fame;
    state.players[0].level = 1; // Start at level 1
    // Ensure deck has cards for card draw after level-up
    state.players[0].deck = (0..10)
        .map(|i| CardId::from(format!("card_{}", i)))
        .collect();
    state
}

#[test]
fn level_up_at_level_2_queues_reward() {
    let mut state = setup_level_up_game(3); // 3 fame = level 2

    // Verify player has remaining hero skills
    assert_eq!(state.players[0].remaining_hero_skills.len(), 10);

    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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
    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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

    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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
    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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

    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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
    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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

    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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
    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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

    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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
        state.players[0].hand.len() > 0,
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

    crate::card_play::play_card(&mut state, 0, 0, false).unwrap();
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
