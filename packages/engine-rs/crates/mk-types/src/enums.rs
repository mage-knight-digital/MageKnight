//! All enum types for Mage Knight.
//!
//! Each enum uses `#[serde(rename_all = "snake_case")]` to match the
//! TypeScript string constants exactly.

use serde::{Deserialize, Serialize};

// =============================================================================
// Mana Colors
// =============================================================================

/// Basic mana colors (can be crystals).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BasicManaColor {
    Red,
    Blue,
    Green,
    White,
}

/// Special mana colors (gold/black — cannot be crystals).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpecialManaColor {
    Gold,
    Black,
}

/// All mana colors.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ManaColor {
    Red,
    Blue,
    Green,
    White,
    Gold,
    Black,
}

impl ManaColor {
    pub fn is_basic(self) -> bool {
        matches!(self, Self::Red | Self::Blue | Self::Green | Self::White)
    }

    pub fn to_basic(self) -> Option<BasicManaColor> {
        match self {
            Self::Red => Some(BasicManaColor::Red),
            Self::Blue => Some(BasicManaColor::Blue),
            Self::Green => Some(BasicManaColor::Green),
            Self::White => Some(BasicManaColor::White),
            _ => None,
        }
    }
}

impl From<BasicManaColor> for ManaColor {
    fn from(c: BasicManaColor) -> Self {
        match c {
            BasicManaColor::Red => Self::Red,
            BasicManaColor::Blue => Self::Blue,
            BasicManaColor::Green => Self::Green,
            BasicManaColor::White => Self::White,
        }
    }
}

impl From<SpecialManaColor> for ManaColor {
    fn from(c: SpecialManaColor) -> Self {
        match c {
            SpecialManaColor::Gold => Self::Gold,
            SpecialManaColor::Black => Self::Black,
        }
    }
}

/// All basic mana colors as a const array.
pub const ALL_BASIC_MANA_COLORS: [BasicManaColor; 4] = [
    BasicManaColor::Red,
    BasicManaColor::Blue,
    BasicManaColor::Green,
    BasicManaColor::White,
];

/// All mana colors as a const array.
pub const ALL_MANA_COLORS: [ManaColor; 6] = [
    ManaColor::Red,
    ManaColor::Blue,
    ManaColor::Green,
    ManaColor::White,
    ManaColor::Gold,
    ManaColor::Black,
];

// =============================================================================
// Elements
// =============================================================================

/// Attack/block element types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Element {
    Physical,
    Fire,
    Ice,
    ColdFire,
}

// =============================================================================
// Terrain
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Terrain {
    Plains,
    Hills,
    Forest,
    Wasteland,
    Desert,
    Swamp,
    Lake,
    Mountain,
    Ocean,
}

impl Terrain {
    /// Base movement cost during the day. `None` means impassable.
    pub fn day_cost(self) -> Option<u8> {
        match self {
            Self::Plains => Some(2),
            Self::Hills => Some(3),
            Self::Forest => Some(3),
            Self::Wasteland => Some(4),
            Self::Desert => Some(5),
            Self::Swamp => Some(5),
            Self::Lake | Self::Mountain | Self::Ocean => None,
        }
    }

    /// Base movement cost at night. `None` means impassable.
    pub fn night_cost(self) -> Option<u8> {
        match self {
            Self::Plains => Some(3),
            Self::Hills => Some(4),
            Self::Forest => Some(5),
            Self::Wasteland => Some(5),
            Self::Desert => Some(3),
            Self::Swamp => Some(5),
            Self::Lake | Self::Mountain | Self::Ocean => None,
        }
    }
}

// =============================================================================
// Game Phase
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GamePhase {
    Setup,
    Round,
    End,
}

// =============================================================================
// Time of Day
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TimeOfDay {
    Day,
    Night,
}

// =============================================================================
// Round Phase
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoundPhase {
    TacticsSelection,
    PlayerTurns,
}

// =============================================================================
// Combat Phase
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CombatPhase {
    RangedSiege,
    Block,
    AssignDamage,
    Attack,
}

// =============================================================================
// Combat Type (attack method)
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CombatType {
    Melee,
    Ranged,
    Siege,
}

// =============================================================================
// Combat Context
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CombatContext {
    Standard,
    BurnMonastery,
    CooperativeAssault,
}

// =============================================================================
// Card Color
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CardColor {
    Red,
    Blue,
    Green,
    White,
    Wound,
}

impl CardColor {
    /// Convert to BasicManaColor if not Wound.
    pub fn to_basic_mana_color(self) -> Option<BasicManaColor> {
        match self {
            Self::Red => Some(BasicManaColor::Red),
            Self::Blue => Some(BasicManaColor::Blue),
            Self::Green => Some(BasicManaColor::Green),
            Self::White => Some(BasicManaColor::White),
            Self::Wound => None,
        }
    }
}

/// Basic card colors (excludes Wound).
pub type BasicCardColor = BasicManaColor; // Same variants, same serialization

// =============================================================================
// Deed Card Type
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeedCardType {
    BasicAction,
    AdvancedAction,
    Spell,
    Artifact,
    Wound,
}

// =============================================================================
// Hero
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Hero {
    Arythea,
    Tovak,
    Goldyx,
    Norowas,
    Wolfhawk,
    Krang,
    Braevalar,
}

// =============================================================================
// Enemy Color
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnemyColor {
    Green,
    Red,
    Brown,
    Violet,
    Gray,
    White,
}

// =============================================================================
// Enemy Ability Type
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnemyAbilityType {
    Fortified,
    Unfortified,
    Swift,
    Brutal,
    Poison,
    Paralyze,
    Summon,
    SummonGreen,
    Cumbersome,
    Vampiric,
    ColdFireAttack,
    IceAttack,
    FireAttack,
    Elusive,
    ArcaneImmunity,
    Assassination,
    Defend,
}

/// Resistance element (subset of Element — no ColdFire).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResistanceElement {
    Physical,
    Fire,
    Ice,
}

/// Enemy ability (discriminated union).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EnemyAbility {
    Fortified,
    Unfortified,
    Swift,
    Brutal,
    Poison,
    Paralyze,
    Summon { pool: EnemyColor },
    SummonGreen { pool: EnemyColor },
    Cumbersome,
    Vampiric,
    Elusive,
    ArcaneImmunity,
    Assassination,
    Defend,
    Resistance { element: ResistanceElement },
}

// =============================================================================
// Site Type
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SiteType {
    Village,
    Monastery,
    MagicalGlade,
    Keep,
    MageTower,
    AncientRuins,
    Dungeon,
    Tomb,
    MonsterDen,
    SpawningGrounds,
    Mine,
    DeepMine,
    Portal,
    City,
    Maze,
    Labyrinth,
    RefugeeCamp,
    VolkaresCamp,
}

// =============================================================================
// City Color / Mine Color
// =============================================================================

/// City colors (for city sites).
pub type CityColor = BasicManaColor;

/// Mine colors (crystal colors produced by mines).
pub type MineColor = BasicManaColor;

// =============================================================================
// Tile Identifiers
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TileId {
    // Starting tiles
    StartingA,
    StartingB,
    // Countryside (green back) — Base game
    Countryside1,
    Countryside2,
    Countryside3,
    Countryside4,
    Countryside5,
    Countryside6,
    Countryside7,
    Countryside8,
    Countryside9,
    Countryside10,
    Countryside11,
    // Countryside — Lost Legion
    Countryside12,
    Countryside13,
    Countryside14,
    // Core (brown back) — Non-city
    Core1,
    Core2,
    Core3,
    Core4,
    // Core — City tiles
    Core5GreenCity,
    Core6BlueCity,
    Core7WhiteCity,
    Core8RedCity,
    // Core — Lost Legion
    Core9,
    Core10,
    CoreVolkare,
}

// =============================================================================
// Rampaging Enemy Type
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RampagingEnemyType {
    OrcMarauder,
    Draconum,
}

// =============================================================================
// Unit State (activation)
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UnitState {
    Ready,
    Spent,
}

// =============================================================================
// Rest Type
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RestType {
    Standard,
    SlowRecovery,
}

// =============================================================================
// Sideways Play Type
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SidewaysAs {
    Move,
    Influence,
    Attack,
    Block,
}

// =============================================================================
// Attack Type / Attack Element (for incremental combat assignment)
// =============================================================================

/// Attack type for incremental assignment (same values as CombatType).
pub type AttackType = CombatType;

/// Attack element for incremental assignment.
/// Note: uses `coldFire` (camelCase) to match TS serialization.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AttackElement {
    #[serde(rename = "physical")]
    Physical,
    #[serde(rename = "fire")]
    Fire,
    #[serde(rename = "ice")]
    Ice,
    #[serde(rename = "coldFire")]
    ColdFire,
}

impl From<AttackElement> for Element {
    fn from(ae: AttackElement) -> Self {
        match ae {
            AttackElement::Physical => Element::Physical,
            AttackElement::Fire => Element::Fire,
            AttackElement::Ice => Element::Ice,
            AttackElement::ColdFire => Element::ColdFire,
        }
    }
}

// =============================================================================
// Damage Target
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DamageTarget {
    Hero,
    Unit,
}

// =============================================================================
// Move-to-Attack Conversion Type
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MoveToAttackConversionType {
    Melee,
    Ranged,
}

// =============================================================================
// Glade Wound Choice
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GladeWoundChoice {
    Hand,
    Discard,
    Skip,
}

// =============================================================================
// Cooperative Response
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CooperativeResponse {
    Accept,
    Decline,
}

// =============================================================================
// Mana Source Type (for ManaSourceInfo)
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ManaSourceType {
    Die,
    Token,
    Crystal,
}

// =============================================================================
// Recruitment Source
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecruitmentSource {
    Normal,
    Artifact,
    Spell,
}

// =============================================================================
// Discard for Bonus Filter
// =============================================================================

/// Filter for which cards can be discarded in a discard-for-bonus effect.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiscardForBonusFilter {
    WoundOnly,
    AnyMaxOneWound,
}
