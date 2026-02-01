/**
 * Tovak Skills - Aggregation Module
 *
 * ## Adding a New Skill
 *
 * 1. Create a new file with the skill constant and definition
 * 2. Add export * from "./newSkill.js" below
 * 3. Import the definition and add to TOVAK_SKILLS and TOVAK_SKILL_IDS
 *
 * @module data/skills/tovak
 */

import type { SkillId } from "@mage-knight/shared";
import type { SkillDefinition } from "../types.js";

// Re-export all skill constants
export * from "./doubleTime.js";
export * from "./nightSharpshooting.js";
export * from "./coldSwordsmanship.js";
export * from "./shieldMastery.js";
export * from "./resistanceBreak.js";
export * from "./iFeelNoPain.js";
export * from "./iDontGiveADamn.js";
export * from "./whoNeedsMagic.js";
export * from "./motivation.js";
export * from "./manaExploit.js";

// Import definitions for aggregation
import { SKILL_TOVAK_DOUBLE_TIME, doubleTime } from "./doubleTime.js";
import { SKILL_TOVAK_NIGHT_SHARPSHOOTING, nightSharpshooting } from "./nightSharpshooting.js";
import { SKILL_TOVAK_COLD_SWORDSMANSHIP, coldSwordsmanship } from "./coldSwordsmanship.js";
import { SKILL_TOVAK_SHIELD_MASTERY, shieldMastery } from "./shieldMastery.js";
import { SKILL_TOVAK_RESISTANCE_BREAK, resistanceBreak } from "./resistanceBreak.js";
import { SKILL_TOVAK_I_FEEL_NO_PAIN, iFeelNoPain } from "./iFeelNoPain.js";
import { SKILL_TOVAK_I_DONT_GIVE_A_DAMN, iDontGiveADamn } from "./iDontGiveADamn.js";
import { SKILL_TOVAK_WHO_NEEDS_MAGIC, whoNeedsMagic } from "./whoNeedsMagic.js";
import { SKILL_TOVAK_MOTIVATION, tovakMotivation } from "./motivation.js";
import { SKILL_TOVAK_MANA_EXPLOIT, manaExploit } from "./manaExploit.js";

/**
 * All Tovak skill definitions keyed by skill ID.
 */
export const TOVAK_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_TOVAK_DOUBLE_TIME]: doubleTime,
  [SKILL_TOVAK_NIGHT_SHARPSHOOTING]: nightSharpshooting,
  [SKILL_TOVAK_COLD_SWORDSMANSHIP]: coldSwordsmanship,
  [SKILL_TOVAK_SHIELD_MASTERY]: shieldMastery,
  [SKILL_TOVAK_RESISTANCE_BREAK]: resistanceBreak,
  [SKILL_TOVAK_I_FEEL_NO_PAIN]: iFeelNoPain,
  [SKILL_TOVAK_I_DONT_GIVE_A_DAMN]: iDontGiveADamn,
  [SKILL_TOVAK_WHO_NEEDS_MAGIC]: whoNeedsMagic,
  [SKILL_TOVAK_MOTIVATION]: tovakMotivation,
  [SKILL_TOVAK_MANA_EXPLOIT]: manaExploit,
};

/**
 * Ordered list of Tovak skill IDs for level-up draws.
 */
export const TOVAK_SKILL_IDS = [
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
] as const;
