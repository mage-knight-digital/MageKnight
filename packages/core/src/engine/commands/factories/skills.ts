/**
 * Skill Command Factories
 *
 * Factory functions for creating skill-related commands from player actions.
 *
 * @module commands/factories/skills
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction, UseSkillAction } from "@mage-knight/shared";
import type { Command } from "../../commands.js";
import { USE_SKILL_ACTION } from "@mage-knight/shared";
import { createUseSkillCommand } from "../skills/useSkillCommand.js";

/**
 * Create a UseSkillCommand from a player action.
 */
export function createUseSkillCommandFromAction(
  _state: GameState,
  playerId: string,
  action: PlayerAction
): Command | null {
  if (action.type !== USE_SKILL_ACTION) return null;

  const skillAction = action as UseSkillAction;

  return createUseSkillCommand({
    playerId,
    skillId: skillAction.skillId,
  });
}
