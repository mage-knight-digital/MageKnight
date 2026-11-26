//! Mana Storm behavior captured from main (f8962f94), before extraction.
use mk_engine::{
    action_pipeline::apply_legal_action, effect_queue::EffectQueue,
    legal_actions::enumerate_legal_actions_with_undo, setup::create_solo_game, undo::UndoStack,
};
use mk_types::{
    effect::CardEffect,
    enums::{BasicManaColor, Hero, ManaColor, RoundPhase},
    ids::{CardId, SourceDieId},
    legal_action::LegalAction,
    state::{GameState, ManaToken, ManaTokenSource, SourceDie},
};
use serde_json::{json, Value};
const STORM: &str = "mana_storm";
const MARCH: &str = "march";
const DICE: [&str; 4] = ["die_a", "die_b", "die_c", "die_d"];
fn setup(colors: &[ManaColor], powered: bool, capped: bool, seed: u32) -> GameState {
    let mut state = create_solo_game(seed, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = [STORM, MARCH].into_iter().map(CardId::from).collect();
    state.source.dice = colors
        .iter()
        .enumerate()
        .map(|(i, color)| SourceDie {
            id: SourceDieId::from(DICE[i]),
            color: *color,
            is_depleted: false,
            taken_by_player_id: None,
        })
        .collect();
    if powered {
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::White,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        if state.source.dice.len() > 1 {
            state.source.dice[1].is_depleted = true;
        }
        if state.source.dice.len() > 2 {
            state.source.dice[2].taken_by_player_id = Some(state.players[0].id.clone());
        }
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
fn play_trace(
    colors: &[ManaColor],
    powered: bool,
    capped: bool,
    seed: u32,
    selection: Option<usize>,
) -> Vec<Value> {
    let mut state = setup(colors, powered, capped, seed);
    let mut undo = UndoStack::new();
    let mut trace = vec![snapshot(&state, &undo, json!([]))];
    let action = if powered {
        LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id: CardId::from(STORM),
            mana_color: Some(BasicManaColor::White),
        }
    } else {
        LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from(STORM),
        }
    };
    step(&mut state, &mut undo, action, &mut trace);
    if let Some(choice_index) = selection {
        step(
            &mut state,
            &mut undo,
            LegalAction::ResolveChoice { choice_index },
            &mut trace,
        );
    }
    trace
}
fn no_eligible() -> Value {
    let mut state = setup(&[ManaColor::Gold, ManaColor::Black], false, false, 42);
    let mut queue = EffectQueue::new();
    queue.push(CardEffect::ManaStormBasic, Some(CardId::from(STORM)));
    json!({"result": format!("{:?}", queue.drain(&mut state, 0)), "snapshot": snapshot(&state, &UndoStack::new(), json!([]))})
}
fn unavailable_dice() -> Value {
    let mut state = setup(&[ManaColor::Red, ManaColor::Blue], false, false, 42);
    state.source.dice[0].is_depleted = true;
    state.source.dice[1].taken_by_player_id = Some(state.players[0].id.clone());
    let mut queue = EffectQueue::new();
    queue.push(CardEffect::ManaStormBasic, Some(CardId::from(STORM)));
    json!({"result": format!("{:?}", queue.drain(&mut state, 0)), "snapshot": snapshot(&state, &UndoStack::new(), json!([]))})
}
#[test]
fn mana_storm_matches_main_baseline() {
    let actual = json!({"no_eligible": no_eligible(), "unavailable_dice": unavailable_dice(),
      "basic_single": play_trace(&[ManaColor::Red], false, false, 42, None),
      "basic_capped": play_trace(&[ManaColor::Red], false, true, 42, None),
      "basic_multiple_first": play_trace(&[ManaColor::Red, ManaColor::Blue], false, false, 42, Some(0)),
      "basic_multiple_second": play_trace(&[ManaColor::Red, ManaColor::Blue], false, false, 42, Some(1)),
      "basic_other_seed": play_trace(&[ManaColor::Red, ManaColor::Blue], false, false, 99, Some(0)),
      "powered_all": play_trace(&[ManaColor::Red, ManaColor::Blue, ManaColor::Green], true, false, 42, None),
      "powered_other_seed": play_trace(&[ManaColor::Red, ManaColor::Blue, ManaColor::Green], true, false, 99, None)
    });
    let expected: Value =
        serde_json::from_str(include_str!("fixtures/mana_storm_main.json")).unwrap();
    assert_eq!(actual, expected);
}

#[test]
fn baseline_pauses_resume_with_the_same_results() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/mana_storm_main.json")).unwrap();
    for (scenario, choice_index) in [
        ("basic_multiple_first", 0),
        ("basic_multiple_second", 1),
        ("basic_other_seed", 0),
    ] {
        let trace = baseline[scenario].as_array().unwrap();
        let mut state: GameState = serde_json::from_value(trace[1]["state"].clone()).unwrap();
        let mut undo = UndoStack::new();
        let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
        let action = LegalAction::ResolveChoice { choice_index };
        assert!(legal.actions.contains(&action), "{scenario}");
        let result = apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();
        assert_eq!(
            serde_json::to_value(&state).unwrap(),
            trace[2]["state"],
            "{scenario}"
        );
        assert_eq!(
            serde_json::to_value(result.events).unwrap(),
            trace[2]["events"],
            "{scenario}"
        );
    }
}

#[test]
fn client_choice_labels_keep_saved_dice_order() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/mana_storm_main.json")).unwrap();
    let state: GameState =
        serde_json::from_value(baseline["basic_multiple_first"][1]["state"].clone()).unwrap();
    let client = mk_engine::client_state::to_client_state(&state, &state.players[0].id);
    assert_eq!(
        client.players[0].pending.as_ref().unwrap().options,
        vec!["Take Red die", "Take Blue die"]
    );
}

#[test]
fn selected_die_preserves_source_attributed_continuation() {
    use mk_types::pending::{ActivePending, ContinuationEntry};
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/mana_storm_main.json")).unwrap();
    let mut state: GameState =
        serde_json::from_value(baseline["basic_multiple_first"][1]["state"].clone()).unwrap();
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
    assert_eq!(state.players[0].move_points, 2);
    assert!(!state.players[0].pending.has_active());
}
