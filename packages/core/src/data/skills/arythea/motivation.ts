/**
 * Motivation - Arythea Skill
 * @module data/skills/arythea/motivation
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_ARYTHEA_MOTIVATION = "arythea_motivation" as SkillId;

export const arytheaMotivation: SkillDefinition = {
  id: SKILL_ARYTHEA_MOTIVATION,
    name: "Motivation",
    heroId: "arythea",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 red mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
};
