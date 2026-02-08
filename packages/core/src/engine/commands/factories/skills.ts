/**
 * Skill Command Factories
 *
 * Factory functions for creating skill-related commands from player actions.
 *
 * @module commands/factories/skills
 */

import type { UseSkillAction, ReturnInteractiveSkillAction } from "@mage-knight/shared";
import type { CommandFactory } from "./types.js";
import { createUseSkillCommand } from "../useSkillCommand.js";
import { createReturnInteractiveSkillCommand } from "../returnInteractiveSkillCommand.js";

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
    manaSource: useSkillAction.manaSource,
  });
};

/**
 * Create a RETURN_INTERACTIVE_SKILL command from a player action.
 */
export const createReturnInteractiveSkillCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  const returnAction = action as ReturnInteractiveSkillAction;

  return createReturnInteractiveSkillCommand({
    playerId,
    skillId: returnAction.skillId,
  });
};
