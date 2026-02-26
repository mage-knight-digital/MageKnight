//! State encoder — produces StateFeatures (83 scalars + entity pools).
//!
//! Directly accesses Rust structs instead of crawling JSON dicts.

use mk_data::enemies::{get_enemy, EnemyDefinition};
use mk_types::enums::{
    CombatPhase, Element, EnemyAbilityType, EnemyColor, ManaColor, ResistanceElement,
    SiteType, Terrain, TimeOfDay,
};
use mk_types::hex::{HexCoord, HexDirection};
use mk_types::state::{GameState, PlayerFlags, PlayerState};

use crate::mode_derivation::derive_mode;
use crate::types::{scale, terrain_difficulty, StateFeatures, COMBAT_ENEMY_SCALAR_DIM};
use crate::vocab::{CARD_VOCAB, ENEMY_VOCAB, SITE_VOCAB, SKILL_VOCAB, TERRAIN_VOCAB, UNIT_VOCAB};

/// Encode the full state observation for the given player.
pub fn encode_state(state: &GameState, player_idx: usize) -> StateFeatures {
    let player = &state.players[player_idx];
    let pos = player.position.unwrap_or(HexCoord::new(0, 0));

    // Build scalar groups
    let player_core = extract_player_core(state, player, player_idx); // 10
    let resources = extract_resources(player); // 13
    let tempo = extract_tempo(state, player); // 11
    let (combat_scalars, combat_enemy_ids, combat_enemy_scalars) =
        extract_combat(state, player); // 10
    let (hex_scalars, current_terrain_id, current_site_type_id) =
        extract_current_hex(state, pos); // 3
    let neighbor_scalars = extract_neighbors(state, pos); // 24
    let global_spatial = extract_global_spatial(state, pos); // 5
    let mana_source = extract_mana_source(state); // 7

    let mut scalars = Vec::with_capacity(83);
    scalars.extend_from_slice(&player_core);
    scalars.extend_from_slice(&resources);
    scalars.extend_from_slice(&tempo);
    scalars.extend_from_slice(&combat_scalars);
    scalars.extend_from_slice(&hex_scalars);
    scalars.extend_from_slice(&neighbor_scalars);
    scalars.extend_from_slice(&global_spatial);
    scalars.extend_from_slice(&mana_source);

    let mode_id = derive_mode(state, player_idx);
    let hand_card_ids = extract_hand_card_ids(player);
    let (unit_ids, unit_scalars) = extract_units(player);
    let skill_ids = extract_skill_ids(player);
    let (visible_site_ids, visible_site_scalars) = extract_visible_sites(state, pos);
    let (map_enemy_ids, map_enemy_scalars) = extract_map_enemies(state, pos);

    StateFeatures {
        scalars,
        mode_id,
        hand_card_ids,
        unit_ids,
        unit_scalars,
        current_terrain_id,
        current_site_type_id,
        combat_enemy_ids,
        combat_enemy_scalars,
        skill_ids,
        visible_site_ids,
        visible_site_scalars,
        map_enemy_ids,
        map_enemy_scalars,
    }
}

// =============================================================================
// Player Core (10 scalars)
// =============================================================================

fn extract_player_core(state: &GameState, player: &PlayerState, player_idx: usize) -> [f32; 10] {
    let is_current = if state.current_player_index as usize == player_idx {
        1.0
    } else {
        0.0
    };
    let wounds_in_hand = player
        .hand
        .iter()
        .filter(|c| c.as_str() == "wound")
        .count() as f32;
    let ready_units = player
        .units
        .iter()
        .filter(|u| u.state == mk_types::enums::UnitState::Ready)
        .count() as f32;

    [
        scale(player.fame as f32, 30.0),
        scale(player.level as f32, 10.0),
        scale(player.reputation as f32, 10.0),
        scale(player.hand.len() as f32, 20.0),
        scale(player.deck.len() as f32, 30.0),
        scale(player.discard.len() as f32, 30.0),
        scale(wounds_in_hand, 10.0),
        scale(ready_units, 6.0),
        is_current,
        scale(player.armor as f32, 10.0),
    ]
}

// =============================================================================
// Resources (13 scalars)
// =============================================================================

fn extract_resources(player: &PlayerState) -> [f32; 13] {
    // Count mana tokens by color
    let mut token_counts = [0u32; 6]; // red, blue, green, white, gold, black
    for token in &player.pure_mana {
        let idx = mana_color_index(token.color);
        token_counts[idx] += 1;
    }

    [
        scale(player.move_points as f32, 10.0),
        scale(player.influence_points as f32, 10.0),
        scale(player.healing_points as f32, 10.0),
        // Mana per-color (6)
        scale(token_counts[0] as f32, 5.0), // red
        scale(token_counts[1] as f32, 5.0), // blue
        scale(token_counts[2] as f32, 5.0), // green
        scale(token_counts[3] as f32, 5.0), // white
        scale(token_counts[4] as f32, 5.0), // gold
        scale(token_counts[5] as f32, 5.0), // black
        // Crystals per-color (4)
        scale(player.crystals.red as f32, 3.0),
        scale(player.crystals.blue as f32, 3.0),
        scale(player.crystals.green as f32, 3.0),
        scale(player.crystals.white as f32, 3.0),
    ]
}

// =============================================================================
// Tempo (5 scalars)
// =============================================================================

fn extract_tempo(state: &GameState, player: &PlayerState) -> [f32; 11] {
    let flag = |f: PlayerFlags| -> f32 {
        if player.flags.contains(f) { 1.0 } else { 0.0 }
    };

    let is_day = if state.time_of_day == TimeOfDay::Day {
        1.0
    } else {
        0.0
    };
    let end_of_round = if state.end_of_round_announced_by.is_some() {
        1.0
    } else {
        0.0
    };

    [
        scale(state.round as f32, 6.0),
        is_day,
        flag(PlayerFlags::HAS_MOVED_THIS_TURN),
        flag(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN),
        end_of_round,
        // 5 additional critical flags
        flag(PlayerFlags::IS_RESTING),
        flag(PlayerFlags::HAS_RESTED_THIS_TURN),
        flag(PlayerFlags::TACTIC_FLIPPED),
        flag(PlayerFlags::WOUND_IMMUNITY_ACTIVE),
        flag(PlayerFlags::HAS_COMBATTED_THIS_TURN),
        flag(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN),
    ]
}

// =============================================================================
// Combat (10 scalars + enemy IDs + per-enemy scalars)
// =============================================================================

fn extract_combat(
    state: &GameState,
    player: &PlayerState,
) -> ([f32; 10], Vec<u16>, Vec<Vec<f32>>) {
    let combat = match &state.combat {
        Some(c) => c,
        None => return ([0.0; 10], vec![], vec![]),
    };

    let phase_one_hot = match combat.phase {
        CombatPhase::RangedSiege => [1.0, 0.0, 0.0, 0.0],
        CombatPhase::Block => [0.0, 1.0, 0.0, 0.0],
        CombatPhase::AssignDamage => [0.0, 0.0, 1.0, 0.0],
        CombatPhase::Attack => [0.0, 0.0, 0.0, 1.0],
    };

    let mut total_armor = 0.0f32;
    let mut total_attack = 0.0f32;
    let mut enemy_ids = Vec::with_capacity(combat.enemies.len());
    let mut enemy_scalars = Vec::with_capacity(combat.enemies.len());

    let acc = &player.combat_accumulator;

    for enemy in &combat.enemies {
        let def = get_enemy(enemy.enemy_id.as_str());

        // Primary attack: use first multi-attack entry if present, else single attack fields
        let (armor, attack_damage, attack_elem) = if let Some(d) = def {
            let (atk_dmg, atk_elem) = if let Some(attacks) = d.attacks {
                (attacks[0].damage, attacks[0].element)
            } else {
                (d.attack, d.attack_element)
            };
            (d.armor as f32, atk_dmg as f32, atk_elem)
        } else {
            (0.0, 0.0, Element::Physical)
        };

        total_armor += armor;
        total_attack += attack_damage;

        enemy_ids.push(ENEMY_VOCAB.encode(enemy.enemy_id.as_str()));

        // Attack element one-hot (4)
        let elem_oh = match attack_elem {
            Element::Physical => [1.0, 0.0, 0.0, 0.0],
            Element::Fire => [0.0, 1.0, 0.0, 0.0],
            Element::Ice => [0.0, 0.0, 1.0, 0.0],
            Element::ColdFire => [0.0, 0.0, 0.0, 1.0],
        };

        // Resistances (slice of ResistanceElement)
        let (res_phys, res_fire, res_ice) = if let Some(d) = def {
            (
                if d.resistances.contains(&ResistanceElement::Physical) { 1.0 } else { 0.0 },
                if d.resistances.contains(&ResistanceElement::Fire) { 1.0 } else { 0.0 },
                if d.resistances.contains(&ResistanceElement::Ice) { 1.0 } else { 0.0 },
            )
        } else {
            (0.0, 0.0, 0.0)
        };

        // Abilities (slice of EnemyAbilityType)
        let (is_swift, is_brutal) = if let Some(d) = def {
            (
                if d.abilities.contains(&EnemyAbilityType::Swift) { 1.0 } else { 0.0 },
                if d.abilities.contains(&EnemyAbilityType::Brutal) { 1.0 } else { 0.0 },
            )
        } else {
            (0.0, 0.0)
        };

        let is_blocked = if enemy.is_blocked { 1.0 } else { 0.0 };
        let is_defeated = if enemy.is_defeated { 1.0 } else { 0.0 };

        // Attack progress: compute from accumulated attack damage vs enemy armor
        let total_eff_damage = compute_effective_damage(acc);
        let can_defeat = if armor > 0.0 && total_eff_damage >= armor { 1.0 } else { 0.0 };
        let damage_progress = if armor > 0.0 {
            (total_eff_damage / armor).min(1.0)
        } else {
            0.0
        };

        // Block progress: compute from accumulated block vs enemy attack
        let (eff_block, req_block, can_block) = compute_block_progress(acc, def);
        let block_progress = if req_block > 0.0 {
            (eff_block / req_block).min(1.0)
        } else {
            0.0
        };

        let mut scalars = Vec::with_capacity(COMBAT_ENEMY_SCALAR_DIM);
        scalars.push(scale(armor, 20.0));
        scalars.push(scale(attack_damage, 10.0));
        scalars.extend_from_slice(&elem_oh);
        scalars.push(res_phys);
        scalars.push(res_fire);
        scalars.push(res_ice);
        scalars.push(is_blocked);
        scalars.push(is_defeated);
        scalars.push(is_swift);
        scalars.push(is_brutal);
        scalars.push(scale(total_eff_damage, 20.0));
        scalars.push(can_defeat);
        scalars.push(damage_progress);
        scalars.push(scale(eff_block, 20.0));
        scalars.push(can_block);
        scalars.push(scale(req_block, 20.0));
        scalars.push(block_progress);
        enemy_scalars.push(scalars);
    }

    let is_fortified = if combat.is_at_fortified_site { 1.0 } else { 0.0 };

    let combat_scalars = [
        1.0, // in_combat
        phase_one_hot[0],
        phase_one_hot[1],
        phase_one_hot[2],
        phase_one_hot[3],
        scale(combat.enemies.len() as f32, 5.0),
        scale(total_armor, 20.0),
        scale(total_attack, 20.0),
        is_fortified,
        scale(combat.wounds_this_combat as f32, 5.0),
    ];

    (combat_scalars, enemy_ids, enemy_scalars)
}

/// Compute effective damage dealt to an enemy from the combat accumulator.
/// Includes both physical and elemental assigned attack values.
fn compute_effective_damage(
    acc: &mk_types::state::CombatAccumulator,
) -> f32 {
    let phys = acc.assigned_attack.normal
        + acc.assigned_attack.ranged
        + acc.assigned_attack.siege;
    let elem = acc.assigned_attack.normal_elements.total()
        + acc.assigned_attack.ranged_elements.total()
        + acc.assigned_attack.siege_elements.total();
    (phys + elem) as f32
}

/// Compute block progress for an enemy.
fn compute_block_progress(
    acc: &mk_types::state::CombatAccumulator,
    def: Option<&EnemyDefinition>,
) -> (f32, f32, f32) {
    let eff_block = (acc.block + acc.assigned_block
        + acc.block_elements.total() + acc.assigned_block_elements.total()) as f32;
    let req_block = if let Some(d) = def {
        // Use primary attack damage as required block
        if let Some(attacks) = d.attacks {
            attacks[0].damage as f32
        } else {
            d.attack as f32
        }
    } else {
        0.0
    };
    let can_block = if eff_block >= req_block && req_block > 0.0 {
        1.0
    } else {
        0.0
    };
    (eff_block, req_block, can_block)
}

// =============================================================================
// Current Hex (3 scalars + terrain_id + site_type_id)
// =============================================================================

fn extract_current_hex(state: &GameState, pos: HexCoord) -> ([f32; 3], u16, u16) {
    let key = pos.key();
    match state.map.hexes.get(&key) {
        Some(hex) => {
            let td = terrain_difficulty(hex.terrain);
            let terrain_id = terrain_str(hex.terrain);
            let (has_site, site_conquered, site_type_id) = if let Some(ref site) = hex.site {
                (1.0, if site.is_conquered { 1.0 } else { 0.0 }, site_type_str(site.site_type))
            } else {
                (0.0, 0.0, 0)
            };
            ([td, has_site, site_conquered], terrain_id, site_type_id)
        }
        None => ([0.0, 0.0, 0.0], 0, 0),
    }
}

// =============================================================================
// Neighbors (24 scalars: 6 directions × 4)
// =============================================================================

fn extract_neighbors(state: &GameState, pos: HexCoord) -> [f32; 24] {
    let mut result = [0.0f32; 24];
    // Use E, NE, NW, W, SW, SE order to match Python _NEIGHBOR_OFFSETS
    let directions = [
        HexDirection::E,
        HexDirection::NE,
        HexDirection::NW,
        HexDirection::W,
        HexDirection::SW,
        HexDirection::SE,
    ];

    for (i, dir) in directions.iter().enumerate() {
        let neighbor = pos.neighbor(*dir);
        let key = neighbor.key();
        if let Some(hex) = state.map.hexes.get(&key) {
            let base = i * 4;
            result[base] = terrain_difficulty(hex.terrain);
            result[base + 1] = if hex.site.is_some() { 1.0 } else { 0.0 };
            result[base + 2] = if !hex.enemies.is_empty() || !hex.rampaging_enemies.is_empty() {
                1.0
            } else {
                0.0
            };
            result[base + 3] = 1.0; // hex exists
        }
        // Else: all zeros (hex doesn't exist)
    }

    result
}

// =============================================================================
// Global Spatial (5 scalars)
// =============================================================================

fn extract_global_spatial(state: &GameState, pos: HexCoord) -> [f32; 5] {
    let mut nearest_dist: Option<u32> = None;
    let mut nearest_dq = 0i32;
    let mut nearest_dr = 0i32;
    let mut unconquered = 0u32;

    for hex in state.map.hexes.values() {
        if let Some(ref site) = hex.site {
            if !site.is_conquered {
                unconquered += 1;
                let d = pos.distance(hex.coord);
                if nearest_dist.is_none() || d < nearest_dist.unwrap() {
                    nearest_dist = Some(d);
                    nearest_dq = hex.coord.q - pos.q;
                    nearest_dr = hex.coord.r - pos.r;
                }
            }
        }
    }

    let hex_count = state.map.hexes.len() as f32;

    [
        scale(nearest_dist.unwrap_or(0) as f32, 15.0),
        scale(nearest_dq as f32, 10.0),
        scale(nearest_dr as f32, 10.0),
        scale(unconquered as f32, 20.0),
        scale(hex_count, 100.0),
    ]
}

// =============================================================================
// Mana Source (6 scalars)
// =============================================================================

fn extract_mana_source(state: &GameState) -> [f32; 7] {
    let mut available_count = 0u32;
    let mut has_red = false;
    let mut has_blue = false;
    let mut has_green = false;
    let mut has_white = false;
    let mut has_gold = false;
    let mut has_black = false;

    for die in &state.source.dice {
        if !die.is_depleted && die.taken_by_player_id.is_none() {
            available_count += 1;
            match die.color {
                ManaColor::Red => has_red = true,
                ManaColor::Blue => has_blue = true,
                ManaColor::Green => has_green = true,
                ManaColor::White => has_white = true,
                ManaColor::Gold => has_gold = true,
                ManaColor::Black => has_black = true,
            }
        }
    }

    [
        scale(available_count as f32, 10.0),
        if has_red { 1.0 } else { 0.0 },
        if has_blue { 1.0 } else { 0.0 },
        if has_green { 1.0 } else { 0.0 },
        if has_white { 1.0 } else { 0.0 },
        if has_gold { 1.0 } else { 0.0 },
        if has_black { 1.0 } else { 0.0 },
    ]
}

// =============================================================================
// Entity ID extraction
// =============================================================================

fn extract_hand_card_ids(player: &PlayerState) -> Vec<u16> {
    player.hand.iter().map(|c| CARD_VOCAB.encode(c.as_str())).collect()
}

fn extract_units(player: &PlayerState) -> (Vec<u16>, Vec<Vec<f32>>) {
    let mut ids = Vec::with_capacity(player.units.len());
    let mut scalars = Vec::with_capacity(player.units.len());
    for u in &player.units {
        ids.push(UNIT_VOCAB.encode(u.unit_id.as_str()));
        let is_ready = if u.state == mk_types::enums::UnitState::Ready { 1.0 } else { 0.0 };
        let is_wounded = if u.wounded { 1.0 } else { 0.0 };
        scalars.push(vec![is_ready, is_wounded]);
    }
    (ids, scalars)
}

fn extract_skill_ids(player: &PlayerState) -> Vec<u16> {
    player.skills.iter().map(|s| SKILL_VOCAB.encode(s.as_str())).collect()
}

// =============================================================================
// Map pools
// =============================================================================

fn extract_visible_sites(
    state: &GameState,
    pos: HexCoord,
) -> (Vec<u16>, Vec<Vec<f32>>) {
    let mut site_ids = Vec::new();
    let mut site_scalars = Vec::new();

    for hex in state.map.hexes.values() {
        if let Some(ref site) = hex.site {
            let dist = pos.distance(hex.coord) as f32;
            let dq = (hex.coord.q - pos.q) as f32;
            let dr = (hex.coord.r - pos.r) as f32;
            let enemy_count = hex.enemies.len() as f32 + hex.rampaging_enemies.len() as f32;
            let is_conquered = if site.is_conquered { 1.0 } else { 0.0 };
            let is_rampaging = if !hex.rampaging_enemies.is_empty() { 1.0 } else { 0.0 };

            site_ids.push(SITE_VOCAB.encode(site_type_to_str(site.site_type)));
            site_scalars.push(vec![
                scale(dist, 15.0),
                scale(dq, 10.0),
                scale(dr, 10.0),
                scale(enemy_count, 5.0),
                is_conquered,
                is_rampaging,
            ]);
        }
    }

    (site_ids, site_scalars)
}

fn extract_map_enemies(
    state: &GameState,
    pos: HexCoord,
) -> (Vec<u16>, Vec<Vec<f32>>) {
    let mut enemy_ids = Vec::new();
    let mut enemy_scalars = Vec::new();

    for hex in state.map.hexes.values() {
        let dist = pos.distance(hex.coord) as f32;
        let dq = (hex.coord.q - pos.q) as f32;
        let dr = (hex.coord.r - pos.r) as f32;

        // Stationary enemies
        for enemy in &hex.enemies {
            let color_oh = enemy_color_one_hot(enemy.color);
            let is_revealed = if enemy.is_revealed { 1.0 } else { 0.0 };
            let eid = if enemy.is_revealed {
                ENEMY_VOCAB.encode(enemy.token_id.as_str())
            } else {
                0
            };

            enemy_ids.push(eid);
            let mut s = Vec::with_capacity(11);
            s.extend_from_slice(&color_oh);
            s.push(scale(dist, 15.0));
            s.push(scale(dq, 10.0));
            s.push(scale(dr, 10.0));
            s.push(is_revealed);
            s.push(0.0); // is_rampaging
            enemy_scalars.push(s);
        }

        // Rampaging enemies (always visible)
        for _ramp in &hex.rampaging_enemies {
            // Rampaging enemies are RampagingEnemyType, not tokens with IDs
            // Encode as UNK since we don't have a token_id
            enemy_ids.push(0);
            let mut s = Vec::with_capacity(11);
            s.extend_from_slice(&[0.0; 6]); // no color one-hot for rampaging
            s.push(scale(dist, 15.0));
            s.push(scale(dq, 10.0));
            s.push(scale(dr, 10.0));
            s.push(1.0); // is_revealed
            s.push(1.0); // is_rampaging
            enemy_scalars.push(s);
        }
    }

    (enemy_ids, enemy_scalars)
}

// =============================================================================
// Helpers
// =============================================================================

fn mana_color_index(color: ManaColor) -> usize {
    match color {
        ManaColor::Red => 0,
        ManaColor::Blue => 1,
        ManaColor::Green => 2,
        ManaColor::White => 3,
        ManaColor::Gold => 4,
        ManaColor::Black => 5,
    }
}

fn terrain_str(terrain: Terrain) -> u16 {
    let s = match terrain {
        Terrain::Plains => "plains",
        Terrain::Hills => "hills",
        Terrain::Forest => "forest",
        Terrain::Wasteland => "wasteland",
        Terrain::Desert => "desert",
        Terrain::Swamp => "swamp",
        Terrain::Lake => "lake",
        Terrain::Mountain => "mountain",
        Terrain::Ocean => "ocean",
    };
    TERRAIN_VOCAB.encode(s)
}

fn site_type_str(site_type: SiteType) -> u16 {
    SITE_VOCAB.encode(site_type_to_str(site_type))
}

fn site_type_to_str(site_type: SiteType) -> &'static str {
    match site_type {
        SiteType::Village => "village",
        SiteType::Monastery => "monastery",
        SiteType::MagicalGlade => "magical_glade",
        SiteType::Keep => "keep",
        SiteType::MageTower => "mage_tower",
        SiteType::AncientRuins => "ancient_ruins",
        SiteType::Dungeon => "dungeon",
        SiteType::Tomb => "tomb",
        SiteType::MonsterDen => "monster_den",
        SiteType::SpawningGrounds => "spawning_grounds",
        SiteType::Mine => "mine",
        SiteType::DeepMine => "deep_mine",
        SiteType::Portal => "portal",
        SiteType::City => "city",
        SiteType::Maze => "maze",
        SiteType::Labyrinth => "labyrinth",
        SiteType::RefugeeCamp => "refugee_camp",
        SiteType::VolkaresCamp => "volkares_camp",
    }
}

fn enemy_color_one_hot(color: EnemyColor) -> [f32; 6] {
    // green, gray, brown, violet, red, white
    match color {
        EnemyColor::Green => [1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        EnemyColor::Gray => [0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
        EnemyColor::Brown => [0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
        EnemyColor::Violet => [0.0, 0.0, 0.0, 1.0, 0.0, 0.0],
        EnemyColor::Red => [0.0, 0.0, 0.0, 0.0, 1.0, 0.0],
        EnemyColor::White => [0.0, 0.0, 0.0, 0.0, 0.0, 1.0],
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mk_engine::setup::{create_solo_game, place_initial_tiles};
    use mk_types::enums::Hero;

    #[test]
    fn encode_state_produces_83_scalars() {
        let mut state = create_solo_game(42, Hero::Arythea);
        place_initial_tiles(&mut state);
        let features = encode_state(&state, 0);
        assert_eq!(features.scalars.len(), 83);
    }

    #[test]
    fn encode_state_no_nan() {
        let mut state = create_solo_game(42, Hero::Arythea);
        place_initial_tiles(&mut state);
        let features = encode_state(&state, 0);
        for (i, &s) in features.scalars.iter().enumerate() {
            assert!(!s.is_nan(), "Scalar {} is NaN", i);
        }
    }

    #[test]
    fn encode_state_has_hand_cards() {
        let mut state = create_solo_game(42, Hero::Arythea);
        place_initial_tiles(&mut state);
        let features = encode_state(&state, 0);
        assert!(!features.hand_card_ids.is_empty(), "Hand should have cards");
    }

    #[test]
    fn encode_state_mode_is_valid() {
        let mut state = create_solo_game(42, Hero::Arythea);
        place_initial_tiles(&mut state);
        let features = encode_state(&state, 0);
        // Should be tactics_selection or normal_turn for a fresh game
        assert!(features.mode_id > 0, "Mode should be a known value");
    }

    #[test]
    fn terrain_str_round_trip() {
        assert!(terrain_str(Terrain::Plains) > 0);
        assert!(terrain_str(Terrain::Mountain) > 0);
    }

    #[test]
    fn site_type_str_round_trip() {
        assert!(site_type_str(SiteType::Village) > 0);
        assert!(site_type_str(SiteType::City) > 0);
    }
}
