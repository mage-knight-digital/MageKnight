use mk_engine::action_pipeline::apply_legal_action;
use mk_engine::legal_actions::enumerate_legal_actions;
use mk_engine::setup::create_solo_game;
use mk_engine::undo::UndoStack;
use mk_types::enums::{CombatPhase, Hero, ManaColor, RoundPhase, TimeOfDay};
use mk_types::ids::{CardId, ModifierId, SourceDieId};
use mk_types::legal_action::LegalAction;
use mk_types::modifier::{
    ActiveModifier, ModifierDuration, ModifierEffect, ModifierScope, ModifierSource, RuleOverride,
};
use mk_types::pending::{ActivePending, CardManaPayment, ChoiceResolution};
use mk_types::state::{CombatState, GameState, ManaToken, ManaTokenSource, SourceDie};

const RESTORATION: &str = "restoration";
const WOUND: &str = "wound";
const FIREBALL: &str = "fireball";
const WINGS_OF_WIND: &str = "wings_of_wind";
const RED_DIE: &str = "red_die";
const BLACK_DIE: &str = "black_die";
const ADDITIONAL_DIE: &str = "additional_die";
const BLACK_AT_DAY: &str = "black_at_day";
const RING: &str = "ring";

fn spell_state(card: &str, time_of_day: TimeOfDay) -> GameState {
    let mut state = create_solo_game(42, Hero::Arythea);
    state.round_phase = RoundPhase::PlayerTurns;
    state.time_of_day = time_of_day;
    state.source.dice.clear();
    state.players[0].hand = vec![CardId::from(card)];
    if card == RESTORATION {
        state.players[0].hand.push(CardId::from(WOUND));
    }
    state.players[0].pure_mana.clear();
    state.players[0].crystals = Default::default();
    state
}

fn mana_token(color: ManaColor) -> ManaToken {
    ManaToken {
        color,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    }
}

fn die(id: &str, color: ManaColor, is_depleted: bool) -> SourceDie {
    SourceDie {
        id: SourceDieId::from(id),
        color,
        is_depleted,
        taken_by_player_id: None,
    }
}

fn install_modifier(state: &mut GameState, id: &str, effect: ModifierEffect) {
    let player_id = state.players[0].id.clone();
    state.active_modifiers.push(ActiveModifier {
        id: ModifierId::from(id),
        source: ModifierSource::Card {
            card_id: CardId::from(id),
            player_id: player_id.clone(),
        },
        duration: ModifierDuration::Turn,
        scope: ModifierScope::SelfScope,
        effect,
        created_at_round: 1,
        created_by_player_id: player_id,
    });
}

fn find_cast(state: &GameState, powered: bool) -> Option<LegalAction> {
    enumerate_legal_actions(state, 0)
        .actions
        .into_iter()
        .find(|action| match action {
            LegalAction::PlayCardBasic { .. } => !powered,
            LegalAction::PlayCardPowered { .. } => powered,
            _ => false,
        })
}

fn cast(state: &mut GameState, undo: &mut UndoStack, powered: bool) {
    let action = find_cast(state, powered).expect("expected an affordable spell cast");
    let epoch = state.action_epoch;
    apply_legal_action(state, undo, 0, &action, epoch).expect("offered spell cast should execute");
}

#[test]
fn unaffordable_cast_leaves_card_mana_and_undo_unchanged() {
    let mut state = spell_state(RESTORATION, TimeOfDay::Day);
    let mut undo = UndoStack::new();
    state.players[0].pure_mana.push(mana_token(ManaColor::Blue));
    let before = serde_json::to_value(&state).unwrap();
    let action = LegalAction::PlayCardBasic {
        hand_index: 0,
        card_id: CardId::from(RESTORATION),
    };
    let epoch = state.action_epoch;

    assert!(apply_legal_action(&mut state, &mut undo, 0, &action, epoch).is_err());
    assert_eq!(serde_json::to_value(&state).unwrap(), before);
    assert_eq!(undo.depth(), 0);
}

#[test]
fn strong_spell_pays_black_and_its_color_at_night() {
    let mut state = spell_state(RESTORATION, TimeOfDay::Day);
    let mut undo = UndoStack::new();
    state.players[0].pure_mana = vec![mana_token(ManaColor::Green), mana_token(ManaColor::Black)];
    assert!(
        find_cast(&state, true).is_none(),
        "daylight blocks black mana"
    );

    state.time_of_day = TimeOfDay::Night;
    let black = state.players[0].pure_mana.pop().unwrap();
    assert!(
        find_cast(&state, true).is_none(),
        "a strong spell needs black mana"
    );

    state.players[0].pure_mana[0].cannot_power_spells = true;
    state.players[0].pure_mana.push(black);
    assert!(
        find_cast(&state, true).is_none(),
        "restricted token cannot pay for a strong spell"
    );

    state.players[0]
        .pure_mana
        .push(mana_token(ManaColor::Green));
    cast(&mut state, &mut undo, true);
    assert_eq!(state.players[0].pure_mana.len(), 1);
    assert!(state.players[0].pure_mana[0].cannot_power_spells);
    assert!(state.players[0].hand.is_empty());
}

#[test]
fn dungeon_allows_black_dice_and_blocks_gold_mana() {
    let mut state = spell_state(FIREBALL, TimeOfDay::Day);
    let mut undo = UndoStack::new();
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        night_mana_rules: true,
        ..CombatState::default()
    }));
    state.source.dice = vec![die(BLACK_DIE, ManaColor::Black, true)];
    state.players[0].pure_mana.push(mana_token(ManaColor::Gold));
    assert!(find_cast(&state, false).is_none());
    assert!(find_cast(&state, true).is_none());

    state.players[0].crystals.red = 1;
    cast(&mut state, &mut undo, true);
    let player = &state.players[0];
    assert_eq!(player.crystals.red, 0);
    assert_eq!(player.spent_crystals_this_turn.red, 1);
    assert_eq!(player.used_die_ids, vec![SourceDieId::from(BLACK_DIE)]);
    assert_eq!(player.pure_mana[0].color, ManaColor::Gold);
}

#[test]
fn two_source_dice_require_an_extra_die_allowance() {
    let mut state = spell_state(FIREBALL, TimeOfDay::Night);
    let mut undo = UndoStack::new();
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::RangedSiege,
        ..CombatState::default()
    }));
    state.source.dice = vec![
        die(RED_DIE, ManaColor::Red, false),
        die(BLACK_DIE, ManaColor::Black, false),
    ];
    assert!(find_cast(&state, true).is_none());

    install_modifier(
        &mut state,
        ADDITIONAL_DIE,
        ModifierEffect::RuleOverride {
            rule: RuleOverride::ExtraSourceDie,
        },
    );
    cast(&mut state, &mut undo, true);
    assert_eq!(
        state.players[0].used_die_ids,
        vec![SourceDieId::from(RED_DIE), SourceDieId::from(BLACK_DIE)],
    );
}

#[test]
fn endless_black_mana_still_respects_the_day_override() {
    let mut state = spell_state(RESTORATION, TimeOfDay::Day);
    let mut undo = UndoStack::new();
    install_modifier(
        &mut state,
        RING,
        ModifierEffect::EndlessMana {
            colors: vec![ManaColor::Green, ManaColor::Black],
        },
    );
    assert!(find_cast(&state, false).is_some());
    assert!(find_cast(&state, true).is_none());

    install_modifier(
        &mut state,
        BLACK_AT_DAY,
        ModifierEffect::RuleOverride {
            rule: RuleOverride::AllowBlackAtDay,
        },
    );
    cast(&mut state, &mut undo, true);
    assert!(state.players[0].hand.is_empty());
    assert!(state.players[0].pure_mana.is_empty());
}

#[test]
fn deferred_basic_payment_resumes_the_spell_choice_and_can_be_undone() {
    let mut state = spell_state(WINGS_OF_WIND, TimeOfDay::Day);
    let mut undo = UndoStack::new();
    state.players[0]
        .pure_mana
        .push(mana_token(ManaColor::White));
    state.players[0].crystals.white = 1;

    cast(&mut state, &mut undo, false);
    let Some(ActivePending::Choice(choice)) = &state.players[0].pending.active else {
        panic!("expected a payment choice");
    };
    assert!(matches!(
        &choice.resolution,
        ChoiceResolution::ManaSourceSelect { payments, basic: true, .. } if payments.len() == 2
    ));
    assert_eq!(state.players[0].crystals.white, 1);

    let epoch = state.action_epoch;
    let choice = LegalAction::ResolveChoice { choice_index: 1 };
    apply_legal_action(&mut state, &mut undo, 0, &choice, epoch).unwrap();

    assert_eq!(state.players[0].crystals.white, 0);
    assert_eq!(state.players[0].pure_mana.len(), 1);
    assert!(matches!(
        &state.players[0].pending.active,
        Some(ActivePending::Choice(choice)) if matches!(choice.resolution, ChoiceResolution::Standard)
    ));
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::Undo, epoch).unwrap();
    assert_eq!(state.players[0].crystals.white, 1);
    assert!(matches!(
        &state.players[0].pending.active,
        Some(ActivePending::Choice(choice))
            if matches!(choice.resolution, ChoiceResolution::ManaSourceSelect { basic: true, .. })
    ));
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::Undo, epoch).unwrap();
    assert_eq!(state.players[0].hand, vec![CardId::from(WINGS_OF_WIND)]);
}

#[test]
fn deferred_strong_payment_survives_serialization_and_spends_both_sources() {
    let mut state = spell_state(RESTORATION, TimeOfDay::Night);
    let mut undo = UndoStack::new();
    state.players[0].pure_mana = vec![mana_token(ManaColor::Green), mana_token(ManaColor::Black)];
    state.source.dice = vec![die(BLACK_DIE, ManaColor::Black, false)];
    cast(&mut state, &mut undo, true);

    let saved = serde_json::to_string(&state).unwrap();
    let mut state: GameState = serde_json::from_str(&saved).unwrap();
    let Some(ActivePending::Choice(choice)) = &state.players[0].pending.active else {
        panic!("expected a complete payment choice");
    };
    let ChoiceResolution::ManaSourceSelect {
        payments,
        basic: false,
        ..
    } = &choice.resolution
    else {
        panic!("expected a strong spell payment");
    };
    assert_eq!(payments.len(), 2);
    assert!(payments
        .iter()
        .all(|payment| matches!(payment, CardManaPayment::WithBlack { .. })));
    assert!(payments[1].describe().contains("Black Die"));
    assert_eq!(state.players[0].pure_mana.len(), 2);

    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::ResolveChoice { choice_index: 1 },
        epoch,
    )
    .unwrap();
    assert_eq!(
        state.players[0].used_die_ids,
        vec![SourceDieId::from(BLACK_DIE)]
    );
    assert_eq!(state.players[0].pure_mana.len(), 1);
    assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Black);
}
