/**
 * Ritual of Pain - Arythea Skill
 * @module data/skills/arythea/ritualOfPain
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_HEALING } from "../../../types/cards.js";
import {
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_DISCARD_WOUNDS,
  EFFECT_NOOP,
  EFFECT_PLACE_SKILL_IN_CENTER,
} from "../../../types/effectTypes.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_ARYTHEA_RITUAL_OF_PAIN = "arythea_ritual_of_pain" as SkillId;

export const ritualOfPain: SkillDefinition = {
  id: SKILL_ARYTHEA_RITUAL_OF_PAIN,
  name: "Ritual of Pain",
  heroId: "arythea",
  description:
    "Throw away up to 2 Wounds. Others can return this to play a Wound sideways for +3",
  usageType: SKILL_USAGE_INTERACTIVE,
  categories: [CATEGORY_HEALING],
  effect: {
    type: EFFECT_COMPOUND,
    effects: [
      {
        type: EFFECT_CHOICE,
        options: [
          { type: EFFECT_NOOP },
          { type: EFFECT_DISCARD_WOUNDS, count: 1 },
          { type: EFFECT_DISCARD_WOUNDS, count: 2 },
        ],
      },
      { type: EFFECT_PLACE_SKILL_IN_CENTER, skillId: SKILL_ARYTHEA_RITUAL_OF_PAIN },
    ],
  },
};
