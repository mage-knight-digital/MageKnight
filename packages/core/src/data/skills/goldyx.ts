/**
 * Goldyx Skill Definitions
 *
 * @module data/skills/goldyx
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
  SKILL_USAGE_INTERACTIVE,
} from "./types.js";

// ============================================================================
// Skill ID Constants
// ============================================================================

export const SKILL_GOLDYX_FREEZING_POWER = "goldyx_freezing_power" as SkillId;
export const SKILL_GOLDYX_POTION_MAKING = "goldyx_potion_making" as SkillId;
export const SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT = "goldyx_white_crystal_craft" as SkillId;
export const SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT = "goldyx_green_crystal_craft" as SkillId;
export const SKILL_GOLDYX_RED_CRYSTAL_CRAFT = "goldyx_red_crystal_craft" as SkillId;
export const SKILL_GOLDYX_GLITTERING_FORTUNE = "goldyx_glittering_fortune" as SkillId;
export const SKILL_GOLDYX_FLIGHT = "goldyx_flight" as SkillId;
export const SKILL_GOLDYX_UNIVERSAL_POWER = "goldyx_universal_power" as SkillId;
export const SKILL_GOLDYX_MOTIVATION = "goldyx_motivation" as SkillId;
export const SKILL_GOLDYX_SOURCE_FREEZE = "goldyx_source_freeze" as SkillId;

// ============================================================================
// Skill Definitions
// ============================================================================

export const GOLDYX_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_GOLDYX_FREEZING_POWER]: {
    id: SKILL_GOLDYX_FREEZING_POWER,
    name: "Freezing Power",
    heroId: "goldyx",
    description: "Siege Attack 1 or Ice Siege Attack 1",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_GOLDYX_POTION_MAKING]: {
    id: SKILL_GOLDYX_POTION_MAKING,
    name: "Potion Making",
    heroId: "goldyx",
    description: "Flip for Heal 2 (except in combat)",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_HEALING],
  },
  [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT]: {
    id: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
    name: "White Crystal Craft",
    heroId: "goldyx",
    description: "Flip to gain 1 blue crystal and 1 white mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT]: {
    id: SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT,
    name: "Green Crystal Craft",
    heroId: "goldyx",
    description: "Flip to gain 1 blue crystal and 1 green mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_GOLDYX_RED_CRYSTAL_CRAFT]: {
    id: SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
    name: "Red Crystal Craft",
    heroId: "goldyx",
    description: "Flip to gain 1 blue crystal and 1 red mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_GOLDYX_GLITTERING_FORTUNE]: {
    id: SKILL_GOLDYX_GLITTERING_FORTUNE,
    name: "Glittering Fortune",
    heroId: "goldyx",
    description: "During interaction: Influence 1 per different color crystal",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_INFLUENCE],
  },
  [SKILL_GOLDYX_FLIGHT]: {
    id: SKILL_GOLDYX_FLIGHT,
    name: "Flight",
    heroId: "goldyx",
    description: "Flip to move to adjacent space free, or 2 spaces for 2 Move",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_MOVEMENT],
  },
  [SKILL_GOLDYX_UNIVERSAL_POWER]: {
    id: SKILL_GOLDYX_UNIVERSAL_POWER,
    name: "Universal Power",
    heroId: "goldyx",
    description: "Add 1 mana to sideways card: +3 instead of +1. Same color: +4",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_GOLDYX_MOTIVATION]: {
    id: SKILL_GOLDYX_MOTIVATION,
    name: "Motivation",
    heroId: "goldyx",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 green mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_GOLDYX_SOURCE_FREEZE]: {
    id: SKILL_GOLDYX_SOURCE_FREEZE,
    name: "Source Freeze",
    heroId: "goldyx",
    description: "Place in Source. Others can't use standard die. Gain crystal on next turn",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_SPECIAL],
  },
};

// ============================================================================
// Skill ID List
// ============================================================================

export const GOLDYX_SKILL_IDS = [
  SKILL_GOLDYX_FREEZING_POWER,
  SKILL_GOLDYX_POTION_MAKING,
  SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
  SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT,
  SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
  SKILL_GOLDYX_GLITTERING_FORTUNE,
  SKILL_GOLDYX_FLIGHT,
  SKILL_GOLDYX_UNIVERSAL_POWER,
  SKILL_GOLDYX_MOTIVATION,
  SKILL_GOLDYX_SOURCE_FREEZE,
] as const;
