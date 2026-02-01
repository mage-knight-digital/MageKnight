/**
 * Puppet Master - Krang Skill
 * @module data/skills/krang/puppetMaster
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_PUPPET_MASTER = "krang_puppet_master" as SkillId;

export const puppetMaster: SkillDefinition = {
  id: SKILL_KRANG_PUPPET_MASTER,
    name: "Puppet Master",
    heroId: "krang",
    description: "Keep defeated enemy token. Discard for half Attack or half Block",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
