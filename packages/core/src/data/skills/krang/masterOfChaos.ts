/**
 * Master of Chaos - Krang Skill
 * @module data/skills/krang/masterOfChaos
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_MASTER_OF_CHAOS = "krang_master_of_chaos" as SkillId;

export const masterOfChaos: SkillDefinition = {
  id: SKILL_KRANG_MASTER_OF_CHAOS,
    name: "Master of Chaos",
    heroId: "krang",
    description: "Rotate shield for: Block 3, Move 1, Ranged 1, Influence 2, Attack 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
};
