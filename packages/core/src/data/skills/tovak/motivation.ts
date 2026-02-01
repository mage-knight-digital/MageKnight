/**
 * Motivation - Tovak Skill
 * @module data/skills/tovak/motivation
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_TOVAK_MOTIVATION = "tovak_motivation" as SkillId;

export const tovakMotivation: SkillDefinition = {
  id: SKILL_TOVAK_MOTIVATION,
    name: "Motivation",
    heroId: "tovak",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 blue mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
};
