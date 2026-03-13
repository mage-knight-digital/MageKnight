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

/// Core tiles must be placed adjacent to at least 2 existing tiles.
/// A slot that is only adjacent to 1 tile should not be offered for core tile exploration.
#[test]
fn core_tile_requires_two_adjacent_tiles() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 10;
    state.map = crate::setup::place_starting_tile(TileId::StartingA);

    // Place a chain of countryside tiles where each new tile extends from the last,
    // creating a long arm where the tip is only adjacent to 1 tile.
    let placed_centers = [
        (TileId::Countryside1, HexCoord::new(1, -3)),
        (TileId::Countryside2, HexCoord::new(3, -2)),
        (TileId::Countryside3, HexCoord::new(4, -5)),
        (TileId::Countryside4, HexCoord::new(6, -4)),
        (TileId::Countryside5, HexCoord::new(7, -7)),
        (TileId::Countryside6, HexCoord::new(5, -8)),
        (TileId::Countryside7, HexCoord::new(2, -6)),
        (TileId::Countryside8, HexCoord::new(3, -9)),
        // core_1 placed adjacent to tiles (7,-7) and (5,-8) — 2 adjacent = valid
        (TileId::Core1, HexCoord::new(6, -11)),
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

    // Countryside empty → next tile is core.
    state.map.tile_deck.countryside = Vec::new();
    state.map.tile_deck.core = vec![TileId::Core4];

    // Generate enough wedge slots.
    let total_tiles = 14u32;
    state.map.tile_slots =
        crate::setup::generate_tile_slots(state.scenario_config.map_shape, total_tiles);

    // Mark all placed tiles as filled.
    let starting_key = HexCoord::new(0, 0).key();
    if let Some(slot) = state.map.tile_slots.get_mut(&starting_key) {
        slot.filled = true;
    }
    for (_, center) in &placed_centers {
        if let Some(slot) = state.map.tile_slots.get_mut(&center.key()) {
            slot.filled = true;
        }
    }

    // Player near the tip of the chain (core_1 at (6,-11)).
    state.players[0].position = Some(HexCoord::new(7, -12));

    let legal = enumerate_legal_actions(&state, 0);
    let explore_targets: Vec<HexCoord> = legal
        .actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Explore { target_center } => Some(*target_center),
            _ => None,
        })
        .collect();

    // Every offered target must be adjacent to at least 2 existing tiles.
    for target in &explore_targets {
        let adj_count = count_adjacent_tiles_for_target(&state, *target);
        assert!(
            adj_count >= 2,
            "Core tile explore target ({},{}) is only adjacent to {} tile(s), needs ≥2",
            target.q, target.r, adj_count
        );
    }
}

/// Helper: count how many distinct tiles a hypothetical placement at `target` would adjoin.
fn count_adjacent_tiles_for_target(state: &GameState, target: HexCoord) -> usize {
    use std::collections::BTreeSet;
    let mut adj = BTreeSet::new();
    for offset in mk_types::hex::TILE_HEX_OFFSETS.iter() {
        let hex = HexCoord::new(target.q + offset.q, target.r + offset.r);
        for dir in mk_types::hex::HexDirection::ALL {
            let neighbor = hex.neighbor(dir);
            if let Some(hex_state) = state.map.hexes.get(&neighbor.key()) {
                adj.insert(hex_state.tile_id);
            }
        }
    }
    adj.len()
}

/// Helper: check if any tile adjacent to `target` itself borders ≥2 other tiles.
/// Mirrors the production `has_well_connected_neighbor` logic for test assertions.
fn has_well_connected_neighbor_for_target(state: &GameState, target: HexCoord) -> bool {
    use std::collections::BTreeSet;
    // Collect tile IDs adjacent to the candidate.
    let mut adj_tile_ids = BTreeSet::new();
    for offset in mk_types::hex::TILE_HEX_OFFSETS.iter() {
        let hex = HexCoord::new(target.q + offset.q, target.r + offset.r);
        for dir in mk_types::hex::HexDirection::ALL {
            let neighbor = hex.neighbor(dir);
            if let Some(hex_state) = state.map.hexes.get(&neighbor.key()) {
                adj_tile_ids.insert(hex_state.tile_id);
            }
        }
    }
    // For each adjacent tile, count how many *other* tiles border it.
    for adj_tile_id in &adj_tile_ids {
        let Some(placement) = state.map.tiles.iter().find(|t| t.tile_id == *adj_tile_id) else {
            continue;
        };
        let center = placement.center_coord;
        let mut neighbor_tiles = BTreeSet::new();
        for offset in mk_types::hex::TILE_HEX_OFFSETS.iter() {
            let hex = HexCoord::new(center.q + offset.q, center.r + offset.r);
            for dir in mk_types::hex::HexDirection::ALL {
                let neighbor = hex.neighbor(dir);
                if let Some(hex_state) = state.map.hexes.get(&neighbor.key()) {
                    if hex_state.tile_id != *adj_tile_id {
                        neighbor_tiles.insert(hex_state.tile_id);
                    }
                }
            }
        }
        if neighbor_tiles.len() >= 2 {
            return true;
        }
    }
    false
}

/// Countryside tiles placed after the first must satisfy the adjacency rule:
/// adjacent to ≥2 tiles, OR adjacent to a tile that borders ≥2 other tiles.
/// A chain of tiles where the tip only touches 1 tile should NOT allow
/// exploration to slots that fail both conditions.
#[test]
fn countryside_adjacency_rule_blocks_poorly_connected_slots() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 10;
    state.map = crate::setup::place_starting_tile(TileId::StartingA);

    // Place a linear chain: starting → c1 → c3 (skipping row-1 second slot).
    // c3 at (4,-5) is adjacent to c1 via hex (3,-4)/(2,-4), but only touches c1.
    let placed_centers = [
        (TileId::Countryside1, HexCoord::new(1, -3)),
        (TileId::Countryside3, HexCoord::new(4, -5)),
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

    // Next tile is countryside.
    state.map.tile_deck.countryside = vec![TileId::Countryside4];
    state.map.tile_deck.core = Vec::new();

    // Generate wedge slots and mark placed ones as filled.
    let total_tiles = 10u32;
    state.map.tile_slots =
        crate::setup::generate_tile_slots(state.scenario_config.map_shape, total_tiles);
    for key in [
        HexCoord::new(0, 0).key(),
        HexCoord::new(1, -3).key(),
        HexCoord::new(4, -5).key(),
    ] {
        if let Some(slot) = state.map.tile_slots.get_mut(&key) {
            slot.filled = true;
        }
    }

    // Player at the tip of the chain, near slots that only touch 1 tile.
    state.players[0].position = Some(HexCoord::new(5, -6));

    let legal = enumerate_legal_actions(&state, 0);
    let explore_targets: Vec<HexCoord> = legal
        .actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Explore { target_center } => Some(*target_center),
            _ => None,
        })
        .collect();

    // Every offered countryside target must pass the full adjacency rule:
    // adjacent to ≥2 tiles, OR adjacent to a tile that borders ≥2 other tiles.
    for target in &explore_targets {
        let adj_count = count_adjacent_tiles_for_target(&state, *target);
        let well_connected = adj_count >= 2
            || has_well_connected_neighbor_for_target(&state, *target);
        assert!(
            well_connected,
            "Countryside explore target ({},{}) is only adjacent to {} tile(s) \
             and has no well-connected neighbor — should not be offered",
            target.q, target.r, adj_count
        );
    }
}

/// Regression test: player on a hex that borders empty table space should be
/// able to explore even when the empty slot is only reachable from a *different*
/// placed tile's direction, not from the player's current tile.
///
/// Setup: starting_a at (0,0), c1 at NE (1,-3), c2 at E (3,-2).
/// Player at hex (4,-3) on c2. Slot (4,-5) is adjacent to both c1 and c2,
/// satisfying the countryside adjacency rule. The player can reach it because
/// hex (3,-4) of that slot is within distance 1 of (4,-3).
#[test]
fn explore_from_adjacent_tile_edge() {
    let mut state = setup_game(vec!["march"]);
    state.players[0].move_points = 10;
    state.map = crate::setup::place_starting_tile(TileId::StartingA);

    // Place two countryside tiles to create a denser map.
    let tiles_to_place = [
        (TileId::Countryside1, HexCoord::new(1, -3)), // NE
        (TileId::Countryside2, HexCoord::new(3, -2)), // E
    ];
    for (tile_id, center) in &tiles_to_place {
        let tile_hexes = mk_data::tiles::get_tile_hexes(*tile_id).unwrap();
        crate::movement::place_tile_on_map(&mut state.map, *tile_id, *center, tile_hexes);
        state.map.tiles.push(mk_types::state::TilePlacement {
            tile_id: *tile_id,
            center_coord: *center,
            revealed: true,
        });
    }

    state.map.tile_deck.countryside = vec![TileId::Countryside3, TileId::Countryside4];

    let total = 3 + state.map.tile_deck.countryside.len() as u32;
    state.map.tile_slots =
        crate::setup::generate_tile_slots(state.scenario_config.map_shape, total);
    for (_, center) in &tiles_to_place {
        if let Some(slot) = state.map.tile_slots.get_mut(&center.key()) {
            slot.filled = true;
        }
    }

    // Player on c2 at (4,-3), near slot (4,-5) which is adjacent to c1 and c2.
    state.players[0].position = Some(HexCoord::new(4, -3));

    let legal = enumerate_legal_actions(&state, 0);
    let explore_actions: Vec<_> = legal
        .actions
        .iter()
        .filter(|a| matches!(a, LegalAction::Explore { .. }))
        .collect();

    assert!(
        !explore_actions.is_empty(),
        "Player at (4,-3) should be able to explore slot (4,-5) which is adjacent to \
         both countryside_1 and countryside_2"
    );
}
