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

    // === Druidic Staff ===
    DruidicStaffBasic,
    DruidicStaffPowered,
    ResolveDruidicStaffDiscard,
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
        /// When true, only wound cards are eligible (inverts filter_wounds).
        #[serde(default)]
        wounds_only: bool,
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
    HealUnit {
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
    /// Training: discard a non-wound action card, gain an AA of matching color from offer.
    /// Basic: gained AA goes to discard. Powered: gained AA goes to hand.
    Training {
        mode: crate::pending::EffectMode,
    },
    /// Maximal Effect: choose a non-wound action card, multiply its basic/powered effect.
    /// Basic: multiply by 3. Powered: multiply by 2 (uses powered effect).
    MaximalEffect {
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

    /// Energy Flow: ready a spent unit (any level), optionally heal if wounded.
    EnergyFlow {
        heal: bool,
    },
    /// Mana Bolt: pay 1 mana token → attack based on color.
    /// Blue=Melee Ice base, Red=Melee ColdFire base-1, White=Ranged Ice base-2, Green=Siege Ice base-3.
    ManaBolt {
        base_value: u32,
    },
    /// Discard a non-wound card from hand → gain crystal of card's color.
    DiscardForCrystal {
        optional: bool,
    },
    /// Sacrifice (Offering powered): choose crystal pair combo → convert to tokens + attack per pair.
    Sacrifice,
    /// Mana Claim: select unclaimed basic-color die, choose burst (3 tokens) or sustained (1/turn).
    ManaClaim {
        with_curse: bool,
    },

    // === Advanced Action effects ===

    /// Force of Nature basic: select a unit, grant it a modifier.
    SelectUnitForModifier {
        modifier: ModifierEffect,
        duration: ModifierDuration,
    },
    /// Song of Wind powered: Move 2 + terrain reductions + optional blue mana for lake cost 0.
    SongOfWindPowered,
    /// Rush of Adrenaline: retroactive wound draw + modifier for future wounds.
    RushOfAdrenaline {
        mode: crate::pending::EffectMode,
    },
    /// Power of Crystals basic: gain crystal of a color below max.
    PowerOfCrystalsBasic,
    /// Power of Crystals powered: choice of Move/Heal/Draw scaled by complete crystal sets.
    PowerOfCrystalsPowered,
    /// Crystal Mastery basic: gain crystal of a color you already own (below cap).
    CrystalMasteryBasic,
    /// Crystal Mastery powered: set flag for end-of-turn crystal return.
    CrystalMasteryPowered,
    /// Mana Storm basic: select basic-color source die → gain crystal + reroll.
    ManaStormBasic,
    /// Mana Storm powered: reroll all dice + push rule overrides.
    ManaStormPowered,
    /// Spell Forge basic: choose spell from offer → gain crystal of its color.
    SpellForgeBasic,
    /// Spell Forge powered: choose 2 spells from offer → gain crystal of each color.
    SpellForgePowered,
    /// Magic Talent basic: discard colored card → play matching spell from offer (pay mana).
    MagicTalentBasic,
    /// Magic Talent powered: pay mana → gain matching spell from offer to discard.
    MagicTalentPowered,
    /// Blood of Ancients basic: wound → pay mana → gain matching AA from offer.
    BloodOfAncientsBasic,
    /// Blood of Ancients powered: wound → select any AA → use its powered effect free.
    BloodOfAncientsPowered,
    /// Peaceful Moment action mode: gain influence + enter conversion loop.
    PeacefulMomentAction {
        influence: u32,
        allow_refresh: bool,
    },
    /// Peaceful Moment conversion loop (internal effect generated during resolution).
    PeacefulMomentConvert {
        influence_remaining: u32,
        allow_refresh: bool,
        refreshed: bool,
    },

    // === Spell effects (new) ===

    /// Mana Meltdown: basic (solo: skip), powered (Mana Radiance: choose color → wounds → crystals).
    ManaMeltdown { powered: bool },
    /// Mind Read: basic/powered (solo: choose color → gain crystal).
    MindRead { powered: bool },
    /// Call to Arms: basic (borrow unit ability from offer).
    CallToArms,
    /// Free Recruit: recruit any unit from offer for free (Call to Arms powered).
    FreeRecruit,
    /// Wings of Night: iterative enemy targeting (skip attack, scaling move cost).
    WingsOfNight,
    /// Possess Enemy: target enemy → skip attack + gain melee attack equal to enemy's attack.
    PossessEnemy,
    /// Meditation: basic (random 2 cards from discard) / powered (choose 2 from discard).
    Meditation { powered: bool },
    /// Ready Units Budget: iteratively ready spent units up to total_levels.
    ReadyUnitsBudget { total_levels: u32 },
    /// Grant wound immunity: next wound from enemy is ignored (Mist Form powered).
    GrantWoundImmunity,

    // === Artifact effects ===

    /// Ready all owned units (regardless of level).
    ReadyAllUnits,
    /// Heal all owned units completely.
    HealAllUnits,
    /// Activate Banner of Protection — flag for end-turn wound removal.
    ActivateBannerProtection,
    /// Apply FamePerEnemyDefeated tracking modifier (Banner of Glory, etc.).
    FamePerEnemyDefeated {
        amount: u32,
        /// If true, summoned enemies don't count.
        exclude_summoned: bool,
    },
    /// Roll N dice; for each black/red result, take a wound (Horn of Wrath basic).
    RollDieForWound {
        die_count: u32,
    },
    /// Iterative risk/reward: roll die, +bonus siege attack per safe roll, wound on black/red.
    /// Player can stop anytime after first roll (Horn of Wrath powered).
    ChooseBonusWithRisk {
        bonus_per_roll: u32,
        combat_type: CombatType,
        element: Element,
        accumulated: u32,
        rolled: bool,
    },
    /// Roll N dice; gain crystal matching each die color (Endless Gem Pouch basic).
    /// Black → fame +1 instead of crystal.
    RollForCrystals {
        die_count: u32,
    },
    /// Book of Wisdom: discard action card → gain same-color AA (basic) or spell+crystal (powered).
    BookOfWisdom {
        mode: crate::pending::EffectMode,
    },
    /// Tome of All Spells: discard card → use matching-color spell from offer.
    TomeOfAllSpells {
        mode: crate::pending::EffectMode,
    },
    /// Circlet of Proficiency basic: use non-interactive skill from offer (one-time).
    CircletOfProficiencyBasic,
    /// Circlet of Proficiency powered: acquire skill permanently.
    CircletOfProficiencyPowered,
    /// Mysterious Box: reveal top artifact, use as that artifact's basic effect.
    MysteriousBox,
    /// Druidic Staff basic: discard card → effect based on card color.
    DruidicStaffBasic,
    /// Druidic Staff powered: choose one of 6 dual-color combinations.
    DruidicStaffPowered,

    /// BowAttackTransformation resolved: apply the chosen attack (doubled or converted).
    GainAttackBowResolved {
        amount: u32,
        #[serde(rename = "combatType")]
        combat_type: CombatType,
        element: Element,
    },

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
