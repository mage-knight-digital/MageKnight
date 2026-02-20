use mk_types::hex::HexDirection;
use mk_types::legal_action::LegalAction;
use mk_types::state::{GameState, PlayerFlags};

use crate::movement::evaluate_move_entry;

use super::utils::must_slow_recover;

pub(super) fn enumerate_moves(
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
        || player.move_points == 0
        || must_slow_recover(player)
    {
        return;
    }

    let pos = player.position.unwrap();
    let mut targets = Vec::new();

    for dir in &HexDirection::ALL {
        let neighbor = pos.neighbor(*dir);
        let entry = evaluate_move_entry(state, player_idx, neighbor);

        if entry.block_reason.is_some() {
            continue;
        }

        if let Some(cost) = entry.cost {
            if player.move_points >= cost {
                targets.push((neighbor, cost));
            }
        }
    }

    // Sort by (q, r) for determinism.
    targets.sort_by(|a, b| a.0.q.cmp(&b.0.q).then(a.0.r.cmp(&b.0.r)));

    for (target, cost) in targets {
        actions.push(LegalAction::Move { target, cost });
    }
}
