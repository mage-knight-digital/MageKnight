use mk_types::hex::{HexCoord, HexDirection, TILE_HEX_OFFSETS};
use mk_types::legal_action::LegalAction;
use mk_types::modifier::RuleOverride;
use mk_types::state::{GameState, PlayerFlags};

use crate::card_play::is_rule_active;

use super::utils::must_slow_recover;

pub(super) fn enumerate_explores(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];

    let explore_cost = crate::movement::get_effective_explore_cost(&state.active_modifiers);

    // NoExploration modifier blocks all exploration.
    if is_rule_active(state, player_idx, RuleOverride::NoExploration) {
        return;
    }

    // Early exit conditions.
    if player.position.is_none()
        || player.flags.contains(PlayerFlags::IS_RESTING)
        || player
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
        || player.move_points < explore_cost
        || must_slow_recover(player)
    {
        return;
    }

    // Need tiles available.
    if state.map.tile_deck.countryside.is_empty() && state.map.tile_deck.core.is_empty() {
        return;
    }

    let pos = player.position.unwrap();

    let next_tile_is_core = state.map.tile_deck.countryside.is_empty();

    let explore_distance = if is_rule_active(state, player_idx, RuleOverride::ExtendedExplore) { 2 } else { 1 };

    if state.map.tile_slots.is_empty() {
        // Open maps: no tile_slots, use directional approach from placed tiles.
        enumerate_explores_open(state, pos, explore_distance, actions);
    } else {
        // Slot-based maps (Wedge): iterate unfilled slots.
        enumerate_explores_slotted(state, pos, next_tile_is_core, explore_distance, actions);
    }
}

/// Open map exploration: iterate placed tiles, check directional targets.
fn enumerate_explores_open(
    state: &GameState,
    pos: HexCoord,
    explore_distance: u32,
    actions: &mut Vec<LegalAction>,
) {
    let allowed_directions = state.scenario_config.map_shape.expansion_directions();
    let mut seen_targets: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();

    for tile_placement in &state.map.tiles {
        let tile_center = tile_placement.center_coord;

        for dir in allowed_directions {
            let target_center = crate::movement::calculate_tile_placement(tile_center, *dir);

            let target_key = target_center.key();
            if !seen_targets.insert(target_key) {
                continue;
            }

            let tile_exists = state
                .map
                .tiles
                .iter()
                .any(|t| t.center_coord == target_center);

            if tile_exists {
                continue;
            }

            if !is_player_near_target_tile(pos, target_center, explore_distance) {
                continue;
            }

            let would_overlap = TILE_HEX_OFFSETS.iter().any(|offset| {
                let hex_coord =
                    HexCoord::new(target_center.q + offset.q, target_center.r + offset.r);
                state.map.hexes.contains_key(&hex_coord.key())
            });

            if !would_overlap {
                actions.push(LegalAction::Explore { target_center });
            }
        }
    }
}

/// Slot-based exploration (Wedge maps): iterate unfilled slots, check physical
/// adjacency to existing map hexes.
fn enumerate_explores_slotted(
    state: &GameState,
    pos: HexCoord,
    next_tile_is_core: bool,
    explore_distance: u32,
    actions: &mut Vec<LegalAction>,
) {
    for slot in state.map.tile_slots.values() {
        if slot.filled {
            continue;
        }

        // Coastline filtering: core tiles cannot be placed on coastline slots.
        if next_tile_is_core && is_coastline_slot(slot, &state.map.tile_slots) {
            continue;
        }

        let target_center = slot.coord;

        // Check: no hex overlap with existing map.
        let would_overlap = TILE_HEX_OFFSETS.iter().any(|offset| {
            let hex = HexCoord::new(target_center.q + offset.q, target_center.r + offset.r);
            state.map.hexes.contains_key(&hex.key())
        });
        if would_overlap {
            continue;
        }

        // Check: at least one hex of the target tile is adjacent to an existing map hex.
        let adjacent_to_map = TILE_HEX_OFFSETS.iter().any(|offset| {
            let hex = HexCoord::new(target_center.q + offset.q, target_center.r + offset.r);
            HexDirection::ALL.iter().any(|dir| {
                let neighbor = hex.neighbor(*dir);
                state.map.hexes.contains_key(&neighbor.key())
            })
        });
        if !adjacent_to_map {
            continue;
        }

        // Check: player is close enough to explore.
        if !is_player_near_target_tile(pos, target_center, explore_distance) {
            continue;
        }

        actions.push(LegalAction::Explore { target_center });
    }
}

/// Check if the player is near enough to any hex of a target tile to explore.
fn is_player_near_target_tile(
    player_pos: HexCoord,
    target_center: HexCoord,
    explore_distance: u32,
) -> bool {
    TILE_HEX_OFFSETS.iter().any(|offset| {
        let hex = HexCoord::new(target_center.q + offset.q, target_center.r + offset.r);
        player_pos.distance(hex) <= explore_distance
    })
}

/// Check if a tile slot is on the coastline (leftmost or rightmost column in its row).
///
/// Row 0 is never coastline (it's the starting tile).
/// For rows > 0, coastline = column 0 or column == row (the edges of the triangle).
fn is_coastline_slot(
    slot: &mk_types::state::TileSlot,
    all_slots: &std::collections::BTreeMap<String, mk_types::state::TileSlot>,
) -> bool {
    if slot.row == 0 {
        return false;
    }

    // Find the min and max columns in this row
    let (min_col, max_col) = all_slots
        .values()
        .filter(|s| s.row == slot.row)
        .fold((i32::MAX, i32::MIN), |(min, max), s| {
            (min.min(s.column), max.max(s.column))
        });

    slot.column == min_col || slot.column == max_col
}
