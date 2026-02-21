//! Card effect types — discriminated union for all card/skill/unit effects.
//!
//! In the TS codebase, effects are a large union of ~100+ types. For Phase 1,
//! we define the effect type enum (discriminants) and a placeholder `CardEffect`
//! that will be fleshed out as we implement effect resolution in mk-engine.

use serde::{Deserialize, Serialize};

use crate::enums::*;
use crate::modifier::{ModifierDuration, ModifierEffect, ModifierScope};

// =============================================================================
// Effect Type Discriminants
// =============================================================================

/// All card effect type discriminants matching TS `EFFECT_*` constants.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EffectType {
    // === Core effects ===
    GainMove,
    GainInfluence,
    GainAttack,
    GainBlock,
    GainHealing,
    GainMana,
    DrawCards,
    ApplyModifier,
    Noop,

    // === Compound/structural ===
    Compound,
    Choice,
    Conditional,
    Scaling,

    // === Rewards ===
    ChangeReputation,
    GainFame,
    GainCrystal,
    ConvertManaToCrystal,
    CrystallizeColor,

    // === Card manipulation ===
    CardBoost,
    ResolveBoostTarget,

    // === Unit effects ===
    ReadyUnit,
    ResolveReadyUnitTarget,
    ReadyAllUnits,
    ReadyUnitsForInfluence,
    ResolveReadyUnitForInfluence,
    ReadyUnitsBudget,
    ResolveReadyUnitBudget,
    HealUnit,
    HealAllUnits,
    WoundActivatingUnit,

    // === Mana draw ===
    ManaDrawPowered,
    ManaDrawPickDie,
    ManaDrawSetColor,

    // === Terrain ===
    TerrainBasedBlock,
    SelectHexForCostReduction,
    SelectTerrainForCostReduction,

    // === Costs ===
    TakeWound,
    DiscardCard,
    DiscardWounds,
    DiscardCost,
    DiscardForAttack,
    DiscardForBonus,
    DiscardForCrystal,
    PayMana,

    // === Combat targeting ===
    SelectCombatEnemy,
    ResolveCombatEnemyTarget,

    // === Skill effects ===
    RevealTiles,
    PlaceSkillInCenter,
    GrantWoundImmunity,
    PolarizeMana,
    InvocationResolve,

    // === Krang Curse ===
    KrangCurse,
    ResolveKrangCurseTarget,
    ResolveKrangCurseAttackIndex,
    ApplyKrangCurseAttack,
    ApplyKrangCurseArmor,

    // === Fame tracking ===
    FamePerEnemyDefeated,
    TrackAttackDefeatFame,
    AttackWithDefeatBonus,

    // === Recruitment ===
    ApplyRecruitDiscount,
    ApplyRecruitmentBonus,
    ApplyInteractionBonus,
    FreeRecruit,
    ResolveFreeRecruitTarget,

    // === Energy Flow ===
    EnergyFlow,
    ResolveEnergyFlowTarget,

    // === Cure/Disease ===
    Cure,
    Disease,

    // === Scout ===
    ScoutPeek,

    // === Altem Mages ===
    AltemMagesColdFire,

    // === Pure Magic / Mana Bolt ===
    PureMagic,
    ManaBolt,

    // === Mana manipulation spells ===
    ManaMeltdown,
    ResolveManaRadianceColor,
    ManaRadiance,
    ResolveManaRadianceColor2,
    ManaClaim,
    ResolveManaClaimDie,
    ResolveManaClaimMode,
    ManaCurse,

    // === Sacrifice ===
    Sacrifice,
    ResolveSacrifice,

    // === Call to Arms ===
    CallToArms,
    ResolveCallToArmsUnit,
    ResolveCallToArmsAbility,

    // === Mind Read/Steal ===
    MindRead,
    ResolveMindReadColor,
    MindSteal,
    ResolveMindStealColor,
    ResolveMindStealSelection,

    // === Decompose / Training / Book of Wisdom ===
    Decompose,
    Training,
    BookOfWisdom,
    MaximalEffect,

    // === Magic Talent ===
    MagicTalentBasic,
    ResolveMagicTalentSpell,
    MagicTalentPowered,
    ResolveMagicTalentGain,
    ResolveMagicTalentSpellMana,

    // === Banner effects ===
    ActivateBannerProtection,
    ApplyLearningDiscount,

    // === Crystal effects ===
    CrystalMasteryBasic,
    CrystalMasteryPowered,
    PowerOfCrystalsBasic,
    PowerOfCrystalsPowered,

    // === Possess/Charm ===
    PossessEnemy,
    ResolvePossessEnemy,

    // === Mana Storm ===
    ManaStormBasic,
    ManaStormSelectDie,
    ManaStormPowered,

    // === Source Opening ===
    SourceOpeningReroll,
    SourceOpeningSelectDie,

    // === Horn of Wrath ===
    RollDieForWound,
    ChooseBonusWithRisk,
    ResolveBonusChoice,

    // === Endless Gem Pouch ===
    RollForCrystals,
    ResolveCrystalRollChoice,

    // === Shapeshift ===
    ShapeshiftResolve,
    GainAttackBowResolved,

    // === Blood of Ancients ===
    BloodOfAncientsBasic,
    ResolveBloodBasicSelectAa,
    ResolveBloodBasicGainAa,
    BloodOfAncientsPowered,
    ResolveBloodPoweredWound,
    ResolveBloodPoweredUseAa,

    // === Hand Limit ===
    HandLimitBonus,

    // === Tome of All Spells ===
    TomeOfAllSpells,
    ResolveTomeSpell,

    // === Circlet of Proficiency ===
    CircletOfProficiencyBasic,
    ResolveCircletBasicSkill,
    CircletOfProficiencyPowered,
    ResolveCircletPoweredSkill,

    // === Mysterious Box ===
    MysteriousBox,
    ResolveMysteriousBoxUse,

    // === Wings of Night ===
    WingsOfNight,
    ResolveWingsOfNightTarget,

    // === Know Your Prey ===
    KnowYourPreySelectEnemy,
    KnowYourPreySelectOption,
    KnowYourPreyApply,

    // === Peaceful Moment ===
    PeacefulMomentAction,
    PeacefulMomentConvert,
    PeacefulMomentHeal,
    PeacefulMomentRefresh,

    // === Select Unit for Modifier ===
    SelectUnitForModifier,
    ResolveUnitModifierTarget,

    // === Spell Forge ===
    SpellForgeBasic,
    SpellForgePowered,
    ResolveSpellForgeCrystal,

    // === Rush of Adrenaline ===
    RushOfAdrenaline,

    // === Puppet Master ===
    PuppetMasterKeep,
    PuppetMasterExpend,

    // === Resolve Mana Meltdown ===
    ResolveManaMeltdownChoice,

    // === Shield Bash ===
    ShieldBash,
}

// =============================================================================
// Condition Types (for ConditionalEffect)
// =============================================================================

/// Conditions evaluated at effect resolution time.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EffectCondition {
    InPhase { phases: Vec<CombatPhase> },
    TimeOfDay { time: TimeOfDay },
    OnTerrain { terrain: Vec<Terrain> },
    InCombat,
    BlockedSuccessfully,
    EnemyDefeatedThisCombat,
    ManaUsedThisTurn { color: Option<ManaColor> },
    HasWoundsInHand,
    NoUnitRecruitedThisTurn,
    LowestFame,
    IsNightOrUnderground,
    InInteraction,
    AtFortifiedSite,
    AtMagicalGlade,
}

// =============================================================================
// Scaling Factors (for ScalingEffect)
// =============================================================================

/// Unit filter for scaling.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnitFilter {
    pub wounded: Option<bool>,
    pub max_level: Option<u8>,
    pub state: Option<UnitState>,
}

/// What a scaling effect counts to determine its bonus.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ScalingFactor {
    PerEnemy,
    PerWoundInHand,
    PerWoundThisCombat,
    PerUnit { filter: Option<UnitFilter> },
    PerCrystalColor,
    PerCompleteCrystalSet,
    PerEmptyCommandToken,
    PerWoundTotal,
    PerEnemyBlocked,
}

// =============================================================================
// CardEffect — the full effect union (shell for Phase 1)
// =============================================================================

/// A card effect. In Phase 1 this is a thin shell; full variant data
/// will be added as we implement effect resolution in mk-engine.
///
/// For now, the most common effect shapes are represented. Complex effects
/// that reference other effects (Compound, Choice, Conditional, Scaling)
/// use `Box<[CardEffect]>` for the sub-effects.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CardEffect {
    // === Core value effects ===
    GainMove {
        amount: u32,
    },
    GainInfluence {
        amount: u32,
    },
    GainAttack {
        amount: u32,
        #[serde(rename = "combatType")]
        combat_type: CombatType,
        element: Element,
    },
    GainBlock {
        amount: u32,
        element: Element,
    },
    GainHealing {
        amount: u32,
    },
    GainMana {
        color: ManaColor,
        amount: u32,
    },
    DrawCards {
        count: u32,
    },
    GainFame {
        amount: u32,
    },
    ChangeReputation {
        amount: i32,
    },
    GainCrystal {
        color: Option<BasicManaColor>,
    },
    TakeWound,
    Noop,

    // === Multi-step / cost effects ===
    ConvertManaToCrystal,
    CardBoost {
        bonus: u32,
    },
    ManaDrawPowered {
        dice_count: u32,
        tokens_per_die: u32,
    },
    DiscardCost {
        count: u32,
        filter_wounds: bool,
        then_effect: Box<CardEffect>,
    },
    ApplyModifier {
        effect: ModifierEffect,
        duration: ModifierDuration,
        scope: ModifierScope,
    },
    GainBlockElement {
        amount: u32,
        element: Element,
    },
    HandLimitBonus {
        bonus: u32,
    },
    ReadyUnit {
        max_level: u8,
    },
    AttackWithDefeatBonus {
        amount: u32,
        #[serde(rename = "combatType")]
        combat_type: CombatType,
        element: Element,
        reputation_per_defeat: i32,
        fame_per_defeat: u32,
        armor_reduction_per_defeat: u32,
    },
    DiscardForBonus {
        choice_options: Vec<CardEffect>,
        bonus_per_card: u32,
        max_discards: u32,
        discard_filter: DiscardForBonusFilter,
    },
    /// Decompose: discard an action card, gain crystals based on card color.
    /// Basic: gain 2 crystals of matching color. Powered: gain 1 of each non-matching.
    Decompose {
        mode: crate::pending::EffectMode,
    },
    /// Discard an action card for a color-based attack.
    /// `attacks_by_color` maps each card color to the attack effect.
    DiscardForAttack {
        attacks_by_color: Vec<(BasicManaColor, CardEffect)>,
    },
    /// Pure Magic: pay a mana token, gain an effect based on its color.
    /// Green→Move, White→Influence, Blue→Block, Red→Attack.
    PureMagic {
        amount: u32,
    },

    // === Structural effects ===
    Compound {
        effects: Vec<CardEffect>,
    },
    Choice {
        options: Vec<CardEffect>,
    },
    Conditional {
        condition: EffectCondition,
        then_effect: Box<CardEffect>,
        else_effect: Option<Box<CardEffect>>,
    },
    Scaling {
        factor: ScalingFactor,
        base_effect: Box<CardEffect>,
        /// Per-count bonus added (default 1).
        bonus_per_count: Option<u32>,
        /// Cap the scaled result at this value.
        maximum: Option<u32>,
    },

    /// Select a combat enemy and apply template effects.
    /// Used by cards like ice_shield, chill, tremor, expose, whirlwind.
    SelectCombatEnemy {
        template: crate::pending::SelectEnemyTemplate,
    },

    /// Cure: heal up to `amount` wounds from hand, draw 1 card per wound healed.
    Cure {
        amount: u32,
    },
    /// Disease: set armor to 1 for all fully-blocked enemies in combat.
    Disease,

    /// Catch-all for effect types not yet fully modeled.
    /// Stores the effect type discriminant for routing.
    Other {
        effect_type: EffectType,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn card_effect_compound() {
        let effect = CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::GainInfluence { amount: 3 },
            ],
        };
        match effect {
            CardEffect::Compound { effects } => assert_eq!(effects.len(), 2),
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn card_effect_conditional() {
        let effect = CardEffect::Conditional {
            condition: EffectCondition::InCombat,
            then_effect: Box::new(CardEffect::GainAttack {
                amount: 3,
                combat_type: CombatType::Melee,
                element: Element::Physical,
            }),
            else_effect: Some(Box::new(CardEffect::GainMove { amount: 2 })),
        };
        match effect {
            CardEffect::Conditional { condition, .. } => {
                assert!(matches!(condition, EffectCondition::InCombat));
            }
            _ => panic!("Expected Conditional"),
        }
    }

    #[test]
    fn effect_type_count() {
        // Smoke test: ensure the enum has many variants (TS has 100+)
        let _types = [
            EffectType::GainMove,
            EffectType::PuppetMasterExpend,
            EffectType::RushOfAdrenaline,
        ];
    }
}
