/**
 * Wolf's Howl - Wolfhawk Skill
 * @module data/skills/wolfhawk/wolfsHowl
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_WOLFHAWK_WOLFS_HOWL = "wolfhawk_wolfs_howl" as SkillId;

export const wolfsHowl: SkillDefinition = {
  id: SKILL_WOLFHAWK_WOLFS_HOWL,
    name: "Wolf's Howl",
    heroId: "wolfhawk",
    description: "Sideways card +4. +1 per Command token without Unit. Others' Units -1",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_SPECIAL],
};
