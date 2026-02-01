/**
 * Goldyx Skills - Aggregation Module
 *
 * ## Adding a New Skill
 *
 * 1. Create a new file with the skill constant and definition
 * 2. Add export * from "./newSkill.js" below
 * 3. Import the definition and add to GOLDYX_SKILLS and GOLDYX_SKILL_IDS
 *
 * @module data/skills/goldyx
 */

import type { SkillId } from "@mage-knight/shared";
import type { SkillDefinition } from "../types.js";

// Re-export all skill constants
export * from "./freezingPower.js";
export * from "./potionMaking.js";
export * from "./whiteCrystalCraft.js";
export * from "./greenCrystalCraft.js";
export * from "./redCrystalCraft.js";
export * from "./glitteringFortune.js";
export * from "./flight.js";
export * from "./universalPower.js";
export * from "./motivation.js";
export * from "./sourceFreeze.js";

// Import definitions for aggregation
import { SKILL_GOLDYX_FREEZING_POWER, freezingPower } from "./freezingPower.js";
import { SKILL_GOLDYX_POTION_MAKING, potionMaking } from "./potionMaking.js";
import { SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT, whiteCrystalCraft } from "./whiteCrystalCraft.js";
import { SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT, greenCrystalCraft } from "./greenCrystalCraft.js";
import { SKILL_GOLDYX_RED_CRYSTAL_CRAFT, redCrystalCraft } from "./redCrystalCraft.js";
import { SKILL_GOLDYX_GLITTERING_FORTUNE, glitteringFortune } from "./glitteringFortune.js";
import { SKILL_GOLDYX_FLIGHT, flight } from "./flight.js";
import { SKILL_GOLDYX_UNIVERSAL_POWER, universalPower } from "./universalPower.js";
import { SKILL_GOLDYX_MOTIVATION, goldyxMotivation } from "./motivation.js";
import { SKILL_GOLDYX_SOURCE_FREEZE, sourceFreeze } from "./sourceFreeze.js";

/**
 * All Goldyx skill definitions keyed by skill ID.
 */
export const GOLDYX_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_GOLDYX_FREEZING_POWER]: freezingPower,
  [SKILL_GOLDYX_POTION_MAKING]: potionMaking,
  [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT]: whiteCrystalCraft,
  [SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT]: greenCrystalCraft,
  [SKILL_GOLDYX_RED_CRYSTAL_CRAFT]: redCrystalCraft,
  [SKILL_GOLDYX_GLITTERING_FORTUNE]: glitteringFortune,
  [SKILL_GOLDYX_FLIGHT]: flight,
  [SKILL_GOLDYX_UNIVERSAL_POWER]: universalPower,
  [SKILL_GOLDYX_MOTIVATION]: goldyxMotivation,
  [SKILL_GOLDYX_SOURCE_FREEZE]: sourceFreeze,
};

/**
 * Ordered list of Goldyx skill IDs for level-up draws.
 */
export const GOLDYX_SKILL_IDS = [
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
] as const;
