/**
 * Polarization - Arythea Skill
 * @module data/skills/arythea/polarization
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_ARYTHEA_POLARIZATION = "arythea_polarization" as SkillId;

export const polarization: SkillDefinition = {
  id: SKILL_ARYTHEA_POLARIZATION,
    name: "Polarization",
    heroId: "arythea",
    description: "Use 1 mana as opposite color. Day: black → any. Night: gold → black",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
};
