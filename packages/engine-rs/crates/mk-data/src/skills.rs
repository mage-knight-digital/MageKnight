//! Hero skill definitions — 10 skills per hero, 70 total.
//!
//! Each skill has a `SkillDefinition` with usage type, phase restriction, and
//! an optional `CardEffect`. Skills with `effect: None` are not yet implemented
//! and will be skipped by the enumeration logic.

use mk_types::effect::{CardEffect, EffectCondition, ScalingFactor, UnitFilter};
use mk_types::enums::{
    BasicManaColor, CombatType, Element, Hero, ManaColor, UnitState,
};
use mk_types::modifier::{
    CombatValueType, ModifierDuration, ModifierEffect, ModifierScope, RuleOverride,
};

// =============================================================================
// Skill definition types
// =============================================================================

/// How often a skill can be used.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SkillUsageType {
    /// Can be used once per turn. Cooldown resets at turn end.
    OncePerTurn,
    /// Can be used once per round. Cooldown resets at round end.
    OncePerRound,
    /// Passive — always active, not manually activated.
    Passive,
    /// Interactive — placed in center of table, special resolution.
    Interactive,
}

/// When a skill can be activated.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SkillPhaseRestriction {
    /// Normal turn + any combat phase.
    None,
    /// Any combat phase only.
    CombatOnly,
    /// Attack phase only (melee attack).
    MeleeAttackOnly,
    /// RangedSiege or Attack phase.
    RangedSiegeOrAttack,
    /// Block phase only.
    BlockOnly,
    /// Only outside combat.
    NoCombat,
}

/// Full skill definition.
#[derive(Debug, Clone)]
pub struct SkillDefinition {
    pub id: &'static str,
    pub usage_type: SkillUsageType,
    pub phase_restriction: SkillPhaseRestriction,
    pub is_motivation: bool,
    /// The effect to execute. None = not yet implemented (skipped by enumeration).
    pub effect: Option<CardEffect>,
}

// =============================================================================
// Per-hero skill ID lists
// =============================================================================

const ARYTHEA_SKILLS: [&str; 10] = [
    "arythea_dark_paths",
    "arythea_burning_power",
    "arythea_hot_swordsmanship",
    "arythea_dark_negotiation",
    "arythea_dark_fire_magic",
    "arythea_power_of_pain",
    "arythea_invocation",
    "arythea_polarization",
    "arythea_motivation",
    "arythea_ritual_of_pain",
];

const TOVAK_SKILLS: [&str; 10] = [
    "tovak_double_time",
    "tovak_night_sharpshooting",
    "tovak_cold_swordsmanship",
    "tovak_shield_mastery",
    "tovak_resistance_break",
    "tovak_i_feel_no_pain",
    "tovak_i_dont_give_a_damn",
    "tovak_who_needs_magic",
    "tovak_motivation",
    "tovak_mana_overload",
];

const GOLDYX_SKILLS: [&str; 10] = [
    "goldyx_freezing_power",
    "goldyx_potion_making",
    "goldyx_white_crystal_craft",
    "goldyx_green_crystal_craft",
    "goldyx_red_crystal_craft",
    "goldyx_glittering_fortune",
    "goldyx_flight",
    "goldyx_universal_power",
    "goldyx_motivation",
    "goldyx_source_opening",
];

const NOROWAS_SKILLS: [&str; 10] = [
    "norowas_forward_march",
    "norowas_day_sharpshooting",
    "norowas_inspiration",
    "norowas_bright_negotiation",
    "norowas_leaves_in_the_wind",
    "norowas_whispers_in_the_treetops",
    "norowas_leadership",
    "norowas_bonds_of_loyalty",
    "norowas_motivation",
    "norowas_prayer_of_weather",
];

const WOLFHAWK_SKILLS: [&str; 10] = [
    "wolfhawk_refreshing_bath",
    "wolfhawk_refreshing_breeze",
    "wolfhawk_hawk_eyes",
    "wolfhawk_on_her_own",
    "wolfhawk_deadly_aim",
    "wolfhawk_know_your_prey",
    "wolfhawk_taunt",
    "wolfhawk_dueling",
    "wolfhawk_motivation",
    "wolfhawk_wolfs_howl",
];

const KRANG_SKILLS: [&str; 10] = [
    "krang_spirit_guides",
    "krang_battle_hardened",
    "krang_battle_frenzy",
    "krang_shamanic_ritual",
    "krang_regenerate",
    "krang_arcane_disguise",
    "krang_puppet_master",
    "krang_master_of_chaos",
    "krang_curse",
    "krang_mana_enhancement",
];

const BRAEVALAR_SKILLS: [&str; 10] = [
    "braevalar_elemental_resistance",
    "braevalar_feral_allies",
    "braevalar_thunderstorm",
    "braevalar_lightning_storm",
    "braevalar_beguile",
    "braevalar_forked_lightning",
    "braevalar_shapeshift",
    "braevalar_secret_ways",
    "braevalar_regenerate",
    "braevalar_natures_vengeance",
];

// =============================================================================
// Public API
// =============================================================================

/// Get the 10 skill IDs for a hero.
pub fn get_hero_skill_ids(hero: Hero) -> &'static [&'static str] {
    match hero {
        Hero::Arythea => &ARYTHEA_SKILLS,
        Hero::Tovak => &TOVAK_SKILLS,
        Hero::Goldyx => &GOLDYX_SKILLS,
        Hero::Norowas => &NOROWAS_SKILLS,
        Hero::Wolfhawk => &WOLFHAWK_SKILLS,
        Hero::Krang => &KRANG_SKILLS,
        Hero::Braevalar => &BRAEVALAR_SKILLS,
    }
}

/// Check if a skill ID is a motivation skill.
pub fn is_motivation_skill(id: &str) -> bool {
    get_skill(id).map_or(false, |s| s.is_motivation)
}

/// Look up a skill definition by ID.
pub fn get_skill(id: &str) -> Option<SkillDefinition> {
    match id {
        // =====================================================================
        // Arythea
        // =====================================================================
        "arythea_dark_paths" => Some(SkillDefinition {
            id: "arythea_dark_paths",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::None,
            is_motivation: false,
            effect: Some(CardEffect::Conditional {
                condition: EffectCondition::IsNightOrUnderground,
                then_effect: Box::new(CardEffect::GainMove { amount: 2 }),
                else_effect: Some(Box::new(CardEffect::GainMove { amount: 1 })),
            }),
        }),
        "arythea_burning_power" => Some(SkillDefinition {
            id: "arythea_burning_power",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::RangedSiegeOrAttack,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::GainAttack {
                        amount: 1,
                        combat_type: CombatType::Siege,
                        element: Element::Physical,
                    },
                    CardEffect::GainAttack {
                        amount: 1,
                        combat_type: CombatType::Siege,
                        element: Element::Fire,
                    },
                ],
            }),
        }),
        "arythea_hot_swordsmanship" => Some(SkillDefinition {
            id: "arythea_hot_swordsmanship",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::MeleeAttackOnly,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::GainAttack {
                        amount: 2,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                    CardEffect::GainAttack {
                        amount: 2,
                        combat_type: CombatType::Melee,
                        element: Element::Fire,
                    },
                ],
            }),
        }),
        "arythea_dark_negotiation" => Some(SkillDefinition {
            id: "arythea_dark_negotiation",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Conditional {
                condition: EffectCondition::IsNightOrUnderground,
                then_effect: Box::new(CardEffect::GainInfluence { amount: 3 }),
                else_effect: Some(Box::new(CardEffect::GainInfluence { amount: 2 })),
            }),
        }),
        "arythea_dark_fire_magic" => Some(SkillDefinition {
            id: "arythea_dark_fire_magic",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainCrystal {
                        color: Some(BasicManaColor::Red),
                    },
                    CardEffect::Choice {
                        options: vec![
                            CardEffect::GainMana {
                                color: ManaColor::Red,
                                amount: 1,
                            },
                            CardEffect::GainMana {
                                color: ManaColor::Black,
                                amount: 1,
                            },
                        ],
                    },
                ],
            }),
        }),
        "arythea_power_of_pain" => Some(stub("arythea_power_of_pain", SkillUsageType::OncePerTurn, SkillPhaseRestriction::CombatOnly)),
        "arythea_invocation" => Some(stub("arythea_invocation", SkillUsageType::OncePerRound, SkillPhaseRestriction::NoCombat)),
        "arythea_polarization" => Some(stub("arythea_polarization", SkillUsageType::OncePerRound, SkillPhaseRestriction::NoCombat)),
        "arythea_motivation" => Some(SkillDefinition {
            id: "arythea_motivation",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: true,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::DrawCards { count: 2 },
                    CardEffect::Conditional {
                        condition: EffectCondition::LowestFame,
                        then_effect: Box::new(CardEffect::GainMana {
                            color: ManaColor::Red,
                            amount: 1,
                        }),
                        else_effect: Some(Box::new(CardEffect::Noop)),
                    },
                ],
            }),
        }),
        "arythea_ritual_of_pain" => Some(stub("arythea_ritual_of_pain", SkillUsageType::Interactive, SkillPhaseRestriction::NoCombat)),

        // =====================================================================
        // Tovak
        // =====================================================================
        "tovak_double_time" => Some(SkillDefinition {
            id: "tovak_double_time",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::None,
            is_motivation: false,
            effect: Some(CardEffect::Conditional {
                condition: EffectCondition::TimeOfDay {
                    time: mk_types::enums::TimeOfDay::Day,
                },
                then_effect: Box::new(CardEffect::GainMove { amount: 2 }),
                else_effect: Some(Box::new(CardEffect::GainMove { amount: 1 })),
            }),
        }),
        "tovak_night_sharpshooting" => Some(SkillDefinition {
            id: "tovak_night_sharpshooting",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::RangedSiegeOrAttack,
            is_motivation: false,
            effect: Some(CardEffect::Conditional {
                condition: EffectCondition::IsNightOrUnderground,
                then_effect: Box::new(CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Ranged,
                    element: Element::Physical,
                }),
                else_effect: Some(Box::new(CardEffect::GainAttack {
                    amount: 1,
                    combat_type: CombatType::Ranged,
                    element: Element::Physical,
                })),
            }),
        }),
        "tovak_cold_swordsmanship" => Some(SkillDefinition {
            id: "tovak_cold_swordsmanship",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::MeleeAttackOnly,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::GainAttack {
                        amount: 2,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                    CardEffect::GainAttack {
                        amount: 2,
                        combat_type: CombatType::Melee,
                        element: Element::Ice,
                    },
                ],
            }),
        }),
        "tovak_shield_mastery" => Some(stub("tovak_shield_mastery", SkillUsageType::OncePerTurn, SkillPhaseRestriction::BlockOnly)),
        "tovak_resistance_break" => Some(stub("tovak_resistance_break", SkillUsageType::OncePerTurn, SkillPhaseRestriction::CombatOnly)),
        "tovak_i_feel_no_pain" => Some(stub("tovak_i_feel_no_pain", SkillUsageType::Passive, SkillPhaseRestriction::None)),
        "tovak_i_dont_give_a_damn" => Some(stub("tovak_i_dont_give_a_damn", SkillUsageType::OncePerTurn, SkillPhaseRestriction::NoCombat)),
        "tovak_who_needs_magic" => Some(stub("tovak_who_needs_magic", SkillUsageType::OncePerTurn, SkillPhaseRestriction::NoCombat)),
        "tovak_motivation" => Some(SkillDefinition {
            id: "tovak_motivation",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: true,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::DrawCards { count: 2 },
                    CardEffect::Conditional {
                        condition: EffectCondition::LowestFame,
                        then_effect: Box::new(CardEffect::GainMana {
                            color: ManaColor::Blue,
                            amount: 1,
                        }),
                        else_effect: Some(Box::new(CardEffect::Noop)),
                    },
                ],
            }),
        }),
        "tovak_mana_overload" => Some(stub("tovak_mana_overload", SkillUsageType::Interactive, SkillPhaseRestriction::NoCombat)),

        // =====================================================================
        // Goldyx
        // =====================================================================
        "goldyx_freezing_power" => Some(SkillDefinition {
            id: "goldyx_freezing_power",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::RangedSiegeOrAttack,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::GainAttack {
                        amount: 1,
                        combat_type: CombatType::Siege,
                        element: Element::Physical,
                    },
                    CardEffect::GainAttack {
                        amount: 1,
                        combat_type: CombatType::Siege,
                        element: Element::Ice,
                    },
                ],
            }),
        }),
        "goldyx_potion_making" => Some(SkillDefinition {
            id: "goldyx_potion_making",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::GainHealing { amount: 2 }),
        }),
        "goldyx_white_crystal_craft" => Some(SkillDefinition {
            id: "goldyx_white_crystal_craft",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainCrystal {
                        color: Some(BasicManaColor::Blue),
                    },
                    CardEffect::GainMana {
                        color: ManaColor::White,
                        amount: 1,
                    },
                ],
            }),
        }),
        "goldyx_green_crystal_craft" => Some(SkillDefinition {
            id: "goldyx_green_crystal_craft",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainCrystal {
                        color: Some(BasicManaColor::Blue),
                    },
                    CardEffect::GainMana {
                        color: ManaColor::Green,
                        amount: 1,
                    },
                ],
            }),
        }),
        "goldyx_red_crystal_craft" => Some(SkillDefinition {
            id: "goldyx_red_crystal_craft",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainCrystal {
                        color: Some(BasicManaColor::Blue),
                    },
                    CardEffect::GainMana {
                        color: ManaColor::Red,
                        amount: 1,
                    },
                ],
            }),
        }),
        "goldyx_glittering_fortune" => Some(SkillDefinition {
            id: "goldyx_glittering_fortune",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Scaling {
                factor: ScalingFactor::PerCrystalColor,
                base_effect: Box::new(CardEffect::GainInfluence { amount: 0 }),
                bonus_per_count: None,
                maximum: None,
            }),
        }),
        "goldyx_flight" => Some(stub("goldyx_flight", SkillUsageType::OncePerTurn, SkillPhaseRestriction::NoCombat)),
        "goldyx_universal_power" => Some(stub("goldyx_universal_power", SkillUsageType::OncePerRound, SkillPhaseRestriction::NoCombat)),
        "goldyx_motivation" => Some(SkillDefinition {
            id: "goldyx_motivation",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: true,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::DrawCards { count: 2 },
                    CardEffect::Conditional {
                        condition: EffectCondition::LowestFame,
                        then_effect: Box::new(CardEffect::GainMana {
                            color: ManaColor::Green,
                            amount: 1,
                        }),
                        else_effect: Some(Box::new(CardEffect::Noop)),
                    },
                ],
            }),
        }),
        "goldyx_source_opening" => Some(stub("goldyx_source_opening", SkillUsageType::Interactive, SkillPhaseRestriction::NoCombat)),

        // =====================================================================
        // Norowas
        // =====================================================================
        "norowas_forward_march" => Some(SkillDefinition {
            id: "norowas_forward_march",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Scaling {
                factor: ScalingFactor::PerUnit {
                    filter: Some(UnitFilter {
                        wounded: Some(false),
                        max_level: None,
                        state: Some(UnitState::Ready),
                    }),
                },
                base_effect: Box::new(CardEffect::GainMove { amount: 0 }),
                bonus_per_count: None,
                maximum: Some(3),
            }),
        }),
        "norowas_day_sharpshooting" => Some(SkillDefinition {
            id: "norowas_day_sharpshooting",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::RangedSiegeOrAttack,
            is_motivation: false,
            effect: Some(CardEffect::Conditional {
                condition: EffectCondition::IsNightOrUnderground,
                then_effect: Box::new(CardEffect::GainAttack {
                    amount: 1,
                    combat_type: CombatType::Ranged,
                    element: Element::Physical,
                }),
                else_effect: Some(Box::new(CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Ranged,
                    element: Element::Physical,
                })),
            }),
        }),
        "norowas_inspiration" => Some(stub("norowas_inspiration", SkillUsageType::OncePerTurn, SkillPhaseRestriction::NoCombat)),
        "norowas_bright_negotiation" => Some(SkillDefinition {
            id: "norowas_bright_negotiation",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Conditional {
                condition: EffectCondition::IsNightOrUnderground,
                then_effect: Box::new(CardEffect::GainInfluence { amount: 2 }),
                else_effect: Some(Box::new(CardEffect::GainInfluence { amount: 3 })),
            }),
        }),
        "norowas_leaves_in_the_wind" => Some(SkillDefinition {
            id: "norowas_leaves_in_the_wind",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainCrystal {
                        color: Some(BasicManaColor::Green),
                    },
                    CardEffect::GainMana {
                        color: ManaColor::White,
                        amount: 1,
                    },
                ],
            }),
        }),
        "norowas_whispers_in_the_treetops" => Some(SkillDefinition {
            id: "norowas_whispers_in_the_treetops",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainCrystal {
                        color: Some(BasicManaColor::White),
                    },
                    CardEffect::GainMana {
                        color: ManaColor::Green,
                        amount: 1,
                    },
                ],
            }),
        }),
        "norowas_leadership" => Some(stub("norowas_leadership", SkillUsageType::Passive, SkillPhaseRestriction::None)),
        "norowas_bonds_of_loyalty" => Some(stub("norowas_bonds_of_loyalty", SkillUsageType::Passive, SkillPhaseRestriction::None)),
        "norowas_motivation" => Some(SkillDefinition {
            id: "norowas_motivation",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: true,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::DrawCards { count: 2 },
                    CardEffect::Conditional {
                        condition: EffectCondition::LowestFame,
                        then_effect: Box::new(CardEffect::GainMana {
                            color: ManaColor::White,
                            amount: 1,
                        }),
                        else_effect: Some(Box::new(CardEffect::Noop)),
                    },
                ],
            }),
        }),
        "norowas_prayer_of_weather" => Some(stub("norowas_prayer_of_weather", SkillUsageType::Interactive, SkillPhaseRestriction::NoCombat)),

        // =====================================================================
        // Wolfhawk
        // =====================================================================
        "wolfhawk_refreshing_bath" => Some(SkillDefinition {
            id: "wolfhawk_refreshing_bath",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainHealing { amount: 1 },
                    CardEffect::GainCrystal {
                        color: Some(BasicManaColor::Blue),
                    },
                ],
            }),
        }),
        "wolfhawk_refreshing_breeze" => Some(SkillDefinition {
            id: "wolfhawk_refreshing_breeze",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainHealing { amount: 1 },
                    CardEffect::GainCrystal {
                        color: Some(BasicManaColor::White),
                    },
                ],
            }),
        }),
        "wolfhawk_hawk_eyes" => Some(stub("wolfhawk_hawk_eyes", SkillUsageType::OncePerTurn, SkillPhaseRestriction::NoCombat)),
        "wolfhawk_on_her_own" => Some(SkillDefinition {
            id: "wolfhawk_on_her_own",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Conditional {
                condition: EffectCondition::NoUnitRecruitedThisTurn,
                then_effect: Box::new(CardEffect::GainInfluence { amount: 3 }),
                else_effect: Some(Box::new(CardEffect::GainInfluence { amount: 1 })),
            }),
        }),
        "wolfhawk_deadly_aim" => Some(stub("wolfhawk_deadly_aim", SkillUsageType::OncePerTurn, SkillPhaseRestriction::RangedSiegeOrAttack)),
        "wolfhawk_know_your_prey" => Some(stub("wolfhawk_know_your_prey", SkillUsageType::OncePerTurn, SkillPhaseRestriction::CombatOnly)),
        "wolfhawk_taunt" => Some(stub("wolfhawk_taunt", SkillUsageType::OncePerTurn, SkillPhaseRestriction::CombatOnly)),
        "wolfhawk_dueling" => Some(stub("wolfhawk_dueling", SkillUsageType::OncePerTurn, SkillPhaseRestriction::CombatOnly)),
        "wolfhawk_motivation" => Some(SkillDefinition {
            id: "wolfhawk_motivation",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: true,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::DrawCards { count: 2 },
                    CardEffect::Conditional {
                        condition: EffectCondition::LowestFame,
                        then_effect: Box::new(CardEffect::GainFame { amount: 1 }),
                        else_effect: Some(Box::new(CardEffect::Noop)),
                    },
                ],
            }),
        }),
        "wolfhawk_wolfs_howl" => Some(stub("wolfhawk_wolfs_howl", SkillUsageType::OncePerRound, SkillPhaseRestriction::NoCombat)),

        // =====================================================================
        // Krang
        // =====================================================================
        "krang_spirit_guides" => Some(SkillDefinition {
            id: "krang_spirit_guides",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::None,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainMove { amount: 1 },
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::CombatValue {
                            value_type: CombatValueType::Block,
                            element: None,
                            amount: 1,
                        },
                        duration: ModifierDuration::Turn,
                        scope: ModifierScope::SelfScope,
                    },
                ],
            }),
        }),
        "krang_battle_hardened" => Some(stub("krang_battle_hardened", SkillUsageType::Passive, SkillPhaseRestriction::None)),
        "krang_battle_frenzy" => Some(stub("krang_battle_frenzy", SkillUsageType::OncePerRound, SkillPhaseRestriction::CombatOnly)),
        "krang_shamanic_ritual" => Some(SkillDefinition {
            id: "krang_shamanic_ritual",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::GainMana { color: ManaColor::Red, amount: 1 },
                    CardEffect::GainMana { color: ManaColor::Blue, amount: 1 },
                    CardEffect::GainMana { color: ManaColor::Green, amount: 1 },
                    CardEffect::GainMana { color: ManaColor::White, amount: 1 },
                    CardEffect::GainMana { color: ManaColor::Gold, amount: 1 },
                    CardEffect::GainMana { color: ManaColor::Black, amount: 1 },
                ],
            }),
        }),
        "krang_regenerate" => Some(stub("krang_regenerate", SkillUsageType::OncePerRound, SkillPhaseRestriction::NoCombat)),
        "krang_arcane_disguise" => Some(SkillDefinition {
            id: "krang_arcane_disguise",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::GainInfluence { amount: 2 },
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::RuleOverride {
                            rule: RuleOverride::IgnoreReputation,
                        },
                        duration: ModifierDuration::Turn,
                        scope: ModifierScope::SelfScope,
                    },
                ],
            }),
        }),
        "krang_puppet_master" => Some(stub("krang_puppet_master", SkillUsageType::OncePerRound, SkillPhaseRestriction::CombatOnly)),
        "krang_master_of_chaos" => Some(stub("krang_master_of_chaos", SkillUsageType::Interactive, SkillPhaseRestriction::NoCombat)),
        "krang_curse" => Some(stub("krang_curse", SkillUsageType::OncePerRound, SkillPhaseRestriction::CombatOnly)),
        "krang_mana_enhancement" => Some(stub("krang_mana_enhancement", SkillUsageType::Interactive, SkillPhaseRestriction::NoCombat)),

        // =====================================================================
        // Braevalar
        // =====================================================================
        "braevalar_elemental_resistance" => Some(stub("braevalar_elemental_resistance", SkillUsageType::Passive, SkillPhaseRestriction::None)),
        "braevalar_feral_allies" => Some(stub("braevalar_feral_allies", SkillUsageType::Passive, SkillPhaseRestriction::None)),
        "braevalar_thunderstorm" => Some(stub("braevalar_thunderstorm", SkillUsageType::OncePerRound, SkillPhaseRestriction::CombatOnly)),
        "braevalar_lightning_storm" => Some(stub("braevalar_lightning_storm", SkillUsageType::OncePerRound, SkillPhaseRestriction::CombatOnly)),
        "braevalar_beguile" => Some(stub("braevalar_beguile", SkillUsageType::OncePerTurn, SkillPhaseRestriction::NoCombat)),
        "braevalar_forked_lightning" => Some(stub("braevalar_forked_lightning", SkillUsageType::OncePerRound, SkillPhaseRestriction::CombatOnly)),
        "braevalar_shapeshift" => Some(stub("braevalar_shapeshift", SkillUsageType::OncePerRound, SkillPhaseRestriction::CombatOnly)),
        "braevalar_secret_ways" => Some(stub("braevalar_secret_ways", SkillUsageType::Passive, SkillPhaseRestriction::None)),
        "braevalar_regenerate" => Some(stub("braevalar_regenerate", SkillUsageType::OncePerRound, SkillPhaseRestriction::NoCombat)),
        "braevalar_natures_vengeance" => Some(stub("braevalar_natures_vengeance", SkillUsageType::Interactive, SkillPhaseRestriction::NoCombat)),

        _ => None,
    }
}

/// Helper to create a stub skill definition (effect not yet implemented).
fn stub(id: &'static str, usage_type: SkillUsageType, phase_restriction: SkillPhaseRestriction) -> SkillDefinition {
    SkillDefinition {
        id,
        usage_type,
        phase_restriction,
        is_motivation: false,
        effect: None,
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn arythea_has_10_skills() {
        let skills = get_hero_skill_ids(Hero::Arythea);
        assert_eq!(skills.len(), 10);
        let mut seen = std::collections::HashSet::new();
        for s in skills {
            assert!(seen.insert(s), "Duplicate skill: {}", s);
        }
    }

    #[test]
    fn all_heroes_have_10_unique_skills() {
        let heroes = [
            Hero::Arythea,
            Hero::Tovak,
            Hero::Goldyx,
            Hero::Norowas,
            Hero::Wolfhawk,
            Hero::Krang,
            Hero::Braevalar,
        ];
        for hero in heroes {
            let skills = get_hero_skill_ids(hero);
            assert_eq!(skills.len(), 10, "{:?} should have 10 skills", hero);
            let mut seen = std::collections::HashSet::new();
            for s in skills {
                assert!(seen.insert(s), "{:?} has duplicate skill: {}", hero, s);
            }
        }
    }

    #[test]
    fn all_70_skills_in_registry() {
        let heroes = [
            Hero::Arythea,
            Hero::Tovak,
            Hero::Goldyx,
            Hero::Norowas,
            Hero::Wolfhawk,
            Hero::Krang,
            Hero::Braevalar,
        ];
        for hero in heroes {
            for id in get_hero_skill_ids(hero) {
                assert!(
                    get_skill(id).is_some(),
                    "Skill {} not found in registry",
                    id
                );
            }
        }
    }

    #[test]
    fn tier1_skills_have_effects() {
        let tier1 = [
            "arythea_dark_paths",
            "arythea_burning_power",
            "arythea_hot_swordsmanship",
            "arythea_dark_negotiation",
            "arythea_dark_fire_magic",
            "arythea_motivation",
            "tovak_double_time",
            "tovak_cold_swordsmanship",
            "tovak_night_sharpshooting",
            "tovak_motivation",
            "goldyx_freezing_power",
            "goldyx_potion_making",
            "goldyx_glittering_fortune",
            "goldyx_white_crystal_craft",
            "goldyx_green_crystal_craft",
            "goldyx_red_crystal_craft",
            "goldyx_motivation",
            "norowas_bright_negotiation",
            "norowas_day_sharpshooting",
            "norowas_forward_march",
            "norowas_leaves_in_the_wind",
            "norowas_whispers_in_the_treetops",
            "norowas_motivation",
            "wolfhawk_refreshing_bath",
            "wolfhawk_refreshing_breeze",
            "wolfhawk_on_her_own",
            "wolfhawk_motivation",
            "krang_shamanic_ritual",
            "krang_spirit_guides",
            "krang_arcane_disguise",
        ];
        for id in tier1 {
            let skill = get_skill(id).unwrap_or_else(|| panic!("Missing: {}", id));
            assert!(
                skill.effect.is_some(),
                "Tier 1 skill {} should have an effect",
                id
            );
        }
    }

    #[test]
    fn motivations_are_once_per_round() {
        let motivations = [
            "arythea_motivation",
            "tovak_motivation",
            "goldyx_motivation",
            "norowas_motivation",
            "wolfhawk_motivation",
        ];
        for id in motivations {
            let skill = get_skill(id).unwrap();
            assert!(skill.is_motivation, "{} should be a motivation", id);
            assert_eq!(
                skill.usage_type,
                SkillUsageType::OncePerRound,
                "{} should be OncePerRound",
                id
            );
            assert_eq!(
                skill.phase_restriction,
                SkillPhaseRestriction::NoCombat,
                "{} should be NoCombat",
                id
            );
        }
    }

    #[test]
    fn combat_skills_have_combat_restriction() {
        let combat_skills = [
            "arythea_burning_power",
            "arythea_hot_swordsmanship",
            "tovak_cold_swordsmanship",
            "tovak_night_sharpshooting",
            "goldyx_freezing_power",
            "norowas_day_sharpshooting",
        ];
        for id in combat_skills {
            let skill = get_skill(id).unwrap();
            assert!(
                matches!(
                    skill.phase_restriction,
                    SkillPhaseRestriction::MeleeAttackOnly
                        | SkillPhaseRestriction::RangedSiegeOrAttack
                        | SkillPhaseRestriction::CombatOnly
                        | SkillPhaseRestriction::BlockOnly
                ),
                "{} should have a combat phase restriction, got {:?}",
                id,
                skill.phase_restriction
            );
        }
    }

    #[test]
    fn is_motivation_skill_works() {
        assert!(is_motivation_skill("arythea_motivation"));
        assert!(is_motivation_skill("tovak_motivation"));
        assert!(!is_motivation_skill("arythea_dark_paths"));
        assert!(!is_motivation_skill("nonexistent_skill"));
    }

    #[test]
    fn stub_skills_have_no_effect() {
        let stubs = [
            "arythea_power_of_pain",
            "arythea_invocation",
            "tovak_shield_mastery",
            "braevalar_shapeshift",
        ];
        for id in stubs {
            let skill = get_skill(id).unwrap();
            assert!(
                skill.effect.is_none(),
                "Stub skill {} should have no effect",
                id
            );
        }
    }
}
