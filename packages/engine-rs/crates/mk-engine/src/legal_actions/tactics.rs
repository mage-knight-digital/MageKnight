use mk_types::legal_action::LegalAction;
use mk_types::state::GameState;

pub(super) fn enumerate_tactics(state: &GameState, actions: &mut Vec<LegalAction>) {
    // Preserve canonical turn order from available_tactics (1=early_bird, 2=rethink, etc.)
    for tactic_id in &state.available_tactics {
        actions.push(LegalAction::SelectTactic {
            tactic_id: tactic_id.clone(),
        });
    }
}
