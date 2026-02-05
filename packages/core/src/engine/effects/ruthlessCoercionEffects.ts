/**
 * Ruthless Coercion effect handlers
 *
 * Handles Krang's Ruthless Coercion card effects:
 * - EFFECT_APPLY_RECRUIT_DISCOUNT: Grants a turn-scoped recruit discount modifier
 * - EFFECT_READY_UNITS_FOR_INFLUENCE: Ready L1/L2 units by paying influence
 * - EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE: Apply ready + deduct influence for one unit
 *
 * @module effects/ruthlessCoercionEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  RecruitDiscountEffect,
  ReadyUnitsForInfluenceEffect,
  ResolveReadyUnitForInfluenceEffect,
  CardEffect,
  NoopEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { UNITS, UNIT_STATE_READY, UNIT_STATE_SPENT, type CardId } from "@mage-knight/shared";
import type { PlayerUnit } from "../../types/unit.js";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { addModifier } from "../modifiers/lifecycle.js";
import {
  EFFECT_APPLY_RECRUIT_DISCOUNT,
  EFFECT_READY_UNITS_FOR_INFLUENCE,
  EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
  EFFECT_NOOP,
} from "../../types/effectTypes.js";
import {
  EFFECT_RECRUIT_DISCOUNT,
  DURATION_TURN,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import type { RecruitDiscountModifier } from "../../types/modifiers.js";

// ============================================================================
// RECRUIT DISCOUNT (Basic Effect)
// ============================================================================

/**
 * Handle EFFECT_APPLY_RECRUIT_DISCOUNT - adds a turn-scoped modifier that grants
 * a recruitment cost discount. The modifier tracks the discount amount and
 * the reputation change that occurs if the discount is used.
 */
function handleRecruitDiscount(
  state: GameState,
  playerId: string,
  effect: RecruitDiscountEffect,
): EffectResolutionResult {
  const newState = addModifier(state, {
    source: { type: SOURCE_CARD, cardId: "krang_ruthless_coercion" as CardId, playerId },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_RECRUIT_DISCOUNT,
      discount: effect.discount,
      reputationChange: effect.reputationChange,
    } satisfies RecruitDiscountModifier,
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return {
    state: newState,
    description: `Recruit discount of ${effect.discount} available (Reputation ${effect.reputationChange} if used)`,
  };
}

// ============================================================================
// READY UNITS FOR INFLUENCE (Powered Effect)
// ============================================================================

/**
 * Get spent units eligible for influence-paid readying.
 */
function getEligibleUnitsForInfluenceReady(
  units: readonly PlayerUnit[],
  maxLevel: 1 | 2 | 3 | 4,
  influencePoints: number,
  costPerLevel: number,
): PlayerUnit[] {
  return units.filter((unit) => {
    if (unit.state !== UNIT_STATE_SPENT) return false;
    const unitDef = UNITS[unit.unitId];
    if (!unitDef || unitDef.level > maxLevel) return false;
    const cost = unitDef.level * costPerLevel;
    return influencePoints >= cost;
  });
}

/**
 * Handle EFFECT_READY_UNITS_FOR_INFLUENCE entry point.
 * Finds eligible spent units and generates choice options including a "Done" option.
 */
function handleReadyUnitsForInfluence(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: ReadyUnitsForInfluenceEffect,
): EffectResolutionResult {
  const eligible = getEligibleUnitsForInfluenceReady(
    player.units,
    effect.maxLevel,
    player.influencePoints,
    effect.costPerLevel,
  );

  if (eligible.length === 0) {
    return {
      state,
      description: "No spent units to ready (or insufficient influence)",
    };
  }

  // Generate choice options: one per eligible unit + "Done" option
  const unitOptions: ResolveReadyUnitForInfluenceEffect[] = eligible.map((unit) => {
    const unitDef = UNITS[unit.unitId];
    const cost = (unitDef?.level ?? 1) * effect.costPerLevel;
    return {
      type: EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
      unitInstanceId: unit.instanceId,
      unitName: unitDef?.name ?? unit.unitId,
      influenceCost: cost,
      maxLevel: effect.maxLevel,
      costPerLevel: effect.costPerLevel,
    };
  });

  const doneOption: NoopEffect = { type: EFFECT_NOOP };

  return {
    state,
    description: "Select a unit to ready (costs influence) or Done",
    requiresChoice: true,
    dynamicChoiceOptions: [...unitOptions, doneOption] as CardEffect[],
  };
}

/**
 * Handle EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE - deducts influence,
 * readies the selected unit, then chains back to present remaining options.
 */
function handleResolveReadyUnitForInfluence(
  state: GameState,
  playerId: string,
  effect: ResolveReadyUnitForInfluenceEffect,
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

  // Deduct influence
  if (player.influencePoints < effect.influenceCost) {
    return { state, description: "Insufficient influence" };
  }

  // Ready the unit and deduct influence
  const updatedUnits = [...player.units];
  updatedUnits[unitIndex] = { ...unit, state: UNIT_STATE_READY };

  const updatedPlayer: Player = {
    ...player,
    units: updatedUnits,
    influencePoints: player.influencePoints - effect.influenceCost,
  };

  const stateAfterReady = updatePlayer(state, playerIndex, updatedPlayer);

  // Chain back to present remaining eligible units
  const remainingEligible = getEligibleUnitsForInfluenceReady(
    updatedPlayer.units,
    effect.maxLevel,
    updatedPlayer.influencePoints,
    effect.costPerLevel,
  );

  if (remainingEligible.length === 0) {
    return {
      state: stateAfterReady,
      description: `Readied ${effect.unitName} for ${effect.influenceCost} influence`,
    };
  }

  // Generate new choice options for remaining units
  const unitOptions: ResolveReadyUnitForInfluenceEffect[] = remainingEligible.map((u) => {
    const unitDef = UNITS[u.unitId];
    const cost = (unitDef?.level ?? 1) * effect.costPerLevel;
    return {
      type: EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
      unitInstanceId: u.instanceId,
      unitName: unitDef?.name ?? u.unitId,
      influenceCost: cost,
      maxLevel: effect.maxLevel,
      costPerLevel: effect.costPerLevel,
    };
  });

  const doneOption: NoopEffect = { type: EFFECT_NOOP };

  return {
    state: stateAfterReady,
    description: `Readied ${effect.unitName} for ${effect.influenceCost} influence`,
    requiresChoice: true,
    dynamicChoiceOptions: [...unitOptions, doneOption] as CardEffect[],
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all Ruthless Coercion effect handlers with the effect registry.
 */
export function registerRuthlessCoercionEffects(): void {
  registerEffect(EFFECT_APPLY_RECRUIT_DISCOUNT, (state, playerId, effect) => {
    return handleRecruitDiscount(state, playerId, effect as RecruitDiscountEffect);
  });

  registerEffect(EFFECT_READY_UNITS_FOR_INFLUENCE, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleReadyUnitsForInfluence(
      state,
      playerIndex,
      player,
      effect as ReadyUnitsForInfluenceEffect,
    );
  });

  registerEffect(EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE, (state, playerId, effect) => {
    return handleResolveReadyUnitForInfluence(
      state,
      playerId,
      effect as ResolveReadyUnitForInfluenceEffect,
    );
  });
}
