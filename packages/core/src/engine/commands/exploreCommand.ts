/**
 * Explore command - reveals a new tile on the map
 *
 * This is an irreversible command - you can't unsee a tile!
 * When executed, it clears the command stack and sets a checkpoint.
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { HexCoord, HexDirection } from "@mage-knight/shared";
import { hexKey, createTileExploredEvent } from "@mage-knight/shared";
import type { TileId, HexState, TilePlacement } from "../../types/map.js";
import type { Player } from "../../types/player.js";
import { placeTile } from "../../data/tiles.js";
import { calculateTilePlacement } from "../explore/index.js";
import { EXPLORE_COMMAND } from "./commandTypes.js";
import { drawEnemiesForHex } from "../helpers/enemyHelpers.js";

export { EXPLORE_COMMAND };

export interface ExploreCommandParams {
  readonly playerId: string;
  readonly fromHex: HexCoord;
  readonly direction: HexDirection;
  readonly tileId: TileId; // Predetermined - drawn before command created
}

/**
 * Create an explore command.
 *
 * The tileId is passed in because it was drawn before the command was created.
 * This ensures deterministic execution and proper undo tracking.
 */
export function createExploreCommand(params: ExploreCommandParams): Command {
  return {
    type: EXPLORE_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Can't unsee a tile!

    execute(state: GameState): CommandResult {
      const { tileId, direction, fromHex } = params;

      // Calculate placement position
      const tilePosition = calculateTilePlacement(fromHex, direction);
      const rotation = 0; // SIMPLE: Always rotation 0 for now

      // Place the tile - get all hexes with world coordinates
      const newHexes = placeTile(tileId, tilePosition);

      // Draw enemies for each hex and add to map
      let currentPiles = state.enemyTokens;
      let currentRng = state.rng;
      const updatedHexes = { ...state.map.hexes };

      for (const hex of newHexes) {
        const key = hexKey(hex.coord);

        // Draw enemies for rampaging types and site defenders
        // Pass timeOfDay for sites like Ancient Ruins (night-only enemies)
        const { enemies, piles, rng } = drawEnemiesForHex(
          hex.rampagingEnemies,
          hex.site?.type ?? null,
          currentPiles,
          currentRng,
          state.timeOfDay
        );

        currentPiles = piles;
        currentRng = rng;

        // Update hex with drawn enemies
        updatedHexes[key] = {
          ...hex,
          enemies,
        };
      }

      // Add tile placement record
      const tilePlacement: TilePlacement = {
        tileId,
        centerCoord: tilePosition,
        revealed: true,
      };

      const updatedTiles = [...state.map.tiles, tilePlacement];

      // Remove tile from appropriate deck
      const isCountrysideTile = state.map.tileDeck.countryside.includes(tileId);
      const updatedTileDeck = {
        countryside: isCountrysideTile
          ? state.map.tileDeck.countryside.filter((id) => id !== tileId)
          : state.map.tileDeck.countryside,
        core: !isCountrysideTile
          ? state.map.tileDeck.core.filter((id) => id !== tileId)
          : state.map.tileDeck.core,
      };

      // Deduct explore cost (2 move points from safe space)
      // FUTURE: Cost varies if exploring from dangerous space
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const updatedPlayer: Player = {
        ...player,
        movePoints: player.movePoints - 2,
      };
      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      const newState: GameState = {
        ...state,
        players: updatedPlayers,
        map: {
          ...state.map,
          hexes: updatedHexes,
          tiles: updatedTiles,
          tileDeck: updatedTileDeck,
        },
        enemyTokens: currentPiles,
        rng: currentRng,
      };

      return {
        state: newState,
        events: [
          createTileExploredEvent(
            params.playerId,
            tileId,
            tilePosition,
            rotation,
            newHexes.map((h: HexState) => h.coord)
          ),
        ],
      };
    },

    undo(_state: GameState): CommandResult {
      // This should never be called - explore is irreversible
      throw new Error("Cannot undo EXPLORE - tile has been revealed");
    },
  };
}
