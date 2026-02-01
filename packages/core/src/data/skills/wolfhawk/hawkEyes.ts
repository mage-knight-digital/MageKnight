/**
 * Hawk Eyes - Wolfhawk Skill
 * @module data/skills/wolfhawk/hawkEyes
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT, CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_WOLFHAWK_HAWK_EYES = "wolfhawk_hawk_eyes" as SkillId;

export const hawkEyes: SkillDefinition = {
  id: SKILL_WOLFHAWK_HAWK_EYES,
    name: "Hawk Eyes",
    heroId: "wolfhawk",
    description: "Move 1. Night: exploring -1. Day: reveal garrisons at distance 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT, CATEGORY_SPECIAL],
};
