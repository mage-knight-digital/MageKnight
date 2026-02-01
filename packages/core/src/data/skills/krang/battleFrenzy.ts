/**
 * Battle Frenzy - Krang Skill
 * @module data/skills/krang/battleFrenzy
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_BATTLE_FRENZY = "krang_battle_frenzy" as SkillId;

export const battleFrenzy: SkillDefinition = {
  id: SKILL_KRANG_BATTLE_FRENZY,
    name: "Battle Frenzy",
    heroId: "krang",
    description: "Attack 2. Flip for Attack 4. Flip back when resting",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
