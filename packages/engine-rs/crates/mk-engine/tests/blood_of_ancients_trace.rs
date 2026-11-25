//! Behavior captured from main (74ccd5bb), before extracting Blood of Ancients.
use mk_engine::{
    action_pipeline::apply_legal_action, effect_queue::EffectQueue,
    legal_actions::enumerate_legal_actions_with_undo, setup::create_solo_game, undo::UndoStack,
};
use mk_types::{
    effect::CardEffect,
    enums::{BasicManaColor, Hero, ManaColor, RoundPhase},
    ids::CardId,
    legal_action::LegalAction,
    state::{GameState, ManaToken, ManaTokenSource},
};
use serde_json::{json, Value};

const BLOOD: &str = "blood_of_ancients";
const RAGE: &str = "blood_rage";
const RITUAL: &str = "blood_ritual";
const INTIMIDATE: &str = "intimidate";
const BOLT: &str = "ice_bolt";
const MARCH: &str = "march";

fn setup(offer: &[&str], tokens: &[ManaColor], red_crystals: u8) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from(BLOOD), CardId::from(MARCH)];
    state.offers.advanced_actions = offer.iter().map(|id| CardId::from(*id)).collect();
    state.decks.advanced_action_deck = vec![CardId::from(BOLT)];
    state.source.dice.clear();
    state.players[0].crystals.red = red_crystals;
    state.players[0].pure_mana = tokens
        .iter()
        .map(|color| ManaToken {
            color: *color,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        })
        .collect();
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
fn play_trace(
    offer: &[&str],
    tokens: &[ManaColor],
    red_crystals: u8,
    powered: bool,
    selections: &[usize],
) -> Vec<Value> {
    let mut state = setup(offer, tokens, red_crystals);
    let mut undo = UndoStack::new();
    let mut trace = vec![snapshot(&state, &undo, json!([]))];
    let action = if powered {
        LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id: CardId::from(BLOOD),
            mana_color: Some(BasicManaColor::Red),
        }
    } else {
        LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from(BLOOD),
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
fn empty_powered() -> Value {
    let mut state = setup(&[], &[], 0);
    let mut queue = EffectQueue::new();
    queue.push(
        CardEffect::BloodOfAncientsPowered,
        Some(CardId::from(BLOOD)),
    );
    json!({"result": format!("{:?}", queue.drain(&mut state, 0)), "snapshot": snapshot(&state, &UndoStack::new(), json!([]))})
}
#[test]
fn blood_matches_main_baseline() {
    let actual = json!({
      "basic_none": play_trace(&[RAGE], &[], 0, false, &[]),
      "basic_single": play_trace(&[RAGE], &[ManaColor::Red], 0, false, &[]),
      "basic_single_multiple_aa": play_trace(&[RAGE, INTIMIDATE], &[ManaColor::Red], 0, false, &[]),
      "basic_multi_mana_and_aa": play_trace(&[RAGE, INTIMIDATE, BOLT], &[ManaColor::Red, ManaColor::Blue], 0, false, &[0, 1]),
      "basic_crystal": play_trace(&[RAGE, BOLT], &[ManaColor::Red], 1, false, &[1]),
      "powered_hand_nested": play_trace(&[RITUAL, BOLT], &[ManaColor::Red], 0, true, &[0, 0, 0, 0, 0]),
      "powered_discard_second": play_trace(&[RAGE, BOLT], &[ManaColor::Red], 0, true, &[1, 1]),
      "powered_empty": empty_powered()
    });
    let expected: Value =
        serde_json::from_str(include_str!("fixtures/blood_of_ancients_main.json")).unwrap();
    assert_eq!(actual, expected);
}

#[test]
fn baseline_pauses_resume_with_the_same_results() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/blood_of_ancients_main.json")).unwrap();
    for (scenario, choices) in [
        ("basic_multi_mana_and_aa", vec![(1, 0), (2, 1)]),
        ("basic_crystal", vec![(1, 1)]),
        (
            "powered_hand_nested",
            vec![(1, 0), (2, 0), (3, 0), (4, 0), (5, 0)],
        ),
        ("powered_discard_second", vec![(1, 1), (2, 1)]),
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
