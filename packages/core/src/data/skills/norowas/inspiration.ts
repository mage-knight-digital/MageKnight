/**
 * Inspiration - Norowas Skill
 * @module data/skills/norowas/inspiration
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_HEALING } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_NOROWAS_INSPIRATION = "norowas_inspiration" as SkillId;

export const inspiration: SkillDefinition = {
  id: SKILL_NOROWAS_INSPIRATION,
  name: "Inspiration",
  heroId: "norowas",
  description: "Flip to Ready or Heal a Unit (except in combat)",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_HEALING],
};
