/**
 * Braevalar Skill Definitions
 *
 * @module data/skills/braevalar
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

export const SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE = "braevalar_elemental_resistance" as SkillId;
export const SKILL_BRAEVALAR_FERAL_ALLIES = "braevalar_feral_allies" as SkillId;
export const SKILL_BRAEVALAR_THUNDERSTORM = "braevalar_thunderstorm" as SkillId;
export const SKILL_BRAEVALAR_LIGHTNING_STORM = "braevalar_lightning_storm" as SkillId;
export const SKILL_BRAEVALAR_BEGUILE = "braevalar_beguile" as SkillId;
export const SKILL_BRAEVALAR_FORKED_LIGHTNING = "braevalar_forked_lightning" as SkillId;
export const SKILL_BRAEVALAR_SHAPESHIFT = "braevalar_shapeshift" as SkillId;
export const SKILL_BRAEVALAR_SECRET_WAYS = "braevalar_secret_ways" as SkillId;
export const SKILL_BRAEVALAR_REGENERATE = "braevalar_regenerate" as SkillId;
export const SKILL_BRAEVALAR_NATURES_VENGEANCE = "braevalar_natures_vengeance" as SkillId;

// ============================================================================
// Skill Definitions
// ============================================================================

export const BRAEVALAR_SKILLS: Record<SkillId, SkillDefinition> = {
  [SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE]: {
    id: SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE,
    name: "Elemental Resistance",
    heroId: "braevalar",
    description: "Ignore 2 Fire/Ice damage or 1 other damage",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_BRAEVALAR_FERAL_ALLIES]: {
    id: SKILL_BRAEVALAR_FERAL_ALLIES,
    name: "Feral Allies",
    heroId: "braevalar",
    description: "Exploring -1 Move. Attack 1 or reduce enemy attack by 1",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT, CATEGORY_COMBAT],
  },
  [SKILL_BRAEVALAR_THUNDERSTORM]: {
    id: SKILL_BRAEVALAR_THUNDERSTORM,
    name: "Thunderstorm",
    heroId: "braevalar",
    description: "Flip to gain 1 green/blue mana and 1 green/white mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_BRAEVALAR_LIGHTNING_STORM]: {
    id: SKILL_BRAEVALAR_LIGHTNING_STORM,
    name: "Lightning Storm",
    heroId: "braevalar",
    description: "Flip to gain 1 blue/green mana and 1 blue/red mana",
    usageType: SKILL_USAGE_ONCE_PER_ROUND,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_BRAEVALAR_BEGUILE]: {
    id: SKILL_BRAEVALAR_BEGUILE,
    name: "Beguile",
    heroId: "braevalar",
    description: "Influence 3. Fortified: 2. Magical Glade: 4",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_INFLUENCE],
  },
  [SKILL_BRAEVALAR_FORKED_LIGHTNING]: {
    id: SKILL_BRAEVALAR_FORKED_LIGHTNING,
    name: "Forked Lightning",
    heroId: "braevalar",
    description: "Ranged Cold Fire Attack 1 against up to 3 enemies",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_COMBAT],
  },
  [SKILL_BRAEVALAR_SHAPESHIFT]: {
    id: SKILL_BRAEVALAR_SHAPESHIFT,
    name: "Shapeshift",
    heroId: "braevalar",
    description: "Basic Action with Move/Attack/Block becomes another type",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_SPECIAL],
  },
  [SKILL_BRAEVALAR_SECRET_WAYS]: {
    id: SKILL_BRAEVALAR_SECRET_WAYS,
    name: "Secret Ways",
    heroId: "braevalar",
    description: "Move 1. Mountains 5 Move. Blue mana: lakes 2 Move",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_MOVEMENT],
  },
  [SKILL_BRAEVALAR_REGENERATE]: {
    id: SKILL_BRAEVALAR_REGENERATE,
    name: "Regenerate",
    heroId: "braevalar",
    description: "Pay mana, discard Wound. Red mana or lowest Fame: draw card",
    usageType: SKILL_USAGE_ONCE_PER_TURN,
    categories: [CATEGORY_HEALING],
  },
  [SKILL_BRAEVALAR_NATURES_VENGEANCE]: {
    id: SKILL_BRAEVALAR_NATURES_VENGEANCE,
    name: "Nature's Vengeance",
    heroId: "braevalar",
    description: "Reduce enemy attack by 1, gains Cumbersome. Others' enemies +1 attack",
    usageType: SKILL_USAGE_INTERACTIVE,
    categories: [CATEGORY_COMBAT],
  },
};

// ============================================================================
// Skill ID List
// ============================================================================

export const BRAEVALAR_SKILL_IDS = [
  SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE,
  SKILL_BRAEVALAR_FERAL_ALLIES,
  SKILL_BRAEVALAR_THUNDERSTORM,
  SKILL_BRAEVALAR_LIGHTNING_STORM,
  SKILL_BRAEVALAR_BEGUILE,
  SKILL_BRAEVALAR_FORKED_LIGHTNING,
  SKILL_BRAEVALAR_SHAPESHIFT,
  SKILL_BRAEVALAR_SECRET_WAYS,
  SKILL_BRAEVALAR_REGENERATE,
  SKILL_BRAEVALAR_NATURES_VENGEANCE,
] as const;
