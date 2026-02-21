//! Movement system — MOVE and EXPLORE commands.
//!
//! Matches TS `moveCommand.ts` and `exploreCommand.ts`.
//!
//! ## Key concepts
//!
//! - `evaluate_move_entry` is the single source of truth for hex entry legality/cost.
//! - Rampaging enemies block direct entry but provoke combat when skirted past.
//! - Explore places a new tile adjacent to the player's current tile.

use std::collections::BTreeMap;

use arrayvec::ArrayVec;
use mk_data::city_garrison::get_city_garrison;
use mk_data::enemies::{attack_count, get_enemy};
use mk_data::enemy_piles::{
    draw_enemy_token, enemy_id_from_token, is_site_enemy_revealed, rampaging_enemy_color,
    site_defender_config,
};
use mk_data::sites::get_site_properties;
use mk_data::tiles::get_tile_hexes;
use mk_types::enums::*;
use mk_types::hex::{HexCoord, HexDirection, TILE_HEX_OFFSETS, TILE_PLACEMENT_OFFSETS};
use mk_types::ids::*;
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
    /// City entry is blocked by scenario config (cities_can_be_entered == false).
    CityEntryBlocked,
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
    /// Whether an assault on a fortified site was triggered.
    pub assault: bool,
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

/// Apply terrain cost modifiers (e.g., Foresters' terrain reduction) to a base cost.
///
/// Iterates active modifiers with `TerrainCost` effect, applying cost changes
/// for matching terrain. The final cost is clamped to `max(0, modifier_minimum)`.
fn apply_terrain_cost_modifiers(
    base_cost: u32,
    terrain: Terrain,
    modifiers: &[mk_types::modifier::ActiveModifier],
) -> u32 {
    use mk_types::modifier::{ModifierEffect, TerrainOrAll};

    let mut cost = base_cost as i32;
    let mut min_floor = 0i32;

    for m in modifiers {
        if let ModifierEffect::TerrainCost { terrain: t, amount, minimum, replace_cost } = &m.effect {
            let matches = match t {
                TerrainOrAll::All => true,
                TerrainOrAll::Specific(tt) => *tt == terrain,
            };
            if matches {
                if let Some(rc) = replace_cost {
                    cost = *rc as i32;
                } else {
                    cost += amount;
                }
                min_floor = min_floor.max(*minimum as i32);
            }
        }
    }

    cost.max(min_floor).max(0) as u32
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
    let base_cost = match get_terrain_cost(hex.terrain, state.time_of_day) {
        Some(c) => c,
        None => return MoveEntryResult::blocked(MoveBlockReason::Impassable),
    };

    // Apply terrain cost modifiers (e.g., Foresters terrain reduction)
    let cost = apply_terrain_cost_modifiers(base_cost, hex.terrain, &state.active_modifiers);

    // 3. Check rampaging enemies
    // Both rampaging_enemies (type slots from tile) and enemies (drawn tokens) must be non-empty.
    // TODO: check for RULE_IGNORE_RAMPAGING_PROVOKE modifier
    if !hex.rampaging_enemies.is_empty() && !hex.enemies.is_empty() {
        return MoveEntryResult::blocked(MoveBlockReason::Rampaging);
    }

    // City entry check
    if let Some(ref site) = hex.site {
        if site.site_type == SiteType::City && !state.scenario_config.cities_can_be_entered {
            return MoveEntryResult::blocked(MoveBlockReason::CityEntryBlocked);
        }
    }

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
// Assault helpers
// =============================================================================

/// Info about a detected assault on a fortified site.
struct AssaultInfo {
    /// Whether city defenders need to be drawn (cities don't get enemies at tile reveal).
    needs_city_draw: bool,
    /// City color for garrison lookup (only set for cities).
    city_color: Option<BasicManaColor>,
    /// City level for garrison lookup.
    city_level: u32,
}

/// Detect whether moving to `target` triggers a fortified site assault.
///
/// Returns `Some(AssaultInfo)` if the target hex has an unconquered fortified site.
fn detect_assault(state: &GameState, target: HexCoord) -> Option<AssaultInfo> {
    let hex = state.map.hexes.get(&target.key())?;
    let site = hex.site.as_ref()?;

    let props = get_site_properties(site.site_type);
    if !props.fortified || site.is_conquered {
        return None;
    }

    Some(AssaultInfo {
        needs_city_draw: site.site_type == SiteType::City,
        city_color: site.city_color,
        city_level: state.scenario_config.default_city_level,
    })
}

/// Draw city garrison defenders onto the target hex.
///
/// Uses the city garrison table to determine which enemy colors to draw,
/// then draws tokens from the appropriate piles. Enemies are placed face-down.
fn draw_city_defenders(
    state: &mut GameState,
    target: HexCoord,
    city_color: Option<BasicManaColor>,
    city_level: u32,
) {
    let color = match city_color {
        Some(c) => c,
        None => return, // No city color means no garrison to draw
    };

    let garrison = get_city_garrison(color, city_level);

    let mut drawn: Vec<HexEnemy> = Vec::new();
    for &enemy_color in garrison {
        if let Some(token_id) =
            draw_enemy_token(&mut state.enemy_tokens, enemy_color, &mut state.rng)
        {
            drawn.push(HexEnemy {
                token_id,
                color: enemy_color,
                is_revealed: false, // City defenders are face-down
            });
        }
    }

    if let Some(hex) = state.map.hexes.get_mut(&target.key()) {
        for enemy in drawn {
            hex.enemies.push(enemy);
        }
    }
}

/// Enter combat for a fortified site assault.
///
/// Creates combat with `is_fortified=true`, sets `assault_origin`, and marks
/// site defenders as `is_required_for_conquest=true` while provoked rampaging
/// enemies get `is_required_for_conquest=false`.
fn enter_assault_combat(
    state: &mut GameState,
    player_idx: usize,
    all_token_ids: &[EnemyTokenId],
    site_defender_count: usize,
    assault_origin: HexCoord,
    combat_hex: HexCoord,
) -> Result<(), CombatError> {
    if all_token_ids.is_empty() {
        return Err(CombatError::NoEnemies);
    }

    let mut enemies = Vec::with_capacity(all_token_ids.len());

    for (i, token_id) in all_token_ids.iter().enumerate() {
        let enemy_id_str = enemy_id_from_token(token_id);
        let def = get_enemy(&enemy_id_str)
            .ok_or_else(|| CombatError::UnknownEnemy(enemy_id_str.clone()))?;

        let num_attacks = attack_count(def);

        enemies.push(CombatEnemy {
            instance_id: CombatInstanceId::from(format!("enemy_{}", i)),
            enemy_id: EnemyId::from(enemy_id_str),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: i < site_defender_count,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false; num_attacks],
            attacks_damage_assigned: vec![false; num_attacks],
            attacks_cancelled: vec![false; num_attacks],
        });
    }

    let combat = CombatState {
        phase: CombatPhase::RangedSiege,
        enemies,
        wounds_this_combat: 0,
        wounds_added_to_hand_this_combat: false,
        attacks_this_phase: 0,
        fame_gained: 0,
        is_at_fortified_site: true,
        units_allowed: true,
        night_mana_rules: false,
        assault_origin: Some(assault_origin),
        combat_hex_coord: Some(combat_hex),
        all_damage_blocked_this_phase: false,
        discard_enemies_on_failure: false,
        combat_context: CombatContext::Standard,
        pending_damage: BTreeMap::new(),
        pending_block: BTreeMap::new(),
        pending_swift_block: BTreeMap::new(),
        cumbersome_reductions: BTreeMap::new(),
        used_defend: BTreeMap::new(),
        defend_bonuses: BTreeMap::new(),
        vampiric_armor_bonus: BTreeMap::new(),
        paid_thugs_damage_influence: BTreeMap::new(),
        damage_redirects: BTreeMap::new(),
        enemy_assignments: None,
        paid_heroes_assault_influence: false,
        declared_attack_targets: None,
        declared_block_target: None,
        declared_block_attack_index: None,
        has_paralyze_damage_to_hero: false,
    };

    // Clear healing points
    state.players[player_idx].healing_points = 0;
    state.combat = Some(Box::new(combat));

    Ok(())
}

/// Reveal face-down garrison enemies at fortified sites newly adjacent to the player.
///
/// During daytime only: checks hexes within distance 1 of `to` that were NOT
/// within distance 1 of `from`. For any fortified site with unrevealed enemies,
/// sets all enemies to revealed.
fn reveal_garrison_at_adjacent_sites(state: &mut GameState, from: HexCoord, to: HexCoord) {
    if state.time_of_day != TimeOfDay::Day {
        return;
    }

    let to_neighbors = to.neighbors();
    let from_neighbors_set: Vec<(i32, i32)> =
        from.neighbors().iter().map(|c| (c.q, c.r)).collect();

    for neighbor in &to_neighbors {
        // Skip hexes that were already adjacent before the move
        if from_neighbors_set.contains(&(neighbor.q, neighbor.r)) {
            continue;
        }

        let key = neighbor.key();
        if let Some(hex) = state.map.hexes.get(&key) {
            let has_fortified_site = hex
                .site
                .as_ref()
                .map(|s| get_site_properties(s.site_type).fortified)
                .unwrap_or(false);

            let has_unrevealed = hex.enemies.iter().any(|e| !e.is_revealed);

            if has_fortified_site && has_unrevealed {
                // Reveal all enemies at this hex
                if let Some(hex) = state.map.hexes.get_mut(&key) {
                    for enemy in &mut hex.enemies {
                        enemy.is_revealed = true;
                    }
                }
            }
        }
    }
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

    // ---- Assault detection ----
    let assault_info = detect_assault(state, target);
    let mut assault = false;

    if let Some(info) = assault_info {
        assault = true;

        // Draw city defenders if needed (cities don't have pre-drawn enemies)
        if info.needs_city_draw {
            draw_city_defenders(state, target, info.city_color, info.city_level);
        }

        // Apply -1 reputation penalty for assault
        let player = &mut state.players[player_idx];
        player.reputation = (player.reputation - 1).max(-7);

        // Collect site defender tokens (these are the enemies on the target hex)
        let site_tokens: Vec<EnemyTokenId> = state
            .map
            .hexes
            .get(&target.key())
            .map(|h| h.enemies.iter().map(|e| e.token_id.clone()).collect())
            .unwrap_or_default();

        // Collect provoked rampaging enemy tokens
        let provoked_tokens: Vec<EnemyTokenId> = provocation
            .as_ref()
            .map(|p| {
                p.provoked_hexes
                    .iter()
                    .flat_map(|hex_coord| {
                        state
                            .map
                            .hexes
                            .get(&hex_coord.key())
                            .map(|h| h.enemies.iter().map(|e| e.token_id.clone()).collect::<Vec<_>>())
                            .unwrap_or_default()
                    })
                    .collect()
            })
            .unwrap_or_default();

        // Enter assault combat with merged enemies
        let all_tokens: Vec<EnemyTokenId> = site_tokens
            .iter()
            .chain(provoked_tokens.iter())
            .cloned()
            .collect();

        if !all_tokens.is_empty() {
            enter_assault_combat(
                state,
                player_idx,
                &all_tokens,
                site_tokens.len(),
                from,
                target,
            )
            .map_err(MoveError::CombatFailed)?;
        }
    } else if let Some(provoked_hex) = provocation.as_ref().and_then(|p| p.provoked_hexes.first())
    {
        // No assault — just rampaging enemy provocation
        let hex = state.map.hexes.get(&provoked_hex.key()).unwrap();
        let enemy_tokens: Vec<EnemyTokenId> =
            hex.enemies.iter().map(|e| e.token_id.clone()).collect();
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

    // During daytime, reveal face-down enemies at newly adjacent fortified sites
    reveal_garrison_at_adjacent_sites(state, from, target);

    // TODO: ruins token reveal

    Ok(MoveResult {
        cost,
        provocation,
        assault,
    })
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

    // Fame award for exploring (scenarioConfig.famePerTileExplored)
    let fame = state.scenario_config.fame_per_tile_explored;
    if fame > 0 {
        state.players[player_idx].fame += fame;
        crate::end_turn::process_level_ups_pub(state, player_idx);
    }

    // Scenario end trigger for city tiles
    if !state.scenario_end_triggered
        && state.scenario_config.end_trigger == ScenarioEndTrigger::CityRevealed
        && mk_data::tiles::is_city_tile(tile_id)
    {
        state.scenario_end_triggered = true;
        state.final_turns_remaining = Some(state.players.len() as u32);
    }

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
        // Clear tile deck so explore tests start from a clean slate
        // (tests push specific tiles they need)
        state.map.tile_deck = TileDeck::default();
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

    // ---- Assault tests ----

    /// Place an unconquered Keep with a gray defender on the E hex (1,0).
    fn place_keep_at_e(state: &mut GameState) {
        let hex = state.map.hexes.get_mut("1,0").unwrap();
        hex.site = Some(Site {
            site_type: SiteType::Keep,
            owner: None,
            is_conquered: false,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        });
        hex.enemies.push(HexEnemy {
            token_id: EnemyTokenId::from("guardsmen_1"),
            color: EnemyColor::Gray,
            is_revealed: false,
        });
    }

    #[test]
    fn assault_keep_enters_combat() {
        let mut state = setup_game_with_move_points(10);
        place_keep_at_e(&mut state);

        let result = execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
        assert!(result.assault);
        assert!(state.combat.is_some(), "Assault should trigger combat");
        let combat = state.combat.as_ref().unwrap();
        assert!(combat.is_at_fortified_site);
        assert_eq!(combat.enemies.len(), 1);
        assert_eq!(combat.enemies[0].enemy_id.as_str(), "guardsmen");
        assert!(combat.enemies[0].is_required_for_conquest);
    }

    #[test]
    fn assault_keep_reputation_penalty() {
        let mut state = setup_game_with_move_points(10);
        place_keep_at_e(&mut state);
        let initial_rep = state.players[0].reputation;

        execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();

        assert_eq!(
            state.players[0].reputation,
            initial_rep - 1,
            "Assault should apply -1 reputation"
        );
    }

    #[test]
    fn assault_keep_assault_origin() {
        let mut state = setup_game_with_move_points(10);
        place_keep_at_e(&mut state);

        execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();

        let combat = state.combat.as_ref().unwrap();
        assert_eq!(
            combat.assault_origin,
            Some(HexCoord::new(0, 0)),
            "assault_origin should be the position before the move"
        );
    }

    #[test]
    fn assault_mage_tower_enters_combat() {
        let mut state = setup_game_with_move_points(10);
        let hex = state.map.hexes.get_mut("1,0").unwrap();
        hex.site = Some(Site {
            site_type: SiteType::MageTower,
            owner: None,
            is_conquered: false,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        });
        hex.enemies.push(HexEnemy {
            token_id: EnemyTokenId::from("sorcerers_1"),
            color: EnemyColor::Violet,
            is_revealed: false,
        });

        let result = execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
        assert!(result.assault);
        assert!(state.combat.as_ref().unwrap().is_at_fortified_site);
    }

    #[test]
    fn conquered_keep_not_assaulted() {
        let mut state = setup_game_with_move_points(10);
        let hex = state.map.hexes.get_mut("1,0").unwrap();
        hex.site = Some(Site {
            site_type: SiteType::Keep,
            owner: Some(state.players[0].id.clone()),
            is_conquered: true,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        });

        let result = execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
        assert!(!result.assault);
        assert!(state.combat.is_none());
    }

    #[test]
    fn city_entry_blocked_by_scenario() {
        let mut state = setup_game_with_move_points(10);
        // First Reconnaissance scenario doesn't allow city entry
        state.scenario_config.cities_can_be_entered = false;
        let hex = state.map.hexes.get_mut("1,0").unwrap();
        hex.site = Some(Site {
            site_type: SiteType::City,
            owner: None,
            is_conquered: false,
            is_burned: false,
            city_color: Some(BasicManaColor::Blue),
            mine_color: None,
            deep_mine_colors: None,
        });

        let result = execute_move(&mut state, 0, HexCoord::new(1, 0));
        assert_eq!(
            result.unwrap_err(),
            MoveError::Blocked(MoveBlockReason::CityEntryBlocked)
        );
    }

    #[test]
    fn assault_with_provocation_merges() {
        let mut state = setup_game_with_move_points(10);

        // Place unconquered Keep at NE (1,-1)
        let hex = state.map.hexes.get_mut("1,-1").unwrap();
        hex.site = Some(Site {
            site_type: SiteType::Keep,
            owner: None,
            is_conquered: false,
            is_burned: false,
            city_color: None,
            mine_color: None,
            deep_mine_colors: None,
        });
        hex.enemies.push(HexEnemy {
            token_id: EnemyTokenId::from("guardsmen_1"),
            color: EnemyColor::Gray,
            is_revealed: false,
        });

        // Place rampaging enemy on NW (0,-1) — adjacent to both (0,0) and (1,-1)
        let hex_nw = state.map.hexes.get_mut("0,-1").unwrap();
        hex_nw
            .rampaging_enemies
            .push(RampagingEnemyType::OrcMarauder);
        hex_nw.enemies.push(HexEnemy {
            token_id: EnemyTokenId::from("prowlers_1"),
            color: EnemyColor::Green,
            is_revealed: true,
        });

        // Move from (0,0) to NE (1,-1) — assault + provocation
        let result = execute_move(&mut state, 0, HexCoord::new(1, -1)).unwrap();
        assert!(result.assault);
        assert!(result.provocation.is_some());

        let combat = state.combat.as_ref().unwrap();
        assert!(combat.is_at_fortified_site);
        assert_eq!(combat.enemies.len(), 2, "Both site defender and provoked enemy");

        // Site defender should be required for conquest
        assert!(
            combat.enemies[0].is_required_for_conquest,
            "Site defender is required for conquest"
        );
        // Provoked rampaging enemy is NOT required
        assert!(
            !combat.enemies[1].is_required_for_conquest,
            "Provoked rampaging enemy is NOT required for conquest"
        );
    }

    #[test]
    fn daytime_reveal_adjacent_garrison() {
        let mut state = setup_game_with_move_points(10);
        state.time_of_day = TimeOfDay::Day;

        // Place Keep with face-down enemy on NE (1,-1) — not adjacent to (0,0) via E direction
        // Actually (1,-1) IS adjacent to (0,0). We need a hex that becomes newly adjacent.
        // Player starts at (0,0). Move to E (1,0). Now (1,-1) was already adjacent to (0,0),
        // so it won't be "newly adjacent."
        // We need the keep at (2,-1) — adjacent to (1,0) but NOT to (0,0).
        // But (2,-1) might not exist. Let's explore a tile first.
        // Simpler: add a keep hex manually at (2,-1).
        state.map.hexes.insert(
            "2,-1".to_string(),
            HexState {
                coord: HexCoord::new(2, -1),
                terrain: Terrain::Plains,
                tile_id: TileId::Countryside3,
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
                        token_id: EnemyTokenId::from("guardsmen_2"),
                        color: EnemyColor::Gray,
                        is_revealed: false,
                    });
                    e
                },
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );

        // Move from (0,0) to E (1,0). (2,-1) is adjacent to (1,0) but NOT to (0,0).
        execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();

        // The Keep at (2,-1) should now have its enemies revealed
        let keep_hex = state.map.hexes.get("2,-1").unwrap();
        assert!(
            keep_hex.enemies[0].is_revealed,
            "Daytime movement should reveal enemies at newly adjacent fortified sites"
        );
    }

    #[test]
    fn nighttime_no_garrison_reveal() {
        let mut state = setup_game_with_move_points(10);
        state.time_of_day = TimeOfDay::Night;

        // Same setup as daytime test
        state.map.hexes.insert(
            "2,-1".to_string(),
            HexState {
                coord: HexCoord::new(2, -1),
                terrain: Terrain::Plains,
                tile_id: TileId::Countryside3,
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
                        token_id: EnemyTokenId::from("guardsmen_2"),
                        color: EnemyColor::Gray,
                        is_revealed: false,
                    });
                    e
                },
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );

        execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();

        // At night, enemies should stay hidden
        let keep_hex = state.map.hexes.get("2,-1").unwrap();
        assert!(
            !keep_hex.enemies[0].is_revealed,
            "Nighttime movement should NOT reveal garrison enemies"
        );
    }

    #[test]
    fn city_garrison_drawn_on_assault() {
        let mut state = setup_game_with_move_points(10);
        // Enable city entry
        state.scenario_config.cities_can_be_entered = true;
        state.scenario_config.default_city_level = 1;

        // Place a blue city on E hex (1,0) with NO pre-drawn enemies
        let hex = state.map.hexes.get_mut("1,0").unwrap();
        hex.site = Some(Site {
            site_type: SiteType::City,
            owner: None,
            is_conquered: false,
            is_burned: false,
            city_color: Some(BasicManaColor::Blue),
            mine_color: None,
            deep_mine_colors: None,
        });
        // No enemies pre-drawn (city defenders are drawn on assault)

        let result = execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();
        assert!(result.assault);

        // Blue city level 1 garrison = [Gray, Violet]
        let combat = state.combat.as_ref().unwrap();
        assert_eq!(
            combat.enemies.len(),
            2,
            "Blue city level 1 should draw 2 defenders"
        );
        assert!(combat.is_at_fortified_site);
        // Both should be required for conquest
        assert!(combat.enemies[0].is_required_for_conquest);
        assert!(combat.enemies[1].is_required_for_conquest);
    }

    #[test]
    fn assault_reputation_floor_at_negative_seven() {
        let mut state = setup_game_with_move_points(10);
        place_keep_at_e(&mut state);
        state.players[0].reputation = -7;

        execute_move(&mut state, 0, HexCoord::new(1, 0)).unwrap();

        assert_eq!(
            state.players[0].reputation, -7,
            "Reputation should not go below -7"
        );
    }
}
