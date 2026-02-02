/**
 * Valid actions for skill activation.
 *
 * Computes which skills a player can activate based on:
 * - Skills they have learned
 * - Skill cooldowns (once per turn, once per round)
 * - Skill usage type (only activatable skills, not passive/interactive)
 * - Combat skills (CATEGORY_COMBAT) only available during combat
 * - Block skills only available during block phase
 * - Skill-specific requirements (e.g., not in combat, has wound in hand)
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { SkillOptions } from "@mage-knight/shared";
import {
  SKILLS,
  SKILL_USAGE_ONCE_PER_TURN,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_TOVAK_SHIELD_MASTERY,
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_ARYTHEA_POLARIZATION,
  SKILL_BRAEVALAR_THUNDERSTORM,
} from "../../data/skills/index.js";
import { CATEGORY_COMBAT } from "../../types/cards.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";
import { CARD_WOUND } from "@mage-knight/shared";
import { canActivatePolarization } from "../commands/skills/polarizationEffect.js";

/**
 * Skills that have effect implementations and can be activated.
 * As more skills are implemented, add them here.
 */
const IMPLEMENTED_SKILLS = new Set([
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
  SKILL_TOVAK_SHIELD_MASTERY,
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_ARYTHEA_POLARIZATION,
  SKILL_BRAEVALAR_THUNDERSTORM,
]);

/**
 * Check skill-specific requirements beyond cooldowns.
 * Returns true if the skill can be activated, false otherwise.
 */
function canActivateSkill(
  state: GameState,
  player: Player,
  skillId: string
): boolean {
  switch (skillId) {
    case SKILL_TOVAK_I_FEEL_NO_PAIN:
      // Cannot use during combat
      if (state.combat !== null) {
        return false;
      }
      // Must have a wound in hand
      if (!player.hand.some((c) => c === CARD_WOUND)) {
        return false;
      }
      return true;

    case SKILL_ARYTHEA_POLARIZATION:
      // Must have at least one convertible mana source
      return canActivatePolarization(state, player);

    default:
      // No special requirements
      return true;
  }
}

/**
 * Get skill activation options for a player.
 *
 * Returns undefined if no skills can be activated.
 */
export function getSkillOptions(
  state: GameState,
  player: Player
): SkillOptions | undefined {
  const activatable = [];
  const inCombat = state.combat !== null;

  for (const skillId of player.skills) {
    const skill = SKILLS[skillId];
    if (!skill) continue;

    // Only include skills that have been implemented
    if (!IMPLEMENTED_SKILLS.has(skillId)) continue;

    // Combat skills (CATEGORY_COMBAT) are only available during combat
    if (skill.categories.includes(CATEGORY_COMBAT) && !inCombat) {
      continue;
    }

    // Block skills are only available during block phase
    const blockSkills = [SKILL_TOVAK_SHIELD_MASTERY];
    if (blockSkills.includes(skillId)) {
      if (!state.combat || state.combat.phase !== COMBAT_PHASE_BLOCK) {
        continue;
      }
    }

    // Check if skill can be activated based on usage type
    if (skill.usageType === SKILL_USAGE_ONCE_PER_TURN) {
      // Check turn cooldown
      if (player.skillCooldowns.usedThisTurn.includes(skillId)) {
        continue;
      }
    } else if (skill.usageType === SKILL_USAGE_ONCE_PER_ROUND) {
      // Check round cooldown
      if (player.skillCooldowns.usedThisRound.includes(skillId)) {
        continue;
      }
    } else {
      // Passive and interactive skills are not directly activatable via USE_SKILL
      continue;
    }

    // Check skill-specific requirements
    if (!canActivateSkill(state, player, skillId)) {
      continue;
    }

    activatable.push({
      skillId,
      name: skill.name,
      description: skill.description,
    });
  }

  if (activatable.length === 0) {
    return undefined;
  }

  return { activatable };
}
