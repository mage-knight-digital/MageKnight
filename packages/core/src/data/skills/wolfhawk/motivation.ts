/**
 * Motivation - Wolfhawk Skill
 * @module data/skills/wolfhawk/motivation
 *
 * Once a round, on any player's turn: flip this to draw two cards.
 * If you have the least Fame (not tied), also gain Fame 1.
 *
 * Unlike other heroes' Motivation (which grant mana tokens),
 * Wolfhawk's grants Fame as the catch-up bonus.
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_DRAW_CARDS, EFFECT_GAIN_FAME } from "../../../types/effectTypes.js";
import { CONDITION_LOWEST_FAME } from "../../../types/conditions.js";
import { compound, conditional } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_WOLFHAWK_MOTIVATION = "wolfhawk_motivation" as SkillId;

export const wolfhawkMotivation: SkillDefinition = {
  id: SKILL_WOLFHAWK_MOTIVATION,
  name: "Motivation",
  heroId: "wolfhawk",
  description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 Fame",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: compound([
    { type: EFFECT_DRAW_CARDS, amount: 2 },
    conditional(
      { type: CONDITION_LOWEST_FAME },
      { type: EFFECT_GAIN_FAME, amount: 1 },
    ),
  ]),
};
