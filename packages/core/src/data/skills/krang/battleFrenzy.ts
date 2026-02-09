/**
 * Battle Frenzy - Krang Skill
 *
 * Once a turn: Attack 2, or you may flip this token to get Attack 4 instead
 * this turn. If you spend a turn resting, you may flip this token back.
 *
 * Key rules:
 * - Choice between Attack 2 (stay face-up) or Attack 4 (flip face-down)
 * - When face-down: cannot activate until flipped back
 * - Flip back by resting (optional) or automatically at round start
 * - Attack can be used standalone (S1)
 *
 * @module data/skills/krang/battleFrenzy
 */

import type { SkillId } from "@mage-knight/shared";
import { CATEGORY_COMBAT } from "../../../types/cards.js";
import { EFFECT_CHOICE, EFFECT_GAIN_ATTACK, COMBAT_TYPE_MELEE } from "../../../types/effectTypes.js";
import { type SkillDefinition, SKILL_USAGE_ONCE_PER_TURN } from "../types.js";

export const SKILL_KRANG_BATTLE_FRENZY = "krang_battle_frenzy" as SkillId;

/**
 * Battle Frenzy effect: choice between Attack 2 or Attack 4.
 *
 * The flip side-effect when choosing Attack 4 is handled in
 * resolveChoiceCommand.ts (similar to Mana Overload center placement).
 */
const battleFrenzyEffect = {
  type: EFFECT_CHOICE,
  options: [
    // Option 0: Attack 2 (stays face-up)
    { type: EFFECT_GAIN_ATTACK, amount: 2, combatType: COMBAT_TYPE_MELEE },
    // Option 1: Attack 4 (flips face-down — handled in resolveChoiceCommand)
    { type: EFFECT_GAIN_ATTACK, amount: 4, combatType: COMBAT_TYPE_MELEE },
  ],
} as const;

export const battleFrenzy: SkillDefinition = {
  id: SKILL_KRANG_BATTLE_FRENZY,
  name: "Battle Frenzy",
  heroId: "krang",
  description: "Attack 2. Flip for Attack 4. Flip back when resting",
  usageType: SKILL_USAGE_ONCE_PER_TURN,
  effect: battleFrenzyEffect,
  categories: [CATEGORY_COMBAT],
};
