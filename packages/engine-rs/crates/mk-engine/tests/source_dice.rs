use mk_engine::action_pipeline::apply_legal_action;
use mk_engine::legal_actions::enumerate_legal_actions_with_undo;
use mk_engine::setup::create_solo_game;
use mk_engine::undo::UndoStack;
use mk_types::enums::{Hero, ManaColor, RoundPhase, TimeOfDay};
use mk_types::ids::{CardId, SourceDieId};
use mk_types::legal_action::LegalAction;
use mk_types::rng::RngState;
use mk_types::state::{GameState, SourceDie};

const MANA_STORM: &str = "mana_storm";
const WINGS_OF_WIND: &str = "wings_of_wind";
const WHITE_DIE: &str = "test_white_die";

fn setup(cards: &[&str]) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.time_of_day = TimeOfDay::Day;
    state.players[0].hand = cards.iter().map(|card| CardId::from(*card)).collect();
    state.players[0].pure_mana.clear();
    state.players[0].crystals = Default::default();
    state.source.dice.clear();
    state
}

fn source_die(id: &str, color: ManaColor) -> SourceDie {
    SourceDie {
        id: SourceDieId::from(id),
        color,
        is_depleted: false,
        taken_by_player_id: None,
    }
}

fn apply(
    state: &mut GameState,
    undo: &mut UndoStack,
    player_idx: usize,
    predicate: impl Fn(&LegalAction) -> bool,
) {
    let legal = enumerate_legal_actions_with_undo(state, player_idx, undo);
    let action = legal
        .actions
        .iter()
        .find(|action| predicate(action))
        .expect("expected legal action");
    apply_legal_action(state, undo, player_idx, action, legal.epoch).unwrap();
}

fn powered(state: &mut GameState, undo: &mut UndoStack, card: &str) {
    apply(state, undo, 0, |action| {
        matches!(
            action, LegalAction::PlayCardPowered { card_id, .. } if card_id.as_str() == card
        )
    });
}

#[test]
fn mana_storm_cannot_reroll_or_reuse_its_payment_die() {
    let mut state = setup(&[MANA_STORM, WINGS_OF_WIND]);
    let mut undo = UndoStack::new();
    state
        .source
        .dice
        .push(source_die(WHITE_DIE, ManaColor::White));
    // A white result makes the prematurely returned die usable for a second cast.
    state.rng = RngState::new(
        (0..100)
            .find(|&seed| {
                let mut rng = RngState::new(seed);
                (rng.next_f64() * 6.0) as usize == 3
            })
            .unwrap(),
    );
    let before = state.rng;

    powered(&mut state, &mut undo, MANA_STORM);

    assert_eq!(
        state.source.dice[0].taken_by_player_id.as_ref(),
        Some(&state.players[0].id)
    );
    assert_eq!(state.rng.counter, before.counter);
    assert!(!enumerate_legal_actions_with_undo(&state, 0, &undo).actions.iter().any(|action| {
        matches!(action, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == WINGS_OF_WIND)
    }));
}

const MANA_DRAW: &str = "mana_draw";
const MARCH: &str = "march";
const STAMINA: &str = "stamina";
const CRYSTALLIZE: &str = "crystallize";
const GREEN_DIE: &str = "test_green_die";
const BLUE_DIE: &str = "test_blue_die";
const RED_DIE: &str = "test_red_die";
const BLACK_DIE: &str = "test_black_die";

fn basic(state: &mut GameState, undo: &mut UndoStack, card: &str) {
    apply(state, undo, 0, |action| {
        matches!(
            action, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == card
        )
    });
}

#[test]
fn mana_draw_allows_two_shared_spends_across_action_cards_and_spells() {
    let mut state = setup(&[MANA_DRAW, MARCH, STAMINA, WINGS_OF_WIND]);
    let mut undo = UndoStack::new();
    state.source.dice = vec![
        source_die(GREEN_DIE, ManaColor::Green),
        source_die(BLUE_DIE, ManaColor::Blue),
        source_die(WHITE_DIE, ManaColor::White),
    ];

    basic(&mut state, &mut undo, MANA_DRAW);
    powered(&mut state, &mut undo, MARCH);
    powered(&mut state, &mut undo, STAMINA);
    assert_eq!(
        state.players[0].used_die_ids,
        vec![SourceDieId::from(GREEN_DIE), SourceDieId::from(BLUE_DIE)]
    );
    assert!(!enumerate_legal_actions_with_undo(&state, 0, &undo).actions.iter().any(|action| {
        matches!(action, LegalAction::PlayCardBasic { card_id, .. } if card_id.as_str() == WINGS_OF_WIND)
    }));

    apply(&mut state, &mut undo, 0, |action| {
        matches!(action, LegalAction::Undo)
    });
    basic(&mut state, &mut undo, WINGS_OF_WIND);
    assert_eq!(
        state.players[0].used_die_ids,
        vec![SourceDieId::from(GREEN_DIE), SourceDieId::from(WHITE_DIE)]
    );
}

#[test]
fn crystallize_uses_the_same_extra_die_allowance() {
    let mut state = setup(&[MANA_DRAW, MARCH, CRYSTALLIZE, STAMINA]);
    let mut undo = UndoStack::new();
    state.source.dice = vec![
        source_die(GREEN_DIE, ManaColor::Green),
        source_die(RED_DIE, ManaColor::Red),
    ];

    basic(&mut state, &mut undo, MANA_DRAW);
    powered(&mut state, &mut undo, MARCH);
    basic(&mut state, &mut undo, CRYSTALLIZE);
    assert_eq!(state.players[0].crystals.red, 1);
    assert_eq!(
        state.players[0].used_die_ids,
        vec![SourceDieId::from(GREEN_DIE), SourceDieId::from(RED_DIE)]
    );
}

#[test]
fn reserved_mana_steal_die_is_additional_and_returns_after_use_in_multiplayer() {
    use mk_engine::setup::create_two_player_game;
    use mk_types::state::StoredManaDie;

    let mut state = create_two_player_game(42, Hero::Arythea, Hero::Tovak);
    state.round_phase = RoundPhase::PlayerTurns;
    state.players[0].hand = vec![CardId::from(STAMINA), CardId::from(MARCH)];
    state.players[0].pure_mana.clear();
    state.players[0].crystals = Default::default();
    let player_id = state.players[0].id.clone();
    let mut reserved = source_die(GREEN_DIE, ManaColor::Green);
    reserved.taken_by_player_id = Some(player_id.clone());
    state.source.dice = vec![source_die(BLUE_DIE, ManaColor::Blue), reserved];
    state.players[0].tactic_state.stored_mana_die = Some(StoredManaDie {
        die_id: SourceDieId::from(GREEN_DIE),
        color: ManaColor::Green,
    });
    let mut undo = UndoStack::new();

    powered(&mut state, &mut undo, STAMINA);
    powered(&mut state, &mut undo, MARCH);
    assert_eq!(
        state.players[0].used_die_ids,
        vec![SourceDieId::from(BLUE_DIE)]
    );
    assert!(state.players[0].tactic_state.mana_steal_used_this_turn);
    let before = state.rng.counter;
    apply(&mut state, &mut undo, 0, |action| {
        matches!(action, LegalAction::EndTurn)
    });
    assert_eq!(
        state.rng.counter - before,
        2,
        "each spent die is rerolled once"
    );
    assert!(state
        .source
        .dice
        .iter()
        .all(|die| die.taken_by_player_id.is_none()));
    assert!(state.players[0].tactic_state.stored_mana_die.is_none());
}

#[test]
fn normal_end_turn_rerolls_spent_dice_but_returns_mana_draw_on_its_chosen_face() {
    use mk_types::state::{ManaToken, ManaTokenSource};

    let mut state = setup(&[MANA_DRAW, MARCH]);
    let mut undo = UndoStack::new();
    state.source.dice = vec![
        source_die(BLUE_DIE, ManaColor::Blue),
        source_die(GREEN_DIE, ManaColor::Green),
    ];
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    powered(&mut state, &mut undo, MANA_DRAW);
    apply(&mut state, &mut undo, 0, |action| {
        matches!(action, LegalAction::ResolveChoice { choice_index: 0 })
    });
    powered(&mut state, &mut undo, MARCH);
    let before = state.rng.counter;
    apply(&mut state, &mut undo, 0, |action| {
        matches!(action, LegalAction::EndTurn)
    });
    assert_eq!(
        state.rng.counter - before,
        1,
        "reroll the spent die and keep Mana Draw's face"
    );
    assert_eq!(state.source.dice[0].color, ManaColor::Red);
    assert!(state
        .source
        .dice
        .iter()
        .all(|die| die.taken_by_player_id.is_none()));
}

#[test]
fn stale_spell_payment_keeps_both_sources_and_the_pending_choice() {
    use mk_types::state::{ManaToken, ManaTokenSource};
    const RESTORATION: &str = "restoration";
    const WOUND: &str = "wound";

    let mut state = setup(&[RESTORATION, WOUND]);
    state.time_of_day = TimeOfDay::Night;
    state.players[0].crystals.green = 1;
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Black,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state
        .source
        .dice
        .push(source_die(BLACK_DIE, ManaColor::Black));
    let mut undo = UndoStack::new();
    powered(&mut state, &mut undo, RESTORATION);

    // Simulate a saved prompt whose shared-die option has become unavailable.
    state.source.dice[0].taken_by_player_id = Some(state.players[0].id.clone());
    let before = serde_json::to_value(&state.players[0].pending.active).unwrap();
    let epoch = state.action_epoch;
    let result = apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ResolveChoice { choice_index: 1 },
        epoch,
    );

    assert!(result.is_err());
    assert_eq!(state.players[0].crystals.green, 1);
    assert_eq!(state.players[0].pure_mana.len(), 1);
    assert_eq!(
        serde_json::to_value(&state.players[0].pending.active).unwrap(),
        before
    );
}

#[test]
fn mana_storm_leaves_held_dice_alone_and_rerolls_depleted_source_dice() {
    use mk_types::state::{ManaToken, ManaTokenSource};

    let mut state = setup(&[MANA_STORM]);
    let mut undo = UndoStack::new();
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::White,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let held = source_die(RED_DIE, ManaColor::Red);
    state.players[0].used_die_ids.push(held.id.clone());
    let mut depleted = source_die(BLACK_DIE, ManaColor::Black);
    depleted.is_depleted = true;
    state.source.dice = vec![held, depleted];
    let before = state.rng.counter;

    powered(&mut state, &mut undo, MANA_STORM);

    assert_eq!(state.rng.counter - before, 1);
    assert_eq!(state.source.dice[0].color, ManaColor::Red);
}

#[test]
fn source_opening_does_not_reroll_its_die_again_at_turn_end() {
    use mk_types::pending::ActivePending;

    for reroll in [false, true] {
        let mut state = setup(&[MARCH]);
        let mut undo = UndoStack::new();
        state
            .source
            .dice
            .push(source_die(GREEN_DIE, ManaColor::Green));
        powered(&mut state, &mut undo, MARCH);
        state.players[0].end_turn_step = 4;
        state.players[0].pending.active = Some(ActivePending::SourceOpeningReroll {
            die_id: SourceDieId::from(GREEN_DIE),
        });

        let before = state.rng.counter;
        apply(
            &mut state,
            &mut undo,
            0,
            |action| matches!(action, LegalAction::ResolveSourceOpeningReroll { reroll: choice } if *choice == reroll),
        );
        assert_eq!(state.rng.counter - before, u32::from(reroll));
        assert!(state.source.dice[0].taken_by_player_id.is_none());
        if !reroll {
            assert_eq!(state.source.dice[0].color, ManaColor::Green);
        }
    }
}

#[test]
fn end_turn_returns_dice_before_pausing_for_level_up_rewards() {
    use mk_types::pending::ActivePending;

    let mut state = setup(&[MARCH]);
    let mut undo = UndoStack::new();
    state.players[0].fame = 3;
    state
        .source
        .dice
        .push(source_die(GREEN_DIE, ManaColor::Green));
    powered(&mut state, &mut undo, MARCH);

    apply(&mut state, &mut undo, 0, |action| {
        matches!(action, LegalAction::EndTurn)
    });
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::LevelUpReward(_))
    ));
    assert!(state.source.dice[0].taken_by_player_id.is_none());
    assert!(state.players[0].used_die_ids.is_empty());
}

#[test]
fn mana_claim_die_remains_out_of_the_source_after_the_turn() {
    use mk_types::state::{ManaToken, ManaTokenSource};
    const MANA_CLAIM: &str = "mana_claim";

    let mut state = setup(&[MANA_CLAIM]);
    let mut undo = UndoStack::new();
    state.source.dice.push(source_die(RED_DIE, ManaColor::Red));
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Blue,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });

    basic(&mut state, &mut undo, MANA_CLAIM);
    apply(&mut state, &mut undo, 0, |action| {
        matches!(action, LegalAction::ResolveChoice { choice_index: 0 })
    });
    assert!(state.players[0].used_die_ids.is_empty());
    apply(&mut state, &mut undo, 0, |action| {
        matches!(action, LegalAction::EndTurn)
    });
    assert_eq!(
        state.source.dice[0].taken_by_player_id.as_ref(),
        Some(&state.players[0].id)
    );
}
