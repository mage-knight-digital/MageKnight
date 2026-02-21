//! Game state structures — GameState, PlayerState, CombatState, MapState.
//!
//! These are struct shells for Phase 1. Fields use the consolidated pending
//! state design (PendingQueue) instead of 20+ separate Option fields.

use std::collections::BTreeMap;

use arrayvec::ArrayVec;
use bitflags::bitflags;
use serde::{Deserialize, Serialize};

use crate::enums::*;
use crate::hex::HexCoord;
use crate::ids::*;
use crate::modifier::ActiveModifier;
use crate::pending::*;
use crate::rng::RngState;

// =============================================================================
// Capacity constants
// =============================================================================

/// Max players in a game.
pub const MAX_PLAYERS: usize = 4;
/// Max enemies in a single combat.
pub const MAX_COMBAT_ENEMIES: usize = 12;
/// Max cards in hand.
pub const MAX_HAND: usize = 20;
/// Max cards in deck.
pub const MAX_DECK: usize = 40;
/// Max cards in discard pile.
pub const MAX_DISCARD: usize = 40;
/// Max cards in play area.
pub const MAX_PLAY_AREA: usize = 20;
/// Max skills per player.
pub const MAX_SKILLS: usize = 12;
/// Max mana tokens in play.
pub const MAX_MANA_TOKENS: usize = 16;
/// Max dice in source.
pub const MAX_SOURCE_DICE: usize = 8;
/// Max tiles placed on map.
pub const MAX_TILES: usize = 24;
/// Max enemies on a hex.
pub const MAX_HEX_ENEMIES: usize = 8;
/// Max rampaging enemies on a hex.
pub const MAX_RAMPAGING_PER_HEX: usize = 4;
/// Max attached banners.
pub const MAX_BANNERS: usize = 4;
/// Max kept enemy tokens (Puppet Master).
pub const MAX_KEPT_ENEMIES: usize = 4;
/// Max removed cards per player.
pub const MAX_REMOVED_CARDS: usize = 8;
/// Max time-bending set-aside cards.
pub const MAX_SET_ASIDE_CARDS: usize = 8;
/// Max units recruited this interaction.
pub const MAX_RECRUITED_THIS_INTERACTION: usize = 4;
/// Max available tactics.
pub const MAX_TACTICS: usize = 12;

// =============================================================================
// PlayerFlags — packed boolean fields
// =============================================================================

bitflags! {
    /// Boolean player state packed into a u32 bitfield.
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    pub struct PlayerFlags: u32 {
        const KNOCKED_OUT                       = 1 << 0;
        const USED_MANA_FROM_SOURCE             = 1 << 1;
        const HAS_MOVED_THIS_TURN               = 1 << 2;
        const HAS_TAKEN_ACTION_THIS_TURN        = 1 << 3;
        const HAS_COMBATTED_THIS_TURN           = 1 << 4;
        const PLAYED_CARD_FROM_HAND_THIS_TURN   = 1 << 5;
        const HAS_PLUNDERED_THIS_TURN           = 1 << 6;
        const HAS_RECRUITED_UNIT_THIS_TURN      = 1 << 7;
        const IS_RESTING                        = 1 << 8;
        const HAS_RESTED_THIS_TURN              = 1 << 9;
        const WOUND_IMMUNITY_ACTIVE             = 1 << 10;
        const ROUND_ORDER_TOKEN_FLIPPED         = 1 << 11;
        const IS_TIME_BENT_TURN                 = 1 << 12;
        const BANNER_OF_PROTECTION_ACTIVE       = 1 << 13;
        const CRYSTAL_MASTERY_POWERED_ACTIVE    = 1 << 14;
        const TACTIC_FLIPPED                    = 1 << 15;
        const BEFORE_TURN_TACTIC_PENDING        = 1 << 16;
    }
}

// Manual serde for PlayerFlags as a u32 value.
impl Serialize for PlayerFlags {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.bits().serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for PlayerFlags {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let bits = u32::deserialize(deserializer)?;
        Ok(PlayerFlags::from_bits_truncate(bits))
    }
}

// =============================================================================
// Sub-types
// =============================================================================

/// Mana token in play area.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ManaToken {
    pub color: ManaColor,
    pub source: ManaTokenSource,
    pub cannot_power_spells: bool,
}

/// Mana token source.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ManaTokenSource {
    Die,
    Crystal,
    Effect,
}

/// Crystal inventory (max 3 each).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Crystals {
    pub red: u8,
    pub blue: u8,
    pub green: u8,
    pub white: u8,
}

/// Elemental attack values.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ElementalValues {
    pub physical: u32,
    pub fire: u32,
    pub ice: u32,
    pub cold_fire: u32,
}

impl ElementalValues {
    pub fn total(&self) -> u32 {
        self.physical + self.fire + self.ice + self.cold_fire
    }
}

/// Accumulated attack by type.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AccumulatedAttack {
    pub normal: u32,
    pub ranged: u32,
    pub siege: u32,
    pub normal_elements: ElementalValues,
    pub ranged_elements: ElementalValues,
    pub siege_elements: ElementalValues,
}

/// Combat accumulator — tracks attack/block values from played cards.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct CombatAccumulator {
    pub attack: AccumulatedAttack,
    pub assigned_attack: AccumulatedAttack,
    pub block: u32,
    pub block_elements: ElementalValues,
    pub swift_block_elements: ElementalValues,
    pub assigned_block: u32,
    pub assigned_block_elements: ElementalValues,
}

/// Skill cooldown tracking.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SkillCooldowns {
    pub used_this_round: Vec<SkillId>,
    pub used_this_turn: Vec<SkillId>,
    pub used_this_combat: Vec<SkillId>,
    pub active_until_next_turn: Vec<SkillId>,
}

/// Skill flip state.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SkillFlipState {
    pub flipped_skills: Vec<SkillId>,
}

/// Master of Chaos state (Krang).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterOfChaosState {
    pub position: ManaColor,
    pub free_rotate_available: bool,
}

/// Banner attachment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BannerAttachment {
    pub banner_id: CardId,
    pub unit_instance_id: UnitInstanceId,
    pub is_used_this_round: bool,
}

/// Kept enemy token (Puppet Master).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeptEnemyToken {
    pub enemy_id: EnemyId,
    pub name: String,
    pub attack: u32,
    pub attack_element: Element,
    pub armor: u32,
}

/// Tactic-specific persistent state.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TacticState {
    pub stored_mana_die: Option<StoredManaDie>,
    pub mana_steal_used_this_turn: bool,
    pub sparing_power_stored: Vec<CardId>,
    pub extra_turn_pending: bool,
    pub mana_search_used_this_turn: bool,
}

/// Stored mana die for Mana Steal tactic.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredManaDie {
    pub die_id: SourceDieId,
    pub color: ManaColor,
}

/// Mysterious Box per-turn tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MysteriousBoxState {
    pub revealed_artifact_id: CardId,
    pub used_as: MysteriousBoxUsage,
    pub played_card_from_hand_before_play: bool,
}

/// Mysterious Box usage mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MysteriousBoxUsage {
    Unused,
    Basic,
    Powered,
    Banner,
}

/// Wounds received this turn tracking (Banner of Protection).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct WoundsReceived {
    pub hand: u32,
    pub discard: u32,
}

/// Player unit instance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerUnit {
    pub instance_id: UnitInstanceId,
    pub unit_id: UnitId,
    pub level: u8,
    pub state: UnitState,
    pub wounded: bool,
    pub used_resistance_this_combat: bool,
    pub used_ability_indices: Vec<u32>,
    pub mana_token: Option<ManaToken>,
}

// =============================================================================
// PlayerState
// =============================================================================

/// Full player state. Uses `PendingQueue` instead of 20+ separate Option fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerState {
    pub id: PlayerId,
    pub hero: Hero,

    // Position
    pub position: Option<HexCoord>,

    // Fame & Level
    pub fame: u32,
    pub level: u32,
    pub reputation: i8,

    // Combat stats (derived from level, cached)
    pub armor: u32,
    pub hand_limit: u32,
    pub command_tokens: u32,

    // Cards
    pub hand: Vec<CardId>,
    pub deck: Vec<CardId>,
    pub discard: Vec<CardId>,
    pub play_area: Vec<CardId>,
    pub removed_cards: Vec<CardId>,

    // Units
    pub units: ArrayVec<PlayerUnit, MAX_UNITS>,
    pub bonds_of_loyalty_unit_instance_id: Option<UnitInstanceId>,
    pub attached_banners: ArrayVec<BannerAttachment, MAX_BANNERS>,

    // Skills
    pub skills: Vec<SkillId>,
    pub skill_cooldowns: SkillCooldowns,
    pub skill_flip_state: SkillFlipState,
    pub remaining_hero_skills: Vec<SkillId>,
    pub master_of_chaos_state: Option<MasterOfChaosState>,

    // Puppet Master
    pub kept_enemy_tokens: ArrayVec<KeptEnemyToken, MAX_KEPT_ENEMIES>,

    // Crystals
    pub crystals: Crystals,
    pub spent_crystals_this_turn: Crystals,

    // Tactics
    pub selected_tactic: Option<TacticId>,
    pub tactic_state: TacticState,

    // Mana
    pub pure_mana: Vec<ManaToken>,
    pub used_die_ids: Vec<SourceDieId>,
    pub mana_draw_die_ids: Vec<SourceDieId>,
    pub mana_used_this_turn: Vec<ManaColor>,

    // Combat accumulator
    pub combat_accumulator: CombatAccumulator,

    // Turn tracking
    pub move_points: u32,
    pub influence_points: u32,
    pub healing_points: u32,
    pub enemies_defeated_this_turn: u32,
    pub wounds_healed_from_hand_this_turn: u32,
    pub units_healed_this_turn: Vec<UnitInstanceId>,
    pub units_recruited_this_interaction: Vec<UnitId>,
    pub spell_colors_cast_this_turn: Vec<ManaColor>,
    pub spells_cast_by_color_this_turn: BTreeMap<ManaColor, u32>,
    pub meditation_hand_limit_bonus: u32,

    // Wounds
    pub wounds_received_this_turn: WoundsReceived,

    // Time Bending
    pub time_bending_set_aside_cards: Vec<CardId>,

    // Mysterious Box
    pub mysterious_box_state: Option<MysteriousBoxState>,

    // Packed boolean flags
    pub flags: PlayerFlags,

    // === Consolidated pending state ===
    pub pending: PendingQueue,
}

// =============================================================================
// Combat Types
// =============================================================================

/// Pending elemental damage values.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PendingElementalDamage {
    pub physical: u32,
    pub fire: u32,
    pub ice: u32,
    pub cold_fire: u32,
}

/// Enemy instance in combat.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombatEnemy {
    pub instance_id: CombatInstanceId,
    pub enemy_id: EnemyId,
    pub is_blocked: bool,
    pub is_defeated: bool,
    pub damage_assigned: bool,
    pub is_required_for_conquest: bool,
    pub summoned_by_instance_id: Option<CombatInstanceId>,
    pub is_summoner_hidden: bool,
    pub attacks_blocked: Vec<bool>,
    pub attacks_damage_assigned: Vec<bool>,
    pub attacks_cancelled: Vec<bool>,
}

/// Full combat state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CombatState {
    pub phase: CombatPhase,
    pub enemies: Vec<CombatEnemy>,
    pub wounds_this_combat: u32,
    pub wounds_added_to_hand_this_combat: bool,
    pub attacks_this_phase: u32,
    pub fame_gained: u32,
    pub is_at_fortified_site: bool,
    pub units_allowed: bool,
    pub night_mana_rules: bool,
    pub assault_origin: Option<HexCoord>,
    pub combat_hex_coord: Option<HexCoord>,
    pub all_damage_blocked_this_phase: bool,
    pub discard_enemies_on_failure: bool,
    pub combat_context: CombatContext,

    // Maps keyed by enemy instance ID
    pub pending_damage: BTreeMap<String, PendingElementalDamage>,
    pub pending_block: BTreeMap<String, PendingElementalDamage>,
    pub pending_swift_block: BTreeMap<String, PendingElementalDamage>,
    pub cumbersome_reductions: BTreeMap<String, u32>,
    pub used_defend: BTreeMap<String, String>,
    pub defend_bonuses: BTreeMap<String, u32>,
    pub vampiric_armor_bonus: BTreeMap<String, u32>,
    pub paid_thugs_damage_influence: BTreeMap<String, bool>,
    pub damage_redirects: BTreeMap<String, String>,

    // Cooperative assault
    pub enemy_assignments: Option<BTreeMap<String, Vec<String>>>,
    pub paid_heroes_assault_influence: bool,

    // Target declarations
    pub declared_attack_targets: Option<Vec<CombatInstanceId>>,
    pub declared_block_target: Option<CombatInstanceId>,
    pub declared_block_attack_index: Option<u32>,

    // Damage assignment tracking
    pub has_paralyze_damage_to_hero: bool,
}

impl Default for CombatState {
    fn default() -> Self {
        Self {
            phase: CombatPhase::RangedSiege,
            enemies: Vec::new(),
            wounds_this_combat: 0,
            wounds_added_to_hand_this_combat: false,
            attacks_this_phase: 0,
            fame_gained: 0,
            is_at_fortified_site: false,
            units_allowed: true,
            night_mana_rules: false,
            assault_origin: None,
            combat_hex_coord: None,
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
        }
    }
}

// =============================================================================
// Map Types
// =============================================================================

/// Enemy token on a hex with visibility tracking.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HexEnemy {
    pub token_id: EnemyTokenId,
    pub color: EnemyColor,
    pub is_revealed: bool,
}

/// Ruins token on a hex.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuinsToken {
    pub token_id: RuinsTokenId,
    pub is_revealed: bool,
}

/// Site on a hex.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Site {
    pub site_type: SiteType,
    pub owner: Option<PlayerId>,
    pub is_conquered: bool,
    pub is_burned: bool,
    pub city_color: Option<BasicManaColor>,
    pub mine_color: Option<BasicManaColor>,
    pub deep_mine_colors: Option<ArrayVec<BasicManaColor, 4>>,
}

/// State of a single hex on the map.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HexState {
    pub coord: HexCoord,
    pub terrain: Terrain,
    pub tile_id: TileId,
    pub site: Option<Site>,
    pub rampaging_enemies: ArrayVec<RampagingEnemyType, MAX_RAMPAGING_PER_HEX>,
    pub enemies: ArrayVec<HexEnemy, MAX_HEX_ENEMIES>,
    pub ruins_token: Option<RuinsToken>,
    pub shield_tokens: Vec<PlayerId>,
}

/// Where a tile was placed on the map.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TilePlacement {
    pub tile_id: TileId,
    pub center_coord: HexCoord,
    pub revealed: bool,
}

/// Tile slot for constrained map shapes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileSlot {
    pub coord: HexCoord,
    pub row: u32,
    pub column: i32,
    pub filled: bool,
}

/// Tile draw piles.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TileDeck {
    pub countryside: Vec<TileId>,
    pub core: Vec<TileId>,
}

/// Full map state.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MapState {
    /// Key is `HexCoord::key()` format.
    pub hexes: BTreeMap<String, HexState>,
    pub tiles: Vec<TilePlacement>,
    pub tile_deck: TileDeck,
    pub tile_slots: BTreeMap<String, TileSlot>,
}

// =============================================================================
// Source die
// =============================================================================

/// A die in the mana source pool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceDie {
    pub id: SourceDieId,
    pub color: ManaColor,
    pub is_depleted: bool,
    pub taken_by_player_id: Option<PlayerId>,
}

/// The mana source (dice pool).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ManaSource {
    pub dice: Vec<SourceDie>,
}

// =============================================================================
// Game-level types
// =============================================================================

/// Enemy token piles (draw + discard per color).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct EnemyTokenPiles {
    pub green_draw: Vec<EnemyTokenId>,
    pub green_discard: Vec<EnemyTokenId>,
    pub red_draw: Vec<EnemyTokenId>,
    pub red_discard: Vec<EnemyTokenId>,
    pub brown_draw: Vec<EnemyTokenId>,
    pub brown_discard: Vec<EnemyTokenId>,
    pub violet_draw: Vec<EnemyTokenId>,
    pub violet_discard: Vec<EnemyTokenId>,
    pub gray_draw: Vec<EnemyTokenId>,
    pub gray_discard: Vec<EnemyTokenId>,
    pub white_draw: Vec<EnemyTokenId>,
    pub white_discard: Vec<EnemyTokenId>,
}

/// Ruins token piles.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RuinsTokenPiles {
    pub draw: Vec<RuinsTokenId>,
    pub discard: Vec<RuinsTokenId>,
}

/// Game offers (spell/AA/unit/artifact).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GameOffers {
    pub spells: Vec<CardId>,
    pub advanced_actions: Vec<CardId>,
    pub units: Vec<UnitId>,
    pub artifacts: Vec<CardId>,
    /// Common skill pool — unchosen skills from level-up rewards.
    pub common_skills: Vec<SkillId>,
}

/// Card draw decks.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GameDecks {
    pub spell_deck: Vec<CardId>,
    pub advanced_action_deck: Vec<CardId>,
    pub artifact_deck: Vec<CardId>,
    pub unit_deck: Vec<UnitId>,
}

/// City state (for revealed cities).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CityState {
    pub color: BasicManaColor,
    pub leader_enemy_id: Option<EnemyId>,
    pub garrison: Vec<EnemyId>,
}

/// Cooperative assault proposal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CooperativeAssaultProposal {
    pub proposer_id: PlayerId,
    pub city_color: BasicManaColor,
    pub hex_coord: HexCoord,
}

/// Mana Overload skill center state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManaOverloadCenter {
    pub marked_color: ManaColor,
    pub owner_id: PlayerId,
    pub skill_id: SkillId,
}

/// Mana Enhancement skill center state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManaEnhancementCenter {
    pub marked_color: BasicManaColor,
    pub owner_id: PlayerId,
    pub skill_id: SkillId,
}

/// Source Opening skill center state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceOpeningCenter {
    pub owner_id: PlayerId,
    pub skill_id: SkillId,
    pub returning_player_id: Option<PlayerId>,
    pub used_die_count_at_return: u32,
}

/// A single pre-computed dummy turn.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrecomputedDummyTurn {
    pub cards_flipped: u32,
    pub bonus_flipped: u32,
    pub matched_color: Option<BasicManaColor>,
    pub deck_remaining_after: usize,
}

/// Dummy player for solo mode.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DummyPlayer {
    pub hero: Hero,
    pub deck: Vec<CardId>,
    pub discard: Vec<CardId>,
    pub crystals: BTreeMap<BasicManaColor, u32>,
    pub precomputed_turns: Vec<PrecomputedDummyTurn>,
    pub current_turn_index: usize,
}

/// Scenario configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioConfig {
    // Map setup
    pub countryside_tile_count: u32,
    pub core_tile_count: u32,
    pub city_tile_count: u32,
    pub map_shape: MapShape,

    // Round limits
    pub day_rounds: u32,
    pub night_rounds: u32,
    pub total_rounds: u32,

    // Special rules
    pub skills_enabled: bool,
    pub elite_units_enabled: bool,
    pub spells_available: bool,
    pub advanced_actions_available: bool,
    pub fame_per_tile_explored: u32,
    pub cities_can_be_entered: bool,
    pub default_city_level: u32,

    // Tactic handling
    pub tactic_removal_mode: TacticRemovalMode,
    pub dummy_tactic_order: DummyTacticOrder,

    // End condition
    pub end_trigger: ScenarioEndTrigger,
}

/// Final score result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinalScoreResult {
    pub scores: BTreeMap<String, u32>,
}

// =============================================================================
// GameState — the root
// =============================================================================

/// Full game state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub phase: GamePhase,
    pub time_of_day: TimeOfDay,
    pub round: u32,
    pub turn_order: Vec<PlayerId>,
    pub current_player_index: u32,
    pub end_of_round_announced_by: Option<PlayerId>,
    pub players_with_final_turn: Vec<PlayerId>,
    pub players: Vec<PlayerState>,
    pub map: MapState,
    pub combat: Option<Box<CombatState>>,

    // Tactics selection
    pub round_phase: RoundPhase,
    pub available_tactics: Vec<TacticId>,
    pub removed_tactics: Vec<TacticId>,
    pub dummy_player_tactic: Option<TacticId>,
    pub tactics_selection_order: Vec<PlayerId>,
    pub current_tactic_selector: Option<PlayerId>,

    // Resources
    pub source: ManaSource,
    pub offers: GameOffers,
    pub enemy_tokens: EnemyTokenPiles,
    pub ruins_tokens: RuinsTokenPiles,
    pub decks: GameDecks,

    // City
    pub city_level: u32,
    pub cities: BTreeMap<String, CityState>,

    // Modifiers
    pub active_modifiers: Vec<ActiveModifier>,

    // Action epoch — incremented after every action for stale-detection
    pub action_epoch: u64,

    // Instance counter for generating unique unit instance IDs
    pub next_instance_counter: u64,

    // RNG
    pub rng: RngState,

    // Wound pile
    pub wound_pile_count: Option<u32>,

    // Scenario
    pub scenario_id: ScenarioId,
    pub scenario_config: ScenarioConfig,
    pub scenario_end_triggered: bool,
    pub final_turns_remaining: Option<u32>,
    pub game_ended: bool,
    pub winning_player_id: Option<PlayerId>,

    // Cooperative
    pub pending_cooperative_assault: Option<CooperativeAssaultProposal>,
    pub final_score_result: Option<FinalScoreResult>,

    // Interactive skill centers
    pub mana_overload_center: Option<ManaOverloadCenter>,
    pub mana_enhancement_center: Option<ManaEnhancementCenter>,
    pub source_opening_center: Option<SourceOpeningCenter>,

    // Solo mode
    pub dummy_player: Option<DummyPlayer>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn player_flags_bitfield() {
        let mut flags = PlayerFlags::empty();
        assert!(!flags.contains(PlayerFlags::KNOCKED_OUT));

        flags.insert(PlayerFlags::KNOCKED_OUT);
        assert!(flags.contains(PlayerFlags::KNOCKED_OUT));

        flags.insert(PlayerFlags::HAS_MOVED_THIS_TURN);
        assert!(flags.contains(PlayerFlags::KNOCKED_OUT));
        assert!(flags.contains(PlayerFlags::HAS_MOVED_THIS_TURN));
        assert!(!flags.contains(PlayerFlags::IS_RESTING));
    }

    #[test]
    fn crystals_default() {
        let c = Crystals::default();
        assert_eq!(c.red, 0);
        assert_eq!(c.blue, 0);
        assert_eq!(c.green, 0);
        assert_eq!(c.white, 0);
    }

    #[test]
    fn elemental_values_total() {
        let ev = ElementalValues {
            physical: 3,
            fire: 2,
            ice: 1,
            cold_fire: 0,
        };
        assert_eq!(ev.total(), 6);
    }

    #[test]
    fn map_state_default() {
        let map = MapState::default();
        assert!(map.hexes.is_empty());
        assert!(map.tiles.is_empty());
    }

    #[test]
    fn pending_queue_in_player_state_default() {
        let q = PendingQueue::new();
        assert!(q.is_empty());
    }

    #[test]
    fn combat_state_is_boxed() {
        // Verify the Option<Box<CombatState>> is small on the stack
        assert_eq!(
            std::mem::size_of::<Option<Box<CombatState>>>(),
            std::mem::size_of::<usize>()
        );
    }
}
