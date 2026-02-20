//! Player action types — discriminated union for all actions a player can take.
//!
//! Matches the TypeScript `PlayerAction` union exactly (same `type` discriminant values).

use serde::{Deserialize, Serialize};

use crate::enums::*;
use crate::hex::{HexCoord, HexDirection};
use crate::ids::*;

/// Info about a mana source used to power a card.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ManaSourceInfo {
    #[serde(rename = "type")]
    pub source_type: ManaSourceType,
    pub color: ManaColor,
    /// Required when source_type is `Die`.
    #[serde(rename = "dieId", skip_serializing_if = "Option::is_none")]
    pub die_id: Option<String>,
}

/// Block source with elemental type and value.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockSource {
    pub element: Element,
    pub value: u32,
}

/// Attack source with elemental type and value.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttackSource {
    pub element: Element,
    pub value: u32,
}

/// Damage assignment target.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DamageAssignment {
    pub target: DamageTarget,
    #[serde(rename = "unitInstanceId", skip_serializing_if = "Option::is_none")]
    pub unit_instance_id: Option<UnitInstanceId>,
    pub amount: u32,
}

/// Cooperative assault enemy distribution.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EnemyDistribution {
    #[serde(rename = "playerId")]
    pub player_id: PlayerId,
    #[serde(rename = "enemyInstanceIds")]
    pub enemy_instance_ids: Vec<CombatInstanceId>,
}

/// Tactic decision payload (discriminated by `type`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TacticDecisionPayload {
    #[serde(rename = "rethink")]
    Rethink {
        #[serde(rename = "cardIds")]
        card_ids: Vec<CardId>,
    },
    #[serde(rename = "mana_steal")]
    ManaSteal {
        #[serde(rename = "dieId")]
        die_id: String,
    },
    #[serde(rename = "preparation")]
    Preparation {
        #[serde(rename = "cardId")]
        card_id: CardId,
    },
    #[serde(rename = "midnight_meditation")]
    MidnightMeditation {
        #[serde(rename = "cardIds")]
        card_ids: Vec<CardId>,
    },
    #[serde(rename = "sparing_power")]
    SparingPower { choice: String },
}

/// Skill choice within level-up rewards.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SkillChoice {
    #[serde(rename = "fromCommonPool")]
    pub from_common_pool: bool,
    #[serde(rename = "skillId")]
    pub skill_id: String,
}

/// All player actions as a discriminated union.
///
/// Serialized with `"type"` as the tag field, matching the TypeScript constants.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum PlayerAction {
    // =========================================================================
    // Movement
    // =========================================================================
    #[serde(rename = "MOVE")]
    Move { target: HexCoord },

    #[serde(rename = "EXPLORE")]
    Explore {
        direction: HexDirection,
        #[serde(rename = "fromTileCoord")]
        from_tile_coord: HexCoord,
    },

    // =========================================================================
    // Adventure sites
    // =========================================================================
    #[serde(rename = "ENTER_SITE")]
    EnterSite,

    #[serde(rename = "ALTAR_TRIBUTE")]
    AltarTribute {
        #[serde(rename = "manaSources")]
        mana_sources: Vec<ManaSourceInfo>,
    },

    #[serde(rename = "BURN_MONASTERY")]
    BurnMonastery,

    #[serde(rename = "PLUNDER_VILLAGE")]
    PlunderVillage,

    #[serde(rename = "DECLINE_PLUNDER")]
    DeclinePlunder,

    // =========================================================================
    // Turn structure
    // =========================================================================
    #[serde(rename = "END_TURN")]
    EndTurn,

    #[serde(rename = "REST")]
    Rest {
        #[serde(rename = "restType")]
        rest_type: RestType,
        #[serde(rename = "discardCardIds")]
        discard_card_ids: Vec<CardId>,
        #[serde(rename = "announceEndOfRound", skip_serializing_if = "Option::is_none")]
        announce_end_of_round: Option<bool>,
    },

    #[serde(rename = "DECLARE_REST")]
    DeclareRest,

    #[serde(rename = "COMPLETE_REST")]
    CompleteRest {
        #[serde(rename = "discardCardIds")]
        discard_card_ids: Vec<CardId>,
        #[serde(rename = "announceEndOfRound", skip_serializing_if = "Option::is_none")]
        announce_end_of_round: Option<bool>,
    },

    #[serde(rename = "INTERACT")]
    Interact {
        #[serde(skip_serializing_if = "Option::is_none")]
        healing: Option<u32>,
        #[serde(rename = "recruitUnitId", skip_serializing_if = "Option::is_none")]
        recruit_unit_id: Option<UnitId>,
    },

    #[serde(rename = "ANNOUNCE_END_OF_ROUND")]
    AnnounceEndOfRound,

    // =========================================================================
    // Card playing
    // =========================================================================
    #[serde(rename = "PLAY_CARD")]
    PlayCard {
        #[serde(rename = "cardId")]
        card_id: CardId,
        powered: bool,
        #[serde(rename = "manaSource", skip_serializing_if = "Option::is_none")]
        mana_source: Option<ManaSourceInfo>,
        #[serde(rename = "manaSources", skip_serializing_if = "Option::is_none")]
        mana_sources: Option<Vec<ManaSourceInfo>>,
    },

    #[serde(rename = "PLAY_CARD_SIDEWAYS")]
    PlayCardSideways {
        #[serde(rename = "cardId")]
        card_id: CardId,
        #[serde(rename = "as")]
        sideways_as: SidewaysAs,
    },

    // =========================================================================
    // Unit activation
    // =========================================================================
    #[serde(rename = "ACTIVATE_UNIT")]
    ActivateUnit {
        #[serde(rename = "unitInstanceId")]
        unit_instance_id: String,
        #[serde(rename = "abilityIndex")]
        ability_index: u32,
        #[serde(rename = "manaSource", skip_serializing_if = "Option::is_none")]
        mana_source: Option<ManaSourceInfo>,
    },

    // =========================================================================
    // Skill usage
    // =========================================================================
    #[serde(rename = "USE_SKILL")]
    UseSkill {
        #[serde(rename = "skillId")]
        skill_id: SkillId,
        #[serde(rename = "manaSource", skip_serializing_if = "Option::is_none")]
        mana_source: Option<ManaSourceInfo>,
    },

    #[serde(rename = "RETURN_INTERACTIVE_SKILL")]
    ReturnInteractiveSkill {
        #[serde(rename = "skillId")]
        skill_id: SkillId,
    },

    // =========================================================================
    // Interactions
    // =========================================================================
    #[serde(rename = "RECRUIT_UNIT")]
    RecruitUnit {
        #[serde(rename = "unitId")]
        unit_id: UnitId,
        #[serde(rename = "influenceSpent")]
        influence_spent: u32,
        #[serde(skip_serializing_if = "Option::is_none")]
        source: Option<RecruitmentSource>,
        #[serde(rename = "manaSource", skip_serializing_if = "Option::is_none")]
        mana_source: Option<ManaSourceInfo>,
        #[serde(rename = "manaTokenColor", skip_serializing_if = "Option::is_none")]
        mana_token_color: Option<BasicManaColor>,
        #[serde(
            rename = "disbandUnitInstanceId",
            skip_serializing_if = "Option::is_none"
        )]
        disband_unit_instance_id: Option<String>,
    },

    #[serde(rename = "DISBAND_UNIT")]
    DisbandUnit {
        #[serde(rename = "unitInstanceId")]
        unit_instance_id: String,
    },

    #[serde(rename = "ASSIGN_BANNER")]
    AssignBanner {
        #[serde(rename = "bannerCardId")]
        banner_card_id: CardId,
        #[serde(rename = "targetUnitInstanceId")]
        target_unit_instance_id: String,
    },

    #[serde(rename = "USE_BANNER_FEAR")]
    UseBannerFear {
        #[serde(rename = "unitInstanceId")]
        unit_instance_id: String,
        #[serde(rename = "targetEnemyInstanceId")]
        target_enemy_instance_id: String,
        #[serde(rename = "attackIndex", skip_serializing_if = "Option::is_none")]
        attack_index: Option<u32>,
    },

    #[serde(rename = "PAY_HEROES_ASSAULT_INFLUENCE")]
    PayHeroesAssaultInfluence,

    #[serde(rename = "PAY_THUGS_DAMAGE_INFLUENCE")]
    PayThugsDamageInfluence {
        #[serde(rename = "unitInstanceId")]
        unit_instance_id: String,
    },

    #[serde(rename = "BUY_SPELL")]
    BuySpell {
        #[serde(rename = "cardId")]
        card_id: CardId,
    },

    #[serde(rename = "LEARN_ADVANCED_ACTION")]
    LearnAdvancedAction {
        #[serde(rename = "cardId")]
        card_id: CardId,
        #[serde(rename = "fromMonastery")]
        from_monastery: bool,
        #[serde(rename = "fromLearning", skip_serializing_if = "Option::is_none")]
        from_learning: Option<bool>,
    },

    #[serde(rename = "BUY_HEALING")]
    BuyHealing { amount: u32 },

    // =========================================================================
    // Tactics
    // =========================================================================
    #[serde(rename = "SELECT_TACTIC")]
    SelectTactic {
        #[serde(rename = "tacticId")]
        tactic_id: TacticId,
    },

    #[serde(rename = "ACTIVATE_TACTIC")]
    ActivateTactic {
        #[serde(rename = "tacticId")]
        tactic_id: TacticId,
    },

    #[serde(rename = "RESOLVE_TACTIC_DECISION")]
    ResolveTacticDecision { decision: TacticDecisionPayload },

    #[serde(rename = "REROLL_SOURCE_DICE")]
    RerollSourceDice {
        #[serde(rename = "dieIds")]
        die_ids: Vec<String>,
    },

    // =========================================================================
    // Undo
    // =========================================================================
    #[serde(rename = "UNDO")]
    Undo,

    // =========================================================================
    // Choice resolution
    // =========================================================================
    #[serde(rename = "RESOLVE_CHOICE")]
    ResolveChoice {
        #[serde(rename = "choiceIndex")]
        choice_index: u32,
    },

    // =========================================================================
    // Terrain cost reduction
    // =========================================================================
    #[serde(rename = "RESOLVE_HEX_COST_REDUCTION")]
    ResolveHexCostReduction { coordinate: HexCoord },

    #[serde(rename = "RESOLVE_TERRAIN_COST_REDUCTION")]
    ResolveTerrainCostReduction { terrain: String },

    // =========================================================================
    // Level up
    // =========================================================================
    #[serde(rename = "CHOOSE_LEVEL_UP_REWARDS")]
    ChooseLevelUpRewards {
        level: u32,
        #[serde(rename = "skillChoice")]
        skill_choice: SkillChoice,
        #[serde(rename = "advancedActionId")]
        advanced_action_id: String,
    },

    // =========================================================================
    // Site rewards
    // =========================================================================
    #[serde(rename = "SELECT_REWARD")]
    SelectReward {
        #[serde(rename = "cardId")]
        card_id: CardId,
        #[serde(rename = "rewardIndex")]
        reward_index: u32,
        #[serde(rename = "unitId", skip_serializing_if = "Option::is_none")]
        unit_id: Option<UnitId>,
        #[serde(
            rename = "disbandUnitInstanceId",
            skip_serializing_if = "Option::is_none"
        )]
        disband_unit_instance_id: Option<String>,
    },

    // =========================================================================
    // Magical Glade
    // =========================================================================
    #[serde(rename = "RESOLVE_GLADE_WOUND")]
    ResolveGladeWound { choice: GladeWoundChoice },

    // =========================================================================
    // Unit maintenance (Magic Familiars)
    // =========================================================================
    #[serde(rename = "RESOLVE_UNIT_MAINTENANCE")]
    ResolveUnitMaintenance {
        #[serde(rename = "unitInstanceId")]
        unit_instance_id: String,
        #[serde(rename = "keepUnit")]
        keep_unit: bool,
        #[serde(rename = "crystalColor", skip_serializing_if = "Option::is_none")]
        crystal_color: Option<BasicManaColor>,
        #[serde(rename = "newManaTokenColor", skip_serializing_if = "Option::is_none")]
        new_mana_token_color: Option<BasicManaColor>,
    },

    // =========================================================================
    // Deep Mine
    // =========================================================================
    #[serde(rename = "RESOLVE_DEEP_MINE")]
    ResolveDeepMine { color: BasicManaColor },

    // =========================================================================
    // Crystal Joy reclaim
    // =========================================================================
    #[serde(rename = "RESOLVE_CRYSTAL_JOY_RECLAIM")]
    ResolveCrystalJoyReclaim {
        #[serde(rename = "cardId", skip_serializing_if = "Option::is_none")]
        card_id: Option<CardId>,
    },

    // =========================================================================
    // Steady Tempo deck placement
    // =========================================================================
    #[serde(rename = "RESOLVE_STEADY_TEMPO")]
    ResolveSteadyTempo { place: bool },

    // =========================================================================
    // Banner of Protection
    // =========================================================================
    #[serde(rename = "RESOLVE_BANNER_PROTECTION")]
    ResolveBannerProtection {
        #[serde(rename = "removeAll")]
        remove_all: bool,
    },

    // =========================================================================
    // Source Opening reroll
    // =========================================================================
    #[serde(rename = "RESOLVE_SOURCE_OPENING_REROLL")]
    ResolveSourceOpeningReroll { reroll: bool },

    // =========================================================================
    // Discard as cost
    // =========================================================================
    #[serde(rename = "RESOLVE_DISCARD")]
    ResolveDiscard {
        #[serde(rename = "cardIds")]
        card_ids: Vec<CardId>,
    },

    #[serde(rename = "RESOLVE_DISCARD_FOR_ATTACK")]
    ResolveDiscardForAttack {
        #[serde(rename = "cardIds")]
        card_ids: Vec<CardId>,
    },

    #[serde(rename = "RESOLVE_DISCARD_FOR_BONUS")]
    ResolveDiscardForBonus {
        #[serde(rename = "cardIds")]
        card_ids: Vec<CardId>,
        #[serde(rename = "choiceIndex")]
        choice_index: u32,
    },

    #[serde(rename = "RESOLVE_DISCARD_FOR_CRYSTAL")]
    ResolveDiscardForCrystal {
        #[serde(rename = "cardId")]
        card_id: Option<CardId>,
    },

    // =========================================================================
    // Meditation
    // =========================================================================
    #[serde(rename = "RESOLVE_MEDITATION")]
    ResolveMeditation {
        #[serde(rename = "selectedCardIds", skip_serializing_if = "Option::is_none")]
        selected_card_ids: Option<Vec<CardId>>,
        #[serde(rename = "placeOnTop", skip_serializing_if = "Option::is_none")]
        place_on_top: Option<bool>,
    },

    // =========================================================================
    // Decompose
    // =========================================================================
    #[serde(rename = "RESOLVE_DECOMPOSE")]
    ResolveDecompose {
        #[serde(rename = "cardId")]
        card_id: CardId,
    },

    // =========================================================================
    // Maximal Effect
    // =========================================================================
    #[serde(rename = "RESOLVE_MAXIMAL_EFFECT")]
    ResolveMaximalEffect {
        #[serde(rename = "cardId")]
        card_id: CardId,
    },

    // =========================================================================
    // Book of Wisdom
    // =========================================================================
    #[serde(rename = "RESOLVE_BOOK_OF_WISDOM")]
    ResolveBookOfWisdom {
        #[serde(rename = "cardId")]
        card_id: CardId,
    },

    // =========================================================================
    // Training
    // =========================================================================
    #[serde(rename = "RESOLVE_TRAINING")]
    ResolveTraining {
        #[serde(rename = "cardId")]
        card_id: CardId,
    },

    // =========================================================================
    // Artifact crystal color (Savage Harvesting)
    // =========================================================================
    #[serde(rename = "RESOLVE_ARTIFACT_CRYSTAL_COLOR")]
    ResolveArtifactCrystalColor { color: BasicManaColor },

    // =========================================================================
    // Combat
    // =========================================================================
    #[serde(rename = "ENTER_COMBAT")]
    EnterCombat {
        #[serde(rename = "enemyIds")]
        enemy_ids: Vec<EnemyId>,
        #[serde(rename = "isAtFortifiedSite", skip_serializing_if = "Option::is_none")]
        is_at_fortified_site: Option<bool>,
    },

    #[serde(rename = "CHALLENGE_RAMPAGING")]
    ChallengeRampaging {
        #[serde(rename = "targetHex")]
        target_hex: HexCoord,
    },

    #[serde(rename = "END_COMBAT_PHASE")]
    EndCombatPhase,

    #[serde(rename = "DECLARE_BLOCK")]
    DeclareBlock {
        #[serde(rename = "targetEnemyInstanceId")]
        target_enemy_instance_id: String,
        #[serde(rename = "attackIndex", skip_serializing_if = "Option::is_none")]
        attack_index: Option<u32>,
    },

    #[serde(rename = "DECLARE_ATTACK")]
    DeclareAttack {
        #[serde(rename = "targetEnemyInstanceIds")]
        target_enemy_instance_ids: Vec<String>,
        attacks: Vec<AttackSource>,
        #[serde(rename = "attackType")]
        attack_type: CombatType,
    },

    #[serde(rename = "ASSIGN_DAMAGE")]
    AssignDamage {
        #[serde(rename = "enemyInstanceId")]
        enemy_instance_id: String,
        #[serde(rename = "attackIndex", skip_serializing_if = "Option::is_none")]
        attack_index: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        assignments: Option<Vec<DamageAssignment>>,
    },

    // Incremental attack assignment
    #[serde(rename = "ASSIGN_ATTACK")]
    AssignAttack {
        #[serde(rename = "enemyInstanceId")]
        enemy_instance_id: String,
        #[serde(rename = "attackType")]
        attack_type: AttackType,
        element: AttackElement,
        amount: u32,
    },

    #[serde(rename = "UNASSIGN_ATTACK")]
    UnassignAttack {
        #[serde(rename = "enemyInstanceId")]
        enemy_instance_id: String,
        #[serde(rename = "attackType")]
        attack_type: AttackType,
        element: AttackElement,
        amount: u32,
    },

    // Incremental block assignment
    #[serde(rename = "ASSIGN_BLOCK")]
    AssignBlock {
        #[serde(rename = "enemyInstanceId")]
        enemy_instance_id: String,
        element: AttackElement,
        amount: u32,
    },

    #[serde(rename = "UNASSIGN_BLOCK")]
    UnassignBlock {
        #[serde(rename = "enemyInstanceId")]
        enemy_instance_id: String,
        element: AttackElement,
        amount: u32,
    },

    // Target-first attack flow
    #[serde(rename = "DECLARE_ATTACK_TARGETS")]
    DeclareAttackTargets {
        #[serde(rename = "targetEnemyInstanceIds")]
        target_enemy_instance_ids: Vec<String>,
    },

    #[serde(rename = "FINALIZE_ATTACK")]
    FinalizeAttack,

    // Target-first block flow
    #[serde(rename = "DECLARE_BLOCK_TARGET")]
    DeclareBlockTarget {
        #[serde(rename = "targetEnemyInstanceId")]
        target_enemy_instance_id: String,
        #[serde(rename = "attackIndex", skip_serializing_if = "Option::is_none")]
        attack_index: Option<u32>,
    },

    #[serde(rename = "FINALIZE_BLOCK")]
    FinalizeBlock,

    // Cumbersome
    #[serde(rename = "SPEND_MOVE_ON_CUMBERSOME")]
    SpendMoveOnCumbersome {
        #[serde(rename = "enemyInstanceId")]
        enemy_instance_id: String,
        #[serde(rename = "movePointsToSpend")]
        move_points_to_spend: u32,
    },

    // Move-to-attack conversion (Agility)
    #[serde(rename = "CONVERT_MOVE_TO_ATTACK")]
    ConvertMoveToAttack {
        #[serde(rename = "movePointsToSpend")]
        move_points_to_spend: u32,
        #[serde(rename = "conversionType")]
        conversion_type: MoveToAttackConversionType,
    },

    // Influence-to-block conversion (Diplomacy)
    #[serde(rename = "CONVERT_INFLUENCE_TO_BLOCK")]
    ConvertInfluenceToBlock {
        #[serde(rename = "influencePointsToSpend")]
        influence_points_to_spend: u32,
    },

    // =========================================================================
    // Cooperative assault
    // =========================================================================
    #[serde(rename = "PROPOSE_COOPERATIVE_ASSAULT")]
    ProposeCooperativeAssault {
        #[serde(rename = "targetCity")]
        target_city: CityColor,
        #[serde(rename = "invitedPlayerIds")]
        invited_player_ids: Vec<String>,
        distribution: Vec<EnemyDistribution>,
    },

    #[serde(rename = "RESPOND_TO_COOPERATIVE_PROPOSAL")]
    RespondToCooperativeProposal { response: CooperativeResponse },

    #[serde(rename = "CANCEL_COOPERATIVE_PROPOSAL")]
    CancelCooperativeProposal,

    // =========================================================================
    // Debug (dev-only)
    // =========================================================================
    #[serde(rename = "DEBUG_ADD_FAME")]
    DebugAddFame { amount: i32 },

    #[serde(rename = "DEBUG_TRIGGER_LEVEL_UP")]
    DebugTriggerLevelUp,
}

impl PlayerAction {
    /// Returns the string discriminant matching the TS `type` field.
    pub fn action_type(&self) -> &'static str {
        match self {
            Self::Move { .. } => "MOVE",
            Self::Explore { .. } => "EXPLORE",
            Self::EnterSite => "ENTER_SITE",
            Self::AltarTribute { .. } => "ALTAR_TRIBUTE",
            Self::BurnMonastery => "BURN_MONASTERY",
            Self::PlunderVillage => "PLUNDER_VILLAGE",
            Self::DeclinePlunder => "DECLINE_PLUNDER",
            Self::EndTurn => "END_TURN",
            Self::Rest { .. } => "REST",
            Self::DeclareRest => "DECLARE_REST",
            Self::CompleteRest { .. } => "COMPLETE_REST",
            Self::Interact { .. } => "INTERACT",
            Self::AnnounceEndOfRound => "ANNOUNCE_END_OF_ROUND",
            Self::PlayCard { .. } => "PLAY_CARD",
            Self::PlayCardSideways { .. } => "PLAY_CARD_SIDEWAYS",
            Self::ActivateUnit { .. } => "ACTIVATE_UNIT",
            Self::UseSkill { .. } => "USE_SKILL",
            Self::ReturnInteractiveSkill { .. } => "RETURN_INTERACTIVE_SKILL",
            Self::RecruitUnit { .. } => "RECRUIT_UNIT",
            Self::DisbandUnit { .. } => "DISBAND_UNIT",
            Self::AssignBanner { .. } => "ASSIGN_BANNER",
            Self::UseBannerFear { .. } => "USE_BANNER_FEAR",
            Self::PayHeroesAssaultInfluence => "PAY_HEROES_ASSAULT_INFLUENCE",
            Self::PayThugsDamageInfluence { .. } => "PAY_THUGS_DAMAGE_INFLUENCE",
            Self::BuySpell { .. } => "BUY_SPELL",
            Self::LearnAdvancedAction { .. } => "LEARN_ADVANCED_ACTION",
            Self::BuyHealing { .. } => "BUY_HEALING",
            Self::SelectTactic { .. } => "SELECT_TACTIC",
            Self::ActivateTactic { .. } => "ACTIVATE_TACTIC",
            Self::ResolveTacticDecision { .. } => "RESOLVE_TACTIC_DECISION",
            Self::RerollSourceDice { .. } => "REROLL_SOURCE_DICE",
            Self::Undo => "UNDO",
            Self::ResolveChoice { .. } => "RESOLVE_CHOICE",
            Self::ResolveHexCostReduction { .. } => "RESOLVE_HEX_COST_REDUCTION",
            Self::ResolveTerrainCostReduction { .. } => "RESOLVE_TERRAIN_COST_REDUCTION",
            Self::ChooseLevelUpRewards { .. } => "CHOOSE_LEVEL_UP_REWARDS",
            Self::SelectReward { .. } => "SELECT_REWARD",
            Self::ResolveGladeWound { .. } => "RESOLVE_GLADE_WOUND",
            Self::ResolveUnitMaintenance { .. } => "RESOLVE_UNIT_MAINTENANCE",
            Self::ResolveDeepMine { .. } => "RESOLVE_DEEP_MINE",
            Self::ResolveCrystalJoyReclaim { .. } => "RESOLVE_CRYSTAL_JOY_RECLAIM",
            Self::ResolveSteadyTempo { .. } => "RESOLVE_STEADY_TEMPO",
            Self::ResolveBannerProtection { .. } => "RESOLVE_BANNER_PROTECTION",
            Self::ResolveSourceOpeningReroll { .. } => "RESOLVE_SOURCE_OPENING_REROLL",
            Self::ResolveDiscard { .. } => "RESOLVE_DISCARD",
            Self::ResolveDiscardForAttack { .. } => "RESOLVE_DISCARD_FOR_ATTACK",
            Self::ResolveDiscardForBonus { .. } => "RESOLVE_DISCARD_FOR_BONUS",
            Self::ResolveDiscardForCrystal { .. } => "RESOLVE_DISCARD_FOR_CRYSTAL",
            Self::ResolveMeditation { .. } => "RESOLVE_MEDITATION",
            Self::ResolveDecompose { .. } => "RESOLVE_DECOMPOSE",
            Self::ResolveMaximalEffect { .. } => "RESOLVE_MAXIMAL_EFFECT",
            Self::ResolveBookOfWisdom { .. } => "RESOLVE_BOOK_OF_WISDOM",
            Self::ResolveTraining { .. } => "RESOLVE_TRAINING",
            Self::ResolveArtifactCrystalColor { .. } => "RESOLVE_ARTIFACT_CRYSTAL_COLOR",
            Self::EnterCombat { .. } => "ENTER_COMBAT",
            Self::ChallengeRampaging { .. } => "CHALLENGE_RAMPAGING",
            Self::EndCombatPhase => "END_COMBAT_PHASE",
            Self::DeclareBlock { .. } => "DECLARE_BLOCK",
            Self::DeclareAttack { .. } => "DECLARE_ATTACK",
            Self::AssignDamage { .. } => "ASSIGN_DAMAGE",
            Self::AssignAttack { .. } => "ASSIGN_ATTACK",
            Self::UnassignAttack { .. } => "UNASSIGN_ATTACK",
            Self::AssignBlock { .. } => "ASSIGN_BLOCK",
            Self::UnassignBlock { .. } => "UNASSIGN_BLOCK",
            Self::DeclareAttackTargets { .. } => "DECLARE_ATTACK_TARGETS",
            Self::FinalizeAttack => "FINALIZE_ATTACK",
            Self::DeclareBlockTarget { .. } => "DECLARE_BLOCK_TARGET",
            Self::FinalizeBlock => "FINALIZE_BLOCK",
            Self::SpendMoveOnCumbersome { .. } => "SPEND_MOVE_ON_CUMBERSOME",
            Self::ConvertMoveToAttack { .. } => "CONVERT_MOVE_TO_ATTACK",
            Self::ConvertInfluenceToBlock { .. } => "CONVERT_INFLUENCE_TO_BLOCK",
            Self::ProposeCooperativeAssault { .. } => "PROPOSE_COOPERATIVE_ASSAULT",
            Self::RespondToCooperativeProposal { .. } => "RESPOND_TO_COOPERATIVE_PROPOSAL",
            Self::CancelCooperativeProposal => "CANCEL_COOPERATIVE_PROPOSAL",
            Self::DebugAddFame { .. } => "DEBUG_ADD_FAME",
            Self::DebugTriggerLevelUp => "DEBUG_TRIGGER_LEVEL_UP",
        }
    }
}
