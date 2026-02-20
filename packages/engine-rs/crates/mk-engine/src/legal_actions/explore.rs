use mk_types::hex::{HexCoord, HexDirection, TILE_HEX_OFFSETS};
use mk_types::legal_action::LegalAction;
use mk_types::state::{GameState, PlayerFlags};

use super::utils::{must_slow_recover, EXPLORE_BASE_COST};

pub(super) fn enumerate_explores(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];

    // Early exit conditions.
    if player.position.is_none()
        || player.flags.contains(PlayerFlags::IS_RESTING)
        || player
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
        || player.move_points < EXPLORE_BASE_COST
        || must_slow_recover(player)
    {
        return;
    }

    // Need tiles available.
    if state.map.tile_deck.countryside.is_empty() && state.map.tile_deck.core.is_empty() {
        return;
    }

    let pos = player.position.unwrap();

    let tile_center = match crate::movement::find_tile_center(&state.map, pos) {
        Some(center) => center,
        None => return,
    };

    // HexDirection::ALL is in deterministic order (NE, E, SE, SW, W, NW).
    for dir in &HexDirection::ALL {
        let target_center = crate::movement::calculate_tile_placement(tile_center, *dir);

        let tile_exists = state
            .map
            .tiles
            .iter()
            .any(|t| t.center_coord == target_center);

        if !tile_exists && crate::movement::is_player_near_explore_edge(pos, tile_center, *dir) {
            let would_overlap = TILE_HEX_OFFSETS.iter().any(|offset| {
                let hex_coord =
                    HexCoord::new(target_center.q + offset.q, target_center.r + offset.r);
                state.map.hexes.contains_key(&hex_coord.key())
            });

            if !would_overlap {
                actions.push(LegalAction::Explore { direction: *dir });
            }
        }
    }
}
