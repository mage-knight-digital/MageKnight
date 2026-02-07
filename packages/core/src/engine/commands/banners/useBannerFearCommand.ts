/**
 * Use Banner of Fear Command
 *
 * During the Block phase, spend a unit with Banner of Fear attached
 * to cancel one enemy attack. Grants Fame +1.
 *
 * Cancel != Block: Elusive armor still applies (higher value used).
 * Cannot use against Arcane Immune enemies.
 * Cannot use if unit is wounded.
 * Tied to unit ready state (if re-readied, can use again).
 *
 * @module commands/banners/useBannerFearCommand
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { PlayerUnit } from "../../../types/unit.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  BANNER_FEAR_CANCEL_ATTACK,
  UNIT_STATE_SPENT,
} from "@mage-knight/shared";
import type { CombatEnemy } from "../../../types/combat.js";
import { getEnemyAttackCount } from "../../combat/enemyAttackHelpers.js";

export const USE_BANNER_FEAR_COMMAND = "USE_BANNER_FEAR" as const;

export interface UseBannerFearParams {
  readonly playerId: string;
  readonly unitInstanceId: string;
  readonly targetEnemyInstanceId: string;
  readonly attackIndex: number;
}

export function createUseBannerFearCommand(params: UseBannerFearParams): Command {
  // Capture previous state for undo
  let previousUnits: readonly PlayerUnit[];
  let previousEnemies: readonly CombatEnemy[];
  let previousFame: number;
  let previousFameGained: number;

  return {
    type: USE_BANNER_FEAR_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const player = state.players[playerIndex];
      if (!player) throw new Error(`Player not found: ${params.playerId}`);
      if (!state.combat) throw new Error("Not in combat");

      // Capture for undo
      previousUnits = player.units;
      previousEnemies = state.combat.enemies;
      previousFame = player.fame;
      previousFameGained = state.combat.fameGained;

      // Spend the unit
      const updatedUnits = player.units.map((u) =>
        u.instanceId === params.unitInstanceId
          ? { ...u, state: UNIT_STATE_SPENT as typeof UNIT_STATE_SPENT }
          : u
      );

      // Cancel the specific attack on the enemy
      const updatedEnemies = state.combat.enemies.map((e) => {
        if (e.instanceId !== params.targetEnemyInstanceId) return e;

        const attackCount = getEnemyAttackCount(e);
        // Initialize or update attacksCancelled array
        const currentCancelled = e.attacksCancelled ?? new Array(attackCount).fill(false);
        const updatedCancelled = currentCancelled.map((cancelled, i) =>
          i === params.attackIndex ? true : cancelled
        );

        return { ...e, attacksCancelled: updatedCancelled };
      });

      // Grant Fame +1
      const newFame = player.fame + 1;

      const updatedPlayer = {
        ...player,
        units: updatedUnits,
        fame: newFame,
      };

      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      const events: GameEvent[] = [
        {
          type: BANNER_FEAR_CANCEL_ATTACK,
          playerId: params.playerId,
          unitInstanceId: params.unitInstanceId,
          enemyInstanceId: params.targetEnemyInstanceId,
          attackIndex: params.attackIndex,
          fameGained: 1,
        },
      ];

      return {
        state: {
          ...state,
          players: updatedPlayers,
          combat: {
            ...state.combat,
            enemies: updatedEnemies,
          },
        },
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const player = state.players[playerIndex];
      if (!player) throw new Error(`Player not found: ${params.playerId}`);
      if (!state.combat) throw new Error("Not in combat");

      const updatedPlayer = {
        ...player,
        units: previousUnits,
        fame: previousFame,
      };

      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      return {
        state: {
          ...state,
          players: updatedPlayers,
          combat: {
            ...state.combat,
            enemies: previousEnemies,
            fameGained: previousFameGained,
          },
        },
        events: [],
      };
    },
  };
}
