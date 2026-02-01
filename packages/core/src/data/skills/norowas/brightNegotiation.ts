/**
 * Bright Negotiation - Norowas Skill
 * @module data/skills/norowas/brightNegotiation
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_INFLUENCE } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_NOROWAS_BRIGHT_NEGOTIATION = "norowas_bright_negotiation" as SkillId;

export const brightNegotiation: SkillDefinition = {
  id: SKILL_NOROWAS_BRIGHT_NEGOTIATION,
  name: "Bright Negotiation",
  heroId: "norowas",
  description: "Influence 3 (Day) or Influence 2 (Night)",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  categories: [CATEGORY_INFLUENCE],
};
