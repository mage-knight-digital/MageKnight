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
 * ## Adding New Skills
 *
 * To add a new skill, only modify the hero's file (e.g., arythea.ts):
 * 1. Add the skill ID constant
 * 2. Add the skill definition to HERO_SKILLS record
 * 3. Add the ID to HERO_SKILL_IDS array
 *
 * No changes needed to this index file - wildcard exports handle it automatically.
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
// Re-export all Skill ID Constants (via wildcard exports)
//
// Using `export *` means adding a new skill to a hero file automatically
// makes it available here - no need to update this file.
// ============================================================================

export * from "./arythea.js";
export * from "./tovak.js";
export * from "./goldyx.js";
export * from "./norowas.js";
export * from "./wolfhawk.js";
export * from "./krang.js";
export * from "./braevalar.js";

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
