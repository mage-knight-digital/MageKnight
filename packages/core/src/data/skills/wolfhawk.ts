/**
 * Wolfhawk Skill Definitions
 *
 * @module data/skills/wolfhawk
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

export const SKILL_WOLFHAWK_REFRESHING_BATH = "wolfhawk_refreshing_bath" as SkillId;
export const SKILL_WOLFHAWK_REFRESHING_BREEZE = "wolfhawk_refreshing_breeze" as SkillId;
export const SKILL_WOLFHAWK_HAWK_EYES = "wolfhawk_hawk_eyes" as SkillId;
export const SKILL_WOLFHAWK_ON_HER_OWN = "wolfhawk_on_her_own" as SkillId;
export const SKILL_WOLFHAWK_DEADLY_AIM = "wolfhawk_deadly_aim" as SkillId;
export const SKILL_WOLFHAWK_KNOW_YOUR_PREY = "wolfhawk_know_your_prey" as SkillId;
export const SKILL_WOLFHAWK_TAUNT = "wolfhawk_taunt" as SkillId;
export const SKILL_WOLFHAWK_DUELING = "wolfhawk_dueling" as SkillId;
export const SKILL_WOLFHAWK_MOTIVATION = "wolfhawk_motivation" as SkillId;
export const SKILL_WOLFHAWK_WOLFS_HOWL = "wolfhawk_wolfs_howl" as SkillId;

// ============================================================================
// Skill Definitions
// ============================================================================

export const WOLFHAWK_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_WOLFHAWK_REFRESHING_BATH]: {
    id: SKILL_WOLFHAWK_REFRESHING_BATH,
    name: "Refreshing Bath",
    heroId: "wolfhawk",
    description: "Flip for Heal 1 and 1 blue crystal (except combat)",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_HEALING, CATEGORY_SPECIAL],
  },
  [SKILL_WOLFHAWK_REFRESHING_BREEZE]: {
    id: SKILL_WOLFHAWK_REFRESHING_BREEZE,
    name: "Refreshing Breeze",
    heroId: "wolfhawk",
    description: "Flip for Heal 1 and 1 white crystal (except combat)",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_HEALING, CATEGORY_SPECIAL],
  },
  [SKILL_WOLFHAWK_HAWK_EYES]: {
    id: SKILL_WOLFHAWK_HAWK_EYES,
    name: "Hawk Eyes",
    heroId: "wolfhawk",
    description: "Move 1. Night: exploring -1. Day: reveal garrisons at distance 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT, CATEGORY_SPECIAL],
  },
  [SKILL_WOLFHAWK_ON_HER_OWN]: {
    id: SKILL_WOLFHAWK_ON_HER_OWN,
    name: "On Her Own",
    heroId: "wolfhawk",
    description: "Influence 1. Influence 3 if no Unit recruited this turn",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_INFLUENCE],
  },
  [SKILL_WOLFHAWK_DEADLY_AIM]: {
    id: SKILL_WOLFHAWK_DEADLY_AIM,
    name: "Deadly Aim",
    heroId: "wolfhawk",
    description: "Ranged/Siege: +1 to Attack. Attack phase: +2 to Attack",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_WOLFHAWK_KNOW_YOUR_PREY]: {
    id: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
    name: "Know Your Prey",
    heroId: "wolfhawk",
    description: "Flip to ignore one enemy ability or remove attack element",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_WOLFHAWK_TAUNT]: {
    id: SKILL_WOLFHAWK_TAUNT,
    name: "Taunt",
    heroId: "wolfhawk",
    description: "Block phase: Enemy attack -1, OR +2 attack but armor -2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_WOLFHAWK_DUELING]: {
    id: SKILL_WOLFHAWK_DUELING,
    name: "Dueling",
    heroId: "wolfhawk",
    description: "Block 1 and Attack 1 vs same enemy. +1 Fame without Units",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_WOLFHAWK_MOTIVATION]: {
    id: SKILL_WOLFHAWK_MOTIVATION,
    name: "Motivation",
    heroId: "wolfhawk",
    description: "On any player's turn: flip to draw 2 cards. If lowest Fame: +1 Fame",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_WOLFHAWK_WOLFS_HOWL]: {
    id: SKILL_WOLFHAWK_WOLFS_HOWL,
    name: "Wolf's Howl",
    heroId: "wolfhawk",
    description: "Sideways card +4. +1 per Command token without Unit. Others' Units -1",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_SPECIAL],
  },
};

// ============================================================================
// Skill ID List
// ============================================================================

export const WOLFHAWK_SKILL_IDS = [
  SKILL_WOLFHAWK_REFRESHING_BATH,
  SKILL_WOLFHAWK_REFRESHING_BREEZE,
  SKILL_WOLFHAWK_HAWK_EYES,
  SKILL_WOLFHAWK_ON_HER_OWN,
  SKILL_WOLFHAWK_DEADLY_AIM,
  SKILL_WOLFHAWK_KNOW_YOUR_PREY,
  SKILL_WOLFHAWK_TAUNT,
  SKILL_WOLFHAWK_DUELING,
  SKILL_WOLFHAWK_MOTIVATION,
  SKILL_WOLFHAWK_WOLFS_HOWL,
] as const;
