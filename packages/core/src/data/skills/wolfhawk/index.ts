/**
 * Wolfhawk Skills - Aggregation Module
 *
 * ## Adding a New Skill
 *
 * 1. Create a new file with the skill constant and definition
 * 2. Add export * from "./newSkill.js" below
 * 3. Import the definition and add to WOLFHAWK_SKILLS and WOLFHAWK_SKILL_IDS
 *
 * @module data/skills/wolfhawk
 */

import type { SkillId } from "@mage-knight/shared";
import type { SkillDefinition } from "../types.js";

// Re-export all skill constants
export * from "./refreshingBath.js";
export * from "./refreshingBreeze.js";
export * from "./hawkEyes.js";
export * from "./onHerOwn.js";
export * from "./deadlyAim.js";
export * from "./knowYourPrey.js";
export * from "./taunt.js";
export * from "./dueling.js";
export * from "./motivation.js";
export * from "./wolfsHowl.js";

// Import definitions for aggregation
import { SKILL_WOLFHAWK_REFRESHING_BATH, refreshingBath } from "./refreshingBath.js";
import { SKILL_WOLFHAWK_REFRESHING_BREEZE, refreshingBreeze } from "./refreshingBreeze.js";
import { SKILL_WOLFHAWK_HAWK_EYES, hawkEyes } from "./hawkEyes.js";
import { SKILL_WOLFHAWK_ON_HER_OWN, onHerOwn } from "./onHerOwn.js";
import { SKILL_WOLFHAWK_DEADLY_AIM, deadlyAim } from "./deadlyAim.js";
import { SKILL_WOLFHAWK_KNOW_YOUR_PREY, knowYourPrey } from "./knowYourPrey.js";
import { SKILL_WOLFHAWK_TAUNT, taunt } from "./taunt.js";
import { SKILL_WOLFHAWK_DUELING, dueling } from "./dueling.js";
import { SKILL_WOLFHAWK_MOTIVATION, wolfhawkMotivation } from "./motivation.js";
import { SKILL_WOLFHAWK_WOLFS_HOWL, wolfsHowl } from "./wolfsHowl.js";

/**
 * All Wolfhawk skill definitions keyed by skill ID.
 */
export const WOLFHAWK_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_WOLFHAWK_REFRESHING_BATH]: refreshingBath,
  [SKILL_WOLFHAWK_REFRESHING_BREEZE]: refreshingBreeze,
  [SKILL_WOLFHAWK_HAWK_EYES]: hawkEyes,
  [SKILL_WOLFHAWK_ON_HER_OWN]: onHerOwn,
  [SKILL_WOLFHAWK_DEADLY_AIM]: deadlyAim,
  [SKILL_WOLFHAWK_KNOW_YOUR_PREY]: knowYourPrey,
  [SKILL_WOLFHAWK_TAUNT]: taunt,
  [SKILL_WOLFHAWK_DUELING]: dueling,
  [SKILL_WOLFHAWK_MOTIVATION]: wolfhawkMotivation,
  [SKILL_WOLFHAWK_WOLFS_HOWL]: wolfsHowl,
};

/**
 * Ordered list of Wolfhawk skill IDs for level-up draws.
 */
export const WOLFHAWK_SKILL_IDS = [
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
] as const;
