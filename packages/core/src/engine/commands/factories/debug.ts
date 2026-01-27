/**
 * Debug Command Factories
 *
 * Factory functions that translate debug PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/debug
 *
 * @remarks Factories in this module:
 * - createDebugAddFameCommandFromAction - Add fame and trigger level up flow
 * - createDebugTriggerLevelUpCommandFromAction - Process pending level ups immediately
 */

import type { CommandFactory } from "./types.js";
import {
  DEBUG_ADD_FAME_ACTION,
  DEBUG_TRIGGER_LEVEL_UP_ACTION,
} from "@mage-knight/shared";
import { createDebugAddFameCommand } from "../debug/debugAddFameCommand.js";
import { createDebugTriggerLevelUpCommand } from "../debug/debugTriggerLevelUpCommand.js";

/**
 * Debug add fame command factory.
 * Creates a command to add fame to a player and trigger level up flow.
 */
export const createDebugAddFameCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== DEBUG_ADD_FAME_ACTION) return null;

  return createDebugAddFameCommand({
    playerId,
    amount: action.amount,
  });
};

/**
 * Debug trigger level up command factory.
 * Creates a command to process pending level ups immediately.
 */
export const createDebugTriggerLevelUpCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== DEBUG_TRIGGER_LEVEL_UP_ACTION) return null;

  return createDebugTriggerLevelUpCommand({
    playerId,
  });
};
