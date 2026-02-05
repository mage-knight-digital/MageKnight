/**
 * Motivation - Arythea Skill
 * @module data/skills/arythea/motivation
 *
 * Once a round, on any player's turn: flip this to draw two cards.
 * If you have the least Fame (not tied), also gain a red mana token.
 *
 * Identical to Tovak's Motivation except red mana instead of blue,
 * fitting Arythea's red crystal theme (Red, Red, White).
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_RED } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_DRAW_CARDS, EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { CONDITION_LOWEST_FAME } from "../../../types/conditions.js";
import { compound, conditional } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_ARYTHEA_MOTIVATION = "arythea_motivation" as SkillId;

export const arytheaMotivation: SkillDefinition = {
  id: SKILL_ARYTHEA_MOTIVATION,
  name: "Motivation",
  heroId: "arythea",
  description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 red mana",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: compound([
    { type: EFFECT_DRAW_CARDS, amount: 2 },
    conditional(
      { type: CONDITION_LOWEST_FAME },
      { type: EFFECT_GAIN_MANA, color: MANA_RED },
    ),
  ]),
};
