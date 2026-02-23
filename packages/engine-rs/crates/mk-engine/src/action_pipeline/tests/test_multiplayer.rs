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

    // Empty deck (rulebook: can only announce if deed deck is empty)
    state.players[first_player_idx].deck.clear();
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

    // Deck must be empty for AnnounceEndOfRound to be available
    state.players[first_player_idx].deck.clear();

    // AnnounceEndOfRound should be in legal actions for multiplayer
    let legal = enumerate_legal_actions_with_undo(&state, first_player_idx, &undo);
    let has_announce = legal.actions.iter().any(|a| matches!(a, LegalAction::AnnounceEndOfRound));
    assert!(has_announce, "AnnounceEndOfRound should be available in 2P game with empty deck");
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

// =========================================================================
// Step 1: AnnounceEndOfRound requires empty deck
// =========================================================================

#[test]
fn announce_requires_empty_deck() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    setup_player_turns(&mut state);

    let first_idx = first_player_idx(&state);

    // With non-empty deck, AnnounceEndOfRound should NOT be available
    assert!(!state.players[first_idx].deck.is_empty());
    let legal = enumerate_legal_actions_with_undo(&state, first_idx, &UndoStack::new());
    assert!(
        !legal.actions.iter().any(|a| matches!(a, LegalAction::AnnounceEndOfRound)),
        "AnnounceEndOfRound should NOT be available with non-empty deck"
    );

    // Empty deck → now available
    state.players[first_idx].deck.clear();
    let legal = enumerate_legal_actions_with_undo(&state, first_idx, &UndoStack::new());
    assert!(
        legal.actions.iter().any(|a| matches!(a, LegalAction::AnnounceEndOfRound)),
        "AnnounceEndOfRound should be available with empty deck"
    );
}

#[test]
fn announce_available_with_empty_deck_nonempty_hand() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    setup_player_turns(&mut state);

    let first_idx = first_player_idx(&state);
    state.players[first_idx].deck.clear();
    // Hand is non-empty (default starting hand)
    assert!(!state.players[first_idx].hand.is_empty());

    let legal = enumerate_legal_actions_with_undo(&state, first_idx, &UndoStack::new());
    assert!(
        legal.actions.iter().any(|a| matches!(a, LegalAction::AnnounceEndOfRound)),
        "AnnounceEndOfRound available with empty deck + non-empty hand"
    );
}

#[test]
fn must_announce_when_hand_and_deck_empty() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    setup_player_turns(&mut state);

    let first_idx = first_player_idx(&state);
    state.players[first_idx].hand.clear();
    state.players[first_idx].deck.clear();

    let legal = enumerate_legal_actions_with_undo(&state, first_idx, &UndoStack::new());
    // Should only have AnnounceEndOfRound (no other normal turn actions)
    assert!(
        legal.actions.iter().any(|a| matches!(a, LegalAction::AnnounceEndOfRound)),
        "Must have AnnounceEndOfRound when hand+deck empty"
    );
    // Should not have normal turn actions like card play, move, etc.
    assert!(
        !legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardBasic { .. })),
        "Should not have card play when forced to announce"
    );
    assert!(
        !legal.actions.iter().any(|a| matches!(a, LegalAction::DeclareRest)),
        "Should not have DeclareRest when forced to announce"
    );
}

/// Helper: select tactics so both players are in PlayerTurns.
fn setup_player_turns(state: &mut GameState) {
    let mut undo = UndoStack::new();
    let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        state, &mut undo, p1_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("early_bird") },
        epoch,
    ).unwrap();
    let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(
        state, &mut undo, p0_idx,
        &LegalAction::SelectTactic { tactic_id: TacticId::from("planning") },
        epoch,
    ).unwrap();
}

/// Helper: get the player index of whoever goes first in turn order.
fn first_player_idx(state: &GameState) -> usize {
    let first_id = &state.turn_order[0];
    state.players.iter().position(|p| &p.id == first_id).unwrap()
}

// =========================================================================
// Step 5: Flipped Round-Order Token Skips Turn
// =========================================================================

#[test]
fn flipped_token_auto_skips_turn_and_clears_flag() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();
    setup_player_turns(&mut state);

    let first_idx = first_player_idx(&state);
    let second_idx = second_player_idx(&state);

    // Flip second player's round order token
    state.players[second_idx]
        .flags
        .insert(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED);

    // End first player's turn
    state.players[first_idx]
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, first_idx,
        &LegalAction::EndTurn,
        epoch,
    ).unwrap();

    // Second player should have been skipped — turn goes back to first player
    let current_id = &state.turn_order[state.current_player_index as usize];
    assert_eq!(
        current_id.as_str(),
        state.players[first_idx].id.as_str(),
        "Flipped player should be skipped — turn wraps back to first player"
    );

    // Flag should be cleared
    assert!(
        !state.players[second_idx]
            .flags
            .contains(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED),
        "ROUND_ORDER_TOKEN_FLIPPED should be cleared after skip"
    );
}

#[test]
fn flipped_token_expires_interactive_skills() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();
    setup_player_turns(&mut state);

    let first_idx = first_player_idx(&state);
    let second_idx = second_player_idx(&state);
    let second_id = state.players[second_idx].id.clone();

    // Place an interactive skill modifier owned by second player
    use mk_types::modifier::*;
    use mk_types::ids::ModifierId;
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from("test_prayer"),
        effect: ModifierEffect::TerrainCost {
            terrain: TerrainOrAll::All,
            amount: -1,
            minimum: 1,
            replace_cost: None,
        },
        source: ModifierSource::Skill {
            skill_id: SkillId::from("norowas_prayer_of_weather"),
            player_id: second_id.clone(),
        },
        duration: ModifierDuration::Round,
        scope: ModifierScope::OtherPlayers,
        created_at_round: 1,
        created_by_player_id: second_id.clone(),
    });

    // Flip second player's token
    state.players[second_idx]
        .flags
        .insert(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED);

    // End first player's turn
    state.players[first_idx]
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, first_idx,
        &LegalAction::EndTurn,
        epoch,
    ).unwrap();

    // Interactive skill modifiers owned by second player should be expired
    let has_skill_mod = state.active_modifiers.iter().any(|m| {
        matches!(
            &m.source,
            ModifierSource::Skill { player_id, .. }
            if *player_id == second_id
        ) && matches!(m.duration, ModifierDuration::Round)
            && matches!(m.scope, ModifierScope::OtherPlayers)
    });
    assert!(
        !has_skill_mod,
        "Interactive skill modifiers should be expired when turn is skipped"
    );
}

#[test]
fn flipped_token_removes_from_final_turn_list() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();
    setup_player_turns(&mut state);

    let first_idx = first_player_idx(&state);
    let second_idx = second_player_idx(&state);
    let first_id = state.players[first_idx].id.clone();
    let second_id = state.players[second_idx].id.clone();

    // Announce end of round, second player has final turn
    state.players[first_idx].deck.clear();
    state.end_of_round_announced_by = Some(first_id.clone());
    state.players_with_final_turn = vec![second_id.clone()];

    // Flip second player's token
    state.players[second_idx]
        .flags
        .insert(PlayerFlags::ROUND_ORDER_TOKEN_FLIPPED);

    // End first player's turn → second player should be skipped
    state.players[first_idx]
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, first_idx,
        &LegalAction::EndTurn,
        epoch,
    ).unwrap();

    // Second player should have been removed from final turn list
    assert!(
        !state.players_with_final_turn.contains(&second_id),
        "Skipped player should be removed from final turn list"
    );
}

/// Helper: get the player index of whoever goes second in turn order.
fn second_player_idx(state: &GameState) -> usize {
    let second_id = &state.turn_order[1];
    state.players.iter().position(|p| &p.id == second_id).unwrap()
}

// =========================================================================
// Other Player's Keep Assault (Owner Absent)
// =========================================================================

use arrayvec::ArrayVec;
use mk_types::hex::HexCoord;

/// Helper: Set up a 2P game in PlayerTurns with player 0 at (0,0) and a
/// conquered Keep owned by player 1 at (1,0). No enemies pre-placed on Keep hex.
fn setup_other_player_keep(seed: u32) -> GameState {
    let mut state = crate::setup::create_two_player_game(seed, Hero::Arythea, Hero::Tovak);
    setup_player_turns(&mut state);

    let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
    let p1_id = state.players.iter().find(|p| p.id.as_str() == "player_1").unwrap().id.clone();

    // Ensure player 0 is the active player and has position (0,0)
    state.current_player_index = state.turn_order.iter().position(|id| id.as_str() == "player_0").unwrap() as u32;
    state.players[p0_idx].position = Some(HexCoord::new(0, 0));
    state.players[p0_idx].move_points = 10;

    // Place a conquered Keep owned by player 1 on hex (1,0)
    let keep_coord = HexCoord::new(1, 0);
    let hex = state.map.hexes.entry(keep_coord.key().to_string()).or_insert_with(|| HexState {
        coord: keep_coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: None,
        enemies: ArrayVec::new(),
        rampaging_enemies: ArrayVec::new(),
        shield_tokens: Vec::new(),
        ruins_token: None,
    });
    hex.site = Some(Site {
        site_type: SiteType::Keep,
        owner: Some(p1_id.clone()),
        is_conquered: true,
        is_burned: false,
        city_color: None,
        mine_color: None,
        deep_mine_colors: None,
    });
    hex.shield_tokens = vec![p1_id];
    hex.enemies.clear();

    state
}

#[test]
fn assault_other_player_keep_draws_grey_enemy() {
    let mut state = setup_other_player_keep(42);

    crate::movement::execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();

    // Combat should be entered
    assert!(state.combat.is_some(), "Moving to other player's Keep should trigger combat");
    let combat = state.combat.as_ref().unwrap();
    assert_eq!(combat.combat_context, CombatContext::OtherPlayerKeep);
    assert_eq!(combat.enemies.len(), 1, "Should have exactly 1 grey enemy drawn");
    assert!(combat.is_at_fortified_site, "Combat should be fortified");
}

#[test]
fn assault_other_player_keep_rep_minus_1() {
    let mut state = setup_other_player_keep(42);
    let initial_rep = state.players[0].reputation;

    crate::movement::execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();

    let p0_idx = state.players.iter().position(|p| p.id.as_str() == "player_0").unwrap();
    assert_eq!(
        state.players[p0_idx].reputation,
        initial_rep - 1,
        "Assault on other player's Keep should apply -1 reputation"
    );
}

#[test]
fn assault_other_player_keep_half_fame_on_victory() {
    let mut state = setup_other_player_keep(42);

    crate::movement::execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
    assert!(state.combat.is_some());

    // Get the enemy's fame value for verification
    let enemy_id = state.combat.as_ref().unwrap().enemies[0].enemy_id.clone();
    let enemy_def = mk_data::enemies::get_enemy(enemy_id.as_str()).unwrap();
    let full_fame = enemy_def.fame;

    // Simulate victory: mark all enemies as defeated and record fame
    let fame_before = state.players[0].fame;
    {
        let combat = state.combat.as_mut().unwrap();
        for enemy in &mut combat.enemies {
            enemy.is_defeated = true;
        }
        combat.fame_gained = full_fame;
    }
    state.players[0].fame += full_fame;

    // Call end_combat directly
    super::combat_end::end_combat(&mut state, 0);

    assert!(state.combat.is_none(), "Combat should have ended");

    // Fame should be half (rounded up)
    let expected_fame = (full_fame + 1) / 2;
    let actual_fame = state.players[0].fame - fame_before;
    assert_eq!(
        actual_fame, expected_fame,
        "Player should receive half fame (rounded up): full={}, expected={}, got={}",
        full_fame, expected_fame, actual_fame
    );
}

#[test]
fn assault_other_player_keep_shield_token_replaced() {
    let mut state = setup_other_player_keep(42);

    crate::movement::execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
    assert!(state.combat.is_some());

    // Simulate victory: mark all enemies as defeated
    {
        let combat = state.combat.as_mut().unwrap();
        for enemy in &mut combat.enemies {
            enemy.is_defeated = true;
        }
    }

    super::combat_end::end_combat(&mut state, 0);

    // Check shield tokens
    let hex = state.map.hexes.get(&HexCoord::new(1, 0).key()).unwrap();
    assert_eq!(hex.shield_tokens.len(), 1, "Should have exactly 1 shield token");
    assert_eq!(
        hex.shield_tokens[0].as_str(), "player_0",
        "Shield token should belong to attacker"
    );
}

#[test]
fn assault_other_player_keep_ownership_transferred() {
    let mut state = setup_other_player_keep(42);

    crate::movement::execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
    assert!(state.combat.is_some());

    // Simulate victory: mark all enemies as defeated
    {
        let combat = state.combat.as_mut().unwrap();
        for enemy in &mut combat.enemies {
            enemy.is_defeated = true;
        }
    }

    super::combat_end::end_combat(&mut state, 0);

    let hex = state.map.hexes.get(&HexCoord::new(1, 0).key()).unwrap();
    let site = hex.site.as_ref().unwrap();
    assert_eq!(
        site.owner.as_ref().unwrap().as_str(), "player_0",
        "Keep ownership should transfer to attacker"
    );
    assert!(site.is_conquered, "Keep should remain conquered");
}

#[test]
fn assault_own_keep_no_assault() {
    let mut state = setup_other_player_keep(42);

    // Change the Keep owner to player_0 (moving player)
    let p0_id = state.players.iter().find(|p| p.id.as_str() == "player_0").unwrap().id.clone();
    let hex = state.map.hexes.get_mut(&HexCoord::new(1, 0).key()).unwrap();
    hex.site.as_mut().unwrap().owner = Some(p0_id.clone());
    hex.shield_tokens = vec![p0_id];

    crate::movement::execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();

    // No combat should trigger for own Keep
    assert!(state.combat.is_none(), "Moving to own conquered Keep should NOT trigger assault");
}

#[test]
fn assault_other_player_keep_retreat_discards_enemy() {
    let mut state = setup_other_player_keep(42);

    crate::movement::execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
    assert!(state.combat.is_some());

    let combat = state.combat.as_ref().unwrap();
    assert!(combat.discard_enemies_on_failure, "discard_enemies_on_failure should be set");

    // Verify grey enemy is on the hex
    let hex = state.map.hexes.get(&HexCoord::new(1, 0).key()).unwrap();
    assert_eq!(hex.enemies.len(), 1, "Hex should have the drawn grey enemy");
    assert_eq!(hex.enemies[0].color, EnemyColor::Gray);
}

#[test]
fn assault_other_player_keep_enemy_is_fortified() {
    let mut state = setup_other_player_keep(42);

    crate::movement::execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();

    let combat = state.combat.as_ref().unwrap();
    assert!(combat.is_at_fortified_site, "Keep assault should be fortified");
    assert!(combat.assault_origin.is_some(), "Should have assault origin");
}

#[test]
fn pvp_blocked_when_owner_present() {
    let mut state = setup_other_player_keep(42);

    // Place player_1 (Keep owner) on the Keep hex
    let p1_idx = state.players.iter().position(|p| p.id.as_str() == "player_1").unwrap();
    state.players[p1_idx].position = Some(HexCoord::new(1, 0));

    let result = crate::movement::execute_move(&mut state, 0, HexCoord::new(1, 0));

    assert!(
        matches!(result, Err(crate::movement::MoveError::PvPNotSupported)),
        "Should return PvPNotSupported when Keep owner is present on hex"
    );
}

// =========================================================================
// Step 4: ForfeitTurn
// =========================================================================

#[test]
fn must_forfeit_when_round_announced_by_other_and_no_cards() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    setup_player_turns(&mut state);

    let first_idx = first_player_idx(&state);
    let first_id = state.players[first_idx].id.clone();
    let second_idx = second_player_idx(&state);

    // Player 1 (first) announces end of round
    state.players[first_idx].deck.clear();
    state.end_of_round_announced_by = Some(first_id.clone());
    state.players_with_final_turn = vec![state.players[second_idx].id.clone()];

    // Switch to player 2's turn — empty hand+deck
    state.current_player_index = state.turn_order.iter().position(|id| *id == state.players[second_idx].id).unwrap() as u32;
    state.players[second_idx].hand.clear();
    state.players[second_idx].deck.clear();

    let legal = enumerate_legal_actions_with_undo(&state, second_idx, &UndoStack::new());
    assert!(
        legal.actions.iter().any(|a| matches!(a, LegalAction::ForfeitTurn)),
        "Must have ForfeitTurn when round announced by other + no cards"
    );
    // Should not have normal turn options
    assert!(
        !legal.actions.iter().any(|a| matches!(a, LegalAction::PlayCardBasic { .. })),
        "Should not have card play when forfeiting"
    );
    assert!(
        !legal.actions.iter().any(|a| matches!(a, LegalAction::AnnounceEndOfRound)),
        "Should not have AnnounceEndOfRound when round already announced"
    );
}

#[test]
fn forfeit_advances_turn() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();
    setup_player_turns(&mut state);

    let first_idx = first_player_idx(&state);
    let first_id = state.players[first_idx].id.clone();
    let second_idx = second_player_idx(&state);

    // First player announces end of round
    state.players[first_idx].deck.clear();
    state.end_of_round_announced_by = Some(first_id);
    state.players_with_final_turn = vec![state.players[second_idx].id.clone()];

    // Switch to second player's turn, empty hand+deck
    state.current_player_index = state.turn_order.iter().position(|id| *id == state.players[second_idx].id).unwrap() as u32;
    state.players[second_idx].hand.clear();
    state.players[second_idx].deck.clear();

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, second_idx,
        &LegalAction::ForfeitTurn,
        epoch,
    ).unwrap();

    // Forfeiting should have ended the round (since second player was the only one in final turn list)
    // The round should have ended (check round advanced or game ended)
    // After forfeit, player is removed from final turn list
    assert!(state.players_with_final_turn.is_empty() || state.end_of_round_announced_by.is_none());
}

#[test]
fn forfeit_does_not_create_pending_state() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();
    setup_player_turns(&mut state);

    let first_idx = first_player_idx(&state);
    let first_id = state.players[first_idx].id.clone();
    let second_idx = second_player_idx(&state);
    let second_id = state.players[second_idx].id.clone();

    // First player announces. Add both to final turn list so round doesn't end immediately.
    state.players[first_idx].deck.clear();
    state.end_of_round_announced_by = Some(first_id.clone());
    state.players_with_final_turn = vec![first_id, second_id.clone()];

    // Switch to second player's turn, empty hand+deck
    state.current_player_index = state.turn_order.iter().position(|id| *id == second_id).unwrap() as u32;
    state.players[second_idx].hand.clear();
    state.players[second_idx].deck.clear();

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, second_idx,
        &LegalAction::ForfeitTurn,
        epoch,
    ).unwrap();

    // After forfeit, the player should have no pending state (no mine crystal, no glade, etc.)
    assert!(
        state.players[second_idx].pending.active.is_none(),
        "Forfeit should not create any pending state"
    );
}

#[test]
fn forfeit_removes_from_final_turn_list() {
    let mut state = crate::setup::create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    let mut undo = UndoStack::new();
    setup_player_turns(&mut state);

    let first_idx = first_player_idx(&state);
    let first_id = state.players[first_idx].id.clone();
    let second_idx = second_player_idx(&state);
    let second_id = state.players[second_idx].id.clone();

    // First player announces. Add BOTH players to final turn list so round doesn't end immediately.
    state.players[first_idx].deck.clear();
    state.end_of_round_announced_by = Some(first_id.clone());
    state.players_with_final_turn = vec![first_id.clone(), second_id.clone()];

    // Switch to second player's turn (forfeit)
    state.current_player_index = state.turn_order.iter().position(|id| *id == second_id).unwrap() as u32;
    state.players[second_idx].hand.clear();
    state.players[second_idx].deck.clear();

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, second_idx,
        &LegalAction::ForfeitTurn,
        epoch,
    ).unwrap();

    // Second player should have been removed from final turn list
    assert!(
        !state.players_with_final_turn.contains(&second_id),
        "Forfeiting player should be removed from final turn list"
    );
}

