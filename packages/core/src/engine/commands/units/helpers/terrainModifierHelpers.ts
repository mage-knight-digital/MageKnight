/**
 * Terrain modifier helpers for unit ability activation
 *
 * Handles applying terrain cost modifiers from unit abilities
 * (e.g., Foresters reducing forest movement cost).
 */

import type { UnitTerrainModifier } from "@mage-knight/shared";
import type { GameState } from "../../../../state/GameState.js";
import { addModifier } from "../../../modifiers.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  SCOPE_SELF,
  SOURCE_UNIT,
} from "../../../../types/modifierConstants.js";

/**
 * Apply terrain cost modifiers from a unit ability.
 * Returns the updated state with modifiers added.
 */
export function applyTerrainModifiers(
  state: GameState,
  playerId: string,
  unitIndex: number,
  terrainModifiers: readonly UnitTerrainModifier[]
): GameState {
  let currentState = state;

  for (const terrainMod of terrainModifiers) {
    currentState = addModifier(currentState, {
      source: {
        type: SOURCE_UNIT,
        unitIndex,
        playerId,
      },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_TERRAIN_COST,
        terrain: terrainMod.terrain,
        amount: terrainMod.amount,
        minimum: terrainMod.minimum,
      },
      createdAtRound: state.round,
      createdByPlayerId: playerId,
    });
  }

  return currentState;
}
