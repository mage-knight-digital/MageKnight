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
    /// Mine color (for Mine sites).
    pub mine_color: Option<BasicManaColor>,
    /// Deep mine colors (for DeepMine sites — multiple crystal colors available).
    pub deep_mine_colors: &'static [BasicManaColor],
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
/// Shorthand: no deep mine colors.
const NO_DM: &[BasicManaColor] = &[];

// =============================================================================
// Starting Tiles
// =============================================================================

/// Starting Tile A hex layout.
pub static STARTING_TILE_A: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Plains, site_type: Some(SiteType::Portal), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Starting Tile B hex layout.
pub static STARTING_TILE_B: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Plains, site_type: Some(SiteType::Portal), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

// =============================================================================
// Countryside Tiles — Base Game (1-11)
// =============================================================================

/// Countryside 1: Magical Glade, Village, Orc Marauder
pub static COUNTRYSIDE_1: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Forest, site_type: Some(SiteType::MagicalGlade), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Plains, site_type: Some(SiteType::Village), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Forest, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 2: Magical Glade, Village, Mine (green), Orc Marauder
pub static COUNTRYSIDE_2: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Hills, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Forest, site_type: Some(SiteType::MagicalGlade), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Plains, site_type: Some(SiteType::Village), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Hills, site_type: Some(SiteType::Mine), rampaging: NONE, mine_color: Some(BasicManaColor::Green), deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Hills, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 3: Keep, Village, Mine (white)
pub static COUNTRYSIDE_3: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Hills, site_type: Some(SiteType::Keep), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Hills, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Hills, site_type: Some(SiteType::Mine), rampaging: NONE, mine_color: Some(BasicManaColor::White), deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Plains, site_type: Some(SiteType::Village), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 4: Mage Tower, Village, Orc Marauder
pub static COUNTRYSIDE_4: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Desert, site_type: Some(SiteType::MageTower), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Desert, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Plains, site_type: Some(SiteType::Village), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Hills, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Desert, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 5: Monastery, Mine (blue), Magical Glade, Orc Marauder
pub static COUNTRYSIDE_5: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Plains, site_type: Some(SiteType::Monastery), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Plains, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Hills, site_type: Some(SiteType::Mine), rampaging: NONE, mine_color: Some(BasicManaColor::Blue), deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Forest, site_type: Some(SiteType::MagicalGlade), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 6: Mine (red), Monster Den, Orc Marauder
pub static COUNTRYSIDE_6: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Hills, site_type: Some(SiteType::Mine), rampaging: NONE, mine_color: Some(BasicManaColor::Red), deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Forest, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Hills, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Hills, site_type: Some(SiteType::MonsterDen), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 7: Monastery, Tomb, Magical Glade, Orc Marauder
pub static COUNTRYSIDE_7: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Swamp, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Forest, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Forest, site_type: Some(SiteType::MagicalGlade), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Plains, site_type: Some(SiteType::Tomb), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Plains, site_type: Some(SiteType::Monastery), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 8: Ancient Ruins, Village, Magical Glade, Orc Marauder
pub static COUNTRYSIDE_8: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Swamp, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Forest, site_type: Some(SiteType::AncientRuins), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Swamp, site_type: Some(SiteType::Village), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Swamp, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Forest, site_type: Some(SiteType::MagicalGlade), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 9: Keep, Mage Tower, Tomb
pub static COUNTRYSIDE_9: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Wasteland, site_type: Some(SiteType::Keep), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Wasteland, site_type: Some(SiteType::MageTower), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Wasteland, site_type: Some(SiteType::Tomb), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 10: Keep, Ancient Ruins, Monster Den
pub static COUNTRYSIDE_10: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Hills, site_type: Some(SiteType::AncientRuins), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Hills, site_type: Some(SiteType::Keep), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Hills, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Hills, site_type: Some(SiteType::MonsterDen), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 11: Mage Tower, Ancient Ruins, Orc Marauder
pub static COUNTRYSIDE_11: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Plains, site_type: Some(SiteType::MageTower), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Hills, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Plains, site_type: Some(SiteType::AncientRuins), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Hills, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

// =============================================================================
// Countryside Tiles — Lost Legion Expansion (12-14)
// =============================================================================

/// Countryside 12: Monastery, Maze, Refugee Camp, Orc Marauder
pub static COUNTRYSIDE_12: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Plains, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Wasteland, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Hills, site_type: Some(SiteType::Monastery), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Plains, site_type: Some(SiteType::Maze), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Hills, site_type: Some(SiteType::RefugeeCamp), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 13: Mage Tower, Deep Mine (green/blue), Magical Glade, Orc Marauder
pub static COUNTRYSIDE_13: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Forest, site_type: Some(SiteType::MageTower), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Hills, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Forest, site_type: Some(SiteType::DeepMine), rampaging: NONE, mine_color: None, deep_mine_colors: &[BasicManaColor::Green, BasicManaColor::Blue] },
    TileHex { local: SW, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Wasteland, site_type: Some(SiteType::MagicalGlade), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Countryside 14: Keep, Maze, Village, Deep Mine (red/white)
pub static COUNTRYSIDE_14: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Plains, site_type: Some(SiteType::Keep), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Wasteland, site_type: Some(SiteType::Maze), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Hills, site_type: Some(SiteType::Village), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Desert, site_type: Some(SiteType::DeepMine), rampaging: NONE, mine_color: None, deep_mine_colors: &[BasicManaColor::Red, BasicManaColor::White] },
    TileHex { local: NW, terrain: Terrain::Desert, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

// =============================================================================
// Core Tiles — Non-City (1-4)
// =============================================================================

/// Core 1: Monastery, Tomb, Spawning Grounds
pub static CORE_1: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Desert, site_type: Some(SiteType::Monastery), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Desert, site_type: Some(SiteType::Tomb), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Desert, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Desert, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Hills, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Hills, site_type: Some(SiteType::SpawningGrounds), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Core 2: Mage Tower, Ancient Ruins, Mine (green), Draconum
pub static CORE_2: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Wasteland, site_type: Some(SiteType::AncientRuins), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Hills, site_type: Some(SiteType::Mine), rampaging: NONE, mine_color: Some(BasicManaColor::Green), deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Swamp, site_type: None, rampaging: &[RampagingEnemyType::Draconum], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Swamp, site_type: Some(SiteType::MageTower), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Core 3: Mage Tower, Ancient Ruins, Tomb, Mine (white)
pub static CORE_3: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Wasteland, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Wasteland, site_type: Some(SiteType::AncientRuins), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Hills, site_type: Some(SiteType::MageTower), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Wasteland, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Hills, site_type: Some(SiteType::Mine), rampaging: NONE, mine_color: Some(BasicManaColor::White), deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Wasteland, site_type: Some(SiteType::Tomb), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Core 4: Keep, Ancient Ruins, Mine (blue), Draconum
pub static CORE_4: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Mountain, site_type: None, rampaging: &[RampagingEnemyType::Draconum], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Hills, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Hills, site_type: Some(SiteType::Keep), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Wasteland, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Wasteland, site_type: Some(SiteType::AncientRuins), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Wasteland, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Wasteland, site_type: Some(SiteType::Mine), rampaging: NONE, mine_color: Some(BasicManaColor::Blue), deep_mine_colors: NO_DM },
];

// =============================================================================
// Core Tiles — City (5-8)
// =============================================================================

/// Core 5: Green City
pub static CORE_5_GREEN_CITY: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Plains, site_type: Some(SiteType::City), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Swamp, site_type: Some(SiteType::Village), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Swamp, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Swamp, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Forest, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Forest, site_type: Some(SiteType::MagicalGlade), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Core 6: Blue City
pub static CORE_6_BLUE_CITY: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Plains, site_type: Some(SiteType::City), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Plains, site_type: Some(SiteType::Monastery), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Hills, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Mountain, site_type: None, rampaging: &[RampagingEnemyType::Draconum], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Core 7: White City
pub static CORE_7_WHITE_CITY: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Plains, site_type: Some(SiteType::City), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Plains, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Forest, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Lake, site_type: None, rampaging: &[RampagingEnemyType::Draconum], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Wasteland, site_type: Some(SiteType::Keep), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Wasteland, site_type: Some(SiteType::SpawningGrounds), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Core 8: Red City
pub static CORE_8_RED_CITY: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Wasteland, site_type: Some(SiteType::City), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Hills, site_type: Some(SiteType::Mine), rampaging: NONE, mine_color: Some(BasicManaColor::Red), deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Desert, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Desert, site_type: None, rampaging: &[RampagingEnemyType::Draconum], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Wasteland, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Wasteland, site_type: None, rampaging: &[RampagingEnemyType::Draconum], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Desert, site_type: Some(SiteType::AncientRuins), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

// =============================================================================
// Core Tiles — Lost Legion Expansion (9-10, Volkare)
// =============================================================================

/// Core 9: Mage Tower, Labyrinth, Refugee Camp, Draconum
pub static CORE_9: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Plains, site_type: None, rampaging: &[RampagingEnemyType::Draconum], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Hills, site_type: Some(SiteType::MageTower), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Desert, site_type: Some(SiteType::RefugeeCamp), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Desert, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Wasteland, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Hills, site_type: Some(SiteType::Labyrinth), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
];

/// Core 10: Deep Mine (all 4 colors), Labyrinth, Keep, Orc Marauders
pub static CORE_10: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Wasteland, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Forest, site_type: Some(SiteType::Labyrinth), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Hills, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Hills, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Forest, site_type: Some(SiteType::Keep), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Wasteland, site_type: Some(SiteType::DeepMine), rampaging: NONE, mine_color: None, deep_mine_colors: &[BasicManaColor::Red, BasicManaColor::Blue, BasicManaColor::Green, BasicManaColor::White] },
];

/// Volkare's Camp tile
pub static CORE_VOLKARE: &[TileHex] = &[
    TileHex { local: CENTER, terrain: Terrain::Plains, site_type: Some(SiteType::VolkaresCamp), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NE, terrain: Terrain::Mountain, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: E, terrain: Terrain::Wasteland, site_type: None, rampaging: &[RampagingEnemyType::Draconum], mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SE, terrain: Terrain::Desert, site_type: Some(SiteType::Village), rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: SW, terrain: Terrain::Hills, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: W, terrain: Terrain::Lake, site_type: None, rampaging: NONE, mine_color: None, deep_mine_colors: NO_DM },
    TileHex { local: NW, terrain: Terrain::Forest, site_type: None, rampaging: &[RampagingEnemyType::OrcMarauder], mine_color: None, deep_mine_colors: NO_DM },
];

// =============================================================================
// Lookup functions
// =============================================================================

/// Get the hex layout for any tile by ID.
pub fn get_tile_hexes(tile_id: TileId) -> Option<&'static [TileHex]> {
    match tile_id {
        // Starting
        TileId::StartingA => Some(STARTING_TILE_A),
        TileId::StartingB => Some(STARTING_TILE_B),
        // Countryside — Base
        TileId::Countryside1 => Some(COUNTRYSIDE_1),
        TileId::Countryside2 => Some(COUNTRYSIDE_2),
        TileId::Countryside3 => Some(COUNTRYSIDE_3),
        TileId::Countryside4 => Some(COUNTRYSIDE_4),
        TileId::Countryside5 => Some(COUNTRYSIDE_5),
        TileId::Countryside6 => Some(COUNTRYSIDE_6),
        TileId::Countryside7 => Some(COUNTRYSIDE_7),
        TileId::Countryside8 => Some(COUNTRYSIDE_8),
        TileId::Countryside9 => Some(COUNTRYSIDE_9),
        TileId::Countryside10 => Some(COUNTRYSIDE_10),
        TileId::Countryside11 => Some(COUNTRYSIDE_11),
        // Countryside — Lost Legion
        TileId::Countryside12 => Some(COUNTRYSIDE_12),
        TileId::Countryside13 => Some(COUNTRYSIDE_13),
        TileId::Countryside14 => Some(COUNTRYSIDE_14),
        // Core — Non-city
        TileId::Core1 => Some(CORE_1),
        TileId::Core2 => Some(CORE_2),
        TileId::Core3 => Some(CORE_3),
        TileId::Core4 => Some(CORE_4),
        // Core — City
        TileId::Core5GreenCity => Some(CORE_5_GREEN_CITY),
        TileId::Core6BlueCity => Some(CORE_6_BLUE_CITY),
        TileId::Core7WhiteCity => Some(CORE_7_WHITE_CITY),
        TileId::Core8RedCity => Some(CORE_8_RED_CITY),
        // Core — Lost Legion
        TileId::Core9 => Some(CORE_9),
        TileId::Core10 => Some(CORE_10),
        TileId::CoreVolkare => Some(CORE_VOLKARE),
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

    /// All tile IDs that should have definitions.
    const ALL_TILE_IDS: &[TileId] = &[
        TileId::StartingA,
        TileId::StartingB,
        TileId::Countryside1,
        TileId::Countryside2,
        TileId::Countryside3,
        TileId::Countryside4,
        TileId::Countryside5,
        TileId::Countryside6,
        TileId::Countryside7,
        TileId::Countryside8,
        TileId::Countryside9,
        TileId::Countryside10,
        TileId::Countryside11,
        TileId::Countryside12,
        TileId::Countryside13,
        TileId::Countryside14,
        TileId::Core1,
        TileId::Core2,
        TileId::Core3,
        TileId::Core4,
        TileId::Core5GreenCity,
        TileId::Core6BlueCity,
        TileId::Core7WhiteCity,
        TileId::Core8RedCity,
        TileId::Core9,
        TileId::Core10,
        TileId::CoreVolkare,
    ];

    #[test]
    fn all_tiles_have_definitions() {
        for &tile_id in ALL_TILE_IDS {
            assert!(
                get_tile_hexes(tile_id).is_some(),
                "Tile {:?} should have a definition",
                tile_id
            );
        }
    }

    #[test]
    fn all_tiles_have_7_hexes() {
        for &tile_id in ALL_TILE_IDS {
            let hexes = get_tile_hexes(tile_id).unwrap();
            assert_eq!(hexes.len(), 7, "Tile {:?} should have 7 hexes", tile_id);
        }
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
    fn countryside_6_has_red_mine() {
        let hexes = get_tile_hexes(TileId::Countryside6).unwrap();
        let mine_hex = hexes
            .iter()
            .find(|h| h.site_type == Some(SiteType::Mine))
            .unwrap();
        assert_eq!(mine_hex.local, CENTER);
        assert_eq!(mine_hex.mine_color, Some(BasicManaColor::Red));
    }

    #[test]
    fn countryside_7_has_tomb() {
        let hexes = get_tile_hexes(TileId::Countryside7).unwrap();
        assert!(hexes
            .iter()
            .any(|h| h.site_type == Some(SiteType::Tomb)));
    }

    #[test]
    fn countryside_13_has_deep_mine_green_blue() {
        let hexes = get_tile_hexes(TileId::Countryside13).unwrap();
        let dm = hexes
            .iter()
            .find(|h| h.site_type == Some(SiteType::DeepMine))
            .unwrap();
        assert_eq!(dm.local, SE);
        assert_eq!(dm.deep_mine_colors, &[BasicManaColor::Green, BasicManaColor::Blue]);
    }

    #[test]
    fn core_2_has_draconum() {
        let hexes = get_tile_hexes(TileId::Core2).unwrap();
        let rampaging_hex = hexes.iter().find(|h| !h.rampaging.is_empty()).unwrap();
        assert_eq!(rampaging_hex.rampaging[0], RampagingEnemyType::Draconum);
    }

    #[test]
    fn core_5_is_city() {
        let hexes = get_tile_hexes(TileId::Core5GreenCity).unwrap();
        assert!(hexes
            .iter()
            .any(|h| h.site_type == Some(SiteType::City)));
    }

    #[test]
    fn core_8_red_city_has_mine_and_draconum() {
        let hexes = get_tile_hexes(TileId::Core8RedCity).unwrap();
        let mine = hexes.iter().find(|h| h.site_type == Some(SiteType::Mine)).unwrap();
        assert_eq!(mine.mine_color, Some(BasicManaColor::Red));
        let draconum_count = hexes.iter().filter(|h| h.rampaging.contains(&RampagingEnemyType::Draconum)).count();
        assert_eq!(draconum_count, 2);
    }

    #[test]
    fn core_10_has_deep_mine_all_colors() {
        let hexes = get_tile_hexes(TileId::Core10).unwrap();
        let dm = hexes
            .iter()
            .find(|h| h.site_type == Some(SiteType::DeepMine))
            .unwrap();
        assert_eq!(dm.deep_mine_colors.len(), 4);
    }

    #[test]
    fn volkare_has_camp() {
        let hexes = get_tile_hexes(TileId::CoreVolkare).unwrap();
        assert!(hexes
            .iter()
            .any(|h| h.site_type == Some(SiteType::VolkaresCamp)));
    }

    #[test]
    fn total_tile_count() {
        assert_eq!(ALL_TILE_IDS.len(), 27, "Should have 27 total tiles");
    }
}
