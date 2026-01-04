/**
 * Recruit unit command
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { UnitId, GameEvent } from "@mage-knight/shared";
import { UNIT_RECRUITED } from "@mage-knight/shared";
import { createPlayerUnit } from "../../../types/unit.js";

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

      // Create new unit instance
      const newUnit = createPlayerUnit(params.unitId, instanceId);

      const updatedPlayer = {
        ...player,
        units: [...player.units, newUnit],
      };

      const players = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

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
        state: { ...state, players },
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

      // Remove the last recruited unit (matching by instanceId for safety)
      const updatedUnits = player.units.filter(
        (u) => u.instanceId !== instanceId
      );

      const updatedPlayer = {
        ...player,
        units: updatedUnits,
      };

      const players = state.players.map((p, i) =>
        i === playerIndex ? updatedPlayer : p
      );

      return {
        state: { ...state, players },
        events: [],
      };
    },
  };
}
