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
fn explore_wedge_targets_valid() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 10;
    // Place player at NE edge — can explore both NE and E targets
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
    let explore_targets: Vec<HexCoord> = legal
        .actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Explore { target_center } => Some(*target_center),
            _ => None,
        })
        .collect();

    // Valid wedge targets from origin: NE=(1,-3), E=(3,-2)
    let valid_targets = vec![HexCoord::new(1, -3), HexCoord::new(3, -2)];
    for target in &explore_targets {
        assert!(
            valid_targets.contains(target),
            "Wedge should only allow valid slot targets, got ({},{})",
            target.q, target.r
        );
    }
}

#[test]
fn coastline_blocks_core_tile() {
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
    let explore_targets: Vec<HexCoord> = legal
        .actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Explore { target_center } => Some(*target_center),
            _ => None,
        })
        .collect();

    // Core tiles should not be placed on coastline
    assert!(
        explore_targets.is_empty(),
        "Core tiles should not be placeable on coastline slots, but got {:?}",
        explore_targets
    );
}

#[test]
fn coastline_allows_countryside() {
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
    let explore_targets: Vec<HexCoord> = legal
        .actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Explore { target_center } => Some(*target_center),
            _ => None,
        })
        .collect();

    // Countryside tiles CAN be placed on coastline
    assert!(
        !explore_targets.is_empty(),
        "Countryside tiles should be allowed on coastline slots"
    );
}

/// Regression: player at (7,-8) adjacent to unfilled slot (5,-8) but no placed
/// tile produces (5,-8) via NE/E direction.
///
/// The player explored along the east edge of the wedge, skipping slots
/// (4,-5) and (2,-6). Slot (5,-8) is physically adjacent to placed tiles
/// (7,-7) and (3,-9) — their hexes share edges — but the OLD code only
/// checked tile-center-to-tile-center directional relationships (NE/E), so
/// (5,-8) never appeared as a target.
///
/// Placed tiles: (0,0), (1,-3), (3,-2), (6,-4), (7,-7), (9,-6), (8,-10), (10,-9)
/// NOT placed: (4,-5), (2,-6) → no tile NE/E produces (5,-8)
/// Player hex (7,-8) is distance 1 from target hex (6,-8).
#[test]
fn explore_gap_slot_adjacent_to_player() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 3;
    state.map = crate::setup::place_starting_tile(TileId::StartingA);

    // Tiles placed along the east edge, then NE, skipping (4,-5) and (2,-6).
    let placed_centers = [
        (TileId::Countryside1, HexCoord::new(1, -3)),   // NE from origin (initial)
        (TileId::Countryside2, HexCoord::new(3, -2)),   // E from origin (initial)
        (TileId::Countryside3, HexCoord::new(6, -4)),   // E from (3,-2)
        (TileId::Countryside4, HexCoord::new(7, -7)),   // NE from (6,-4)
        (TileId::Countryside5, HexCoord::new(9, -6)),   // E from (6,-4)
        (TileId::Countryside6, HexCoord::new(8, -10)),  // NE from (7,-7)
        (TileId::Countryside7, HexCoord::new(10, -9)),  // E from (7,-7)
    ];

    for (tile_id, center) in &placed_centers {
        let tile_hexes = mk_data::tiles::get_tile_hexes(*tile_id).unwrap();
        crate::movement::place_tile_on_map(&mut state.map, *tile_id, *center, tile_hexes);
        state.map.tiles.push(mk_types::state::TilePlacement {
            tile_id: *tile_id,
            center_coord: *center,
            revealed: true,
        });
    }

    // Countryside tiles still available
    state.map.tile_deck.countryside = vec![TileId::Countryside8, TileId::Countryside9];

    // Generate wedge slots for recon_explore: 1 starting + 10 countryside + 1 city = 12
    let total_tiles = 12u32;
    state.map.tile_slots =
        crate::setup::generate_tile_slots(state.scenario_config.map_shape, total_tiles);

    // Mark all placed tiles as filled in the slot map
    let starting_key = HexCoord::new(0, 0).key();
    if let Some(slot) = state.map.tile_slots.get_mut(&starting_key) {
        slot.filled = true;
    }
    for (_, center) in &placed_centers {
        if let Some(slot) = state.map.tile_slots.get_mut(&center.key()) {
            slot.filled = true;
        }
    }

    // Player at (7,-8) — bottom-left hex of tile (7,-7).
    // Distance 1 from target hex (6,-8) which would be part of tile at (5,-8).
    state.players[0].position = Some(HexCoord::new(7, -8));

    let legal = enumerate_legal_actions(&state, 0);
    let explore_actions: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::Explore { .. }))
        .collect();

    // Slot (5,-8) is physically adjacent to placed tile (7,-7) — hex (6,-7) of
    // tile (7,-7) borders hex (6,-8) of target (5,-8). The explore should be offered.
    assert!(
        !explore_actions.is_empty(),
        "Player at (7,-8) should be able to explore slot (5,-8) — tile (7,-7) is \
         physically adjacent to it even though no placed tile directionally produces it"
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
