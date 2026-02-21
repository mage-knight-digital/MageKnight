//! Modifier system types — skills, cards, and units can modify game rules
//! and values for various durations.

use serde::{Deserialize, Serialize};

use crate::enums::*;
use crate::ids::*;

// =============================================================================
// Duration
// =============================================================================

/// How long a modifier lasts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModifierDuration {
    Turn,
    Combat,
    Round,
    UntilNextTurn,
    Permanent,
}

// =============================================================================
// Scope
// =============================================================================

/// What a modifier applies to.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ModifierScope {
    #[serde(rename = "self")]
    SelfScope,
    OneEnemy {
        enemy_id: String,
    },
    AllEnemies,
    OneUnit {
        unit_index: u32,
    },
    AllUnits,
    OtherPlayers,
    AllPlayers,
}

// =============================================================================
// Source
// =============================================================================

/// What created a modifier.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ModifierSource {
    Skill {
        skill_id: SkillId,
        player_id: PlayerId,
    },
    Card {
        card_id: CardId,
        player_id: PlayerId,
    },
    Unit {
        unit_index: u32,
        player_id: PlayerId,
    },
    Site {
        site_type: String,
    },
    Tactic {
        tactic_id: TacticId,
        player_id: PlayerId,
    },
}

// =============================================================================
// Modifier Effect Variants
// =============================================================================

/// Combat value type for CombatValueModifier.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CombatValueType {
    Attack,
    Block,
    Ranged,
    Siege,
}

/// Enemy stat type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EnemyStat {
    Armor,
    Attack,
}

/// Rule override identifiers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuleOverride {
    IgnoreFortification,
    IgnoreReputation,
    IgnoreRampagingProvoke,
    WoundsPlayableSideways,
    GoldAsBlack,
    BlackAsGold,
    BlackAsAnyColor,
    GoldAsAnyColor,
    TerrainDayNightSwap,
    SourceBlocked,
    ExtraSourceDie,
    MoveCardsInCombat,
    InfluenceCardsInCombat,
    ExtendedExplore,
    UnitsCannotAbsorbDamage,
    SpaceBendingAdjacency,
    TimeBendingActive,
    NoExploration,
    AllowGoldAtNight,
    AllowBlackAtDay,
    GarrisonRevealDistance2,
}

/// Shapeshift target type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ShapeshiftTarget {
    Move,
    Attack,
    Block,
}

/// Leadership bonus type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LeadershipBonusType {
    Block,
    Attack,
    RangedAttack,
}

/// Sideways value condition.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SidewaysCondition {
    NoManaUsed,
    WithManaMatchingColor,
}

/// Union of all modifier effects.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ModifierEffect {
    TerrainCost {
        terrain: TerrainOrAll,
        amount: i32,
        minimum: u32,
        replace_cost: Option<u32>,
    },
    TerrainSafe {
        terrain: TerrainOrAll,
    },
    SidewaysValue {
        new_value: u32,
        for_wounds: bool,
        condition: Option<SidewaysCondition>,
        mana_color: Option<BasicManaColor>,
        /// Empty = all card types match. Non-empty = only listed types match.
        #[serde(default)]
        for_card_types: Vec<DeedCardType>,
    },
    MovementCardBonus {
        amount: i32,
        remaining: Option<u32>,
    },
    CombatValue {
        value_type: CombatValueType,
        element: Option<Element>,
        amount: i32,
    },
    EnemyStat {
        stat: EnemyStat,
        amount: i32,
        minimum: u32,
        attack_index: Option<u32>,
        per_resistance: bool,
        fortified_amount: Option<i32>,
    },
    RuleOverride {
        rule: RuleOverride,
    },
    AbilityNullifier {
        ability: Option<EnemyAbilityType>,
        ignore_arcane_immunity: bool,
    },
    EnemySkipAttack,
    RemoveResistances,
    RemovePhysicalResistance,
    RemoveFireResistance,
    RemoveIceResistance,
    EndlessMana {
        colors: Vec<ManaColor>,
    },
    TerrainProhibition {
        prohibited_terrains: Vec<Terrain>,
    },
    GrantResistances {
        resistances: Vec<ResistanceElement>,
    },
    DoublePhysicalAttacks,
    ColdToughnessBlock,
    RecruitDiscount {
        discount: u32,
        reputation_change: i32,
    },
    MoveToAttackConversion {
        cost_per_point: u32,
        attack_type: CombatValueType,
    },
    InfluenceToBlockConversion {
        cost_per_point: u32,
        element: Option<Element>,
    },
    ScoutFameBonus {
        revealed_enemy_ids: Vec<String>,
        fame: u32,
    },
    UnitAttackBonus {
        amount: i32,
    },
    DiseaseArmor {
        set_to: u32,
    },
    CureActive,
    TransformAttacksColdFire,
    AddSiegeToAttacks,
    BurningShieldActive {
        mode: BurningShieldMode,
        block_value: u32,
        attack_value: u32,
    },
    RecruitmentBonus {
        reputation_per_recruit: i32,
        fame_per_recruit: u32,
    },
    InteractionBonus {
        fame: u32,
        reputation: i32,
    },
    ManaClaimSustained {
        color: BasicManaColor,
        claimed_die_id: SourceDieId,
    },
    ManaCurse {
        color: BasicManaColor,
        claimed_die_id: SourceDieId,
        wounded_player_ids_this_turn: Vec<PlayerId>,
    },
    DefeatIfBlocked,
    UnitCombatBonus {
        attack_bonus: i32,
        block_bonus: i32,
    },
    LeadershipBonus {
        bonus_type: LeadershipBonusType,
        amount: i32,
    },
    UnitArmorBonus {
        amount: i32,
    },
    UnitBlockBonus {
        amount: i32,
    },
    BannerGloryFameTracking {
        unit_instance_ids_awarded: Vec<UnitInstanceId>,
    },
    PossessAttackRestriction {
        possessed_enemy_id: String,
        attack_amount: u32,
    },
    AttackBlockCardBonus {
        attack_bonus: i32,
        block_bonus: i32,
        ranged_siege_attack_bonus: Option<i32>,
    },
    HeroDamageReduction {
        amount: i32,
        elements: Vec<Element>,
    },
    ExploreCostReduction {
        amount: i32,
    },
    GoldenGrailFameTracking {
        remaining_healing_points: u32,
    },
    GoldenGrailDrawOnHeal,
    LearningDiscount {
        cost: u32,
        destination: LearningDestination,
    },
    ShapeshiftActive {
        target_card_id: CardId,
        target_type: ShapeshiftTarget,
        choice_index: Option<u32>,
        combat_type: Option<CombatType>,
        element: Option<Element>,
    },
    GrantEnemyAbility {
        ability: EnemyAbilityType,
    },
    NaturesVengeanceAttackBonus {
        amount: i32,
    },
    BowPhaseFameTracking {
        fame_per_enemy: u32,
    },
    BowAttackTransformation,
    SoulHarvesterCrystalTracking {
        limit: u32,
        track_by_attack: bool,
    },
    ShieldBashArmorReduction,
    ConvertAttackElement {
        from_element: Element,
        to_element: Element,
    },
    DodgeAndWeaveAttackBonus {
        amount: i32,
    },
    DuelingTarget {
        enemy_instance_id: String,
        attack_applied: bool,
        unit_involved: bool,
    },
    MountainLoreHandLimit {
        hills_bonus: u32,
        mountain_bonus: u32,
    },
    RushOfAdrenalineActive {
        mode: RushOfAdrenalineMode,
        remaining_draws: u32,
        thrown_first_wound: bool,
    },
}

/// Burning Shield mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BurningShieldMode {
    Attack,
    Destroy,
}

/// Learning discount destination.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LearningDestination {
    Hand,
    Discard,
}

/// Rush of Adrenaline mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RushOfAdrenalineMode {
    Basic,
    Powered,
}

/// Terrain or "all" sentinel.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TerrainOrAll {
    Specific(Terrain),
    #[serde(rename = "all")]
    All,
}

// =============================================================================
// ActiveModifier — lives in game state
// =============================================================================

/// A modifier that is currently active in the game.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveModifier {
    pub id: ModifierId,
    pub source: ModifierSource,
    pub duration: ModifierDuration,
    pub scope: ModifierScope,
    pub effect: ModifierEffect,
    pub created_at_round: u32,
    pub created_by_player_id: PlayerId,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn modifier_duration_variants() {
        let durations = [
            ModifierDuration::Turn,
            ModifierDuration::Combat,
            ModifierDuration::Round,
            ModifierDuration::UntilNextTurn,
            ModifierDuration::Permanent,
        ];
        assert_eq!(durations.len(), 5);
    }

    #[test]
    fn rule_override_variants() {
        // Ensure we have all 21 rule overrides from TS
        let rules = [
            RuleOverride::IgnoreFortification,
            RuleOverride::IgnoreReputation,
            RuleOverride::IgnoreRampagingProvoke,
            RuleOverride::WoundsPlayableSideways,
            RuleOverride::GoldAsBlack,
            RuleOverride::BlackAsGold,
            RuleOverride::BlackAsAnyColor,
            RuleOverride::GoldAsAnyColor,
            RuleOverride::TerrainDayNightSwap,
            RuleOverride::SourceBlocked,
            RuleOverride::ExtraSourceDie,
            RuleOverride::MoveCardsInCombat,
            RuleOverride::InfluenceCardsInCombat,
            RuleOverride::ExtendedExplore,
            RuleOverride::UnitsCannotAbsorbDamage,
            RuleOverride::SpaceBendingAdjacency,
            RuleOverride::TimeBendingActive,
            RuleOverride::NoExploration,
            RuleOverride::AllowGoldAtNight,
            RuleOverride::AllowBlackAtDay,
            RuleOverride::GarrisonRevealDistance2,
        ];
        assert_eq!(rules.len(), 21);
    }
}
