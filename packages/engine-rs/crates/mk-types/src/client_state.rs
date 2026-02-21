//! Client-visible state — the filtered view sent to players.
//!
//! These types mirror `GameState` but hide private information:
//! - Other players' hand cards (count only)
//! - Deck/discard contents (count only)
//! - Unrevealed enemy/ruins token identities
//! - Unrevealed tile identities
//! - Internal engine state (rng, modifiers, etc.)

use serde::{Deserialize, Serialize};

use crate::enums::*;
use crate::hex::HexCoord;
use crate::ids::*;
use crate::state::{AccumulatedAttack, BannerAttachment, Crystals, ElementalValues, KeptEnemyToken};

// =============================================================================
// Top-level client state
// =============================================================================

/// Filtered game state sent to a specific player.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientGameState {
    pub phase: GamePhase,
    pub round_phase: RoundPhase,
    pub time_of_day: TimeOfDay,
    pub round: u32,
    pub current_player_id: PlayerId,
    pub turn_order: Vec<PlayerId>,
    pub end_of_round_announced_by: Option<PlayerId>,

    pub players: Vec<ClientPlayer>,
    pub map: ClientMapState,
    pub source: ClientManaSource,
    pub offers: ClientOffers,
    pub deck_counts: ClientDeckCounts,
    pub combat: Option<ClientCombatState>,

    pub wound_pile_count: Option<u32>,
    pub scenario_end_triggered: bool,
    pub game_ended: bool,
    pub total_rounds: u32,
    pub dummy_player: Option<ClientDummyPlayer>,
}

// =============================================================================
// Player
// =============================================================================

/// Filtered player state. Other players' hands show count only.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientPlayer {
    pub id: PlayerId,
    pub hero: Hero,
    pub position: Option<HexCoord>,

    // Fame & level
    pub fame: u32,
    pub level: u32,
    pub reputation: i8,
    pub armor: u32,
    pub hand_limit: u32,
    pub command_tokens: u32,

    // Cards — hand is visible for self, hidden for others
    /// Full card list for self, empty for other players.
    pub hand: Vec<CardId>,
    /// Always set — card count (use this for other players).
    pub hand_count: usize,
    pub deck_count: usize,
    pub discard_count: usize,
    pub play_area: Vec<CardId>,

    // Units
    pub units: Vec<ClientPlayerUnit>,
    pub attached_banners: Vec<BannerAttachment>,

    // Skills
    pub skills: Vec<SkillId>,

    // Resources
    pub crystals: Crystals,
    pub mana_tokens: Vec<ClientManaToken>,
    pub kept_enemy_tokens: Vec<KeptEnemyToken>,

    // Turn tracking
    pub move_points: u32,
    pub influence_points: u32,
    pub healing_points: u32,

    // Combat accumulator (filtered — no assignment internals)
    pub combat_accumulator: ClientCombatAccumulator,

    // Tactic
    pub selected_tactic: Option<TacticId>,
    pub tactic_flipped: bool,
    pub stolen_mana_die: Option<ClientStolenDie>,

    // Flags (subset visible to client)
    pub has_moved_this_turn: bool,
    pub has_taken_action_this_turn: bool,
    pub used_mana_from_source: bool,
    pub played_card_from_hand_this_turn: bool,
    pub is_resting: bool,
    pub knocked_out: bool,

    // Pending state description (for UI display)
    pub pending: Option<ClientPendingInfo>,
}

/// Minimal mana token info for client display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientManaToken {
    pub color: ManaColor,
}

/// Filtered combat accumulator — only surface-level totals.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ClientCombatAccumulator {
    pub attack: AccumulatedAttack,
    pub block: u32,
    pub block_elements: ElementalValues,
}

/// Stolen mana die info.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientStolenDie {
    pub die_id: SourceDieId,
    pub color: ManaColor,
}

/// Client-visible unit info.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientPlayerUnit {
    pub instance_id: UnitInstanceId,
    pub unit_id: UnitId,
    pub level: u8,
    pub state: UnitState,
    pub wounded: bool,
}

/// Description of pending state for UI display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientPendingInfo {
    /// Human-readable label, e.g. "Choose an option".
    pub label: String,
    /// For choice-type pendings, descriptions of each option.
    pub options: Vec<String>,
}

// =============================================================================
// Map
// =============================================================================

/// Filtered map state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientMapState {
    pub hexes: Vec<ClientHexState>,
    pub tiles: Vec<ClientTilePlacement>,
}

/// Filtered hex state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientHexState {
    pub coord: HexCoord,
    pub terrain: Terrain,
    pub tile_id: TileId,
    pub site: Option<ClientSite>,
    pub rampaging_enemies: Vec<RampagingEnemyType>,
    pub enemies: Vec<ClientHexEnemy>,
}

/// Filtered hex enemy — token_id hidden when unrevealed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientHexEnemy {
    pub color: EnemyColor,
    pub is_revealed: bool,
    /// Only present when `is_revealed` is true.
    pub token_id: Option<EnemyTokenId>,
}

/// Filtered site — no deep mine colors (communicated via pending).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientSite {
    pub site_type: SiteType,
    pub owner: Option<PlayerId>,
    pub is_conquered: bool,
    pub is_burned: bool,
    pub city_color: Option<BasicManaColor>,
    pub mine_color: Option<BasicManaColor>,
}

/// Filtered tile placement — tile_id hidden when unrevealed.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientTilePlacement {
    pub center_coord: HexCoord,
    pub revealed: bool,
    /// Only present when `revealed` is true.
    pub tile_id: Option<TileId>,
}

// =============================================================================
// Mana source
// =============================================================================

/// Filtered mana source.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientManaSource {
    pub dice: Vec<ClientSourceDie>,
}

/// Filtered source die with computed stolen flag.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientSourceDie {
    pub id: SourceDieId,
    pub color: ManaColor,
    pub is_depleted: bool,
    pub taken_by_player_id: Option<PlayerId>,
    /// True if a player stole this die via Mana Steal tactic.
    pub is_stolen_by_tactic: bool,
}

// =============================================================================
// Combat
// =============================================================================

/// Filtered combat state — enemy definitions hydrated, internals stripped.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientCombatState {
    pub phase: CombatPhase,
    pub enemies: Vec<ClientCombatEnemy>,
    pub wounds_this_combat: u32,
    pub fame_gained: u32,
    pub is_at_fortified_site: bool,
}

/// Combat enemy with hydrated definition fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientCombatEnemy {
    pub instance_id: CombatInstanceId,
    pub enemy_id: EnemyId,

    // Hydrated from EnemyDefinition
    pub name: String,
    pub color: EnemyColor,
    pub attack: u32,
    pub attack_element: Element,
    pub armor: u32,
    pub fame: u32,
    pub resistances: Vec<ResistanceElement>,
    pub abilities: Vec<EnemyAbilityType>,
    /// Multi-attack info (None for single-attack enemies).
    pub attacks: Option<Vec<ClientEnemyAttack>>,

    // Per-enemy combat state
    pub is_blocked: bool,
    pub is_defeated: bool,
}

/// Individual attack entry for multi-attack enemies.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientEnemyAttack {
    pub damage: u32,
    pub element: Element,
    pub ability: Option<EnemyAbilityType>,
}

// =============================================================================
// Offers & decks
// =============================================================================

/// Offers visible to all players.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientOffers {
    pub units: Vec<UnitId>,
    pub advanced_actions: Vec<CardId>,
    pub spells: Vec<CardId>,
}

/// Deck counts (contents never revealed).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientDeckCounts {
    pub spells: usize,
    pub advanced_actions: usize,
    pub artifacts: usize,
    pub units: usize,
}

// =============================================================================
// Dummy player
// =============================================================================

/// Minimal dummy player info for solo mode display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientDummyPlayer {
    pub hero: Hero,
    pub deck_count: usize,
    pub discard_count: usize,
    pub tactic_id: Option<TacticId>,
}
