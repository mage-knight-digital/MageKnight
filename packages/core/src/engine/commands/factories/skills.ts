/**
 * Skill Command Factories
 *
 * Factory functions that translate skill-related PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/skills
 *
 * @remarks Factories in this module:
 * - createUseSkillCommandFromAction - Activate a skill
 */

import type { CommandFactory } from "./types.js";
import type { PlayerAction, SkillId } from "@mage-knight/shared";
import { USE_SKILL_ACTION } from "@mage-knight/shared";
import { createUseSkillCommand } from "../useSkillCommand.js";

/**
 * Helper to get skill id from use skill action.
 */
function getSkillIdFromAction(action: PlayerAction): SkillId | null {
  if (action.type === USE_SKILL_ACTION && "skillId" in action) {
    return action.skillId;
  }
  return null;
}

/**
 * Use skill command factory.
 * Creates a command to activate a skill.
 */
export const createUseSkillCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  const skillId = getSkillIdFromAction(action);
  if (!skillId) return null;

  return createUseSkillCommand({
    playerId,
    skillId,
  });
};
