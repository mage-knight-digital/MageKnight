/**
 * Challenge rampaging command - initiates combat with adjacent rampaging enemies.
 *
 * This command allows a player to voluntarily challenge rampaging enemies
 * on an adjacent hex without moving to that hex.
 *
 * Per Mage Knight rules:
 * - Player must be adjacent to the rampaging enemies
 * - The hex must have rampagingEnemies[] populated (not just any enemies)
 * - Combat is NOT fortified (player is not at a fortified site)
 * - Only one combat per turn is allowed
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { HexCoord, GameEvent } from "@mage-knight/shared";
import {
  hexKey,
  createCombatTriggeredEvent,
  COMBAT_TRIGGER_CHALLENGE,
} from "@mage-knight/shared";
import type { Player } from "../../../types/player.js";
import { CHALLENGE_RAMPAGING_COMMAND } from "../commandTypes.js";
import { getEnemyIdFromToken } from "../../helpers/enemyHelpers.js";
import { createEnterCombatCommand } from "./enterCombatCommand.js";

export { CHALLENGE_RAMPAGING_COMMAND };

export interface ChallengeRampagingCommandParams {
  readonly playerId: string;
  readonly targetHex: HexCoord;
}

/**
 * Create a challenge rampaging command.
 *
 * When executed, this command:
 * 1. Emits a COMBAT_TRIGGERED event with COMBAT_TRIGGER_CHALLENGE
 * 2. Creates a combat state with the enemies from the target hex
 * 3. Sets hasCombattedThisTurn on the player
 */
export function createChallengeRampagingCommand(
  params: ChallengeRampagingCommandParams
): Command {
  // Store original combat state for undo
  let savedHasCombattedThisTurn = false;

  return {
    type: CHALLENGE_RAMPAGING_COMMAND,
    playerId: params.playerId,
    // Challenging is reversible - no hidden information revealed
    isReversible: true,

    execute(state: GameState): CommandResult {
      // Find player
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

      // Save for undo
      savedHasCombattedThisTurn = player.hasCombattedThisTurn;

      // Get target hex
      const hex = state.map.hexes[hexKey(params.targetHex)];
      if (!hex) {
        throw new Error(`Target hex not found: ${hexKey(params.targetHex)}`);
      }

      // Get enemies from the target hex
      const hexEnemies = hex.enemies;
      const enemyTokenIds = hexEnemies.map((e) => e.tokenId);
      const enemyIds = hexEnemies.map((e) => getEnemyIdFromToken(e.tokenId));

      const events: GameEvent[] = [];

      // Emit combat triggered event
      events.push(
        createCombatTriggeredEvent(
          params.playerId,
          COMBAT_TRIGGER_CHALLENGE,
          params.targetHex,
          enemyTokenIds
        )
      );

      // Update player state
      const updatedPlayer: Player = {
        ...player,
        hasCombattedThisTurn: true,
        // Clear healing points on combat entry (per rulebook line 929)
        healingPoints: 0,
      };

      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      // Use the enter combat command to generate the COMBAT_STARTED event
      // Pass the target hex as combatHexCoord so enemies are cleared from the correct location
      const innerCommand = createEnterCombatCommand({
        playerId: params.playerId,
        enemyIds,
        isAtFortifiedSite: false,
        combatHexCoord: params.targetHex,
      });
      const innerResult = innerCommand.execute({
        ...state,
        players: updatedPlayers,
      });

      return {
        state: innerResult.state,
        events: [...events, ...innerResult.events],
      };
    },

    undo(state: GameState): CommandResult {
      // Find player
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

      // Restore player state
      const restoredPlayer: Player = {
        ...player,
        hasCombattedThisTurn: savedHasCombattedThisTurn,
      };

      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = restoredPlayer;

      // Exit combat
      return {
        state: {
          ...state,
          combat: null,
          players: updatedPlayers,
        },
        events: [], // Events for undo are handled by the command stack
      };
    },
  };
}
