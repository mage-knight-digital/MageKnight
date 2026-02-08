/**
 * Source Opening - Goldyx Skill
 *
 * Once a round (Interactive): Put this skill token in the center.
 * You may reroll a mana die in the Source. Any player may choose to return
 * the token to you face down to use an extra die of a basic color from
 * the Source and to give you a crystal of that color. They may decide
 * whether to reroll that die or not at the end of their turn.
 *
 * Solo: On the first turn you put this in play, reroll a die.
 * On your next turn, you may use a second mana die (basic color only),
 * gain a crystal of that color, and choose whether to reroll it.
 *
 * @module data/skills/goldyx/sourceOpening
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_GOLDYX_SOURCE_OPENING = "goldyx_source_opening" as SkillId;

/** @deprecated Use SKILL_GOLDYX_SOURCE_OPENING instead */
export const SKILL_GOLDYX_SOURCE_FREEZE = SKILL_GOLDYX_SOURCE_OPENING;

export const sourceOpening: SkillDefinition = {
  id: SKILL_GOLDYX_SOURCE_OPENING,
  name: "Source Opening",
  heroId: "goldyx",
  description:
    "Reroll a Source die. Others may return for extra basic die + give you a crystal",
  usageType: SKILL_USAGE_INTERACTIVE,
  categories: [CATEGORY_SPECIAL],
};

/** @deprecated Use sourceOpening instead */
export const sourceFreeze = sourceOpening;
