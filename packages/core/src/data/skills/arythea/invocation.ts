/**
 * Invocation - Arythea Skill
 * @module data/skills/arythea/invocation
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_ARYTHEA_INVOCATION = "arythea_invocation" as SkillId;

export const invocation: SkillDefinition = {
  id: SKILL_ARYTHEA_INVOCATION,
    name: "Invocation",
    heroId: "arythea",
    description: "Discard Wound: gain red/black mana. Discard non-Wound: gain white/green mana",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
};
