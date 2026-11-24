//! Baselines recorded from main (d4c1a5b5), before the Magic Talent extraction.
use mk_engine::{
    action_pipeline::apply_legal_action, effect_queue::EffectQueue,
    legal_actions::enumerate_legal_actions_with_undo, setup::create_solo_game, undo::UndoStack,
};
use mk_types::{
    effect::CardEffect,
    enums::{BasicManaColor, Hero, ManaColor, RoundPhase},
    ids::CardId,
    legal_action::LegalAction,
    pending::{ActivePending, ChoiceResolution, ContinuationEntry, PendingChoice},
    state::{GameState, ManaToken, ManaTokenSource},
};
use serde_json::{json, Value};

const MAGIC_TALENT: &str = "magic_talent";
const MARCH: &str = "march";
const MIND_READ: &str = "mind_read";
const FIREBALL: &str = "fireball";
const TREMOR: &str = "tremor";
const RESTORATION: &str = "restoration";

fn setup(spells: &[&str], powered: bool) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = [MAGIC_TALENT, MARCH]
        .into_iter()
        .map(CardId::from)
        .collect();
    state.offers.spells = spells.iter().map(|id| CardId::from(*id)).collect();
    state.decks.spell_deck = vec![CardId::from(RESTORATION)];
    if powered {
        state.source.dice.clear();
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Blue,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    }
    state
}

fn snapshot(state: &GameState, undo: &UndoStack, events: Value) -> Value {
    let mut restore = undo.clone();
    json!({ "state": state, "legal": enumerate_legal_actions_with_undo(state, 0, undo),
      "events": events, "undo_depth": undo.depth(), "checkpoint": undo.is_checkpoint_active(), "undo_state": restore.undo() })
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
        let bytes = serde_json::to_vec(state).unwrap();
        let restored: GameState = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(
            serde_json::to_value(&restored).unwrap(),
            serde_json::to_value(&*state).unwrap()
        );
        *state = restored;
    }
}

fn play_trace(spells: &[&str], powered: bool, first_choice: usize) -> Vec<Value> {
    let mut state = setup(spells, powered);
    let mut undo = UndoStack::new();
    let mut trace = vec![snapshot(&state, &undo, json!([]))];
    let id = CardId::from(MAGIC_TALENT);
    let action = if powered {
        LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id: id,
            mana_color: Some(BasicManaColor::Blue),
        }
    } else {
        LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: id,
        }
    };
    step(&mut state, &mut undo, action, &mut trace);
    // Select the first spell, then any nested crystal choice.
    let mut choice_index = first_choice;
    while state.players[0].pending.has_active() {
        step(
            &mut state,
            &mut undo,
            LegalAction::ResolveChoice { choice_index },
            &mut trace,
        );
        choice_index = 0;
    }
    trace
}

fn zero_trace(powered: bool) -> Value {
    let mut state = setup(&[], powered);
    let mut queue = EffectQueue::new();
    queue.push(
        if powered {
            CardEffect::MagicTalentPowered
        } else {
            CardEffect::MagicTalentBasic
        },
        Some(CardId::from(MAGIC_TALENT)),
    );
    let result = format!("{:?}", queue.drain(&mut state, 0));
    json!({"result": result, "snapshot": snapshot(&state, &UndoStack::new(), json!([]))})
}

fn continuation_trace() -> Vec<Value> {
    let mut state = setup(&[MIND_READ, FIREBALL], false);
    state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
        card_id: Some(CardId::from(MAGIC_TALENT)),
        skill_id: None,
        unit_instance_id: None,
        options: vec![CardEffect::Noop; 2],
        continuation: vec![ContinuationEntry {
            effect: CardEffect::GainMove { amount: 2 },
            source_card_id: Some(CardId::from(MARCH)),
        }],
        movement_bonus_applied: false,
        resolution: ChoiceResolution::MagicTalentSpellSelect {
            spell_entries: vec![
                (0, CardId::from(MIND_READ), BasicManaColor::White),
                (1, CardId::from(FIREBALL), BasicManaColor::Red),
            ],
        },
    }));
    let mut undo = UndoStack::new();
    let mut trace = vec![snapshot(&state, &undo, json!([]))];
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
    trace
}

#[test]
fn magic_talent_matches_main_baseline() {
    let actual = json!({
       "basic_zero": zero_trace(false), "powered_zero": zero_trace(true),
       "basic_one_nested": play_trace(&[MIND_READ], false, 0),
       "basic_multiple_nested": play_trace(&[MIND_READ, FIREBALL], false, 0),
       "powered_one": play_trace(&[FIREBALL], true, 0),
       "powered_multiple": play_trace(&[FIREBALL, TREMOR], true, 0),
       "nested_continuation": continuation_trace(),
       "basic_multiple_second": play_trace(&[MIND_READ, FIREBALL], false, 1),
       "powered_multiple_second": play_trace(&[FIREBALL, TREMOR], true, 1)
    });
    let expected: Value =
        serde_json::from_str(include_str!("fixtures/magic_talent_main.json")).unwrap();
    assert_eq!(actual, expected);
}

#[test]
fn baseline_pauses_resume_with_the_same_results() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/magic_talent_main.json")).unwrap();
    for scenario in [
        "basic_one_nested",
        "basic_multiple_nested",
        "powered_multiple",
        "nested_continuation",
        "basic_multiple_second",
        "powered_multiple_second",
    ] {
        let trace = baseline[scenario].as_array().unwrap();
        for index in 0..trace.len() - 1 {
            let mut state: GameState =
                serde_json::from_value(trace[index]["state"].clone()).unwrap();
            if !state.players[0].pending.has_active() {
                continue;
            }
            let mut undo = UndoStack::new();
            let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
            let choice_index = usize::from(scenario.ends_with("_second") && index == 1);
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
