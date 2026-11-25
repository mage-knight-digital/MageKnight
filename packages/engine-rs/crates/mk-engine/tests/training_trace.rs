//! Training behavior captured from main (076888bd), before extraction.
use mk_engine::{
    action_pipeline::apply_legal_action, effect_queue::EffectQueue,
    legal_actions::enumerate_legal_actions_with_undo, setup::create_solo_game, undo::UndoStack,
};
use mk_types::{
    effect::CardEffect,
    enums::{BasicManaColor, Hero, ManaColor, RoundPhase},
    ids::CardId,
    legal_action::LegalAction,
    pending::EffectMode,
    state::{GameState, ManaToken, ManaTokenSource},
};
use serde_json::{json, Value};
const TRAINING: &str = "training";
const MARCH: &str = "march";
const WOUND: &str = "wound";
const FIREBALL: &str = "fireball";
const WALK: &str = "refreshing_walk";
const PATH: &str = "path_finding";
const RAGE: &str = "blood_rage";
fn setup(offer: &[&str], powered: bool) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = [TRAINING, WOUND, FIREBALL, MARCH]
        .into_iter()
        .map(CardId::from)
        .collect();
    state.offers.advanced_actions = offer.iter().map(|id| CardId::from(*id)).collect();
    state.decks.advanced_action_deck = vec![CardId::from(RAGE)];
    state.source.dice.clear();
    if powered {
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Green,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    }
    state
}
fn snapshot(state: &GameState, undo: &UndoStack, events: Value) -> Value {
    let mut restore = undo.clone();
    json!({"state": state, "legal": enumerate_legal_actions_with_undo(state, 0, undo), "events": events, "undo_depth": undo.depth(), "checkpoint": undo.is_checkpoint_active(), "undo_state": restore.undo()})
}
fn step(state: &mut GameState, undo: &mut UndoStack, action: LegalAction, trace: &mut Vec<Value>) {
    let legal = enumerate_legal_actions_with_undo(state, 0, undo);
    assert!(
        legal.actions.contains(&action),
        "{action:?} not in {:?}",
        legal.actions
    );
    let result = apply_legal_action(state, undo, 0, &action, legal.epoch).unwrap();
    trace.push(snapshot(
        state,
        undo,
        serde_json::to_value(result.events).unwrap(),
    ));
    if state.players[0].pending.has_active() {
        let restored: GameState =
            serde_json::from_slice(&serde_json::to_vec(state).unwrap()).unwrap();
        assert_eq!(
            serde_json::to_value(&restored).unwrap(),
            serde_json::to_value(&*state).unwrap()
        );
        *state = restored;
    }
}
fn play_trace(offer: &[&str], powered: bool, offer_choice: Option<usize>) -> Vec<Value> {
    let mut state = setup(offer, powered);
    let mut undo = UndoStack::new();
    let mut trace = vec![snapshot(&state, &undo, json!([]))];
    let action = if powered {
        LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id: CardId::from(TRAINING),
            mana_color: Some(BasicManaColor::Green),
        }
    } else {
        LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from(TRAINING),
        }
    };
    step(&mut state, &mut undo, action, &mut trace);
    step(
        &mut state,
        &mut undo,
        LegalAction::ResolveTraining { selection_index: 2 },
        &mut trace,
    );
    if let Some(selection_index) = offer_choice {
        step(
            &mut state,
            &mut undo,
            LegalAction::ResolveTraining { selection_index },
            &mut trace,
        );
    }
    trace
}
fn no_eligible() -> Value {
    let mut state = setup(&[WALK], false);
    state.players[0].hand = vec![CardId::from(WOUND), CardId::from(FIREBALL)];
    let mut queue = EffectQueue::new();
    queue.push(
        CardEffect::Training {
            mode: EffectMode::Basic,
        },
        Some(CardId::from(TRAINING)),
    );
    json!({"result": format!("{:?}", queue.drain(&mut state, 0)), "snapshot": snapshot(&state, &UndoStack::new(), json!([]))})
}
#[test]
fn training_matches_main_baseline() {
    let actual = json!({"no_eligible": no_eligible(), "basic_no_match": play_trace(&[RAGE], false, None), "basic_one": play_trace(&[WALK], false, None), "basic_multiple_first": play_trace(&[WALK, PATH], false, Some(0)), "basic_multiple_second": play_trace(&[WALK, PATH], false, Some(1)), "powered_one": play_trace(&[WALK], true, None), "powered_multiple_second": play_trace(&[WALK, PATH], true, Some(1))});
    let expected: Value =
        serde_json::from_str(include_str!("fixtures/training_main.json")).unwrap();
    assert_eq!(actual, expected);
}

#[test]
fn baseline_pauses_resume_with_the_same_results() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/training_main.json")).unwrap();
    for (scenario, choices) in [
        ("basic_no_match", vec![(1, 2)]),
        ("basic_one", vec![(1, 2)]),
        ("basic_multiple_first", vec![(1, 2), (2, 0)]),
        ("basic_multiple_second", vec![(1, 2), (2, 1)]),
        ("powered_one", vec![(1, 2)]),
        ("powered_multiple_second", vec![(1, 2), (2, 1)]),
    ] {
        let trace = baseline[scenario].as_array().unwrap();
        for (index, selection_index) in choices {
            let mut state: GameState =
                serde_json::from_value(trace[index]["state"].clone()).unwrap();
            let mut undo = UndoStack::new();
            let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
            let action = LegalAction::ResolveTraining { selection_index };
            assert!(legal.actions.contains(&action), "{scenario} {index}");
            let result =
                apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();
            assert_eq!(
                serde_json::to_value(&state).unwrap(),
                trace[index + 1]["state"],
                "{scenario} {index}"
            );
            assert_eq!(
                serde_json::to_value(result.events).unwrap(),
                trace[index + 1]["events"],
                "{scenario} {index}"
            );
        }
    }
}

#[test]
fn invalid_selection_restores_saved_pending() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/training_main.json")).unwrap();
    let trace = baseline["basic_multiple_first"].as_array().unwrap();
    for index in [1, 2] {
        let mut state: GameState = serde_json::from_value(trace[index]["state"].clone()).unwrap();
        let before = serde_json::to_value(&state).unwrap();
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        let result = apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ResolveTraining {
                selection_index: usize::MAX,
            },
            epoch,
        );
        assert!(result.is_err());
        assert_eq!(serde_json::to_value(&state).unwrap(), before);
    }
}
