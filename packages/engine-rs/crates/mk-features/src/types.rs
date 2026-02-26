//! Feature types and dimension constants for RL encoding.
//!
//! Matches the Python `StateFeatures`, `ActionFeatures`, and `EncodedStep`
//! dataclasses in `features.py` exactly.

use mk_types::enums::Terrain;
use mk_types::hex::HexCoord;

// =============================================================================
// Dimension constants
// =============================================================================

/// Number of scalar features per state observation.
pub const STATE_SCALAR_DIM: usize = 83;

/// Number of scalar features per action.
pub const ACTION_SCALAR_DIM: usize = 34;

/// Number of scalar features per combat enemy in the state pool.
pub const COMBAT_ENEMY_SCALAR_DIM: usize = 20;

/// Number of scalar features per visible site in the state pool.
pub const SITE_SCALAR_DIM: usize = 6;

/// Number of scalar features per map enemy in the state pool.
pub const MAP_ENEMY_SCALAR_DIM: usize = 11;

/// Number of scalar features per unit in the state pool.
pub const UNIT_SCALAR_DIM: usize = 2;

// =============================================================================
// Feature structs
// =============================================================================

/// State features computed once per step (shared across all candidate actions).
#[derive(Debug, Clone)]
pub struct StateFeatures {
    /// 83 floats: player core, resources, tempo, combat, hex, neighbors, spatial, mana source.
    pub scalars: Vec<f32>,
    /// MODE_VOCAB index.
    pub mode_id: u16,
    /// Variable-length CARD_VOCAB indices for cards in hand.
    pub hand_card_ids: Vec<u16>,
    /// Variable-length UNIT_VOCAB indices for player units.
    pub unit_ids: Vec<u16>,
    /// UNIT_SCALAR_DIM floats per unit [is_ready, is_wounded].
    pub unit_scalars: Vec<Vec<f32>>,
    /// TERRAIN_VOCAB index for current hex terrain.
    pub current_terrain_id: u16,
    /// SITE_VOCAB index for current hex site type.
    pub current_site_type_id: u16,
    /// ENEMY_VOCAB indices for combat enemies (empty if not in combat).
    pub combat_enemy_ids: Vec<u16>,
    /// COMBAT_ENEMY_SCALAR_DIM floats per combat enemy.
    pub combat_enemy_scalars: Vec<Vec<f32>>,
    /// SKILL_VOCAB indices for player skills.
    pub skill_ids: Vec<u16>,
    /// SITE_VOCAB indices for all visible sites on the map.
    pub visible_site_ids: Vec<u16>,
    /// SITE_SCALAR_DIM floats per visible site.
    pub visible_site_scalars: Vec<Vec<f32>>,
    /// ENEMY_VOCAB indices for all map enemies (not in active combat).
    pub map_enemy_ids: Vec<u16>,
    /// MAP_ENEMY_SCALAR_DIM floats per map enemy.
    pub map_enemy_scalars: Vec<Vec<f32>>,
}

/// Per-candidate action features.
#[derive(Debug, Clone)]
pub struct ActionFeatures {
    /// ACTION_TYPE_VOCAB index.
    pub action_type_id: u16,
    /// SOURCE_VOCAB index.
    pub source_id: u16,
    /// CARD_VOCAB index (from card_id field, or 0).
    pub card_id: u16,
    /// UNIT_VOCAB index (from unit_id field, or 0).
    pub unit_id: u16,
    /// ENEMY_VOCAB index (from enemy_id/targetId, or 0).
    pub enemy_id: u16,
    /// SKILL_VOCAB index (from skill_id field, or 0).
    pub skill_id: u16,
    /// ENEMY_VOCAB indices for multi-target attacks (SubsetConfirm).
    pub target_enemy_ids: Vec<u16>,
    /// ACTION_SCALAR_DIM floats.
    pub scalars: Vec<f32>,
}

/// Structured encoding for one decision step.
#[derive(Debug, Clone)]
pub struct EncodedStep {
    pub state: StateFeatures,
    pub actions: Vec<ActionFeatures>,
}

// =============================================================================
// Helpers
// =============================================================================

/// Scale a value by a denominator, clamping to [-5.0, 5.0].
#[inline]
pub fn scale(value: f32, denom: f32) -> f32 {
    if denom <= 0.0 {
        return 0.0;
    }
    (value / denom).clamp(-5.0, 5.0)
}

/// Terrain difficulty as a normalized float (0.0–1.0).
/// Matches the Python `_get_terrain_difficulty()` function.
#[inline]
pub fn terrain_difficulty(terrain: Terrain) -> f32 {
    match terrain {
        Terrain::Plains => 0.1,
        Terrain::Hills => 0.3,
        Terrain::Forest => 0.4,
        Terrain::Desert => 0.5,
        Terrain::Wasteland => 0.5,
        Terrain::Swamp => 0.6,
        Terrain::Lake => 1.0,
        Terrain::Mountain => 1.0,
        Terrain::Ocean => 1.0,
    }
}

/// Axial hex distance between two coordinates.
#[inline]
pub fn hex_distance(a: HexCoord, b: HexCoord) -> f32 {
    a.distance(b) as f32
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scale_normal() {
        assert!((scale(5.0, 10.0) - 0.5).abs() < 1e-6);
    }

    #[test]
    fn scale_clamps_high() {
        assert!((scale(100.0, 10.0) - 5.0).abs() < 1e-6);
    }

    #[test]
    fn scale_clamps_low() {
        assert!((scale(-100.0, 10.0) - (-5.0)).abs() < 1e-6);
    }

    #[test]
    fn scale_zero_denom() {
        assert!((scale(5.0, 0.0)).abs() < 1e-6);
    }

    #[test]
    fn terrain_difficulty_values() {
        assert!((terrain_difficulty(Terrain::Plains) - 0.1).abs() < 1e-6);
        assert!((terrain_difficulty(Terrain::Mountain) - 1.0).abs() < 1e-6);
        assert!((terrain_difficulty(Terrain::Forest) - 0.4).abs() < 1e-6);
    }

    #[test]
    fn hex_distance_same() {
        let a = HexCoord::new(0, 0);
        assert!((hex_distance(a, a)).abs() < 1e-6);
    }

    #[test]
    fn hex_distance_adjacent() {
        let a = HexCoord::new(0, 0);
        let b = HexCoord::new(1, 0);
        assert!((hex_distance(a, b) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn dimension_constants() {
        assert_eq!(STATE_SCALAR_DIM, 83);
        assert_eq!(ACTION_SCALAR_DIM, 34);
        assert_eq!(COMBAT_ENEMY_SCALAR_DIM, 20);
        assert_eq!(SITE_SCALAR_DIM, 6);
        assert_eq!(MAP_ENEMY_SCALAR_DIM, 11);
        assert_eq!(UNIT_SCALAR_DIM, 2);
    }
}
