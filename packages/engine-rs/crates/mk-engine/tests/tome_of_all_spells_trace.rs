//! Tome of All Spells behavior captured from main (5fcb5e11), before extraction.
use mk_engine::{
    action_pipeline::apply_legal_action, effect_queue::EffectQueue,
    legal_actions::enumerate_legal_actions_with_undo, setup::create_solo_game, undo::UndoStack,
};
use mk_types::{
    effect::CardEffect,
    enums::{Hero, RoundPhase},
    ids::CardId,
    legal_action::LegalAction,
    pending::EffectMode,
    state::GameState,
};
use serde_json::{json, Value};
const TOME: &str = "tome_of_all_spells";
const WOUND: &str = "wound";
const FIREBALL: &str = "fireball";
const RAGE: &str = "rage";
const MANA_MELTDOWN: &str = "mana_meltdown";
const FLAME_WALL: &str = "flame_wall";
const ICE_BOLT: &str = "ice_bolt";
const RESTORATION: &str = "restoration";
const TREMOR: &str = "tremor";
const MIND_READ: &str = "mind_read";
const PROMISE: &str = "promise";
fn setup(offer: &[&str], _powered: bool) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = [TOME, WOUND, FIREBALL, RAGE]
        .into_iter()
        .map(CardId::from)
        .collect();
    state.offers.spells = offer.iter().map(|id| CardId::from(*id)).collect();
    state.decks.spell_deck = vec![CardId::from(RESTORATION)];
    state.decks.advanced_action_deck = vec![CardId::from(ICE_BOLT)];
    state.source.dice.clear();
    if offer.contains(&MANA_MELTDOWN) {
        state.players[0].crystals.red = 1;
        state.players[0].crystals.green = 1;
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
            card_id: CardId::from(TOME),
            mana_color: None,
        }
    } else {
        LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id: CardId::from(TOME),
        }
    };
    step(&mut state, &mut undo, action, &mut trace);
    step(
        &mut state,
        &mut undo,
        LegalAction::ResolveTomeOfAllSpells { selection_index: 2 },
        &mut trace,
    );
    if let Some(selection_index) = offer_choice {
        step(
            &mut state,
            &mut undo,
            LegalAction::ResolveTomeOfAllSpells { selection_index },
            &mut trace,
        );
    }
    trace
}
fn no_eligible() -> Value {
    let mut state = setup(&[FIREBALL], false);
    state.players[0].hand = vec![CardId::from(WOUND), CardId::from(FIREBALL)];
    let mut queue = EffectQueue::new();
    queue.push(
        CardEffect::TomeOfAllSpells {
            mode: EffectMode::Basic,
        },
        Some(CardId::from(TOME)),
    );
    json!({"result": format!("{:?}", queue.drain(&mut state, 0)), "snapshot": snapshot(&state, &UndoStack::new(), json!([]))})
}
#[test]
fn tome_matches_main_baseline() {
    let mut actual = json!({"no_eligible": no_eligible(), "basic_no_match": play_trace(&[RESTORATION], false, None), "basic_one": play_trace(&[FIREBALL], false, Some(0)), "basic_multiple_first": play_trace(&[FIREBALL, TREMOR], false, Some(0)), "basic_multiple_second": play_trace(&[FIREBALL, TREMOR], false, Some(1)), "basic_nested": play_trace(&[FLAME_WALL], false, Some(0)), "powered_nested": play_trace(&[MANA_MELTDOWN], true, Some(0)), "powered_one": play_trace(&[FIREBALL], true, Some(0)), "powered_multiple_second": play_trace(&[FIREBALL, TREMOR], true, Some(1))});
    let mut expected: Value =
        serde_json::from_str(include_str!("fixtures/tome_of_all_spells_main.json")).unwrap();
    // This legacy trace deliberately captured the lost Mana Meltdown choice.
    // The corrected behavior is asserted independently below.
    actual.as_object_mut().unwrap().remove("powered_nested");
    expected.as_object_mut().unwrap().remove("powered_nested");
    assert_eq!(actual, expected);
}

#[test]
fn baseline_pauses_resume_with_the_same_results() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/tome_of_all_spells_main.json")).unwrap();
    for (scenario, choices) in [
        ("basic_no_match", vec![(1, 2)]),
        ("basic_one", vec![(1, 2), (2, 0)]),
        ("basic_multiple_first", vec![(1, 2), (2, 0)]),
        ("basic_multiple_second", vec![(1, 2), (2, 1)]),
        ("basic_nested", vec![(1, 2), (2, 0)]),
        ("powered_one", vec![(1, 2), (2, 0)]),
        ("powered_multiple_second", vec![(1, 2), (2, 1)]),
    ] {
        let trace = baseline[scenario].as_array().unwrap();
        for (index, selection_index) in choices {
            let mut state: GameState =
                serde_json::from_value(trace[index]["state"].clone()).unwrap();
            let mut undo = UndoStack::new();
            let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
            let action = LegalAction::ResolveTomeOfAllSpells { selection_index };
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
fn invalid_selections_restore_pending_in_both_phases() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/tome_of_all_spells_main.json")).unwrap();
    let trace = baseline["basic_multiple_first"].as_array().unwrap();
    for index in [1, 2] {
        let mut state: GameState = serde_json::from_value(trace[index]["state"].clone()).unwrap();
        let pending_before = serde_json::to_value(&state.players[0].pending.active).unwrap();
        let mut undo = UndoStack::new();
        let epoch = state.action_epoch;
        let result = apply_legal_action(
            &mut state,
            &mut undo,
            0,
            &LegalAction::ResolveTomeOfAllSpells {
                selection_index: usize::MAX,
            },
            epoch,
        );
        assert!(result.is_err());
        assert_eq!(
            serde_json::to_value(&state.players[0].pending.active).unwrap(),
            pending_before
        );
    }
}

#[test]
fn powered_tome_preserves_spell_choice_and_resumes_after_serialization() {
    use mk_types::pending::{ActivePending, ChoiceResolution};

    let mut state = setup(&[MANA_MELTDOWN], true);
    let mut undo = UndoStack::new();
    let mut trace = Vec::new();
    step(&mut state, &mut undo, LegalAction::PlayCardPowered {
        hand_index: 0, card_id: CardId::from(TOME), mana_color: None,
    }, &mut trace);
    step(&mut state, &mut undo,
        LegalAction::ResolveTomeOfAllSpells { selection_index: 2 }, &mut trace);
    let rng_before = serde_json::to_value(&state.rng).unwrap();
    let undo_before = (undo.depth(), undo.is_checkpoint_active());
    step(&mut state, &mut undo,
        LegalAction::ResolveTomeOfAllSpells { selection_index: 0 }, &mut trace);

    match &state.players[0].pending.active {
        Some(ActivePending::Choice(choice)) => {
            assert_eq!(choice.card_id, Some(CardId::from(MANA_MELTDOWN)));
            assert!(matches!(&choice.resolution,
                ChoiceResolution::ManaMeltdownColorSelect { available_colors }
                    if available_colors.len() == 2));
        }
        other => panic!("expected Mana Meltdown choice, got {other:?}"),
    }
    assert_eq!(serde_json::to_value(&state.rng).unwrap(), rng_before);
    assert_eq!((undo.depth(), undo.is_checkpoint_active()), (undo_before.0 + 1, undo_before.1));
    assert_eq!(state.offers.spells, vec![CardId::from(MANA_MELTDOWN)]);
    let choices = enumerate_legal_actions_with_undo(&state, 0, &undo);
    assert!(choices.actions.contains(&LegalAction::ResolveChoice { choice_index: 0 }));
    assert!(choices.actions.contains(&LegalAction::ResolveChoice { choice_index: 1 }));

    // `step` serializes and restores every pending state before continuing.
    step(&mut state, &mut undo, LegalAction::ResolveChoice { choice_index: 0 }, &mut trace);
    assert!(!state.players[0].pending.has_active());
    assert_eq!(state.players[0].crystals.red, 3);
    assert_eq!(state.players[0].crystals.green, 1);
    let events: Vec<mk_types::events::GameEvent> =
        serde_json::from_value(trace.last().unwrap()["events"].clone()).unwrap();
    assert!(events.iter().any(|event| matches!(event,
        mk_types::events::GameEvent::ChoiceResolved { card_id: Some(id), .. }
            if id.as_str() == MANA_MELTDOWN)));
    assert!(state.players[0].hand.iter().any(|id| id.as_str() == WOUND));
    assert_eq!(serde_json::to_value(&state.rng).unwrap(), rng_before);
}

#[test]
fn basic_tome_installs_and_resolves_mind_read_choice() {
    use mk_types::pending::{ActivePending, ChoiceResolution};
    let mut state = setup(&[MIND_READ], false);
    state.players[0].hand[3] = CardId::from(PROMISE);
    let mut undo = UndoStack::new();
    let mut trace = Vec::new();
    step(&mut state, &mut undo, LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from(TOME),
    }, &mut trace);
    step(&mut state, &mut undo,
        LegalAction::ResolveTomeOfAllSpells { selection_index: 2 }, &mut trace);
    step(&mut state, &mut undo,
        LegalAction::ResolveTomeOfAllSpells { selection_index: 0 }, &mut trace);
    assert!(matches!(&state.players[0].pending.active,
        Some(ActivePending::Choice(choice))
            if choice.card_id == Some(CardId::from(MIND_READ))
                && matches!(choice.resolution, ChoiceResolution::MindReadColorSelect { .. })));
    step(&mut state, &mut undo, LegalAction::ResolveChoice { choice_index: 0 }, &mut trace);
    assert!(!state.players[0].pending.has_active());
    assert_eq!(state.players[0].crystals.red, 1);
    assert_eq!(state.offers.spells, vec![CardId::from(MIND_READ)]);
}
