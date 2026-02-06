/**
 * Mana Overload - Tovak Skill
 * @module data/skills/tovak/manaOverload
 *
 * Once a round: choose a color other than gold and gain a mana token of that color.
 * Put this skill token in the center and mark it with another token of the same color.
 * The first player who uses mana of that color to power a card that gives Move,
 * Influence, or any type of Attack or Block, gets +4 from that card and returns
 * the skill to you, face down.
 *
 * FAQ Rulings:
 * - Units are NOT "cards" for this skill - unit activations don't trigger +4
 * - Mana payment (Pure Magic, Mana Bolt basic) doesn't count as "powering a card"
 * - Indirect effects (Concentration, Into the Heat, Maximal Effect) don't trigger
 * - Multi-effect cards: player chooses which effect gets the +4
 * - Owner doesn't have to use the mana gained - can still put skill in play
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_SPECIAL } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_INTERACTIVE } from "../types.js";

export const SKILL_TOVAK_MANA_OVERLOAD = "tovak_mana_overload" as SkillId;

export const manaOverload: SkillDefinition = {
  id: SKILL_TOVAK_MANA_OVERLOAD,
  name: "Mana Overload",
  heroId: "tovak",
  description:
    "Gain non-gold mana token. Put skill in center with color marker. First to power Move/Influence/Attack/Block with that color gets +4.",
  usageType: SKILL_USAGE_INTERACTIVE,
  categories: [CATEGORY_SPECIAL],
  // Effect is handled via custom handler in useSkillCommand since
  // the mana color choice determines the center marker color,
  // requiring a two-step interaction that goes beyond generic effects.
};
