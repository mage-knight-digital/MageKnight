/**
 * Battle Hardened - Krang Skill
 * @module data/skills/krang/battleHardened
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_BATTLE_HARDENED = "krang_battle_hardened" as SkillId;

export const battleHardened: SkillDefinition = {
  id: SKILL_KRANG_BATTLE_HARDENED,
    name: "Battle Hardened",
    heroId: "krang",
    description: "Ignore 2 physical damage or 1 non-physical damage",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
