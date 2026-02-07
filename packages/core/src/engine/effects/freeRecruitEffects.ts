/**
 * Free Recruitment Effect Handlers
 *
 * Handles effects that recruit units from the offer for free:
 * - EFFECT_FREE_RECRUIT: Entry point, presents available units
 * - EFFECT_RESOLVE_FREE_RECRUIT_TARGET: Executes the free recruitment
 *
 * Used by Banner of Command powered effect and Call to Glory spell.
 * No location restrictions — works anywhere, even in combat.
 *
 * @module effects/freeRecruitEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { ResolveFreeRecruitTargetEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { UnitId } from "@mage-knight/shared";
import { UNITS } from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import {
  EFFECT_FREE_RECRUIT,
  EFFECT_RESOLVE_FREE_RECRUIT_TARGET,
} from "../../types/effectTypes.js";
import { createPlayerUnit } from "../../types/unit.js";
import { removeUnitFromOffer } from "../../data/unitDeckSetup.js";

// Instance counter for free-recruited units (separate from normal recruit)
let freeRecruitInstanceCounter = 0;

/**
 * Reset the instance counter (for testing)
 */
export function resetFreeRecruitInstanceCounter(): void {
  freeRecruitInstanceCounter = 0;
}

// ============================================================================
// FREE RECRUIT ENTRY POINT
// ============================================================================

/**
 * Handle the EFFECT_FREE_RECRUIT entry point.
 * Finds available units in the offer and generates choice options.
 *
 * No location restrictions — this works anywhere.
 * Command limit is NOT checked here; the player must have already
 * disbanded a unit if at the limit before playing the powered effect.
 */
export function handleFreeRecruit(
  state: GameState,
  playerIndex: number,
  player: Player
): EffectResolutionResult {
  const availableUnits = state.offers.units;

  if (availableUnits.length === 0) {
    return {
      state,
      description: "No units available in the offer",
    };
  }

  // Check command limit: player must have a free command slot
  if (player.units.length >= player.commandTokens) {
    return {
      state,
      description: "At command limit — must disband a unit first",
    };
  }

  // If only one unit available, auto-resolve
  if (availableUnits.length === 1) {
    const unitId = availableUnits[0]!;
    return applyFreeRecruit(state, playerIndex, player, unitId);
  }

  // Multiple units — generate choice options
  const choiceOptions: ResolveFreeRecruitTargetEffect[] = availableUnits.map(
    (unitId) => {
      const unitDef = UNITS[unitId];
      return {
        type: EFFECT_RESOLVE_FREE_RECRUIT_TARGET,
        unitId,
        unitName: unitDef?.name ?? unitId,
      };
    }
  );

  return {
    state,
    description: "Select a unit to recruit for free",
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// RESOLVE FREE RECRUIT TARGET
// ============================================================================

/**
 * Resolves the selected unit target — recruits the unit for free.
 */
export function resolveFreeRecruitTarget(
  state: GameState,
  playerId: string,
  effect: ResolveFreeRecruitTargetEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);
  return applyFreeRecruit(state, playerIndex, player, effect.unitId);
}

/**
 * Apply the free recruitment — add unit to player, remove from offer.
 * No influence cost, no reputation changes, no special rules bypass needed
 * (free recruitment inherently skips all cost calculations).
 */
export function applyFreeRecruit(
  state: GameState,
  playerIndex: number,
  player: Player,
  unitId: UnitId
): EffectResolutionResult {
  // Verify unit is in the offer
  if (!state.offers.units.includes(unitId)) {
    return {
      state,
      description: `Unit ${unitId} is not in the offer`,
    };
  }

  // Create new unit instance
  const instanceId = `free_unit_${++freeRecruitInstanceCounter}`;
  const newUnit = createPlayerUnit(unitId, instanceId);

  // Update player: add unit, mark action taken and recruited
  const updatedPlayer: Player = {
    ...player,
    units: [...player.units, newUnit],
    hasTakenActionThisTurn: true,
    hasRecruitedUnitThisTurn: true,
    unitsRecruitedThisInteraction: [
      ...player.unitsRecruitedThisInteraction,
      unitId,
    ],
  };

  // Remove unit from offer
  const updatedOffer = removeUnitFromOffer(unitId, state.offers.units);
  const updatedOffers = {
    ...state.offers,
    units: updatedOffer,
  };

  const updatedState: GameState = {
    ...updatePlayer(state, playerIndex, updatedPlayer),
    offers: updatedOffers,
  };

  const unitDef = UNITS[unitId];
  const unitName = unitDef?.name ?? unitId;

  return {
    state: updatedState,
    description: `Recruited ${unitName} for free`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register free recruit effect handlers with the effect registry.
 */
export function registerFreeRecruitEffects(): void {
  registerEffect(EFFECT_FREE_RECRUIT, (state, playerId) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleFreeRecruit(state, playerIndex, player);
  });

  registerEffect(EFFECT_RESOLVE_FREE_RECRUIT_TARGET, (state, playerId, effect) => {
    return resolveFreeRecruitTarget(
      state,
      playerId,
      effect as ResolveFreeRecruitTargetEffect
    );
  });
}
