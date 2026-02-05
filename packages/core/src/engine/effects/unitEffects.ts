/**
 * Unit-related effect handlers
 *
 * Handles effects that target player units:
 * - Ready Unit: transition unit from Spent → Ready state
 *
 * @module effects/unitEffects
 *
 * @remarks Ready Unit Resolution Flow
 * - EFFECT_READY_UNIT: Entry point, finds eligible spent units
 * - EFFECT_RESOLVE_READY_UNIT_TARGET: Applies ready to the selected unit
 *
 * @example Resolution Flow
 * ```
 * EFFECT_READY_UNIT (maxLevel: 2)
 *   └─► Find eligible spent units at level 1-2
 *       └─► Generate EFFECT_RESOLVE_READY_UNIT_TARGET options
 *           └─► Player selects a unit
 *               └─► EFFECT_RESOLVE_READY_UNIT_TARGET
 *                   └─► Transition unit from Spent → Ready
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { PlayerUnit } from "../../types/unit.js";
import type { ReadyUnitEffect, ResolveReadyUnitTargetEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { UNITS, UNIT_STATE_READY, UNIT_STATE_SPENT } from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { EFFECT_READY_UNIT, EFFECT_RESOLVE_READY_UNIT_TARGET } from "../../types/effectTypes.js";

// ============================================================================
// SELECT READY UNIT (Entry Point)
// ============================================================================

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
 * Finds eligible units and either auto-resolves or generates choice options.
 *
 * @param state - Current game state
 * @param playerIndex - Index of the player in the players array
 * @param player - The player object
 * @param effect - The ready unit effect with maxLevel
 * @returns Choice options for unit selection, or auto-resolved result
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

  // Multiple eligible units — generate choice options
  // Each option is a RESOLVE_READY_UNIT_TARGET effect for a specific unit
  const choiceOptions: ResolveReadyUnitTargetEffect[] = eligibleUnits.map((unit) => {
    const unitDef = UNITS[unit.unitId];
    return {
      type: EFFECT_RESOLVE_READY_UNIT_TARGET,
      unitInstanceId: unit.instanceId,
      unitName: unitDef?.name ?? unit.unitId,
    };
  });

  return {
    state,
    description: "Select a unit to ready",
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// RESOLVE READY UNIT TARGET
// ============================================================================

/**
 * Resolves the selected unit target - applies the ready effect.
 *
 * @param state - Current game state
 * @param playerId - ID of the player resolving the effect
 * @param effect - The resolve ready unit target effect with unitInstanceId
 * @returns Updated state with unit readied
 */
export function resolveReadyUnitTarget(
  state: GameState,
  playerId: string,
  effect: ResolveReadyUnitTargetEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);
  return applyReadyUnit(state, playerIndex, player, effect.unitInstanceId);
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

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all unit effect handlers with the effect registry.
 * Called during effect system initialization.
 */
export function registerUnitEffects(): void {
  registerEffect(EFFECT_READY_UNIT, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleReadyUnit(state, playerIndex, player, effect as ReadyUnitEffect);
  });

  registerEffect(EFFECT_RESOLVE_READY_UNIT_TARGET, (state, playerId, effect) => {
    return resolveReadyUnitTarget(state, playerId, effect as ResolveReadyUnitTargetEffect);
  });
}
