//! Behavioral traces captured from main before the Peaceful Moment pilot.
use mk_engine::{
    action_pipeline::apply_legal_action, legal_actions::enumerate_legal_actions_with_undo,
    setup::create_solo_game, undo::UndoStack,
};
use mk_types::{
    enums::{BasicManaColor, Hero, ManaColor, RoundPhase, SidewaysAs, UnitState},
    ids::{CardId, UnitId, UnitInstanceId},
    legal_action::LegalAction,
    state::{GameState, ManaToken, ManaTokenSource, PlayerUnit},
};
use serde_json::{json, Value};

const PEACEFUL: &str = "peaceful_moment";
const WOUND: &str = "wound";
const MARCH: &str = "march";
const UNIT: &str = "test_unit";
const UNIT_A: &str = "unit_a";
const UNIT_B: &str = "unit_b";

fn unit(id: &str, level: u8, spent: bool, wounded: bool) -> PlayerUnit {
    PlayerUnit {
        instance_id: UnitInstanceId::from(id),
        unit_id: UnitId::from(UNIT),
        level,
        state: if spent {
            UnitState::Spent
        } else {
            UnitState::Ready
        },
        wounded,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    }
}

fn setup(powered: bool) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = [PEACEFUL, WOUND, WOUND, MARCH]
        .into_iter()
        .map(CardId::from)
        .collect();
    if powered {
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::White,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        // Avoid an additional die source and its unrelated mana-source choice.
        for die in &mut state.source.dice {
            die.is_depleted = true;
        }
        state.players[0].units.push(unit(UNIT_A, 2, false, true));
        state.players[0].units.push(unit(UNIT_B, 1, true, false));
    }
    state
}

fn record(state: &GameState, undo: &UndoStack, events: Value) -> Value {
    let snapshot = serde_json::to_value(state).unwrap();
    let mut restored_undo = undo.clone();
    let restored = restored_undo
        .undo()
        .map(|s| serde_json::to_value(s).unwrap());
    json!({ "state": snapshot, "legal": enumerate_legal_actions_with_undo(state, 0, undo),
        "events": events, "undo_depth": undo.depth(), "checkpoint": undo.is_checkpoint_active(), "undo_state": restored })
}

fn step(state: &mut GameState, undo: &mut UndoStack, action: LegalAction, trace: &mut Vec<Value>) {
    let legal = enumerate_legal_actions_with_undo(state, 0, undo);
    assert!(
        legal.actions.contains(&action),
        "action {action:?} not in {:?}",
        legal.actions
    );
    let result = apply_legal_action(state, undo, 0, &action, legal.epoch).unwrap();
    trace.push(record(
        state,
        undo,
        serde_json::to_value(result.events).unwrap(),
    ));
    if state.players[0].pending.has_active() {
        // Exercise the serialized form at every blocking pause.
        let bytes = serde_json::to_vec(state).unwrap();
        let restored: GameState = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(
            serde_json::to_value(&restored).unwrap(),
            serde_json::to_value(&*state).unwrap()
        );
        *state = restored;
    }
}

fn trace(powered: bool, heal_unit: bool) -> Vec<Value> {
    let mut state = setup(powered);
    let mut undo = UndoStack::new();
    let mut trace = vec![record(&state, &undo, json!([]))];
    let card_id = CardId::from(PEACEFUL);
    let play = if powered {
        LegalAction::PlayCardPowered {
            hand_index: 0,
            card_id,
            mana_color: Some(BasicManaColor::White),
        }
    } else {
        LegalAction::PlayCardBasic {
            hand_index: 0,
            card_id,
        }
    };
    step(&mut state, &mut undo, play, &mut trace);
    step(
        &mut state,
        &mut undo,
        LegalAction::PlayCardSideways {
            hand_index: 2,
            card_id: CardId::from(MARCH),
            sideways_as: SidewaysAs::Influence,
        },
        &mut trace,
    );
    step(
        &mut state,
        &mut undo,
        LegalAction::BeginPeacefulMomentHealing,
        &mut trace,
    );
    if powered {
        // Done, hand wound, wounded unit, first eligible refresh target.
        step(
            &mut state,
            &mut undo,
            LegalAction::ResolveChoice {
                choice_index: if heal_unit { 2 } else { 3 },
            },
            &mut trace,
        );
    }
    step(
        &mut state,
        &mut undo,
        LegalAction::ResolveChoice { choice_index: 1 },
        &mut trace,
    );
    if state.players[0].pending.has_active() {
        step(
            &mut state,
            &mut undo,
            LegalAction::ResolveChoice { choice_index: 0 },
            &mut trace,
        );
    }
    trace
}

#[test]
fn peaceful_moment_matches_main_baseline() {
    let actual = json!({"basic": trace(false, false), "powered_refresh": trace(true, false), "powered_heal_unit": trace(true, true)});
    let expected: Value =
        serde_json::from_str(include_str!("fixtures/peaceful_moment_main.json")).unwrap();
    assert_eq!(actual, expected);
}

#[test]
fn baseline_pauses_resume_with_the_same_results() {
    let baseline: Value =
        serde_json::from_str(include_str!("fixtures/peaceful_moment_main.json")).unwrap();
    // Each state was serialized by main, before this implementation was changed.
    // Resume each saved choice independently rather than merely round-tripping it.
    for (scenario, choices) in [
        ("basic", vec![(3, 1), (4, 0)]),
        ("powered_refresh", vec![(3, 3), (4, 1), (5, 0)]),
        ("powered_heal_unit", vec![(3, 2), (4, 1)]),
    ] {
        let trace = baseline[scenario].as_array().unwrap();
        for (index, choice_index) in choices {
            let mut state: GameState =
                serde_json::from_value(trace[index]["state"].clone()).unwrap();
            let action = LegalAction::ResolveChoice { choice_index };
            let mut undo = UndoStack::new();
            let legal = enumerate_legal_actions_with_undo(&state, 0, &undo);
            assert!(legal.actions.contains(&action));
            let result =
                apply_legal_action(&mut state, &mut undo, 0, &action, legal.epoch).unwrap();
            assert_eq!(
                serde_json::to_value(&state).unwrap(),
                trace[index + 1]["state"],
                "{scenario} at {index}"
            );
            assert_eq!(
                serde_json::to_value(result.events).unwrap(),
                trace[index + 1]["events"],
                "{scenario} at {index}"
            );
        }
    }
}

#[test]
fn conversion_preserves_saved_continuation_until_done() {
    use mk_types::{
        effect::CardEffect,
        pending::{
            ActivePending, ChoiceResolution, ContinuationEntry, PeacefulMomentOption, PendingChoice,
        },
    };
    let mut state = setup(false);
    state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
        card_id: Some(CardId::from(PEACEFUL)),
        skill_id: None,
        unit_instance_id: None,
        options: vec![CardEffect::Noop; 2],
        continuation: vec![ContinuationEntry {
            effect: CardEffect::GainMove { amount: 2 },
            source_card_id: Some(CardId::from(MARCH)),
        }],
        movement_bonus_applied: false,
        resolution: ChoiceResolution::PeacefulMomentConversion {
            influence_remaining: 4,
            allow_refresh: false,
            refreshed: false,
            option_map: vec![PeacefulMomentOption::Done, PeacefulMomentOption::HealWound],
        },
    }));
    let mut undo = UndoStack::new();
    let mut trace = Vec::new();
    step(
        &mut state,
        &mut undo,
        LegalAction::ResolveChoice { choice_index: 1 },
        &mut trace,
    );
    assert_eq!(state.players[0].move_points, 0);
    let pending = match &state.players[0].pending.active {
        Some(ActivePending::Choice(choice)) => choice,
        other => panic!("expected conversion choice, got {other:?}"),
    };
    assert_eq!(pending.card_id.as_ref().map(CardId::as_str), Some(PEACEFUL));
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
    assert!(!state.players[0].pending.has_active());
}
