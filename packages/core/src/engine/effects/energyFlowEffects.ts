/**
 * Energy Flow / Energy Steal effect handlers
 *
 * Handles the Energy Flow spell which:
 * - Basic: Ready a unit. If you do, you may spend one unit of level ≤2
 *   in each other player's unit area.
 * - Powered: Ready a unit and heal it. If you do, you may spend one unit
 *   of level ≤3 in each other player's unit area.
 *
 * In single-player mode, the "spend opponent units" part is a no-op
 * since there are no other players.
 *
 * @module effects/energyFlowEffects
 *
 * @remarks Resolution Flow
 * ```
 * EFFECT_ENERGY_FLOW (healReadiedUnit, spendMaxLevel)
 *   └─► Find eligible spent units (any level)
 *       └─► Generate EFFECT_RESOLVE_ENERGY_FLOW_TARGET options
 *           └─► Player selects a unit
 *               └─► EFFECT_RESOLVE_ENERGY_FLOW_TARGET
 *                   └─► Ready unit (+ heal if powered)
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  EnergyFlowEffect,
  ResolveEnergyFlowTargetEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { UNITS, UNIT_STATE_READY, UNIT_STATE_SPENT } from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_ENERGY_FLOW,
  EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
} from "../../types/effectTypes.js";
import { getSpentUnitsAtOrBelowLevel } from "./unitEffects.js";

// ============================================================================
// ENERGY FLOW ENTRY POINT
// ============================================================================

/**
 * Handle the EFFECT_ENERGY_FLOW entry point.
 * Finds eligible spent units and either auto-resolves or generates choice options.
 */
export function handleEnergyFlow(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: EnergyFlowEffect
): EffectResolutionResult {
  // Ready any unit (max level 4 = any unit)
  const maxLevel = 4 as const;
  const eligibleUnits = getSpentUnitsAtOrBelowLevel(player.units, maxLevel);

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
    return applyEnergyFlowToUnit(
      state,
      playerIndex,
      player,
      targetUnit.instanceId,
      effect.healReadiedUnit
    );
  }

  // Multiple eligible units — generate choice options
  const choiceOptions: ResolveEnergyFlowTargetEffect[] = eligibleUnits.map(
    (unit) => {
      const unitDef = UNITS[unit.unitId];
      return {
        type: EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
        unitInstanceId: unit.instanceId,
        unitName: unitDef?.name ?? unit.unitId,
        healReadiedUnit: effect.healReadiedUnit,
      };
    }
  );

  return {
    state,
    description: effect.healReadiedUnit
      ? "Select a unit to ready and heal"
      : "Select a unit to ready",
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// RESOLVE ENERGY FLOW TARGET
// ============================================================================

/**
 * Resolve the selected unit target — readies (and optionally heals) it.
 */
export function resolveEnergyFlowTarget(
  state: GameState,
  playerId: string,
  effect: ResolveEnergyFlowTargetEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);
  return applyEnergyFlowToUnit(
    state,
    playerIndex,
    player,
    effect.unitInstanceId,
    effect.healReadiedUnit
  );
}

/**
 * Apply Energy Flow to a specific unit: ready it and optionally heal it.
 */
export function applyEnergyFlowToUnit(
  state: GameState,
  playerIndex: number,
  player: Player,
  unitInstanceId: string,
  healUnit: boolean
): EffectResolutionResult {
  const unitIndex = player.units.findIndex(
    (u) => u.instanceId === unitInstanceId
  );
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

  if (unit.state !== UNIT_STATE_SPENT) {
    return {
      state,
      description: "Unit is already ready",
    };
  }

  // Ready the unit, and heal if powered
  const updatedUnits = [...player.units];
  updatedUnits[unitIndex] = {
    ...unit,
    state: UNIT_STATE_READY,
    wounded: healUnit ? false : unit.wounded,
  };

  const updatedPlayer: Player = {
    ...player,
    units: updatedUnits,
  };

  const unitDef = UNITS[unit.unitId];
  const unitName = unitDef?.name ?? unit.unitId;

  const parts: string[] = [`Readied ${unitName}`];
  if (healUnit && unit.wounded) {
    parts.push(`and healed ${unitName}`);
  }

  // Note: Spending opponent units in multiplayer is not yet implemented.
  // The "spend one unit of level X or less in each other player's unit area"
  // mechanic requires the multiplayer unit targeting system (see issue dependencies).

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: parts.join(" "),
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Energy Flow effect handlers with the effect registry.
 */
export function registerEnergyFlowEffects(): void {
  registerEffect(EFFECT_ENERGY_FLOW, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleEnergyFlow(
      state,
      playerIndex,
      player,
      effect as EnergyFlowEffect
    );
  });

  registerEffect(
    EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
    (state, playerId, effect) => {
      return resolveEnergyFlowTarget(
        state,
        playerId,
        effect as ResolveEnergyFlowTargetEffect
      );
    }
  );
}
