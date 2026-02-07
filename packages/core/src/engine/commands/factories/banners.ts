/**
 * Banner Command Factories
 *
 * Factory functions that translate banner-related PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/banners
 */

import type { CommandFactory } from "./types.js";
import { ASSIGN_BANNER_ACTION, USE_BANNER_FEAR_ACTION } from "@mage-knight/shared";
import { createAssignBannerCommand, createUseBannerFearCommand } from "../banners/index.js";

/**
 * Assign banner command factory.
 * Creates a command to assign a banner artifact from hand to a unit.
 */
export const createAssignBannerCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== ASSIGN_BANNER_ACTION) return null;
  return createAssignBannerCommand({
    playerId,
    bannerCardId: action.bannerCardId,
    targetUnitInstanceId: action.targetUnitInstanceId,
  });
};

/**
 * Use Banner of Fear command factory.
 * Creates a command to cancel an enemy attack using Banner of Fear.
 */
export const createUseBannerFearCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== USE_BANNER_FEAR_ACTION) return null;
  return createUseBannerFearCommand({
    playerId,
    unitInstanceId: action.unitInstanceId,
    targetEnemyInstanceId: action.targetEnemyInstanceId,
    attackIndex: action.attackIndex ?? 0,
  });
};
