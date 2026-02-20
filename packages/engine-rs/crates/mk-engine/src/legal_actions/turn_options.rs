use mk_types::legal_action::LegalAction;
use mk_types::state::{GameState, PlayerFlags};

use crate::undo::UndoStack;

pub(super) fn enumerate_turn_options(
    state: &GameState,
    player_idx: usize,
    undo: &UndoStack,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];
    let is_resting = player.flags.contains(PlayerFlags::IS_RESTING);

    // Category 9: EndTurn — only if played a card or rested.
    if !is_resting
        && !player.pending.has_active()
        && (player
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN)
            || player.flags.contains(PlayerFlags::HAS_RESTED_THIS_TURN))
    {
        actions.push(LegalAction::EndTurn);
    }

    // Category 10: DeclareRest.
    if !is_resting
        && state.combat.is_none()
        && !player.hand.is_empty()
        && !player
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
        && !player.flags.contains(PlayerFlags::HAS_MOVED_THIS_TURN)
    {
        actions.push(LegalAction::DeclareRest);
    }

    // Category 11: CompleteRest.
    if is_resting {
        actions.push(LegalAction::CompleteRest);
    }

    // Category 12: Undo.
    if undo.can_undo() {
        actions.push(LegalAction::Undo);
    }
}
