/**
 * Motivation - Goldyx Skill
 * @module data/skills/goldyx/motivation
 *
 * Once a round, on any player's turn: flip this to draw two cards.
 * If you have the least Fame (not tied), also gain a green mana token.
 *
 * Identical to other heroes' Motivation except green mana,
 * fitting Goldyx's green crystal theme (Green, Green, Blue).
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_GREEN } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_DRAW_CARDS, EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { CONDITION_LOWEST_FAME } from "../../../types/conditions.js";
import { compound, conditional } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_GOLDYX_MOTIVATION = "goldyx_motivation" as SkillId;

export const goldyxMotivation: SkillDefinition = {
  id: SKILL_GOLDYX_MOTIVATION,
  name: "Motivation",
  heroId: "goldyx",
  description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 green mana",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: compound([
    { type: EFFECT_DRAW_CARDS, amount: 2 },
    conditional(
      { type: CONDITION_LOWEST_FAME },
      { type: EFFECT_GAIN_MANA, color: MANA_GREEN },
    ),
  ]),
};
