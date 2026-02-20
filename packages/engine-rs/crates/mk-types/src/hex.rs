//! Hex coordinate types using axial coordinates (q, r).

use serde::{Deserialize, Serialize};

/// Axial hex coordinate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct HexCoord {
    pub q: i32,
    pub r: i32,
}

impl HexCoord {
    pub const fn new(q: i32, r: i32) -> Self {
        Self { q, r }
    }

    /// Cube coordinate `s` (derived: s = -q - r).
    pub const fn s(self) -> i32 {
        -self.q - self.r
    }

    /// Hex distance between two coordinates.
    pub fn distance(self, other: Self) -> u32 {
        let dq = (self.q - other.q).unsigned_abs();
        let dr = (self.r - other.r).unsigned_abs();
        let ds = (self.s() - other.s()).unsigned_abs();
        dq.max(dr).max(ds)
    }

    /// Get the neighbor in a given direction.
    pub fn neighbor(self, dir: HexDirection) -> Self {
        let (dq, dr) = dir.offset();
        Self {
            q: self.q + dq,
            r: self.r + dr,
        }
    }

    /// Get all 6 neighbors.
    pub fn neighbors(self) -> [Self; 6] {
        HexDirection::ALL.map(|dir| self.neighbor(dir))
    }

    /// String key for use in hash maps (matches TS `hexKey`).
    pub fn key(self) -> String {
        format!("{},{}", self.q, self.r)
    }
}

impl std::fmt::Display for HexCoord {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "({},{})", self.q, self.r)
    }
}

/// Hex direction (flat-top orientation).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HexDirection {
    NE,
    E,
    SE,
    SW,
    W,
    NW,
}

impl HexDirection {
    pub const ALL: [Self; 6] = [Self::NE, Self::E, Self::SE, Self::SW, Self::W, Self::NW];

    /// Axial offset (dq, dr) for this direction.
    pub const fn offset(self) -> (i32, i32) {
        match self {
            Self::NE => (1, -1),
            Self::E => (1, 0),
            Self::SE => (0, 1),
            Self::SW => (-1, 1),
            Self::W => (-1, 0),
            Self::NW => (0, -1),
        }
    }
}

/// Direction-specific offsets for tile placement.
/// These position tile centers so they connect with exactly 3 adjacent hex pairs.
pub const TILE_PLACEMENT_OFFSETS: [(HexDirection, HexCoord); 6] = [
    (HexDirection::E, HexCoord::new(3, -2)),
    (HexDirection::NE, HexCoord::new(1, -3)),
    (HexDirection::NW, HexCoord::new(-1, -2)),
    (HexDirection::W, HexCoord::new(-3, 1)),
    (HexDirection::SW, HexCoord::new(-2, 3)),
    (HexDirection::SE, HexCoord::new(1, 2)),
];

/// Offsets for the 7 hexes that make up a tile (flower pattern).
pub const TILE_HEX_OFFSETS: [HexCoord; 7] = [
    HexCoord::new(0, 0), // center
    HexCoord::new(1, -1),
    HexCoord::new(1, 0),
    HexCoord::new(0, 1),
    HexCoord::new(-1, 1),
    HexCoord::new(-1, 0),
    HexCoord::new(0, -1),
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_distance() {
        let a = HexCoord::new(0, 0);
        let b = HexCoord::new(2, -1);
        assert_eq!(a.distance(b), 2);
    }

    #[test]
    fn hex_neighbor() {
        let origin = HexCoord::new(0, 0);
        assert_eq!(origin.neighbor(HexDirection::E), HexCoord::new(1, 0));
        assert_eq!(origin.neighbor(HexDirection::NE), HexCoord::new(1, -1));
        assert_eq!(origin.neighbor(HexDirection::SW), HexCoord::new(-1, 1));
    }

    #[test]
    fn hex_key_format() {
        assert_eq!(HexCoord::new(3, -2).key(), "3,-2");
    }

    #[test]
    fn all_neighbors_count() {
        let origin = HexCoord::new(0, 0);
        let neighbors = origin.neighbors();
        assert_eq!(neighbors.len(), 6);
        // All should be distance 1
        for n in &neighbors {
            assert_eq!(origin.distance(*n), 1);
        }
    }
}
