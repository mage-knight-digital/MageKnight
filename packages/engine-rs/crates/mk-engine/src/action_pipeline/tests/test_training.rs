use super::*;

// =========================================================================
// Training card tests
// =========================================================================

#[test]
fn training_creates_pending_select_card() {
    let mut state = setup_playing_game(vec!["training", "march"]);
    state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    match &state.players[0].pending.active {
        Some(ActivePending::Training(t)) => {
            assert_eq!(t.phase, BookOfWisdomPhase::SelectCard);
            assert_eq!(t.mode, EffectMode::Basic);
        }
        other => panic!("Expected Training pending, got {:?}", other),
    }
}

#[test]
fn training_phase1_throws_card_removes_from_hand() {
    let mut state = setup_playing_game(vec!["training", "march"]);
    // No green AAs in offer so it clears pending after throw
    state.offers.advanced_actions = vec![CardId::from("blood_rage")];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    // Resolve phase 1: throw march (index 0 in remaining hand)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
        selection_index: 0,
    }, epoch).unwrap();
    assert!(state.players[0].removed_cards.iter().any(|c| c.as_str() == "march"));
    assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "march"));
}

#[test]
fn training_phase1_matching_color_transitions_phase2() {
    let mut state = setup_playing_game(vec!["training", "march"]);
    // march is green, put 2 green AAs in offer
    state.offers.advanced_actions = vec![
        CardId::from("refreshing_walk"),
        CardId::from("path_finding"),
    ];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
        selection_index: 0,
    }, epoch).unwrap();
    match &state.players[0].pending.active {
        Some(ActivePending::Training(t)) => {
            assert_eq!(t.phase, BookOfWisdomPhase::SelectFromOffer);
            assert_eq!(t.available_offer_cards.len(), 2);
        }
        other => panic!("Expected Training SelectFromOffer, got {:?}", other),
    }
}

#[test]
fn training_phase1_single_match_auto_selects() {
    let mut state = setup_playing_game(vec!["training", "march"]);
    // march is green; 1 green AA in offer → auto-select
    state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
        selection_index: 0,
    }, epoch).unwrap();
    // Basic mode → AA goes to discard
    assert!(state.players[0].discard.iter().any(|c| c.as_str() == "refreshing_walk"));
    // Pending should be cleared
    assert!(state.players[0].pending.active.is_none());
}

#[test]
fn training_basic_phase2_aa_to_discard() {
    let mut state = setup_playing_game(vec!["training", "march"]);
    state.offers.advanced_actions = vec![
        CardId::from("refreshing_walk"),
        CardId::from("path_finding"),
    ];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    // Play training basic
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    // Throw march → 2 green AAs → SelectFromOffer
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
        selection_index: 0,
    }, epoch).unwrap();
    // Select first AA from offer
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
        selection_index: 0,
    }, epoch).unwrap();
    // Basic mode → discard
    assert!(state.players[0].discard.iter().any(|c| c.as_str() == "refreshing_walk"));
    assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "refreshing_walk"));
}

#[test]
fn training_powered_phase2_aa_to_hand() {
    let mut state = setup_playing_game(vec!["training", "march"]);
    state.offers.advanced_actions = vec![
        CardId::from("refreshing_walk"),
        CardId::from("path_finding"),
    ];
    state.decks.advanced_action_deck = vec![];
    state.source.dice.clear(); // Prevent mana source ambiguity
    // Give green mana to power training
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Green,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let mut undo = UndoStack::new();
    // Play training powered
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardPowered {
        hand_index: 0, card_id: CardId::from("training"), mana_color: BasicManaColor::Green,
    }, epoch).unwrap();
    // Throw march → 2 green AAs → SelectFromOffer
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
        selection_index: 0,
    }, epoch).unwrap();
    // Select first AA
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
        selection_index: 0,
    }, epoch).unwrap();
    // Powered mode → hand
    assert!(state.players[0].hand.iter().any(|c| c.as_str() == "refreshing_walk"));
}

#[test]
fn training_excludes_wounds() {
    let mut state = setup_playing_game(vec!["training", "wound", "march"]);
    state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let training_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveTraining { .. }))
        .collect();
    // wound at index 0, march at index 1 (training moved to play area)
    // Only march should be eligible, not wound
    assert_eq!(training_actions.len(), 1);
    // The selection_index should be for march (index 1 in hand: [wound, march])
    assert!(matches!(training_actions[0], LegalAction::ResolveTraining { selection_index: 1 }));
}

#[test]
fn training_excludes_spells() {
    let mut state = setup_playing_game(vec!["training", "fireball", "march"]);
    state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let training_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveTraining { .. }))
        .collect();
    // Only march should be eligible, not fireball (spell)
    assert_eq!(training_actions.len(), 1);
}

#[test]
fn training_card_permanently_removed() {
    let mut state = setup_playing_game(vec!["training", "rage"]);
    // rage is red; 0 red AAs in offer
    state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    // Throw rage (red)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
        selection_index: 0,
    }, epoch).unwrap();
    // rage should be in removed_cards (permanently removed), not in discard
    assert!(state.players[0].removed_cards.iter().any(|c| c.as_str() == "rage"));
    assert!(!state.players[0].discard.iter().any(|c| c.as_str() == "rage"));
}

#[test]
fn training_offer_replenished() {
    let mut state = setup_playing_game(vec!["training", "march"]);
    // 1 green AA in offer → auto-select
    state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
    // Deck has a card to replenish from
    state.decks.advanced_action_deck = vec![CardId::from("blood_rage")];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
        selection_index: 0,
    }, epoch).unwrap();
    // Offer should have been replenished with blood_rage
    assert!(state.offers.advanced_actions.iter().any(|c| c.as_str() == "blood_rage"));
}

#[test]
fn training_no_matching_clears_pending() {
    let mut state = setup_playing_game(vec!["training", "rage"]);
    // rage is red, only green/blue AAs in offer → no match
    state.offers.advanced_actions = vec![CardId::from("refreshing_walk"), CardId::from("ice_bolt")];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveTraining {
        selection_index: 0,
    }, epoch).unwrap();
    // No matching red AAs → pending cleared
    assert!(state.players[0].pending.active.is_none());
    // Card still thrown away
    assert!(state.players[0].removed_cards.iter().any(|c| c.as_str() == "rage"));
}

#[test]
fn training_legal_actions_phase1() {
    let mut state = setup_playing_game(vec!["training", "march", "rage", "wound"]);
    state.offers.advanced_actions = vec![CardId::from("refreshing_walk")];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let training_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveTraining { .. }))
        .collect();
    // march (idx 0), rage (idx 1) eligible; wound (idx 2) not eligible
    assert_eq!(training_actions.len(), 2);
}

#[test]
fn training_legal_actions_phase2() {
    use mk_types::pending::{PendingTraining, BookOfWisdomPhase, MAX_OFFER_CARDS};
    let mut state = setup_playing_game(vec!["march"]);
    // Manually set up SelectFromOffer pending
    let mut available = arrayvec::ArrayVec::<CardId, MAX_OFFER_CARDS>::new();
    available.push(CardId::from("refreshing_walk"));
    available.push(CardId::from("path_finding"));
    state.players[0].pending.active = Some(ActivePending::Training(PendingTraining {
        source_card_id: CardId::from("training"),
        mode: EffectMode::Basic,
        phase: BookOfWisdomPhase::SelectFromOffer,
        thrown_card_color: Some(BasicManaColor::Green),
        available_offer_cards: available,
    }));
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let training_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveTraining { .. }))
        .collect();
    assert_eq!(training_actions.len(), 2);
}

#[test]
fn training_both_action_types_eligible() {
    // Both BasicAction (march) and AdvancedAction (refreshing_walk) should be throwable
    let mut state = setup_playing_game(vec!["training", "march", "refreshing_walk"]);
    state.offers.advanced_actions = vec![CardId::from("in_need")];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("training"),
    }, epoch).unwrap();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let training_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveTraining { .. }))
        .collect();
    // Both march (BasicAction) and refreshing_walk (AdvancedAction) are eligible
    assert_eq!(training_actions.len(), 2);
}

#[test]
fn training_resolvable() {
    // Training is resolvable when player has at least one non-wound action card
    let state = setup_playing_game(vec!["training", "march"]);
    let effect = CardEffect::Training { mode: EffectMode::Basic };
    assert!(crate::effect_queue::is_resolvable(&state, 0, &effect));
}

// =========================================================================
// Maximal Effect card tests
// =========================================================================

#[test]
fn maximal_basic_creates_pending_multiplier_3() {
    let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("maximal_effect"),
    }, epoch).unwrap();
    match &state.players[0].pending.active {
        Some(ActivePending::MaximalEffect(m)) => {
            assert_eq!(m.multiplier, 3);
            assert_eq!(m.effect_kind, EffectMode::Basic);
        }
        other => panic!("Expected MaximalEffect pending, got {:?}", other),
    }
}

#[test]
fn maximal_powered_creates_pending_multiplier_2() {
    let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    state.source.dice.clear(); // Prevent mana source ambiguity
    // Give red mana to power maximal_effect
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Red,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardPowered {
        hand_index: 0, card_id: CardId::from("maximal_effect"), mana_color: BasicManaColor::Red,
    }, epoch).unwrap();
    match &state.players[0].pending.active {
        Some(ActivePending::MaximalEffect(m)) => {
            assert_eq!(m.multiplier, 2);
            assert_eq!(m.effect_kind, EffectMode::Powered);
        }
        other => panic!("Expected MaximalEffect pending, got {:?}", other),
    }
}

#[test]
fn maximal_basic_march_triples_move() {
    let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("maximal_effect"),
    }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
        hand_index: 0,
    }, epoch).unwrap();
    // march basic = GainMove(2), multiplied 3x = 6
    assert_eq!(state.players[0].move_points, 6);
}

#[test]
fn maximal_powered_march_doubles_powered() {
    let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    state.source.dice.clear();
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Red,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardPowered {
        hand_index: 0, card_id: CardId::from("maximal_effect"), mana_color: BasicManaColor::Red,
    }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
        hand_index: 0,
    }, epoch).unwrap();
    // march powered = GainMove(4), multiplied 2x = 8
    assert_eq!(state.players[0].move_points, 8);
}

#[test]
fn maximal_card_permanently_removed() {
    let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("maximal_effect"),
    }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
        hand_index: 0,
    }, epoch).unwrap();
    // march consumed → in removed_cards
    assert!(state.players[0].removed_cards.iter().any(|c| c.as_str() == "march"));
    assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "march"));
}

#[test]
fn maximal_excludes_wounds() {
    let mut state = setup_playing_game(vec!["maximal_effect", "wound", "march"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("maximal_effect"),
    }, epoch).unwrap();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let maximal_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveMaximalEffect { .. }))
        .collect();
    // Only march (idx 1) eligible, wound (idx 0) excluded
    assert_eq!(maximal_actions.len(), 1);
    assert!(matches!(maximal_actions[0], LegalAction::ResolveMaximalEffect { hand_index: 1 }));
}

#[test]
fn maximal_excludes_spells() {
    let mut state = setup_playing_game(vec!["maximal_effect", "fireball", "march"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("maximal_effect"),
    }, epoch).unwrap();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let maximal_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveMaximalEffect { .. }))
        .collect();
    // Only march eligible, fireball (spell) excluded
    assert_eq!(maximal_actions.len(), 1);
}

#[test]
fn maximal_not_resolvable_wounds_only() {
    let state = setup_playing_game(vec!["maximal_effect", "wound"]);
    let effect = CardEffect::MaximalEffect { mode: EffectMode::Basic };
    assert!(!crate::effect_queue::is_resolvable(&state, 0, &effect));
}

#[test]
fn maximal_legal_actions_enumerate() {
    let mut state = setup_playing_game(vec!["maximal_effect", "march", "rage", "swiftness"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("maximal_effect"),
    }, epoch).unwrap();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let maximal_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveMaximalEffect { .. }))
        .collect();
    // march, rage, swiftness → 3 actions
    assert_eq!(maximal_actions.len(), 3);
}

#[test]
fn maximal_empty_hand_no_actions() {
    let mut state = setup_playing_game(vec!["maximal_effect"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    // Manually set pending since we can't play with empty hand after removing maximal_effect
    state.players[0].pending.active = Some(ActivePending::MaximalEffect(
        mk_types::pending::PendingMaximalEffect {
            source_card_id: CardId::from("maximal_effect"),
            multiplier: 3,
            effect_kind: EffectMode::Basic,
        },
    ));
    state.players[0].hand.clear();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let maximal_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveMaximalEffect { .. }))
        .collect();
    assert_eq!(maximal_actions.len(), 0);
}

#[test]
fn maximal_basic_attack_triples() {
    // maximal_effect powered (mult=2, effect_kind=Powered) consumes swiftness
    // swiftness powered = GainAttack(3 Ranged Physical) × 2 = 6 ranged attack
    let mut state = setup_playing_game(vec!["maximal_effect", "swiftness"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    state.combat = Some(Box::new(CombatState::default()));
    state.source.dice.clear();
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Red,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardPowered {
        hand_index: 0, card_id: CardId::from("maximal_effect"), mana_color: BasicManaColor::Red,
    }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
        hand_index: 0,
    }, epoch).unwrap();
    // swiftness powered = GainAttack(3 Ranged Physical) × 2 = 6
    assert_eq!(state.players[0].combat_accumulator.attack.ranged, 6);
}

#[test]
fn maximal_choice_card_creates_pending() {
    // rage basic = Choice(Attack 2 Melee / Block 2) → should create NeedsChoice pending
    let mut state = setup_playing_game(vec!["maximal_effect", "rage"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    state.combat = Some(Box::new(CombatState {
        phase: CombatPhase::Attack,
        ..CombatState::default()
    }));
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("maximal_effect"),
    }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
        hand_index: 0,
    }, epoch).unwrap();
    // rage basic is a Choice effect → should create a pending Choice
    assert!(matches!(
        &state.players[0].pending.active,
        Some(ActivePending::Choice(_))
    ));
}

#[test]
fn maximal_compound_triples_move() {
    // stamina basic = GainMove(2), ×3 = 6
    let mut state = setup_playing_game(vec!["maximal_effect", "stamina"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("maximal_effect"),
    }, epoch).unwrap();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
        hand_index: 0,
    }, epoch).unwrap();
    assert_eq!(state.players[0].move_points, 6);
}

#[test]
fn maximal_basic_includes_basic_and_aa() {
    let mut state = setup_playing_game(vec!["maximal_effect", "march", "refreshing_walk"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("maximal_effect"),
    }, epoch).unwrap();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let maximal_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveMaximalEffect { .. }))
        .collect();
    // march (BasicAction) + refreshing_walk (AdvancedAction) = 2
    assert_eq!(maximal_actions.len(), 2);
}

#[test]
fn maximal_pending_cleared_after_resolve() {
    let mut state = setup_playing_game(vec!["maximal_effect", "march"]);
    state.offers.advanced_actions = vec![];
    state.decks.advanced_action_deck = vec![];
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlayCardBasic {
        hand_index: 0, card_id: CardId::from("maximal_effect"),
    }, epoch).unwrap();
    assert!(state.players[0].pending.active.is_some());
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::ResolveMaximalEffect {
        hand_index: 0,
    }, epoch).unwrap();
    // Pending should be cleared after successful resolution
    assert!(state.players[0].pending.active.is_none());
}

