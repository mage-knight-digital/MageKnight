/**
 * Tactics Command Factories
 *
 * Factory functions that translate tactics-related PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/tactics
 *
 * @remarks Factories in this module:
 * - createSelectTacticCommandFromAction - Select a tactic card at start of round
 * - createActivateTacticCommandFromAction - Activate a tactic's special ability
 * - createResolveTacticDecisionCommandFromAction - Resolve a tactic decision
 * - createRerollSourceDiceCommandFromAction - Reroll source dice (Mana Search tactic)
 */

import type { CommandFactory } from "./types.js";
import type { PlayerAction, TacticId } from "@mage-knight/shared";
import {
  SELECT_TACTIC_ACTION,
  ACTIVATE_TACTIC_ACTION,
  RESOLVE_TACTIC_DECISION_ACTION,
  REROLL_SOURCE_DICE_ACTION,
} from "@mage-knight/shared";
import { createSelectTacticCommand } from "../selectTacticCommand.js";
import { createActivateTacticCommand } from "../activateTacticCommand.js";
import { createResolveTacticDecisionCommand } from "../tactics/index.js";
import { createRerollSourceDiceCommand } from "../rerollSourceDiceCommand.js";

/**
 * Helper to get tactic id from action.
 */
function getTacticIdFromAction(action: PlayerAction): TacticId | null {
  if (action.type === SELECT_TACTIC_ACTION && "tacticId" in action) {
    return action.tacticId;
  }
  return null;
}

/**
 * Select tactic command factory.
 * Creates a command to select a tactic card at the start of a round.
 */
export const createSelectTacticCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  const tacticId = getTacticIdFromAction(action);
  if (!tacticId) return null;
  return createSelectTacticCommand({ playerId, tacticId });
};

/**
 * Activate tactic command factory.
 * Creates a command to activate a tactic's special ability.
 */
export const createActivateTacticCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== ACTIVATE_TACTIC_ACTION) return null;
  return createActivateTacticCommand({ playerId, tacticId: action.tacticId });
};

/**
 * Resolve tactic decision command factory.
 * Creates a command to resolve a pending tactic decision.
 */
export const createResolveTacticDecisionCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_TACTIC_DECISION_ACTION) return null;
  return createResolveTacticDecisionCommand({
    playerId,
    decision: action.decision,
  });
};

/**
 * Reroll source dice command factory (Mana Search tactic).
 * Creates a command to reroll selected source dice.
 */
export const createRerollSourceDiceCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== REROLL_SOURCE_DICE_ACTION) return null;
  return createRerollSourceDiceCommand({
    playerId,
    dieIds: action.dieIds,
  });
};
