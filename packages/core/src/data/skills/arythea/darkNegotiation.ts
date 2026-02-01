/**
 * Dark Negotiation - Arythea Skill
 * @module data/skills/arythea/darkNegotiation
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_INFLUENCE } from "../../../types/cards.js";
import { ifNightOrUnderground, influence } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_ARYTHEA_DARK_NEGOTIATION = "arythea_dark_negotiation" as SkillId;

export const darkNegotiation: SkillDefinition = {
  id: SKILL_ARYTHEA_DARK_NEGOTIATION,
    name: "Dark Negotiation",
    heroId: "arythea",
    description: "Influence 2 (Day) or Influence 3 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    effect: ifNightOrUnderground(influence(3), influence(2)),
    categories: [CATEGORY_INFLUENCE],
};
