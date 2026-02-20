//! Movement system — MOVE and EXPLORE commands.
//!
//! Matches TS `moveCommand.ts` and `exploreCommand.ts`.
//!
//! ## Key concepts
//!
//! - `evaluate_move_entry` is the single source of truth for hex entry legality/cost.
//! - Rampaging enemies block direct entry but provoke combat when skirted past.
//! - Explore places a new tile adjacent to the player's current tile.

use arrayvec::ArrayVec;
use mk_data::enemy_piles::{
    draw_enemy_token, is_site_enemy_revealed, rampaging_enemy_color, site_defender_config,
};
use mk_data::tiles::get_tile_hexes;
use mk_types::enums::*;
use mk_types::hex::{HexCoord, HexDirection, TILE_HEX_OFFSETS, TILE_PLACEMENT_OFFSETS};
use mk_types::ids::EnemyTokenId;
use mk_types::state::*;

use crate::combat;
use crate::combat::CombatError;

// =============================================================================
// Error / result types
// =============================================================================

/// Reasons a hex cannot be entered.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MoveBlockReason {
    /// Hex coordinate is not on the map.
    HexMissing,
    /// Terrain is impassable (lake, mountain, ocean).
    Impassable,
    /// Rampaging enemies block entry into this hex.
    Rampaging,
}

/// Result of evaluating whether a hex can be entered.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MoveEntryResult {
    /// Movement cost to enter this hex. None if blocked.
    pub cost: Option<u32>,
    /// If blocked, the reason why.
    pub block_reason: Option<MoveBlockReason>,
}

impl MoveEntryResult {
    fn passable(cost: u32) -> Self {
        Self {
            cost: Some(cost),
            block_reason: None,
        }
    }

    fn blocked(reason: MoveBlockReason) -> Self {
        Self {
            cost: None,
            block_reason: Some(reason),
        }
    }

    /// Returns true if the hex can be entered.
    pub fn is_passable(&self) -> bool {
        self.cost.is_some()
    }
}

/// Errors from move execution.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MoveError {
    /// Player has no position on the map.
    NoPosition,
    /// Target hex is not adjacent to player's current position.
    NotAdjacent,
    /// Player doesn't have enough move points.
    InsufficientMovePoints,
    /// Hex is blocked (impassable terrain, rampaging enemies, etc.)
    Blocked(MoveBlockReason),
    /// Combat entry failed during provocation.
    CombatFailed(CombatError),
}

/// Errors from explore execution.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExploreError {
    /// Player has no position on the map.
    NoPosition,
    /// Player doesn't have enough move points (need 2).
    InsufficientMovePoints,
    /// No tiles left in any draw deck.
    NoTilesAvailable,
    /// Tile ID doesn't have a definition in mk-data.
    UnknownTile,
    /// Target area already has hexes placed.
    AreaAlreadyOccupied,
    /// Player is not on the edge of their tile facing the explore direction.
    NotOnTileEdge,
}

/// Info about rampaging enemies provoked by skirting past them.
#[derive(Debug, Clone)]
pub struct ProvocationInfo {
    /// Hex coordinates containing the rampaging enemies that were provoked.
    pub provoked_hexes: Vec<HexCoord>,
}

/// Result of executing a move.
#[derive(Debug)]
pub struct MoveResult {
    /// The terrain cost paid for this move.
    pub cost: u32,
    /// Whether any rampaging enemies were provoked (skirted past).
    pub provocation: Option<ProvocationInfo>,
}

// =============================================================================
// Terrain cost
// =============================================================================

/// Get the movement cost for a terrain type at the given time of day.
/// Returns None for impassable terrain (lake, mountain, ocean).
pub fn get_terrain_cost(terrain: Terrain, time_of_day: TimeOfDay) -> Option<u32> {
    match time_of_day {
        TimeOfDay::Day => terrain.day_cost(),
        TimeOfDay::Night => terrain.night_cost(),
    }
    .map(|c| c as u32)
}

// =============================================================================
// evaluate_move_entry — single source of truth
// =============================================================================

/// Evaluate whether a player can enter a hex and at what cost.
///
/// This is the single source of truth for hex entry legality, matching
/// the TS `evaluateMoveEntry` function. Checks in order:
/// 1. Hex must exist on the map
/// 2. Terrain must be passable (day/night cost table)
/// 3. No rampaging enemies blocking entry (both type slots AND drawn tokens present)
pub fn evaluate_move_entry(
    state: &GameState,
    _player_idx: usize,
    coord: HexCoord,
) -> MoveEntryResult {
    // 1. Check hex exists
    let hex = match state.map.hexes.get(&coord.key()) {
        Some(h) => h,
        None => return MoveEntryResult::blocked(MoveBlockReason::HexMissing),
    };

    // 2. Check terrain passability
    // TODO: apply terrain cost modifiers (RULE_TERRAIN_DAY_NIGHT_SWAP, replaceCost, etc.)
    let cost = match get_terrain_cost(hex.terrain, state.time_of_day) {
        Some(c) => c,
        None => return MoveEntryResult::blocked(MoveBlockReason::Impassable),
    };

    // 3. Check rampaging enemies
    // Both rampaging_enemies (type slots from tile) and enemies (drawn tokens) must be non-empty.
    // TODO: check for RULE_IGNORE_RAMPAGING_PROVOKE modifier
    if !hex.rampaging_enemies.is_empty() && !hex.enemies.is_empty() {
        return MoveEntryResult::blocked(MoveBlockReason::Rampaging);
    }

    // TODO: city entry check (scenarioConfig.citiesCanBeEntered)
    // TODO: terrain prohibition modifiers (EFFECT_TERRAIN_PROHIBITION)

    MoveEntryResult::passable(cost)
}

// =============================================================================
// Provocation detection
// =============================================================================

/// Find all hexes with rampaging enemies that are adjacent to BOTH `from` and `to`.
///
/// When a player moves from hex A to hex B, any hex C that neighbors both A and B
/// and contains active rampaging enemies will provoke those enemies ("skirting").
pub fn find_provoked_rampaging_enemies(
    state: &GameState,
    from: HexCoord,
    to: HexCoord,
) -> Vec<HexCoord> {
    let from_neighbors = from.neighbors();
    let to_neighbors = to.neighbors();

    let mut provoked = Vec::new();
    for from_n in &from_neighbors {
        if to_neighbors.contains(from_n) {
            if let Some(hex) = state.map.hexes.get(&from_n.key()) {
                if !hex.rampaging_enemies.is_empty() && !hex.enemies.is_empty() {
                    provoked.push(*from_n);
                }
            }
        }
    }
    provoked
}

// =============================================================================
// execute_move
// =============================================================================

/// Execute a MOVE action — move the player to an adjacent hex.
///
/// Steps:
/// 1. Validate player has a position and target is adjacent (distance 1)
/// 2. Evaluate hex entry (terrain cost, rampaging, etc.)
/// 3. Check sufficient move points
/// 4. Detect provocation from rampaging enemies
/// 5. Update player position, deduct move points, set flags
pub fn execute_move(
    state: &mut GameState,
    player_idx: usize,
    target: HexCoord,
) -> Result<MoveResult, MoveError> {
    let from = state.players[player_idx]
        .position
        .ok_or(MoveError::NoPosition)?;

    // Must be adjacent (distance 1)
    if from.distance(target) != 1 {
        return Err(MoveError::NotAdjacent);
    }

    // Evaluate hex entry
    let entry = evaluate_move_entry(state, player_idx, target);
    let cost = match entry.cost {
        Some(c) => c,
        None => return Err(MoveError::Blocked(entry.block_reason.unwrap())),
    };

    // Check move points
    if state.players[player_idx].move_points < cost {
        return Err(MoveError::InsufficientMovePoints);
    }

    // Detect provocation before mutating state
    let provoked_hexes = find_provoked_rampaging_enemies(state, from, target);
    let provocation = if provoked_hexes.is_empty() {
        None
    } else {
        Some(ProvocationInfo { provoked_hexes })
    };

    // Apply the move
    let player = &mut state.players[player_idx];
    player.position = Some(target);
    player.move_points -= cost;
    player.flags.insert(PlayerFlags::HAS_MOVED_THIS_TURN);
    player.units_recruited_this_interaction.clear();

    // Enter combat with first provoked hex's enemies (multi-hex provocation is rare; extend later)
    if let Some(provoked_hex) = provocation.as_ref().and_then(|p| p.provoked_hexes.first()) {
        let hex = state.map.hexes.get(&provoked_hex.key()).unwrap();
        let enemy_tokens: Vec<EnemyTokenId> = hex.enemies.iter().map(|e| e.token_id.clone()).collect();
        combat::execute_enter_combat(
            state,
            player_idx,
            &enemy_tokens,
            false,
            Some(*provoked_hex),
            Default::default(),
        )
        .map_err(MoveError::CombatFailed)?;
    }

    // TODO: fortified assault combat trigger (entering unconquered keep/mage tower/city)
    // TODO: enemy reveal at fortified sites (daytime, reveal distance 1 or 2)
    // TODO: ruins token reveal

    Ok(MoveResult { cost, provocation })
}

// =============================================================================
// Explore helpers
// =============================================================================

/// Base move point cost for exploring.
pub const EXPLORE_BASE_COST: u32 = 2;

/// Find the center coordinate of the tile containing a given hex position.
///
/// Iterates all placed tiles and checks if `pos` matches any of the 7 hex
/// positions within each tile.
pub fn find_tile_center(map: &MapState, pos: HexCoord) -> Option<HexCoord> {
    for tile in &map.tiles {
        for offset in &TILE_HEX_OFFSETS {
            let hex_coord = HexCoord::new(
                tile.center_coord.q + offset.q,
                tile.center_coord.r + offset.r,
            );
            if hex_coord == pos {
                return Some(tile.center_coord);
            }
        }
    }
    None
}

/// Calculate the center position for a new tile placed in a given direction
/// from a tile center. Uses TILE_PLACEMENT_OFFSETS to ensure tiles connect
/// with exactly 3 adjacent hex pairs.
pub fn calculate_tile_placement(tile_center: HexCoord, direction: HexDirection) -> HexCoord {
    let offset = TILE_PLACEMENT_OFFSETS
        .iter()
        .find(|(dir, _)| *dir == direction)
        .map(|(_, offset)| *offset)
        .expect("All 6 directions have placement offsets");

    HexCoord::new(tile_center.q + offset.q, tile_center.r + offset.r)
}

/// Check if the player is near enough to the tile edge to explore in a direction.
///
/// The player must be on one of the hexes adjacent to where the new tile's
/// hexes would connect. Specifically, at least one hex in the new tile placement
/// must be within distance 1 of the player's position.
pub fn is_player_near_explore_edge(
    player_pos: HexCoord,
    tile_center: HexCoord,
    direction: HexDirection,
) -> bool {
    let target_center = calculate_tile_placement(tile_center, direction);

    for offset in TILE_HEX_OFFSETS {
        let new_hex = HexCoord::new(target_center.q + offset.q, target_center.r + offset.r);
        if player_pos.distance(new_hex) <= 1 {
            return true;
        }
    }
    false
}

/// Place a tile's hexes onto the map at a given center coordinate.
fn place_tile_on_map(
    map: &mut MapState,
    tile_id: TileId,
    center: HexCoord,
    tile_hexes: &[mk_data::tiles::TileHex],
) {
    for tile_hex in tile_hexes {
        let coord = HexCoord::new(center.q + tile_hex.local.q, center.r + tile_hex.local.r);
        let site = tile_hex.site_type.map(|st| Site {
            site_type: st,
            owner: None,
            is_conquered: false,
            is_burned: false,
            city_color: None,
            mine_color: tile_hex.mine_color,
            deep_mine_colors: if tile_hex.deep_mine_colors.is_empty() {
                None
            } else {
                let mut colors = ArrayVec::new();
                for &c in tile_hex.deep_mine_colors {
                    colors.push(c);
                }
                Some(colors)
            },
        });
        let mut rampaging_enemies = ArrayVec::new();
        for &rt in tile_hex.rampaging {
            rampaging_enemies.push(rt);
        }
        map.hexes.insert(
            coord.key(),
            HexState {
                coord,
                terrain: tile_hex.terrain,
                tile_id,
                site,
                rampaging_enemies,
                enemies: ArrayVec::new(), // TODO: draw from enemy token piles
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );
    }
}

// =============================================================================
// Enemy drawing on tile placement
// =============================================================================

/// Draw enemy tokens onto hexes of a newly placed tile.
///
/// For each hex on the tile:
/// - For each rampaging enemy type, draw a token of the matching color.
///   Rampaging enemies are always face-up (revealed).
/// - For sites with defenders (Keep, MageTower, Maze, Labyrinth), draw
///   tokens based on site_defender_config. Fortified sites are face-down.
fn draw_enemies_on_tile(
    state: &mut GameState,
    center: HexCoord,
    tile_hexes: &[mk_data::tiles::TileHex],
) {
    for tile_hex in tile_hexes {
        let coord = HexCoord::new(center.q + tile_hex.local.q, center.r + tile_hex.local.r);

        let mut drawn: ArrayVec<HexEnemy, MAX_HEX_ENEMIES> = ArrayVec::new();

        // 1. Draw for rampaging enemy types
        for &ramp_type in tile_hex.rampaging {
            let color = rampaging_enemy_color(ramp_type);
            if let Some(token_id) = draw_enemy_token(
                &mut state.enemy_tokens,
                color,
                &mut state.rng,
            ) {
                drawn.push(HexEnemy {
                    token_id,
                    color,
                    is_revealed: true, // rampaging always face-up
                });
            }
        }

        // 2. Draw for site defenders
        if let Some(site_type) = tile_hex.site_type {
            if let Some(config) = site_defender_config(site_type) {
                let is_revealed = is_site_enemy_revealed(site_type);
                for _ in 0..config.count {
                    if let Some(token_id) = draw_enemy_token(
                        &mut state.enemy_tokens,
                        config.color,
                        &mut state.rng,
                    ) {
                        drawn.push(HexEnemy {
                            token_id,
                            color: config.color,
                            is_revealed,
                        });
                    }
                }
            }
        }

        // Apply drawn enemies to the hex
        if !drawn.is_empty() {
            if let Some(hex) = state.map.hexes.get_mut(&coord.key()) {
                for enemy in drawn {
                    hex.enemies.push(enemy);
                }
            }
        }
    }
}

// =============================================================================
// execute_explore
// =============================================================================

/// Execute an EXPLORE action — reveal a new tile adjacent to the player.
///
/// Steps:
/// 1. Validate player has enough move points (base cost 2)
/// 2. Find which tile the player is currently on
/// 3. Draw next tile from countryside deck (then core if empty)
/// 4. Calculate placement from player's tile center + direction
/// 5. Verify no overlap with existing hexes
/// 6. Place all 7 hexes on the map with terrain, sites, rampaging types
/// 7. Deduct move points
pub fn execute_explore(
    state: &mut GameState,
    player_idx: usize,
    direction: HexDirection,
) -> Result<(), ExploreError> {
    let pos = state.players[player_idx]
        .position
        .ok_or(ExploreError::NoPosition)?;

    // TODO: apply explore cost modifiers (EFFECT_EXPLORE_COST_REDUCTION)
    if state.players[player_idx].move_points < EXPLORE_BASE_COST {
        return Err(ExploreError::InsufficientMovePoints);
    }

    // Find which tile the player is currently on
    let tile_center = find_tile_center(&state.map, pos).ok_or(ExploreError::NoPosition)?;

    // Validate player is on the edge of their tile facing the explore direction
    if !is_player_near_explore_edge(pos, tile_center, direction) {
        return Err(ExploreError::NotOnTileEdge);
    }

    // Draw next tile from countryside deck (then core if empty)
    let tile_id = if !state.map.tile_deck.countryside.is_empty() {
        state.map.tile_deck.countryside.remove(0)
    } else if !state.map.tile_deck.core.is_empty() {
        state.map.tile_deck.core.remove(0)
    } else {
        return Err(ExploreError::NoTilesAvailable);
    };

    // Calculate new tile center from current tile center + direction
    let new_center = calculate_tile_placement(tile_center, direction);

    // Verify no overlap with existing hexes
    for offset in &TILE_HEX_OFFSETS {
        let coord = HexCoord::new(new_center.q + offset.q, new_center.r + offset.r);
        if state.map.hexes.contains_key(&coord.key()) {
            return Err(ExploreError::AreaAlreadyOccupied);
        }
    }

    // Get tile definition
    let tile_hexes = get_tile_hexes(tile_id).ok_or(ExploreError::UnknownTile)?;

    // Place hexes on the map
    place_tile_on_map(&mut state.map, tile_id, new_center, tile_hexes);

    // Track tile placement
    state.map.tiles.push(TilePlacement {
        tile_id,
        center_coord: new_center,
        revealed: true,
    });

    // Deduct move points
    state.players[player_idx].move_points -= EXPLORE_BASE_COST;

    // Draw enemies from piles for rampaging hexes and site defenders
    draw_enemies_on_tile(state, new_center, tile_hexes);

    // TODO: draw ruins tokens for ancient ruins
    // TODO: monastery AA reveals
    // TODO: fame award for exploring (scenarioConfig.famePerTileExplored)
    // TODO: scenario end trigger for city tiles

    Ok(())
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::create_solo_game;
    use mk_types::ids::*;

    /// Helper: create a solo game with specified move points.
    fn setup_game_with_move_points(move_pts: u32) -> GameState {
        let mut state = create_solo_game(42, Hero::Arythea);
        state.round_phase = RoundPhase::PlayerTurns;
        state.players[0].move_points = move_pts;
        state
    }

    // ---- Terrain cost tests ----

    #[test]
    fn terrain_cost_plains_day() {
        assert_eq!(get_terrain_cost(Terrain::Plains, TimeOfDay::Day), Some(2));
    }

    #[test]
    fn terrain_cost_forest_night() {
        assert_eq!(get_terrain_cost(Terrain::Forest, TimeOfDay::Night), Some(5));
    }

    #[test]
    fn terrain_cost_desert_day_vs_night() {
        // Desert is unusual: more expensive during day (5) than night (3)
        assert_eq!(get_terrain_cost(Terrain::Desert, TimeOfDay::Day), Some(5));
        assert_eq!(get_terrain_cost(Terrain::Desert, TimeOfDay::Night), Some(3));
    }

    #[test]
    fn terrain_cost_impassable() {
        assert_eq!(get_terrain_cost(Terrain::Lake, TimeOfDay::Day), None);
        assert_eq!(get_terrain_cost(Terrain::Mountain, TimeOfDay::Day), None);
        assert_eq!(get_terrain_cost(Terrain::Ocean, TimeOfDay::Night), None);
    }

    #[test]
    fn terrain_cost_all_passable_terrains() {
        // Verify all passable terrains have day and night costs
        for terrain in [
            Terrain::Plains,
            Terrain::Hills,
            Terrain::Forest,
            Terrain::Wasteland,
            Terrain::Desert,
            Terrain::Swamp,
        ] {
            assert!(
                get_terrain_cost(terrain, TimeOfDay::Day).is_some(),
                "{:?} should be passable during day",
                terrain
            );
            assert!(
                get_terrain_cost(terrain, TimeOfDay::Night).is_some(),
                "{:?} should be passable at night",
                terrain
            );
        }
    }

    // ---- evaluate_move_entry tests ----

    #[test]
    fn evaluate_entry_passable_plains() {
        let state = setup_game_with_move_points(10);
        // Plains hex at (1,0) on starting tile A
        let result = evaluate_move_entry(&state, 0, HexCoord::new(1, 0));
        assert!(result.is_passable());
        assert_eq!(result.cost, Some(2));
    }

    #[test]
    fn evaluate_entry_impassable_lake() {
        let state = setup_game_with_move_points(10);
        // Lake at (-1,0) on starting tile A
        let result = evaluate_move_entry(&state, 0, HexCoord::new(-1, 0));
        assert!(!result.is_passable());
        assert_eq!(result.block_reason, Some(MoveBlockReason::Impassable));
    }

    #[test]
    fn evaluate_entry_hex_missing() {
        let state = setup_game_with_move_points(10);
        let result = evaluate_move_entry(&state, 0, HexCoord::new(99, 99));
        assert!(!result.is_passable());
        assert_eq!(result.block_reason, Some(MoveBlockReason::HexMissing));
    }

    #[test]
    fn evaluate_entry_rampaging_blocks_when_enemies_drawn() {
        let mut state = setup_game_with_move_points(10);
        // Add rampaging type AND drawn enemy token
        let hex = state.map.hexes.get_mut("1,0").unwrap();
        hex.rampaging_enemies.push(RampagingEnemyType::OrcMarauder);
        hex.enemies.push(HexEnemy {
            token_id: EnemyTokenId::from("prowlers_1"),
            color: EnemyColor::Green,
            is_revealed: true,
        });

        let result = evaluate_move_entry(&state, 0, HexCoord::new(1, 0));
        assert!(!result.is_passable());
        assert_eq!(result.block_reason, Some(MoveBlockReason::Rampaging));
    }

    #[test]
    fn evaluate_entry_rampaging_type_only_no_block() {
        let mut state = setup_game_with_move_points(10);
        // Rampaging type slots but no drawn enemies = no block
        let hex = state.map.hexes.get_mut("1,0").unwrap();
        hex.rampaging_enemies.push(RampagingEnemyType::OrcMarauder);
        // enemies array is empty

        let result = evaluate_move_entry(&state, 0, HexCoord::new(1, 0));
        assert!(result.is_passable());
    }

    // ---- execute_move tests ----

    #[test]
    fn move_to_adjacent_plains() {
        let mut state = setup_game_with_move_points(5);
        let result = execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();

        assert_eq!(result.cost, 2);
        assert!(result.provocation.is_none());
        assert_eq!(state.players[0].position, Some(HexCoord::new(1, 0)));
        assert_eq!(state.players[0].move_points, 3); // 5 - 2
        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::HAS_MOVED_THIS_TURN));
    }

    #[test]
    fn move_to_forest_costs_3_day() {
        let mut state = setup_game_with_move_points(5);
        // NE hex (1,-1) of starting tile A is forest
        let result = execute_move(&mut state, 0, HexCoord::new(1, -1)).unwrap();
        assert_eq!(result.cost, 3);
        assert_eq!(state.players[0].move_points, 2);
    }

    #[test]
    fn move_insufficient_points() {
        let mut state = setup_game_with_move_points(1);
        // Forest costs 3, player has 1
        let result = execute_move(&mut state, 0, HexCoord::new(1, -1));
        assert_eq!(result.unwrap_err(), MoveError::InsufficientMovePoints);
    }

    #[test]
    fn move_not_adjacent() {
        let mut state = setup_game_with_move_points(10);
        let result = execute_move(&mut state, 0, HexCoord::new(5, 5));
        assert_eq!(result.unwrap_err(), MoveError::NotAdjacent);
    }

    #[test]
    fn move_to_impassable_lake() {
        let mut state = setup_game_with_move_points(10);
        // W hex (-1,0) is lake on starting tile A
        let result = execute_move(&mut state, 0, HexCoord::new(-1, 0));
        assert_eq!(
            result.unwrap_err(),
            MoveError::Blocked(MoveBlockReason::Impassable)
        );
    }

    #[test]
    fn move_clears_recruited_units() {
        let mut state = setup_game_with_move_points(5);
        state.players[0]
            .units_recruited_this_interaction
            .push(UnitId::from("test_unit"));

        execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
        assert!(state.players[0].units_recruited_this_interaction.is_empty());
    }

    #[test]
    fn sequential_moves_deduct_correctly() {
        let mut state = setup_game_with_move_points(10);
        // Move from portal (0,0) to plains E (1,0): cost 2
        execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
        assert_eq!(state.players[0].move_points, 8);

        // Move from (1,0) to NE forest (1,-1): cost 3
        execute_move(&mut state, 0, HexCoord::new(1, -1)).unwrap();
        assert_eq!(state.players[0].move_points, 5);
    }

    #[test]
    fn night_movement_costs_more_for_plains() {
        let mut state = setup_game_with_move_points(10);
        state.time_of_day = TimeOfDay::Night;
        // Plains at night costs 3 instead of 2
        let result = execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
        assert_eq!(result.cost, 3);
        assert_eq!(state.players[0].move_points, 7);
    }

    // ---- Provocation tests ----

    #[test]
    fn provocation_detected_when_skirting() {
        let mut state = setup_game_with_move_points(10);
        // Place rampaging enemy with drawn token on NW hex (0,-1)
        let hex = state.map.hexes.get_mut("0,-1").unwrap();
        hex.rampaging_enemies.push(RampagingEnemyType::OrcMarauder);
        hex.enemies.push(HexEnemy {
            token_id: EnemyTokenId::from("prowlers_1"),
            color: EnemyColor::Green,
            is_revealed: true,
        });

        // Move from (0,0) to NE (1,-1).
        // Both (0,0) and (1,-1) are adjacent to (0,-1).
        // This "skirts" the rampaging hex, provoking combat.
        let result = execute_move(&mut state, 0, HexCoord::new(1, -1)).unwrap();
        assert!(result.provocation.is_some());
        let provoked = result.provocation.unwrap();
        assert_eq!(provoked.provoked_hexes.len(), 1);
        assert_eq!(provoked.provoked_hexes[0], HexCoord::new(0, -1));
    }

    #[test]
    fn no_provocation_without_rampaging() {
        let mut state = setup_game_with_move_points(10);
        let result = execute_move(&mut state, 0, HexCoord::new(1, -1)).unwrap();
        assert!(result.provocation.is_none());
    }

    #[test]
    fn no_provocation_rampaging_type_only() {
        let mut state = setup_game_with_move_points(10);
        // Rampaging type but no drawn enemies — no provocation
        let hex = state.map.hexes.get_mut("0,-1").unwrap();
        hex.rampaging_enemies.push(RampagingEnemyType::OrcMarauder);

        let result = execute_move(&mut state, 0, HexCoord::new(1, -1)).unwrap();
        assert!(result.provocation.is_none());
    }

    // ---- Tile center / placement tests ----

    #[test]
    fn find_tile_center_at_origin() {
        let state = setup_game_with_move_points(0);
        let center = find_tile_center(&state.map, HexCoord::new(0, 0));
        assert_eq!(center, Some(HexCoord::new(0, 0)));
    }

    #[test]
    fn find_tile_center_from_edge_hex() {
        let state = setup_game_with_move_points(0);
        // NE hex (1,-1) belongs to starting tile centered at (0,0)
        let center = find_tile_center(&state.map, HexCoord::new(1, -1));
        assert_eq!(center, Some(HexCoord::new(0, 0)));
    }

    #[test]
    fn find_tile_center_unknown_hex() {
        let state = setup_game_with_move_points(0);
        assert_eq!(find_tile_center(&state.map, HexCoord::new(99, 99)), None);
    }

    #[test]
    fn tile_placement_offsets() {
        // Verify all 6 directions produce correct centers
        let origin = HexCoord::new(0, 0);
        assert_eq!(
            calculate_tile_placement(origin, HexDirection::E),
            HexCoord::new(3, -2)
        );
        assert_eq!(
            calculate_tile_placement(origin, HexDirection::NE),
            HexCoord::new(1, -3)
        );
        assert_eq!(
            calculate_tile_placement(origin, HexDirection::NW),
            HexCoord::new(-1, -2)
        );
        assert_eq!(
            calculate_tile_placement(origin, HexDirection::W),
            HexCoord::new(-3, 1)
        );
        assert_eq!(
            calculate_tile_placement(origin, HexDirection::SW),
            HexCoord::new(-2, 3)
        );
        assert_eq!(
            calculate_tile_placement(origin, HexDirection::SE),
            HexCoord::new(1, 2)
        );
    }

    #[test]
    fn adjacent_tiles_connect_with_3_hex_pairs() {
        // Verify that placing a tile to the East creates exactly 3 adjacent hex pairs
        let _state = setup_game_with_move_points(0);
        let new_center = calculate_tile_placement(HexCoord::new(0, 0), HexDirection::E);

        // Collect all hex coords for each tile
        let old_hexes: Vec<HexCoord> = TILE_HEX_OFFSETS
            .iter()
            .map(|off| HexCoord::new(off.q, off.r))
            .collect();
        let new_hexes: Vec<HexCoord> = TILE_HEX_OFFSETS
            .iter()
            .map(|off| HexCoord::new(new_center.q + off.q, new_center.r + off.r))
            .collect();

        // Count adjacent pairs (distance 1)
        let mut adjacent_count = 0;
        for old in &old_hexes {
            for new in &new_hexes {
                if old.distance(*new) == 1 {
                    adjacent_count += 1;
                }
            }
        }
        assert_eq!(
            adjacent_count, 3,
            "Adjacent tiles should connect with exactly 3 hex pairs"
        );
    }

    // ---- Explore tests ----

    /// Move player to tile edge hex (1,-1) — NE edge, adjacent to E explore target.
    fn move_to_east_edge(state: &mut GameState) {
        state.players[0].position = Some(HexCoord::new(1, -1));
    }

    #[test]
    fn explore_places_new_tile() {
        let mut state = setup_game_with_move_points(5);
        move_to_east_edge(&mut state);
        state.map.tile_deck.countryside.push(TileId::Countryside1);

        execute_explore(&mut state, 0, HexDirection::E).unwrap();

        // Verify new tile was placed
        assert_eq!(state.map.tiles.len(), 2);
        assert_eq!(state.map.tiles[1].tile_id, TileId::Countryside1);
        assert_eq!(state.map.tiles[1].center_coord, HexCoord::new(3, -2));

        // Verify 7 new hexes added (7 starting + 7 new = 14)
        assert_eq!(state.map.hexes.len(), 14);

        // Verify move points deducted
        assert_eq!(state.players[0].move_points, 3); // 5 - 2
    }

    #[test]
    fn explore_insufficient_move_points() {
        let mut state = setup_game_with_move_points(1);
        move_to_east_edge(&mut state);
        state.map.tile_deck.countryside.push(TileId::Countryside1);

        let result = execute_explore(&mut state, 0, HexDirection::E);
        assert_eq!(result.unwrap_err(), ExploreError::InsufficientMovePoints);
    }

    #[test]
    fn explore_no_tiles_available() {
        let mut state = setup_game_with_move_points(5);
        move_to_east_edge(&mut state);
        // Empty tile decks
        let result = execute_explore(&mut state, 0, HexDirection::E);
        assert_eq!(result.unwrap_err(), ExploreError::NoTilesAvailable);
    }

    #[test]
    fn explore_sets_rampaging_enemies() {
        let mut state = setup_game_with_move_points(5);
        move_to_east_edge(&mut state);
        state.map.tile_deck.countryside.push(TileId::Countryside1);
        // Countryside 1 has an orc marauder on its NW hex

        execute_explore(&mut state, 0, HexDirection::E).unwrap();

        // New tile center at (3,-2). NW hex offset is (0,-1), so NW = (3,-3)
        let nw_hex = state.map.hexes.get("3,-3").unwrap();
        assert_eq!(nw_hex.rampaging_enemies.len(), 1);
        assert_eq!(nw_hex.rampaging_enemies[0], RampagingEnemyType::OrcMarauder);
    }

    #[test]
    fn explore_sets_mine_site_data() {
        let mut state = setup_game_with_move_points(5);
        move_to_east_edge(&mut state);
        state.map.tile_deck.countryside.push(TileId::Countryside2);
        // Countryside 2 has a green mine on its SW hex

        execute_explore(&mut state, 0, HexDirection::E).unwrap();

        // New tile center at (3,-2). SW hex offset is (-1,1), so SW = (2,-1)
        let sw_hex = state.map.hexes.get("2,-1").unwrap();
        assert!(sw_hex.site.is_some());
        let site = sw_hex.site.as_ref().unwrap();
        assert_eq!(site.site_type, SiteType::Mine);
        assert_eq!(site.mine_color, Some(BasicManaColor::Green));
    }

    #[test]
    fn explore_removes_tile_from_deck() {
        let mut state = setup_game_with_move_points(5);
        move_to_east_edge(&mut state);
        state.map.tile_deck.countryside.push(TileId::Countryside1);
        state.map.tile_deck.countryside.push(TileId::Countryside2);

        execute_explore(&mut state, 0, HexDirection::E).unwrap();

        // First tile drawn, second remains
        assert_eq!(state.map.tile_deck.countryside.len(), 1);
        assert_eq!(state.map.tile_deck.countryside[0], TileId::Countryside2);
    }

    #[test]
    fn explore_draws_from_core_when_countryside_empty() {
        let mut state = setup_game_with_move_points(5);
        move_to_east_edge(&mut state);
        // No countryside tiles; use core deck
        state.map.tile_deck.core.push(TileId::Countryside3);

        execute_explore(&mut state, 0, HexDirection::E).unwrap();

        assert!(state.map.tile_deck.core.is_empty());
        assert_eq!(state.map.tiles.len(), 2);
    }

    #[test]
    fn explore_then_move_onto_new_tile() {
        let mut state = setup_game_with_move_points(10);
        move_to_east_edge(&mut state);
        state.map.tile_deck.countryside.push(TileId::Countryside1);

        // Explore east from edge hex (1,-1)
        execute_explore(&mut state, 0, HexDirection::E).unwrap();
        assert_eq!(state.players[0].move_points, 8);

        // Move to a hex on the new tile.
        // From (1,-1), hex (2,-2) is new tile's NW edge (adjacent, distance 1)
        // Countryside 1 NW = Swamp, cost 3 day
        execute_move(&mut state, 0, HexCoord::new(2, -2)).unwrap();
        assert_eq!(state.players[0].move_points, 5); // 8 - 3 (swamp)
        assert_eq!(state.players[0].position, Some(HexCoord::new(2, -2)));
    }

    #[test]
    fn explore_two_directions() {
        let mut state = setup_game_with_move_points(10);
        move_to_east_edge(&mut state);
        state.map.tile_deck.countryside.push(TileId::Countryside1);
        state.map.tile_deck.countryside.push(TileId::Countryside2);

        // Explore east
        execute_explore(&mut state, 0, HexDirection::E).unwrap();
        assert_eq!(state.map.tiles.len(), 2);

        // Explore northeast — player at (1,-1) is also near NE tile edge
        execute_explore(&mut state, 0, HexDirection::NE).unwrap();
        assert_eq!(state.map.tiles.len(), 3);
        assert_eq!(state.map.hexes.len(), 21); // 7 + 7 + 7
        assert_eq!(state.players[0].move_points, 6); // 10 - 2 - 2
    }

    #[test]
    fn explore_from_center_rejected() {
        let mut state = setup_game_with_move_points(5);
        // Player at center (0,0) — distance > 1 from E tile's hexes
        state.players[0].position = Some(HexCoord::new(0, 0));
        state.map.tile_deck.countryside.push(TileId::Countryside1);

        let result = execute_explore(&mut state, 0, HexDirection::E);
        assert_eq!(result.unwrap_err(), ExploreError::NotOnTileEdge);
    }

    #[test]
    fn explore_wrong_direction_from_edge_rejected() {
        let mut state = setup_game_with_move_points(5);
        // Player at NE edge (1,-1) — but trying to explore West (opposite direction)
        move_to_east_edge(&mut state);
        state.map.tile_deck.countryside.push(TileId::Countryside1);

        let result = execute_explore(&mut state, 0, HexDirection::W);
        assert_eq!(result.unwrap_err(), ExploreError::NotOnTileEdge);
    }

    // ---- Enemy drawing on explore tests ----

    #[test]
    fn explore_draws_rampaging_enemy_token() {
        let mut state = setup_game_with_move_points(5);
        move_to_east_edge(&mut state);
        // Countryside 1 has an OrcMarauder on NW hex
        state.map.tile_deck.countryside.push(TileId::Countryside1);

        execute_explore(&mut state, 0, HexDirection::E).unwrap();

        // New tile center at (3,-2). NW offset = (0,-1), so NW = (3,-3)
        let nw_hex = state.map.hexes.get("3,-3").unwrap();
        assert_eq!(nw_hex.enemies.len(), 1, "NW hex should have 1 drawn enemy");
        assert_eq!(nw_hex.enemies[0].color, EnemyColor::Green);
        assert!(nw_hex.enemies[0].is_revealed, "Rampaging enemies are face-up");
    }

    #[test]
    fn explore_non_rampaging_hex_has_no_enemies() {
        let mut state = setup_game_with_move_points(5);
        move_to_east_edge(&mut state);
        // Countryside 1: center is MagicalGlade (no rampaging, no defenders)
        state.map.tile_deck.countryside.push(TileId::Countryside1);

        execute_explore(&mut state, 0, HexDirection::E).unwrap();

        // Center hex at (3,-2) has no rampaging and MagicalGlade has no site defenders
        let center_hex = state.map.hexes.get("3,-2").unwrap();
        assert!(center_hex.enemies.is_empty());
    }

    #[test]
    fn explore_site_defender_drawn_for_mage_tower() {
        let mut state = setup_game_with_move_points(5);
        move_to_east_edge(&mut state);
        // Countryside 11 has MageTower at CENTER — draws 1 violet enemy, face-down
        state.map.tile_deck.countryside.push(TileId::Countryside11);

        execute_explore(&mut state, 0, HexDirection::E).unwrap();

        let center_hex = state.map.hexes.get("3,-2").unwrap();
        assert_eq!(center_hex.enemies.len(), 1, "MageTower should have 1 defender");
        assert_eq!(center_hex.enemies[0].color, EnemyColor::Violet);
        assert!(!center_hex.enemies[0].is_revealed, "Fortified site enemies are face-down");
    }

    // ---- Provocation combat trigger tests ----

    #[test]
    fn provocation_triggers_combat_state() {
        let mut state = setup_game_with_move_points(10);
        // Place rampaging enemy with drawn token on NW hex (0,-1)
        let hex = state.map.hexes.get_mut("0,-1").unwrap();
        hex.rampaging_enemies.push(RampagingEnemyType::OrcMarauder);
        hex.enemies.push(HexEnemy {
            token_id: EnemyTokenId::from("prowlers_1"),
            color: EnemyColor::Green,
            is_revealed: true,
        });

        // Move from (0,0) to NE (1,-1) — skirts past NW hex with rampaging
        let result = execute_move(&mut state, 0, HexCoord::new(1, -1)).unwrap();
        assert!(result.provocation.is_some());
        // Combat should now be active
        assert!(state.combat.is_some(), "Provocation should trigger combat");
        let combat = state.combat.as_ref().unwrap();
        assert_eq!(combat.enemies.len(), 1);
        assert_eq!(combat.enemies[0].enemy_id.as_str(), "prowlers");
    }

    #[test]
    fn no_combat_without_provocation() {
        let mut state = setup_game_with_move_points(10);
        // Move to adjacent plains — no rampaging enemies nearby
        execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
        assert!(state.combat.is_none());
    }
}
