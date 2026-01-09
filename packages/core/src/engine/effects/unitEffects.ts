/**
 * Unit-related effect handlers
 *
 * Handles effects that target player units:
 * - Ready Unit: transition unit from Spent → Ready state
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { PlayerUnit } from "../../types/unit.js";
import type { ReadyUnitEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./resolveEffect.js";
import { UNITS, UNIT_STATE_READY, UNIT_STATE_SPENT } from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";

/**
 * Get spent units that are at or below a given level.
 * Used by ReadyUnitEffect to find eligible targets.
 *
 * Ready effects target Spent units only (you can't "ready" something already ready).
 * Wound status is irrelevant - a unit can be readied whether wounded or not.
 */
export function getSpentUnitsAtOrBelowLevel(
  units: readonly PlayerUnit[],
  maxLevel: 1 | 2 | 3 | 4
): PlayerUnit[] {
  return units.filter((unit) => {
    // Must be spent (can't ready an already-ready unit)
    if (unit.state !== UNIT_STATE_SPENT) return false;
    const unitDef = UNITS[unit.unitId];
    return unitDef && unitDef.level <= maxLevel;
  });
}

/**
 * Handle the EFFECT_READY_UNIT entry point.
 * Checks for eligible units and either auto-resolves or requests a choice.
 */
export function handleReadyUnit(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: ReadyUnitEffect
): EffectResolutionResult {
  // Find spent units at or below the max level
  const eligibleUnits = getSpentUnitsAtOrBelowLevel(player.units, effect.maxLevel);

  if (eligibleUnits.length === 0) {
    return {
      state,
      description: "No spent units to ready",
    };
  }

  // If only one eligible unit, auto-resolve
  if (eligibleUnits.length === 1) {
    const targetUnit = eligibleUnits[0];
    if (!targetUnit) {
      throw new Error("Expected single eligible unit");
    }
    return applyReadyUnit(state, playerIndex, player, targetUnit.instanceId);
  }

  // Multiple eligible units — player must choose
  // This will be handled via pendingChoice similar to other choice effects
  return {
    state,
    description: "Choose a unit to ready",
    requiresChoice: true,
  };
}

/**
 * Apply the ready effect to a specific unit.
 * Transitions the unit from Spent → Ready state.
 * Wound status is unchanged (if wounded, stays wounded).
 */
export function applyReadyUnit(
  state: GameState,
  playerIndex: number,
  player: Player,
  unitInstanceId: string
): EffectResolutionResult {
  const unitIndex = player.units.findIndex((u) => u.instanceId === unitInstanceId);
  if (unitIndex === -1) {
    return {
      state,
      description: `Unit not found: ${unitInstanceId}`,
    };
  }

  const unit = player.units[unitIndex];
  if (!unit) {
    return {
      state,
      description: `Unit not found: ${unitInstanceId}`,
    };
  }

  // Validate unit is spent
  if (unit.state !== UNIT_STATE_SPENT) {
    return {
      state,
      description: "Unit is already ready",
    };
  }

  // Ready the unit: Spent → Ready
  // Wound status is unchanged (if wounded, stays wounded)
  const updatedUnits = [...player.units];
  updatedUnits[unitIndex] = {
    ...unit,
    state: UNIT_STATE_READY,
  };

  const updatedPlayer: Player = {
    ...player,
    units: updatedUnits,
  };

  const unitDef = UNITS[unit.unitId];
  const unitName = unitDef?.name ?? unit.unitId;

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Readied ${unitName}`,
  };
}
