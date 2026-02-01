/**
 * Who Needs Magic? - Tovak Skill
 * @module data/skills/tovak/whoNeedsMagic
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_TOVAK_WHO_NEEDS_MAGIC = "tovak_who_needs_magic" as SkillId;

export const whoNeedsMagic: SkillDefinition = {
  id: SKILL_TOVAK_WHO_NEEDS_MAGIC,
    name: "Who Needs Magic?",
    heroId: "tovak",
    description: "One sideways card gives +2 instead of +1. No die used: +3 instead",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
};
