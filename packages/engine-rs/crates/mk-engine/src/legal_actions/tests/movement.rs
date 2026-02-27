use super::*;

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
