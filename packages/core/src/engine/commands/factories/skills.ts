/**
 * Skill Command Factories
 *
 * Factory functions for creating skill-related commands from player actions.
 *
 * @module commands/factories/skills
 */

import type { UseSkillAction } from "@mage-knight/shared";
import type { CommandFactory } from "./types.js";
import { createUseSkillCommand } from "../useSkillCommand.js";

/**
 * Create a USE_SKILL command from a player action.
 */
export const createUseSkillCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  const useSkillAction = action as UseSkillAction;

  return createUseSkillCommand({
    playerId,
    skillId: useSkillAction.skillId,
  });
};
