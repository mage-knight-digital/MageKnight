/**
 * Hawk Eyes - Wolfhawk Skill
 *
 * Active (once per turn): Move 1.
 * Night: exploring costs 1 less Move for the entire turn after activation (S1).
 * Day: reveal garrisons of fortified sites at distance 2 for the entire turn (S1).
 *
 * Key rules:
 * - The passive bonuses (exploring cost, garrison reveal) apply for the ENTIRE turn
 *   once the skill is used, not just a single-use activation (FAQ S1)
 * - Time-of-day check determines which bonus applies
 * - Uses custom handler to add turn-duration modifiers on activation
 *
 * @module data/skills/wolfhawk/hawkEyes
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT, CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_WOLFHAWK_HAWK_EYES = "wolfhawk_hawk_eyes" as SkillId;

export const hawkEyes: SkillDefinition = {
  id: SKILL_WOLFHAWK_HAWK_EYES,
  name: "Hawk Eyes",
  heroId: "wolfhawk",
  description: "Move 1. Night: exploring -1. Day: reveal garrisons at distance 2",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  categories: [CATEGORY_MOVEMENT, CATEGORY_SPECIAL],
  // Effect is handled by custom handler (applyHawkEyesEffect)
  // because it needs conditional modifier application based on time of day
};
