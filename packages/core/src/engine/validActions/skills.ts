/**
 * Skills options computation.
 *
 * Handles skill-related valid actions:
 * - Skill activation during player turns (for skills with effects)
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { SkillEffectsOptions, ActivatableSkill } from "@mage-knight/shared";
import {
  getSkillDefinition,
  SKILL_USAGE_PASSIVE,
  SKILL_USAGE_ONCE_PER_ROUND,
  SKILL_USAGE_ONCE_PER_TURN,
} from "../../data/skills/index.js";

/**
 * Get skill effects options during player turns.
 * Returns undefined if no skill effects are available.
 */
export function getSkillEffectsOptions(
  _state: GameState,
  player: Player
): SkillEffectsOptions | undefined {
  const activatableSkills = getActivatableSkills(player);

  if (activatableSkills.length === 0) {
    return undefined;
  }

  return {
    activatableSkills,
  };
}

/**
 * Get skills that the player can activate this turn.
 */
function getActivatableSkills(player: Player): ActivatableSkill[] {
  const result: ActivatableSkill[] = [];

  for (const skillId of player.skills) {
    const skillDef = getSkillDefinition(skillId);
    if (!skillDef) continue;

    // Skip passive skills
    if (skillDef.usageType === SKILL_USAGE_PASSIVE) continue;

    // Skip skills without effects
    if (!skillDef.effect) continue;

    // Check cooldowns based on usage type
    if (skillDef.usageType === SKILL_USAGE_ONCE_PER_ROUND) {
      if (player.skillCooldowns.usedThisRound.includes(skillId)) continue;
    } else if (skillDef.usageType === SKILL_USAGE_ONCE_PER_TURN) {
      if (player.skillCooldowns.usedThisTurn.includes(skillId)) continue;
    }

    result.push({
      skillId,
      name: skillDef.name,
      description: skillDef.description,
    });
  }

  return result;
}
