/**
 * Heal All Units effect handler
 *
 * Handles the EFFECT_HEAL_ALL_UNITS effect which heals all wounded units
 * controlled by the player. No unit selection needed.
 *
 * Used by Banner of Fortitude powered effect.
 *
 * @module effects/healAllUnitsEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { EffectResolutionResult } from "./types.js";
import { UNITS, UNIT_HEALED } from "@mage-knight/shared";
import type { GameEvent } from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { EFFECT_HEAL_ALL_UNITS } from "../../types/effectTypes.js";
import { isCureActive } from "./cureHelpers.js";
import { UNIT_STATE_READY } from "@mage-knight/shared";

/**
 * Handle EFFECT_HEAL_ALL_UNITS.
 * Heals all wounded units controlled by the player.
 * No selection needed — all wounded units are healed automatically.
 */
export function handleHealAllUnits(
  state: GameState,
  playerIndex: number,
  player: Player
): EffectResolutionResult {
  const woundedUnits = player.units.filter((u) => u.wounded);

  if (woundedUnits.length === 0) {
    return {
      state,
      description: "No wounded units to heal",
    };
  }

  const events: GameEvent[] = [];
  const shouldReady = isCureActive(state, player.id);

  const updatedUnits = player.units.map((unit) => {
    if (unit.wounded) {
      const unitDef = UNITS[unit.unitId];
      const unitName = unitDef?.name ?? unit.unitId;
      events.push({
        type: UNIT_HEALED,
        playerId: player.id,
        unitInstanceId: unit.instanceId,
      });

      void unitName; // Used for logging if needed

      return {
        ...unit,
        wounded: false,
        ...(shouldReady && unit.state !== UNIT_STATE_READY
          ? { state: UNIT_STATE_READY as const }
          : {}),
      };
    }
    return unit;
  });

  // Track units as healed this turn (for Cure spell)
  const newlyHealed = woundedUnits
    .map((u) => u.instanceId)
    .filter((id) => !player.unitsHealedThisTurn.includes(id));
  const updatedUnitsHealed = [
    ...player.unitsHealedThisTurn,
    ...newlyHealed,
  ];

  const updatedPlayer: Player = {
    ...player,
    units: updatedUnits,
    unitsHealedThisTurn: updatedUnitsHealed,
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    events,
    description: `Healed all units (${woundedUnits.length})`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register heal all units effect handler with the effect registry.
 */
export function registerHealAllUnitsEffects(): void {
  registerEffect(EFFECT_HEAL_ALL_UNITS, (state, playerId) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleHealAllUnits(state, playerIndex, player);
  });
}
