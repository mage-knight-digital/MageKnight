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
            LegalAction::Explore { direction, .. } => Some(*direction),
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
            LegalAction::Explore { direction, .. } => Some(*direction),
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
            LegalAction::Explore { direction, .. } => Some(*direction),
            _ => None,
        })
        .collect();

    // Countryside tiles CAN be placed on coastline
    assert!(
        !explore_dirs.is_empty(),
        "Countryside tiles should be allowed on coastline slots"
    );
}

/// Regression test: player on a hex that borders empty table space should be
/// able to explore even when the empty slot is only reachable from a *different*
/// placed tile's direction, not from the player's current tile.
///
/// Setup: starting tile at (0,0), countryside tile placed E at (3,-2).
/// Player at hex (4,-4) (SE corner of E tile). The NE slot at (2,-4) is
/// reachable as NE from starting tile (0,0) — but NOT from the player's
/// current tile (3,-2). The old code only checked the player's current tile
/// and would miss this valid explore.
#[test]
fn explore_from_adjacent_tile_edge() {
    use mk_types::hex::HexDirection;

    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 10;
    // Start with starting tile + one countryside tile placed E
    state.map = crate::setup::place_starting_tile(TileId::StartingA);
    let tile_hexes = mk_data::tiles::get_tile_hexes(TileId::Countryside1).unwrap();
    let e_center = HexCoord::new(3, -2);
    crate::movement::place_tile_on_map(&mut state.map, TileId::Countryside1, e_center, tile_hexes);
    state.map.tiles.push(mk_types::state::TilePlacement {
        tile_id: TileId::Countryside1,
        center_coord: e_center,
        revealed: true,
    });

    // More tiles available to explore
    state.map.tile_deck.countryside = vec![TileId::Countryside2, TileId::Countryside3];

    // Generate wedge slots for enough tiles
    let total = 1 + 1 + state.map.tile_deck.countryside.len() as u32;
    state.map.tile_slots =
        crate::setup::generate_tile_slots(state.scenario_config.map_shape, total);
    // Mark the E slot as filled since we already placed a tile there
    if let Some(slot) = state.map.tile_slots.get_mut(&e_center.key()) {
        slot.filled = true;
    }

    // Place player at (4,-4) — a hex on the E tile that borders empty space
    // where the NE slot (2,-4) would go. This slot is NE from the starting
    // tile (0,0), but NOT reachable as any direction from tile (3,-2).
    state.players[0].position = Some(HexCoord::new(4, -4));

    let legal = enumerate_legal_actions(&state, 0);
    let explore_actions: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::Explore { .. }))
        .collect();

    assert!(
        !explore_actions.is_empty(),
        "Player at (4,-4) should be able to explore — they border the NE slot at (2,-4) \
         which is reachable as NE from the starting tile (0,0)"
    );
}

