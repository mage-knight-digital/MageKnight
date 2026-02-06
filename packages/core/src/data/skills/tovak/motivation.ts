/**
 * Motivation - Tovak Skill
 * @module data/skills/tovak/motivation
 *
 * Once a round, on any player's turn: flip this to draw two cards.
 * If you have the least Fame (not tied), also gain a blue mana token.
 *
 * Identical to Arythea's Motivation except blue mana instead of red,
 * fitting Tovak's blue crystal theme (Blue, Blue, White).
 */

import type { SkillId } from "@mage-knight/shared";
import { MANA_BLUE } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { EFFECT_DRAW_CARDS, EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { CONDITION_LOWEST_FAME } from "../../../types/conditions.js";
import { compound, conditional } from "../../effectHelpers.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_ROUND } from "../types.js";

export const SKILL_TOVAK_MOTIVATION = "tovak_motivation" as SkillId;

export const tovakMotivation: SkillDefinition = {
  id: SKILL_TOVAK_MOTIVATION,
  name: "Motivation",
  heroId: "tovak",
  description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 blue mana",
  usageType: SKILL_USAGE_ONCE_PER_ROUND,
  categories: [CATEGORY_SPECIAL],
  effect: compound([
    { type: EFFECT_DRAW_CARDS, amount: 2 },
    conditional(
      { type: CONDITION_LOWEST_FAME },
      { type: EFFECT_GAIN_MANA, color: MANA_BLUE },
    ),
  ]),
};
