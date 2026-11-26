//! Spell Forge behavior captured from main (ee809c57), before extraction.
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
const FORGE: &str = "spell_forge";
const MARCH: &str = "march";
const FIREBALL: &str = "fireball";
const TREMOR: &str = "tremor";
const RESTORATION: &str = "restoration";
fn setup(spells: &[&str], powered: bool, capped: bool) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = [FORGE, MARCH].into_iter().map(CardId::from).collect();
    state.offers.spells = spells.iter().map(|id| CardId::from(*id)).collect();
    state.source.dice.clear();
    if powered {
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Blue,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    }
    if capped {
        state.players[0].crystals.red = 3;
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
fn play_trace(spells: &[&str], powered: bool, capped: bool, selections: &[usize]) -> Vec<Value> {
    let mut state = setup(spells, powered, capped);
    let mut undo = UndoStack::new();
    let mut trace = vec![snapshot(&state, &undo, json!([]))];
    let action = if powered {
        LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id: CardId::from(FORGE),
            mana_color: Some(BasicManaColor::Blue),
        }
    } else {
        LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from(FORGE),
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
fn no_offer(powered: bool) -> Value {
    let mut state = setup(&[], powered, false);
    let mut queue = EffectQueue::new();
    queue.push(
        if powered {
            CardEffect::SpellForgePowered
        } else {
            CardEffect::SpellForgeBasic
        },
        Some(CardId::from(FORGE)),
    );
    json!({"result": format!("{:?}", queue.drain(&mut state, 0)), "snapshot": snapshot(&state, &UndoStack::new(), json!([]))})
}
#[test]
fn spell_forge_matches_main_baseline() {
    let actual = json!({
      "basic_zero": no_offer(false), "powered_zero": no_offer(true),
      "basic_one": play_trace(&[FIREBALL], false, false, &[]),
      "basic_multiple_first": play_trace(&[FIREBALL, RESTORATION], false, false, &[0]),
      "basic_multiple_second": play_trace(&[FIREBALL, RESTORATION], false, false, &[1]),
      "basic_capped": play_trace(&[FIREBALL], false, true, &[]),
      "powered_one": play_trace(&[FIREBALL], true, false, &[]),
      "powered_multiple_first": play_trace(&[FIREBALL, RESTORATION, TREMOR], true, false, &[0, 1]),
      "powered_multiple_second": play_trace(&[FIREBALL, RESTORATION, TREMOR], true, false, &[1, 1]),
      "powered_same_color": play_trace(&[FIREBALL, TREMOR], true, false, &[0, 0])
    });
    let expected: Value =
        serde_json::from_str(include_str!("fixtures/spell_forge_main.json")).unwrap();
    assert_eq!(actual, expected);
}

#[test]
fn baseline_pauses_resume_with_the_same_results() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/spell_forge_main.json")).unwrap();
    for (scenario, choices) in [
        ("basic_multiple_first", vec![(1, 0)]),
        ("basic_multiple_second", vec![(1, 1)]),
        ("powered_multiple_first", vec![(1, 0), (2, 1)]),
        ("powered_multiple_second", vec![(1, 1), (2, 1)]),
        ("powered_same_color", vec![(1, 0), (2, 0)]),
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
fn client_choice_labels_keep_saved_offer_order() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/spell_forge_main.json")).unwrap();
    let state: GameState =
        serde_json::from_value(baseline["powered_multiple_first"][1]["state"].clone()).unwrap();
    let client = mk_engine::client_state::to_client_state(&state, &state.players[0].id);
    let pending = client.players[0].pending.as_ref().unwrap();
    assert_eq!(
        pending.options,
        vec!["Gain Red crystal", "Gain Green crystal", "Gain Red crystal"]
    );
}

#[test]
fn powered_second_choice_preserves_source_attributed_continuation() {
    use mk_types::pending::{ActivePending, ContinuationEntry};
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/spell_forge_main.json")).unwrap();
    let mut state: GameState =
        serde_json::from_value(baseline["powered_multiple_first"][1]["state"].clone()).unwrap();
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
        panic!("expected second choice")
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
        LegalAction::ResolveChoice { choice_index: 1 },
        &mut trace,
    );
    assert_eq!(state.players[0].move_points, 2);
}
