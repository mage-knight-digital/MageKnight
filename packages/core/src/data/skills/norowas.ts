/**
 * Norowas Skill Definitions
 *
 * @module data/skills/norowas
 */

import type { SkillId } from "@mage-knight/shared";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_COMBAT,
  CATEGORY_INFLUENCE,
  CATEGORY_HEALING,
  CATEGORY_SPECIAL,
} from "../../types/cards.js";
import {
  type SkillDefinition,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_USAGE_PASSIVE,
  SKILL_USAGE_INTERACTIVE,
} from "./types.js";

// ============================================================================
// Skill ID Constants
// ============================================================================

export const SKILL_NOROWAS_FORWARD_MARCH = "norowas_forward_march" as SkillId;
export const SKILL_NOROWAS_DAY_SHARPSHOOTING = "norowas_day_sharpshooting" as SkillId;
export const SKILL_NOROWAS_INSPIRATION = "norowas_inspiration" as SkillId;
export const SKILL_NOROWAS_BRIGHT_NEGOTIATION = "norowas_bright_negotiation" as SkillId;
export const SKILL_NOROWAS_LEAVES_IN_THE_WIND = "norowas_leaves_in_the_wind" as SkillId;
export const SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS = "norowas_whispers_in_the_treetops" as SkillId;
export const SKILL_NOROWAS_LEADERSHIP = "norowas_leadership" as SkillId;
export const SKILL_NOROWAS_BONDS_OF_LOYALTY = "norowas_bonds_of_loyalty" as SkillId;
export const SKILL_NOROWAS_MOTIVATION = "norowas_motivation" as SkillId;
export const SKILL_NOROWAS_PRAYER_OF_WEATHER = "norowas_prayer_of_weather" as SkillId;

// ============================================================================
// Skill Definitions
// ============================================================================

export const NOROWAS_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_NOROWAS_FORWARD_MARCH]: {
    id: SKILL_NOROWAS_FORWARD_MARCH,
    name: "Forward March",
    heroId: "norowas",
    description: "Move 1 for each Ready and Unwounded Unit (max Move 3)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT],
  },
  [SKILL_NOROWAS_DAY_SHARPSHOOTING]: {
    id: SKILL_NOROWAS_DAY_SHARPSHOOTING,
    name: "Day Sharpshooting",
    heroId: "norowas",
    description: "Ranged Attack 2 (Day) or Ranged Attack 1 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_NOROWAS_INSPIRATION]: {
    id: SKILL_NOROWAS_INSPIRATION,
    name: "Inspiration",
    heroId: "norowas",
    description: "Flip to Ready or Heal a Unit (except in combat)",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_HEALING],
  },
  [SKILL_NOROWAS_BRIGHT_NEGOTIATION]: {
    id: SKILL_NOROWAS_BRIGHT_NEGOTIATION,
    name: "Bright Negotiation",
    heroId: "norowas",
    description: "Influence 3 (Day) or Influence 2 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_INFLUENCE],
  },
  [SKILL_NOROWAS_LEAVES_IN_THE_WIND]: {
    id: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
    name: "Leaves in the Wind",
    heroId: "norowas",
    description: "Flip to gain 1 green crystal and 1 white mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS]: {
    id: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
    name: "Whispers in the Treetops",
    heroId: "norowas",
    description: "Flip to gain 1 white crystal and 1 green mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_NOROWAS_LEADERSHIP]: {
    id: SKILL_NOROWAS_LEADERSHIP,
    name: "Leadership",
    heroId: "norowas",
    description: "When activating Unit: +3 Block, +2 Attack, or +1 Ranged Attack",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_NOROWAS_BONDS_OF_LOYALTY]: {
    id: SKILL_NOROWAS_BONDS_OF_LOYALTY,
    name: "Bonds of Loyalty",
    heroId: "norowas",
    description: "Acts as Command token. Unit costs -5 Influence. Cannot be disbanded",
    usageType: SKILL_USAGE_PASSIVE,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_NOROWAS_MOTIVATION]: {
    id: SKILL_NOROWAS_MOTIVATION,
    name: "Motivation",
    heroId: "norowas",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 white mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_NOROWAS_PRAYER_OF_WEATHER]: {
    id: SKILL_NOROWAS_PRAYER_OF_WEATHER,
    name: "Prayer of Weather",
    heroId: "norowas",
    description: "Until your next turn: your terrain costs -2, others' costs +1",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_MOVEMENT],
  },
};

// ============================================================================
// Skill ID List
// ============================================================================

export const NOROWAS_SKILL_IDS = [
  SKILL_NOROWAS_FORWARD_MARCH,
  SKILL_NOROWAS_DAY_SHARPSHOOTING,
  SKILL_NOROWAS_INSPIRATION,
  SKILL_NOROWAS_BRIGHT_NEGOTIATION,
  SKILL_NOROWAS_LEAVES_IN_THE_WIND,
  SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
  SKILL_NOROWAS_LEADERSHIP,
  SKILL_NOROWAS_BONDS_OF_LOYALTY,
  SKILL_NOROWAS_MOTIVATION,
  SKILL_NOROWAS_PRAYER_OF_WEATHER,
] as const;
