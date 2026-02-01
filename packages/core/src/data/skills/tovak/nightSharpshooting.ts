/**
 * Night Sharpshooting - Tovak Skill
 * @module data/skills/tovak/nightSharpshooting
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_TOVAK_NIGHT_SHARPSHOOTING = "tovak_night_sharpshooting" as SkillId;

export const nightSharpshooting: SkillDefinition = {
  id: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
    name: "Night Sharpshooting",
    heroId: "tovak",
    description: "Ranged Attack 1 (Day) or Ranged Attack 2 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
};
