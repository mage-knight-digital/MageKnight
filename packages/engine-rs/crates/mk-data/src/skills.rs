//! Hero skill definitions — 10 skills per hero, 70 total.
//!
//! Each skill has a `SkillDefinition` with usage type, phase restriction, and
//! an optional `CardEffect`. Skills with `effect: None` are not yet implemented
//! and will be skipped by the enumeration logic.

use mk_types::effect::{CardEffect, EffectCondition, ScalingFactor, UnitFilter};
use mk_types::enums::{
    BasicManaColor, CombatPhase, CombatType, Element, Hero, ManaColor, UnitState,
};
use mk_types::enums::Terrain;
use mk_types::modifier::{
    CombatValueType, LeadershipBonusType, ModifierDuration, ModifierEffect, ModifierScope,
    RuleOverride, TerrainOrAll,
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
    get_skill(id).is_some_and(|s| s.is_motivation)
}

/// Get passive modifiers for a skill (always-on while skill is owned).
/// Returns empty vec for skills without passive effects.
/// These are pushed as Permanent modifiers when the skill is acquired.
pub fn get_passive_modifiers(skill_id: &str) -> Vec<ModifierEffect> {
    match skill_id {
        "braevalar_secret_ways" => vec![
            // Mountains always cost exactly 5 move points
            ModifierEffect::TerrainCost {
                terrain: TerrainOrAll::Specific(Terrain::Mountain),
                amount: 0,
                minimum: 0,
                replace_cost: Some(5),
            },
            // Mountains are safe spaces
            ModifierEffect::TerrainSafe {
                terrain: TerrainOrAll::Specific(Terrain::Mountain),
            },
        ],
        "braevalar_feral_allies" => vec![
            // Explore cost reduced by 1
            ModifierEffect::ExploreCostReduction { amount: 1 },
        ],
        "norowas_bonds_of_loyalty" => vec![
            // -5 influence discount on next recruited unit
            ModifierEffect::RecruitDiscount { discount: 5, reputation_change: 0 },
        ],
        _ => vec![],
    }
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
        "arythea_power_of_pain" => Some(SkillDefinition {
            id: "arythea_power_of_pain",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::None,
            is_motivation: false,
            effect: Some(CardEffect::Noop),
        }),
        "arythea_invocation" => Some(SkillDefinition {
            id: "arythea_invocation",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Noop), // Custom handler
        }),
        "arythea_polarization" => Some(SkillDefinition {
            id: "arythea_polarization",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Noop), // Custom handler
        }),
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
        "tovak_shield_mastery" => Some(SkillDefinition {
            id: "tovak_shield_mastery",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::BlockOnly,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::GainBlock { amount: 3, element: Element::Physical },
                    CardEffect::GainBlock { amount: 2, element: Element::Fire },
                    CardEffect::GainBlock { amount: 2, element: Element::Ice },
                ],
            }),
        }),
        // Resistance Break: target enemy armor -1 per resistance (min 1), not vs Arcane Immune
        "tovak_resistance_break" => Some(SkillDefinition {
            id: "tovak_resistance_break",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::CombatOnly,
            is_motivation: false,
            effect: Some(CardEffect::SelectCombatEnemy {
                template: mk_types::pending::SelectEnemyTemplate {
                    exclude_arcane_immune: true,
                    armor_change: -1,
                    armor_minimum: 1,
                    armor_per_resistance: true,
                    ..mk_types::pending::SelectEnemyTemplate::new()
                },
            }),
        }),
        "tovak_i_feel_no_pain" => Some(SkillDefinition {
            id: "tovak_i_feel_no_pain",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::DiscardCost {
                count: 1,
                filter_wounds: false,
                wounds_only: true,
                then_effect: Box::new(CardEffect::DrawCards { count: 1 }),
            }),
        }),
        "tovak_i_dont_give_a_damn" => Some(SkillDefinition {
            id: "tovak_i_dont_give_a_damn",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Noop),
        }),
        "tovak_who_needs_magic" => Some(SkillDefinition {
            id: "tovak_who_needs_magic",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Noop),
        }),
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
        // Flight: Choice A = free adjacent move (all terrain 0), Choice B = 2 move (all terrain 1).
        // Both options ignore rampaging provocation.
        "goldyx_flight" => Some(SkillDefinition {
            id: "goldyx_flight",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::Compound {
                        effects: vec![
                            CardEffect::ApplyModifier {
                                effect: ModifierEffect::TerrainCost {
                                    terrain: TerrainOrAll::All,
                                    amount: 0,
                                    minimum: 0,
                                    replace_cost: Some(0),
                                },
                                duration: ModifierDuration::Turn,
                                scope: ModifierScope::SelfScope,
                            },
                            CardEffect::ApplyModifier {
                                effect: ModifierEffect::RuleOverride {
                                    rule: RuleOverride::IgnoreRampagingProvoke,
                                },
                                duration: ModifierDuration::Turn,
                                scope: ModifierScope::SelfScope,
                            },
                            CardEffect::GainMove { amount: 1 },
                        ],
                    },
                    CardEffect::Compound {
                        effects: vec![
                            CardEffect::ApplyModifier {
                                effect: ModifierEffect::TerrainCost {
                                    terrain: TerrainOrAll::All,
                                    amount: 0,
                                    minimum: 0,
                                    replace_cost: Some(1),
                                },
                                duration: ModifierDuration::Turn,
                                scope: ModifierScope::SelfScope,
                            },
                            CardEffect::ApplyModifier {
                                effect: ModifierEffect::RuleOverride {
                                    rule: RuleOverride::IgnoreRampagingProvoke,
                                },
                                duration: ModifierDuration::Turn,
                                scope: ModifierScope::SelfScope,
                            },
                            CardEffect::GainMove { amount: 2 },
                        ],
                    },
                ],
            }),
        }),
        "goldyx_universal_power" => Some(SkillDefinition {
            id: "goldyx_universal_power",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Noop),
        }),
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
        // Inspiration: Choice of Ready unit (any level) or Heal wounded unit
        "norowas_inspiration" => Some(SkillDefinition {
            id: "norowas_inspiration",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::ReadyUnit { max_level: 4 },
                    CardEffect::HealUnit { max_level: 4 },
                ],
            }),
        }),
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
        // Leadership: +3 Block, +2 Attack, or +1 Ranged Attack bonus to next unit activation
        "norowas_leadership" => Some(SkillDefinition {
            id: "norowas_leadership",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::CombatOnly,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::LeadershipBonus {
                            bonus_type: LeadershipBonusType::Block,
                            amount: 3,
                        },
                        duration: ModifierDuration::Turn,
                        scope: ModifierScope::SelfScope,
                    },
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::LeadershipBonus {
                            bonus_type: LeadershipBonusType::Attack,
                            amount: 2,
                        },
                        duration: ModifierDuration::Turn,
                        scope: ModifierScope::SelfScope,
                    },
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::LeadershipBonus {
                            bonus_type: LeadershipBonusType::RangedAttack,
                            amount: 1,
                        },
                        duration: ModifierDuration::Turn,
                        scope: ModifierScope::SelfScope,
                    },
                ],
            }),
        }),
        "norowas_bonds_of_loyalty" => Some(SkillDefinition {
            id: "norowas_bonds_of_loyalty",
            usage_type: SkillUsageType::Passive,
            phase_restriction: SkillPhaseRestriction::None,
            is_motivation: false,
            effect: Some(CardEffect::Noop), // Passive — handled via get_passive_modifiers + command slot logic
        }),
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
        // Hawk Eyes: Move 1, night: explore cost -1 (turn), day: reveal garrisons at distance 2 (turn)
        "wolfhawk_hawk_eyes" => Some(SkillDefinition {
            id: "wolfhawk_hawk_eyes",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainMove { amount: 1 },
                    CardEffect::Conditional {
                        condition: EffectCondition::IsNightOrUnderground,
                        then_effect: Box::new(CardEffect::ApplyModifier {
                            effect: ModifierEffect::ExploreCostReduction { amount: 1 },
                            duration: ModifierDuration::Turn,
                            scope: ModifierScope::SelfScope,
                        }),
                        else_effect: Some(Box::new(CardEffect::ApplyModifier {
                            effect: ModifierEffect::RuleOverride {
                                rule: RuleOverride::GarrisonRevealDistance2,
                            },
                            duration: ModifierDuration::Turn,
                            scope: ModifierScope::SelfScope,
                        })),
                    },
                ],
            }),
        }),
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
        // Deadly Aim: Ranged/Siege phase → Ranged Attack 1, Attack phase → Attack 2
        "wolfhawk_deadly_aim" => Some(SkillDefinition {
            id: "wolfhawk_deadly_aim",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::RangedSiegeOrAttack,
            is_motivation: false,
            effect: Some(CardEffect::Conditional {
                condition: EffectCondition::InPhase {
                    phases: vec![CombatPhase::Attack],
                },
                then_effect: Box::new(CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                }),
                else_effect: Some(Box::new(CardEffect::GainAttack {
                    amount: 1,
                    combat_type: CombatType::Ranged,
                    element: Element::Physical,
                })),
            }),
        }),
        "wolfhawk_know_your_prey" => Some(SkillDefinition {
            id: "wolfhawk_know_your_prey",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::CombatOnly,
            is_motivation: false,
            effect: Some(CardEffect::Noop), // Custom handler
        }),
        // Taunt: Choice A: reduce enemy attack by 1. Choice B: increase enemy attack by 2, reduce armor by 2 (min 1).
        "wolfhawk_taunt" => Some(SkillDefinition {
            id: "wolfhawk_taunt",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::BlockOnly,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::SelectCombatEnemy {
                        template: mk_types::pending::SelectEnemyTemplate {
                            attack_change: -1,
                            attack_minimum: 0,
                            ..mk_types::pending::SelectEnemyTemplate::new()
                        },
                    },
                    CardEffect::SelectCombatEnemy {
                        template: mk_types::pending::SelectEnemyTemplate {
                            attack_change: 2,
                            attack_minimum: 0,
                            armor_change: -2,
                            armor_minimum: 1,
                            ..mk_types::pending::SelectEnemyTemplate::new()
                        },
                    },
                ],
            }),
        }),
        // Dueling: Block phase only. Block 1 + target enemy → deferred Attack 1 at Attack phase.
        // +1 fame if target defeated without unit involvement.
        "wolfhawk_dueling" => Some(SkillDefinition {
            id: "wolfhawk_dueling",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::BlockOnly,
            is_motivation: false,
            effect: Some(CardEffect::Noop), // Custom handler
        }),
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
        // Battle Hardened: -2 Physical damage OR -1 Fire/Ice/ColdFire damage
        "krang_battle_hardened" => Some(SkillDefinition {
            id: "krang_battle_hardened",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::CombatOnly,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::HeroDamageReduction {
                            amount: 2,
                            elements: vec![Element::Physical],
                        },
                        duration: ModifierDuration::Combat,
                        scope: ModifierScope::SelfScope,
                    },
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::HeroDamageReduction {
                            amount: 1,
                            elements: vec![Element::Fire, Element::Ice, Element::ColdFire],
                        },
                        duration: ModifierDuration::Combat,
                        scope: ModifierScope::SelfScope,
                    },
                ],
            }),
        }),
        // Battle Frenzy: Attack 2 OR Attack 4 (flips face-down)
        // Flip side-effect handled in apply_resolve_choice when skill_id == "krang_battle_frenzy" && choice_index == 1
        "krang_battle_frenzy" => Some(SkillDefinition {
            id: "krang_battle_frenzy",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::CombatOnly,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::GainAttack {
                        amount: 2,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                    CardEffect::GainAttack {
                        amount: 4,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                ],
            }),
        }),
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
        // Regenerate: pay 1 mana of any color, remove 1 wound from hand,
        // draw 1 card if mana color is Red (bonus) or player has strictly lowest fame.
        "krang_regenerate" => Some(SkillDefinition {
            id: "krang_regenerate",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Noop), // Custom handler
        }),
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
        "krang_curse" => Some(SkillDefinition {
            id: "krang_curse",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::CombatOnly,
            is_motivation: false,
            effect: Some(CardEffect::Noop), // Custom handler
        }),
        "krang_mana_enhancement" => Some(stub("krang_mana_enhancement", SkillUsageType::Interactive, SkillPhaseRestriction::NoCombat)),

        // =====================================================================
        // Braevalar
        // =====================================================================
        // Elemental Resistance: -2 Fire/Ice damage OR -1 Physical/ColdFire damage
        "braevalar_elemental_resistance" => Some(SkillDefinition {
            id: "braevalar_elemental_resistance",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::CombatOnly,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::HeroDamageReduction {
                            amount: 2,
                            elements: vec![Element::Fire, Element::Ice],
                        },
                        duration: ModifierDuration::Combat,
                        scope: ModifierScope::SelfScope,
                    },
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::HeroDamageReduction {
                            amount: 1,
                            elements: vec![Element::Physical, Element::ColdFire],
                        },
                        duration: ModifierDuration::Combat,
                        scope: ModifierScope::SelfScope,
                    },
                ],
            }),
        }),
        // Feral Allies: passive explore cost -1, active: Attack 1 or enemy attack -1
        // Note: exclude_arcane_immune is false — FAQ S2 says AI enemies CAN be targeted
        "braevalar_feral_allies" => Some(SkillDefinition {
            id: "braevalar_feral_allies",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::CombatOnly,
            is_motivation: false,
            effect: Some(CardEffect::Choice {
                options: vec![
                    CardEffect::GainAttack {
                        amount: 1,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                    CardEffect::SelectCombatEnemy {
                        template: mk_types::pending::SelectEnemyTemplate {
                            attack_change: -1,
                            attack_minimum: 0,
                            ..mk_types::pending::SelectEnemyTemplate::new()
                        },
                    },
                ],
            }),
        }),
        // Thunderstorm: gain (Green OR Blue) AND (Green OR White) mana tokens
        "braevalar_thunderstorm" => Some(SkillDefinition {
            id: "braevalar_thunderstorm",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::None,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::Choice {
                        options: vec![
                            CardEffect::GainMana { color: ManaColor::Green, amount: 1 },
                            CardEffect::GainMana { color: ManaColor::Blue, amount: 1 },
                        ],
                    },
                    CardEffect::Choice {
                        options: vec![
                            CardEffect::GainMana { color: ManaColor::Green, amount: 1 },
                            CardEffect::GainMana { color: ManaColor::White, amount: 1 },
                        ],
                    },
                ],
            }),
        }),
        // Lightning Storm: gain (Blue OR Green) AND (Blue OR Red) mana tokens
        "braevalar_lightning_storm" => Some(SkillDefinition {
            id: "braevalar_lightning_storm",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::None,
            is_motivation: false,
            effect: Some(CardEffect::Compound {
                effects: vec![
                    CardEffect::Choice {
                        options: vec![
                            CardEffect::GainMana { color: ManaColor::Blue, amount: 1 },
                            CardEffect::GainMana { color: ManaColor::Green, amount: 1 },
                        ],
                    },
                    CardEffect::Choice {
                        options: vec![
                            CardEffect::GainMana { color: ManaColor::Blue, amount: 1 },
                            CardEffect::GainMana { color: ManaColor::Red, amount: 1 },
                        ],
                    },
                ],
            }),
        }),
        // Beguile: Influence 4 at Magical Glade, 2 at fortified sites, 3 elsewhere
        "braevalar_beguile" => Some(SkillDefinition {
            id: "braevalar_beguile",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Conditional {
                condition: EffectCondition::AtMagicalGlade,
                then_effect: Box::new(CardEffect::GainInfluence { amount: 4 }),
                else_effect: Some(Box::new(CardEffect::Conditional {
                    condition: EffectCondition::AtFortifiedSite,
                    then_effect: Box::new(CardEffect::GainInfluence { amount: 2 }),
                    else_effect: Some(Box::new(CardEffect::GainInfluence { amount: 3 })),
                })),
            }),
        }),
        "braevalar_forked_lightning" => Some(SkillDefinition {
            id: "braevalar_forked_lightning",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::CombatOnly,
            is_motivation: false,
            effect: Some(CardEffect::Noop), // Custom handler
        }),
        "braevalar_shapeshift" => Some(stub("braevalar_shapeshift", SkillUsageType::OncePerRound, SkillPhaseRestriction::CombatOnly)),
        // Secret Ways: passive mountain cost 5 + safe, active: Move 1 + optional blue mana for lake access
        "braevalar_secret_ways" => Some(SkillDefinition {
            id: "braevalar_secret_ways",
            usage_type: SkillUsageType::OncePerTurn,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Noop), // Custom handler
        }),
        // Regenerate: pay 1 mana of any color, remove 1 wound from hand,
        // draw 1 card if mana color is Green (bonus) or player has strictly lowest fame.
        "braevalar_regenerate" => Some(SkillDefinition {
            id: "braevalar_regenerate",
            usage_type: SkillUsageType::OncePerRound,
            phase_restriction: SkillPhaseRestriction::NoCombat,
            is_motivation: false,
            effect: Some(CardEffect::Noop), // Custom handler
        }),
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
    fn implemented_skills_have_effects() {
        let implemented = [
            // Tier 1 (original 30)
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
            // Tier 2 (pure data — existing CardEffect variants)
            "tovak_shield_mastery",
            "tovak_i_feel_no_pain",
            "goldyx_flight",
            "wolfhawk_deadly_aim",
            "braevalar_thunderstorm",
            "braevalar_lightning_storm",
            "braevalar_beguile",
            // Tier 3 (existing modifier types)
            "krang_battle_hardened",
            "braevalar_elemental_resistance",
            "norowas_leadership",
            // Tier 3b (SelectCombatEnemy + misc)
            "tovak_resistance_break",
            "wolfhawk_taunt",
            "wolfhawk_hawk_eyes",
            "norowas_inspiration",
            "krang_battle_frenzy",
            // Tier 4 (custom handlers)
            "braevalar_feral_allies",
            "braevalar_secret_ways",
            "krang_regenerate",
            "braevalar_regenerate",
            "wolfhawk_dueling",
            // Tier A+B (custom handlers)
            "arythea_invocation",
            "arythea_polarization",
            "norowas_bonds_of_loyalty",
            "wolfhawk_know_your_prey",
            "krang_curse",
            "braevalar_forked_lightning",
        ];
        for id in implemented {
            let skill = get_skill(id).unwrap_or_else(|| panic!("Missing: {}", id));
            assert!(
                skill.effect.is_some(),
                "Implemented skill {} should have an effect",
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
    fn passive_modifiers_correct() {
        // Secret Ways has 2 passive modifiers
        let passives = get_passive_modifiers("braevalar_secret_ways");
        assert_eq!(passives.len(), 2, "Secret Ways should have 2 passive modifiers");

        // Feral Allies has 1 passive modifier
        let passives = get_passive_modifiers("braevalar_feral_allies");
        assert_eq!(passives.len(), 1, "Feral Allies should have 1 passive modifier");

        // Bonds of Loyalty has 1 passive modifier
        let passives = get_passive_modifiers("norowas_bonds_of_loyalty");
        assert_eq!(passives.len(), 1, "Bonds of Loyalty should have 1 passive modifier");

        // Non-passive skill has 0
        let passives = get_passive_modifiers("arythea_dark_paths");
        assert!(passives.is_empty());
    }

    #[test]
    fn stub_skills_have_no_effect() {
        let stubs = [
            "braevalar_shapeshift",
            "krang_puppet_master",
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
