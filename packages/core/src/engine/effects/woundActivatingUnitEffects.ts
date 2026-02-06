/**
 * Wound Activating Unit Effect
 *
 * Handles the EFFECT_WOUND_ACTIVATING_UNIT effect, which wounds the unit
 * that activated the ability containing this effect.
 *
 * This is a self-inflicted wound (cost of using the ability), NOT combat damage:
 * - Does NOT trigger Paralyze, Vampiric, or Poison enemy abilities
 * - The unit simply has its wounded flag set to true
 *
 * Used by Utem Swordsmen's Attack/Block 6 ability.
 *
 * @module effects/woundActivatingUnitEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { WoundActivatingUnitEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { EFFECT_WOUND_ACTIVATING_UNIT } from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { getUnit } from "@mage-knight/shared";

/**
 * Apply the wound activating unit effect.
 * Finds the unit by instance ID and sets its wounded flag to true.
 */
export function applyWoundActivatingUnit(
  state: GameState,
  playerId: string,
  unitInstanceId: string
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  const unitIndex = player.units.findIndex(
    (u) => u.instanceId === unitInstanceId
  );

  if (unitIndex === -1) {
    return {
      state,
      description: `Unit not found: ${unitInstanceId}`,
    };
  }

  const unit = player.units[unitIndex]!;
  const unitDef = getUnit(unit.unitId);

  const updatedUnits = [...player.units];
  updatedUnits[unitIndex] = {
    ...unit,
    wounded: true,
  };

  const updatedPlayer = {
    ...player,
    units: updatedUnits,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return {
    state: { ...state, players },
    description: `${unitDef.name} wounded (self-inflicted)`,
  };
}

/**
 * Register the wound activating unit effect handler.
 */
export function registerWoundActivatingUnitEffects(): void {
  registerEffect(
    EFFECT_WOUND_ACTIVATING_UNIT,
    (state, playerId, effect) => {
      const woundEffect = effect as WoundActivatingUnitEffect;
      return applyWoundActivatingUnit(state, playerId, woundEffect.unitInstanceId);
    }
  );
}
