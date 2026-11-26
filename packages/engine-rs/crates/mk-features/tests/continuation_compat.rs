//! Compare RL encodings after migrated continuations with pre-migration traces.
use mk_engine::{
    action_pipeline::apply_legal_action, legal_actions::enumerate_legal_actions_with_undo,
    undo::UndoStack,
};
use mk_types::{
    legal_action::{LegalAction, LegalActionSet},
    state::GameState,
};
use serde_json::Value;

#[test]
fn migrated_card_continuations_preserve_rl_features() {
    for (fixture, scenario, index, choice_index) in [
        (
            include_str!("../../mk-engine/tests/fixtures/blood_of_ancients_main.json"),
            "powered_hand_nested",
            2,
            0,
        ),
        (
            include_str!("../../mk-engine/tests/fixtures/call_to_arms_main.json"),
            "basic_multiple_ability_first",
            2,
            0,
        ),
    ] {
        let baseline: Value = serde_json::from_str(fixture).unwrap();
        let trace = baseline[scenario].as_array().unwrap();
        let mut state: GameState = serde_json::from_value(trace[index]["state"].clone()).unwrap();
        let expected_state: GameState =
            serde_json::from_value(trace[index + 1]["state"].clone()).unwrap();
        let expected_actions: LegalActionSet =
            serde_json::from_value(trace[index + 1]["legal"].clone()).unwrap();
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ResolveChoice { choice_index },
            epoch,
        )
        .unwrap();
        let actual_actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
        assert_eq!(
            actual_actions.actions, expected_actions.actions,
            "{scenario}"
        );
        assert_eq!(
            format!("{:?}", mk_features::encode_step(&state, 0, &actual_actions)),
            format!(
                "{:?}",
                mk_features::encode_step(&expected_state, 0, &expected_actions)
            ),
            "{scenario}",
        );
    }
}
