/**
 * Spend Move on Cumbersome Command
 *
 * Allows player to spend accumulated move points during the BLOCK phase
 * to reduce a Cumbersome enemy's attack value. Each move point spent
 * reduces the attack by 1 for the rest of the turn (persists through
 * Assign Damage phase).
 *
 * IMPORTANT: This reduction applies BEFORE Swift doubling and BEFORE Brutal doubling.
 * REVERSIBLE: Can be undone until DECLARE_BLOCK commits the block.
 *
 * @module engine/commands/combat/spendMoveOnCumbersomeCommand
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import { MOVE_SPENT_ON_CUMBERSOME } from "@mage-knight/shared";
import { isCumbersomeActive } from "../../combat/cumbersomeHelpers.js";

export const SPEND_MOVE_ON_CUMBERSOME_COMMAND = "SPEND_MOVE_ON_CUMBERSOME" as const;

export interface SpendMoveOnCumbersomeCommandParams {
  readonly playerId: string;
  readonly enemyInstanceId: string;
  readonly movePointsToSpend: number;
}

export function createSpendMoveOnCumbersomeCommand(
  params: SpendMoveOnCumbersomeCommandParams
): Command {
  // Capture state for undo
  let previousMovePoints = 0;
  let previousReduction = 0;

  return {
    type: SPEND_MOVE_ON_CUMBERSOME_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Can undo until block is committed

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      const player = state.players.find((p) => p.id === params.playerId);
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }
      const playerIndex = state.players.indexOf(player);

      const enemy = state.combat.enemies.find(
        (e) => e.instanceId === params.enemyInstanceId
      );
      if (!enemy) {
        throw new Error(`Enemy not found: ${params.enemyInstanceId}`);
      }

      // Verify Cumbersome is active
      if (!isCumbersomeActive(state, params.playerId, enemy)) {
        throw new Error("Enemy does not have active Cumbersome ability");
      }

      // Verify player has enough move points
      if (player.movePoints < params.movePointsToSpend) {
        throw new Error(
          `Insufficient move points (has ${player.movePoints}, needs ${params.movePointsToSpend})`
        );
      }

      // Validate positive amount
      if (params.movePointsToSpend <= 0) {
        throw new Error("Must spend at least 1 move point");
      }

      // Capture for undo
      previousMovePoints = player.movePoints;
      previousReduction = state.combat.cumbersomeReductions[params.enemyInstanceId] ?? 0;

      // Deduct move points from player
      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? { ...p, movePoints: p.movePoints - params.movePointsToSpend }
          : p
      );

      // Add to cumbersome reductions
      const updatedReductions = {
        ...state.combat.cumbersomeReductions,
        [params.enemyInstanceId]: previousReduction + params.movePointsToSpend,
      };

      const updatedCombat = {
        ...state.combat,
        cumbersomeReductions: updatedReductions,
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [
          {
            type: MOVE_SPENT_ON_CUMBERSOME,
            enemyInstanceId: params.enemyInstanceId,
            movePointsSpent: params.movePointsToSpend,
            totalReduction: previousReduction + params.movePointsToSpend,
          },
        ],
      };
    },

    undo(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat (undo)");
      }

      const playerIndex = state.players.findIndex((p) => p.id === params.playerId);
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      // Restore player's move points
      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex ? { ...p, movePoints: previousMovePoints } : p
      );

      // Restore previous reduction (or remove entry if was 0)
      let updatedReductions: { readonly [enemyInstanceId: string]: number };
      if (previousReduction === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [params.enemyInstanceId]: _removed, ...remaining } =
          state.combat.cumbersomeReductions;
        updatedReductions = remaining;
      } else {
        updatedReductions = {
          ...state.combat.cumbersomeReductions,
          [params.enemyInstanceId]: previousReduction,
        };
      }

      const updatedCombat = {
        ...state.combat,
        cumbersomeReductions: updatedReductions,
      };

      return {
        state: { ...state, players: updatedPlayers, combat: updatedCombat },
        events: [],
      };
    },
  };
}
