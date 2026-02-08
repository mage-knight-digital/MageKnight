/**
 * Beguile - Braevalar Skill
 *
 * Once per turn: Influence 3. Influence 2 at a fortified site. Influence 4 at a Magical Glade.
 *
 * Key rules:
 * - Fortified sites (Keep, Mage Tower, City) REDUCE influence to 2 (S1)
 * - Magical Glade INCREASES influence to 4
 * - Default is Influence 3 at any other location
 *
 * @module data/skills/braevalar/beguile
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_INFLUENCE } from "../../../types/cards.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";
import { influence, ifAtMagicalGlade, ifAtFortifiedSite } from "../../effectHelpers.js";

export const SKILL_BRAEVALAR_BEGUILE = "braevalar_beguile" as SkillId;

/**
 * Location-conditional influence effect:
 * 1. At Magical Glade → Influence 4 (best)
 * 2. At Fortified Site → Influence 2 (worst)
 * 3. Anywhere else → Influence 3 (default)
 */
const beguileEffect = ifAtMagicalGlade(
  influence(4),
  ifAtFortifiedSite(
    influence(2),
    influence(3),
  ),
);

export const beguile: SkillDefinition = {
  id: SKILL_BRAEVALAR_BEGUILE,
  name: "Beguile",
  heroId: "braevalar",
  description: "Influence 3. Fortified: 2. Magical Glade: 4",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: beguileEffect,
  categories: [CATEGORY_INFLUENCE],
};
