use std::collections::BTreeMap;

use mk_types::hex::HexCoord;
use mk_types::legal_action::LegalAction;
use mk_types::state::GameState;

use super::{ExploreDirection, MoveTarget, PlayableCard};

/// Group card-related LegalActions into PlayableCard structs.
///
/// Groups by (hand_index, card_id), merging basic/powered/sideways modes.
pub(super) fn project_playable_cards(
    actions: &[LegalAction],
    _is_combat: bool,
) -> Vec<PlayableCard> {
    // Use BTreeMap for deterministic ordering by hand_index.
    let mut card_map: BTreeMap<usize, PlayableCard> = BTreeMap::new();

    for action in actions {
        match action {
            LegalAction::PlayCardBasic {
                hand_index,
                card_id,
            } => {
                let entry = card_map.entry(*hand_index).or_insert_with(|| PlayableCard {
                    card_id: card_id.clone(),
                    hand_index: *hand_index,
                    can_play_basic: false,
                    can_play_powered: false,
                    can_play_sideways: false,
                    sideways_options: Vec::new(),
                });
                entry.can_play_basic = true;
            }
            LegalAction::PlayCardPowered {
                hand_index,
                card_id,
                ..
            } => {
                let entry = card_map.entry(*hand_index).or_insert_with(|| PlayableCard {
                    card_id: card_id.clone(),
                    hand_index: *hand_index,
                    can_play_basic: false,
                    can_play_powered: false,
                    can_play_sideways: false,
                    sideways_options: Vec::new(),
                });
                entry.can_play_powered = true;
            }
            LegalAction::PlayCardSideways {
                hand_index,
                card_id,
                sideways_as,
            } => {
                let entry = card_map.entry(*hand_index).or_insert_with(|| PlayableCard {
                    card_id: card_id.clone(),
                    hand_index: *hand_index,
                    can_play_basic: false,
                    can_play_powered: false,
                    can_play_sideways: false,
                    sideways_options: Vec::new(),
                });
                entry.can_play_sideways = true;
                if !entry.sideways_options.contains(sideways_as) {
                    entry.sideways_options.push(*sideways_as);
                }
            }
            _ => {}
        }
    }

    card_map.into_values().collect()
}

/// Project Move actions into MoveTarget structs.
pub(super) fn project_move_targets(actions: &[LegalAction]) -> Vec<MoveTarget> {
    actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Move { target, cost } => Some(MoveTarget {
                coord: *target,
                cost: *cost,
            }),
            _ => None,
        })
        .collect()
}

/// Project Explore actions into ExploreDirection structs.
///
/// We need the state to compute `target_center` from the direction, since
/// `LegalAction::Explore` only carries the direction.
pub(super) fn project_explore_directions(
    actions: &[LegalAction],
    state: &GameState,
    player_idx: usize,
) -> Vec<ExploreDirection> {
    let player_pos = state.players.get(player_idx).and_then(|p| p.position);

    let tile_center = player_pos.and_then(|pos| crate::movement::find_tile_center(&state.map, pos));

    actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Explore { direction } => {
                let target_center = tile_center
                    .map(|tc| crate::movement::calculate_tile_placement(tc, *direction))
                    .unwrap_or_else(|| HexCoord::new(0, 0));
                Some(ExploreDirection {
                    direction: *direction,
                    target_center,
                })
            }
            _ => None,
        })
        .collect()
}
