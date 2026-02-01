/**
 * Double Time - Tovak Skill
 * @module data/skills/tovak/doubleTime
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_MOVEMENT } from "../../../types/cards.js";
import { ifDay, move } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_TOVAK_DOUBLE_TIME = "tovak_double_time" as SkillId;

export const doubleTime: SkillDefinition = {
  id: SKILL_TOVAK_DOUBLE_TIME,
    name: "Double Time",
    heroId: "tovak",
    description: "Move 2 (Day) or Move 1 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    effect: ifDay(move(2), move(1)),
    categories: [CATEGORY_MOVEMENT],
};
