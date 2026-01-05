/**
 * Explore command - reveals a new tile on the map
 *
 * This is an irreversible command - you can't unsee a tile!
 * When executed, it clears the command stack and sets a checkpoint.
 *
 * Scenario hooks:
 * - Awards fame per tile explored (configurable per scenario)
 * - Triggers scenario end when city tile is revealed (for First Reconnaissance)
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { HexCoord, HexDirection, GameEvent } from "@mage-knight/shared";
import {
  hexKey,
  createTileExploredEvent,
  FAME_GAINED,
  SCENARIO_END_TRIGGERED,
  END_TRIGGER_CITY_REVEALED,
  FAME_SOURCE_TILE_EXPLORED,
} from "@mage-knight/shared";
import type { TileId, HexState, TilePlacement } from "../../types/map.js";
import type { Player } from "../../types/player.js";
import { placeTile, TILE_DEFINITIONS } from "../../data/tiles.js";
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

      // Mark the tile slot as filled (for wedge map tracking)
      const slotKey = hexKey(tilePosition);
      const updatedTileSlots = { ...state.map.tileSlots };
      if (updatedTileSlots[slotKey]) {
        updatedTileSlots[slotKey] = {
          ...updatedTileSlots[slotKey],
          filled: true,
        };
      }

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

      // Award fame for exploring (configurable per scenario)
      const famePerTile = state.scenarioConfig.famePerTileExplored;
      const newFame = player.fame + famePerTile;

      const updatedPlayer: Player = {
        ...player,
        movePoints: player.movePoints - 2,
        fame: newFame,
      };
      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      // Check if this tile has a city (for scenario end trigger)
      const tileDefinition = TILE_DEFINITIONS[tileId];
      const isCityTile = tileDefinition?.hasCity ?? false;

      // Check if scenario end should be triggered
      const shouldTriggerScenarioEnd =
        !state.scenarioEndTriggered &&
        state.scenarioConfig.endTrigger.type === END_TRIGGER_CITY_REVEALED &&
        isCityTile;

      // Calculate final turns remaining when scenario ends
      // Each player (including the one who triggered) gets one final turn
      const finalTurnsRemaining = shouldTriggerScenarioEnd
        ? state.players.length
        : state.finalTurnsRemaining;

      const newState: GameState = {
        ...state,
        players: updatedPlayers,
        map: {
          ...state.map,
          hexes: updatedHexes,
          tiles: updatedTiles,
          tileDeck: updatedTileDeck,
          tileSlots: updatedTileSlots,
        },
        enemyTokens: currentPiles,
        rng: currentRng,
        scenarioEndTriggered: shouldTriggerScenarioEnd || state.scenarioEndTriggered,
        finalTurnsRemaining,
      };

      // Build events array
      const events: GameEvent[] = [
        createTileExploredEvent(
          params.playerId,
          tileId,
          tilePosition,
          rotation,
          newHexes.map((h: HexState) => h.coord)
        ),
      ];

      // Add fame event if fame was awarded
      if (famePerTile > 0) {
        events.push({
          type: FAME_GAINED,
          playerId: params.playerId,
          amount: famePerTile,
          newTotal: newFame,
          source: FAME_SOURCE_TILE_EXPLORED,
        });
      }

      // Add scenario end trigger event
      if (shouldTriggerScenarioEnd) {
        events.push({
          type: SCENARIO_END_TRIGGERED,
          playerId: params.playerId,
          trigger: END_TRIGGER_CITY_REVEALED,
        });
      }

      return {
        state: newState,
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      // This should never be called - explore is irreversible
      throw new Error("Cannot undo EXPLORE - tile has been revealed");
    },
  };
}
