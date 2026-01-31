/**
 * Unit healing effect handlers
 *
 * Handles effects that heal (remove wounds from) player units.
 * Similar to readyUnit but focuses on wound removal.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { PlayerUnit } from "../../types/unit.js";
import type { HealUnitEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { UNITS } from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";

/**
 * Get wounded units that are at or below a given level.
 * Used by HealUnitEffect to find eligible targets.
 */
export function getWoundedUnitsAtOrBelowLevel(
  units: readonly PlayerUnit[],
  maxLevel: 1 | 2 | 3 | 4
): PlayerUnit[] {
  return units.filter((unit) => {
    // Must be wounded
    if (!unit.wounded) return false;
    const unitDef = UNITS[unit.unitId];
    return unitDef && unitDef.level <= maxLevel;
  });
}

/**
 * Handle the EFFECT_HEAL_UNIT entry point.
 * Checks for wounded units and either auto-resolves or requests a choice.
 */
export function handleHealUnit(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: HealUnitEffect
): EffectResolutionResult {
  // Default to level 4 (any unit) if not specified
  const maxLevel = effect.maxLevel ?? 4;

  // Find wounded units at or below the max level
  const eligibleUnits = getWoundedUnitsAtOrBelowLevel(player.units, maxLevel);

  if (eligibleUnits.length === 0) {
    return {
      state,
      description: "No wounded units to heal",
    };
  }

  // If only one eligible unit, auto-resolve
  if (eligibleUnits.length === 1) {
    const targetUnit = eligibleUnits[0];
    if (!targetUnit) {
      throw new Error("Expected single eligible unit");
    }
    return applyHealUnit(state, playerIndex, player, targetUnit.instanceId);
  }

  // Multiple eligible units — player must choose
  return {
    state,
    description: "Choose a unit to heal",
    requiresChoice: true,
  };
}

/**
 * Apply the heal effect to a specific unit.
 * Removes the wound from the unit.
 */
export function applyHealUnit(
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

  // Validate unit is wounded
  if (!unit.wounded) {
    return {
      state,
      description: "Unit is not wounded",
    };
  }

  // Heal the unit: remove wound
  const updatedUnits = [...player.units];
  updatedUnits[unitIndex] = {
    ...unit,
    wounded: false,
  };

  const updatedPlayer: Player = {
    ...player,
    units: updatedUnits,
  };

  const unitDef = UNITS[unit.unitId];
  const unitName = unitDef?.name ?? unit.unitId;

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Healed ${unitName}`,
  };
}
