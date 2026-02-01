/**
 * Arythea Skills - Aggregation Module
 *
 * ## Adding a New Skill
 *
 * 1. Create a new file with the skill constant and definition
 * 2. Add export * from "./newSkill.js" below
 * 3. Import the definition and add to ARYTHEA_SKILLS and ARYTHEA_SKILL_IDS
 *
 * @module data/skills/arythea
 */

import type { SkillId } from "@mage-knight/shared";
import type { SkillDefinition } from "../types.js";

// Re-export all skill constants
export * from "./darkPaths.js";
export * from "./burningPower.js";
export * from "./hotSwordsmanship.js";
export * from "./darkNegotiation.js";
export * from "./darkFireMagic.js";
export * from "./powerOfPain.js";
export * from "./invocation.js";
export * from "./polarization.js";
export * from "./motivation.js";
export * from "./healingRitual.js";

// Import definitions for aggregation
import { SKILL_ARYTHEA_DARK_PATHS, darkPaths } from "./darkPaths.js";
import { SKILL_ARYTHEA_BURNING_POWER, burningPower } from "./burningPower.js";
import { SKILL_ARYTHEA_HOT_SWORDSMANSHIP, hotSwordsmanship } from "./hotSwordsmanship.js";
import { SKILL_ARYTHEA_DARK_NEGOTIATION, darkNegotiation } from "./darkNegotiation.js";
import { SKILL_ARYTHEA_DARK_FIRE_MAGIC, darkFireMagic } from "./darkFireMagic.js";
import { SKILL_ARYTHEA_POWER_OF_PAIN, powerOfPain } from "./powerOfPain.js";
import { SKILL_ARYTHEA_INVOCATION, invocation } from "./invocation.js";
import { SKILL_ARYTHEA_POLARIZATION, polarization } from "./polarization.js";
import { SKILL_ARYTHEA_MOTIVATION, arytheaMotivation } from "./motivation.js";
import { SKILL_ARYTHEA_HEALING_RITUAL, healingRitual } from "./healingRitual.js";

/**
 * All Arythea skill definitions keyed by skill ID.
 */
export const ARYTHEA_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_ARYTHEA_DARK_PATHS]: darkPaths,
  [SKILL_ARYTHEA_BURNING_POWER]: burningPower,
  [SKILL_ARYTHEA_HOT_SWORDSMANSHIP]: hotSwordsmanship,
  [SKILL_ARYTHEA_DARK_NEGOTIATION]: darkNegotiation,
  [SKILL_ARYTHEA_DARK_FIRE_MAGIC]: darkFireMagic,
  [SKILL_ARYTHEA_POWER_OF_PAIN]: powerOfPain,
  [SKILL_ARYTHEA_INVOCATION]: invocation,
  [SKILL_ARYTHEA_POLARIZATION]: polarization,
  [SKILL_ARYTHEA_MOTIVATION]: arytheaMotivation,
  [SKILL_ARYTHEA_HEALING_RITUAL]: healingRitual,
};

/**
 * Ordered list of Arythea skill IDs for level-up draws.
 */
export const ARYTHEA_SKILL_IDS = [
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
] as const;
