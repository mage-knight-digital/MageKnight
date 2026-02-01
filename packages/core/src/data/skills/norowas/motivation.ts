/**
 * Motivation - Norowas Skill
 * @module data/skills/norowas/motivation
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_NOROWAS_MOTIVATION = "norowas_motivation" as SkillId;

export const norowasMotivation: SkillDefinition = {
  id: SKILL_NOROWAS_MOTIVATION,
  name: "Motivation",
  heroId: "norowas",
  description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 white mana",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
};
