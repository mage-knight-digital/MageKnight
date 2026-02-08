/**
 * On Her Own - Wolfhawk Skill
 * @module data/skills/wolfhawk/onHerOwn
 *
 * Once a turn: Influence 1. Influence 3 instead if you do not recruit
 * any units for influence this turn.
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_INFLUENCE } from "../../../types/cards.js";
import { CONDITION_NO_UNIT_RECRUITED_THIS_TURN } from "../../../types/conditions.js";
import { conditional, influence } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_WOLFHAWK_ON_HER_OWN = "wolfhawk_on_her_own" as SkillId;

export const onHerOwn: SkillDefinition = {
  id: SKILL_WOLFHAWK_ON_HER_OWN,
  name: "On Her Own",
  heroId: "wolfhawk",
  description: "Influence 1. Influence 3 if no Unit recruited this turn",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  categories: [CATEGORY_INFLUENCE],
  effect: conditional(
    { type: CONDITION_NO_UNIT_RECRUITED_THIS_TURN },
    influence(3),
    influence(1),
  ),
};
