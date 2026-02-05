/**
 * Commands for terrain cost reduction actions (Druidic Paths and similar effects)
 *
 * These commands handle the player selecting which hex or terrain type should have
 * its movement cost reduced for the turn.
 */

import type { GameState } from "../../types/gameState.js";
import type { Command } from "../../types/command.js";
import type {
  ResolveHexCostReductionAction,
  ResolveTerrainCostReductionAction,
} from "@mage-knight/shared";
import { addModifier } from "../modifiers/index.js";
import { DURATION_TURN, SOURCE_CARD } from "../../types/modifierConstants.js";
import { CARD_BRAEVALAR_DRUIDIC_PATHS } from "@mage-knight/shared";

/**
 * Command: Resolve hex coordinate selection for cost reduction.
 * Applies a modifier that reduces the terrain cost for the specified coordinate.
 */
export function resolveHexCostReductionCommand(
  action: ResolveHexCostReductionAction
): Command {
  return {
    execute: (state: GameState): GameState => {
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return state;

      // Apply terrain cost modifier for specific coordinate
      // The modifier will have specificCoordinate set, which getEffectiveTerrainCost checks
      let newState = addModifier(state, {
        type: "terrain_cost",
        source: { type: SOURCE_CARD, cardId: CARD_BRAEVALAR_DRUIDIC_PATHS, playerId: action.playerId },
        duration: DURATION_TURN,
        scope: { type: "self" },
        effect: {
          type: "terrain_cost",
          terrain: "all", // Applies to any terrain at this specific coordinate
          amount: -1, // -1 cost reduction
          minimum: 2, // Minimum cost of 2
          specificCoordinate: action.coordinate, // Key: specific coordinate modifier
        },
        createdAtRound: state.round,
        createdByPlayerId: action.playerId,
      } as any);

      return newState;
    },
    undo: (state: GameState): GameState => {
      // Modifiers from non-reversible actions like RESOLVE_HEX_COST_REDUCTION are not undone
      // Only the command that led to the pending state can be undone (e.g., playing the card)
      return state;
    },
    isReversible: false,
  };
}

/**
 * Command: Resolve terrain type selection for cost reduction.
 * Applies a modifier that reduces the terrain cost for the specified terrain type.
 */
export function resolveTerrainCostReductionCommand(
  action: ResolveTerrainCostReductionAction
): Command {
  return {
    execute: (state: GameState): GameState => {
      const player = state.players.find((p) => p.id === action.playerId);
      if (!player) return state;

      // Apply terrain cost modifier for specific terrain type
      let newState = addModifier(state, {
        type: "terrain_cost",
        source: { type: SOURCE_CARD, cardId: CARD_BRAEVALAR_DRUIDIC_PATHS, playerId: action.playerId },
        duration: DURATION_TURN,
        scope: { type: "self" },
        effect: {
          type: "terrain_cost",
          terrain: action.terrain, // Applies to all hexes of this terrain type
          amount: -1, // -1 cost reduction
          minimum: 2, // Minimum cost of 2
        },
        createdAtRound: state.round,
        createdByPlayerId: action.playerId,
      } as any);

      return newState;
    },
    undo: (state: GameState): GameState => {
      return state;
    },
    isReversible: false,
  };
}
