/**
 * Unit Command Factories
 *
 * Factory functions that translate unit-related PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/units
 *
 * @remarks Factories in this module:
 * - createRecruitUnitCommandFromAction - Recruit a unit from an offer
 * - createActivateUnitCommandFromAction - Activate a unit's ability
 */

import type { CommandFactory } from "./types.js";
import { RECRUIT_UNIT_ACTION, ACTIVATE_UNIT_ACTION } from "@mage-knight/shared";
import {
  createRecruitUnitCommand,
  createActivateUnitCommand,
} from "../units/index.js";

/**
 * Recruit unit command factory.
 * Creates a command to recruit a unit from an offer.
 */
export const createRecruitUnitCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== RECRUIT_UNIT_ACTION) return null;
  return createRecruitUnitCommand({
    playerId,
    unitId: action.unitId,
    influenceSpent: action.influenceSpent,
  });
};

/**
 * Activate unit command factory.
 * Creates a command to activate a unit's ability.
 */
export const createActivateUnitCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== ACTIVATE_UNIT_ACTION) return null;
  return createActivateUnitCommand({
    playerId,
    unitInstanceId: action.unitInstanceId,
    abilityIndex: action.abilityIndex,
  });
};
