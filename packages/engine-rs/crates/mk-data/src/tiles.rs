//! Tile definitions — hex layouts for each tile.
//!
//! Each tile is a 7-hex "flower" cluster with local coordinates:
//!   NW(0,-1) NE(1,-1)
//! W(-1,0) C(0,0) E(1,0)
//!   SW(-1,1) SE(0,1)

use mk_types::enums::{BasicManaColor, RampagingEnemyType, SiteType, Terrain, TileId};
use mk_types::hex::HexCoord;

/// A hex within a tile definition (local coordinates + terrain + optional site).
pub struct TileHex {
    pub local: HexCoord,
    pub terrain: Terrain,
    pub site_type: Option<SiteType>,
    /// Rampaging enemy types that spawn on this hex when the tile is revealed.
    pub rampaging: &'static [RampagingEnemyType],
    /// Mine color (for Mine/DeepMine sites).
    pub mine_color: Option<BasicManaColor>,
}

/// A tile definition — 7 hexes with their terrains and sites.
pub struct TileDefinition {
    pub id: TileId,
    pub hexes: &'static [TileHex],
}

// Local hex position constants (matching TS `LOCAL_HEX`)
const CENTER: HexCoord = HexCoord::new(0, 0);
const NE: HexCoord = HexCoord::new(1, -1);
const E: HexCoord = HexCoord::new(1, 0);
const SE: HexCoord = HexCoord::new(0, 1);
const SW: HexCoord = HexCoord::new(-1, 1);
const W: HexCoord = HexCoord::new(-1, 0);
const NW: HexCoord = HexCoord::new(0, -1);

/// Shorthand: no rampaging enemies on this hex.
const NONE: &[RampagingEnemyType] = &[];

// =============================================================================
// Starting Tiles
// =============================================================================

/// Starting Tile A hex layout.
pub static STARTING_TILE_A: &[TileHex] = &[
    TileHex {
        local: CENTER,
        terrain: Terrain::Plains,
        site_type: Some(SiteType::Portal),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NW,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NE,
        terrain: Terrain::Forest,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: W,
        terrain: Terrain::Lake,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: E,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: SW,
        terrain: Terrain::Lake,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: SE,
        terrain: Terrain::Mountain,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
];

/// Starting Tile B hex layout.
pub static STARTING_TILE_B: &[TileHex] = &[
    TileHex {
        local: CENTER,
        terrain: Terrain::Plains,
        site_type: Some(SiteType::Portal),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NE,
        terrain: Terrain::Forest,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: E,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: SE,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: SW,
        terrain: Terrain::Mountain,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: W,
        terrain: Terrain::Lake,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NW,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
];

// =============================================================================
// Countryside Tiles (base game)
// =============================================================================

/// Countryside 1: Magical Glade, Village, Orc Marauder
pub static COUNTRYSIDE_1: &[TileHex] = &[
    TileHex {
        local: CENTER,
        terrain: Terrain::Forest,
        site_type: Some(SiteType::MagicalGlade),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NE,
        terrain: Terrain::Lake,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: E,
        terrain: Terrain::Plains,
        site_type: Some(SiteType::Village),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: SE,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: SW,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: W,
        terrain: Terrain::Forest,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NW,
        terrain: Terrain::Forest,
        site_type: None,
        rampaging: &[RampagingEnemyType::OrcMarauder],
        mine_color: None,
    },
];

/// Countryside 2: Magical Glade, Village, Mine (green), Orc Marauder
pub static COUNTRYSIDE_2: &[TileHex] = &[
    TileHex {
        local: CENTER,
        terrain: Terrain::Hills,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NE,
        terrain: Terrain::Forest,
        site_type: Some(SiteType::MagicalGlade),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: E,
        terrain: Terrain::Plains,
        site_type: Some(SiteType::Village),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: SE,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: SW,
        terrain: Terrain::Hills,
        site_type: Some(SiteType::Mine),
        rampaging: NONE,
        mine_color: Some(BasicManaColor::Green),
    },
    TileHex {
        local: W,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NW,
        terrain: Terrain::Hills,
        site_type: None,
        rampaging: &[RampagingEnemyType::OrcMarauder],
        mine_color: None,
    },
];

/// Countryside 3: Keep, Village, Mine (white)
pub static COUNTRYSIDE_3: &[TileHex] = &[
    TileHex {
        local: CENTER,
        terrain: Terrain::Forest,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NE,
        terrain: Terrain::Hills,
        site_type: Some(SiteType::Keep),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: E,
        terrain: Terrain::Hills,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: SE,
        terrain: Terrain::Hills,
        site_type: Some(SiteType::Mine),
        rampaging: NONE,
        mine_color: Some(BasicManaColor::White),
    },
    TileHex {
        local: SW,
        terrain: Terrain::Plains,
        site_type: Some(SiteType::Village),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: W,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NW,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
];

/// Countryside 4: Mage Tower, Village, Orc Marauder
pub static COUNTRYSIDE_4: &[TileHex] = &[
    TileHex {
        local: CENTER,
        terrain: Terrain::Desert,
        site_type: Some(SiteType::MageTower),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NE,
        terrain: Terrain::Desert,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: E,
        terrain: Terrain::Mountain,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: SE,
        terrain: Terrain::Plains,
        site_type: Some(SiteType::Village),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: SW,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: W,
        terrain: Terrain::Hills,
        site_type: None,
        rampaging: &[RampagingEnemyType::OrcMarauder],
        mine_color: None,
    },
    TileHex {
        local: NW,
        terrain: Terrain::Desert,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
];

/// Countryside 5: Monastery, Mine (blue), Magical Glade, Orc Marauder
pub static COUNTRYSIDE_5: &[TileHex] = &[
    TileHex {
        local: CENTER,
        terrain: Terrain::Lake,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NE,
        terrain: Terrain::Plains,
        site_type: Some(SiteType::Monastery),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: E,
        terrain: Terrain::Plains,
        site_type: None,
        rampaging: &[RampagingEnemyType::OrcMarauder],
        mine_color: None,
    },
    TileHex {
        local: SE,
        terrain: Terrain::Hills,
        site_type: Some(SiteType::Mine),
        rampaging: NONE,
        mine_color: Some(BasicManaColor::Blue),
    },
    TileHex {
        local: SW,
        terrain: Terrain::Forest,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: W,
        terrain: Terrain::Forest,
        site_type: Some(SiteType::MagicalGlade),
        rampaging: NONE,
        mine_color: None,
    },
    TileHex {
        local: NW,
        terrain: Terrain::Forest,
        site_type: None,
        rampaging: NONE,
        mine_color: None,
    },
];

// =============================================================================
// Lookup functions
// =============================================================================

/// Get the hex layout for any tile by ID.
pub fn get_tile_hexes(tile_id: TileId) -> Option<&'static [TileHex]> {
    match tile_id {
        TileId::StartingA => Some(STARTING_TILE_A),
        TileId::StartingB => Some(STARTING_TILE_B),
        TileId::Countryside1 => Some(COUNTRYSIDE_1),
        TileId::Countryside2 => Some(COUNTRYSIDE_2),
        TileId::Countryside3 => Some(COUNTRYSIDE_3),
        TileId::Countryside4 => Some(COUNTRYSIDE_4),
        TileId::Countryside5 => Some(COUNTRYSIDE_5),
        _ => None,
    }
}

/// Get the hex layout for a starting tile (backward compatibility).
pub fn starting_tile_hexes(tile_id: TileId) -> Option<&'static [TileHex]> {
    match tile_id {
        TileId::StartingA | TileId::StartingB => get_tile_hexes(tile_id),
        _ => None,
    }
}

/// Find the portal hex in a tile (starting position for players).
pub fn find_portal(hexes: &[TileHex]) -> Option<HexCoord> {
    hexes
        .iter()
        .find(|h| h.site_type == Some(SiteType::Portal))
        .map(|h| h.local)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starting_tile_a_has_7_hexes() {
        assert_eq!(STARTING_TILE_A.len(), 7);
    }

    #[test]
    fn starting_tile_a_has_portal_at_center() {
        let portal = find_portal(STARTING_TILE_A).unwrap();
        assert_eq!(portal, CENTER);
    }

    #[test]
    fn starting_tile_b_has_portal_at_center() {
        let portal = find_portal(STARTING_TILE_B).unwrap();
        assert_eq!(portal, CENTER);
    }

    #[test]
    fn countryside_tiles_have_7_hexes() {
        for tile_id in [
            TileId::Countryside1,
            TileId::Countryside2,
            TileId::Countryside3,
            TileId::Countryside4,
            TileId::Countryside5,
        ] {
            let hexes = get_tile_hexes(tile_id).unwrap();
            assert_eq!(hexes.len(), 7, "Tile {:?} should have 7 hexes", tile_id);
        }
    }

    #[test]
    fn countryside_1_has_rampaging_orc() {
        let hexes = get_tile_hexes(TileId::Countryside1).unwrap();
        let rampaging_hex = hexes.iter().find(|h| !h.rampaging.is_empty()).unwrap();
        assert_eq!(rampaging_hex.local, NW);
        assert_eq!(rampaging_hex.rampaging[0], RampagingEnemyType::OrcMarauder);
    }

    #[test]
    fn countryside_2_has_green_mine() {
        let hexes = get_tile_hexes(TileId::Countryside2).unwrap();
        let mine_hex = hexes
            .iter()
            .find(|h| h.site_type == Some(SiteType::Mine))
            .unwrap();
        assert_eq!(mine_hex.local, SW);
        assert_eq!(mine_hex.mine_color, Some(BasicManaColor::Green));
    }

    #[test]
    fn countryside_3_has_keep() {
        let hexes = get_tile_hexes(TileId::Countryside3).unwrap();
        let keep_hex = hexes
            .iter()
            .find(|h| h.site_type == Some(SiteType::Keep))
            .unwrap();
        assert_eq!(keep_hex.local, NE);
    }

    #[test]
    fn get_tile_hexes_unknown_returns_none() {
        assert!(get_tile_hexes(TileId::Core1).is_none());
    }

    #[test]
    fn starting_tiles_have_no_rampaging() {
        for tile_id in [TileId::StartingA, TileId::StartingB] {
            let hexes = get_tile_hexes(tile_id).unwrap();
            for hex in hexes {
                assert!(
                    hex.rampaging.is_empty(),
                    "Starting tile hex at {:?} should not have rampaging enemies",
                    hex.local
                );
            }
        }
    }
}
