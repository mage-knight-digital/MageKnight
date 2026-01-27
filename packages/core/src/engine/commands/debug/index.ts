/**
 * Debug Commands Module
 *
 * Commands for debugging and testing purposes.
 * These are only available in development mode.
 *
 * @module commands/debug
 */

export {
  DEBUG_ADD_FAME_COMMAND,
  createDebugAddFameCommand,
  type DebugAddFameCommandParams,
} from "./debugAddFameCommand.js";

export {
  DEBUG_TRIGGER_LEVEL_UP_COMMAND,
  createDebugTriggerLevelUpCommand,
  type DebugTriggerLevelUpCommandParams,
} from "./debugTriggerLevelUpCommand.js";
