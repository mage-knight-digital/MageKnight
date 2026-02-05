/**
 * Terrain Cost Reduction Command Factories
 *
 * Factory functions that translate terrain cost reduction PlayerAction objects
 * into executable Command objects.
 *
 * @module commands/factories/terrainCostReduction
 */

import type { CommandFactory } from "./types.js";
import {
  RESOLVE_HEX_COST_REDUCTION_ACTION,
  RESOLVE_TERRAIN_COST_REDUCTION_ACTION,
} from "@mage-knight/shared";
import {
  createResolveHexCostReductionCommand,
  createResolveTerrainCostReductionCommand,
} from "../terrainCostReductionCommands.js";

/**
 * Resolve hex cost reduction command factory.
 * Creates a command to apply terrain cost reduction to a specific hex coordinate.
 */
export const createResolveHexCostReductionCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_HEX_COST_REDUCTION_ACTION) return null;
  return createResolveHexCostReductionCommand({
    playerId,
    coordinate: action.coordinate,
  });
};

/**
 * Resolve terrain cost reduction command factory.
 * Creates a command to apply terrain cost reduction to a terrain type.
 */
export const createResolveTerrainCostReductionCommandFromAction: CommandFactory = (
  _state,
  playerId,
  action
) => {
  if (action.type !== RESOLVE_TERRAIN_COST_REDUCTION_ACTION) return null;
  return createResolveTerrainCostReductionCommand({
    playerId,
    terrain: action.terrain,
  });
};
