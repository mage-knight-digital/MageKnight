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
// Re-export types
// ============================================================================

export {
  type HeroId,
  type SkillDefinition,
  type SkillUsageType,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_USAGE_PASSIVE,
  SKILL_USAGE_INTERACTIVE,
} from "./types.js";

// ============================================================================
// Re-export all Skill ID Constants
// ============================================================================

// Arythea Skills
export {
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
} from "./arythea.js";

// Tovak Skills
export {
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
} from "./tovak.js";

// Goldyx Skills
export {
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
} from "./goldyx.js";

// Norowas Skills
export {
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
} from "./norowas.js";

// Wolfhawk Skills
export {
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
} from "./wolfhawk.js";

// Krang Skills
export {
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
} from "./krang.js";

// Braevalar Skills
export {
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
} from "./braevalar.js";

// ============================================================================
// Import hero skill modules for combining
// ============================================================================

import { ARYTHEA_SKILLS, ARYTHEA_SKILL_IDS } from "./arythea.js";
import { TOVAK_SKILLS, TOVAK_SKILL_IDS } from "./tovak.js";
import { GOLDYX_SKILLS, GOLDYX_SKILL_IDS } from "./goldyx.js";
import { NOROWAS_SKILLS, NOROWAS_SKILL_IDS } from "./norowas.js";
import { WOLFHAWK_SKILLS, WOLFHAWK_SKILL_IDS } from "./wolfhawk.js";
import { KRANG_SKILLS, KRANG_SKILL_IDS } from "./krang.js";
import { BRAEVALAR_SKILLS, BRAEVALAR_SKILL_IDS } from "./braevalar.js";

import type { HeroId, SkillDefinition } from "./types.js";

// ============================================================================
// Combined Skill Definitions
// ============================================================================

/**
 * All skill definitions keyed by skill ID.
 * Each hero has 10 skills (70 total).
 */
export const SKILLS: Record<SkillId, SkillDefinition> = {
  ...ARYTHEA_SKILLS,
  ...TOVAK_SKILLS,
  ...GOLDYX_SKILLS,
  ...NOROWAS_SKILLS,
  ...WOLFHAWK_SKILLS,
  ...KRANG_SKILLS,
  ...BRAEVALAR_SKILLS,
} as Record<SkillId, SkillDefinition>;

// ============================================================================
// Hero Skill Lists
// ============================================================================

/**
 * Skills belonging to each hero.
 * These are drawn from during level up.
 */
export const HERO_SKILLS: Record<HeroId, readonly SkillId[]> = {
  arythea: ARYTHEA_SKILL_IDS,
  tovak: TOVAK_SKILL_IDS,
  goldyx: GOLDYX_SKILL_IDS,
  norowas: NOROWAS_SKILL_IDS,
  wolfhawk: WOLFHAWK_SKILL_IDS,
  krang: KRANG_SKILL_IDS,
  braevalar: BRAEVALAR_SKILL_IDS,
};

// ============================================================================
// Helper Functions
// ============================================================================

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
