/**
 * Move command - handles player movement with undo support
 *
 * When moving to a fortified site (Keep, Mage Tower, City):
 * - Combat is automatically triggered (assault)
 * - -1 reputation penalty is applied
 * - Movement ends for the turn
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { HexCoord, GameEvent } from "@mage-knight/shared";
import {
  createMoveUndoneEvent,
  createPlayerMovedEvent,
  createCombatTriggeredEvent,
  createReputationChangedEvent,
  hexKey,
  COMBAT_TRIGGER_FORTIFIED_ASSAULT,
  REPUTATION_REASON_ASSAULT,
} from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import { MOVE_COMMAND } from "./commandTypes.js";
import { SITE_PROPERTIES } from "../../data/siteProperties.js";
import { createCombatState } from "../../types/combat.js";
import { getEnemyIdFromToken } from "../helpers/enemyHelpers.js";
import { SiteType } from "../../types/map.js";

export { MOVE_COMMAND };

export interface MoveCommandParams {
  readonly playerId: string;
  readonly from: HexCoord;
  readonly to: HexCoord;
  readonly terrainCost: number;
  readonly hadMovedThisTurn: boolean; // capture state before this move for proper undo
}

/**
 * Create a move command.
 *
 * The terrainCost and hadMovedThisTurn are passed in because they were captured
 * at creation time. This ensures undo restores the exact previous state.
 */
export function createMoveCommand(params: MoveCommandParams): Command {
  return {
    type: MOVE_COMMAND,
    playerId: params.playerId,
    isReversible: true, // movement is reversible unless it triggers a reveal

    execute(state: GameState): CommandResult {
      // Find player and update position
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      const events: GameEvent[] = [
        createPlayerMovedEvent(params.playerId, params.from, params.to),
      ];

      // Check destination hex for fortified site
      const destinationKey = hexKey(params.to);
      const destinationHex = state.map.hexes[destinationKey];

      let updatedPlayer: Player = {
        ...player,
        position: params.to,
        movePoints: player.movePoints - params.terrainCost,
        hasMovedThisTurn: true,
      };

      let updatedState: GameState = state;

      // Check if moving to a fortified site triggers assault
      if (destinationHex?.site) {
        const site = destinationHex.site;
        const props = SITE_PROPERTIES[site.type];

        // Unconquered fortified sites (keeps, mage towers, cities)
        const isUnconqueredFortified = props.fortified && !site.isConquered;

        // Opponent-owned keeps also trigger assault
        const isOpponentKeep =
          site.type === SiteType.Keep &&
          site.isConquered &&
          site.owner !== params.playerId;

        if (isUnconqueredFortified || isOpponentKeep) {
          // Assault! Apply -1 reputation penalty
          const newReputation = player.reputation - 1;

          events.push(
            createReputationChangedEvent(
              params.playerId,
              -1,
              newReputation,
              REPUTATION_REASON_ASSAULT
            )
          );

          // Get enemies at hex - for opponent keeps with no garrison, draw would happen
          // TODO: Draw random gray enemy as garrison for opponent keeps (half fame)
          const enemyIds = destinationHex.enemies;

          // Emit combat triggered event
          events.push(
            createCombatTriggeredEvent(
              params.playerId,
              COMBAT_TRIGGER_FORTIFIED_ASSAULT,
              params.to,
              enemyIds
            )
          );

          // Update player with reputation change and mark combat started
          updatedPlayer = {
            ...updatedPlayer,
            reputation: newReputation,
            hasCombattedThisTurn: true,
          };

          // Create combat state with assault origin (where player was before assault)
          const combatState = createCombatState(
            enemyIds.map((tokenId) => getEnemyIdFromToken(tokenId)),
            true, // isAtFortifiedSite
            { assaultOrigin: params.from }
          );

          updatedState = { ...updatedState, combat: combatState };
        }
      }

      const updatedPlayers: Player[] = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      return {
        state: { ...updatedState, players: updatedPlayers },
        events,
      };
    },

    undo(state: GameState): CommandResult {
      // Find player and restore position
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }
      const updatedPlayer: Player = {
        ...player,
        position: params.from,
        movePoints: player.movePoints + params.terrainCost,
        hasMovedThisTurn: params.hadMovedThisTurn,
      };

      const updatedPlayers: Player[] = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      return {
        state: { ...state, players: updatedPlayers },
        events: [
          createMoveUndoneEvent(params.playerId, params.to, params.from), // reversed
        ],
      };
    },
  };
}
