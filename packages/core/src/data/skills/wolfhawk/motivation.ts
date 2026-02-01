/**
 * Motivation - Wolfhawk Skill
 * @module data/skills/wolfhawk/motivation
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_WOLFHAWK_MOTIVATION = "wolfhawk_motivation" as SkillId;

export const wolfhawkMotivation: SkillDefinition = {
  id: SKILL_WOLFHAWK_MOTIVATION,
    name: "Motivation",
    heroId: "wolfhawk",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 Fame",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
};
