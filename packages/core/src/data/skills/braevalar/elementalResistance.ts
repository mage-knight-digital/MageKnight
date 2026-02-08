/**
 * Elemental Resistance - Braevalar Skill
 *
 * Once a turn: Ignore either the next 2 points of damage from a single Fire or Ice attack,
 * or 1 point of damage from another type of attack.
 *
 * Key rules:
 * - Damage reduction, NOT attack reduction (happens AFTER Brutal doubling)
 * - Cold Fire = "another type" (only 1 point reduction, not 2)
 * - Applies to a single attack only (consumed after use)
 * - Only protects hero, not units
 *
 * @module data/skills/braevalar/elementalResistance
 */

import type { SkillId } from "@mage-knight/shared";
import { ELEMENT_FIRE, ELEMENT_ICE, ELEMENT_PHYSICAL, ELEMENT_COLD_FIRE } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { EFFECT_APPLY_MODIFIER, EFFECT_CHOICE } from "../../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_HERO_DAMAGE_REDUCTION,
} from "../../../types/modifierConstants.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE = "braevalar_elemental_resistance" as SkillId;

const elementalResistanceEffect = {
  type: EFFECT_CHOICE,
  options: [
    // Option 1: Reduce Fire or Ice attack damage by 2
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_HERO_DAMAGE_REDUCTION,
        amount: 2,
        elements: [ELEMENT_FIRE, ELEMENT_ICE],
      },
      duration: DURATION_COMBAT,
      description: "Elemental Resistance: -2 Fire/Ice damage",
    },
    // Option 2: Reduce other attack types (Physical, Cold Fire) by 1
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_HERO_DAMAGE_REDUCTION,
        amount: 1,
        elements: [ELEMENT_PHYSICAL, ELEMENT_COLD_FIRE],
      },
      duration: DURATION_COMBAT,
      description: "Elemental Resistance: -1 other damage",
    },
  ],
} as const;

export const elementalResistance: SkillDefinition = {
  id: SKILL_BRAEVALAR_ELEMENTAL_RESISTANCE,
  name: "Elemental Resistance",
  heroId: "braevalar",
  description: "Ignore 2 Fire/Ice damage or 1 other damage",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: elementalResistanceEffect,
  categories: [CATEGORY_COMBAT],
};
