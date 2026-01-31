/**
 * Tovak Skill Definitions
 *
 * @module data/skills/tovak
 */

import type { SkillId } from "@mage-knight/shared";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_COMBAT,
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

export const SKILL_TOVAK_DOUBLE_TIME = "tovak_double_time" as SkillId;
export const SKILL_TOVAK_NIGHT_SHARPSHOOTING = "tovak_night_sharpshooting" as SkillId;
export const SKILL_TOVAK_COLD_SWORDSMANSHIP = "tovak_cold_swordsmanship" as SkillId;
export const SKILL_TOVAK_SHIELD_MASTERY = "tovak_shield_mastery" as SkillId;
export const SKILL_TOVAK_RESISTANCE_BREAK = "tovak_resistance_break" as SkillId;
export const SKILL_TOVAK_I_FEEL_NO_PAIN = "tovak_i_feel_no_pain" as SkillId;
export const SKILL_TOVAK_I_DONT_GIVE_A_DAMN = "tovak_i_dont_give_a_damn" as SkillId;
export const SKILL_TOVAK_WHO_NEEDS_MAGIC = "tovak_who_needs_magic" as SkillId;
export const SKILL_TOVAK_MOTIVATION = "tovak_motivation" as SkillId;
export const SKILL_TOVAK_MANA_EXPLOIT = "tovak_mana_exploit" as SkillId;

// ============================================================================
// Skill Definitions
// ============================================================================

export const TOVAK_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_TOVAK_DOUBLE_TIME]: {
    id: SKILL_TOVAK_DOUBLE_TIME,
    name: "Double Time",
    heroId: "tovak",
    description: "Move 2 (Day) or Move 1 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT],
  },
  [SKILL_TOVAK_NIGHT_SHARPSHOOTING]: {
    id: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
    name: "Night Sharpshooting",
    heroId: "tovak",
    description: "Ranged Attack 1 (Day) or Ranged Attack 2 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_TOVAK_COLD_SWORDSMANSHIP]: {
    id: SKILL_TOVAK_COLD_SWORDSMANSHIP,
    name: "Cold Swordsmanship",
    heroId: "tovak",
    description: "Attack 2 or Ice Attack 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_TOVAK_SHIELD_MASTERY]: {
    id: SKILL_TOVAK_SHIELD_MASTERY,
    name: "Shield Mastery",
    heroId: "tovak",
    description: "Block 3, or Fire Block 2, or Ice Block 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_TOVAK_RESISTANCE_BREAK]: {
    id: SKILL_TOVAK_RESISTANCE_BREAK,
    name: "Resistance Break",
    heroId: "tovak",
    description: "Target enemy: Armor -1 for each resistance it has (min 1)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_TOVAK_I_FEEL_NO_PAIN]: {
    id: SKILL_TOVAK_I_FEEL_NO_PAIN,
    name: "I Feel No Pain",
    heroId: "tovak",
    description: "Except in combat: Discard 1 Wound from hand, draw a card",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_TOVAK_I_DONT_GIVE_A_DAMN]: {
    id: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
    name: "I Don't Give a Damn",
    heroId: "tovak",
    description: "One sideways card gives +2 instead of +1. AA/Spell/Artifact gives +3",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_TOVAK_WHO_NEEDS_MAGIC]: {
    id: SKILL_TOVAK_WHO_NEEDS_MAGIC,
    name: "Who Needs Magic?",
    heroId: "tovak",
    description: "One sideways card gives +2 instead of +1. No die used: +3 instead",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_TOVAK_MOTIVATION]: {
    id: SKILL_TOVAK_MOTIVATION,
    name: "Motivation",
    heroId: "tovak",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 blue mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_TOVAK_MANA_EXPLOIT]: {
    id: SKILL_TOVAK_MANA_EXPLOIT,
    name: "Mana Exploit",
    heroId: "tovak",
    description: "Gain non-gold mana token. Others take Wounds using other colors",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_SPECIAL],
  },
};

// ============================================================================
// Skill ID List
// ============================================================================

export const TOVAK_SKILL_IDS = [
  SKILL_TOVAK_DOUBLE_TIME,
  SKILL_TOVAK_NIGHT_SHARPSHOOTING,
  SKILL_TOVAK_COLD_SWORDSMANSHIP,
  SKILL_TOVAK_SHIELD_MASTERY,
  SKILL_TOVAK_RESISTANCE_BREAK,
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_TOVAK_MOTIVATION,
  SKILL_TOVAK_MANA_EXPLOIT,
] as const;
