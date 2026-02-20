use mk_types::legal_action::LegalAction;
use mk_types::state::GameState;

pub(super) fn enumerate_tactics(state: &GameState, actions: &mut Vec<LegalAction>) {
    // Sort by tactic_id for determinism.
    let mut tactics: Vec<_> = state.available_tactics.to_vec();
    tactics.sort_by(|a, b| a.as_str().cmp(b.as_str()));
    for tactic_id in tactics {
        actions.push(LegalAction::SelectTactic { tactic_id });
    }
}
