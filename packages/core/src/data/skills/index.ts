/**
 * Skill Definitions
 *
 * Skills are unique abilities gained at even-numbered Fame levels (2, 4, 6, 8, 10).
 * Each hero has 10 unique skills, plus shared skills can enter the common pool.
 *
 * Skill selection mechanics:
 * - Draw 2 skills from hero's remaining pool
 * - Choose one from: drawn pair OR common pool
 * - Rejected skill(s) go to common pool
 *
 * @module data/skills
 */

import type { SkillId } from "@mage-knight/shared";

// ============================================================================
// Hero ID type (to avoid circular dependency with hero.ts)
// ============================================================================

// Use string literals matching Hero enum values to avoid circular import
type HeroId =
  | "arythea"
  | "tovak"
  | "goldyx"
  | "norowas"
  | "wolfhawk"
  | "krang"
  | "braevalar";

// ============================================================================
// Skill Usage Types
// ============================================================================

export const SKILL_USAGE_ONCE_PER_TURN = "once_per_turn" as const;
export const SKILL_USAGE_ONCE_PER_ROUND = "once_per_round" as const;
export const SKILL_USAGE_PASSIVE = "passive" as const;
export const SKILL_USAGE_INTERACTIVE = "interactive" as const;

export type SkillUsageType =
  | typeof SKILL_USAGE_ONCE_PER_TURN
  | typeof SKILL_USAGE_ONCE_PER_ROUND
  | typeof SKILL_USAGE_PASSIVE
  | typeof SKILL_USAGE_INTERACTIVE;

// ============================================================================
// Skill Definition Interface
// ============================================================================

export interface SkillDefinition {
  /** Unique skill identifier */
  readonly id: SkillId;
  /** Display name */
  readonly name: string;
  /** Hero this skill belongs to (null = started in common pool, which shouldn't happen normally) */
  readonly heroId: HeroId | null;
  /** Short description of the skill's effect */
  readonly description: string;
  /** How often the skill can be used */
  readonly usageType: SkillUsageType;
  // Note: effect implementation will be added when skills are fully implemented
}

// ============================================================================
// Skill ID Constants
// ============================================================================

// Arythea Skills
export const SKILL_ARYTHEA_DARK_PATHS = "arythea_dark_paths" as SkillId;
export const SKILL_ARYTHEA_BURNING_POWER = "arythea_burning_power" as SkillId;
export const SKILL_ARYTHEA_HOT_SWORDSMANSHIP = "arythea_hot_swordsmanship" as SkillId;
export const SKILL_ARYTHEA_DARK_NEGOTIATION = "arythea_dark_negotiation" as SkillId;
export const SKILL_ARYTHEA_DARK_FIRE_MAGIC = "arythea_dark_fire_magic" as SkillId;
export const SKILL_ARYTHEA_POWER_OF_PAIN = "arythea_power_of_pain" as SkillId;
export const SKILL_ARYTHEA_INVOCATION = "arythea_invocation" as SkillId;
export const SKILL_ARYTHEA_POLARIZATION = "arythea_polarization" as SkillId;
export const SKILL_ARYTHEA_MOTIVATION = "arythea_motivation" as SkillId;
export const SKILL_ARYTHEA_HEALING_RITUAL = "arythea_healing_ritual" as SkillId;

// Tovak Skills
export const SKILL_TOVAK_DOUBLE_TIME = "tovak_double_time" as SkillId;
export const SKILL_TOVAK_NIGHT_SHARPSHOOTING = "tovak_night_sharpshooting" as SkillId;
export const SKILL_TOVAK_COLD_SWORDSMANSHIP = "tovak_cold_swordsmanship" as SkillId;
export const SKILL_TOVAK_SHIELD_MASTERY = "tovak_shield_mastery" as SkillId;
export const SKILL_TOVAK_RESISTANCE_BREAK = "tovak_resistance_break" as SkillId;
export const SKILL_TOVAK_I_FEEL_NO_PAIN = "tovak_i_feel_no_pain" as SkillId;
export const SKILL_TOVAK_I_DONT_GIVE_A_DAMN = "tovak_i_dont_give_a_damn" as SkillId;
export const SKILL_TOVAK_WHO_NEEDS_MAGIC = "tovak_who_needs_magic" as SkillId;
export const SKILL_TOVAK_MOTIVATION = "tovak_motivation" as SkillId;
export const SKILL_TOVAK_MANA_EXPLOIT = "tovak_mana_exploit" as SkillId;

// Goldyx Skills
export const SKILL_GOLDYX_FREEZING_POWER = "goldyx_freezing_power" as SkillId;
export const SKILL_GOLDYX_POTION_MAKING = "goldyx_potion_making" as SkillId;
export const SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT = "goldyx_white_crystal_craft" as SkillId;
export const SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT = "goldyx_green_crystal_craft" as SkillId;
export const SKILL_GOLDYX_RED_CRYSTAL_CRAFT = "goldyx_red_crystal_craft" as SkillId;
export const SKILL_GOLDYX_GLITTERING_FORTUNE = "goldyx_glittering_fortune" as SkillId;
export const SKILL_GOLDYX_FLIGHT = "goldyx_flight" as SkillId;
export const SKILL_GOLDYX_UNIVERSAL_POWER = "goldyx_universal_power" as SkillId;
export const SKILL_GOLDYX_MOTIVATION = "goldyx_motivation" as SkillId;
export const SKILL_GOLDYX_SOURCE_FREEZE = "goldyx_source_freeze" as SkillId;

// Norowas Skills
export const SKILL_NOROWAS_FORWARD_MARCH = "norowas_forward_march" as SkillId;
export const SKILL_NOROWAS_DAY_SHARPSHOOTING = "norowas_day_sharpshooting" as SkillId;
export const SKILL_NOROWAS_INSPIRATION = "norowas_inspiration" as SkillId;
export const SKILL_NOROWAS_BRIGHT_NEGOTIATION = "norowas_bright_negotiation" as SkillId;
export const SKILL_NOROWAS_LEAVES_IN_THE_WIND = "norowas_leaves_in_the_wind" as SkillId;
export const SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS = "norowas_whispers_in_the_treetops" as SkillId;
export const SKILL_NOROWAS_LEADERSHIP = "norowas_leadership" as SkillId;
export const SKILL_NOROWAS_BONDS_OF_LOYALTY = "norowas_bonds_of_loyalty" as SkillId;
export const SKILL_NOROWAS_MOTIVATION = "norowas_motivation" as SkillId;
export const SKILL_NOROWAS_PRAYER_OF_WEATHER = "norowas_prayer_of_weather" as SkillId;

// Wolfhawk Skills
export const SKILL_WOLFHAWK_REFRESHING_BATH = "wolfhawk_refreshing_bath" as SkillId;
export const SKILL_WOLFHAWK_REFRESHING_BREEZE = "wolfhawk_refreshing_breeze" as SkillId;
export const SKILL_WOLFHAWK_HAWK_EYES = "wolfhawk_hawk_eyes" as SkillId;
export const SKILL_WOLFHAWK_ON_HER_OWN = "wolfhawk_on_her_own" as SkillId;
export const SKILL_WOLFHAWK_DEADLY_AIM = "wolfhawk_deadly_aim" as SkillId;
export const SKILL_WOLFHAWK_KNOW_YOUR_PREY = "wolfhawk_know_your_prey" as SkillId;
export const SKILL_WOLFHAWK_TAUNT = "wolfhawk_taunt" as SkillId;
export const SKILL_WOLFHAWK_DUELING = "wolfhawk_dueling" as SkillId;
export const SKILL_WOLFHAWK_MOTIVATION = "wolfhawk_motivation" as SkillId;
export const SKILL_WOLFHAWK_WOLFS_HOWL = "wolfhawk_wolfs_howl" as SkillId;

// Krang Skills
export const SKILL_KRANG_SPIRIT_GUIDES = "krang_spirit_guides" as SkillId;
export const SKILL_KRANG_BATTLE_HARDENED = "krang_battle_hardened" as SkillId;
export const SKILL_KRANG_BATTLE_FRENZY = "krang_battle_frenzy" as SkillId;
export const SKILL_KRANG_SHAMANIC_RITUAL = "krang_shamanic_ritual" as SkillId;
export const SKILL_KRANG_REGENERATE = "krang_regenerate" as SkillId;
export const SKILL_KRANG_ARCANE_DISGUISE = "krang_arcane_disguise" as SkillId;
export const SKILL_KRANG_PUPPET_MASTER = "krang_puppet_master" as SkillId;
export const SKILL_KRANG_MASTER_OF_CHAOS = "krang_master_of_chaos" as SkillId;
export const SKILL_KRANG_CURSE = "krang_curse" as SkillId;
export const SKILL_KRANG_MANA_SUPPRESSION = "krang_mana_suppression" as SkillId;

// Braevalar Skills
export const SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE = "braevalar_elemental_resistance" as SkillId;
export const SKILL_BRAEVALAR_FERAL_ALLIES = "braevalar_feral_allies" as SkillId;
export const SKILL_BRAEVALAR_THUNDERSTORM = "braevalar_thunderstorm" as SkillId;
export const SKILL_BRAEVALAR_LIGHTNING_STORM = "braevalar_lightning_storm" as SkillId;
export const SKILL_BRAEVALAR_BEGUILE = "braevalar_beguile" as SkillId;
export const SKILL_BRAEVALAR_FORKED_LIGHTNING = "braevalar_forked_lightning" as SkillId;
export const SKILL_BRAEVALAR_SHAPESHIFT = "braevalar_shapeshift" as SkillId;
export const SKILL_BRAEVALAR_SECRET_WAYS = "braevalar_secret_ways" as SkillId;
export const SKILL_BRAEVALAR_REGENERATE = "braevalar_regenerate" as SkillId;
export const SKILL_BRAEVALAR_NATURES_VENGEANCE = "braevalar_natures_vengeance" as SkillId;

// ============================================================================
// Skill Definitions
// ============================================================================

/**
 * All skill definitions keyed by skill ID.
 * Each hero has 10 skills (70 total).
 */
export const SKILLS: Record<SkillId, SkillDefinition> = {
  // === Arythea Skills ===
  [SKILL_ARYTHEA_DARK_PATHS]: {
    id: SKILL_ARYTHEA_DARK_PATHS,
    name: "Dark Paths",
    heroId: "arythea",
    description: "Move 1 (Day) or Move 2 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_ARYTHEA_BURNING_POWER]: {
    id: SKILL_ARYTHEA_BURNING_POWER,
    name: "Burning Power",
    heroId: "arythea",
    description: "Siege Attack 1 or Fire Siege Attack 1",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_ARYTHEA_HOT_SWORDSMANSHIP]: {
    id: SKILL_ARYTHEA_HOT_SWORDSMANSHIP,
    name: "Hot Swordsmanship",
    heroId: "arythea",
    description: "Attack 2 or Fire Attack 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_ARYTHEA_DARK_NEGOTIATION]: {
    id: SKILL_ARYTHEA_DARK_NEGOTIATION,
    name: "Dark Negotiation",
    heroId: "arythea",
    description: "Influence 2 (Day) or Influence 3 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_ARYTHEA_DARK_FIRE_MAGIC]: {
    id: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
    name: "Dark Fire Magic",
    heroId: "arythea",
    description: "Flip to gain 1 red crystal and 1 red or black mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_ARYTHEA_POWER_OF_PAIN]: {
    id: SKILL_ARYTHEA_POWER_OF_PAIN,
    name: "Power of Pain",
    heroId: "arythea",
    description: "Play 1 Wound sideways as non-Wound card: +2 instead of +1",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_ARYTHEA_INVOCATION]: {
    id: SKILL_ARYTHEA_INVOCATION,
    name: "Invocation",
    heroId: "arythea",
    description: "Discard Wound: gain red/black mana. Discard non-Wound: gain white/green mana",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_ARYTHEA_POLARIZATION]: {
    id: SKILL_ARYTHEA_POLARIZATION,
    name: "Polarization",
    heroId: "arythea",
    description: "Use 1 mana as opposite color. Day: black → any. Night: gold → black",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_ARYTHEA_MOTIVATION]: {
    id: SKILL_ARYTHEA_MOTIVATION,
    name: "Motivation",
    heroId: "arythea",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 red mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_ARYTHEA_HEALING_RITUAL]: {
    id: SKILL_ARYTHEA_HEALING_RITUAL,
    name: "Healing Ritual",
    heroId: "arythea",
    description: "Flip (except combat): Discard up to 2 Wounds, one goes to closest hero",
    usageType: SKILL_USAGE_INTERACTIVE,
  },

  // === Tovak Skills ===
  [SKILL_TOVAK_DOUBLE_TIME]: {
    id: SKILL_TOVAK_DOUBLE_TIME,
    name: "Double Time",
    heroId: "tovak",
    description: "Move 2 (Day) or Move 1 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_TOVAK_NIGHT_SHARPSHOOTING]: {
    id: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
    name: "Night Sharpshooting",
    heroId: "tovak",
    description: "Ranged Attack 1 (Day) or Ranged Attack 2 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_TOVAK_COLD_SWORDSMANSHIP]: {
    id: SKILL_TOVAK_COLD_SWORDSMANSHIP,
    name: "Cold Swordsmanship",
    heroId: "tovak",
    description: "Attack 2 or Ice Attack 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_TOVAK_SHIELD_MASTERY]: {
    id: SKILL_TOVAK_SHIELD_MASTERY,
    name: "Shield Mastery",
    heroId: "tovak",
    description: "Block 3, or Fire Block 2, or Ice Block 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_TOVAK_RESISTANCE_BREAK]: {
    id: SKILL_TOVAK_RESISTANCE_BREAK,
    name: "Resistance Break",
    heroId: "tovak",
    description: "Target enemy: Armor -1 for each resistance it has (min 1)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_TOVAK_I_FEEL_NO_PAIN]: {
    id: SKILL_TOVAK_I_FEEL_NO_PAIN,
    name: "I Feel No Pain",
    heroId: "tovak",
    description: "Except in combat: Discard 1 Wound from hand, draw a card",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_TOVAK_I_DONT_GIVE_A_DAMN]: {
    id: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
    name: "I Don't Give a Damn",
    heroId: "tovak",
    description: "One sideways card gives +2 instead of +1. AA/Spell/Artifact gives +3",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_TOVAK_WHO_NEEDS_MAGIC]: {
    id: SKILL_TOVAK_WHO_NEEDS_MAGIC,
    name: "Who Needs Magic?",
    heroId: "tovak",
    description: "One sideways card gives +2 instead of +1. No die used: +3 instead",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_TOVAK_MOTIVATION]: {
    id: SKILL_TOVAK_MOTIVATION,
    name: "Motivation",
    heroId: "tovak",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 blue mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_TOVAK_MANA_EXPLOIT]: {
    id: SKILL_TOVAK_MANA_EXPLOIT,
    name: "Mana Exploit",
    heroId: "tovak",
    description: "Gain non-gold mana token. Others take Wounds using other colors",
    usageType: SKILL_USAGE_INTERACTIVE,
  },

  // === Goldyx Skills ===
  [SKILL_GOLDYX_FREEZING_POWER]: {
    id: SKILL_GOLDYX_FREEZING_POWER,
    name: "Freezing Power",
    heroId: "goldyx",
    description: "Siege Attack 1 or Ice Siege Attack 1",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_GOLDYX_POTION_MAKING]: {
    id: SKILL_GOLDYX_POTION_MAKING,
    name: "Potion Making",
    heroId: "goldyx",
    description: "Flip for Heal 2 (except in combat)",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT]: {
    id: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
    name: "White Crystal Craft",
    heroId: "goldyx",
    description: "Flip to gain 1 blue crystal and 1 white mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT]: {
    id: SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT,
    name: "Green Crystal Craft",
    heroId: "goldyx",
    description: "Flip to gain 1 blue crystal and 1 green mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_GOLDYX_RED_CRYSTAL_CRAFT]: {
    id: SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
    name: "Red Crystal Craft",
    heroId: "goldyx",
    description: "Flip to gain 1 blue crystal and 1 red mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_GOLDYX_GLITTERING_FORTUNE]: {
    id: SKILL_GOLDYX_GLITTERING_FORTUNE,
    name: "Glittering Fortune",
    heroId: "goldyx",
    description: "During interaction: Influence 1 per different color crystal",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_GOLDYX_FLIGHT]: {
    id: SKILL_GOLDYX_FLIGHT,
    name: "Flight",
    heroId: "goldyx",
    description: "Flip to move to adjacent space free, or 2 spaces for 2 Move",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_GOLDYX_UNIVERSAL_POWER]: {
    id: SKILL_GOLDYX_UNIVERSAL_POWER,
    name: "Universal Power",
    heroId: "goldyx",
    description: "Add 1 mana to sideways card: +3 instead of +1. Same color: +4",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_GOLDYX_MOTIVATION]: {
    id: SKILL_GOLDYX_MOTIVATION,
    name: "Motivation",
    heroId: "goldyx",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 green mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_GOLDYX_SOURCE_FREEZE]: {
    id: SKILL_GOLDYX_SOURCE_FREEZE,
    name: "Source Freeze",
    heroId: "goldyx",
    description: "Place in Source. Others can't use standard die. Gain crystal on next turn",
    usageType: SKILL_USAGE_INTERACTIVE,
  },

  // === Norowas Skills ===
  [SKILL_NOROWAS_FORWARD_MARCH]: {
    id: SKILL_NOROWAS_FORWARD_MARCH,
    name: "Forward March",
    heroId: "norowas",
    description: "Move 1 for each Ready and Unwounded Unit (max Move 3)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_NOROWAS_DAY_SHARPSHOOTING]: {
    id: SKILL_NOROWAS_DAY_SHARPSHOOTING,
    name: "Day Sharpshooting",
    heroId: "norowas",
    description: "Ranged Attack 2 (Day) or Ranged Attack 1 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_NOROWAS_INSPIRATION]: {
    id: SKILL_NOROWAS_INSPIRATION,
    name: "Inspiration",
    heroId: "norowas",
    description: "Flip to Ready or Heal a Unit (except in combat)",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_NOROWAS_BRIGHT_NEGOTIATION]: {
    id: SKILL_NOROWAS_BRIGHT_NEGOTIATION,
    name: "Bright Negotiation",
    heroId: "norowas",
    description: "Influence 3 (Day) or Influence 2 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_NOROWAS_LEAVES_IN_THE_WIND]: {
    id: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
    name: "Leaves in the Wind",
    heroId: "norowas",
    description: "Flip to gain 1 green crystal and 1 white mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS]: {
    id: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
    name: "Whispers in the Treetops",
    heroId: "norowas",
    description: "Flip to gain 1 white crystal and 1 green mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_NOROWAS_LEADERSHIP]: {
    id: SKILL_NOROWAS_LEADERSHIP,
    name: "Leadership",
    heroId: "norowas",
    description: "When activating Unit: +3 Block, +2 Attack, or +1 Ranged Attack",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_NOROWAS_BONDS_OF_LOYALTY]: {
    id: SKILL_NOROWAS_BONDS_OF_LOYALTY,
    name: "Bonds of Loyalty",
    heroId: "norowas",
    description: "Acts as Command token. Unit costs -5 Influence. Cannot be disbanded",
    usageType: SKILL_USAGE_PASSIVE,
  },
  [SKILL_NOROWAS_MOTIVATION]: {
    id: SKILL_NOROWAS_MOTIVATION,
    name: "Motivation",
    heroId: "norowas",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 white mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_NOROWAS_PRAYER_OF_WEATHER]: {
    id: SKILL_NOROWAS_PRAYER_OF_WEATHER,
    name: "Prayer of Weather",
    heroId: "norowas",
    description: "Until your next turn: your terrain costs -2, others' costs +1",
    usageType: SKILL_USAGE_INTERACTIVE,
  },

  // === Wolfhawk Skills ===
  [SKILL_WOLFHAWK_REFRESHING_BATH]: {
    id: SKILL_WOLFHAWK_REFRESHING_BATH,
    name: "Refreshing Bath",
    heroId: "wolfhawk",
    description: "Flip for Heal 1 and 1 blue crystal (except combat)",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_WOLFHAWK_REFRESHING_BREEZE]: {
    id: SKILL_WOLFHAWK_REFRESHING_BREEZE,
    name: "Refreshing Breeze",
    heroId: "wolfhawk",
    description: "Flip for Heal 1 and 1 white crystal (except combat)",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_WOLFHAWK_HAWK_EYES]: {
    id: SKILL_WOLFHAWK_HAWK_EYES,
    name: "Hawk Eyes",
    heroId: "wolfhawk",
    description: "Move 1. Night: exploring -1. Day: reveal garrisons at distance 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_WOLFHAWK_ON_HER_OWN]: {
    id: SKILL_WOLFHAWK_ON_HER_OWN,
    name: "On Her Own",
    heroId: "wolfhawk",
    description: "Influence 1. Influence 3 if no Unit recruited this turn",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_WOLFHAWK_DEADLY_AIM]: {
    id: SKILL_WOLFHAWK_DEADLY_AIM,
    name: "Deadly Aim",
    heroId: "wolfhawk",
    description: "Ranged/Siege: +1 to Attack. Attack phase: +2 to Attack",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_WOLFHAWK_KNOW_YOUR_PREY]: {
    id: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
    name: "Know Your Prey",
    heroId: "wolfhawk",
    description: "Flip to ignore one enemy ability or remove attack element",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_WOLFHAWK_TAUNT]: {
    id: SKILL_WOLFHAWK_TAUNT,
    name: "Taunt",
    heroId: "wolfhawk",
    description: "Block phase: Enemy attack -1, OR +2 attack but armor -2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_WOLFHAWK_DUELING]: {
    id: SKILL_WOLFHAWK_DUELING,
    name: "Dueling",
    heroId: "wolfhawk",
    description: "Block 1 and Attack 1 vs same enemy. +1 Fame without Units",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_WOLFHAWK_MOTIVATION]: {
    id: SKILL_WOLFHAWK_MOTIVATION,
    name: "Motivation",
    heroId: "wolfhawk",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 Fame",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_WOLFHAWK_WOLFS_HOWL]: {
    id: SKILL_WOLFHAWK_WOLFS_HOWL,
    name: "Wolf's Howl",
    heroId: "wolfhawk",
    description: "Sideways card +4. +1 per Command token without Unit. Others' Units -1",
    usageType: SKILL_USAGE_INTERACTIVE,
  },

  // === Krang Skills ===
  [SKILL_KRANG_SPIRIT_GUIDES]: {
    id: SKILL_KRANG_SPIRIT_GUIDES,
    name: "Spirit Guides",
    heroId: "krang",
    description: "Move 1 and may add +1 to a Block",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_KRANG_BATTLE_HARDENED]: {
    id: SKILL_KRANG_BATTLE_HARDENED,
    name: "Battle Hardened",
    heroId: "krang",
    description: "Ignore 2 physical damage or 1 non-physical damage",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_KRANG_BATTLE_FRENZY]: {
    id: SKILL_KRANG_BATTLE_FRENZY,
    name: "Battle Frenzy",
    heroId: "krang",
    description: "Attack 2. Flip for Attack 4. Flip back when resting",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_KRANG_SHAMANIC_RITUAL]: {
    id: SKILL_KRANG_SHAMANIC_RITUAL,
    name: "Shamanic Ritual",
    heroId: "krang",
    description: "Flip to gain mana of any color. May flip back as action",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_KRANG_REGENERATE]: {
    id: SKILL_KRANG_REGENERATE,
    name: "Regenerate",
    heroId: "krang",
    description: "Pay mana, discard Wound. Red mana or lowest Fame: draw card",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_KRANG_ARCANE_DISGUISE]: {
    id: SKILL_KRANG_ARCANE_DISGUISE,
    name: "Arcane Disguise",
    heroId: "krang",
    description: "Influence 2, or flip to ignore reputation. Green mana to flip back",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_KRANG_PUPPET_MASTER]: {
    id: SKILL_KRANG_PUPPET_MASTER,
    name: "Puppet Master",
    heroId: "krang",
    description: "Keep defeated enemy token. Discard for half Attack or half Block",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_KRANG_MASTER_OF_CHAOS]: {
    id: SKILL_KRANG_MASTER_OF_CHAOS,
    name: "Master of Chaos",
    heroId: "krang",
    description: "Rotate shield for: Block 3, Move 1, Ranged 1, Influence 2, Attack 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_KRANG_CURSE]: {
    id: SKILL_KRANG_CURSE,
    name: "Curse",
    heroId: "krang",
    description: "Enemy Attack -1 or Armor -1 (min 1). Not vs fortified in Ranged",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_KRANG_MANA_SUPPRESSION]: {
    id: SKILL_KRANG_MANA_SUPPRESSION,
    name: "Mana Suppression",
    heroId: "krang",
    description: "First mana each turn costs extra. Gain crystal from tokens",
    usageType: SKILL_USAGE_INTERACTIVE,
  },

  // === Braevalar Skills ===
  [SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE]: {
    id: SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE,
    name: "Elemental Resistance",
    heroId: "braevalar",
    description: "Ignore 2 Fire/Ice damage or 1 other damage",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_BRAEVALAR_FERAL_ALLIES]: {
    id: SKILL_BRAEVALAR_FERAL_ALLIES,
    name: "Feral Allies",
    heroId: "braevalar",
    description: "Exploring -1 Move. Attack 1 or reduce enemy attack by 1",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_BRAEVALAR_THUNDERSTORM]: {
    id: SKILL_BRAEVALAR_THUNDERSTORM,
    name: "Thunderstorm",
    heroId: "braevalar",
    description: "Flip to gain 1 green/blue mana and 1 green/white mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_BRAEVALAR_LIGHTNING_STORM]: {
    id: SKILL_BRAEVALAR_LIGHTNING_STORM,
    name: "Lightning Storm",
    heroId: "braevalar",
    description: "Flip to gain 1 blue/green mana and 1 blue/red mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
  },
  [SKILL_BRAEVALAR_BEGUILE]: {
    id: SKILL_BRAEVALAR_BEGUILE,
    name: "Beguile",
    heroId: "braevalar",
    description: "Influence 3. Fortified: 2. Magical Glade: 4",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_BRAEVALAR_FORKED_LIGHTNING]: {
    id: SKILL_BRAEVALAR_FORKED_LIGHTNING,
    name: "Forked Lightning",
    heroId: "braevalar",
    description: "Ranged Cold Fire Attack 1 against up to 3 enemies",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_BRAEVALAR_SHAPESHIFT]: {
    id: SKILL_BRAEVALAR_SHAPESHIFT,
    name: "Shapeshift",
    heroId: "braevalar",
    description: "Basic Action with Move/Attack/Block becomes another type",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_BRAEVALAR_SECRET_WAYS]: {
    id: SKILL_BRAEVALAR_SECRET_WAYS,
    name: "Secret Ways",
    heroId: "braevalar",
    description: "Move 1. Mountains 5 Move. Blue mana: lakes 2 Move",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_BRAEVALAR_REGENERATE]: {
    id: SKILL_BRAEVALAR_REGENERATE,
    name: "Regenerate",
    heroId: "braevalar",
    description: "Pay mana, discard Wound. Red mana or lowest Fame: draw card",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
  },
  [SKILL_BRAEVALAR_NATURES_VENGEANCE]: {
    id: SKILL_BRAEVALAR_NATURES_VENGEANCE,
    name: "Nature's Vengeance",
    heroId: "braevalar",
    description: "Reduce enemy attack by 1, gains Cumbersome. Others' enemies +1 attack",
    usageType: SKILL_USAGE_INTERACTIVE,
  },
} as Record<SkillId, SkillDefinition>;

// ============================================================================
// Hero Skill Lists
// ============================================================================

/**
 * Skills belonging to each hero.
 * These are drawn from during level up.
 */
export const HERO_SKILLS: Record<HeroId, readonly SkillId[]> = {
  arythea: [
    SKILL_ARYTHEA_DARK_PATHS,
    SKILL_ARYTHEA_BURNING_POWER,
    SKILL_ARYTHEA_HOT_SWORDSMANSHIP,
    SKILL_ARYTHEA_DARK_NEGOTIATION,
    SKILL_ARYTHEA_DARK_FIRE_MAGIC,
    SKILL_ARYTHEA_POWER_OF_PAIN,
    SKILL_ARYTHEA_INVOCATION,
    SKILL_ARYTHEA_POLARIZATION,
    SKILL_ARYTHEA_MOTIVATION,
    SKILL_ARYTHEA_HEALING_RITUAL,
  ],
  tovak: [
    SKILL_TOVAK_DOUBLE_TIME,
    SKILL_TOVAK_NIGHT_SHARPSHOOTING,
    SKILL_TOVAK_COLD_SWORDSMANSHIP,
    SKILL_TOVAK_SHIELD_MASTERY,
    SKILL_TOVAK_RESISTANCE_BREAK,
    SKILL_TOVAK_I_FEEL_NO_PAIN,
    SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
    SKILL_TOVAK_WHO_NEEDS_MAGIC,
    SKILL_TOVAK_MOTIVATION,
    SKILL_TOVAK_MANA_EXPLOIT,
  ],
  goldyx: [
    SKILL_GOLDYX_FREEZING_POWER,
    SKILL_GOLDYX_POTION_MAKING,
    SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
    SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT,
    SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
    SKILL_GOLDYX_GLITTERING_FORTUNE,
    SKILL_GOLDYX_FLIGHT,
    SKILL_GOLDYX_UNIVERSAL_POWER,
    SKILL_GOLDYX_MOTIVATION,
    SKILL_GOLDYX_SOURCE_FREEZE,
  ],
  norowas: [
    SKILL_NOROWAS_FORWARD_MARCH,
    SKILL_NOROWAS_DAY_SHARPSHOOTING,
    SKILL_NOROWAS_INSPIRATION,
    SKILL_NOROWAS_BRIGHT_NEGOTIATION,
    SKILL_NOROWAS_LEAVES_IN_THE_WIND,
    SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
    SKILL_NOROWAS_LEADERSHIP,
    SKILL_NOROWAS_BONDS_OF_LOYALTY,
    SKILL_NOROWAS_MOTIVATION,
    SKILL_NOROWAS_PRAYER_OF_WEATHER,
  ],
  wolfhawk: [
    SKILL_WOLFHAWK_REFRESHING_BATH,
    SKILL_WOLFHAWK_REFRESHING_BREEZE,
    SKILL_WOLFHAWK_HAWK_EYES,
    SKILL_WOLFHAWK_ON_HER_OWN,
    SKILL_WOLFHAWK_DEADLY_AIM,
    SKILL_WOLFHAWK_KNOW_YOUR_PREY,
    SKILL_WOLFHAWK_TAUNT,
    SKILL_WOLFHAWK_DUELING,
    SKILL_WOLFHAWK_MOTIVATION,
    SKILL_WOLFHAWK_WOLFS_HOWL,
  ],
  krang: [
    SKILL_KRANG_SPIRIT_GUIDES,
    SKILL_KRANG_BATTLE_HARDENED,
    SKILL_KRANG_BATTLE_FRENZY,
    SKILL_KRANG_SHAMANIC_RITUAL,
    SKILL_KRANG_REGENERATE,
    SKILL_KRANG_ARCANE_DISGUISE,
    SKILL_KRANG_PUPPET_MASTER,
    SKILL_KRANG_MASTER_OF_CHAOS,
    SKILL_KRANG_CURSE,
    SKILL_KRANG_MANA_SUPPRESSION,
  ],
  braevalar: [
    SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE,
    SKILL_BRAEVALAR_FERAL_ALLIES,
    SKILL_BRAEVALAR_THUNDERSTORM,
    SKILL_BRAEVALAR_LIGHTNING_STORM,
    SKILL_BRAEVALAR_BEGUILE,
    SKILL_BRAEVALAR_FORKED_LIGHTNING,
    SKILL_BRAEVALAR_SHAPESHIFT,
    SKILL_BRAEVALAR_SECRET_WAYS,
    SKILL_BRAEVALAR_REGENERATE,
    SKILL_BRAEVALAR_NATURES_VENGEANCE,
  ],
};

/**
 * Get the skill definition for a given skill ID.
 */
export function getSkillDefinition(skillId: SkillId): SkillDefinition | undefined {
  return SKILLS[skillId];
}

/**
 * Get all skills for a hero.
 */
export function getHeroSkills(hero: HeroId): readonly SkillId[] {
  return HERO_SKILLS[hero] ?? [];
}
