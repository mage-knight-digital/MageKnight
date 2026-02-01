/**
 * Leadership - Norowas Skill
 * @module data/skills/norowas/leadership
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_NOROWAS_LEADERSHIP = "norowas_leadership" as SkillId;

export const leadership: SkillDefinition = {
  id: SKILL_NOROWAS_LEADERSHIP,
  name: "Leadership",
  heroId: "norowas",
  description: "When activating Unit: +3 Block, +2 Attack, or +1 Ranged Attack",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  categories: [CATEGORY_COMBAT],
};
