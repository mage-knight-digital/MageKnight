use mk_types::hex::HexDirection;
use mk_types::legal_action::LegalAction;
use mk_types::state::{GameState, PlayerFlags};

use crate::movement::evaluate_move_entry;

use super::utils::must_slow_recover;

/// Enumerate ChallengeRampaging actions — adjacent hexes with rampaging enemies.
///
/// Available when player hasn't taken an action or combatted this turn,
/// is not resting, and is not in combat.
pub(super) fn enumerate_challenges(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];

    // Cannot challenge while resting, after an action, or while in combat.
    if player.position.is_none()
        || player.flags.contains(PlayerFlags::IS_RESTING)
        || player
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
    {
        return;
    }

    let pos = player.position.unwrap();
    let mut challenge_hexes = Vec::new();

    for dir in &HexDirection::ALL {
        let neighbor = pos.neighbor(*dir);
        if let Some(hex) = state.map.hexes.get(&neighbor.key()) {
            // Hex must have both rampaging_enemies (type slots) and drawn enemies
            if !hex.rampaging_enemies.is_empty() && !hex.enemies.is_empty() {
                challenge_hexes.push(neighbor);
            }
        }
    }

    // Sort by (q, r) for determinism.
    challenge_hexes.sort_by(|a, b| a.q.cmp(&b.q).then(a.r.cmp(&b.r)));

    for hex in challenge_hexes {
        actions.push(LegalAction::ChallengeRampaging { hex });
    }
}

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
