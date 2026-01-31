/**
 * Krang Skill Definitions
 *
 * @module data/skills/krang
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

export const SKILL_KRANG_SPIRIT_GUIDES = "krang_spirit_guides" as SkillId;
export const SKILL_KRANG_BATTLE_HARDENED = "krang_battle_hardened" as SkillId;
export const SKILL_KRANG_BATTLE_FRENZY = "krang_battle_frenzy" as SkillId;
export const SKILL_KRANG_SHAMANIC_RITUAL = "krang_shamanic_ritual" as SkillId;
export const SKILL_KRANG_REGENERATE = "krang_regenerate" as SkillId;
export const SKILL_KRANG_ARCANE_DISGUISE = "krang_arcane_disguise" as SkillId;
export const SKILL_KRANG_PUPPET_MASTER = "krang_puppet_master" as SkillId;
export const SKILL_KRANG_MASTER_OF_CHAOS = "krang_master_of_chaos" as SkillId;
export const SKILL_KRANG_CURSE = "krang_curse" as SkillId;
export const SKILL_KRANG_MANA_SUPPRESSION = "krang_mana_suppression" as SkillId;

// ============================================================================
// Skill Definitions
// ============================================================================

export const KRANG_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_KRANG_SPIRIT_GUIDES]: {
    id: SKILL_KRANG_SPIRIT_GUIDES,
    name: "Spirit Guides",
    heroId: "krang",
    description: "Move 1 and may add +1 to a Block",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
  },
  [SKILL_KRANG_BATTLE_HARDENED]: {
    id: SKILL_KRANG_BATTLE_HARDENED,
    name: "Battle Hardened",
    heroId: "krang",
    description: "Ignore 2 physical damage or 1 non-physical damage",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_KRANG_BATTLE_FRENZY]: {
    id: SKILL_KRANG_BATTLE_FRENZY,
    name: "Battle Frenzy",
    heroId: "krang",
    description: "Attack 2. Flip for Attack 4. Flip back when resting",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_KRANG_SHAMANIC_RITUAL]: {
    id: SKILL_KRANG_SHAMANIC_RITUAL,
    name: "Shamanic Ritual",
    heroId: "krang",
    description: "Flip to gain mana of any color. May flip back as action",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_KRANG_REGENERATE]: {
    id: SKILL_KRANG_REGENERATE,
    name: "Regenerate",
    heroId: "krang",
    description: "Pay mana, discard Wound. Red mana or lowest Fame: draw card",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_HEALING],
  },
  [SKILL_KRANG_ARCANE_DISGUISE]: {
    id: SKILL_KRANG_ARCANE_DISGUISE,
    name: "Arcane Disguise",
    heroId: "krang",
    description: "Influence 2, or flip to ignore reputation. Green mana to flip back",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_INFLUENCE],
  },
  [SKILL_KRANG_PUPPET_MASTER]: {
    id: SKILL_KRANG_PUPPET_MASTER,
    name: "Puppet Master",
    heroId: "krang",
    description: "Keep defeated enemy token. Discard for half Attack or half Block",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_KRANG_MASTER_OF_CHAOS]: {
    id: SKILL_KRANG_MASTER_OF_CHAOS,
    name: "Master of Chaos",
    heroId: "krang",
    description: "Rotate shield for: Block 3, Move 1, Ranged 1, Influence 2, Attack 2",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_KRANG_CURSE]: {
    id: SKILL_KRANG_CURSE,
    name: "Curse",
    heroId: "krang",
    description: "Enemy Attack -1 or Armor -1 (min 1). Not vs fortified in Ranged",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_KRANG_MANA_SUPPRESSION]: {
    id: SKILL_KRANG_MANA_SUPPRESSION,
    name: "Mana Suppression",
    heroId: "krang",
    description: "First mana each turn costs extra. Gain crystal from tokens",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_SPECIAL],
  },
};

// ============================================================================
// Skill ID List
// ============================================================================

export const KRANG_SKILL_IDS = [
  SKILL_KRANG_SPIRIT_GUIDES,
  SKILL_KRANG_BATTLE_HARDENED,
  SKILL_KRANG_BATTLE_FRENZY,
  SKILL_KRANG_SHAMANIC_RITUAL,
  SKILL_KRANG_REGENERATE,
  SKILL_KRANG_ARCANE_DISGUISE,
  SKILL_KRANG_PUPPET_MASTER,
  SKILL_KRANG_MASTER_OF_CHAOS,
  SKILL_KRANG_CURSE,
  SKILL_KRANG_MANA_SUPPRESSION,
] as const;
