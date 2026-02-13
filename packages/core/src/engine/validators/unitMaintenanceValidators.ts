/**
 * Unit maintenance validators (Magic Familiars round-start)
 *
 * Validates RESOLVE_UNIT_MAINTENANCE actions:
 * - Player has pending unit maintenance
 * - Unit is in the pending maintenance list
 * - Crystal is available if keeping the unit
 * - Token color is provided if keeping the unit
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import { RESOLVE_UNIT_MAINTENANCE_ACTION } from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  NO_MAINTENANCE_PENDING,
  UNIT_NOT_IN_MAINTENANCE,
  MAINTENANCE_REQUIRES_CRYSTAL,
  MAINTENANCE_REQUIRES_TOKEN_COLOR,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import {
  hasPendingUnitMaintenance,
  isUnitInMaintenanceList,
  hasCrystalAvailable,
} from "../rules/unitMaintenance.js";

/**
 * Validate that the player has pending unit maintenance
 */
export const validateHasPendingUnitMaintenance: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!hasPendingUnitMaintenance(player)) {
    return invalid(NO_MAINTENANCE_PENDING, "No pending unit maintenance");
  }

  return valid();
};

/**
 * Validate that the specified unit is in the pending maintenance list
 * and that crystal/token color are provided when keeping the unit
 */
export const validateUnitMaintenanceChoice: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_UNIT_MAINTENANCE_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  // Null case caught by validateHasPendingUnitMaintenance
  if (!player.pendingUnitMaintenance) {
    return valid();
  }

  if (!isUnitInMaintenanceList(player, action.unitInstanceId)) {
    return invalid(
      UNIT_NOT_IN_MAINTENANCE,
      `Unit ${action.unitInstanceId} is not in pending maintenance list`
    );
  }

  if (action.keepUnit) {
    // Must provide crystal color
    if (!action.crystalColor) {
      return invalid(
        MAINTENANCE_REQUIRES_CRYSTAL,
        "Must specify crystal color when keeping unit"
      );
    }

    // Must have the crystal available
    if (!hasCrystalAvailable(player, action.crystalColor)) {
      return invalid(
        MAINTENANCE_REQUIRES_CRYSTAL,
        `No ${action.crystalColor} crystal available for maintenance`
      );
    }

    // Must provide new mana token color
    if (!action.newManaTokenColor) {
      return invalid(
        MAINTENANCE_REQUIRES_TOKEN_COLOR,
        "Must specify new mana token color when keeping unit"
      );
    }
  }

  return valid();
};
