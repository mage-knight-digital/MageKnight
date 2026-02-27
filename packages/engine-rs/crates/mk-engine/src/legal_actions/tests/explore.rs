use super::*;

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
// Map shape exploration constraints
// =========================================================================

#[test]
fn explore_wedge_only_ne_e() {
    use mk_types::hex::HexDirection;

    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 10;
    // Place player at NE edge — can explore both NE and E directions
    state.players[0].position = Some(HexCoord::new(1, -1));
    // Clear existing tiles beyond starting tile
    state.map = crate::setup::place_starting_tile(TileId::StartingA);
    state.map.tile_deck.countryside = vec![
        TileId::Countryside1,
        TileId::Countryside2,
        TileId::Countryside3,
    ];
    // Regenerate tile slots for the new map
    let total = 1 + state.map.tile_deck.countryside.len() as u32;
    state.map.tile_slots = crate::setup::generate_tile_slots(state.scenario_config.map_shape, total);

    let legal = enumerate_legal_actions(&state, 0);
    let explore_dirs: Vec<HexDirection> = legal
        .actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Explore { direction } => Some(*direction),
            _ => None,
        })
        .collect();

    // Should only contain NE and/or E, never SE/SW/W/NW
    for dir in &explore_dirs {
        assert!(
            *dir == HexDirection::NE || *dir == HexDirection::E,
            "Wedge should only allow NE or E explores, got {:?}",
            dir
        );
    }
}

#[test]
fn coastline_blocks_core_tile() {
    use mk_types::hex::HexDirection;

    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 10;
    state.map = crate::setup::place_starting_tile(TileId::StartingA);

    // Empty countryside → next tile is core. Put only core tiles.
    state.map.tile_deck.countryside = Vec::new();
    state.map.tile_deck.core = vec![TileId::Countryside3]; // doesn't matter which tile

    // Generate wedge slots for a small map
    let total = 4u32; // enough for 2 rows
    state.map.tile_slots = crate::setup::generate_tile_slots(state.scenario_config.map_shape, total);

    // NE and E from origin are row 1 coastline slots (col 0 and col 1 = edges).
    // Place player at NE edge
    state.players[0].position = Some(HexCoord::new(1, -1));

    let legal = enumerate_legal_actions(&state, 0);
    let explore_dirs: Vec<HexDirection> = legal
        .actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Explore { direction } => Some(*direction),
            _ => None,
        })
        .collect();

    // Core tiles should not be placed on coastline
    assert!(
        explore_dirs.is_empty(),
        "Core tiles should not be placeable on coastline slots, but got {:?}",
        explore_dirs
    );
}

#[test]
fn coastline_allows_countryside() {
    use mk_types::hex::HexDirection;

    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 10;
    state.map = crate::setup::place_starting_tile(TileId::StartingA);

    // Countryside available → coastline is fine
    state.map.tile_deck.countryside = vec![TileId::Countryside1];
    state.map.tile_deck.core = Vec::new();

    let total = 4u32;
    state.map.tile_slots = crate::setup::generate_tile_slots(state.scenario_config.map_shape, total);

    // Place player at NE edge
    state.players[0].position = Some(HexCoord::new(1, -1));

    let legal = enumerate_legal_actions(&state, 0);
    let explore_dirs: Vec<HexDirection> = legal
        .actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Explore { direction } => Some(*direction),
            _ => None,
        })
        .collect();

    // Countryside tiles CAN be placed on coastline
    assert!(
        !explore_dirs.is_empty(),
        "Countryside tiles should be allowed on coastline slots"
    );
}
