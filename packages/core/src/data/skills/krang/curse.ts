/**
 * Curse - Krang Skill
 * @module data/skills/krang/curse
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { EFFECT_KRANG_CURSE } from "../../../types/effectTypes.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_CURSE = "krang_curse" as SkillId;

export const curse: SkillDefinition = {
  id: SKILL_KRANG_CURSE,
  name: "Curse",
  heroId: "krang",
  description:
    "Choose an enemy: reduce one attack by 2 (min 0) or reduce armor by 1 (min 1). Not vs fortified in Ranged/Siege.",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  categories: [CATEGORY_COMBAT],
  effect: { type: EFFECT_KRANG_CURSE },
};
