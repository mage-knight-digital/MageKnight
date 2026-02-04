/**
 * Day Sharpshooting - Norowas Skill
 * @module data/skills/norowas/daySharpshooting
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { ifNightOrUnderground, rangedAttack } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_NOROWAS_DAY_SHARPSHOOTING = "norowas_day_sharpshooting" as SkillId;

export const daySharpshooting: SkillDefinition = {
  id: SKILL_NOROWAS_DAY_SHARPSHOOTING,
  name: "Day Sharpshooting",
  heroId: "norowas",
  description: "Ranged Attack 2 (Day) or Ranged Attack 1 (Night)",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: ifNightOrUnderground(rangedAttack(1), rangedAttack(2)),
  categories: [CATEGORY_COMBAT],
};
