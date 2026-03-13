use std::collections::BTreeMap;

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
/// Each `LegalAction::Explore` now carries `from_tile_center`, so we can
/// compute `target_center` directly without looking up the player's tile.
pub(super) fn project_explore_directions(
    actions: &[LegalAction],
    _state: &GameState,
    _player_idx: usize,
) -> Vec<ExploreDirection> {
    actions
        .iter()
        .filter_map(|a| match a {
            LegalAction::Explore { direction, from_tile_center } => {
                let target_center = crate::movement::calculate_tile_placement(*from_tile_center, *direction);
                Some(ExploreDirection {
                    direction: *direction,
                    target_center,
                })
            }
            _ => None,
        })
        .collect()
}
