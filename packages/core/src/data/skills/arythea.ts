/**
 * Arythea Skill Definitions
 *
 * @module data/skills/arythea
 */

import type { SkillId } from "@mage-knight/shared";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_COMBAT,
  CATEGORY_INFLUENCE,
  CATEGORY_HEALING,
  CATEGORY_SPECIAL,
} from "../../types/cards.js";
import { ifNightOrUnderground, influence } from "../effectHelpers.js";
import {
  type SkillDefinition,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_USAGE_INTERACTIVE,
} from "./types.js";

// ============================================================================
// Skill ID Constants
// ============================================================================

export const SKILL_ARYTHEA_DARK_PATHS = "arythea_dark_paths" as SkillId;
export const SKILL_ARYTHEA_BURNING_POWER = "arythea_burning_power" as SkillId;
export const SKILL_ARYTHEA_HOT_SWORDSMANSHIP = "arythea_hot_swordsmanship" as SkillId;
export const SKILL_ARYTHEA_DARK_NEGOTIATION = "arythea_dark_negotiation" as SkillId;
export const SKILL_ARYTHEA_DARK_FIRE_MAGIC = "arythea_dark_fire_magic" as SkillId;
export const SKILL_ARYTHEA_POWER_OF_PAIN = "arythea_power_of_pain" as SkillId;
export const SKILL_ARYTHEA_INVOCATION = "arythea_invocation" as SkillId;
export const SKILL_ARYTHEA_POLARIZATION = "arythea_polarization" as SkillId;
export const SKILL_ARYTHEA_MOTIVATION = "arythea_motivation" as SkillId;
export const SKILL_ARYTHEA_HEALING_RITUAL = "arythea_healing_ritual" as SkillId;

// ============================================================================
// Skill Definitions
// ============================================================================

export const ARYTHEA_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_ARYTHEA_DARK_PATHS]: {
    id: SKILL_ARYTHEA_DARK_PATHS,
    name: "Dark Paths",
    heroId: "arythea",
    description: "Move 1 (Day) or Move 2 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT],
  },
  [SKILL_ARYTHEA_BURNING_POWER]: {
    id: SKILL_ARYTHEA_BURNING_POWER,
    name: "Burning Power",
    heroId: "arythea",
    description: "Siege Attack 1 or Fire Siege Attack 1",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_ARYTHEA_HOT_SWORDSMANSHIP]: {
    id: SKILL_ARYTHEA_HOT_SWORDSMANSHIP,
    name: "Hot Swordsmanship",
    heroId: "arythea",
    description: "Attack 2 or Fire Attack 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_ARYTHEA_DARK_NEGOTIATION]: {
    id: SKILL_ARYTHEA_DARK_NEGOTIATION,
    name: "Dark Negotiation",
    heroId: "arythea",
    description: "Influence 2 (Day) or Influence 3 (Night)",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    effect: ifNightOrUnderground(influence(3), influence(2)),
    categories: [CATEGORY_INFLUENCE],
  },
  [SKILL_ARYTHEA_DARK_FIRE_MAGIC]: {
    id: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
    name: "Dark Fire Magic",
    heroId: "arythea",
    description: "Flip to gain 1 red crystal and 1 red or black mana token",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_ARYTHEA_POWER_OF_PAIN]: {
    id: SKILL_ARYTHEA_POWER_OF_PAIN,
    name: "Power of Pain",
    heroId: "arythea",
    description: "Play 1 Wound sideways as non-Wound card: +2 instead of +1",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_ARYTHEA_INVOCATION]: {
    id: SKILL_ARYTHEA_INVOCATION,
    name: "Invocation",
    heroId: "arythea",
    description: "Discard Wound: gain red/black mana. Discard non-Wound: gain white/green mana",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_ARYTHEA_POLARIZATION]: {
    id: SKILL_ARYTHEA_POLARIZATION,
    name: "Polarization",
    heroId: "arythea",
    description: "Use 1 mana as opposite color. Day: black → any. Night: gold → black",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_ARYTHEA_MOTIVATION]: {
    id: SKILL_ARYTHEA_MOTIVATION,
    name: "Motivation",
    heroId: "arythea",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 red mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_ARYTHEA_HEALING_RITUAL]: {
    id: SKILL_ARYTHEA_HEALING_RITUAL,
    name: "Healing Ritual",
    heroId: "arythea",
    description: "Flip (except combat): Discard up to 2 Wounds, one goes to closest hero",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_HEALING],
  },
};

// ============================================================================
// Skill ID List
// ============================================================================

export const ARYTHEA_SKILL_IDS = [
  SKILL_ARYTHEA_DARK_PATHS,
  SKILL_ARYTHEA_BURNING_POWER,
  SKILL_ARYTHEA_HOT_SWORDSMANSHIP,
  SKILL_ARYTHEA_DARK_NEGOTIATION,
  SKILL_ARYTHEA_DARK_FIRE_MAGIC,
  SKILL_ARYTHEA_POWER_OF_PAIN,
  SKILL_ARYTHEA_INVOCATION,
  SKILL_ARYTHEA_POLARIZATION,
  SKILL_ARYTHEA_MOTIVATION,
  SKILL_ARYTHEA_HEALING_RITUAL,
] as const;
