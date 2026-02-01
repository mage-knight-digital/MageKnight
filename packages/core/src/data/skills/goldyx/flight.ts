/**
 * Flight - Goldyx Skill
 * @module data/skills/goldyx/flight
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_GOLDYX_FLIGHT = "goldyx_flight" as SkillId;

export const flight: SkillDefinition = {
  id: SKILL_GOLDYX_FLIGHT,
    name: "Flight",
    heroId: "goldyx",
    description: "Flip to move to adjacent space free, or 2 spaces for 2 Move",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_MOVEMENT],
};
