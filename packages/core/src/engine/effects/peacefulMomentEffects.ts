/**
 * Peaceful Moment effect handlers
 *
 * Handles the "play as action" mode of Peaceful Moment:
 * - EFFECT_PEACEFUL_MOMENT_ACTION: Entry point — grants influence, consumes action, enters conversion loop
 * - EFFECT_PEACEFUL_MOMENT_CONVERT: Conversion loop — presents heal/refresh/done options
 * - EFFECT_PEACEFUL_MOMENT_HEAL: Single heal conversion (2 influence → 1 heal)
 * - EFFECT_PEACEFUL_MOMENT_REFRESH: Unit refresh (2 influence per unit level, max 1 unit)
 *
 * @module effects/peacefulMomentEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  PeacefulMomentActionEffect,
  PeacefulMomentConvertEffect,
  PeacefulMomentHealEffect,
  PeacefulMomentRefreshEffect,
  CardEffect,
  NoopEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { PlayerUnit } from "../../types/unit.js";
import { UNITS, UNIT_STATE_SPENT, UNIT_STATE_READY, CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_PEACEFUL_MOMENT_ACTION,
  EFFECT_PEACEFUL_MOMENT_CONVERT,
  EFFECT_PEACEFUL_MOMENT_HEAL,
  EFFECT_PEACEFUL_MOMENT_REFRESH,
  EFFECT_NOOP,
} from "../../types/effectTypes.js";
import { applyGainHealing } from "./atomicCardEffects.js";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Influence cost per heal point */
const INFLUENCE_PER_HEAL = 2;
/** Influence cost per unit level for refresh */
const INFLUENCE_PER_UNIT_LEVEL = 2;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get spent units eligible for influence-paid refresh.
 */
function getEligibleUnitsForRefresh(
  units: readonly PlayerUnit[],
  influencePoints: number,
): PlayerUnit[] {
  return units.filter((unit) => {
    if (unit.state !== UNIT_STATE_SPENT) return false;
    const unitDef = UNITS[unit.unitId];
    if (!unitDef) return false;
    const cost = unitDef.level * INFLUENCE_PER_UNIT_LEVEL;
    return influencePoints >= cost;
  });
}

/**
 * Check if healing conversion is possible (has influence and wounds in hand).
 */
function canConvertToHeal(player: Player): boolean {
  if (player.influencePoints < INFLUENCE_PER_HEAL) return false;
  return player.hand.some((c) => c === CARD_WOUND);
}

/**
 * Build conversion options based on current state.
 */
function buildConversionOptions(
  player: Player,
  allowUnitRefresh: boolean,
): CardEffect[] {
  const options: CardEffect[] = [];

  // Heal option: 2 influence → 1 heal
  if (canConvertToHeal(player)) {
    const healOption: PeacefulMomentHealEffect = {
      type: EFFECT_PEACEFUL_MOMENT_HEAL,
      allowUnitRefresh,
    };
    options.push(healOption);
  }

  // Unit refresh options (powered only, max 1 unit)
  if (allowUnitRefresh) {
    const eligible = getEligibleUnitsForRefresh(player.units, player.influencePoints);
    for (const unit of eligible) {
      const unitDef = UNITS[unit.unitId];
      const cost = (unitDef?.level ?? 1) * INFLUENCE_PER_UNIT_LEVEL;
      const refreshOption: PeacefulMomentRefreshEffect = {
        type: EFFECT_PEACEFUL_MOMENT_REFRESH,
        unitInstanceId: unit.instanceId,
        unitName: unitDef?.name ?? unit.unitId,
        influenceCost: cost,
        // After refreshing one unit, no more refreshes allowed
        allowUnitRefresh: false,
      };
      options.push(refreshOption);
    }
  }

  // Done option (always available)
  const doneOption: NoopEffect = { type: EFFECT_NOOP };
  options.push(doneOption);

  return options;
}

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * Handle EFFECT_PEACEFUL_MOMENT_ACTION entry point.
 * 1. Grants influence
 * 2. Sets hasTakenActionThisTurn = true
 * 3. Enters conversion loop
 */
function handlePeacefulMomentAction(
  state: GameState,
  playerId: string,
  effect: PeacefulMomentActionEffect,
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  // Grant influence and consume action
  const updatedPlayer: Player = {
    ...player,
    influencePoints: player.influencePoints + effect.influenceAmount,
    hasTakenActionThisTurn: true,
  };

  const stateAfterInfluence = updatePlayer(state, playerIndex, updatedPlayer);

  // Build conversion options
  const options = buildConversionOptions(updatedPlayer, effect.allowUnitRefresh);

  // If only "Done" is available, skip the loop
  if (options.length === 1) {
    return {
      state: stateAfterInfluence,
      description: `Influence ${effect.influenceAmount} (as action, no conversions available)`,
    };
  }

  return {
    state: stateAfterInfluence,
    description: `Influence ${effect.influenceAmount} (as action). Choose conversion:`,
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

/**
 * Handle EFFECT_PEACEFUL_MOMENT_CONVERT loop.
 * Re-presents conversion options based on current state.
 */
function handlePeacefulMomentConvert(
  state: GameState,
  playerId: string,
  effect: PeacefulMomentConvertEffect,
): EffectResolutionResult {
  const { player } = getPlayerContext(state, playerId);

  const options = buildConversionOptions(player, effect.allowUnitRefresh);

  // If only "Done" is available, complete automatically
  if (options.length === 1) {
    return {
      state,
      description: "No more conversions available",
    };
  }

  return {
    state,
    description: "Choose conversion:",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

/**
 * Handle EFFECT_PEACEFUL_MOMENT_HEAL.
 * Deducts 2 influence, heals 1 wound, then chains back to conversion loop.
 */
function handlePeacefulMomentHeal(
  state: GameState,
  playerId: string,
  effect: PeacefulMomentHealEffect,
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  // Deduct influence
  if (player.influencePoints < INFLUENCE_PER_HEAL) {
    return { state, description: "Insufficient influence for healing" };
  }

  const playerAfterDeduct: Player = {
    ...player,
    influencePoints: player.influencePoints - INFLUENCE_PER_HEAL,
  };

  const stateAfterDeduct = updatePlayer(state, playerIndex, playerAfterDeduct);

  // Apply healing (1 wound)
  const healResult = applyGainHealing(
    stateAfterDeduct,
    playerIndex,
    stateAfterDeduct.players[playerIndex]!,
    1,
  );

  // Chain back to conversion loop
  const updatedPlayer = healResult.state.players[playerIndex]!;
  const remainingOptions = buildConversionOptions(updatedPlayer, effect.allowUnitRefresh);

  // If only "Done" remains, complete
  if (remainingOptions.length === 1) {
    return {
      state: healResult.state,
      description: `Healed 1 wound (${INFLUENCE_PER_HEAL} influence)`,
    };
  }

  return {
    state: healResult.state,
    description: `Healed 1 wound (${INFLUENCE_PER_HEAL} influence)`,
    requiresChoice: true,
    dynamicChoiceOptions: remainingOptions,
  };
}

/**
 * Handle EFFECT_PEACEFUL_MOMENT_REFRESH.
 * Deducts influence, readies the unit, then chains back to conversion loop (refresh disabled).
 */
function handlePeacefulMomentRefresh(
  state: GameState,
  playerId: string,
  effect: PeacefulMomentRefreshEffect,
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

  const stateAfterRefresh = updatePlayer(state, playerIndex, updatedPlayer);

  // Chain back to conversion loop with refresh disabled (max 1 unit)
  const remainingOptions = buildConversionOptions(updatedPlayer, false);

  // If only "Done" remains, complete
  if (remainingOptions.length === 1) {
    return {
      state: stateAfterRefresh,
      description: `Refreshed ${effect.unitName} (${effect.influenceCost} influence)`,
    };
  }

  return {
    state: stateAfterRefresh,
    description: `Refreshed ${effect.unitName} (${effect.influenceCost} influence)`,
    requiresChoice: true,
    dynamicChoiceOptions: remainingOptions,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all Peaceful Moment effect handlers with the effect registry.
 */
export function registerPeacefulMomentEffects(): void {
  registerEffect(EFFECT_PEACEFUL_MOMENT_ACTION, (state, playerId, effect) => {
    return handlePeacefulMomentAction(
      state,
      playerId,
      effect as PeacefulMomentActionEffect,
    );
  });

  registerEffect(EFFECT_PEACEFUL_MOMENT_CONVERT, (state, playerId, effect) => {
    return handlePeacefulMomentConvert(
      state,
      playerId,
      effect as PeacefulMomentConvertEffect,
    );
  });

  registerEffect(EFFECT_PEACEFUL_MOMENT_HEAL, (state, playerId, effect) => {
    return handlePeacefulMomentHeal(
      state,
      playerId,
      effect as PeacefulMomentHealEffect,
    );
  });

  registerEffect(EFFECT_PEACEFUL_MOMENT_REFRESH, (state, playerId, effect) => {
    return handlePeacefulMomentRefresh(
      state,
      playerId,
      effect as PeacefulMomentRefreshEffect,
    );
  });
}
