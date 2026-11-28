//! Call to Arms behavior captured before extraction and updated for spell payment.
use mk_engine::{
    action_pipeline::apply_legal_action, effect_queue::EffectQueue,
    legal_actions::enumerate_legal_actions_with_undo, setup::create_solo_game, undo::UndoStack,
};
use mk_types::{
    effect::CardEffect,
    enums::{BasicManaColor, Hero, ManaColor, RoundPhase, TimeOfDay},
    ids::{CardId, UnitId},
    legal_action::LegalAction,
    state::{GameState, ManaToken, ManaTokenSource},
};
use serde_json::{json, Value};
const CALL: &str = "call_to_arms";
const MARCH: &str = "march";
const PEASANTS: &str = "peasants";
const FORESTERS: &str = "foresters";
const HERBALIST: &str = "herbalist";
const FAMILIARS: &str = "magic_familiars";
const MONKS: &str = "red_cape_monks";
fn setup(units: &[&str], powered: bool, room: bool) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = [CALL, MARCH].into_iter().map(CardId::from).collect();
    state.offers.units = units.iter().map(|id| UnitId::from(*id)).collect();
    state.decks.unit_deck = vec![UnitId::from(MONKS)];
    state.players[0].command_tokens = u32::from(room);
    state.source.dice.clear();
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    if powered {
        state.time_of_day = TimeOfDay::Night;
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Black,
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
fn play_trace(units: &[&str], powered: bool, selections: &[usize]) -> Vec<Value> {
    let mut state = setup(units, powered, true);
    let mut undo = UndoStack::new();
    let mut trace = vec![snapshot(&state, &undo, json!([]))];
    let action = if powered {
        LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id: CardId::from(CALL),
            mana_color: Some(BasicManaColor::White),
        }
    } else {
        LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from(CALL),
        }
    };
    step(&mut state, &mut undo, action, &mut trace);
    for &choice_index in selections {
        step(
            &mut state,
            &mut undo,
            LegalAction::ResolveChoice { choice_index },
            &mut trace,
        );
    }
    trace
}
fn no_eligible(powered: bool, room: bool, units: &[&str]) -> Value {
    let mut state = setup(units, powered, room);
    let mut queue = EffectQueue::new();
    queue.push(
        if powered {
            CardEffect::FreeRecruit
        } else {
            CardEffect::CallToArms
        },
        Some(CardId::from(CALL)),
    );
    json!({"result": format!("{:?}", queue.drain(&mut state, 0)), "snapshot": snapshot(&state, &UndoStack::new(), json!([]))})
}
#[test]
fn call_matches_main_baseline() {
    let actual = json!({"basic_none": no_eligible(false, true, &[FAMILIARS]),
      "basic_single_ability": play_trace(&[FORESTERS], false, &[0]),
      "basic_no_converted_ability": play_trace(&[HERBALIST], false, &[0]),
      "basic_multiple_ability_first": play_trace(&[PEASANTS], false, &[0, 0]),
      "basic_multiple_ability_last": play_trace(&[PEASANTS], false, &[0, 3]),
      "basic_offer_second": play_trace(&[FAMILIARS, PEASANTS, FORESTERS], false, &[1]),
      "powered_none": no_eligible(true, false, &[PEASANTS]),
      "powered_single": play_trace(&[PEASANTS], true, &[]),
      "powered_multiple": play_trace(&[FAMILIARS, PEASANTS, FORESTERS], true, &[1])
    });
    let expected: Value =
        serde_json::from_str(include_str!("fixtures/call_to_arms_main.json")).unwrap();
    assert_eq!(actual, expected);
}

#[test]
fn baseline_pauses_resume_with_the_same_results() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/call_to_arms_main.json")).unwrap();
    for (scenario, choices) in [
        ("basic_single_ability", vec![(1, 0)]),
        ("basic_no_converted_ability", vec![(1, 0)]),
        ("basic_multiple_ability_first", vec![(1, 0), (2, 0)]),
        ("basic_multiple_ability_last", vec![(1, 0), (2, 3)]),
        ("basic_offer_second", vec![(1, 1)]),
        ("powered_multiple", vec![(1, 1)]),
    ] {
        let trace = baseline[scenario].as_array().unwrap();
        for (index, choice_index) in choices {
            let mut state: GameState =
                serde_json::from_value(trace[index]["state"].clone()).unwrap();
            let mut undo = UndoStack::new();
            let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
            let action = LegalAction::ResolveChoice { choice_index };
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
fn unit_and_ability_choices_preserve_attributed_continuation() {
    use mk_types::pending::{ActivePending, ContinuationEntry};
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/call_to_arms_main.json")).unwrap();
    let mut state: GameState =
        serde_json::from_value(baseline["basic_multiple_ability_first"][1]["state"].clone())
            .unwrap();
    let Some(ActivePending::Choice(pending)) = state.players[0].pending.active.as_mut() else {
        panic!("expected choice")
    };
    pending.continuation.push(ContinuationEntry {
        effect: CardEffect::GainMove { amount: 2 },
        source_card_id: Some(CardId::from(MARCH)),
    });
    let mut undo = UndoStack::new();
    let mut trace = Vec::new();
    step(
        &mut state,
        &mut undo,
        LegalAction::ResolveChoice { choice_index: 0 },
        &mut trace,
    );
    let Some(ActivePending::Choice(pending)) = &state.players[0].pending.active else {
        panic!("expected ability choice")
    };
    assert_eq!(
        pending.continuation[0]
            .source_card_id
            .as_ref()
            .map(CardId::as_str),
        Some(MARCH)
    );
    step(
        &mut state,
        &mut undo,
        LegalAction::ResolveChoice { choice_index: 0 },
        &mut trace,
    );
    assert_eq!(state.players[0].move_points, 2);
}

#[test]
fn borrowed_ability_resumes_into_nested_continuation_choice() {
    use mk_types::pending::{ActivePending, ContinuationEntry};
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/call_to_arms_main.json")).unwrap();
    let mut state: GameState =
        serde_json::from_value(baseline["basic_multiple_ability_first"][1]["state"].clone())
            .unwrap();
    let Some(ActivePending::Choice(pending)) = state.players[0].pending.active.as_mut() else {
        panic!("expected choice")
    };
    pending.continuation.push(ContinuationEntry {
        effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainMana {
                    color: ManaColor::Red,
                    amount: 1,
                },
                CardEffect::GainMana {
                    color: ManaColor::Blue,
                    amount: 1,
                },
            ],
        },
        source_card_id: Some(CardId::from(MARCH)),
    });
    let mut undo = UndoStack::new();
    let mut trace = Vec::new();
    step(
        &mut state,
        &mut undo,
        LegalAction::ResolveChoice { choice_index: 0 },
        &mut trace,
    );
    step(
        &mut state,
        &mut undo,
        LegalAction::ResolveChoice { choice_index: 0 },
        &mut trace,
    );
    let Some(ActivePending::Choice(pending)) = &state.players[0].pending.active else {
        panic!("expected nested choice")
    };
    assert_eq!(pending.options.len(), 2);
    assert_eq!(pending.card_id.as_ref().map(CardId::as_str), Some(CALL));
}
