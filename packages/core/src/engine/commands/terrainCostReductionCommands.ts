/**
 * Commands for terrain cost reduction actions (Druidic Paths and similar effects)
 *
 * These commands handle the player selecting which hex or terrain type should have
 * its movement cost reduced for the turn.
 */

import type { GameState } from "../../state/GameState.js";
import type { Command, CommandResult } from "./types.js";
import type { HexCoord, Terrain } from "@mage-knight/shared";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  SOURCE_CARD,
  SCOPE_SELF,
  TERRAIN_ALL,
} from "../../types/modifierConstants.js";
import { CARD_BRAEVALAR_DRUIDIC_PATHS } from "@mage-knight/shared";

export const RESOLVE_HEX_COST_REDUCTION_COMMAND =
  "RESOLVE_HEX_COST_REDUCTION" as const;
export const RESOLVE_TERRAIN_COST_REDUCTION_COMMAND =
  "RESOLVE_TERRAIN_COST_REDUCTION" as const;

export interface ResolveHexCostReductionCommandParams {
  readonly playerId: string;
  readonly coordinate: HexCoord;
}

export interface ResolveTerrainCostReductionCommandParams {
  readonly playerId: string;
  readonly terrain: string;
}

/**
 * Command: Resolve hex coordinate selection for cost reduction.
 * Applies a modifier that reduces the terrain cost for the specified coordinate.
 */
export function createResolveHexCostReductionCommand(
  params: ResolveHexCostReductionCommandParams
): Command {
  return {
    type: RESOLVE_HEX_COST_REDUCTION_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      // Clear pending state
      const updatedPlayer = {
        ...player,
        pendingTerrainCostReduction: null,
      };

      let newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
      };

      // Apply terrain cost modifier for specific coordinate
      newState = addModifier(newState, {
        type: EFFECT_TERRAIN_COST,
        source: {
          type: SOURCE_CARD,
          cardId: CARD_BRAEVALAR_DRUIDIC_PATHS,
          playerId: params.playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -1,
          minimum: 2,
          specificCoordinate: params.coordinate,
        },
        createdAtRound: state.round,
        createdByPlayerId: params.playerId,
      });

      return { state: newState, events: [] };
    },

    undo(state: GameState): CommandResult {
      return { state, events: [] };
    },
  };
}

/**
 * Command: Resolve terrain type selection for cost reduction.
 * Applies a modifier that reduces the terrain cost for the specified terrain type.
 */
export function createResolveTerrainCostReductionCommand(
  params: ResolveTerrainCostReductionCommandParams
): Command {
  return {
    type: RESOLVE_TERRAIN_COST_REDUCTION_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      // Clear pending state
      const updatedPlayer = {
        ...player,
        pendingTerrainCostReduction: null,
      };

      let newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
      };

      // Apply terrain cost modifier for specific terrain type
      newState = addModifier(newState, {
        type: EFFECT_TERRAIN_COST,
        source: {
          type: SOURCE_CARD,
          cardId: CARD_BRAEVALAR_DRUIDIC_PATHS,
          playerId: params.playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: params.terrain as Terrain,
          amount: -1,
          minimum: 2,
        },
        createdAtRound: state.round,
        createdByPlayerId: params.playerId,
      });

      return { state: newState, events: [] };
    },

    undo(state: GameState): CommandResult {
      return { state, events: [] };
    },
  };
}
