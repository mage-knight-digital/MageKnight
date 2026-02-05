/**
 * Enter combat command
 */

import type { Command, CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { EnemyId, HexCoord } from "@mage-knight/shared";
import { COMBAT_EXIT_REASON_UNDO, COMBAT_STARTED, createCombatExitedEvent } from "@mage-knight/shared";
import { createCombatState } from "../../../types/combat.js";

export const ENTER_COMBAT_COMMAND = "ENTER_COMBAT" as const;

export interface EnterCombatCommandParams {
  readonly playerId: string;
  readonly enemyIds: readonly EnemyId[];
  readonly isAtFortifiedSite?: boolean; // Optional: site provides fortification
  readonly combatHexCoord?: HexCoord; // Optional: hex where combat occurs (for remote combat like rampaging challenge)
}

export function createEnterCombatCommand(
  params: EnterCombatCommandParams
): Command {
  // Store healing points for undo - per rulebook line 929:
  // "Any unspent Healing points disappear when entering combat."
  let savedHealingPoints = 0;

  return {
    type: ENTER_COMBAT_COMMAND,
    playerId: params.playerId,
    // Entering combat is reversible - enemies were already visible on the map.
    // Checkpoints happen when new info is revealed (summoner draws, dice rolls, etc.)
    isReversible: true,

    execute(state: GameState): CommandResult {
      const combat = createCombatState(
        params.enemyIds,
        params.isAtFortifiedSite ?? false,
        { combatHexCoord: params.combatHexCoord ?? null }
      );

      // Find the player and clear their healing points
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const player = state.players[playerIndex];

      // Save for undo
      savedHealingPoints = player?.healingPoints ?? 0;

      // Update player with cleared healing points
      const updatedPlayers =
        player && savedHealingPoints > 0
          ? state.players.map((p, i) =>
              i === playerIndex ? { ...p, healingPoints: 0 } : p
            )
          : state.players;

      return {
        state: { ...state, combat, players: updatedPlayers },
        events: [
          {
            type: COMBAT_STARTED,
            playerId: params.playerId,
            enemies: combat.enemies.map((e) => ({
              instanceId: e.instanceId,
              name: e.definition.name,
              attack: e.definition.attack,
              armor: e.definition.armor,
            })),
          },
        ],
      };
    },

    undo(state: GameState): CommandResult {
      // Restore healing points
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const player = state.players[playerIndex];

      const updatedPlayers =
        player && savedHealingPoints > 0
          ? state.players.map((p, i) =>
              i === playerIndex ? { ...p, healingPoints: savedHealingPoints } : p
            )
          : state.players;

      // Exit combat and restore healing points
      return {
        state: { ...state, combat: null, players: updatedPlayers },
        events: [createCombatExitedEvent(params.playerId, COMBAT_EXIT_REASON_UNDO)],
      };
    },
  };
}
