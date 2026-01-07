/**
 * Recruit unit command
 *
 * Handles recruiting a unit from the offer:
 * - Deducts influence points from the player
 * - Removes the unit from the offer (does NOT replenish until next round)
 * - Adds the unit to the player's units
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { UnitId, GameEvent } from "@mage-knight/shared";
import { UNIT_RECRUITED } from "@mage-knight/shared";
import { createPlayerUnit } from "../../../types/unit.js";
import { removeUnitFromOffer } from "../../../data/unitDeckSetup.js";

export const RECRUIT_UNIT_COMMAND = "RECRUIT_UNIT" as const;

export interface RecruitUnitCommandParams {
  readonly playerId: string;
  readonly unitId: UnitId;
  readonly influenceSpent: number;
}

let unitInstanceCounter = 0;

/**
 * Reset the instance counter (for testing)
 */
export function resetUnitInstanceCounter(): void {
  unitInstanceCounter = 0;
}

export function createRecruitUnitCommand(
  params: RecruitUnitCommandParams
): Command {
  // Capture the instance ID at creation time for undo support
  const instanceId = `unit_${++unitInstanceCounter}`;

  // Store previous offer for undo
  let previousOffer: readonly UnitId[] = [];
  let previousInfluence = 0;

  return {
    type: RECRUIT_UNIT_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Store previous state for undo
      previousOffer = state.offers.units;
      previousInfluence = player.influencePoints;

      // Create new unit instance
      const newUnit = createPlayerUnit(params.unitId, instanceId);

      // Update player: add unit, deduct influence
      const updatedPlayer = {
        ...player,
        units: [...player.units, newUnit],
        influencePoints: player.influencePoints - params.influenceSpent,
      };

      const players = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      // Remove unit from offer (does NOT replenish until next round)
      const updatedOffer = removeUnitFromOffer(params.unitId, state.offers.units);
      const updatedOffers = {
        ...state.offers,
        units: updatedOffer,
      };

      const events: GameEvent[] = [
        {
          type: UNIT_RECRUITED,
          playerId: params.playerId,
          unitId: params.unitId,
          unitInstanceId: instanceId,
          influenceSpent: params.influenceSpent,
        },
      ];

      return {
        state: { ...state, players, offers: updatedOffers },
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Remove the recruited unit (matching by instanceId for safety)
      const updatedUnits = player.units.filter(
        (u) => u.instanceId !== instanceId
      );

      // Restore previous influence
      const updatedPlayer = {
        ...player,
        units: updatedUnits,
        influencePoints: previousInfluence,
      };

      const players = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      // Restore previous offer
      const updatedOffers = {
        ...state.offers,
        units: previousOffer,
      };

      return {
        state: { ...state, players, offers: updatedOffers },
        events: [],
      };
    },
  };
}
