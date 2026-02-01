/**
 * Forward March - Norowas Skill
 * @module data/skills/norowas/forwardMarch
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_NOROWAS_FORWARD_MARCH = "norowas_forward_march" as SkillId;

export const forwardMarch: SkillDefinition = {
  id: SKILL_NOROWAS_FORWARD_MARCH,
  name: "Forward March",
  heroId: "norowas",
  description: "Move 1 for each Ready and Unwounded Unit (max Move 3)",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  categories: [CATEGORY_MOVEMENT],
};
