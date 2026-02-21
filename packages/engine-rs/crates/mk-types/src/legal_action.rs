//! Fully parameterized, executable actions — the LegalAction enum.
//!
//! Every variant carries all data needed for execution. This lives in mk-types
//! (zero engine deps) so it can be used across crate boundaries.

use serde::{Deserialize, Serialize};

use crate::enums::{BasicManaColor, CombatType, GladeWoundChoice, SidewaysAs};
use crate::hex::{HexCoord, HexDirection};
use crate::ids::{CardId, CombatInstanceId, SkillId, TacticId, UnitId, UnitInstanceId};

/// Data for a tactic decision resolution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TacticDecisionData {
    /// Mana Steal: take this die from the source.
    ManaSteal { die_index: usize },
    /// Preparation: take this card from deck to hand.
    Preparation { deck_card_index: usize },
    /// Sparing Power: stash top deck card.
    SparingPowerStash,
    /// Sparing Power: take all stashed cards to hand.
    SparingPowerTake,
}

/// A fully parameterized, executable action.
///
/// Every variant carries all data needed for execution — no further
/// lookups or validation required. Enumerated by `enumerate_legal_actions()`
/// in mk-engine, consumed by `apply_legal_action()`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum LegalAction {
    SelectTactic {
        tactic_id: TacticId,
    },
    PlayCardBasic {
        hand_index: usize,
        card_id: CardId,
    },
    PlayCardPowered {
        hand_index: usize,
        card_id: CardId,
        mana_color: BasicManaColor,
    },
    PlayCardSideways {
        hand_index: usize,
        card_id: CardId,
        sideways_as: SidewaysAs,
    },
    Move {
        target: HexCoord,
        cost: u32,
    },
    Explore {
        direction: HexDirection,
    },
    ResolveChoice {
        choice_index: usize,
    },
    ResolveDiscardForBonus {
        choice_index: usize,
        discard_count: usize,
    },
    ResolveDecompose {
        /// Index of the hand card to decompose (must be BasicAction or AdvancedAction).
        hand_index: usize,
    },
    ChallengeRampaging {
        hex: HexCoord,
    },
    DeclareBlock {
        enemy_instance_id: CombatInstanceId,
        attack_index: usize,
    },
    /// Initiate an attack declaration — enters SubsetSelection for target enemies.
    InitiateAttack {
        attack_type: CombatType,
    },
    SpendMoveOnCumbersome {
        enemy_instance_id: CombatInstanceId,
    },
    ResolveTacticDecision {
        data: TacticDecisionData,
    },
    ActivateTactic,
    /// Initiate mana search — enters SubsetSelection for rerollable dice.
    InitiateManaSearch,
    EnterSite,
    InteractSite {
        healing: u32,
    },
    PlunderSite,
    DeclinePlunder,
    ResolveGladeWound {
        choice: GladeWoundChoice,
    },
    RecruitUnit {
        unit_id: UnitId,
        offer_index: usize,
        influence_cost: u32,
    },
    ActivateUnit {
        unit_instance_id: UnitInstanceId,
        ability_index: usize,
    },
    AssignDamageToHero {
        enemy_index: usize,
        attack_index: usize,
    },
    AssignDamageToUnit {
        enemy_index: usize,
        attack_index: usize,
        unit_instance_id: UnitInstanceId,
    },
    ChooseLevelUpReward {
        /// Index into drawn_skills (if from_common_pool=false) or common_skills (if true).
        skill_index: usize,
        /// True if picking from common_skills instead of the drawn pair.
        from_common_pool: bool,
        /// AA to take from the offer row.
        advanced_action_id: CardId,
    },
    /// Pick one item in an ongoing subset selection.
    SubsetSelect { index: usize },
    /// Confirm the current subset selection (execute it).
    SubsetConfirm,
    ResolveCrystalJoyReclaim {
        /// Index into discard pile, or None to skip.
        discard_index: Option<usize>,
    },
    ResolveSteadyTempoDeckPlacement {
        /// true = place card on deck, false = skip
        place: bool,
    },
    ResolveBannerProtection {
        /// true = remove all wounds received this turn, false = keep them
        remove_all: bool,
    },
    EndTurn,
    DeclareRest,
    CompleteRest {
        discard_hand_index: Option<usize>,
    },
    UseSkill {
        skill_id: SkillId,
    },
    EndCombatPhase,
    Undo,
}

/// A set of legal actions for a specific player at a specific epoch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegalActionSet {
    /// The epoch at which these actions were computed.
    pub epoch: u64,
    /// The player these actions are for.
    pub player_idx: usize,
    /// The legal actions, in deterministic order.
    pub actions: Vec<LegalAction>,
}
