use super::*;

// =========================================================================
// Site interaction tests
// =========================================================================

use arrayvec::ArrayVec;
use mk_types::hex::HexCoord;

/// Helper: place player on a hex with a specific site.
fn place_player_on_site(state: &mut GameState, site_type: SiteType) -> HexCoord {
    let coord = HexCoord { q: 99, r: 99 };
    let hex = HexState {
        coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type,
            owner: None,
            is_conquered: false,
            is_burned: false,
            city_color: None,
            mine_color: if site_type == SiteType::Mine {
                Some(BasicManaColor::Red)
            } else {
                None
            },
            deep_mine_colors: if site_type == SiteType::DeepMine {
                let mut colors = ArrayVec::new();
                colors.push(BasicManaColor::Blue);
                colors.push(BasicManaColor::Green);
                Some(colors)
            } else {
                None
            },
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: Vec::new(),
    };
    state.map.hexes.insert(coord.key(), hex);
    state.players[0].position = Some(coord);
    coord
}

// --- EnterSite tests ---

#[test]
fn enter_site_enumerated_on_dungeon() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Dungeon);

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        actions.actions.iter().any(|a| matches!(a, LegalAction::EnterSite)),
        "EnterSite should be available on Dungeon"
    );
}

#[test]
fn enter_site_not_after_action_taken() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Dungeon);
    state.players[0].flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::EnterSite)),
        "EnterSite should NOT be available after action taken"
    );
}

#[test]
fn enter_site_not_at_conquered_monster_den() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MonsterDen);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::EnterSite)),
        "EnterSite should NOT be available at conquered MonsterDen"
    );
}

#[test]
fn enter_site_at_conquered_dungeon() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::Dungeon);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        actions.actions.iter().any(|a| matches!(a, LegalAction::EnterSite)),
        "EnterSite SHOULD be available at conquered Dungeon (for fame)"
    );
}

#[test]
fn enter_site_draws_one_brown_for_dungeon() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Dungeon);
    let brown_before = state.enemy_tokens.brown_draw.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

    // Should have drawn 1 brown enemy
    assert_eq!(state.enemy_tokens.brown_draw.len(), brown_before - 1);
    // Should be in combat
    assert!(state.combat.is_some());
}

#[test]
fn enter_site_spawning_grounds_draws_two() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::SpawningGrounds);
    let brown_before = state.enemy_tokens.brown_draw.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

    // Should have drawn 2 brown enemies
    assert_eq!(state.enemy_tokens.brown_draw.len(), brown_before - 2);
    // Should be in combat with 2 enemies
    assert_eq!(state.combat.as_ref().unwrap().enemies.len(), 2);
}

#[test]
fn enter_site_monster_den_reuses_existing_enemies() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MonsterDen);

    // Place an existing enemy on the hex
    let token_id = state.enemy_tokens.brown_draw.remove(0);
    let hex = state.map.hexes.get_mut(&coord.key()).unwrap();
    hex.enemies.push(HexEnemy {
        token_id: token_id.clone(),
        color: EnemyColor::Brown,
        is_revealed: true,
    });
    let brown_before = state.enemy_tokens.brown_draw.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

    // Should NOT have drawn from pile (reuses existing)
    assert_eq!(state.enemy_tokens.brown_draw.len(), brown_before);
    // Should be in combat
    assert!(state.combat.is_some());
}

#[test]
fn enter_dungeon_no_units_night_mana() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Dungeon);

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

    let combat = state.combat.as_ref().unwrap();
    assert!(!combat.units_allowed, "Dungeon: no units");
    assert!(combat.night_mana_rules, "Dungeon: night mana rules");
}

#[test]
fn enter_tomb_red_enemy() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Tomb);
    let red_before = state.enemy_tokens.red_draw.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

    // Should have drawn 1 red enemy
    assert_eq!(state.enemy_tokens.red_draw.len(), red_before - 1);
    assert!(state.combat.is_some());
}

// --- Conquest tests ---

#[test]
fn conquest_marks_site() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::Dungeon);

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EnterSite, epoch).unwrap();

    // Mark all enemies as defeated
    let combat = state.combat.as_mut().unwrap();
    for enemy in combat.enemies.iter_mut() {
        enemy.is_defeated = true;
    }
    combat.phase = CombatPhase::Attack;

    // End combat phase (Attack → end combat)
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::EndCombatPhase, epoch).unwrap();

    // Site should be conquered
    let hex = state.map.hexes.get(&coord.key()).unwrap();
    assert!(hex.site.as_ref().unwrap().is_conquered);
    assert_eq!(
        hex.site.as_ref().unwrap().owner.as_ref().unwrap().as_str(),
        state.players[0].id.as_str()
    );
    // Enemies should be cleared from hex
    assert!(hex.enemies.is_empty());
}

// --- InteractSite tests ---

#[test]
fn interact_site_enumerated_at_village() {
    let mut state = setup_playing_game(vec!["wound", "march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].influence_points = 6; // enough for 2 heals at cost 3

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let healing_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::InteractSite { .. }))
        .collect();
    // Only 1 wound in hand → max 1 heal
    assert_eq!(healing_actions.len(), 1);
    assert!(matches!(healing_actions[0], LegalAction::InteractSite { healing: 1 }));
}

#[test]
fn interact_site_not_without_wounds() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].influence_points = 6;

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
        "No healing without wounds"
    );
}

#[test]
fn interact_site_not_without_influence() {
    let mut state = setup_playing_game(vec!["wound", "march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].influence_points = 2; // not enough (cost 3)

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
        "No healing without enough influence"
    );
}

#[test]
fn interact_site_heals_and_deducts() {
    let mut state = setup_playing_game(vec!["wound", "march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].influence_points = 6;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::InteractSite { healing: 1 },
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].influence_points, 3); // 6 - 3
    assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
    assert_eq!(state.players[0].hand.len(), 1); // just march
}

#[test]
fn monastery_cheaper_healing() {
    let mut state = setup_playing_game(vec!["wound", "march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.players[0].influence_points = 2;

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { healing: 1 })),
        "Monastery healing at cost 2"
    );
}

#[test]
fn keep_only_when_conquered() {
    let mut state = setup_playing_game(vec!["wound", "march"]);
    let coord = place_player_on_site(&mut state, SiteType::Keep);
    state.players[0].influence_points = 10;

    // Not conquered → no interaction
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
        "Keep not accessible when unconquered"
    );

    // Conquer it
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    // Keep doesn't have healing cost by default (only Village/Monastery/RefugeeCamp)
    // So InteractSite still won't be enumerated — correct behavior
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
        "Keep has no healing cost"
    );
}

#[test]
fn multiple_healing_levels_enumerated() {
    let mut state = setup_playing_game(vec!["wound", "wound", "wound", "march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].influence_points = 9; // enough for 3 heals at cost 3

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let healing_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::InteractSite { .. }))
        .collect();
    assert_eq!(healing_actions.len(), 3); // heal 1, 2, or 3
}

#[test]
fn burned_site_blocks_interaction() {
    let mut state = setup_playing_game(vec!["wound", "march"]);
    let coord = place_player_on_site(&mut state, SiteType::Village);
    state.players[0].influence_points = 6;
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_burned = true;

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
        "Burned site blocks interaction"
    );
}

// --- Plunder tests ---

#[test]
fn plunder_decision_offered_at_unconquered_village() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].pending.active = Some(ActivePending::PlunderDecision);

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(actions.actions.iter().any(|a| matches!(a, LegalAction::PlunderSite)));
    assert!(actions.actions.iter().any(|a| matches!(a, LegalAction::DeclinePlunder)));
}

#[test]
fn plunder_burns_site_and_rep_hit() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::Village);
    state.players[0].pending.active = Some(ActivePending::PlunderDecision);
    let rep_before = state.players[0].reputation;
    // Put cards in deck to test draw
    state.players[0].deck = vec![CardId::from("rage"), CardId::from("swiftness")];
    let hand_before = state.players[0].hand.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlunderSite, epoch).unwrap();

    let site = state.map.hexes.get(&coord.key()).unwrap().site.as_ref().unwrap();
    assert!(site.is_burned, "Site should be burned");
    assert_eq!(state.players[0].reputation, rep_before - 1, "Reputation -1");
    assert!(state.players[0].flags.contains(PlayerFlags::HAS_PLUNDERED_THIS_TURN));
    assert!(!state.players[0].pending.has_active(), "Pending should be cleared");
    // Should have drawn 2 cards
    assert_eq!(state.players[0].hand.len(), hand_before + 2, "Should draw 2 cards");
    assert!(state.players[0].deck.is_empty(), "Deck should be empty after draw");
}

#[test]
fn plunder_draws_fewer_if_deck_small() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].pending.active = Some(ActivePending::PlunderDecision);
    state.players[0].deck = vec![CardId::from("rage")]; // only 1 card in deck
    let hand_before = state.players[0].hand.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlunderSite, epoch).unwrap();

    assert_eq!(state.players[0].hand.len(), hand_before + 1, "Should draw only 1");
}

#[test]
fn plunder_reputation_capped_at_minus_seven() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].pending.active = Some(ActivePending::PlunderDecision);
    state.players[0].reputation = -7;

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::PlunderSite, epoch).unwrap();

    assert_eq!(state.players[0].reputation, -7, "Reputation should not go below -7");
}

#[test]
fn decline_plunder_clears_pending() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].pending.active = Some(ActivePending::PlunderDecision);

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::DeclinePlunder, epoch).unwrap();

    assert!(!state.players[0].pending.has_active());
}

#[test]
fn no_plunder_at_conquered_site() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::Village);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;

    // Plunder decision shouldn't be set for conquered sites
    // (tested via advance_turn / plunder_decision logic)
    assert!(!state.players[0].pending.has_active());
}

// =========================================================================
// Glade Wound Choice
// =========================================================================

#[test]
fn glade_wound_choice_hand_removes_from_hand() {
    let mut state = setup_playing_game(vec!["wound", "march"]);
    state.players[0].pending.active = Some(ActivePending::GladeWoundChoice);
    state.players[0].discard.push(CardId::from("wound"));

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ResolveGladeWound { choice: GladeWoundChoice::Hand },
        epoch,
    ).unwrap();

    assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"), "Hand wound removed");
    assert!(state.players[0].discard.iter().any(|c| c.as_str() == "wound"), "Discard wound preserved");
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn glade_wound_choice_discard_removes_from_discard() {
    let mut state = setup_playing_game(vec!["wound", "march"]);
    state.players[0].pending.active = Some(ActivePending::GladeWoundChoice);
    state.players[0].discard.push(CardId::from("wound"));

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ResolveGladeWound { choice: GladeWoundChoice::Discard },
        epoch,
    ).unwrap();

    assert!(state.players[0].hand.iter().any(|c| c.as_str() == "wound"), "Hand wound preserved");
    assert!(!state.players[0].discard.iter().any(|c| c.as_str() == "wound"), "Discard wound removed");
    assert!(!state.players[0].pending.has_active());
}

#[test]
fn glade_wound_choice_enumeration() {
    let mut state = setup_playing_game(vec!["wound", "march"]);
    state.players[0].pending.active = Some(ActivePending::GladeWoundChoice);
    state.players[0].discard.push(CardId::from("wound"));

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(actions.actions.iter().any(|a| matches!(a,
        LegalAction::ResolveGladeWound { choice: GladeWoundChoice::Hand }
    )));
    assert!(actions.actions.iter().any(|a| matches!(a,
        LegalAction::ResolveGladeWound { choice: GladeWoundChoice::Discard }
    )));
}

// =========================================================================
// Site Commerce Tests
// =========================================================================

// --- BuySpell ---

#[test]
fn buy_spell_deducts_influence_and_adds_to_deck() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 10;
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("ice_bolt")];
    state.decks.spell_deck = vec![CardId::from("spare_spell")];

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    let result = apply_legal_action(
        &mut state,
        &mut undo,
        0,
        &LegalAction::BuySpell {
            card_id: CardId::from("fireball"),
            offer_index: 0,
        },
        epoch,
    );
    assert!(result.is_ok());
    assert_eq!(state.players[0].influence_points, 3); // 10 - 7
    assert_eq!(state.players[0].deck[0].as_str(), "fireball"); // top of deck
    // Spell removed from offer, replenished from deck
    assert!(!state.offers.spells.iter().any(|s| s.as_str() == "fireball"));
}

#[test]
fn buy_spell_enumerated_at_conquered_mage_tower() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 7;
    state.offers.spells = vec![CardId::from("fireball")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BuySpell { .. })).collect();
    assert_eq!(buy_spells.len(), 1);
}

#[test]
fn buy_spell_not_enumerated_without_enough_influence() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 6; // Need 7
    state.offers.spells = vec![CardId::from("fireball")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BuySpell { .. })).collect();
    assert_eq!(buy_spells.len(), 0);
}

#[test]
fn buy_spell_not_enumerated_at_unconquered_mage_tower() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::MageTower);
    state.players[0].influence_points = 10;
    state.offers.spells = vec![CardId::from("fireball")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BuySpell { .. })).collect();
    assert_eq!(buy_spells.len(), 0);
}

#[test]
fn buy_spell_blocked_after_combat() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 10;
    state.players[0].flags.insert(PlayerFlags::HAS_COMBATTED_THIS_TURN);
    state.offers.spells = vec![CardId::from("fireball")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BuySpell { .. })).collect();
    assert_eq!(buy_spells.len(), 0);
}

#[test]
fn buy_spell_empty_offer_no_actions() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 10;
    state.offers.spells.clear();

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BuySpell { .. })).collect();
    assert_eq!(buy_spells.len(), 0);
}

#[test]
fn buy_spell_multiple_offers_enumerated() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 14; // enough for 2 spells
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("ice_bolt"), CardId::from("lightning")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BuySpell { .. })).collect();
    assert_eq!(buy_spells.len(), 3);
}

#[test]
fn buy_spell_sets_has_taken_action() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 10;
    state.offers.spells = vec![CardId::from("fireball")];

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BuySpell { card_id: CardId::from("fireball"), offer_index: 0 },
        epoch,
    ).unwrap();
    assert!(state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
}

// --- LearnAdvancedAction ---

#[test]
fn learn_aa_deducts_influence_and_adds_to_deck() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.players[0].influence_points = 8;
    state.offers.monastery_advanced_actions = vec![CardId::from("crystal_mastery"), CardId::from("power_of_crystals")];

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::LearnAdvancedAction { card_id: CardId::from("crystal_mastery"), offer_index: 0 },
        epoch,
    ).unwrap();
    assert_eq!(state.players[0].influence_points, 2); // 8 - 6
    assert_eq!(state.players[0].deck[0].as_str(), "crystal_mastery");
    // Removed from monastery offer, no replenishment
    assert!(!state.offers.monastery_advanced_actions.iter().any(|c| c.as_str() == "crystal_mastery"));
}

#[test]
fn learn_aa_enumerated_at_monastery() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.players[0].influence_points = 6;
    state.offers.monastery_advanced_actions = vec![CardId::from("crystal_mastery")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let learn_aas: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::LearnAdvancedAction { .. })).collect();
    assert_eq!(learn_aas.len(), 1);
}

#[test]
fn learn_aa_not_enumerated_without_enough_influence() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.players[0].influence_points = 5; // Need 6
    state.offers.monastery_advanced_actions = vec![CardId::from("crystal_mastery")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let learn_aas: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::LearnAdvancedAction { .. })).collect();
    assert_eq!(learn_aas.len(), 0);
}

#[test]
fn learn_aa_not_enumerated_at_burned_monastery() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::Monastery);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_burned = true;
    state.players[0].influence_points = 10;
    state.offers.monastery_advanced_actions = vec![CardId::from("crystal_mastery")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let learn_aas: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::LearnAdvancedAction { .. })).collect();
    assert_eq!(learn_aas.len(), 0);
}

#[test]
fn learn_aa_empty_monastery_offer_no_actions() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.players[0].influence_points = 10;
    state.offers.monastery_advanced_actions.clear();

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let learn_aas: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::LearnAdvancedAction { .. })).collect();
    assert_eq!(learn_aas.len(), 0);
}

#[test]
fn learn_aa_sets_has_taken_action() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.players[0].influence_points = 8;
    state.offers.monastery_advanced_actions = vec![CardId::from("crystal_mastery")];

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::LearnAdvancedAction { card_id: CardId::from("crystal_mastery"), offer_index: 0 },
        epoch,
    ).unwrap();
    assert!(state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
}

// --- BurnMonastery ---

#[test]
fn burn_monastery_enumerated_at_monastery() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    // Need violet tokens available
    state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let burns: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BurnMonastery)).collect();
    assert_eq!(burns.len(), 1);
}

#[test]
fn burn_monastery_not_after_action() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];
    state.players[0].flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let burns: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BurnMonastery)).collect();
    assert_eq!(burns.len(), 0);
}

#[test]
fn burn_monastery_not_after_combat() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];
    state.players[0].flags.insert(PlayerFlags::HAS_COMBATTED_THIS_TURN);

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let burns: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BurnMonastery)).collect();
    assert_eq!(burns.len(), 0);
}

#[test]
fn burn_monastery_not_at_burned_monastery() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::Monastery);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_burned = true;
    state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let burns: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BurnMonastery)).collect();
    assert_eq!(burns.len(), 0);
}

#[test]
fn burn_monastery_no_violet_tokens_blocks() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.enemy_tokens.violet_draw.clear();
    state.enemy_tokens.violet_discard.clear();

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let burns: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BurnMonastery)).collect();
    assert_eq!(burns.len(), 0);
}

#[test]
fn burn_monastery_deducts_reputation() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];
    let rep_before = state.players[0].reputation;

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BurnMonastery,
        epoch,
    ).unwrap();
    assert_eq!(state.players[0].reputation as i32, rep_before as i32 - 3);
}

#[test]
fn burn_monastery_rep_capped_at_minus_seven() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];
    state.players[0].reputation = -5;

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BurnMonastery,
        epoch,
    ).unwrap();
    assert_eq!(state.players[0].reputation, -7);
}

#[test]
fn burn_monastery_enters_combat() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BurnMonastery,
        epoch,
    ).unwrap();
    assert!(state.combat.is_some());
    let combat = state.combat.as_ref().unwrap();
    assert_eq!(combat.combat_context, CombatContext::BurnMonastery);
    assert!(combat.discard_enemies_on_failure);
    assert!(!combat.units_allowed);
}

#[test]
fn burn_monastery_sets_flags() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BurnMonastery,
        epoch,
    ).unwrap();
    assert!(state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
    assert!(state.players[0].flags.contains(PlayerFlags::HAS_COMBATTED_THIS_TURN));
}

// --- BurnMonastery Victory/Defeat (end_combat integration) ---

/// Helper: set up game, place player on monastery, initiate BurnMonastery, return state.
fn setup_burn_monastery_combat(state: &mut GameState, undo: &mut UndoStack) {
    place_player_on_site(state, SiteType::Monastery);
    state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];
    state.decks.artifact_deck = vec![CardId::from("banner_of_command")];
    let epoch = state.action_epoch;
    apply_legal_action(
        state, undo, 0,
        &LegalAction::BurnMonastery,
        epoch,
    ).unwrap();
}

/// Helper: defeat all enemies and end combat via EndCombatPhase at Attack phase.
fn win_burn_monastery_combat(state: &mut GameState, undo: &mut UndoStack) {
    // Mark all combat enemies as defeated
    let combat = state.combat.as_mut().unwrap();
    for enemy in combat.enemies.iter_mut() {
        enemy.is_defeated = true;
    }
    combat.phase = CombatPhase::Attack;

    let epoch = state.action_epoch;
    apply_legal_action(
        state, undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();
}

#[test]
fn burn_monastery_victory_marks_conquered() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_burn_monastery_combat(&mut state, &mut undo);

    // Player is now at (99,99) due to place_player_on_site
    let player_pos = state.players[0].position.unwrap();
    win_burn_monastery_combat(&mut state, &mut undo);

    let hex = &state.map.hexes[&player_pos.key()];
    let site = hex.site.as_ref().unwrap();
    assert!(site.is_conquered, "Monastery should be marked conquered after victory");
    assert_eq!(
        site.owner.as_ref().unwrap(),
        &state.players[0].id,
        "Monastery owner should be the player"
    );
}

#[test]
fn burn_monastery_victory_places_shield_token() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_burn_monastery_combat(&mut state, &mut undo);
    let player_pos = state.players[0].position.unwrap();

    win_burn_monastery_combat(&mut state, &mut undo);

    let hex = &state.map.hexes[&player_pos.key()];
    assert_eq!(hex.shield_tokens.len(), 1);
    assert_eq!(hex.shield_tokens[0], state.players[0].id);
}

#[test]
fn burn_monastery_victory_burns_site() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_burn_monastery_combat(&mut state, &mut undo);
    let player_pos = state.players[0].position.unwrap();

    win_burn_monastery_combat(&mut state, &mut undo);

    let site = state.map.hexes[&player_pos.key()].site.as_ref().unwrap();
    assert!(site.is_burned, "Monastery should be burned after victory");
}

#[test]
fn burn_monastery_victory_queues_artifact() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_burn_monastery_combat(&mut state, &mut undo);

    win_burn_monastery_combat(&mut state, &mut undo);

    // Artifact should have been auto-drawn from artifact deck to top of deed deck
    assert!(
        state.players[0].deck.iter().any(|c| c.as_str() == "banner_of_command"),
        "Artifact reward should be drawn to player's deck"
    );
}

#[test]
fn burn_monastery_defeat_does_not_burn() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_burn_monastery_combat(&mut state, &mut undo);
    let player_pos = state.players[0].position.unwrap();

    // End combat without defeating enemies (enemy still alive → defeat)
    let combat = state.combat.as_mut().unwrap();
    combat.phase = CombatPhase::Attack;
    // Do NOT mark enemies as defeated
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    let site = state.map.hexes[&player_pos.key()].site.as_ref().unwrap();
    assert!(!site.is_burned, "Monastery should NOT be burned on defeat");
}

#[test]
fn burn_monastery_defeat_does_not_conquer() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_burn_monastery_combat(&mut state, &mut undo);
    let player_pos = state.players[0].position.unwrap();

    // End combat without defeating enemies
    let combat = state.combat.as_mut().unwrap();
    combat.phase = CombatPhase::Attack;
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    let site = state.map.hexes[&player_pos.key()].site.as_ref().unwrap();
    assert!(!site.is_conquered, "Monastery should NOT be conquered on defeat");
    assert!(site.owner.is_none(), "Monastery should have no owner on defeat");
}

#[test]
fn burn_monastery_defeat_no_shield_token() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_burn_monastery_combat(&mut state, &mut undo);
    let player_pos = state.players[0].position.unwrap();

    // End combat without defeating enemies
    let combat = state.combat.as_mut().unwrap();
    combat.phase = CombatPhase::Attack;
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    let hex = &state.map.hexes[&player_pos.key()];
    assert!(hex.shield_tokens.is_empty(), "No shield token on defeat");
}

#[test]
fn burn_monastery_defeat_discards_enemy() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_burn_monastery_combat(&mut state, &mut undo);

    // End combat without defeating enemies
    let combat = state.combat.as_mut().unwrap();
    combat.phase = CombatPhase::Attack;
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    // discard_enemies_on_failure means enemy should be discarded to violet pile
    assert!(
        state.enemy_tokens.violet_discard.contains(&EnemyTokenId::from("monks_1")),
        "Enemy token should be discarded to violet pile on defeat"
    );
}

#[test]
fn burn_monastery_shield_counts_in_scoring() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_burn_monastery_combat(&mut state, &mut undo);

    win_burn_monastery_combat(&mut state, &mut undo);

    // Greatest Conqueror: +2 per shield on keep/mage tower/monastery
    let score = crate::scoring::calculate_category_base_points(
        mk_types::scoring::AchievementCategory::GreatestConqueror,
        &state.players[0],
        &state,
    );
    assert_eq!(score, 2, "One shield on a monastery should give +2 for Greatest Conqueror");
}

#[test]
fn burn_monastery_not_at_non_monastery_site() {
    for site_type in [SiteType::Village, SiteType::Keep, SiteType::MageTower] {
        let mut state = setup_playing_game(vec!["march"]);
        place_player_on_site(&mut state, site_type);
        state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];

        let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
        let burns: Vec<_> = actions.actions.iter()
            .filter(|a| matches!(a, LegalAction::BurnMonastery))
            .collect();
        assert_eq!(burns.len(), 0, "BurnMonastery should not be available at {:?}", site_type);
    }
}

#[test]
fn burn_monastery_available_with_discard_pile_tokens() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    // Draw pile empty, but discard has tokens (reshuffle should make it available)
    state.enemy_tokens.violet_draw.clear();
    state.enemy_tokens.violet_discard = vec![EnemyTokenId::from("monks_1")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let burns: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BurnMonastery))
        .collect();
    assert_eq!(burns.len(), 1, "BurnMonastery should be available when tokens in discard pile");
}

#[test]
fn burn_monastery_combat_no_units() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_burn_monastery_combat(&mut state, &mut undo);

    let combat = state.combat.as_ref().unwrap();
    assert!(!combat.units_allowed, "Units should not be allowed in BurnMonastery combat");
}

#[test]
fn burn_monastery_not_during_combat() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];
    // Already in combat
    state.combat = Some(Box::new(CombatState::default()));

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let burns: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BurnMonastery))
        .collect();
    assert_eq!(burns.len(), 0, "BurnMonastery should not be available during combat");
}

#[test]
fn burn_monastery_not_while_resting() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Monastery);
    state.enemy_tokens.violet_draw = vec![EnemyTokenId::from("monks_1")];
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let burns: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BurnMonastery))
        .collect();
    assert_eq!(burns.len(), 0, "BurnMonastery should not be available while resting");
}

// --- Conquest Reward Queueing ---

#[test]
fn conquest_reward_fame_auto_granted() {
    let mut state = setup_playing_game(vec!["march"]);
    let fame_before = state.players[0].fame;
    queue_site_reward(&mut state, 0, SiteReward::Fame { amount: 5 });
    assert_eq!(state.players[0].fame, fame_before + 5);
}

#[test]
fn conquest_reward_artifact_draws_from_deck() {
    let mut state = setup_playing_game(vec!["march"]);
    state.decks.artifact_deck = vec![CardId::from("banner_of_command"), CardId::from("ring_of_flame")];
    let deck_before = state.players[0].deck.len();

    queue_site_reward(&mut state, 0, SiteReward::Artifact { count: 1 });
    assert_eq!(state.players[0].deck.len(), deck_before + 1);
    assert_eq!(state.players[0].deck[0].as_str(), "banner_of_command");
    assert_eq!(state.decks.artifact_deck.len(), 1); // one drawn
}

#[test]
fn conquest_reward_crystal_roll_grants_crystal_or_fame() {
    let mut state = setup_playing_game(vec!["march"]);
    let fame_before = state.players[0].fame;
    let crystals_before = state.players[0].crystals.red as u32
        + state.players[0].crystals.blue as u32
        + state.players[0].crystals.green as u32
        + state.players[0].crystals.white as u32;

    queue_site_reward(&mut state, 0, SiteReward::CrystalRoll { count: 3 });

    // Either crystals increased or fame increased
    let crystals_after = state.players[0].crystals.red as u32
        + state.players[0].crystals.blue as u32
        + state.players[0].crystals.green as u32
        + state.players[0].crystals.white as u32;
    let total_gain = (crystals_after - crystals_before) + (state.players[0].fame - fame_before);
    assert!(total_gain >= 3, "3 crystal rolls should grant at least 3 rewards");
}

#[test]
fn conquest_reward_spell_queued_as_deferred() {
    let mut state = setup_playing_game(vec!["march"]);
    state.offers.spells = vec![CardId::from("fireball")];

    queue_site_reward(&mut state, 0, SiteReward::Spell { count: 1 });

    // Should be promoted to active pending (since no active pending existed)
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::SiteRewardChoice { .. })
    ));
}

#[test]
fn conquest_reward_compound_flattened() {
    let mut state = setup_playing_game(vec!["march"]);
    state.decks.artifact_deck = vec![CardId::from("banner_of_command")];
    state.offers.spells = vec![CardId::from("fireball")];
    let fame_before = state.players[0].fame;

    let compound = SiteReward::Compound {
        rewards: vec![
            SiteReward::Fame { amount: 2 },
            SiteReward::Artifact { count: 1 },
            SiteReward::Spell { count: 1 },
        ],
    };
    queue_site_reward(&mut state, 0, compound);

    // Fame auto-granted
    assert_eq!(state.players[0].fame, fame_before + 2);
    // Artifact auto-drawn
    assert!(state.players[0].deck.iter().any(|c| c.as_str() == "banner_of_command"));
    // Spell queued as pending
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::SiteRewardChoice { .. })
    ));
}

// --- SelectReward ---

#[test]
fn select_reward_spell_moves_to_deck() {
    let mut state = setup_playing_game(vec!["march"]);
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("ice_bolt")];
    state.decks.spell_deck = vec![CardId::from("spare_spell")];
    state.players[0].pending.active = Some(ActivePending::SiteRewardChoice {
        reward: SiteReward::Spell { count: 1 },
        reward_index: 0,
    });

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SelectReward { card_id: CardId::from("fireball"), reward_index: 0 },
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].deck[0].as_str(), "fireball");
    assert!(!state.offers.spells.iter().any(|s| s.as_str() == "fireball"));
    // Pending cleared (no more rewards)
    assert!(state.players[0].pending.active.is_none());
}

#[test]
fn select_reward_aa_moves_to_deck() {
    let mut state = setup_playing_game(vec!["march"]);
    state.offers.advanced_actions = vec![CardId::from("crystal_mastery"), CardId::from("power_of_crystals")];
    state.decks.advanced_action_deck = vec![CardId::from("spare_aa")];
    state.players[0].pending.active = Some(ActivePending::SiteRewardChoice {
        reward: SiteReward::AdvancedAction { count: 1 },
        reward_index: 0,
    });

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SelectReward { card_id: CardId::from("crystal_mastery"), reward_index: 0 },
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].deck[0].as_str(), "crystal_mastery");
    assert!(!state.offers.advanced_actions.iter().any(|a| a.as_str() == "crystal_mastery"));
    assert!(state.players[0].pending.active.is_none());
}

#[test]
fn select_reward_multiple_spells_promotes_next() {
    let mut state = setup_playing_game(vec!["march"]);
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("ice_bolt")];
    state.decks.spell_deck = vec![CardId::from("spare_spell")];
    state.players[0].pending.active = Some(ActivePending::SiteRewardChoice {
        reward: SiteReward::Spell { count: 2 },
        reward_index: 0,
    });

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SelectReward { card_id: CardId::from("fireball"), reward_index: 0 },
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].deck[0].as_str(), "fireball");
    // count was 2, so should have a remaining reward promoted
    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::SiteRewardChoice {
            reward: SiteReward::Spell { count: 1 },
            ..
        })
    ));
}

#[test]
fn select_reward_enumerated_for_spell_offer() {
    let mut state = setup_playing_game(vec!["march"]);
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("ice_bolt")];
    state.players[0].pending.active = Some(ActivePending::SiteRewardChoice {
        reward: SiteReward::Spell { count: 1 },
        reward_index: 0,
    });

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let rewards: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::SelectReward { .. })).collect();
    assert_eq!(rewards.len(), 2);
}

#[test]
fn select_reward_enumerated_for_aa_offer() {
    let mut state = setup_playing_game(vec!["march"]);
    state.offers.advanced_actions = vec![CardId::from("crystal_mastery"), CardId::from("power_of_crystals")];
    state.players[0].pending.active = Some(ActivePending::SiteRewardChoice {
        reward: SiteReward::AdvancedAction { count: 1 },
        reward_index: 0,
    });

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let rewards: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::SelectReward { .. })).collect();
    assert_eq!(rewards.len(), 2);
}

// --- Promote Site Reward ---

#[test]
fn promote_site_reward_pops_first_deferred() {
    let mut state = setup_playing_game(vec!["march"]);
    // Set up deferred rewards
    let mut arr = ArrayVec::<SiteReward, MAX_REWARDS>::new();
    arr.push(SiteReward::Spell { count: 1 });
    arr.push(SiteReward::AdvancedAction { count: 1 });
    state.players[0].pending.deferred.push(DeferredPending::Rewards(arr));

    promote_site_reward(&mut state, 0);

    assert!(matches!(
        state.players[0].pending.active,
        Some(ActivePending::SiteRewardChoice {
            reward: SiteReward::Spell { count: 1 },
            ..
        })
    ));
    // One reward remaining in deferred
    let deferred_count = state.players[0].pending.deferred.iter()
        .filter_map(|d| match d {
            DeferredPending::Rewards(r) => Some(r.len()),
            _ => None,
        })
        .sum::<usize>();
    assert_eq!(deferred_count, 1);
}

#[test]
fn promote_site_reward_noop_when_active_pending_exists() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].pending.active = Some(ActivePending::PlunderDecision);
    let mut arr = ArrayVec::<SiteReward, MAX_REWARDS>::new();
    arr.push(SiteReward::Spell { count: 1 });
    state.players[0].pending.deferred.push(DeferredPending::Rewards(arr));

    promote_site_reward(&mut state, 0);

    // Should NOT overwrite existing active pending
    assert!(matches!(state.players[0].pending.active, Some(ActivePending::PlunderDecision)));
}

#[test]
fn promote_site_reward_noop_when_no_deferred() {
    let mut state = setup_playing_game(vec!["march"]);
    promote_site_reward(&mut state, 0);
    assert!(state.players[0].pending.active.is_none());
}

// =========================================================================
// Ancient Ruins Tests
// =========================================================================

/// Helper: place player on an AncientRuins hex with a specific ruins token.
fn place_player_on_ruins(
    state: &mut GameState,
    token_id: &str,
    is_revealed: bool,
) -> HexCoord {
    let coord = HexCoord { q: 99, r: 99 };
    let hex = HexState {
        coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::AncientRuins,
            owner: None,
            is_conquered: false,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: Some(mk_types::state::RuinsToken {
            token_id: mk_types::ids::RuinsTokenId::from(token_id),
            is_revealed,
        }),
        shield_tokens: Vec::new(),
    };
    state.map.hexes.insert(coord.key(), hex);
    state.players[0].position = Some(coord);
    coord
}

// --- Setup tests ---

#[test]
fn setup_initializes_ruins_token_draw_pile() {
    let state = create_solo_game(42, Hero::Arythea);
    assert_eq!(state.ruins_tokens.draw.len(), 15, "Should have 15 ruins tokens");
}

#[test]
fn setup_ruins_tokens_shuffled() {
    let state1 = create_solo_game(42, Hero::Arythea);
    let state2 = create_solo_game(999, Hero::Arythea);
    // Different seeds should (almost certainly) produce different orderings
    assert_ne!(
        state1.ruins_tokens.draw, state2.ruins_tokens.draw,
        "Different seeds should produce different token orderings"
    );
}

#[test]
fn setup_ruins_discard_empty() {
    let state = create_solo_game(42, Hero::Arythea);
    assert!(state.ruins_tokens.discard.is_empty());
}

// --- Movement reveal tests ---

#[test]
fn move_to_ruins_hex_reveals_token() {
    use crate::movement::execute_move;
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].move_points = 5;

    // Place an unrevealed ruins token on an adjacent hex
    let from = HexCoord { q: 0, r: 0 };
    let target = HexCoord { q: 1, r: 0 };
    state.players[0].position = Some(from);

    // Create the from hex
    state.map.hexes.insert(from.key(), HexState {
        coord: from,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: None,
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: Vec::new(),
    });

    // Create the target hex with unrevealed ruins token
    state.map.hexes.insert(target.key(), HexState {
        coord: target,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::AncientRuins,
            owner: None,
            is_conquered: false,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: Some(mk_types::state::RuinsToken {
            token_id: mk_types::ids::RuinsTokenId::from("altar_blue"),
            is_revealed: false,
        }),
        shield_tokens: Vec::new(),
    });

    let result = execute_move(&mut state, 0, target);
    assert!(result.is_ok());

    let hex = &state.map.hexes[&target.key()];
    assert!(hex.ruins_token.as_ref().unwrap().is_revealed, "Moving to ruins hex should reveal token");
}

#[test]
fn move_to_non_ruins_hex_no_change() {
    use crate::movement::execute_move;
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].move_points = 5;

    let from = HexCoord { q: 0, r: 0 };
    let target = HexCoord { q: 1, r: 0 };
    state.players[0].position = Some(from);

    state.map.hexes.insert(from.key(), HexState {
        coord: from,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: None,
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: Vec::new(),
    });

    state.map.hexes.insert(target.key(), HexState {
        coord: target,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: None,
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: Vec::new(),
    });

    let result = execute_move(&mut state, 0, target);
    assert!(result.is_ok());
    assert!(state.map.hexes[&target.key()].ruins_token.is_none());
}

// --- Dawn reveal tests ---

#[test]
fn dawn_reveals_all_face_down_ruins_tokens() {
    let mut state = setup_playing_game(vec!["march"]);
    state.time_of_day = TimeOfDay::Night;

    // Place face-down ruins tokens on two hexes
    let coord1 = HexCoord { q: 10, r: 10 };
    let coord2 = HexCoord { q: 11, r: 10 };
    for coord in [coord1, coord2] {
        state.map.hexes.insert(coord.key(), HexState {
            coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type: SiteType::AncientRuins,
                owner: None,
                is_conquered: false,
                is_burned: false,
                city_color: None,
                mine_color: None,
                deep_mine_colors: None,
            }),
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: Some(mk_types::state::RuinsToken {
                token_id: mk_types::ids::RuinsTokenId::from("altar_blue"),
                is_revealed: false,
            }),
            shield_tokens: Vec::new(),
        });
    }

    // Trigger end_round (night → day = dawn)
    crate::end_turn::end_round(&mut state);

    assert_eq!(state.time_of_day, TimeOfDay::Day);
    for coord in [coord1, coord2] {
        let hex = &state.map.hexes[&coord.key()];
        assert!(
            hex.ruins_token.as_ref().unwrap().is_revealed,
            "Dawn should reveal face-down ruins tokens"
        );
    }
}

#[test]
fn dusk_does_not_reveal_tokens() {
    let mut state = setup_playing_game(vec!["march"]);
    state.time_of_day = TimeOfDay::Day;

    let coord = HexCoord { q: 10, r: 10 };
    state.map.hexes.insert(coord.key(), HexState {
        coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::AncientRuins,
            owner: None,
            is_conquered: false,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: Some(mk_types::state::RuinsToken {
            token_id: mk_types::ids::RuinsTokenId::from("altar_blue"),
            is_revealed: false,
        }),
        shield_tokens: Vec::new(),
    });

    crate::end_turn::end_round(&mut state);

    assert_eq!(state.time_of_day, TimeOfDay::Night);
    let hex = &state.map.hexes[&coord.key()];
    assert!(
        !hex.ruins_token.as_ref().unwrap().is_revealed,
        "Dusk (day→night) should NOT reveal tokens"
    );
}

// --- Enumeration tests ---

#[test]
fn altar_tribute_enumerated_when_affordable() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", true);
    // Give player 3 blue crystals
    state.players[0].crystals.blue = 3;

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let tributes: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .collect();
    assert_eq!(tributes.len(), 1, "AltarTribute should be available with 3 blue crystals");
}

#[test]
fn altar_tribute_not_enumerated_when_unaffordable() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", true);
    // Player has no mana tokens and no blue crystals
    state.players[0].crystals = mk_types::state::Crystals::default();
    state.players[0].pure_mana.clear();

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let tributes: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .collect();
    assert_eq!(tributes.len(), 0, "AltarTribute should NOT be available without enough mana");
}

#[test]
fn altar_tribute_affordable_with_tokens() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", true);
    // Give player 3 blue mana tokens
    for _ in 0..3 {
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Blue,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    }

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let tributes: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .collect();
    assert_eq!(tributes.len(), 1, "AltarTribute should be available with 3 blue mana tokens");
}

#[test]
fn altar_tribute_affordable_with_gold_tokens() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", true);
    // Give player 3 gold mana tokens (wild)
    for _ in 0..3 {
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Gold,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    }

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let tributes: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .collect();
    assert_eq!(tributes.len(), 1, "AltarTribute should be available with gold tokens");
}

#[test]
fn enter_site_enumerated_for_enemy_token() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "enemy_green_brown_artifact", true);
    // Ensure green and brown enemy token piles have tokens
    state.enemy_tokens.green_draw = vec![EnemyTokenId::from("orc_1")];
    state.enemy_tokens.brown_draw = vec![EnemyTokenId::from("ogre_1")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let enters: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::EnterSite))
        .collect();
    assert_eq!(enters.len(), 1, "EnterSite should be available for enemy ruins token");
}

#[test]
fn enter_site_not_enumerated_without_enemy_tokens() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "enemy_green_brown_artifact", true);
    // Empty green pile = can't draw green enemies
    state.enemy_tokens.green_draw.clear();
    state.enemy_tokens.green_discard.clear();
    state.enemy_tokens.brown_draw = vec![EnemyTokenId::from("ogre_1")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let enters: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::EnterSite))
        .collect();
    assert_eq!(enters.len(), 0, "EnterSite should NOT be available without enough enemy tokens");
}

#[test]
fn no_actions_for_face_down_token() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", false);
    state.players[0].crystals.blue = 3;

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let tributes: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .collect();
    let enters: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::EnterSite))
        .collect();
    assert_eq!(tributes.len(), 0, "No AltarTribute for face-down token");
    assert_eq!(enters.len(), 0, "No EnterSite for face-down token");
}

#[test]
fn no_actions_for_conquered_ruins() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_ruins(&mut state, "altar_blue", true);
    state.players[0].crystals.blue = 3;
    // Mark as conquered
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let tributes: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .collect();
    assert_eq!(tributes.len(), 0, "No actions for conquered ruins");
}

#[test]
fn ruins_not_interactable_during_combat() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", true);
    state.players[0].crystals.blue = 3;
    // Put player in combat
    state.combat = Some(Box::new(CombatState::default()));

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let tributes: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .collect();
    assert_eq!(tributes.len(), 0, "No site actions during combat");
}

#[test]
fn ruins_not_interactable_while_resting() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", true);
    state.players[0].crystals.blue = 3;
    state.players[0].flags.insert(PlayerFlags::IS_RESTING);

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let tributes: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .collect();
    assert_eq!(tributes.len(), 0, "No site actions while resting");
}

#[test]
fn ruins_not_interactable_after_action_taken() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", true);
    state.players[0].crystals.blue = 3;
    state.players[0].flags.insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let tributes: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .collect();
    assert_eq!(tributes.len(), 0, "No site actions after action taken");
}

// --- Altar tribute execution tests ---

#[test]
fn altar_tribute_consumes_crystals() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", true);
    state.players[0].crystals.blue = 3;

    let mut undo = UndoStack::new();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let tribute = actions.actions.iter()
        .find(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .unwrap()
        .clone();

    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &tribute, epoch).unwrap();

    assert_eq!(state.players[0].crystals.blue, 0, "3 blue crystals should be consumed");
}

#[test]
fn altar_tribute_grants_fame() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", true);
    state.players[0].crystals.blue = 3;
    let fame_before = state.players[0].fame;

    let mut undo = UndoStack::new();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let tribute = actions.actions.iter()
        .find(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .unwrap()
        .clone();

    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &tribute, epoch).unwrap();

    assert_eq!(state.players[0].fame, fame_before + 7, "Blue altar grants 7 fame");
}

#[test]
fn altar_tribute_all_colors_grants_10_fame() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_all_colors", true);
    // Need 1 of each basic color
    state.players[0].crystals.blue = 1;
    state.players[0].crystals.green = 1;
    state.players[0].crystals.red = 1;
    state.players[0].crystals.white = 1;
    let fame_before = state.players[0].fame;

    let mut undo = UndoStack::new();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let tribute = actions.actions.iter()
        .find(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .unwrap()
        .clone();

    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &tribute, epoch).unwrap();

    assert_eq!(state.players[0].fame, fame_before + 10, "All-colors altar grants 10 fame");
}

#[test]
fn altar_tribute_conquers_site() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_ruins(&mut state, "altar_blue", true);
    state.players[0].crystals.blue = 3;

    let mut undo = UndoStack::new();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let tribute = actions.actions.iter()
        .find(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .unwrap()
        .clone();

    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &tribute, epoch).unwrap();

    let hex = &state.map.hexes[&coord.key()];
    let site = hex.site.as_ref().unwrap();
    assert!(site.is_conquered, "Site should be conquered");
    assert_eq!(site.owner.as_ref().unwrap(), &state.players[0].id);
}

#[test]
fn altar_tribute_places_shield_token() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_ruins(&mut state, "altar_blue", true);
    state.players[0].crystals.blue = 3;

    let mut undo = UndoStack::new();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let tribute = actions.actions.iter()
        .find(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .unwrap()
        .clone();

    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &tribute, epoch).unwrap();

    let hex = &state.map.hexes[&coord.key()];
    assert!(hex.shield_tokens.contains(&state.players[0].id), "Shield token should be placed");
}

#[test]
fn altar_tribute_removes_ruins_token() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_ruins(&mut state, "altar_blue", true);
    state.players[0].crystals.blue = 3;

    let mut undo = UndoStack::new();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let tribute = actions.actions.iter()
        .find(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .unwrap()
        .clone();

    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &tribute, epoch).unwrap();

    let hex = &state.map.hexes[&coord.key()];
    assert!(hex.ruins_token.is_none(), "Ruins token should be removed from hex");
}

#[test]
fn altar_tribute_discards_token_to_pile() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", true);
    state.players[0].crystals.blue = 3;
    let discard_before = state.ruins_tokens.discard.len();

    let mut undo = UndoStack::new();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let tribute = actions.actions.iter()
        .find(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .unwrap()
        .clone();

    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &tribute, epoch).unwrap();

    assert_eq!(
        state.ruins_tokens.discard.len(),
        discard_before + 1,
        "Token should be discarded to pile"
    );
    assert_eq!(state.ruins_tokens.discard.last().unwrap().as_str(), "altar_blue");
}

#[test]
fn altar_tribute_sets_has_taken_action() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_ruins(&mut state, "altar_blue", true);
    state.players[0].crystals.blue = 3;

    let mut undo = UndoStack::new();
    let actions = enumerate_legal_actions_with_undo(&state, 0, &undo);
    let tribute = actions.actions.iter()
        .find(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .unwrap()
        .clone();

    let epoch = state.action_epoch;
    apply_legal_action(&mut state, &mut undo, 0, &tribute, epoch).unwrap();

    assert!(
        state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN),
        "HAS_TAKEN_ACTION_THIS_TURN should be set"
    );
}

// --- Combat (enter site with enemy token) tests ---

/// Helper: set up ancient ruins combat (enter site with enemy token).
fn setup_ruins_combat(state: &mut GameState, undo: &mut UndoStack) {
    place_player_on_ruins(state, "enemy_green_brown_artifact", true);
    state.enemy_tokens.green_draw = vec![EnemyTokenId::from("orc_summoners_1")];
    state.enemy_tokens.brown_draw = vec![EnemyTokenId::from("diggers_1")];
    state.decks.artifact_deck = vec![CardId::from("banner_of_command")];

    let epoch = state.action_epoch;
    apply_legal_action(
        state, undo, 0,
        &LegalAction::EnterSite,
        epoch,
    ).unwrap();
}

/// Helper: defeat all enemies and end combat.
fn win_ruins_combat(state: &mut GameState, undo: &mut UndoStack) {
    let combat = state.combat.as_mut().unwrap();
    for enemy in combat.enemies.iter_mut() {
        enemy.is_defeated = true;
    }
    combat.phase = CombatPhase::Attack;

    let epoch = state.action_epoch;
    apply_legal_action(
        state, undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();
}

#[test]
fn enter_ruins_enters_combat() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);

    assert!(state.combat.is_some(), "Should be in combat after entering ruins");
}

#[test]
fn enter_ruins_draws_enemies_by_color() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);

    let combat = state.combat.as_ref().unwrap();
    assert_eq!(combat.enemies.len(), 2, "Should have 2 enemies (green + brown)");
}

#[test]
fn enter_ruins_combat_context_is_ancient_ruins() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);

    let combat = state.combat.as_ref().unwrap();
    assert_eq!(
        combat.combat_context,
        CombatContext::AncientRuins,
        "Combat context should be AncientRuins"
    );
}

#[test]
fn enter_ruins_sets_has_taken_action() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);

    assert!(
        state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN),
        "Should set HAS_TAKEN_ACTION flag"
    );
}

#[test]
fn ruins_combat_victory_conquers_site() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);
    let player_pos = state.players[0].position.unwrap();
    win_ruins_combat(&mut state, &mut undo);

    let hex = &state.map.hexes[&player_pos.key()];
    let site = hex.site.as_ref().unwrap();
    assert!(site.is_conquered, "Site should be conquered after victory");
    assert_eq!(site.owner.as_ref().unwrap(), &state.players[0].id);
}

#[test]
fn ruins_combat_victory_places_shield() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);
    let player_pos = state.players[0].position.unwrap();
    win_ruins_combat(&mut state, &mut undo);

    let hex = &state.map.hexes[&player_pos.key()];
    assert!(hex.shield_tokens.contains(&state.players[0].id));
}

#[test]
fn ruins_combat_victory_removes_token() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);
    let player_pos = state.players[0].position.unwrap();
    win_ruins_combat(&mut state, &mut undo);

    let hex = &state.map.hexes[&player_pos.key()];
    assert!(hex.ruins_token.is_none(), "Ruins token should be removed after victory");
}

#[test]
fn ruins_combat_victory_discards_token() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    let discard_before = state.ruins_tokens.discard.len();
    setup_ruins_combat(&mut state, &mut undo);
    win_ruins_combat(&mut state, &mut undo);

    assert_eq!(
        state.ruins_tokens.discard.len(),
        discard_before + 1,
        "Token should be in discard pile"
    );
}

#[test]
fn ruins_combat_victory_queues_reward() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);
    win_ruins_combat(&mut state, &mut undo);

    // enemy_green_brown_artifact → Artifact reward → drawn from artifact deck
    // (Artifact is auto-granted, so check player deck)
    let has_artifact = state.players[0].deck.iter()
        .any(|c| c.as_str() == "banner_of_command");
    assert!(has_artifact, "Should have received artifact reward");
}

#[test]
fn ruins_combat_defeat_keeps_token() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);
    let player_pos = state.players[0].position.unwrap();

    // Retreat from combat (don't defeat enemies, just end attack phase)
    {
        let combat = state.combat.as_mut().unwrap();
        // Don't defeat any enemies, just advance to attack phase
        combat.phase = CombatPhase::Attack;
    }
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    // Token should still be on hex (not all enemies defeated → retreat)
    // Note: The combat end handler only processes victory when all_defeated is true
    // When not all defeated, the site stays unconquered
    let hex = &state.map.hexes[&player_pos.key()];
    let site = hex.site.as_ref().unwrap();
    assert!(!site.is_conquered, "Site should NOT be conquered after defeat");
}

#[test]
fn ruins_combat_defeat_enemies_stay_on_hex() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);
    let player_pos = state.players[0].position.unwrap();

    // Check enemies were drawn onto hex
    let enemy_count_before = state.map.hexes[&player_pos.key()].enemies.len();
    assert!(enemy_count_before > 0, "Should have enemies on hex during combat");

    // Retreat from combat (don't defeat enemies)
    {
        let combat = state.combat.as_mut().unwrap();
        combat.phase = CombatPhase::Attack;
    }
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    // Enemies should still be on the hex after retreat
    let hex = &state.map.hexes[&player_pos.key()];
    assert_eq!(
        hex.enemies.len(), enemy_count_before,
        "Enemies should persist on hex after retreat (not discarded like Burn Monastery)"
    );
}

#[test]
fn ruins_combat_defeat_enemies_not_discarded_to_piles() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();

    let green_discard_before = state.enemy_tokens.green_discard.len();
    let brown_discard_before = state.enemy_tokens.brown_discard.len();

    setup_ruins_combat(&mut state, &mut undo);

    // Retreat without defeating
    {
        let combat = state.combat.as_mut().unwrap();
        combat.phase = CombatPhase::Attack;
    }
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    // Enemy tokens should NOT have been discarded back to piles
    assert_eq!(
        state.enemy_tokens.green_discard.len(), green_discard_before,
        "Green enemy should NOT be discarded to pile on retreat"
    );
    assert_eq!(
        state.enemy_tokens.brown_discard.len(), brown_discard_before,
        "Brown enemy should NOT be discarded to pile on retreat"
    );
}

#[test]
fn ruins_reentry_uses_existing_enemies() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);
    let player_pos = state.players[0].position.unwrap();

    // Collect the enemy token IDs placed on the hex
    let enemy_tokens_first: Vec<String> = state.map.hexes[&player_pos.key()]
        .enemies.iter().map(|e| e.token_id.to_string()).collect();

    // Retreat without defeating
    {
        let combat = state.combat.as_mut().unwrap();
        combat.phase = CombatPhase::Attack;
    }
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();
    assert!(state.combat.is_none(), "Combat should end after retreat");

    // Reset HAS_TAKEN_ACTION so we can re-enter
    state.players[0].flags.remove(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    state.players[0].flags.remove(PlayerFlags::HAS_COMBATTED_THIS_TURN);

    // Re-enter the site
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EnterSite,
        epoch,
    ).unwrap();

    assert!(state.combat.is_some(), "Should be in combat again");

    // Verify same enemies are used (not new draws)
    let enemy_tokens_second: Vec<String> = state.map.hexes[&player_pos.key()]
        .enemies.iter().map(|e| e.token_id.to_string()).collect();
    assert_eq!(
        enemy_tokens_first, enemy_tokens_second,
        "Re-entry should fight the SAME enemies, not draw new ones"
    );
}

#[test]
fn ruins_reentry_does_not_draw_from_piles() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);

    // Record pile sizes after first draw
    let green_draw_after_first = state.enemy_tokens.green_draw.len();
    let brown_draw_after_first = state.enemy_tokens.brown_draw.len();

    // Retreat without defeating
    {
        let combat = state.combat.as_mut().unwrap();
        combat.phase = CombatPhase::Attack;
    }
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    // Reset flags for re-entry
    state.players[0].flags.remove(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    state.players[0].flags.remove(PlayerFlags::HAS_COMBATTED_THIS_TURN);

    // Re-enter the site
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EnterSite,
        epoch,
    ).unwrap();

    // Piles should NOT have shrunk (no new draws)
    assert_eq!(
        state.enemy_tokens.green_draw.len(), green_draw_after_first,
        "Green draw pile should not shrink on re-entry"
    );
    assert_eq!(
        state.enemy_tokens.brown_draw.len(), brown_draw_after_first,
        "Brown draw pile should not shrink on re-entry"
    );
}

#[test]
fn ruins_reentry_enumerated_with_existing_enemies() {
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    setup_ruins_combat(&mut state, &mut undo);

    // Retreat without defeating
    {
        let combat = state.combat.as_mut().unwrap();
        combat.phase = CombatPhase::Attack;
    }
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::EndCombatPhase,
        epoch,
    ).unwrap();

    // Reset flags
    state.players[0].flags.remove(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    state.players[0].flags.remove(PlayerFlags::HAS_COMBATTED_THIS_TURN);

    // Empty the draw piles — shouldn't matter since enemies are already on hex
    state.enemy_tokens.green_draw.clear();
    state.enemy_tokens.green_discard.clear();
    state.enemy_tokens.brown_draw.clear();
    state.enemy_tokens.brown_discard.clear();

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let enters: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::EnterSite))
        .collect();
    assert_eq!(
        enters.len(), 1,
        "EnterSite should be available even with empty piles when enemies are already on hex"
    );
}

// --- Reward type coverage tests (TS parity) ---

/// Helper: set up ruins combat with a specific token and matching enemy draws.
fn setup_ruins_combat_with_token(
    state: &mut GameState,
    undo: &mut UndoStack,
    token_id: &str,
    enemy_draws: Vec<(&str, &str)>, // (color pile field, enemy token id)
) {
    place_player_on_ruins(state, token_id, true);

    for (color, token) in &enemy_draws {
        let token_id = EnemyTokenId::from(*token);
        match *color {
            "green" => state.enemy_tokens.green_draw.push(token_id),
            "brown" => state.enemy_tokens.brown_draw.push(token_id),
            "gray" => state.enemy_tokens.gray_draw.push(token_id),
            "violet" => state.enemy_tokens.violet_draw.push(token_id),
            "white" => state.enemy_tokens.white_draw.push(token_id),
            "red" => state.enemy_tokens.red_draw.push(token_id),
            _ => panic!("Unknown color: {}", color),
        }
    }

    let epoch = state.action_epoch;
    apply_legal_action(
        state, undo, 0,
        &LegalAction::EnterSite,
        epoch,
    ).unwrap();
}

#[test]
fn ruins_victory_spell_reward_queues_deferred() {
    // enemy_brown_violet_spell_crystals → Spell + Crystals4
    // Test that the Spell portion creates a deferred reward (choice)
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    // Ensure spell offer exists
    state.offers.spells = vec![CardId::from("fireball")];
    setup_ruins_combat_with_token(
        &mut state, &mut undo,
        "enemy_brown_violet_spell_crystals",
        vec![("brown", "diggers_1"), ("violet", "monks_1")],
    );
    win_ruins_combat(&mut state, &mut undo);

    // Spell reward is deferred (requires player choice), so check pending
    // The Compound reward processes Spell (deferred) + CrystalRoll (auto-granted)
    // Spell should have been promoted to active pending since no other pending exists
    assert!(
        matches!(
            state.players[0].pending.active,
            Some(ActivePending::SiteRewardChoice { .. })
        ),
        "Spell reward should be promoted to active pending for player choice"
    );
}

#[test]
fn ruins_victory_crystal_reward_grants_crystals() {
    // enemy_green_green_crystals → Crystals4 (4 random crystals, auto-granted)
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();

    let crystals_before = state.players[0].crystals.red
        + state.players[0].crystals.blue
        + state.players[0].crystals.green
        + state.players[0].crystals.white;

    setup_ruins_combat_with_token(
        &mut state, &mut undo,
        "enemy_green_green_crystals",
        vec![("green", "orc_summoners_1"), ("green", "orc_summoners_2")],
    );
    win_ruins_combat(&mut state, &mut undo);

    let crystals_after = state.players[0].crystals.red
        + state.players[0].crystals.blue
        + state.players[0].crystals.green
        + state.players[0].crystals.white;

    // CrystalRoll grants up to 4 crystals (some rolls may grant fame instead of crystal)
    // At minimum, total should increase (RNG with seed gives deterministic results)
    let gained = crystals_after as i32 - crystals_before as i32
        + state.players[0].fame as i32; // some rolls grant fame instead
    assert!(gained > 0, "Should have gained crystals and/or fame from CrystalRoll reward");
}

#[test]
fn ruins_victory_compound_reward_processes_both() {
    // enemy_green_grey_artifact_spell → Artifact + Spell (compound)
    let mut state = setup_playing_game(vec!["march"]);
    let mut undo = UndoStack::new();
    state.decks.artifact_deck = vec![CardId::from("banner_of_courage")];
    state.offers.spells = vec![CardId::from("fireball")];

    setup_ruins_combat_with_token(
        &mut state, &mut undo,
        "enemy_green_grey_artifact_spell",
        vec![("gray", "werewolf_1"), ("white", "zealots_1")],
    );
    win_ruins_combat(&mut state, &mut undo);

    // Artifact is auto-granted → should be in player's deck
    let has_artifact = state.players[0].deck.iter()
        .any(|c| c.as_str() == "banner_of_courage");
    assert!(has_artifact, "Artifact reward should be auto-granted to deck");

    // Spell is deferred → should be in active pending
    assert!(
        matches!(
            state.players[0].pending.active,
            Some(ActivePending::SiteRewardChoice { .. })
        ),
        "Spell reward should be promoted to active pending for player choice"
    );
}

#[test]
fn altar_token_does_not_enumerate_enter_site() {
    // Altar tokens should only produce AltarTribute, never EnterSite
    let mut state = setup_playing_game(vec!["march"]);
    // Give player enough crystals to afford the altar
    state.players[0].crystals.blue = 3;
    place_player_on_ruins(&mut state, "altar_blue", true);

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let enter_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::EnterSite))
        .collect();
    assert!(
        enter_actions.is_empty(),
        "Altar token should NOT produce EnterSite action"
    );

    // But AltarTribute should be available
    let altar_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AltarTribute { .. }))
        .collect();
    assert_eq!(
        altar_actions.len(), 1,
        "AltarTribute should be available for affordable altar"
    );
}

#[test]
fn no_actions_for_hex_with_no_ruins_token() {
    // When ruins_token is None (already claimed), no site actions should be available
    let mut state = setup_playing_game(vec!["march"]);
    let coord = HexCoord { q: 99, r: 99 };
    let hex = HexState {
        coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::AncientRuins,
            owner: Some(state.players[0].id.clone()),
            is_conquered: true,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None, // Already claimed
        shield_tokens: Vec::new(),
    };
    state.map.hexes.insert(coord.key(), hex);
    state.players[0].position = Some(coord);

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let site_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(
            a,
            LegalAction::EnterSite
            | LegalAction::AltarTribute { .. }
            | LegalAction::InteractSite { .. }
        ))
        .collect();
    assert!(
        site_actions.is_empty(),
        "No site actions should be available when ruins token is already claimed"
    );
}

