/**
 * Battle Hardened - Krang Skill
 *
 * Once a turn: Ignore either the next 2 points of damage assigned to your hero
 * from a single physical attack, or 1 point of damage from a non-physical attack.
 *
 * Key rules:
 * - Damage reduction, NOT attack reduction (happens AFTER Brutal doubling per Q1)
 * - Applied after unblocked attack becomes damage, before armor comparison (per Q2)
 * - Physical = 2 point reduction, Non-physical (Fire, Ice, Cold Fire) = 1 point
 * - Applies to a single attack only (consumed after use)
 * - Only protects hero, not units
 *
 * @module data/skills/krang/battleHardened
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

export const SKILL_KRANG_BATTLE_HARDENED = "krang_battle_hardened" as SkillId;

const battleHardenedEffect = {
  type: EFFECT_CHOICE,
  options: [
    // Option 1: Reduce Physical attack damage by 2
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_HERO_DAMAGE_REDUCTION,
        amount: 2,
        elements: [ELEMENT_PHYSICAL],
      },
      duration: DURATION_COMBAT,
      description: "Battle Hardened: -2 Physical damage",
    },
    // Option 2: Reduce non-physical attack types (Fire, Ice, Cold Fire) by 1
    {
      type: EFFECT_APPLY_MODIFIER,
      modifier: {
        type: EFFECT_HERO_DAMAGE_REDUCTION,
        amount: 1,
        elements: [ELEMENT_FIRE, ELEMENT_ICE, ELEMENT_COLD_FIRE],
      },
      duration: DURATION_COMBAT,
      description: "Battle Hardened: -1 non-physical damage",
    },
  ],
} as const;

export const battleHardened: SkillDefinition = {
  id: SKILL_KRANG_BATTLE_HARDENED,
  name: "Battle Hardened",
  heroId: "krang",
  description: "Ignore 2 physical damage or 1 non-physical damage",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: battleHardenedEffect,
  categories: [CATEGORY_COMBAT],
};
