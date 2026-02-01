/**
 * Norowas Skills - Aggregation Module
 *
 * ## Adding a New Skill
 *
 * 1. Create a new file with the skill constant and definition
 * 2. Add export * from "./newSkill.js" below
 * 3. Import the definition and add to NOROWAS_SKILLS and NOROWAS_SKILL_IDS
 *
 * @module data/skills/norowas
 */

import type { SkillId } from "@mage-knight/shared";
import type { SkillDefinition } from "../types.js";

// Re-export all skill constants
export * from "./forwardMarch.js";
export * from "./daySharpshooting.js";
export * from "./inspiration.js";
export * from "./brightNegotiation.js";
export * from "./leavesInTheWind.js";
export * from "./whispersInTheTreetops.js";
export * from "./leadership.js";
export * from "./bondsOfLoyalty.js";
export * from "./motivation.js";
export * from "./prayerOfWeather.js";

// Import definitions for aggregation
import { SKILL_NOROWAS_FORWARD_MARCH, forwardMarch } from "./forwardMarch.js";
import { SKILL_NOROWAS_DAY_SHARPSHOOTING, daySharpshooting } from "./daySharpshooting.js";
import { SKILL_NOROWAS_INSPIRATION, inspiration } from "./inspiration.js";
import { SKILL_NOROWAS_BRIGHT_NEGOTIATION, brightNegotiation } from "./brightNegotiation.js";
import { SKILL_NOROWAS_LEAVES_IN_THE_WIND, leavesInTheWind } from "./leavesInTheWind.js";
import { SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS, whispersInTheTreetops } from "./whispersInTheTreetops.js";
import { SKILL_NOROWAS_LEADERSHIP, leadership } from "./leadership.js";
import { SKILL_NOROWAS_BONDS_OF_LOYALTY, bondsOfLoyalty } from "./bondsOfLoyalty.js";
import { SKILL_NOROWAS_MOTIVATION, norowasMotivation } from "./motivation.js";
import { SKILL_NOROWAS_PRAYER_OF_WEATHER, prayerOfWeather } from "./prayerOfWeather.js";

/**
 * All Norowas skill definitions keyed by skill ID.
 */
export const NOROWAS_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_NOROWAS_FORWARD_MARCH]: forwardMarch,
  [SKILL_NOROWAS_DAY_SHARPSHOOTING]: daySharpshooting,
  [SKILL_NOROWAS_INSPIRATION]: inspiration,
  [SKILL_NOROWAS_BRIGHT_NEGOTIATION]: brightNegotiation,
  [SKILL_NOROWAS_LEAVES_IN_THE_WIND]: leavesInTheWind,
  [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS]: whispersInTheTreetops,
  [SKILL_NOROWAS_LEADERSHIP]: leadership,
  [SKILL_NOROWAS_BONDS_OF_LOYALTY]: bondsOfLoyalty,
  [SKILL_NOROWAS_MOTIVATION]: norowasMotivation,
  [SKILL_NOROWAS_PRAYER_OF_WEATHER]: prayerOfWeather,
};

/**
 * Ordered list of Norowas skill IDs for level-up draws.
 */
export const NOROWAS_SKILL_IDS = [
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
] as const;
