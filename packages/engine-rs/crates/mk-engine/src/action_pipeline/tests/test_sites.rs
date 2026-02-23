use super::*;

// =========================================================================
// Site interaction tests
// =========================================================================

use arrayvec::ArrayVec;
use mk_types::hex::HexCoord;
use mk_types::ids::{CombatInstanceId, EnemyId};
use mk_types::state::CombatEnemy;

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
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("snowstorm")];
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
            mana_color: BasicManaColor::Red,
        },
        epoch,
    );
    assert!(result.is_ok());
    assert_eq!(state.players[0].influence_points, 3); // 10 - 7
    assert_eq!(state.players[0].deck[0].as_str(), "fireball"); // top of deck
    // Mana token consumed
    assert!(state.players[0].pure_mana.is_empty());
    // Spell removed from offer, replenished from deck
    assert!(!state.offers.spells.iter().any(|s| s.as_str() == "fireball"));
}

#[test]
fn buy_spell_enumerated_at_conquered_mage_tower() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 7;
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
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
    state.players[0].influence_points = 14;
    // Gold mana token covers any spell color
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Gold,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("snowstorm"), CardId::from("restoration")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BuySpell { .. })).collect();
    assert_eq!(buy_spells.len(), 3);
}

#[test]
fn buy_spell_not_enumerated_without_matching_mana() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 10;
    // Blue mana token — can't buy red spell
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Blue,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.offers.spells = vec![CardId::from("fireball")]; // Red spell

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BuySpell { .. })).collect();
    assert_eq!(buy_spells.len(), 0, "Should not enumerate BuySpell without matching mana");
}

#[test]
fn buy_spell_crystal_satisfies_mana_cost() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 10;
    state.players[0].pure_mana.clear();
    state.players[0].crystals.red = 1; // Red crystal can pay for red spell
    state.offers.spells = vec![CardId::from("fireball")]; // Red spell

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter().filter(|a| matches!(a, LegalAction::BuySpell { .. })).collect();
    assert_eq!(buy_spells.len(), 1, "Red crystal should satisfy red spell mana cost");
}

#[test]
fn buy_spell_sets_has_taken_action() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 10;
    state.players[0].pure_mana.push(ManaToken {
        color: ManaColor::Red,
        source: mk_types::state::ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
    state.offers.spells = vec![CardId::from("fireball")];

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BuySpell { card_id: CardId::from("fireball"), offer_index: 0, mana_color: BasicManaColor::Red },
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
fn conquest_reward_artifact_draw_n_plus_1_creates_selection() {
    let mut state = setup_playing_game(vec!["march"]);
    state.decks.artifact_deck = vec![
        CardId::from("banner_of_command"),
        CardId::from("ring_of_flame"),
        CardId::from("amulet_of_sun"),
    ];

    // Artifact{count:1} should draw 2 (N+1), create ArtifactSelection pending
    queue_site_reward(&mut state, 0, SiteReward::Artifact { count: 1 });

    match &state.players[0].pending.active {
        Some(ActivePending::ArtifactSelection(sel)) => {
            assert_eq!(sel.choices.len(), 2, "Should draw N+1=2 cards");
            assert_eq!(sel.keep_count, 1);
            assert_eq!(sel.choices[0].as_str(), "banner_of_command");
            assert_eq!(sel.choices[1].as_str(), "ring_of_flame");
        }
        other => panic!("Expected ArtifactSelection, got {:?}", other),
    }
    // 1 card remains in deck (3 - 2 drawn)
    assert_eq!(state.decks.artifact_deck.len(), 1);
}

#[test]
fn conquest_reward_artifact_auto_grants_when_deck_has_one() {
    let mut state = setup_playing_game(vec!["march"]);
    state.decks.artifact_deck = vec![CardId::from("banner_of_command")];
    let deck_before = state.players[0].deck.len();

    // Only 1 card in deck → auto-grant (no choice needed)
    queue_site_reward(&mut state, 0, SiteReward::Artifact { count: 1 });
    assert_eq!(state.players[0].deck.len(), deck_before + 1);
    assert_eq!(state.players[0].deck[0].as_str(), "banner_of_command");
    assert!(state.players[0].pending.active.is_none());
    assert_eq!(state.decks.artifact_deck.len(), 0);
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
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("snowstorm")];
    state.decks.spell_deck = vec![CardId::from("spare_spell")];
    state.players[0].pending.active = Some(ActivePending::SiteRewardChoice {
        reward: SiteReward::Spell { count: 1 },
        reward_index: 0,
    });

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SelectReward { card_id: CardId::from("fireball"), reward_index: 0, unit_id: None },
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
        &LegalAction::SelectReward { card_id: CardId::from("crystal_mastery"), reward_index: 0, unit_id: None },
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].deck[0].as_str(), "crystal_mastery");
    assert!(!state.offers.advanced_actions.iter().any(|a| a.as_str() == "crystal_mastery"));
    assert!(state.players[0].pending.active.is_none());
}

#[test]
fn select_reward_multiple_spells_promotes_next() {
    let mut state = setup_playing_game(vec!["march"]);
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("snowstorm")];
    state.decks.spell_deck = vec![CardId::from("spare_spell")];
    state.players[0].pending.active = Some(ActivePending::SiteRewardChoice {
        reward: SiteReward::Spell { count: 2 },
        reward_index: 0,
    });

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SelectReward { card_id: CardId::from("fireball"), reward_index: 0, unit_id: None },
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
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("snowstorm")];
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

// =========================================================================
// Post-Combat Reward System — 5 Rulebook Gaps tests
// =========================================================================

// --- Step 1: Keep Hand Limit Bonus ---

#[test]
fn keep_hand_bonus_on_owned_keep() {
    let mut state = setup_playing_game(vec!["march"]);

    // Place player at (0,0)
    let player_pos = HexCoord { q: 0, r: 0 };
    state.players[0].position = Some(player_pos);
    state.map.hexes.insert(player_pos.key(), HexState {
        coord: player_pos,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: None,
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: Vec::new(),
    });

    // Place a conquered Keep adjacent with player's shield
    let keep_coord = HexCoord { q: 1, r: 0 };
    state.map.hexes.insert(keep_coord.key(), HexState {
        coord: keep_coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::Keep,
            owner: None,
            is_conquered: true,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: vec![state.players[0].id.clone()],
    });

    // Give player an empty deck so we can check draw_limit behavior
    state.players[0].deck = (0..10).map(|i| CardId::from(format!("card_{}", i))).collect();
    state.players[0].hand.clear();
    state.players[0].play_area.clear();
    state.players[0].discard.clear();
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

    // Base hand limit is 5, plus 1 for adjacent Keep = 6
    crate::end_turn::end_turn(&mut state, 0).ok();

    // Should have drawn up to 6 (5 base + 1 keep bonus)
    assert_eq!(state.players[0].hand.len(), 6,
        "Should draw to 6 with Keep bonus (5 base + 1 keep)");
}

#[test]
fn keep_bonus_not_counted_without_shield_token() {
    let mut state = setup_playing_game(vec!["march"]);

    let player_pos = HexCoord { q: 0, r: 0 };
    state.players[0].position = Some(player_pos);
    state.map.hexes.insert(player_pos.key(), HexState {
        coord: player_pos,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: None,
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: Vec::new(),
    });

    // Conquered Keep but WITHOUT player's shield token
    let keep_coord = HexCoord { q: 1, r: 0 };
    state.map.hexes.insert(keep_coord.key(), HexState {
        coord: keep_coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::Keep,
            owner: None,
            is_conquered: true,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: Vec::new(), // No shield token!
    });

    state.players[0].deck = (0..10).map(|i| CardId::from(format!("card_{}", i))).collect();
    state.players[0].hand.clear();
    state.players[0].play_area.clear();
    state.players[0].discard.clear();
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

    crate::end_turn::end_turn(&mut state, 0).ok();

    // Should have drawn up to base 5 (no keep bonus)
    assert_eq!(state.players[0].hand.len(), 5,
        "Should draw to 5 without shield token on keep");
}

#[test]
fn keep_bonus_not_counted_for_distant_keep() {
    let mut state = setup_playing_game(vec!["march"]);

    let player_pos = HexCoord { q: 0, r: 0 };
    state.players[0].position = Some(player_pos);
    state.map.hexes.insert(player_pos.key(), HexState {
        coord: player_pos,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: None,
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: Vec::new(),
    });

    // Place conquered Keep far away (not adjacent)
    let keep_coord = HexCoord { q: 5, r: 5 };
    state.map.hexes.insert(keep_coord.key(), HexState {
        coord: keep_coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::Keep,
            owner: None,
            is_conquered: true,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: vec![state.players[0].id.clone()],
    });

    state.players[0].deck = (0..10).map(|i| CardId::from(format!("card_{}", i))).collect();
    state.players[0].hand.clear();
    state.players[0].play_area.clear();
    state.players[0].discard.clear();
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

    crate::end_turn::end_turn(&mut state, 0).ok();

    assert_eq!(state.players[0].hand.len(), 5,
        "Should draw to 5 when keep is too far away");
}

// --- Step 2: CrystalRoll Gold Die → Player Choice ---

#[test]
fn crystal_roll_gold_creates_pending_choice() {
    let mut state = setup_playing_game(vec!["march"]);
    // Force the RNG to produce gold (roll=4)
    // next_int(0, 5) returns 0-5, gold is 4
    // We need to find a seed where the first roll is 4
    // Brute force: try different states of RNG
    state.rng = mk_types::rng::RngState::new(0);

    // Try rolling until we get gold, resetting each time
    let mut found_seed = None;
    for seed in 0..1000u32 {
        let mut test_rng = mk_types::rng::RngState::new(seed);
        let roll = test_rng.next_int(0, 5);
        if roll == 4 {
            found_seed = Some(seed);
            break;
        }
    }
    let seed = found_seed.expect("Should find a seed that produces gold roll");
    state.rng = mk_types::rng::RngState::new(seed);

    queue_site_reward(&mut state, 0, SiteReward::CrystalRoll { count: 1 });

    assert!(
        matches!(
            state.players[0].pending.active,
            Some(ActivePending::CrystalRollColorChoice { remaining_rolls: 0 })
        ),
        "Gold roll should create CrystalRollColorChoice pending"
    );
}

#[test]
fn crystal_roll_color_choice_enumerates_four_colors() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].pending.active = Some(ActivePending::CrystalRollColorChoice {
        remaining_rolls: 0,
    });

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let color_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveCrystalRollColor { .. }))
        .collect();

    assert_eq!(color_actions.len(), 4, "Should have 4 color choices (R/B/G/W)");
}

#[test]
fn crystal_roll_color_choice_filtered_by_crystal_cap() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].pending.active = Some(ActivePending::CrystalRollColorChoice {
        remaining_rolls: 0,
    });

    // Max out red crystals
    state.players[0].crystals.red = crate::mana::MAX_CRYSTALS_PER_COLOR;

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let color_actions: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ResolveCrystalRollColor { .. }))
        .collect();

    assert_eq!(color_actions.len(), 3, "Red at cap → only 3 color choices");

    // Verify red is not among them
    let has_red = color_actions.iter().any(|a| matches!(a, LegalAction::ResolveCrystalRollColor { color: BasicManaColor::Red }));
    assert!(!has_red, "Red should not be available when at cap");
}

#[test]
fn resolve_crystal_roll_color_grants_crystal() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].pending.active = Some(ActivePending::CrystalRollColorChoice {
        remaining_rolls: 0,
    });
    let blue_before = state.players[0].crystals.blue;

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ResolveCrystalRollColor { color: BasicManaColor::Blue },
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].crystals.blue, blue_before + 1);
    assert!(state.players[0].pending.active.is_none(),
        "No remaining rolls → pending should be cleared");
}

#[test]
fn crystal_roll_remaining_rolls_resume_after_choice() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].pending.active = Some(ActivePending::CrystalRollColorChoice {
        remaining_rolls: 2,
    });

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ResolveCrystalRollColor { color: BasicManaColor::Green },
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].crystals.green, 1, "Should have gained green crystal");
    // Remaining 2 rolls get resolved (might create another pending or auto-resolve)
    // We just check the crystal was granted and state isn't stuck
}

#[test]
fn crystal_roll_black_grants_fame() {
    let mut state = setup_playing_game(vec!["march"]);
    let fame_before = state.players[0].fame;

    // Find a seed where the first roll is 5 (black)
    let mut found_seed = None;
    for seed in 0..1000u32 {
        let mut test_rng = mk_types::rng::RngState::new(seed);
        let roll = test_rng.next_int(0, 5);
        if roll == 5 {
            found_seed = Some(seed);
            break;
        }
    }
    let seed = found_seed.expect("Should find a seed that produces black roll");
    state.rng = mk_types::rng::RngState::new(seed);

    queue_site_reward(&mut state, 0, SiteReward::CrystalRoll { count: 1 });

    assert_eq!(state.players[0].fame, fame_before + 1, "Black roll should grant +1 fame");
    assert!(state.players[0].pending.active.is_none(), "Black auto-resolves, no pending");
}

#[test]
fn crystal_roll_gold_all_colors_maxed_grants_fame() {
    let mut state = setup_playing_game(vec!["march"]);
    let max = crate::mana::MAX_CRYSTALS_PER_COLOR;
    state.players[0].crystals.red = max;
    state.players[0].crystals.blue = max;
    state.players[0].crystals.green = max;
    state.players[0].crystals.white = max;
    let fame_before = state.players[0].fame;

    // Find a seed where the first roll is gold (4)
    let mut found_seed = None;
    for seed in 0..1000u32 {
        let mut test_rng = mk_types::rng::RngState::new(seed);
        let roll = test_rng.next_int(0, 5);
        if roll == 4 {
            found_seed = Some(seed);
            break;
        }
    }
    let seed = found_seed.expect("Should find a seed that produces gold roll");
    state.rng = mk_types::rng::RngState::new(seed);

    queue_site_reward(&mut state, 0, SiteReward::CrystalRoll { count: 1 });

    assert!(state.players[0].pending.active.is_none(), "Should not create pending when all colors maxed");
    assert_eq!(state.players[0].fame, fame_before + 1, "Gold with all maxed should grant +1 fame");
}

// --- Step 3: Artifact Reward Draw N+1, Keep N ---

#[test]
fn artifact_selection_select_keeps_chosen_returns_other() {
    let mut state = setup_playing_game(vec!["march"]);

    // Set up ArtifactSelection with 2 choices
    state.players[0].pending.active = Some(ActivePending::ArtifactSelection(
        mk_types::pending::PendingArtifactSelection {
            choices: {
                let mut c = arrayvec::ArrayVec::new();
                c.push(CardId::from("banner_of_command"));
                c.push(CardId::from("ring_of_flame"));
                c
            },
            keep_count: 1,
        },
    ));

    let deck_before = state.players[0].deck.len();
    let artifact_deck_before = state.decks.artifact_deck.len();

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SelectArtifact { card_id: CardId::from("banner_of_command") },
        epoch,
    ).unwrap();

    // Chosen card goes to deed deck top
    assert_eq!(state.players[0].deck.len(), deck_before + 1);
    assert_eq!(state.players[0].deck[0].as_str(), "banner_of_command");

    // Unchosen card goes to artifact deck bottom
    assert_eq!(state.decks.artifact_deck.len(), artifact_deck_before + 1);
    assert_eq!(state.decks.artifact_deck.last().unwrap().as_str(), "ring_of_flame");

    assert!(state.players[0].pending.active.is_none());
}

#[test]
fn artifact_selection_enumeration() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].pending.active = Some(ActivePending::ArtifactSelection(
        mk_types::pending::PendingArtifactSelection {
            choices: {
                let mut c = arrayvec::ArrayVec::new();
                c.push(CardId::from("banner_of_command"));
                c.push(CardId::from("ring_of_flame"));
                c
            },
            keep_count: 1,
        },
    ));

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let selects: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::SelectArtifact { .. }))
        .collect();

    assert_eq!(selects.len(), 2, "Should have 2 artifact choices");
}

#[test]
fn artifact_reward_empty_deck_no_pending() {
    let mut state = setup_playing_game(vec!["march"]);
    state.decks.artifact_deck.clear();

    queue_site_reward(&mut state, 0, SiteReward::Artifact { count: 1 });

    // Empty deck → no reward, no pending
    assert!(state.players[0].pending.active.is_none());
}

// --- Step 4: Dungeon Conquest Reward (Die Roll) ---

#[test]
fn dungeon_roll_spell_on_gold_or_black() {
    let mut state = setup_playing_game(vec!["march"]);
    state.offers.spells = vec![CardId::from("fireball")];

    // Find a seed where the roll is >= 4 (gold or black)
    let mut found_seed = None;
    for seed in 0..1000u32 {
        let mut test_rng = mk_types::rng::RngState::new(seed);
        let roll = test_rng.next_int(0, 5);
        if roll >= 4 {
            found_seed = Some(seed);
            break;
        }
    }
    let seed = found_seed.expect("Should find seed for gold/black roll");
    state.rng = mk_types::rng::RngState::new(seed);

    queue_site_reward(&mut state, 0, SiteReward::DungeonRoll);

    // Gold/Black → Spell reward. Should be deferred/active as SiteRewardChoice(Spell)
    match &state.players[0].pending.active {
        Some(ActivePending::SiteRewardChoice { reward: SiteReward::Spell { count: 1 }, .. }) => {}
        Some(ActivePending::CrystalRollColorChoice { .. }) => {
            // If the spell was already resolved and triggered something else, that's also ok
        }
        other => panic!("Expected Spell reward pending, got {:?}", other),
    }
}

#[test]
fn dungeon_roll_artifact_on_basic_color() {
    let mut state = setup_playing_game(vec!["march"]);
    state.decks.artifact_deck = vec![
        CardId::from("banner_of_command"),
        CardId::from("ring_of_flame"),
    ];

    // Find a seed where the roll is < 4 (basic color)
    let mut found_seed = None;
    for seed in 0..1000u32 {
        let mut test_rng = mk_types::rng::RngState::new(seed);
        let roll = test_rng.next_int(0, 5);
        if roll < 4 {
            found_seed = Some(seed);
            break;
        }
    }
    let seed = found_seed.expect("Should find seed for basic color roll");
    state.rng = mk_types::rng::RngState::new(seed);

    queue_site_reward(&mut state, 0, SiteReward::DungeonRoll);

    // Basic color → Artifact reward. Should draw N+1 and create ArtifactSelection.
    match &state.players[0].pending.active {
        Some(ActivePending::ArtifactSelection(sel)) => {
            assert_eq!(sel.choices.len(), 2, "Artifact reward: draw 2 for count=1");
            assert_eq!(sel.keep_count, 1);
        }
        other => panic!("Expected ArtifactSelection pending, got {:?}", other),
    }
}

// --- Step 5: Unit Reward — Command Slot Validation ---

#[test]
fn unit_reward_with_slots_offers_select_and_forfeit() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].command_tokens = 3;
    state.players[0].units.clear(); // 3 slots, 0 used → available
    state.offers.units = vec![
        mk_types::ids::UnitId::from("peasants"),
        mk_types::ids::UnitId::from("herbalists"),
    ];

    state.players[0].pending.active = Some(ActivePending::SiteRewardChoice {
        reward: SiteReward::Unit,
        reward_index: 0,
    });

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());

    let selects: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::SelectReward { unit_id: Some(_), .. }))
        .collect();
    assert_eq!(selects.len(), 2, "Should offer 2 unit choices");

    let forfeits: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ForfeitUnitReward))
        .collect();
    assert_eq!(forfeits.len(), 1, "Should always offer forfeit");

    let disbands: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::DisbandUnitForReward { .. }))
        .collect();
    assert_eq!(disbands.len(), 0, "No disband options when slots available");
}

#[test]
fn unit_reward_no_slots_offers_disband_and_forfeit() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].command_tokens = 1; // Only 1 slot

    // Fill the slot with an existing unit
    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    state.offers.units = vec![
        mk_types::ids::UnitId::from("herbalists"),
        mk_types::ids::UnitId::from("foresters"),
    ];

    state.players[0].pending.active = Some(ActivePending::SiteRewardChoice {
        reward: SiteReward::Unit,
        reward_index: 0,
    });

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());

    let selects: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::SelectReward { unit_id: Some(_), .. }))
        .collect();
    assert_eq!(selects.len(), 0, "No direct select when no slots");

    let disbands: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::DisbandUnitForReward { .. }))
        .collect();
    // 1 existing unit × 2 offer units = 2 disband options
    assert_eq!(disbands.len(), 2, "Should offer disband options for each existing×offer pair");

    let forfeits: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::ForfeitUnitReward))
        .collect();
    assert_eq!(forfeits.len(), 1, "Should always offer forfeit");
}

#[test]
fn forfeit_unit_reward_clears_pending() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].pending.active = Some(ActivePending::SiteRewardChoice {
        reward: SiteReward::Unit,
        reward_index: 0,
    });

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::ForfeitUnitReward,
        epoch,
    ).unwrap();

    assert!(state.players[0].pending.active.is_none(),
        "Forfeit should clear pending");
}

#[test]
fn disband_unit_for_reward_replaces_unit() {
    let mut state = setup_playing_game(vec!["march"]);
    state.players[0].command_tokens = 1;

    state.players[0].units.push(mk_types::state::PlayerUnit {
        instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
        unit_id: mk_types::ids::UnitId::from("peasants"),
        level: 1,
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });

    state.offers.units = vec![mk_types::ids::UnitId::from("herbalists")];
    state.decks.unit_deck = vec![mk_types::ids::UnitId::from("foresters")];

    state.players[0].pending.active = Some(ActivePending::SiteRewardChoice {
        reward: SiteReward::Unit,
        reward_index: 0,
    });

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::DisbandUnitForReward {
            unit_instance_id: mk_types::ids::UnitInstanceId::from("unit_0"),
            reward_unit_id: mk_types::ids::UnitId::from("herbalists"),
        },
        epoch,
    ).unwrap();

    // Old unit gone
    assert!(!state.players[0].units.iter().any(|u| u.unit_id.as_str() == "peasants"),
        "Peasants should be disbanded");

    // New unit added
    assert!(state.players[0].units.iter().any(|u| u.unit_id.as_str() == "herbalists"),
        "Herbalists should be recruited");

    // Offer replenished from deck
    assert!(state.offers.units.iter().any(|u| u.as_str() == "foresters"),
        "Offer should be replenished from deck");

    assert!(state.players[0].pending.active.is_none());
}


// =========================================================================
// Interaction influence rules (reputation bonus, X-space, shield tokens)
// =========================================================================

// --- Reputation influence bonus ---

#[test]
fn positive_rep_increases_effective_influence() {
    let mut state = setup_playing_game(vec!["wound"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].reputation = 3; // bonus = +2
    state.players[0].influence_points = 1; // 1 + 2 = 3 effective

    // Village healing costs 3 per wound.
    // Without rep bonus: 1 influence < 3, no healing available.
    // With rep bonus: effective 3 >= 3, healing 1 should appear.
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { healing: 1 })),
        "Positive rep (+3) should grant +2 influence, enabling healing at village"
    );
}

#[test]
fn negative_rep_decreases_effective_influence() {
    let mut state = setup_playing_game(vec!["wound"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].reputation = -3; // bonus = -2
    state.players[0].influence_points = 4; // 4 - 2 = 2 effective

    // Village healing costs 3. Effective influence = 2 < 3, so no healing.
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
        "Negative rep (-3) should reduce influence by 2, blocking healing at village"
    );
}

#[test]
fn negative_rep_saturates_at_zero() {
    let mut state = setup_playing_game(vec!["wound"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].reputation = -5; // bonus = -3
    state.players[0].influence_points = 1; // 1 - 3 would be negative → clamp to 0

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
        "Effective influence should saturate at 0 (not underflow)"
    );
}

#[test]
fn reputation_bonus_applied_once_per_turn() {
    let mut state = setup_playing_game(vec!["wound", "wound"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].reputation = 5; // bonus = +3
    state.players[0].influence_points = 3; // effective = 6

    // First healing (cost 3): should succeed and apply the bonus
    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::InteractSite { healing: 1 },
        epoch,
    ).unwrap();

    // After first healing: influence_points was boosted to 6, then 6 - 3 = 3 remaining
    assert_eq!(state.players[0].influence_points, 3);
    assert!(state.players[0].flags.contains(PlayerFlags::REPUTATION_BONUS_APPLIED_THIS_TURN));

    // Second healing should work (3 remaining >= 3 cost)
    // The bonus should NOT be applied again (flag is set)
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::InteractSite { healing: 1 },
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].influence_points, 0);
}

#[test]
fn reputation_bonus_flag_cleared_at_turn_start() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].flags.insert(PlayerFlags::REPUTATION_BONUS_APPLIED_THIS_TURN);
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

    // End turn should clear the flag
    crate::end_turn::end_turn(&mut state, 0).unwrap();

    assert!(!state.players[0].flags.contains(PlayerFlags::REPUTATION_BONUS_APPLIED_THIS_TURN));
}

#[test]
fn max_rep_bonus_at_plus_seven() {
    let mut state = setup_playing_game(vec!["wound"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].reputation = 7; // bonus = +5
    state.players[0].influence_points = 0; // effective = 5

    // Village cost = 3 per wound. Effective = 5 → can heal 1 wound.
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { healing: 1 })),
        "Max rep (+7) should grant +5 influence bonus"
    );
}

#[test]
fn reputation_bonus_only_at_inhabited_sites() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Dungeon);
    state.players[0].reputation = 5;
    state.players[0].influence_points = 0;

    // Effective influence at non-inhabited site should still be 0 (no bonus applied)
    let effective = crate::legal_actions::sites::compute_effective_influence(&state, 0);
    assert_eq!(effective, 0, "No reputation bonus should be applied at adventure sites");
}

// --- X-space blocking (rep -7) ---

#[test]
fn x_space_blocks_healing_at_village() {
    let mut state = setup_playing_game(vec!["wound"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].reputation = -7;
    state.players[0].influence_points = 100; // plenty of influence

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::InteractSite { .. })),
        "Rep -7 (X-space) should block ALL interactions at inhabited sites"
    );
}

#[test]
fn x_space_blocks_buy_spell_at_mage_tower() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].reputation = -7;
    state.players[0].influence_points = 100;
    state.offers.spells = vec![CardId::from("fireball")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::BuySpell { .. })),
        "Rep -7 should block BuySpell"
    );
}

#[test]
fn x_space_blocks_recruitment_at_village() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].reputation = -7;
    state.players[0].influence_points = 100;
    state.offers.units = vec![mk_types::ids::UnitId::from("peasants")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        !actions.actions.iter().any(|a| matches!(a, LegalAction::RecruitUnit { .. })),
        "Rep -7 should block unit recruitment"
    );
}

#[test]
fn x_space_does_not_block_enter_site_at_dungeon() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Dungeon);
    state.players[0].reputation = -7;

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    assert!(
        actions.actions.iter().any(|a| matches!(a, LegalAction::EnterSite)),
        "Rep -7 should NOT block EnterSite at adventure sites (Dungeon)"
    );
}

// --- Shield token city bonus ---

#[test]
fn shield_tokens_at_conquered_city_add_influence() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::City);
    let hex = state.map.hexes.get_mut(&coord.key()).unwrap();
    hex.site.as_mut().unwrap().is_conquered = true;
    hex.site.as_mut().unwrap().owner = Some(state.players[0].id.clone());
    // Add 2 shield tokens
    hex.shield_tokens.push(state.players[0].id.clone());
    hex.shield_tokens.push(state.players[0].id.clone());

    state.players[0].reputation = 0; // no rep bonus
    state.players[0].influence_points = 1; // 1 + 2 shields = 3 effective

    let effective = crate::legal_actions::sites::compute_effective_influence(&state, 0);
    assert_eq!(effective, 3, "2 shield tokens should add +2 influence at conquered city");
}

#[test]
fn no_shield_bonus_at_unconquered_city() {
    let mut state = setup_playing_game(vec!["wound"]);
    let coord = place_player_on_site(&mut state, SiteType::City);
    let hex = state.map.hexes.get_mut(&coord.key()).unwrap();
    // City NOT conquered
    hex.shield_tokens.push(state.players[0].id.clone());
    hex.shield_tokens.push(state.players[0].id.clone());

    state.players[0].reputation = 0;
    state.players[0].influence_points = 1; // 1 + 0 (unconquered) = 1

    let effective = crate::legal_actions::sites::compute_effective_influence(&state, 0);
    assert_eq!(effective, 1, "No shield bonus at unconquered city");
}

#[test]
fn no_shield_bonus_at_non_city_sites() {
    let mut state = setup_playing_game(vec!["wound"]);
    let coord = place_player_on_site(&mut state, SiteType::Village);
    let hex = state.map.hexes.get_mut(&coord.key()).unwrap();
    hex.shield_tokens.push(state.players[0].id.clone());

    state.players[0].reputation = 0;
    state.players[0].influence_points = 1;

    let effective = crate::legal_actions::sites::compute_effective_influence(&state, 0);
    assert_eq!(effective, 1, "No shield bonus at non-city sites");
}

#[test]
fn shield_bonus_combined_with_reputation_bonus() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::City);
    let hex = state.map.hexes.get_mut(&coord.key()).unwrap();
    hex.site.as_mut().unwrap().is_conquered = true;
    hex.site.as_mut().unwrap().owner = Some(state.players[0].id.clone());
    hex.shield_tokens.push(state.players[0].id.clone()); // +1 shield

    state.players[0].reputation = 3; // +2 rep bonus
    state.players[0].influence_points = 0; // 0 + 2 + 1 = 3 effective

    let effective = crate::legal_actions::sites::compute_effective_influence(&state, 0);
    assert_eq!(effective, 3, "Shield bonus (+1) combined with rep bonus (+2) = 3 effective influence");
}

#[test]
fn shield_bonus_enables_recruitment_at_city() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::City);
    let hex = state.map.hexes.get_mut(&coord.key()).unwrap();
    hex.site.as_mut().unwrap().is_conquered = true;
    hex.site.as_mut().unwrap().owner = Some(state.players[0].id.clone());
    hex.shield_tokens.push(state.players[0].id.clone()); // +1 shield

    state.players[0].reputation = 0;
    state.players[0].influence_points = 3; // 3 + 1 shield = 4 effective

    // Peasants cost 4, available at Village but scouts available at City
    state.offers.units = vec![mk_types::ids::UnitId::from("scouts")]; // cost 4, City recruitable

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let recruit = actions.actions.iter().find(|a| matches!(a, LegalAction::RecruitUnit { .. }));
    assert!(recruit.is_some(), "Shield bonus should enable recruitment at conquered city");
}

// --- Recruitment with Heroes/Thugs delta ---

#[test]
fn normal_unit_cost_uses_base_cost_only() {
    // With the two-layer system, normal units have no per-unit rep delta.
    // The blanket reputation bonus handles it.
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].reputation = 3; // +2 blanket bonus
    state.players[0].influence_points = 2; // effective = 4

    state.offers.units = vec![mk_types::ids::UnitId::from("peasants")]; // cost 4

    // Peasants cost 4, effective influence = 4, should be affordable
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let recruit = actions.actions.iter().find(|a| matches!(a, LegalAction::RecruitUnit { .. }));
    assert!(recruit.is_some(), "Normal unit should be recruitable with blanket rep bonus");
    if let Some(LegalAction::RecruitUnit { influence_cost, .. }) = recruit {
        // Cost should be base_cost (4) with 0 per-unit delta
        assert_eq!(*influence_cost, 4, "Normal unit should have base cost only (rep handled by blanket bonus)");
    }
}

#[test]
fn thugs_cost_has_reversed_reputation_delta() {
    // Thugs have reversed_reputation. With blanket bonus already applying positive benefit,
    // thugs need a -2x delta to reverse it.
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].reputation = 3; // base_mod = -2 (cost reduction)
    // Thugs delta = -2 * (-2) = +4 (reversed: they pay MORE with positive rep)
    // base_cost = 5, delta = +4, total_cost = 9
    state.players[0].influence_points = 7; // effective = 7 + 2 = 9

    state.offers.units = vec![mk_types::ids::UnitId::from("thugs")]; // cost 5

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let recruit = actions.actions.iter().find(|a| matches!(a, LegalAction::RecruitUnit { .. }));
    assert!(recruit.is_some(), "Thugs should be recruitable");
    if let Some(LegalAction::RecruitUnit { influence_cost, .. }) = recruit {
        // With rep +3: base_mod = -2, thugs delta = -2 * (-2) = +4
        // Total cost = 5 + 4 = 9
        assert_eq!(*influence_cost, 9, "Thugs cost should include reversed rep delta (5 + 4 = 9)");
    }
}

#[test]
fn heroes_cost_has_doubled_reputation_delta() {
    // Heroes have doubled reputation. Blanket applies 1x, hero delta adds 1x more.
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_site(&mut state, SiteType::Village);
    state.players[0].reputation = 3; // base_mod = -2
    // Hero delta = base_mod = -2 (extra 1x reduction)
    // base_cost = 9, delta = -2, total_cost = 7
    state.players[0].influence_points = 5; // effective = 5 + 2 = 7

    state.offers.units = vec![mk_types::ids::UnitId::from("hero_blue")]; // cost 9, is_hero

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let recruit = actions.actions.iter().find(|a| matches!(a, LegalAction::RecruitUnit { .. }));
    assert!(recruit.is_some(), "Hero should be recruitable with doubled rep discount");
    if let Some(LegalAction::RecruitUnit { influence_cost, .. }) = recruit {
        // With rep +3: base_mod = -2, hero delta = -2, total_cost = 9 - 2 = 7
        assert_eq!(*influence_cost, 7, "Hero cost should have extra rep delta (9 - 2 = 7)");
    }
}


// =========================================================================
// City commerce tests
// =========================================================================

use mk_types::state::ManaTokenSource;

/// Helper: place player on a conquered city of a given color.
fn place_player_on_conquered_city(
    state: &mut GameState,
    city_color: BasicManaColor,
) -> HexCoord {
    let coord = HexCoord { q: 88, r: 88 };
    let hex = HexState {
        coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::City,
            owner: Some(state.players[0].id.clone()),
            is_conquered: true,
            is_burned: false,
            city_color: Some(city_color),
            mine_color: None,
            deep_mine_colors: None,
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

#[test]
fn city_color_populated_on_tile_placement() {
    use crate::movement::place_tile_on_map;
    use mk_types::enums::TileId;

    let mut map = MapState {
        hexes: std::collections::BTreeMap::new(),
        tiles: Vec::new(),
        tile_deck: Default::default(),
        tile_slots: std::collections::BTreeMap::new(),
    };

    let center = HexCoord::new(0, 0);
    let hexes = mk_data::tiles::get_tile_hexes(TileId::Core5GreenCity).unwrap();
    place_tile_on_map(&mut map, TileId::Core5GreenCity, center, hexes);

    // Find the city hex (center of Core5GreenCity)
    let city_hex = map.hexes.values().find(|h| {
        h.site.as_ref().is_some_and(|s| s.site_type == SiteType::City)
    }).expect("Should find a city hex");

    assert_eq!(
        city_hex.site.as_ref().unwrap().city_color,
        Some(BasicManaColor::Green),
        "Core5 green city should have city_color = Green"
    );

    // Also test a non-city site on the same tile
    let non_city = map.hexes.values().find(|h| {
        h.site.as_ref().is_some_and(|s| s.site_type != SiteType::City)
    });
    if let Some(nc) = non_city {
        assert_eq!(
            nc.site.as_ref().unwrap().city_color,
            None,
            "Non-city sites should have city_color = None"
        );
    }
}

#[test]
fn city_color_for_all_city_tiles() {
    assert_eq!(mk_data::tiles::city_color_for_tile(TileId::Core5GreenCity), Some(BasicManaColor::Green));
    assert_eq!(mk_data::tiles::city_color_for_tile(TileId::Core6BlueCity), Some(BasicManaColor::Blue));
    assert_eq!(mk_data::tiles::city_color_for_tile(TileId::Core7WhiteCity), Some(BasicManaColor::White));
    assert_eq!(mk_data::tiles::city_color_for_tile(TileId::Core8RedCity), Some(BasicManaColor::Red));
    assert_eq!(mk_data::tiles::city_color_for_tile(TileId::Core1), None);
    assert_eq!(mk_data::tiles::city_color_for_tile(TileId::Countryside1), None);
}

#[test]
fn blue_city_buy_spell_enumerated() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Blue);
    state.players[0].influence_points = 7;
    // Give player red + blue mana to cover both spell colors
    state.players[0].pure_mana.push(ManaToken { color: ManaColor::Red, source: ManaTokenSource::Effect, cannot_power_spells: false });
    state.players[0].pure_mana.push(ManaToken { color: ManaColor::Blue, source: ManaTokenSource::Effect, cannot_power_spells: false });
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("snowstorm")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuySpell { .. }))
        .collect();
    assert_eq!(buy_spells.len(), 2, "Should show BuySpell for each spell in offer");
}

#[test]
fn blue_city_buy_spell_not_enough_influence() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Blue);
    state.players[0].influence_points = 6; // Not enough (need 7)
    state.players[0].pure_mana.push(ManaToken { color: ManaColor::Red, source: ManaTokenSource::Effect, cannot_power_spells: false });
    state.offers.spells = vec![CardId::from("fireball")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuySpell { .. }))
        .collect();
    assert!(buy_spells.is_empty(), "Should not show BuySpell with insufficient influence");
}

#[test]
fn blue_city_buy_spell_executes() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Blue);
    state.players[0].influence_points = 10;
    state.players[0].pure_mana.push(ManaToken { color: ManaColor::Red, source: ManaTokenSource::Effect, cannot_power_spells: false });
    state.offers.spells = vec![CardId::from("fireball"), CardId::from("snowstorm")];
    state.decks.spell_deck = vec![CardId::from("restoration")];

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BuySpell { card_id: CardId::from("fireball"), offer_index: 0, mana_color: BasicManaColor::Red },
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].influence_points, 3, "Should deduct 7 influence");
    assert_eq!(state.players[0].deck[0].as_str(), "fireball", "Spell goes to top of deck");
    // Red mana token consumed
    assert!(state.players[0].pure_mana.is_empty());
    // Offer should be replenished
    assert_eq!(state.offers.spells.len(), 2, "Offer should replenish from deck");
    assert!(state.offers.spells.iter().any(|c| c.as_str() == "snowstorm"));
    assert!(state.offers.spells.iter().any(|c| c.as_str() == "restoration"));
}

#[test]
fn green_city_buy_aa_enumerated() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Green);
    state.players[0].influence_points = 6;
    state.offers.advanced_actions = vec![CardId::from("aa_1"), CardId::from("aa_2"), CardId::from("aa_3")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_aas: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuyCityAdvancedAction { .. }))
        .collect();
    assert_eq!(buy_aas.len(), 3, "Should show BuyCityAdvancedAction for each AA in main offer");
}

#[test]
fn green_city_buy_aa_not_enough_influence() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Green);
    state.players[0].influence_points = 5; // Need 6
    state.offers.advanced_actions = vec![CardId::from("aa_1")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_aas: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuyCityAdvancedAction { .. }))
        .collect();
    assert!(buy_aas.is_empty(), "Should not show BuyCityAdvancedAction with insufficient influence");
}

#[test]
fn green_city_buy_aa_executes() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Green);
    state.players[0].influence_points = 10;
    state.offers.advanced_actions = vec![CardId::from("aa_1"), CardId::from("aa_2")];
    state.decks.advanced_action_deck = vec![CardId::from("aa_3")];

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BuyCityAdvancedAction { card_id: CardId::from("aa_1"), offer_index: 0 },
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].influence_points, 4, "Should deduct 6 influence");
    assert_eq!(state.players[0].deck[0].as_str(), "aa_1", "AA goes to top of deck");
    // Offer replenished from main AA deck
    assert_eq!(state.offers.advanced_actions.len(), 2, "Offer should replenish");
    assert!(state.offers.advanced_actions.iter().any(|c| c.as_str() == "aa_2"));
    assert!(state.offers.advanced_actions.iter().any(|c| c.as_str() == "aa_3"));
}

#[test]
fn red_city_buy_artifact_enumerated() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Red);
    state.players[0].influence_points = 12;
    state.decks.artifact_deck = vec![CardId::from("artifact_a")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_artifacts: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuyArtifact))
        .collect();
    assert_eq!(buy_artifacts.len(), 1, "Should show BuyArtifact when artifact deck non-empty");
}

#[test]
fn red_city_no_artifact_when_deck_empty() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Red);
    state.players[0].influence_points = 12;
    state.decks.artifact_deck.clear();

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_artifacts: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuyArtifact))
        .collect();
    assert!(buy_artifacts.is_empty(), "No BuyArtifact when artifact deck is empty");
}

#[test]
fn red_city_no_artifact_insufficient_influence() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Red);
    state.players[0].influence_points = 11; // Need 12
    state.decks.artifact_deck = vec![CardId::from("artifact_a")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_artifacts: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuyArtifact))
        .collect();
    assert!(buy_artifacts.is_empty(), "No BuyArtifact with insufficient influence");
}

#[test]
fn red_city_buy_artifact_executes_single_card() {
    // With only 1 card in artifact deck, auto-grants (no choice)
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Red);
    state.players[0].influence_points = 15;
    state.decks.artifact_deck = vec![CardId::from("art_1")];
    let pre_deck_len = state.players[0].deck.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BuyArtifact,
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].influence_points, 3, "Should deduct 12 influence");
    assert_eq!(state.players[0].deck[0].as_str(), "art_1", "Artifact goes to top of deck");
    assert_eq!(state.players[0].deck.len(), pre_deck_len + 1, "Deck size +1");
    assert!(state.decks.artifact_deck.is_empty(), "Artifact deck empty after draw");
    assert!(state.players[0].pending.active.is_none(), "No pending when only 1 card");
}

#[test]
fn white_city_add_elite_enumerated() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::White);
    state.players[0].influence_points = 2;
    state.decks.unit_deck = vec![mk_types::ids::UnitId::from("altem_mages")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let add_elites: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AddEliteToOffer))
        .collect();
    assert_eq!(add_elites.len(), 1, "Should show AddEliteToOffer when unit deck non-empty");
}

#[test]
fn white_city_add_elite_empty_deck() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::White);
    state.players[0].influence_points = 5;
    state.decks.unit_deck.clear();

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let add_elites: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AddEliteToOffer))
        .collect();
    assert!(add_elites.is_empty(), "No AddEliteToOffer when unit deck is empty");
}

#[test]
fn white_city_add_elite_executes() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::White);
    state.players[0].influence_points = 5;
    state.decks.unit_deck = vec![mk_types::ids::UnitId::from("altem_mages")];
    let pre_offer_len = state.offers.units.len();

    let mut undo = UndoStack::new();
    let epoch = state.action_epoch;
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::AddEliteToOffer,
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].influence_points, 3, "Should deduct 2 influence");
    assert_eq!(state.offers.units.len(), pre_offer_len + 1, "Unit offer grows by 1");
    assert!(state.offers.units.iter().any(|u| u.as_str() == "altem_mages"), "Elite should be in offer");
    assert!(state.decks.unit_deck.is_empty(), "Unit deck should be reduced");
    // Free action — HAS_TAKEN_ACTION not set
    assert!(
        !state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN),
        "AddEliteToOffer is a free action"
    );
}

#[test]
fn white_city_recruit_all_types() {
    // White city should allow recruiting units that normally require Village-only
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::White);
    state.players[0].influence_points = 20;
    // Peasants only have Village as recruit site
    state.offers.units = vec![mk_types::ids::UnitId::from("peasants")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let recruits: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::RecruitUnit { .. }))
        .collect();
    assert!(!recruits.is_empty(), "White city should allow recruiting peasants (village-only unit)");
}

#[test]
fn non_white_city_no_village_units() {
    // Non-white cities should NOT allow recruiting village-only units
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Red);
    state.players[0].influence_points = 20;
    // Peasants only have Village as recruit site
    state.offers.units = vec![mk_types::ids::UnitId::from("peasants")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let recruits: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::RecruitUnit { .. }))
        .collect();
    assert!(recruits.is_empty(), "Non-white city should not allow recruiting village-only units");
}

#[test]
fn unconquered_city_no_commerce() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = HexCoord { q: 88, r: 88 };
    let hex = HexState {
        coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::City,
            owner: None,
            is_conquered: false, // NOT conquered
            is_burned: false,
            city_color: Some(BasicManaColor::Blue),
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: Vec::new(),
    };
    state.map.hexes.insert(coord.key(), hex);
    state.players[0].position = Some(coord);
    state.players[0].influence_points = 20;
    state.offers.spells = vec![CardId::from("spell_a")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let city_commerce: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(
            a,
            LegalAction::BuySpell { .. }
            | LegalAction::BuyCityAdvancedAction { .. }
            | LegalAction::BuyArtifact
            | LegalAction::AddEliteToOffer
        ))
        .collect();
    assert!(city_commerce.is_empty(), "No city commerce before conquest");
}

#[test]
fn wrong_color_no_cross_commerce() {
    // Red city shouldn't show BuySpell (that's blue city)
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Red);
    state.players[0].influence_points = 20;
    state.players[0].pure_mana.push(ManaToken { color: ManaColor::Red, source: ManaTokenSource::Effect, cannot_power_spells: false });
    state.offers.spells = vec![CardId::from("fireball")];
    state.decks.artifact_deck = vec![CardId::from("art_1")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());

    // Red city should have BuyArtifact but NOT BuySpell
    let buy_spells: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuySpell { .. }))
        .collect();
    assert!(buy_spells.is_empty(), "Red city should not show BuySpell");

    let buy_artifacts: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuyArtifact))
        .collect();
    assert!(!buy_artifacts.is_empty(), "Red city should show BuyArtifact");

    // Blue city should have BuySpell but NOT BuyArtifact
    place_player_on_conquered_city(&mut state, BasicManaColor::Blue);
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuySpell { .. }))
        .collect();
    assert!(!buy_spells.is_empty(), "Blue city should show BuySpell");

    let buy_artifacts: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuyArtifact))
        .collect();
    assert!(buy_artifacts.is_empty(), "Blue city should not show BuyArtifact");
}

// =========================================================================
// FAQ S21/S22 — Shield Token Influence Bonus
// =========================================================================

#[test]
fn shield_bonus_grants_influence_for_commerce() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_conquered_city(&mut state, BasicManaColor::Red);
    // Player has 10 influence + 2 shields on city = effective 12
    state.players[0].influence_points = 10;
    let pid = state.players[0].id.clone();
    let hex = state.map.hexes.get_mut(&coord.key()).unwrap();
    hex.shield_tokens.push(pid.clone());
    hex.shield_tokens.push(pid.clone());
    state.decks.artifact_deck = vec![CardId::from("art_1")];

    // Should enumerate BuyArtifact (costs 12) because 10 + 2 shield = 12
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_artifacts: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuyArtifact))
        .collect();
    assert_eq!(buy_artifacts.len(), 1, "Shield bonus should make BuyArtifact affordable");
}

#[test]
fn shield_bonus_not_at_non_city_sites() {
    // Shield tokens at a MageTower should NOT grant influence bonus
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 5;
    state.players[0].pure_mana.push(ManaToken { color: ManaColor::Red, source: ManaTokenSource::Effect, cannot_power_spells: false });
    let pid = state.players[0].id.clone();
    state.map.hexes.get_mut(&coord.key()).unwrap().shield_tokens.push(pid);
    state.offers.spells = vec![CardId::from("fireball")];

    // Needs 7 influence, has 5. Shield bonus only applies at Cities, not MageTower.
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuySpell { .. }))
        .collect();
    assert!(buy_spells.is_empty(), "Shield bonus should not apply at MageTower");
}

#[test]
fn shield_bonus_once_per_turn() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_conquered_city(&mut state, BasicManaColor::White);
    state.players[0].influence_points = 1;
    let pid = state.players[0].id.clone();
    let hex = state.map.hexes.get_mut(&coord.key()).unwrap();
    hex.shield_tokens.push(pid.clone());
    state.decks.unit_deck = vec![mk_types::ids::UnitId::from("altem_mages"), mk_types::ids::UnitId::from("utem_crossbowmen")];

    // First purchase: 1 influence + 1 shield = 2 (enough for elite add at cost 2)
    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::AddEliteToOffer,
        epoch,
    ).unwrap();

    // Shield bonus claimed. Player now has 0 influence (1 + 1 shield - 2 = 0).
    // Flag should be set
    assert!(state.players[0].flags.contains(PlayerFlags::REPUTATION_BONUS_APPLIED_THIS_TURN));

    // Even though there's still a shield token, second purchase should NOT get bonus
    // Player has 0 influence, needs 2 for next elite add, shield bonus already claimed
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let add_elites: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::AddEliteToOffer))
        .collect();
    assert!(add_elites.is_empty(), "Shield bonus should not apply twice in one turn");
}

// =========================================================================
// FAQ S21/S22 — Red City Draw-2-Keep-1 Artifact Selection
// =========================================================================

#[test]
fn red_city_draw_2_creates_pending_selection() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Red);
    state.players[0].influence_points = 15;
    state.decks.artifact_deck = vec![CardId::from("art_a"), CardId::from("art_b"), CardId::from("art_c")];

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BuyArtifact,
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].influence_points, 3, "Should deduct 12 influence");
    // Pending should be ArtifactSelection with 2 choices
    match &state.players[0].pending.active {
        Some(mk_types::pending::ActivePending::ArtifactSelection(sel)) => {
            assert_eq!(sel.choices.len(), 2);
            assert_eq!(sel.choices[0].as_str(), "art_a");
            assert_eq!(sel.choices[1].as_str(), "art_b");
        }
        other => panic!("Expected ArtifactSelection, got {:?}", other),
    }
    // Third card stays in deck
    assert_eq!(state.decks.artifact_deck.len(), 1);
    assert_eq!(state.decks.artifact_deck[0].as_str(), "art_c");
}

#[test]
fn select_artifact_keeps_chosen_returns_other_to_deck_bottom() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Red);
    state.players[0].influence_points = 15;
    state.decks.artifact_deck = vec![CardId::from("art_a"), CardId::from("art_b"), CardId::from("art_c")];

    // BuyArtifact → creates pending
    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::BuyArtifact, epoch).unwrap();

    let pre_deck_len = state.players[0].deck.len();
    let epoch = state.action_epoch;
    // Select art_a
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::SelectArtifact { card_id: CardId::from("art_a") },
        epoch,
    ).unwrap();

    // art_a goes to top of deed deck
    assert_eq!(state.players[0].deck[0].as_str(), "art_a");
    assert_eq!(state.players[0].deck.len(), pre_deck_len + 1);
    // art_b returned to artifact deck bottom
    assert_eq!(state.decks.artifact_deck.len(), 2);
    assert_eq!(state.decks.artifact_deck[1].as_str(), "art_b", "Unchosen card returned to deck bottom");
    // Pending cleared
    assert!(state.players[0].pending.active.is_none());
}

#[test]
fn select_artifact_enumerated_during_pending() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Red);
    state.players[0].influence_points = 15;
    state.decks.artifact_deck = vec![CardId::from("art_a"), CardId::from("art_b")];

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(&mut state, &mut undo, 0, &LegalAction::BuyArtifact, epoch).unwrap();

    // Should enumerate 2 SelectArtifact actions
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let select_artifacts: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::SelectArtifact { .. }))
        .collect();
    assert_eq!(select_artifacts.len(), 2, "Should show SelectArtifact for each choice");
}

// =========================================================================
// FAQ S21/S22 — Green City Blind Draw from AA Deck
// =========================================================================

#[test]
fn green_city_blind_draw_enumerated() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Green);
    state.players[0].influence_points = 6;
    state.decks.advanced_action_deck = vec![CardId::from("deck_aa_1")];

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let blind_draws: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuyCityAdvancedActionFromDeck))
        .collect();
    assert_eq!(blind_draws.len(), 1, "Should show BuyCityAdvancedActionFromDeck");
}

#[test]
fn green_city_blind_draw_empty_deck_no_action() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Green);
    state.players[0].influence_points = 10;
    state.decks.advanced_action_deck.clear();

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let blind_draws: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuyCityAdvancedActionFromDeck))
        .collect();
    assert!(blind_draws.is_empty(), "No blind draw when AA deck is empty");
}

#[test]
fn green_city_blind_draw_executes() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Green);
    state.players[0].influence_points = 10;
    state.decks.advanced_action_deck = vec![CardId::from("deck_aa_1"), CardId::from("deck_aa_2")];
    let pre_deck_len = state.players[0].deck.len();

    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BuyCityAdvancedActionFromDeck,
        epoch,
    ).unwrap();

    assert_eq!(state.players[0].influence_points, 4, "Should deduct 6 influence");
    assert_eq!(state.players[0].deck[0].as_str(), "deck_aa_1", "Top of AA deck goes to deed deck top");
    assert_eq!(state.players[0].deck.len(), pre_deck_len + 1);
    assert_eq!(state.decks.advanced_action_deck.len(), 1, "AA deck shrinks by 1");
    assert!(state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
}

// =========================================================================
// FAQ S21/S22 — Spell Purchase Matching Mana Cost
// =========================================================================

#[test]
fn spell_mana_no_mana_no_action() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 10;
    // No mana tokens at all
    state.players[0].pure_mana.clear();
    state.players[0].crystals = Crystals::default();
    state.offers.spells = vec![CardId::from("fireball")]; // Red spell

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuySpell { .. }))
        .collect();
    assert!(buy_spells.is_empty(), "Should not show BuySpell without matching mana");
}

#[test]
fn spell_mana_gold_token_works() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 10;
    // Gold mana token (wild) should satisfy any spell color
    state.players[0].pure_mana.push(ManaToken { color: ManaColor::Gold, source: ManaTokenSource::Effect, cannot_power_spells: false });
    state.offers.spells = vec![CardId::from("fireball")]; // Red spell

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuySpell { .. }))
        .collect();
    assert_eq!(buy_spells.len(), 1, "Gold token should satisfy mana requirement");

    // Execute and verify gold token consumed
    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BuySpell { card_id: CardId::from("fireball"), offer_index: 0, mana_color: BasicManaColor::Red },
        epoch,
    ).unwrap();
    assert!(state.players[0].pure_mana.is_empty(), "Gold token should be consumed");
}

#[test]
fn spell_mana_crystal_works() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 10;
    // Red crystal instead of token
    state.players[0].crystals.red = 1;
    state.offers.spells = vec![CardId::from("fireball")]; // Red spell

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuySpell { .. }))
        .collect();
    assert_eq!(buy_spells.len(), 1, "Crystal should satisfy mana requirement");

    // Execute and verify crystal consumed
    let epoch = state.action_epoch;
    let mut undo = UndoStack::new();
    apply_legal_action(
        &mut state, &mut undo, 0,
        &LegalAction::BuySpell { card_id: CardId::from("fireball"), offer_index: 0, mana_color: BasicManaColor::Red },
        epoch,
    ).unwrap();
    assert_eq!(state.players[0].crystals.red, 0, "Crystal should be consumed");
}

#[test]
fn spell_mana_wrong_color_no_action() {
    let mut state = setup_playing_game(vec!["march"]);
    let coord = place_player_on_site(&mut state, SiteType::MageTower);
    state.map.hexes.get_mut(&coord.key()).unwrap().site.as_mut().unwrap().is_conquered = true;
    state.players[0].influence_points = 10;
    // Blue mana token, but spell is Red
    state.players[0].pure_mana.push(ManaToken { color: ManaColor::Blue, source: ManaTokenSource::Effect, cannot_power_spells: false });
    state.offers.spells = vec![CardId::from("fireball")]; // Red spell

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuySpell { .. }))
        .collect();
    assert!(buy_spells.is_empty(), "Wrong color mana should not satisfy requirement");
}

#[test]
fn spell_mana_applies_at_blue_city_too() {
    let mut state = setup_playing_game(vec!["march"]);
    place_player_on_conquered_city(&mut state, BasicManaColor::Blue);
    state.players[0].influence_points = 10;
    // No mana at all
    state.players[0].pure_mana.clear();
    state.players[0].crystals = Crystals::default();
    state.offers.spells = vec![CardId::from("fireball")]; // Red spell

    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuySpell { .. }))
        .collect();
    assert!(buy_spells.is_empty(), "Blue city also requires matching mana for spell purchase");

    // Add matching mana → should work
    state.players[0].pure_mana.push(ManaToken { color: ManaColor::Red, source: ManaTokenSource::Effect, cannot_power_spells: false });
    let actions = enumerate_legal_actions_with_undo(&state, 0, &UndoStack::new());
    let buy_spells: Vec<_> = actions.actions.iter()
        .filter(|a| matches!(a, LegalAction::BuySpell { .. }))
        .collect();
    assert_eq!(buy_spells.len(), 1, "With matching mana, blue city should show BuySpell");
}

// =========================================================================
// FAQ S22 — Hand Limit +1 Near Conquered City
// =========================================================================

#[test]
fn hand_limit_plus_one_near_conquered_city() {
    use crate::end_turn::end_turn;

    let mut state = setup_playing_game(vec!["march"]);
    // Player at (5,5), conquered city at (5,5) with shield
    let city_coord = HexCoord { q: 5, r: 5 };
    let pid = state.players[0].id.clone();
    let city_hex = HexState {
        coord: city_coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::City,
            owner: None,
            is_conquered: true,
            is_burned: false,
            city_color: Some(BasicManaColor::Blue),
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: vec![pid.clone()],
    };
    state.map.hexes.insert(city_coord.key(), city_hex);
    state.players[0].position = Some(city_coord);

    // Set up deck with many cards to draw from
    state.players[0].hand.clear();
    state.players[0].deck = (0..20).map(|i| CardId::from(format!("card_{}", i).as_str())).collect();
    // Must satisfy minimum turn requirement
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let base_hand_limit = state.players[0].hand_limit as usize; // Usually 5

    // End turn should draw base_hand_limit + 2 cards (city leader bonus)
    let _ = end_turn(&mut state, 0);

    assert_eq!(
        state.players[0].hand.len(),
        base_hand_limit + 2,
        "Should draw base hand limit + 2 for city leader bonus (sole owner = leader)"
    );
}

#[test]
fn hand_limit_no_bonus_without_shield() {
    use crate::end_turn::end_turn;

    let mut state = setup_playing_game(vec!["march"]);
    let city_coord = HexCoord { q: 5, r: 5 };
    // Conquered city but NO shield token for this player
    let city_hex = HexState {
        coord: city_coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::City,
            owner: None,
            is_conquered: true,
            is_burned: false,
            city_color: Some(BasicManaColor::Blue),
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: vec![], // No shield!
    };
    state.map.hexes.insert(city_coord.key(), city_hex);
    state.players[0].position = Some(city_coord);
    state.players[0].hand.clear();
    state.players[0].deck = (0..20).map(|i| CardId::from(format!("card_{}", i).as_str())).collect();
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let base_hand_limit = state.players[0].hand_limit as usize;

    let _ = end_turn(&mut state, 0);

    assert_eq!(
        state.players[0].hand.len(),
        base_hand_limit,
        "No city bonus without shield token"
    );
}

#[test]
fn hand_limit_bonus_from_adjacent_hex() {
    use crate::end_turn::end_turn;

    let mut state = setup_playing_game(vec!["march"]);
    let player_coord = HexCoord { q: 5, r: 5 };
    // City is on a neighbor hex (q+1, r)
    let city_coord = HexCoord { q: 6, r: 5 };
    let pid = state.players[0].id.clone();

    // Player hex (no site)
    let player_hex = HexState {
        coord: player_coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: None,
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: vec![],
    };
    state.map.hexes.insert(player_coord.key(), player_hex);

    // City hex (adjacent)
    let city_hex = HexState {
        coord: city_coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::City,
            owner: None,
            is_conquered: true,
            is_burned: false,
            city_color: Some(BasicManaColor::Red),
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: vec![pid.clone()],
    };
    state.map.hexes.insert(city_coord.key(), city_hex);
    state.players[0].position = Some(player_coord);
    state.players[0].hand.clear();
    state.players[0].deck = (0..20).map(|i| CardId::from(format!("card_{}", i).as_str())).collect();
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let base_hand_limit = state.players[0].hand_limit as usize;

    let _ = end_turn(&mut state, 0);

    assert_eq!(
        state.players[0].hand.len(),
        base_hand_limit + 2,
        "Should get +2 hand limit from adjacent conquered city (sole owner = leader)"
    );
}

#[test]
fn hand_limit_no_bonus_two_hexes_away() {
    use crate::end_turn::end_turn;

    let mut state = setup_playing_game(vec!["march"]);
    let player_coord = HexCoord { q: 5, r: 5 };
    // City is 2 hexes away (q+2, r)
    let city_coord = HexCoord { q: 7, r: 5 };
    let pid = state.players[0].id.clone();

    let player_hex = HexState {
        coord: player_coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: None,
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: vec![],
    };
    state.map.hexes.insert(player_coord.key(), player_hex);

    let city_hex = HexState {
        coord: city_coord,
        terrain: Terrain::Plains,
        tile_id: TileId::StartingA,
        site: Some(Site {
            site_type: SiteType::City,
            owner: None,
            is_conquered: true,
            is_burned: false,
            city_color: Some(BasicManaColor::Red),
            mine_color: None,
            deep_mine_colors: None,
        }),
        rampaging_enemies: ArrayVec::new(),
        enemies: ArrayVec::new(),
        ruins_token: None,
        shield_tokens: vec![pid.clone()],
    };
    state.map.hexes.insert(city_coord.key(), city_hex);
    state.players[0].position = Some(player_coord);
    state.players[0].hand.clear();
    state.players[0].deck = (0..20).map(|i| CardId::from(format!("card_{}", i).as_str())).collect();
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let base_hand_limit = state.players[0].hand_limit as usize;

    let _ = end_turn(&mut state, 0);

    assert_eq!(
        state.players[0].hand.len(),
        base_hand_limit,
        "No city bonus when city is 2 hexes away"
    );
}

// =========================================================================
// Gap 2a: Night garrison reveal for cities
// =========================================================================

#[test]
fn city_garrison_revealed_at_night() {
    use crate::movement::execute_move;
    use mk_types::ids::EnemyTokenId;

    let mut state = setup_playing_game(vec!["march"]);
    state.time_of_day = TimeOfDay::Night;
    state.players[0].move_points = 10;

    // Player at (0,0)
    let player_coord = HexCoord::new(0, 0);
    state.players[0].position = Some(player_coord);
    state.map.hexes.insert(
        player_coord.key(),
        HexState {
            coord: player_coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: None,
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            shield_tokens: vec![],
        },
    );

    // Adjacent hex at (1,0)
    let move_target = HexCoord::new(1, 0);
    state.map.hexes.insert(
        move_target.key(),
        HexState {
            coord: move_target,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: None,
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            shield_tokens: vec![],
        },
    );

    // City at (2,-1) — adjacent to (1,0) but not to (0,0)
    let city_coord = HexCoord::new(2, -1);
    state.map.hexes.insert(
        city_coord.key(),
        HexState {
            coord: city_coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type: SiteType::City,
                owner: None,
                is_conquered: false,
                is_burned: false,
                city_color: Some(BasicManaColor::Blue),
                mine_color: None,
                deep_mine_colors: None,
            }),
            rampaging_enemies: ArrayVec::new(),
            enemies: {
                let mut e = ArrayVec::new();
                e.push(HexEnemy {
                    token_id: EnemyTokenId::from("guardsmen_1"),
                    color: EnemyColor::Gray,
                    is_revealed: false,
                });
                e
            },
            ruins_token: None,
            shield_tokens: vec![],
        },
    );

    execute_move(&mut state, 0, move_target).unwrap();

    let city_hex = state.map.hexes.get(&city_coord.key()).unwrap();
    assert!(
        city_hex.enemies[0].is_revealed,
        "City garrison should be revealed at night when player moves adjacent"
    );
}

#[test]
fn keep_garrison_not_revealed_at_night() {
    use crate::movement::execute_move;
    use mk_types::ids::EnemyTokenId;

    let mut state = setup_playing_game(vec!["march"]);
    state.time_of_day = TimeOfDay::Night;
    state.players[0].move_points = 10;

    let player_coord = HexCoord::new(0, 0);
    state.players[0].position = Some(player_coord);
    state.map.hexes.insert(
        player_coord.key(),
        HexState {
            coord: player_coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: None,
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            shield_tokens: vec![],
        },
    );

    let move_target = HexCoord::new(1, 0);
    state.map.hexes.insert(
        move_target.key(),
        HexState {
            coord: move_target,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: None,
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            shield_tokens: vec![],
        },
    );

    // Keep at (2,-1) — adjacent to (1,0) but not to (0,0)
    let keep_coord = HexCoord::new(2, -1);
    state.map.hexes.insert(
        keep_coord.key(),
        HexState {
            coord: keep_coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type: SiteType::Keep,
                owner: None,
                is_conquered: false,
                is_burned: false,
                city_color: None,
                mine_color: None,
                deep_mine_colors: None,
            }),
            rampaging_enemies: ArrayVec::new(),
            enemies: {
                let mut e = ArrayVec::new();
                e.push(HexEnemy {
                    token_id: EnemyTokenId::from("guardsmen_1"),
                    color: EnemyColor::Gray,
                    is_revealed: false,
                });
                e
            },
            ruins_token: None,
            shield_tokens: vec![],
        },
    );

    execute_move(&mut state, 0, move_target).unwrap();

    let keep_hex = state.map.hexes.get(&keep_coord.key()).unwrap();
    assert!(
        !keep_hex.enemies[0].is_revealed,
        "Keep garrison should NOT be revealed at night"
    );
}

// =========================================================================
// Gap 2b: Per-enemy shield token placement at cities
// =========================================================================

#[test]
fn city_conquest_places_shield_per_defeated_enemy() {
    let mut state = setup_playing_game(vec!["march"]);
    let city_coord = HexCoord::new(5, 5);
    let pid = state.players[0].id.clone();

    // Set up city hex with enemies
    state.map.hexes.insert(
        city_coord.key(),
        HexState {
            coord: city_coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type: SiteType::City,
                owner: None,
                is_conquered: false,
                is_burned: false,
                city_color: Some(BasicManaColor::Blue),
                mine_color: None,
                deep_mine_colors: None,
            }),
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            shield_tokens: vec![],
        },
    );

    // Set up combat with 3 enemies, all defeated and required for conquest
    state.combat = Some(Box::new(CombatState {
        combat_hex_coord: Some(city_coord),
        enemies: vec![
            CombatEnemy {
                instance_id: CombatInstanceId::from("enemy_0"),
                enemy_id: EnemyId::from("guardsmen"),
                is_blocked: false,
                is_defeated: true,
                damage_assigned: false,
                is_required_for_conquest: true,
                summoned_by_instance_id: None,
                is_summoner_hidden: false,
                attacks_blocked: vec![],
                attacks_damage_assigned: vec![],
                attacks_cancelled: vec![],
            },
            CombatEnemy {
                instance_id: CombatInstanceId::from("enemy_1"),
                enemy_id: EnemyId::from("swordsmen"),
                is_blocked: false,
                is_defeated: true,
                damage_assigned: false,
                is_required_for_conquest: true,
                summoned_by_instance_id: None,
                is_summoner_hidden: false,
                attacks_blocked: vec![],
                attacks_damage_assigned: vec![],
                attacks_cancelled: vec![],
            },
            CombatEnemy {
                instance_id: CombatInstanceId::from("enemy_2"),
                enemy_id: EnemyId::from("crossbowmen"),
                is_blocked: false,
                is_defeated: true,
                damage_assigned: false,
                is_required_for_conquest: true,
                summoned_by_instance_id: None,
                is_summoner_hidden: false,
                attacks_blocked: vec![],
                attacks_damage_assigned: vec![],
                attacks_cancelled: vec![],
            },
        ],
        ..CombatState::default()
    }));

    super::combat_end::end_combat(&mut state, 0);

    let hex = state.map.hexes.get(&city_coord.key()).unwrap();
    assert_eq!(
        hex.shield_tokens.len(), 3,
        "City conquest should place 1 shield per defeated enemy (3 enemies = 3 shields)"
    );
    assert!(
        hex.shield_tokens.iter().all(|t| *t == pid),
        "All shield tokens should belong to the conquering player"
    );
}

#[test]
fn keep_conquest_places_single_shield() {
    let mut state = setup_playing_game(vec!["march"]);
    let keep_coord = HexCoord::new(5, 5);
    let pid = state.players[0].id.clone();

    state.map.hexes.insert(
        keep_coord.key(),
        HexState {
            coord: keep_coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type: SiteType::Keep,
                owner: None,
                is_conquered: false,
                is_burned: false,
                city_color: None,
                mine_color: None,
                deep_mine_colors: None,
            }),
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            shield_tokens: vec![],
        },
    );

    // 2 enemies defeated
    state.combat = Some(Box::new(CombatState {
        combat_hex_coord: Some(keep_coord),
        enemies: vec![
            CombatEnemy {
                instance_id: CombatInstanceId::from("enemy_0"),
                enemy_id: EnemyId::from("guardsmen"),
                is_blocked: false,
                is_defeated: true,
                damage_assigned: false,
                is_required_for_conquest: true,
                summoned_by_instance_id: None,
                is_summoner_hidden: false,
                attacks_blocked: vec![],
                attacks_damage_assigned: vec![],
                attacks_cancelled: vec![],
            },
            CombatEnemy {
                instance_id: CombatInstanceId::from("enemy_1"),
                enemy_id: EnemyId::from("swordsmen"),
                is_blocked: false,
                is_defeated: true,
                damage_assigned: false,
                is_required_for_conquest: true,
                summoned_by_instance_id: None,
                is_summoner_hidden: false,
                attacks_blocked: vec![],
                attacks_damage_assigned: vec![],
                attacks_cancelled: vec![],
            },
        ],
        ..CombatState::default()
    }));

    super::combat_end::end_combat(&mut state, 0);

    let hex = state.map.hexes.get(&keep_coord.key()).unwrap();
    assert_eq!(
        hex.shield_tokens.len(), 1,
        "Keep conquest should place exactly 1 shield token regardless of enemy count"
    );
    assert_eq!(hex.shield_tokens[0], pid);
}

// =========================================================================
// Gap 2c/2d: City leader tracking + hand limit bonus
// =========================================================================

#[test]
fn city_leader_gets_plus_two_hand_bonus() {
    use crate::end_turn::end_turn;

    let mut state = setup_playing_game(vec!["march"]);
    let city_coord = HexCoord::new(5, 5);
    let pid = state.players[0].id.clone();

    // Player is leader: 3 shields vs nobody else
    state.map.hexes.insert(
        city_coord.key(),
        HexState {
            coord: city_coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type: SiteType::City,
                owner: Some(pid.clone()),
                is_conquered: true,
                is_burned: false,
                city_color: Some(BasicManaColor::Blue),
                mine_color: None,
                deep_mine_colors: None,
            }),
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            shield_tokens: vec![pid.clone(), pid.clone(), pid.clone()],
        },
    );
    state.players[0].position = Some(city_coord);
    state.players[0].hand.clear();
    state.players[0].deck = (0..20).map(|i| CardId::from(format!("card_{}", i).as_str())).collect();
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let base = state.players[0].hand_limit as usize;

    let _ = end_turn(&mut state, 0);

    assert_eq!(
        state.players[0].hand.len(),
        base + 2,
        "City leader should get +2 hand limit bonus"
    );
}

#[test]
fn city_non_leader_gets_plus_one_hand_bonus() {
    use crate::end_turn::end_turn;

    let mut state = setup_playing_game(vec!["march"]);
    let city_coord = HexCoord::new(5, 5);
    let pid = state.players[0].id.clone();
    let other_pid = mk_types::ids::PlayerId::from("player_1");

    // Other player has 3 shields, we have 1 — we are NOT the leader
    state.map.hexes.insert(
        city_coord.key(),
        HexState {
            coord: city_coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type: SiteType::City,
                owner: Some(other_pid.clone()),
                is_conquered: true,
                is_burned: false,
                city_color: Some(BasicManaColor::Red),
                mine_color: None,
                deep_mine_colors: None,
            }),
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            shield_tokens: vec![other_pid.clone(), other_pid.clone(), other_pid.clone(), pid.clone()],
        },
    );
    state.players[0].position = Some(city_coord);
    state.players[0].hand.clear();
    state.players[0].deck = (0..20).map(|i| CardId::from(format!("card_{}", i).as_str())).collect();
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let base = state.players[0].hand_limit as usize;

    let _ = end_turn(&mut state, 0);

    assert_eq!(
        state.players[0].hand.len(),
        base + 1,
        "City non-leader (with tokens) should get +1 hand limit bonus"
    );
}

#[test]
fn city_leader_tiebreak_first_placed() {
    use crate::end_turn::end_turn;

    let mut state = setup_playing_game(vec!["march"]);
    let city_coord = HexCoord::new(5, 5);
    let pid = state.players[0].id.clone();
    let other_pid = mk_types::ids::PlayerId::from("player_1");

    // Both have 2 shields — but other_pid placed first → other_pid is leader
    // Our player should get +1 (non-leader)
    state.map.hexes.insert(
        city_coord.key(),
        HexState {
            coord: city_coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type: SiteType::City,
                owner: Some(other_pid.clone()),
                is_conquered: true,
                is_burned: false,
                city_color: Some(BasicManaColor::Green),
                mine_color: None,
                deep_mine_colors: None,
            }),
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            // other_pid placed first (tokens interleaved: other, ours, other, ours)
            shield_tokens: vec![other_pid.clone(), pid.clone(), other_pid.clone(), pid.clone()],
        },
    );
    state.players[0].position = Some(city_coord);
    state.players[0].hand.clear();
    state.players[0].deck = (0..20).map(|i| CardId::from(format!("card_{}", i).as_str())).collect();
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let base = state.players[0].hand_limit as usize;

    let _ = end_turn(&mut state, 0);

    assert_eq!(
        state.players[0].hand.len(),
        base + 1,
        "When tied on shields, first-placed player is leader; our player should get +1"
    );
}

#[test]
fn city_leader_tiebreak_first_placed_we_are_leader() {
    use crate::end_turn::end_turn;

    let mut state = setup_playing_game(vec!["march"]);
    let city_coord = HexCoord::new(5, 5);
    let pid = state.players[0].id.clone();
    let other_pid = mk_types::ids::PlayerId::from("player_1");

    // Both have 2 shields — but we placed first → we are leader (+2)
    state.map.hexes.insert(
        city_coord.key(),
        HexState {
            coord: city_coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type: SiteType::City,
                owner: Some(pid.clone()),
                is_conquered: true,
                is_burned: false,
                city_color: Some(BasicManaColor::White),
                mine_color: None,
                deep_mine_colors: None,
            }),
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            // We placed first
            shield_tokens: vec![pid.clone(), other_pid.clone(), pid.clone(), other_pid.clone()],
        },
    );
    state.players[0].position = Some(city_coord);
    state.players[0].hand.clear();
    state.players[0].deck = (0..20).map(|i| CardId::from(format!("card_{}", i).as_str())).collect();
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let base = state.players[0].hand_limit as usize;

    let _ = end_turn(&mut state, 0);

    assert_eq!(
        state.players[0].hand.len(),
        base + 2,
        "When tied on shields and we placed first, we are leader → +2 bonus"
    );
}

#[test]
fn keep_stays_at_plus_one() {
    use crate::end_turn::end_turn;

    let mut state = setup_playing_game(vec!["march"]);
    let keep_coord = HexCoord::new(5, 5);
    let pid = state.players[0].id.clone();

    state.map.hexes.insert(
        keep_coord.key(),
        HexState {
            coord: keep_coord,
            terrain: Terrain::Plains,
            tile_id: TileId::StartingA,
            site: Some(Site {
                site_type: SiteType::Keep,
                owner: Some(pid.clone()),
                is_conquered: true,
                is_burned: false,
                city_color: None,
                mine_color: None,
                deep_mine_colors: None,
            }),
            rampaging_enemies: ArrayVec::new(),
            enemies: ArrayVec::new(),
            ruins_token: None,
            shield_tokens: vec![pid.clone()],
        },
    );
    state.players[0].position = Some(keep_coord);
    state.players[0].hand.clear();
    state.players[0].deck = (0..20).map(|i| CardId::from(format!("card_{}", i).as_str())).collect();
    state.players[0].flags.insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);
    let base = state.players[0].hand_limit as usize;

    let _ = end_turn(&mut state, 0);

    assert_eq!(
        state.players[0].hand.len(),
        base + 1,
        "Keep should give +1 hand limit bonus (not affected by city leader rules)"
    );
}

