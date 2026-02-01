/**
 * Secret Ways - Braevalar Skill
 * @module data/skills/braevalar/secretWays
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_BRAEVALAR_SECRET_WAYS = "braevalar_secret_ways" as SkillId;

export const secretWays: SkillDefinition = {
  id: SKILL_BRAEVALAR_SECRET_WAYS,
    name: "Secret Ways",
    heroId: "braevalar",
    description: "Move 1. Mountains 5 Move. Blue mana: lakes 2 Move",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT],
};
