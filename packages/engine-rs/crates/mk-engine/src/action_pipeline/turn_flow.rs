//! Thin delegators for card play, movement, explore, rest, end turn, and undo.

use mk_types::enums::*;
use mk_types::events::GameEvent;
use mk_types::pending::{ActivePending, SubsetSelectionKind, SubsetSelectionState};
use mk_types::state::*;

use crate::{card_play, combat, effect_queue, end_turn, movement};
use crate::undo::UndoStack;

use super::{ApplyError, ApplyResult};

pub(super) fn apply_play_card(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
    powered: bool,
    override_mana_color: Option<BasicManaColor>,
) -> Result<ApplyResult, ApplyError> {
    card_play::play_card(state, player_idx, hand_index, powered, override_mana_color)
        .map(|_| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: Vec::new(),
        })
        .map_err(|e| ApplyError::InternalError(format!("play_card failed: {:?}", e)))
}

pub(super) fn apply_play_card_sideways(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
    sideways_as: SidewaysAs,
) -> Result<ApplyResult, ApplyError> {
    card_play::play_card_sideways(state, player_idx, hand_index, sideways_as)
        .map(|_| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: Vec::new(),
        })
        .map_err(|e| ApplyError::InternalError(format!("play_card_sideways failed: {:?}", e)))
}

pub(super) fn apply_move(
    state: &mut GameState,
    player_idx: usize,
    target: mk_types::hex::HexCoord,
) -> Result<ApplyResult, ApplyError> {
    movement::execute_move(state, player_idx, target)
        .map(|_| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: Vec::new(),
        })
        .map_err(|e| ApplyError::InternalError(format!("execute_move failed: {:?}", e)))
}

pub(super) fn apply_explore(
    state: &mut GameState,
    player_idx: usize,
    direction: mk_types::hex::HexDirection,
) -> Result<ApplyResult, ApplyError> {
    let player_id = state.players[player_idx].id.clone();
    movement::execute_explore(state, player_idx, direction)
        .map(|tile_id| ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: vec![GameEvent::TileExplored {
                player_id,
                direction,
                tile_id,
            }],
        })
        .map_err(|e| ApplyError::InternalError(format!("execute_explore failed: {:?}", e)))
}

pub(super) fn apply_challenge_rampaging(
    state: &mut GameState,
    player_idx: usize,
    hex: mk_types::hex::HexCoord,
) -> Result<ApplyResult, ApplyError> {
    let hex_state = state
        .map
        .hexes
        .get(&hex.key())
        .ok_or_else(|| ApplyError::InternalError("ChallengeRampaging: hex not found".into()))?;

    let enemy_tokens: Vec<mk_types::ids::EnemyTokenId> =
        hex_state.enemies.iter().map(|e| e.token_id.clone()).collect();

    combat::execute_enter_combat(state, player_idx, &enemy_tokens, false, Some(hex), Default::default())
        .map_err(|e| ApplyError::InternalError(format!("enter_combat failed: {:?}", e)))?;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}

pub(super) fn end_turn_result_to_apply(
    result: Result<end_turn::EndTurnResult, end_turn::EndTurnError>,
    state: &GameState,
) -> Result<ApplyResult, ApplyError> {
    match result {
        Ok(end_turn::EndTurnResult::GameEnded) => Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: true,
            events: Vec::new(),
        }),
        Ok(end_turn::EndTurnResult::RoundEnded { new_round }) => {
            let mut events = Vec::new();
            events.push(GameEvent::RoundEnded {
                round: new_round.saturating_sub(1),
            });
            // After round end, a new turn starts for the first player
            if let Some(player) = state.players.first() {
                events.push(GameEvent::TurnStarted {
                    player_id: player.id.clone(),
                    round: state.round,
                    time_of_day: state.time_of_day,
                });
            }
            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events,
            })
        }
        Ok(end_turn::EndTurnResult::NextPlayer { next_player_idx }) => {
            let mut events = Vec::new();
            if let Some(player) = state.players.get(next_player_idx) {
                events.push(GameEvent::TurnStarted {
                    player_id: player.id.clone(),
                    round: state.round,
                    time_of_day: state.time_of_day,
                });
            }
            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events,
            })
        }
        Ok(_) => Ok(ApplyResult {
            needs_reenumeration: true,
            game_ended: false,
            events: Vec::new(),
        }),
        Err(e) => Err(ApplyError::InternalError(format!(
            "end_turn failed: {:?}",
            e
        ))),
    }
}

/// Voluntarily announce end of round (multiplayer).
/// All other players get exactly one final turn each.
pub(super) fn apply_announce_end_of_round(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let player_id = state.players[player_idx].id.clone();
    state.end_of_round_announced_by = Some(player_id.clone());

    // All OTHER players get one final turn
    state.players_with_final_turn = state
        .players
        .iter()
        .filter(|p| p.id != player_id)
        .map(|p| p.id.clone())
        .collect();

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}

pub(super) fn apply_end_turn(state: &mut GameState, player_idx: usize) -> Result<ApplyResult, ApplyError> {
    end_turn_result_to_apply(end_turn::end_turn(state, player_idx), state)
}

pub(super) fn apply_declare_rest(state: &mut GameState, player_idx: usize) -> ApplyResult {
    let player = &mut state.players[player_idx];
    player.flags.insert(PlayerFlags::IS_RESTING);
    player.flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    }
}

pub(super) fn apply_complete_rest(
    state: &mut GameState,
    player_idx: usize,
    discard_hand_index: Option<usize>,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    if let Some(idx) = discard_hand_index {
        if idx >= player.hand.len() {
            return Err(ApplyError::InternalError(format!(
                "CompleteRest discard index {} out of range (hand len {})",
                idx,
                player.hand.len()
            )));
        }

        let chosen_card = player.hand[idx].clone();
        let is_wound = chosen_card.as_str() == effect_queue::WOUND_CARD_ID;
        let has_non_wound = player
            .hand
            .iter()
            .any(|c| c.as_str() != effect_queue::WOUND_CARD_ID);

        if has_non_wound {
            // Standard rest: discard chosen non-wound card, then let agent choose wounds.
            if is_wound {
                return Err(ApplyError::InternalError(
                    "Standard rest: must discard a non-wound card".into(),
                ));
            }
            // Remove chosen card first (by index).
            player.hand.remove(idx);
            player.discard.push(chosen_card);

            // Check if wounds remain in hand — if so, enter SubsetSelection.
            let wound_hand_indices: Vec<usize> = player
                .hand
                .iter()
                .enumerate()
                .filter(|(_, c)| c.as_str() == effect_queue::WOUND_CARD_ID)
                .map(|(i, _)| i)
                .collect();

            if !wound_hand_indices.is_empty() {
                let pool_size = wound_hand_indices.len();
                player.pending.active = Some(ActivePending::SubsetSelection(
                    SubsetSelectionState {
                        kind: SubsetSelectionKind::RestWoundDiscard { wound_hand_indices },
                        pool_size,
                        max_selections: pool_size,
                        min_selections: 0,
                        selected: Vec::new(),
                    },
                ));
                return Ok(ApplyResult {
                    needs_reenumeration: true,
                    game_ended: false,
                    events: Vec::new(),
                });
            }
            // No wounds — fall through to finish rest immediately.
        } else {
            // Slow recovery: hand is all wounds — discard only the chosen wound.
            player.hand.remove(idx);
            player.discard.push(chosen_card);
        }
    }
    // else: empty hand — no discard needed.

    finish_rest(state, player_idx);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}

/// Finalize rest: clear IS_RESTING, set HAS_RESTED + PLAYED_CARD flags.
pub(super) fn finish_rest(state: &mut GameState, player_idx: usize) {
    let player = &mut state.players[player_idx];
    player.flags.remove(PlayerFlags::IS_RESTING);
    player.flags.insert(PlayerFlags::HAS_RESTED_THIS_TURN);
    player
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
}

/// Forfeit turn: minimal reset without site benefits, then advance turn.
pub(super) fn apply_forfeit_turn(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    end_turn_result_to_apply(end_turn::forfeit_turn(state, player_idx), state)
}

pub(super) fn apply_undo(
    state: &mut GameState,
    undo_stack: &mut UndoStack,
) -> Result<ApplyResult, ApplyError> {
    match undo_stack.undo() {
        Some(restored) => {
            *state = restored;
            // Note: epoch will be incremented by the caller after this returns,
            // which is correct — the restored state gets a new epoch.
            Ok(ApplyResult {
                needs_reenumeration: true,
                game_ended: false,
                events: Vec::new(),
            })
        }
        None => Err(ApplyError::InternalError("Undo stack empty".to_string())),
    }
}
