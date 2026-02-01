/**
 * Motivation - Goldyx Skill
 * @module data/skills/goldyx/motivation
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_GOLDYX_MOTIVATION = "goldyx_motivation" as SkillId;

export const goldyxMotivation: SkillDefinition = {
  id: SKILL_GOLDYX_MOTIVATION,
    name: "Motivation",
    heroId: "goldyx",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 green mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
};
