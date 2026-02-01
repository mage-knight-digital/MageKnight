/**
 * I Feel No Pain - Tovak Skill
 * @module data/skills/tovak/iFeelNoPain
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_TOVAK_I_FEEL_NO_PAIN = "tovak_i_feel_no_pain" as SkillId;

export const iFeelNoPain: SkillDefinition = {
  id: SKILL_TOVAK_I_FEEL_NO_PAIN,
    name: "I Feel No Pain",
    heroId: "tovak",
    description: "Except in combat: Discard 1 Wound from hand, draw a card",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
};
