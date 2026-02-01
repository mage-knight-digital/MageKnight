/**
 * I Don't Give a Damn - Tovak Skill
 * @module data/skills/tovak/iDontGiveADamn
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_TOVAK_I_DONT_GIVE_A_DAMN = "tovak_i_dont_give_a_damn" as SkillId;

export const iDontGiveADamn: SkillDefinition = {
  id: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
    name: "I Don't Give a Damn",
    heroId: "tovak",
    description: "One sideways card gives +2 instead of +1. AA/Spell/Artifact gives +3",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
};
