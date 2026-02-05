/**
 * Terrain cost reduction validators (Druidic Paths)
 *
 * Validates RESOLVE_HEX_COST_REDUCTION and RESOLVE_TERRAIN_COST_REDUCTION actions.
 * These require the player to have a pending terrain cost reduction choice
 * and to select a valid coordinate or terrain type.
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import {
  RESOLVE_HEX_COST_REDUCTION_ACTION,
  RESOLVE_TERRAIN_COST_REDUCTION_ACTION,
  hexKey,
} from "@mage-knight/shared";
import { valid, invalid } from "./types.js";
import {
  TERRAIN_COST_REDUCTION_REQUIRED,
  TERRAIN_COST_REDUCTION_INVALID_COORDINATE,
  TERRAIN_COST_REDUCTION_INVALID_TERRAIN,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";

/**
 * Validate that the player has a pending hex cost reduction choice
 */
export const validateHasPendingHexCostReduction: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingTerrainCostReduction || player.pendingTerrainCostReduction.mode !== "hex") {
    return invalid(
      TERRAIN_COST_REDUCTION_REQUIRED,
      "No pending hex cost reduction choice"
    );
  }

  return valid();
};

/**
 * Validate that the chosen coordinate is in the available list
 */
export const validateHexCostReductionCoordinate: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_HEX_COST_REDUCTION_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingTerrainCostReduction || player.pendingTerrainCostReduction.mode !== "hex") {
    return valid(); // Let the other validator handle this
  }

  const selectedKey = hexKey(action.coordinate);
  const availableKeys = player.pendingTerrainCostReduction.availableCoordinates.map(hexKey);

  if (!availableKeys.includes(selectedKey)) {
    return invalid(
      TERRAIN_COST_REDUCTION_INVALID_COORDINATE,
      `Invalid coordinate for cost reduction: (${action.coordinate.q}, ${action.coordinate.r})`
    );
  }

  return valid();
};

/**
 * Validate that the player has a pending terrain type cost reduction choice
 */
export const validateHasPendingTerrainCostReduction: Validator = (
  state: GameState,
  playerId: string,
  _action: PlayerAction
): ValidationResult => {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingTerrainCostReduction || player.pendingTerrainCostReduction.mode !== "terrain") {
    return invalid(
      TERRAIN_COST_REDUCTION_REQUIRED,
      "No pending terrain cost reduction choice"
    );
  }

  return valid();
};

/**
 * Validate that the chosen terrain is in the available list
 */
export const validateTerrainCostReductionTerrain: Validator = (
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult => {
  if (action.type !== RESOLVE_TERRAIN_COST_REDUCTION_ACTION) {
    return valid();
  }

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (!player.pendingTerrainCostReduction || player.pendingTerrainCostReduction.mode !== "terrain") {
    return valid(); // Let the other validator handle this
  }

  if (!player.pendingTerrainCostReduction.availableTerrains.includes(action.terrain)) {
    return invalid(
      TERRAIN_COST_REDUCTION_INVALID_TERRAIN,
      `Invalid terrain for cost reduction: ${action.terrain}`
    );
  }

  return valid();
};
