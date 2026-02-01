/**
 * Feral Allies - Braevalar Skill
 * @module data/skills/braevalar/feralAllies
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT, CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_BRAEVALAR_FERAL_ALLIES = "braevalar_feral_allies" as SkillId;

export const feralAllies: SkillDefinition = {
  id: SKILL_BRAEVALAR_FERAL_ALLIES,
    name: "Feral Allies",
    heroId: "braevalar",
    description: "Exploring -1 Move. Attack 1 or reduce enemy attack by 1",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
};
