/**
 * Motivation - Norowas Skill
 * @module data/skills/norowas/motivation
 *
 * Once a round, on any player's turn: flip this to draw two cards.
 * If you have the least Fame (not tied), also gain a white mana token.
 *
 * Identical to Tovak's/Arythea's Motivation except white mana,
 * fitting Norowas's white crystal theme (White, White, Green).
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_WHITE } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_DRAW_CARDS, EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { CONDITION_LOWEST_FAME } from "../../../types/conditions.js";
import { compound, conditional } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_NOROWAS_MOTIVATION = "norowas_motivation" as SkillId;

export const norowasMotivation: SkillDefinition = {
  id: SKILL_NOROWAS_MOTIVATION,
  name: "Motivation",
  heroId: "norowas",
  description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 white mana",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: compound([
    { type: EFFECT_DRAW_CARDS, amount: 2 },
    conditional(
      { type: CONDITION_LOWEST_FAME },
      { type: EFFECT_GAIN_MANA, color: MANA_WHITE },
    ),
  ]),
};
