//! Game setup — initial state construction for solo games.
//!
//! Matches the TS `createGameWithPlayers` flow in `GameServer.ts`.

use std::collections::BTreeMap;

use arrayvec::ArrayVec;
use mk_data::heroes::{
    build_starting_deck, LEVEL_1_ARMOR, LEVEL_1_COMMAND_TOKENS, LEVEL_1_HAND_LIMIT,
    STARTING_HAND_SIZE,
};
use mk_data::enemy_piles::create_enemy_token_piles;
use mk_data::offers::{create_aa_deck_and_offer, create_spell_deck_and_offer};
use mk_data::unit_offers::create_unit_deck_and_offer;
use mk_data::tiles::{find_portal, get_tile_hexes, starting_tile_hexes};
use mk_types::enums::*;
use mk_types::hex::{HexCoord, HexDirection, TILE_PLACEMENT_OFFSETS};
use mk_types::ids::*;
use mk_types::rng::RngState;
use mk_types::state::*;

use crate::dummy_player;

// =============================================================================
// Day tactic IDs (matches TS DAY_TACTIC_IDS)
// =============================================================================

/// The 6 day tactics, in canonical order.
pub const DAY_TACTIC_IDS: [&str; 6] = [
    "early_bird",
    "rethink",
    "mana_steal",
    "planning",
    "great_start",
    "the_right_moment",
];

// =============================================================================
// Mana source creation
// =============================================================================

/// All 6 mana colors in dice-roll order.
const ALL_MANA_COLORS_ARRAY: [ManaColor; 6] = [
    ManaColor::Red,
    ManaColor::Blue,
    ManaColor::Green,
    ManaColor::White,
    ManaColor::Gold,
    ManaColor::Black,
];

/// Roll a single die: pick a random color from 6 options.
/// Matches TS: `Math.floor(value * 6)` with uniform distribution.
fn roll_die_color(rng: &mut RngState) -> ManaColor {
    let value = rng.next_f64();
    let index = (value * 6.0) as usize;
    ALL_MANA_COLORS_ARRAY[index]
}

/// Create the mana source dice pool.
///
/// `dice_count = player_count + 2`. After initial roll, rerolls any gold/black
/// dice until at least `ceil(dice_count / 2)` show basic colors.
/// Black dice start depleted during daytime.
pub fn create_mana_source(
    player_count: u32,
    time_of_day: TimeOfDay,
    rng: &mut RngState,
) -> ManaSource {
    let dice_count = (player_count + 2) as usize;
    let min_basic = dice_count.div_ceil(2); // ceil(dice_count / 2)

    // Initial roll
    let mut colors: Vec<ManaColor> = (0..dice_count).map(|_| roll_die_color(rng)).collect();

    // Reroll gold/black until enough basic colors
    loop {
        let basic_count = colors.iter().filter(|c| c.is_basic()).count();
        if basic_count >= min_basic {
            break;
        }
        for color in colors.iter_mut() {
            if !color.is_basic() {
                *color = roll_die_color(rng);
            }
        }
    }

    // Build dice with depletion rules
    let dice = colors
        .into_iter()
        .enumerate()
        .map(|(i, color)| {
            let is_depleted = match time_of_day {
                TimeOfDay::Day => color == ManaColor::Black,
                TimeOfDay::Night => color == ManaColor::Gold,
            };
            SourceDie {
                id: SourceDieId::from(format!("die_{}", i)),
                color,
                is_depleted,
                taken_by_player_id: None,
            }
        })
        .collect();

    ManaSource { dice }
}

// =============================================================================
// Player creation
// =============================================================================

/// Create a player with shuffled deck and drawn hand.
fn create_player(id: &str, hero: Hero, position: HexCoord, rng: &mut RngState) -> PlayerState {
    // Build and shuffle the 16-card starting deck
    let mut deck = build_starting_deck(hero);
    rng.shuffle(&mut deck);

    // Draw starting hand (first 5 cards)
    let hand: Vec<CardId> = deck.drain(..STARTING_HAND_SIZE).collect();

    PlayerState {
        id: PlayerId::from(id),
        hero,
        position: Some(position),

        fame: 0,
        level: 1,
        reputation: 0,

        armor: LEVEL_1_ARMOR,
        hand_limit: LEVEL_1_HAND_LIMIT,
        command_tokens: LEVEL_1_COMMAND_TOKENS,

        hand,
        deck,
        discard: Vec::new(),
        play_area: Vec::new(),
        removed_cards: Vec::new(),

        units: ArrayVec::new(),
        bonds_of_loyalty_unit_instance_id: None,
        attached_banners: ArrayVec::new(),

        skills: Vec::new(),
        skill_cooldowns: SkillCooldowns::default(),
        skill_flip_state: SkillFlipState::default(),
        remaining_hero_skills: mk_data::skills::get_hero_skill_ids(hero)
            .iter()
            .map(|&s| SkillId::from(s))
            .collect(),
        master_of_chaos_state: None,

        kept_enemy_tokens: ArrayVec::new(),

        crystals: Crystals::default(),
        spent_crystals_this_turn: Crystals::default(),

        selected_tactic: None,
        tactic_state: TacticState::default(),

        pure_mana: Vec::new(),
        used_die_ids: Vec::new(),
        mana_draw_die_ids: Vec::new(),
        mana_used_this_turn: Vec::new(),

        combat_accumulator: CombatAccumulator::default(),

        move_points: 0,
        influence_points: 0,
        healing_points: 0,
        enemies_defeated_this_turn: 0,
        wounds_healed_from_hand_this_turn: 0,
        units_healed_this_turn: Vec::new(),
        units_recruited_this_interaction: Vec::new(),
        spell_colors_cast_this_turn: Vec::new(),
        spells_cast_by_color_this_turn: BTreeMap::new(),
        meditation_hand_limit_bonus: 0,

        wounds_received_this_turn: WoundsReceived::default(),
        time_bending_set_aside_cards: Vec::new(),
        mysterious_box_state: None,

        flags: PlayerFlags::empty(),
        pending: mk_types::pending::PendingQueue::new(),
    }
}

// =============================================================================
// Map setup
// =============================================================================

/// Place the starting tile on the map at origin (0,0).
pub(crate) fn place_starting_tile(tile_id: TileId) -> MapState {
    let center = HexCoord::new(0, 0);
    let hexes_def = starting_tile_hexes(tile_id).expect("Unknown starting tile");

    let mut hexes = BTreeMap::new();
    for tile_hex in hexes_def {
        // Starting tile center is at origin, so world coord = local coord
        let coord = HexCoord::new(center.q + tile_hex.local.q, center.r + tile_hex.local.r);
        let site = tile_hex.site_type.map(|st| Site {
            site_type: st,
            owner: None,
            is_conquered: false,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        });
        hexes.insert(
            coord.key(),
            HexState {
                coord,
                terrain: tile_hex.terrain,
                tile_id,
                site,
                rampaging_enemies: ArrayVec::new(),
                enemies: ArrayVec::new(),
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );
    }

    let tiles = vec![TilePlacement {
        tile_id,
        center_coord: center,
        revealed: true,
    }];

    MapState {
        hexes,
        tiles,
        tile_deck: TileDeck::default(),
        tile_slots: BTreeMap::new(),
    }
}

// =============================================================================
// Full game setup
// =============================================================================

/// Create a solo game (1 player) with the given seed and hero.
///
/// Uses the First Reconnaissance scenario:
/// - Starting Tile A placed at origin
/// - 3 mana source dice (1 player + 2)
/// - 6 day tactics available
/// - Round 1, daytime, tactics selection phase
/// - Tile deck created from scenario config (8 countryside + 2 core + 1 city)
///
/// Note: Does NOT place initial countryside tiles. Call `place_initial_tiles()`
/// after this to place the scenario's starting map tiles (e.g., NE + E for Wedge).
pub fn create_solo_game(seed: u32, hero: Hero) -> GameState {
    let mut rng = RngState::new(seed);

    let scenario_config = mk_data::scenarios::first_reconnaissance();

    // Place starting tile
    let mut map = place_starting_tile(TileId::StartingA);

    // Create tile deck from scenario config
    map.tile_deck = mk_data::tiles::create_tile_deck(&scenario_config, &mut rng);

    // Find portal hex for player start position
    let hexes_def_for_portal = starting_tile_hexes(TileId::StartingA).unwrap();
    let portal_local = find_portal(hexes_def_for_portal).expect("Starting tile must have portal");
    let player_pos = HexCoord::new(portal_local.q, portal_local.r);

    // Create player
    let player_id = "player_0";
    let player = create_player(player_id, hero, player_pos, &mut rng);

    // Create mana source
    let source = create_mana_source(1, TimeOfDay::Day, &mut rng);

    // Create enemy token piles
    let enemy_tokens = create_enemy_token_piles(&mut rng);

    // Create offers and decks
    let (aa_deck, aa_offer) = create_aa_deck_and_offer(&mut rng);
    let (spell_deck, spell_offer) = create_spell_deck_and_offer(&mut rng);
    let (unit_deck, unit_offer) = create_unit_deck_and_offer(&mut rng, 1);

    // Create dummy player for solo mode
    let dummy_hero = dummy_player::select_dummy_hero(&[hero], &mut rng);
    let dummy = dummy_player::create_dummy_player(dummy_hero, &mut rng);

    // Day tactics
    let available_tactics: Vec<TacticId> =
        DAY_TACTIC_IDS.iter().map(|&s| TacticId::from(s)).collect();

    let player_id_owned = PlayerId::from(player_id);
    let dummy_id = PlayerId::from(dummy_player::DUMMY_PLAYER_ID);

    GameState {
        phase: GamePhase::Round,
        time_of_day: TimeOfDay::Day,
        round: 1,
        turn_order: vec![player_id_owned.clone(), dummy_id],
        current_player_index: 0,
        end_of_round_announced_by: None,
        players_with_final_turn: Vec::new(),
        players: vec![player],
        map,
        combat: None,

        round_phase: RoundPhase::TacticsSelection,
        available_tactics,
        removed_tactics: Vec::new(),
        dummy_player_tactic: None,
        tactics_selection_order: vec![player_id_owned.clone()],
        current_tactic_selector: Some(player_id_owned),

        source,
        offers: GameOffers {
            advanced_actions: aa_offer,
            spells: spell_offer,
            units: unit_offer,
            ..GameOffers::default()
        },
        enemy_tokens,
        ruins_tokens: RuinsTokenPiles::default(),
        decks: GameDecks {
            advanced_action_deck: aa_deck,
            spell_deck,
            unit_deck,
            ..GameDecks::default()
        },

        city_level: scenario_config.default_city_level,
        cities: BTreeMap::new(),

        active_modifiers: Vec::new(),
        action_epoch: 0,
        next_instance_counter: 1,

        rng,

        wound_pile_count: None, // unlimited

        scenario_id: ScenarioId::from("first_reconnaissance"),
        scenario_config,
        scenario_end_triggered: false,
        final_turns_remaining: None,
        game_ended: false,
        winning_player_id: None,

        pending_cooperative_assault: None,
        final_score_result: None,

        mana_overload_center: None,
        mana_enhancement_center: None,
        source_opening_center: None,

        dummy_player: Some(dummy),
    }
}

/// Place initial countryside tiles adjacent to the starting tile.
///
/// For the First Reconnaissance scenario (Wedge shape), this places 2 tiles
/// at NE and E from origin. Should be called after `create_solo_game()` for
/// games that need the full starting map (e.g., the UI server).
pub fn place_initial_tiles(state: &mut GameState) {
    let initial_directions = initial_tile_directions(state.scenario_config.map_shape);
    let starting_center = HexCoord::new(0, 0);

    let mut placements: Vec<(TileId, HexCoord)> = Vec::new();
    for &dir in initial_directions {
        // Draw from countryside deck
        let tile_id = if !state.map.tile_deck.countryside.is_empty() {
            state.map.tile_deck.countryside.remove(0)
        } else {
            continue;
        };

        // Calculate placement position
        let offset = TILE_PLACEMENT_OFFSETS
            .iter()
            .find(|(d, _)| *d == dir)
            .map(|(_, off)| *off)
            .expect("Invalid direction");
        let new_center = HexCoord::new(starting_center.q + offset.q, starting_center.r + offset.r);

        // Place tile hexes on map
        if let Some(tile_hexes) = get_tile_hexes(tile_id) {
            crate::movement::place_tile_on_map(&mut state.map, tile_id, new_center, tile_hexes);
        }

        // Track tile placement
        state.map.tiles.push(TilePlacement {
            tile_id,
            center_coord: new_center,
            revealed: true,
        });

        placements.push((tile_id, new_center));
    }

    // Draw enemies onto initial countryside tiles (requires full state for RNG + token piles)
    for (tile_id, center) in placements {
        if let Some(tile_hexes) = get_tile_hexes(tile_id) {
            crate::movement::draw_enemies_on_tile(state, center, tile_hexes);
        }
    }
}

/// Get initial tile placement directions for a map shape.
/// Matches TS MAP_SHAPE_CONFIGS[shape].initialTilePositions.
fn initial_tile_directions(shape: MapShape) -> &'static [HexDirection] {
    match shape {
        MapShape::Wedge | MapShape::Open => &[HexDirection::NE, HexDirection::E],
        MapShape::Open3 => &[HexDirection::NE, HexDirection::E, HexDirection::SE],
        MapShape::Open4 => &[HexDirection::NE, HexDirection::E, HexDirection::SE, HexDirection::SW],
        MapShape::Open5 => &[HexDirection::NE, HexDirection::E, HexDirection::SE, HexDirection::SW, HexDirection::W],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn solo_game_creates_valid_state() {
        let state = create_solo_game(42, Hero::Arythea);

        assert_eq!(state.phase, GamePhase::Round);
        assert_eq!(state.time_of_day, TimeOfDay::Day);
        assert_eq!(state.round, 1);
        assert_eq!(state.round_phase, RoundPhase::TacticsSelection);
        assert_eq!(state.players.len(), 1);
        assert_eq!(state.city_level, 1);
        assert!(!state.game_ended);
    }

    #[test]
    fn player_starts_with_correct_stats() {
        let state = create_solo_game(42, Hero::Arythea);
        let player = &state.players[0];

        assert_eq!(player.fame, 0);
        assert_eq!(player.level, 1);
        assert_eq!(player.reputation, 0);
        assert_eq!(player.armor, 2);
        assert_eq!(player.hand_limit, 5);
        assert_eq!(player.command_tokens, 1);
    }

    #[test]
    fn player_has_5_hand_11_deck() {
        let state = create_solo_game(42, Hero::Arythea);
        let player = &state.players[0];

        assert_eq!(player.hand.len(), 5);
        assert_eq!(player.deck.len(), 11);
        assert!(player.discard.is_empty());
    }

    #[test]
    fn player_starts_at_portal() {
        let state = create_solo_game(42, Hero::Arythea);
        let player = &state.players[0];

        assert_eq!(player.position, Some(HexCoord::new(0, 0)));
    }

    #[test]
    fn starting_tile_has_7_hexes() {
        let state = create_solo_game(42, Hero::Arythea);

        assert_eq!(state.map.hexes.len(), 7);
        assert_eq!(state.map.tiles.len(), 1);
        assert_eq!(state.map.tiles[0].tile_id, TileId::StartingA);
    }

    #[test]
    fn place_initial_tiles_adds_countryside() {
        let mut state = create_solo_game(42, Hero::Arythea);
        place_initial_tiles(&mut state);

        // Starting tile (7 hexes) + 2 initial countryside tiles (7 each) = 21 hexes
        assert_eq!(state.map.hexes.len(), 21);
        assert_eq!(state.map.tiles.len(), 3);
        assert_eq!(state.map.tiles[0].tile_id, TileId::StartingA);
        // Initial tiles are placed at NE and E from origin
        assert!(state.map.tiles[1].revealed);
        assert!(state.map.tiles[2].revealed);
    }

    #[test]
    fn portal_hex_exists_on_map() {
        let state = create_solo_game(42, Hero::Arythea);
        let portal_hex = state.map.hexes.get("0,0").unwrap();

        assert_eq!(portal_hex.terrain, Terrain::Plains);
        assert!(portal_hex.site.is_some());
        assert_eq!(
            portal_hex.site.as_ref().unwrap().site_type,
            SiteType::Portal
        );
    }

    #[test]
    fn mana_source_has_3_dice_for_solo() {
        let state = create_solo_game(42, Hero::Arythea);

        assert_eq!(state.source.dice.len(), 3);
        assert_eq!(state.source.dice[0].id.as_str(), "die_0");
        assert_eq!(state.source.dice[1].id.as_str(), "die_1");
        assert_eq!(state.source.dice[2].id.as_str(), "die_2");
    }

    #[test]
    fn mana_source_has_enough_basic_colors() {
        // With 3 dice, at least 2 must be basic (ceil(3/2) = 2)
        for seed in 0..100 {
            let state = create_solo_game(seed, Hero::Arythea);
            let basic_count = state
                .source
                .dice
                .iter()
                .filter(|d| d.color.is_basic())
                .count();
            assert!(
                basic_count >= 2,
                "Seed {} produced only {} basic dice",
                seed,
                basic_count
            );
        }
    }

    #[test]
    fn black_dice_start_depleted_during_day() {
        // Run many seeds to find one with a black die
        for seed in 0..1000 {
            let state = create_solo_game(seed, Hero::Arythea);
            for die in &state.source.dice {
                if die.color == ManaColor::Black {
                    assert!(die.is_depleted, "Seed {} has non-depleted black die", seed);
                }
            }
        }
    }

    #[test]
    fn available_tactics_are_6_day_tactics() {
        let state = create_solo_game(42, Hero::Arythea);

        assert_eq!(state.available_tactics.len(), 6);
        assert_eq!(state.available_tactics[0].as_str(), "early_bird");
        assert_eq!(state.available_tactics[5].as_str(), "the_right_moment");
    }

    #[test]
    fn deterministic_same_seed() {
        let state1 = create_solo_game(42, Hero::Arythea);
        let state2 = create_solo_game(42, Hero::Arythea);

        // Same seed → same hand
        assert_eq!(state1.players[0].hand, state2.players[0].hand);
        assert_eq!(state1.players[0].deck, state2.players[0].deck);

        // Same seed → same dice colors
        for (d1, d2) in state1.source.dice.iter().zip(state2.source.dice.iter()) {
            assert_eq!(d1.color, d2.color);
        }
    }

    #[test]
    fn different_seeds_different_hands() {
        let state1 = create_solo_game(42, Hero::Arythea);
        let state2 = create_solo_game(99, Hero::Arythea);

        // Very unlikely (but not impossible) that two different seeds give same hand
        // Just check they can differ — sufficient for a smoke test
        let hands_differ = state1.players[0].hand != state2.players[0].hand;
        let decks_differ = state1.players[0].deck != state2.players[0].deck;
        assert!(
            hands_differ || decks_differ,
            "Seeds 42 and 99 produced identical player cards — extremely unlikely"
        );
    }

    #[test]
    fn all_heroes_produce_valid_game() {
        for hero in [
            Hero::Arythea,
            Hero::Tovak,
            Hero::Goldyx,
            Hero::Norowas,
            Hero::Wolfhawk,
            Hero::Krang,
            Hero::Braevalar,
        ] {
            let state = create_solo_game(42, hero);
            assert_eq!(state.players[0].hero, hero);
            assert_eq!(state.players[0].hand.len(), 5);
            assert_eq!(state.players[0].deck.len(), 11);
        }
    }

    #[test]
    fn rng_counter_advanced_after_setup() {
        let state = create_solo_game(42, Hero::Arythea);
        // RNG should have been used: 15 draws for shuffle + 3+ for dice + offers
        assert!(
            state.rng.counter > 15,
            "RNG counter should be > 15 after setup, got {}",
            state.rng.counter
        );
    }

    #[test]
    fn solo_game_has_aa_offer_and_deck() {
        let state = create_solo_game(42, Hero::Arythea);
        assert_eq!(state.offers.advanced_actions.len(), 3);
        assert_eq!(state.decks.advanced_action_deck.len(), 41); // 44 - 3
    }

    #[test]
    fn solo_game_has_spell_offer_and_deck() {
        let state = create_solo_game(42, Hero::Arythea);
        assert_eq!(state.offers.spells.len(), 3);
        assert_eq!(state.decks.spell_deck.len(), 21); // 24 - 3
    }

    #[test]
    fn solo_game_offers_contain_valid_cards() {
        let state = create_solo_game(42, Hero::Arythea);
        for card_id in &state.offers.advanced_actions {
            assert!(
                mk_data::cards::get_card(card_id.as_str()).is_some(),
                "AA offer card '{}' not found",
                card_id
            );
        }
        for card_id in &state.offers.spells {
            assert!(
                mk_data::cards::get_card(card_id.as_str()).is_some(),
                "Spell offer card '{}' not found",
                card_id
            );
        }
    }
}
