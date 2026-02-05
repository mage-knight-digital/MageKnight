/**
 * Banner Command Factories
 *
 * Factory functions that translate banner-related PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/banners
 */

import type { CommandFactory } from "./types.js";
import { ASSIGN_BANNER_ACTION } from "@mage-knight/shared";
import { createAssignBannerCommand } from "../banners/index.js";

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
