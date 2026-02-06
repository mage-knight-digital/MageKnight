/**
 * Ready Units Budget effect handlers
 *
 * Handles the Restoration/Rebirth spell's unit readying effect:
 * - EFFECT_READY_UNITS_BUDGET: Entry point for readying spent units up to a total level budget
 * - EFFECT_RESOLVE_READY_UNIT_BUDGET: Apply ready to one unit and chain with remaining budget
 *
 * @module effects/readyUnitsBudgetEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  ReadyUnitsBudgetEffect,
  ResolveReadyUnitBudgetEffect,
  CardEffect,
  NoopEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { UNITS, UNIT_STATE_READY, UNIT_STATE_SPENT } from "@mage-knight/shared";
import type { PlayerUnit } from "../../types/unit.js";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_READY_UNITS_BUDGET,
  EFFECT_RESOLVE_READY_UNIT_BUDGET,
  EFFECT_NOOP,
} from "../../types/effectTypes.js";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get spent units whose level fits within the remaining budget.
 */
function getEligibleUnitsForBudget(
  units: readonly PlayerUnit[],
  remainingBudget: number,
): PlayerUnit[] {
  return units.filter((unit) => {
    if (unit.state !== UNIT_STATE_SPENT) return false;
    const unitDef = UNITS[unit.unitId];
    if (!unitDef) return false;
    return unitDef.level <= remainingBudget;
  });
}

// ============================================================================
// READY UNITS BUDGET (Entry Point)
// ============================================================================

/**
 * Handle EFFECT_READY_UNITS_BUDGET entry point.
 * Finds eligible spent units and generates choice options including a "Done" option.
 */
function handleReadyUnitsBudget(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: ReadyUnitsBudgetEffect,
): EffectResolutionResult {
  const eligible = getEligibleUnitsForBudget(player.units, effect.totalLevels);

  if (eligible.length === 0) {
    return {
      state,
      description: "No spent units to ready",
    };
  }

  // Generate choice options: one per eligible unit + "Done" option
  const unitOptions: ResolveReadyUnitBudgetEffect[] = eligible.map((unit) => {
    const unitDef = UNITS[unit.unitId];
    const level = unitDef?.level ?? 1;
    return {
      type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
      unitInstanceId: unit.instanceId,
      unitName: unitDef?.name ?? unit.unitId,
      unitLevel: level,
      remainingBudget: effect.totalLevels - level,
    };
  });

  const doneOption: NoopEffect = { type: EFFECT_NOOP };

  return {
    state,
    description: `Select units to ready (${effect.totalLevels} levels available)`,
    requiresChoice: true,
    dynamicChoiceOptions: [...unitOptions, doneOption] as CardEffect[],
  };
}

// ============================================================================
// RESOLVE READY UNIT BUDGET TARGET
// ============================================================================

/**
 * Handle EFFECT_RESOLVE_READY_UNIT_BUDGET - readies the selected unit,
 * then chains back to present remaining options with updated budget.
 */
function handleResolveReadyUnitBudget(
  state: GameState,
  playerId: string,
  effect: ResolveReadyUnitBudgetEffect,
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  // Find the unit
  const unitIndex = player.units.findIndex((u) => u.instanceId === effect.unitInstanceId);
  if (unitIndex === -1) {
    return { state, description: `Unit not found: ${effect.unitInstanceId}` };
  }

  const unit = player.units[unitIndex];
  if (!unit || unit.state !== UNIT_STATE_SPENT) {
    return { state, description: "Unit is not spent" };
  }

  // Ready the unit
  const updatedUnits = [...player.units];
  updatedUnits[unitIndex] = { ...unit, state: UNIT_STATE_READY };

  const updatedPlayer: Player = {
    ...player,
    units: updatedUnits,
  };

  const stateAfterReady = updatePlayer(state, playerIndex, updatedPlayer);

  // Check if we can ready more units with the remaining budget
  if (effect.remainingBudget > 0) {
    const remainingEligible = getEligibleUnitsForBudget(
      updatedPlayer.units,
      effect.remainingBudget,
    );

    if (remainingEligible.length > 0) {
      // Generate new choice options for remaining units
      const unitOptions: ResolveReadyUnitBudgetEffect[] = remainingEligible.map((u) => {
        const unitDef = UNITS[u.unitId];
        const level = unitDef?.level ?? 1;
        return {
          type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
          unitInstanceId: u.instanceId,
          unitName: unitDef?.name ?? u.unitId,
          unitLevel: level,
          remainingBudget: effect.remainingBudget - level,
        };
      });

      const doneOption: NoopEffect = { type: EFFECT_NOOP };

      return {
        state: stateAfterReady,
        description: `Readied ${effect.unitName}`,
        requiresChoice: true,
        dynamicChoiceOptions: [...unitOptions, doneOption] as CardEffect[],
      };
    }
  }

  return {
    state: stateAfterReady,
    description: `Readied ${effect.unitName}`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all ready units budget effect handlers with the effect registry.
 */
export function registerReadyUnitsBudgetEffects(): void {
  registerEffect(EFFECT_READY_UNITS_BUDGET, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleReadyUnitsBudget(
      state,
      playerIndex,
      player,
      effect as ReadyUnitsBudgetEffect,
    );
  });

  registerEffect(EFFECT_RESOLVE_READY_UNIT_BUDGET, (state, playerId, effect) => {
    return handleResolveReadyUnitBudget(
      state,
      playerId,
      effect as ResolveReadyUnitBudgetEffect,
    );
  });
}
