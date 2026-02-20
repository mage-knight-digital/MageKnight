//! Pending state types — consolidated from 20+ separate Option fields in TS.
//!
//! Design: `ActivePending` is the single blocking resolution the player must address.
//! `DeferredPending` entries accumulate and get promoted when conditions are met.
//! `PendingQueue` owns both.

use arrayvec::ArrayVec;
use serde::{Deserialize, Serialize};

use crate::effect::CardEffect;
use crate::enums::*;
use crate::ids::*;

// =============================================================================
// Max capacities (derived from replay data + safety margin)
// =============================================================================

/// Max units a player can control.
pub const MAX_UNITS: usize = 8;
/// Max deferred entries at once.
pub const MAX_DEFERRED: usize = 8;
/// Max reward entries.
pub const MAX_REWARDS: usize = 6;
/// Max cards in a selection set.
pub const MAX_CARD_SELECTION: usize = 16;
/// Max level-up entries pending at once.
pub const MAX_PENDING_LEVEL_UPS: usize = 5;
/// Max deep mine colors.
pub const MAX_DEEP_MINE_COLORS: usize = 4;
/// Max drawn skills for level-up reward.
pub const MAX_DRAWN_SKILLS: usize = 2;
/// Max offer cards for book of wisdom / training.
pub const MAX_OFFER_CARDS: usize = 8;
/// Max attack defeat fame trackers.
pub const MAX_ATTACK_DEFEAT_FAME: usize = 4;
/// Max unit maintenance entries.
pub const MAX_UNIT_MAINTENANCE: usize = 8;

// =============================================================================
// Sub-types used by pending variants
// =============================================================================

/// An effect waiting to be resolved after a pending choice completes.
/// Mirror of mk-engine's `QueuedEffect` but owned by mk-types for persistence.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContinuationEntry {
    pub effect: CardEffect,
    pub source_card_id: Option<CardId>,
}

/// How a pending choice should be resolved beyond just enqueueing the chosen effect.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChoiceResolution {
    /// Standard: just enqueue the chosen effect.
    Standard,
    /// Crystallize: consume a matching mana token before gaining the crystal.
    CrystallizeConsume,
    /// Discard a card before enqueueing the then_effect.
    /// `eligible_indices` are the hand indices eligible for discard.
    DiscardThenContinue { eligible_indices: Vec<usize> },
    /// ManaDrawPowered: mark a die as taken, set its color, then gain tokens.
    ManaDrawTakeDie {
        die_id: SourceDieId,
        tokens_per_die: u32,
        remaining_dice: u32,
    },
    /// CardBoost: move the selected card from hand to play_area.
    /// `eligible_hand_indices` are the hand indices of eligible cards.
    BoostTarget { eligible_hand_indices: Vec<usize> },
}

/// Pending choice — when a card, skill, or unit ability requires player selection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingChoice {
    pub card_id: Option<CardId>,
    pub skill_id: Option<SkillId>,
    pub unit_instance_id: Option<UnitInstanceId>,
    /// The resolvable options the player can choose from.
    pub options: Vec<CardEffect>,
    /// Effects remaining in the queue after this choice resolves.
    pub continuation: Vec<ContinuationEntry>,
    pub movement_bonus_applied: bool,
    /// How to resolve this choice beyond just enqueueing the chosen effect.
    #[serde(default = "default_choice_resolution")]
    pub resolution: ChoiceResolution,
}

fn default_choice_resolution() -> ChoiceResolution {
    ChoiceResolution::Standard
}

/// Pending discard cost resolution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingDiscard {
    pub source_card_id: CardId,
    pub count: u32,
    pub optional: bool,
    pub filter_wounds: bool,
    pub color_matters: bool,
    pub allow_no_color: bool,
    pub satisfies_minimum_turn_requirement_on_resolve: bool,
    pub end_turn_after_resolve: bool,
}

/// Pending discard-for-attack resolution (Sword of Justice basic).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingDiscardForAttack {
    pub source_card_id: CardId,
    pub attack_per_card: u32,
    pub combat_type: CombatType,
}

/// Pending discard-for-bonus resolution (Stout Resolve).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingDiscardForBonus {
    pub source_card_id: CardId,
    pub option_count: u32,
    pub bonus_per_card: u32,
    pub max_discards: u32,
    pub discard_filter: DiscardForBonusFilter,
}

/// Filter for discard-for-bonus.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiscardForBonusFilter {
    WoundOnly,
    AnyMaxOneWound,
}

/// Pending discard-for-crystal resolution (Savage Harvesting).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingDiscardForCrystal {
    pub source_card_id: CardId,
    pub optional: bool,
    pub discarded_card_id: Option<CardId>,
    pub awaiting_color_choice: bool,
}

/// Pending decompose resolution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingDecompose {
    pub source_card_id: CardId,
    pub mode: EffectMode,
}

/// Basic/powered mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EffectMode {
    Basic,
    Powered,
}

/// Pending maximal effect resolution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingMaximalEffect {
    pub source_card_id: CardId,
    pub multiplier: u32,
    pub effect_kind: EffectMode,
}

/// Pending Book of Wisdom resolution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingBookOfWisdom {
    pub source_card_id: CardId,
    pub mode: EffectMode,
    pub phase: BookOfWisdomPhase,
    pub thrown_card_color: Option<BasicManaColor>,
    pub available_offer_cards: ArrayVec<CardId, MAX_OFFER_CARDS>,
}

/// Book of Wisdom / Training phase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BookOfWisdomPhase {
    SelectCard,
    SelectFromOffer,
}

/// Pending Training resolution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingTraining {
    pub source_card_id: CardId,
    pub mode: EffectMode,
    pub phase: BookOfWisdomPhase,
    pub thrown_card_color: Option<BasicManaColor>,
    pub available_offer_cards: ArrayVec<CardId, MAX_OFFER_CARDS>,
}

/// Level-up reward for even levels.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingLevelUpReward {
    pub level: u8,
    pub drawn_skills: ArrayVec<SkillId, MAX_DRAWN_SKILLS>,
}

/// Tactic decision type.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum PendingTacticDecision {
    Rethink { max_cards: u8 },
    ManaSteal,
    Preparation { deck_snapshot: Vec<CardId> },
    MidnightMeditation { max_cards: u8 },
    SparingPower,
}

/// Pending terrain cost reduction choice.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingTerrainCostReduction {
    pub mode: TerrainCostReductionMode,
    pub reduction: i32,
    pub minimum_cost: u32,
}

/// Terrain cost reduction mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TerrainCostReductionMode {
    Hex,
    Terrain,
}

/// Unit maintenance entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnitMaintenanceEntry {
    pub unit_instance_id: UnitInstanceId,
    pub unit_id: UnitId,
}

/// Attack defeat fame tracker.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttackDefeatFameTracker {
    pub source_card_id: Option<CardId>,
    pub attack_type: CombatType,
    pub element: AttackElement,
    pub amount: u32,
    pub remaining: u32,
    pub fame: u32,
    pub reputation_per_defeat: Option<i32>,
    pub fame_per_defeat: Option<u32>,
    pub armor_reduction_per_defeat: Option<u32>,
}

/// Pending meditation state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingMeditation {
    pub version: EffectMode,
    pub phase: MeditationPhase,
    pub selected_card_ids: Vec<CardId>,
}

/// Meditation phase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MeditationPhase {
    SelectCards,
    PlaceCards,
}

/// Pending Crystal Joy reclaim state.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct PendingCrystalJoyReclaim {
    pub version: EffectMode,
}

/// Pending Steady Tempo deck placement state.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct PendingSteadyTempoDeckPlacement {
    pub version: EffectMode,
}

/// Site reward (placeholder — full definition in mk-data).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SiteReward {
    pub reward_type: String,
}

// =============================================================================
// ActivePending — the single blocking resolution
// =============================================================================

/// The single blocking resolution the player must address right now.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ActivePending {
    Choice(PendingChoice),
    Discard(PendingDiscard),
    DiscardForAttack(PendingDiscardForAttack),
    DiscardForBonus(PendingDiscardForBonus),
    DiscardForCrystal(PendingDiscardForCrystal),
    Decompose(PendingDecompose),
    MaximalEffect(PendingMaximalEffect),
    BookOfWisdom(PendingBookOfWisdom),
    Training(PendingTraining),
    TacticDecision(PendingTacticDecision),
    LevelUpReward(PendingLevelUpReward),
    DeepMineChoice {
        colors: ArrayVec<BasicManaColor, MAX_DEEP_MINE_COLORS>,
    },
    GladeWoundChoice,
    BannerProtectionChoice,
    SourceOpeningReroll {
        die_id: SourceDieId,
    },
    Meditation(PendingMeditation),
    PlunderDecision,
    UnitMaintenance(ArrayVec<UnitMaintenanceEntry, MAX_UNIT_MAINTENANCE>),
    TerrainCostReduction(PendingTerrainCostReduction),
    CrystalJoyReclaim(PendingCrystalJoyReclaim),
    SteadyTempoDeckPlacement(PendingSteadyTempoDeckPlacement),
}

// =============================================================================
// DeferredPending — entries that accumulate alongside active resolution
// =============================================================================

/// Deferred entries that coexist and get promoted when conditions are met.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DeferredPending {
    Rewards(ArrayVec<SiteReward, MAX_REWARDS>),
    LevelUps(ArrayVec<u8, MAX_PENDING_LEVEL_UPS>),
    LevelUpRewards(Vec<PendingLevelUpReward>),
    AttackDefeatFame(ArrayVec<AttackDefeatFameTracker, MAX_ATTACK_DEFEAT_FAME>),
}

// =============================================================================
// PendingQueue — owns both active and deferred state
// =============================================================================

/// Consolidated pending state replacing 20+ separate Option fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingQueue {
    pub active: Option<ActivePending>,
    pub deferred: ArrayVec<DeferredPending, MAX_DEFERRED>,
}

impl PendingQueue {
    pub fn new() -> Self {
        Self {
            active: None,
            deferred: ArrayVec::new(),
        }
    }

    pub fn has_active(&self) -> bool {
        self.active.is_some()
    }

    pub fn has_deferred(&self) -> bool {
        !self.deferred.is_empty()
    }

    pub fn is_empty(&self) -> bool {
        self.active.is_none() && self.deferred.is_empty()
    }
}

impl Default for PendingQueue {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pending_queue_starts_empty() {
        let q = PendingQueue::new();
        assert!(q.is_empty());
        assert!(!q.has_active());
        assert!(!q.has_deferred());
    }

    #[test]
    fn pending_queue_with_active() {
        let mut q = PendingQueue::new();
        q.active = Some(ActivePending::GladeWoundChoice);
        assert!(q.has_active());
        assert!(!q.is_empty());
    }

    #[test]
    fn pending_queue_default() {
        let q = PendingQueue::default();
        assert!(q.is_empty());
    }
}
