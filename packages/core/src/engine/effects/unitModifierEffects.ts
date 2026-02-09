/**
 * Unit Modifier Effect Handlers
 *
 * Handles effects that select a unit and apply modifiers to it:
 * - EFFECT_SELECT_UNIT_FOR_MODIFIER: Entry point, finds eligible units
 * - EFFECT_RESOLVE_UNIT_MODIFIER_TARGET: Applies modifier to selected unit
 *
 * Used by Force of Nature (grant Physical Resistance to a chosen unit).
 *
 * @module effects/unitModifierEffects
 *
 * @remarks Resolution Flow
 * ```
 * EFFECT_SELECT_UNIT_FOR_MODIFIER
 *   └─► Find eligible units (player's units)
 *       └─► Generate EFFECT_RESOLVE_UNIT_MODIFIER_TARGET options
 *           └─► Player selects a unit
 *               └─► EFFECT_RESOLVE_UNIT_MODIFIER_TARGET
 *                   └─► Apply modifier with SCOPE_ONE_UNIT
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type {
  SelectUnitForModifierEffect,
  ResolveUnitModifierTargetEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { CardId } from "@mage-knight/shared";
import { UNITS } from "@mage-knight/shared";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { addModifier } from "../modifiers/index.js";
import {
  SCOPE_ONE_UNIT,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import {
  EFFECT_SELECT_UNIT_FOR_MODIFIER,
  EFFECT_RESOLVE_UNIT_MODIFIER_TARGET,
} from "../../types/effectTypes.js";

// ============================================================================
// SELECT UNIT FOR MODIFIER (Entry Point)
// ============================================================================

/**
 * Handle the EFFECT_SELECT_UNIT_FOR_MODIFIER entry point.
 * Finds eligible units and generates choice options.
 */
function handleSelectUnitForModifier(
  state: GameState,
  playerId: string,
  effect: SelectUnitForModifierEffect
): EffectResolutionResult {
  const { player } = getPlayerContext(state, playerId);

  // All units are eligible targets (wounded or not, spent or ready)
  const eligibleUnits = player.units;

  if (eligibleUnits.length === 0) {
    return {
      state,
      description: "No units to target",
    };
  }

  // If only one eligible unit, auto-resolve
  if (eligibleUnits.length === 1) {
    const targetUnit = eligibleUnits[0];
    if (!targetUnit) {
      throw new Error("Expected single eligible unit");
    }
    return resolveUnitModifierTarget(state, playerId, {
      type: EFFECT_RESOLVE_UNIT_MODIFIER_TARGET,
      unitInstanceId: targetUnit.instanceId,
      unitName: UNITS[targetUnit.unitId]?.name ?? targetUnit.unitId,
      modifier: effect.modifier,
      duration: effect.duration,
      description: effect.description,
    });
  }

  // Multiple eligible units — generate choice options
  const choiceOptions: ResolveUnitModifierTargetEffect[] = eligibleUnits.map(
    (unit) => {
      const unitDef = UNITS[unit.unitId];
      return {
        type: EFFECT_RESOLVE_UNIT_MODIFIER_TARGET,
        unitInstanceId: unit.instanceId,
        unitName: unitDef?.name ?? unit.unitId,
        modifier: effect.modifier,
        duration: effect.duration,
        description: effect.description,
      };
    }
  );

  return {
    state,
    description: "Select a unit to target",
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// RESOLVE UNIT MODIFIER TARGET
// ============================================================================

/**
 * Resolve the selected unit target — applies the modifier with SCOPE_ONE_UNIT.
 */
function resolveUnitModifierTarget(
  state: GameState,
  playerId: string,
  effect: ResolveUnitModifierTargetEffect,
  sourceCardId?: string
): EffectResolutionResult {
  const { player } = getPlayerContext(state, playerId);

  const unitIndex = player.units.findIndex(
    (u) => u.instanceId === effect.unitInstanceId
  );

  if (unitIndex === -1) {
    return {
      state,
      description: `Unit not found: ${effect.unitInstanceId}`,
    };
  }

  const newState = addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: (sourceCardId ?? "unknown") as CardId,
      playerId,
    },
    duration: effect.duration,
    scope: { type: SCOPE_ONE_UNIT, unitIndex },
    effect: effect.modifier,
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  const unitName = effect.unitName;
  const description =
    effect.description ?? `Applied modifier to ${unitName}`;

  return {
    state: newState,
    description: description.replace("Chosen unit", unitName),
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register unit modifier effect handlers with the effect registry.
 * Called during effect system initialization.
 */
export function registerUnitModifierEffects(): void {
  registerEffect(
    EFFECT_SELECT_UNIT_FOR_MODIFIER,
    (state, playerId, effect) => {
      return handleSelectUnitForModifier(
        state,
        playerId,
        effect as SelectUnitForModifierEffect
      );
    }
  );

  registerEffect(
    EFFECT_RESOLVE_UNIT_MODIFIER_TARGET,
    (state, playerId, effect, sourceCardId) => {
      return resolveUnitModifierTarget(
        state,
        playerId,
        effect as ResolveUnitModifierTargetEffect,
        sourceCardId
      );
    }
  );
}
