use mk_types::hex::{HexCoord, TILE_HEX_OFFSETS};
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

    let tile_center = match crate::movement::find_tile_center(&state.map, pos) {
        Some(center) => center,
        None => return,
    };

    let next_tile_is_core = state.map.tile_deck.countryside.is_empty();

    // Use expansion_directions() to constrain which directions are valid.
    let allowed_directions = state.scenario_config.map_shape.expansion_directions();

    for dir in allowed_directions {
        let target_center = crate::movement::calculate_tile_placement(tile_center, *dir);

        let tile_exists = state
            .map
            .tiles
            .iter()
            .any(|t| t.center_coord == target_center);

        if tile_exists {
            continue;
        }

        let explore_distance = if is_rule_active(state, player_idx, RuleOverride::ExtendedExplore) { 2 } else { 1 };
        if !crate::movement::is_player_near_explore_edge(pos, tile_center, *dir, explore_distance) {
            continue;
        }

        // Tile slot validation: if slots are populated, target must exist and be unfilled.
        if !state.map.tile_slots.is_empty() {
            match state.map.tile_slots.get(&target_center.key()) {
                None => continue,            // no slot exists for this position
                Some(slot) if slot.filled => continue, // already filled
                Some(slot) => {
                    // Coastline filtering: core (brown) tiles cannot be placed on
                    // coastline slots (leftmost/rightmost column in row > 0).
                    if next_tile_is_core && is_coastline_slot(slot, &state.map.tile_slots) {
                        continue;
                    }
                }
            }
        }

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
