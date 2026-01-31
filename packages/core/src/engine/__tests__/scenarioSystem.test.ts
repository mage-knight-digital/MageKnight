/**
 * Scenario system tests
 *
 * Tests scenario infrastructure including:
 * - First Reconnaissance setup
 * - City revealed end trigger
 * - Fame on tile explore
 * - City entry restriction
 * - Final turns countdown and game end
 */

import { describe, it, expect } from "vitest";
import { createInitialGameState, type GameState } from "../../state/GameState.js";
import { createExploreCommand } from "../commands/exploreCommand.js";
import { createEndTurnCommand } from "../commands/endTurn/index.js";
import { createEndRoundCommand } from "../commands/endRound/index.js";
import { validateAction } from "../validators/index.js";
import { TileId, SiteType } from "../../types/map.js";
import type { Player } from "../../types/player.js";
import {
  SCENARIO_FIRST_RECONNAISSANCE,
  SCENARIO_FULL_CONQUEST,
  END_TRIGGER_CITY_REVEALED,
  FAME_GAINED,
  SCENARIO_END_TRIGGERED,
  GAME_ENDED,
  ROUND_ENDED,
  MOVE_ACTION,
  GAME_PHASE_ROUND,
  hexKey,
  type CardId,
} from "@mage-knight/shared";
import { CANNOT_ENTER_CITY } from "../validators/validationCodes.js";
import { FIRST_RECONNAISSANCE } from "../../data/scenarios/firstReconnaissance.js";
import { TILE_DEFINITIONS } from "../../data/tiles/index.js";
import { CITY_COLOR_GREEN } from "../../types/mapConstants.js";

// Import the shared test helper
import { createTestPlayer as createBaseTestPlayer } from "./testHelpers.js";

// Helper to create a test player with id override
function createTestPlayer(id: string, overrides: Partial<Player> = {}): Player {
  return createBaseTestPlayer({ id, movePoints: 4, hand: [], ...overrides });
}

// Helper to set up a game state with countryside tile deck
function createGameStateWithTileDeck(scenarioId = SCENARIO_FIRST_RECONNAISSANCE): GameState {
  const state = createInitialGameState(12345, scenarioId);
  const player = createTestPlayer("player1", {
    position: { q: 1, r: -1 },
    // Cards in hand to avoid MUST_ANNOUNCE_END_OF_ROUND
    hand: ["card1" as CardId, "card2" as CardId],
  });

  return {
    ...state,
    phase: GAME_PHASE_ROUND, // Set to round phase for movement actions
    players: [player],
    turnOrder: ["player1"],
    currentPlayerIndex: 0,
    map: {
      ...state.map,
      tileDeck: {
        countryside: [TileId.Countryside1, TileId.Countryside2],
        core: [TileId.Core5GreenCity], // City tile
      },
      hexes: {
        "0,0": {
          coord: { q: 0, r: 0 },
          terrain: "plains",
          tileId: TileId.StartingTileA,
          site: { type: SiteType.Portal, owner: null, isConquered: false, isBurned: false },
          rampagingEnemies: [],
          enemies: [],
          shieldTokens: [],
        },
        "1,-1": {
          coord: { q: 1, r: -1 },
          terrain: "forest",
          tileId: TileId.StartingTileA,
          site: null,
          rampagingEnemies: [],
          enemies: [],
          shieldTokens: [],
        },
      },
    },
  };
}

describe("Scenario System", () => {
  describe("First Reconnaissance setup", () => {
    it("should create game with correct scenario config", () => {
      const state = createInitialGameState(12345, SCENARIO_FIRST_RECONNAISSANCE);

      expect(state.scenarioId).toBe(SCENARIO_FIRST_RECONNAISSANCE);
      expect(state.scenarioConfig.id).toBe(SCENARIO_FIRST_RECONNAISSANCE);
      expect(state.scenarioConfig.name).toBe("First Reconnaissance (Solo)");
      expect(state.scenarioConfig.skillsEnabled).toBe(false);
      expect(state.scenarioConfig.citiesCanBeEntered).toBe(false);
      expect(state.scenarioConfig.famePerTileExplored).toBe(1);
      expect(state.scenarioEndTriggered).toBe(false);
      expect(state.finalTurnsRemaining).toBeNull();
      expect(state.gameEnded).toBe(false);
    });

    it("should have correct end trigger for First Reconnaissance", () => {
      expect(FIRST_RECONNAISSANCE.endTrigger.type).toBe(END_TRIGGER_CITY_REVEALED);
    });

    it("should default to First Reconnaissance scenario", () => {
      const state = createInitialGameState();
      expect(state.scenarioId).toBe(SCENARIO_FIRST_RECONNAISSANCE);
    });
  });

  describe("Fame on tile explore", () => {
    it("should award +1 fame when exploring tile in First Reconnaissance", () => {
      const state = createGameStateWithTileDeck();
      const player = state.players[0];
      expect(player).toBeDefined();
      expect(player?.fame).toBe(0);
      expect(player?.position).toBeDefined();

      const exploreCommand = createExploreCommand({
        playerId: "player1",
        fromHex: player?.position ?? { q: 0, r: 0 },
        direction: "E",
        tileId: TileId.Countryside1,
      });

      const result = exploreCommand.execute(state);

      // Find updated player
      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer).toBeDefined();
      expect(updatedPlayer?.fame).toBe(1);

      // Check for fame gained event
      const fameEvent = result.events.find(e => e.type === FAME_GAINED);
      expect(fameEvent).toBeDefined();
      if (fameEvent?.type === FAME_GAINED) {
        expect(fameEvent.amount).toBe(1);
        expect(fameEvent.source).toBe("tile_explored");
      }
    });

    it("should not award fame in Full Conquest (famePerTileExplored = 0)", () => {
      const state = createGameStateWithTileDeck(SCENARIO_FULL_CONQUEST);
      const player = state.players[0];
      expect(player).toBeDefined();
      expect(player?.fame).toBe(0);
      expect(player?.position).toBeDefined();

      const exploreCommand = createExploreCommand({
        playerId: "player1",
        fromHex: player?.position ?? { q: 0, r: 0 },
        direction: "E",
        tileId: TileId.Countryside1,
      });

      const result = exploreCommand.execute(state);

      // Fame should not change
      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer).toBeDefined();
      expect(updatedPlayer?.fame).toBe(0);

      // No fame event
      const fameEvent = result.events.find(e => e.type === FAME_GAINED);
      expect(fameEvent).toBeUndefined();
    });
  });

  describe("City revealed end trigger", () => {
    it("should trigger scenario end when city tile is revealed", () => {
      const state = createGameStateWithTileDeck();

      // Explore a city tile
      const exploreCommand = createExploreCommand({
        playerId: "player1",
        fromHex: { q: 1, r: -1 },
        direction: "E",
        tileId: TileId.Core5GreenCity, // City tile
      });

      const result = exploreCommand.execute(state);

      expect(result.state.scenarioEndTriggered).toBe(true);
      expect(result.state.finalTurnsRemaining).toBe(1); // Solo = 1 player = 1 final turn

      // Check for scenario end triggered event
      const endEvent = result.events.find(e => e.type === SCENARIO_END_TRIGGERED);
      expect(endEvent).toBeDefined();
      expect(endEvent?.type === SCENARIO_END_TRIGGERED && endEvent.trigger).toBe(END_TRIGGER_CITY_REVEALED);
    });

    it("should not trigger end on non-city tile", () => {
      const state = createGameStateWithTileDeck();

      const exploreCommand = createExploreCommand({
        playerId: "player1",
        fromHex: { q: 1, r: -1 },
        direction: "E",
        tileId: TileId.Countryside1, // Not a city
      });

      const result = exploreCommand.execute(state);

      expect(result.state.scenarioEndTriggered).toBe(false);
      expect(result.state.finalTurnsRemaining).toBeNull();
    });

    it("should only trigger once even if another city tile is revealed", () => {
      let state = createGameStateWithTileDeck();

      // First city reveal
      const explore1 = createExploreCommand({
        playerId: "player1",
        fromHex: { q: 1, r: -1 },
        direction: "E",
        tileId: TileId.Core5GreenCity,
      });

      state = explore1.execute(state).state;
      expect(state.scenarioEndTriggered).toBe(true);
      expect(state.finalTurnsRemaining).toBe(1); // One player, one final turn

      // Add another core tile to deck and try to explore again
      state = {
        ...state,
        players: state.players.map(p => ({ ...p, position: { q: 3, r: -1 }, movePoints: 10 })),
        map: {
          ...state.map,
          tileDeck: {
            ...state.map.tileDeck,
            core: [TileId.Core6BlueCity],
          },
        },
      };

      const explore2 = createExploreCommand({
        playerId: "player1",
        fromHex: { q: 3, r: -1 },
        direction: "E",
        tileId: TileId.Core6BlueCity,
      });

      const result2 = explore2.execute(state);

      // Should still be triggered, final turns shouldn't reset
      expect(result2.state.scenarioEndTriggered).toBe(true);
      // The event should not be emitted again
      const endEvents = result2.events.filter(e => e.type === SCENARIO_END_TRIGGERED);
      expect(endEvents.length).toBe(0);
    });
  });

  describe("Final turns and game end", () => {
    it("should decrement final turns on end turn", () => {
      let state = createGameStateWithTileDeck();

      // Trigger scenario end
      state = {
        ...state,
        scenarioEndTriggered: true,
        finalTurnsRemaining: 2,
      };

      const endTurnCommand = createEndTurnCommand({ playerId: "player1" });
      const result = endTurnCommand.execute(state);

      expect(result.state.finalTurnsRemaining).toBe(1);
      expect(result.state.gameEnded).toBe(false);
    });

    it("should end game when final turns reach 0", () => {
      let state = createGameStateWithTileDeck();

      // Set up for final turn
      state = {
        ...state,
        scenarioEndTriggered: true,
        finalTurnsRemaining: 1,
        players: state.players.map(p => ({ ...p, fame: 10 })),
      };

      const endTurnCommand = createEndTurnCommand({ playerId: "player1" });
      const result = endTurnCommand.execute(state);

      expect(result.state.finalTurnsRemaining).toBe(0);
      expect(result.state.gameEnded).toBe(true);
      expect(result.state.winningPlayerId).toBe("player1");

      // Check for game ended event
      const gameEndEvent = result.events.find(e => e.type === GAME_ENDED);
      expect(gameEndEvent).toBeDefined();
      expect(gameEndEvent?.type === GAME_ENDED && gameEndEvent.winningPlayerId).toBe("player1");
      expect(gameEndEvent?.type === GAME_ENDED && gameEndEvent.finalScores).toEqual([
        { playerId: "player1", score: 10 },
      ]);
    });

    it("should end game immediately if round ends during final turns", () => {
      // Rulebook: "If the Round ends during this [final turns], the game ends immediately."
      let state = createGameStateWithTileDeck();

      // Set up: scenario end triggered, still have final turns remaining
      state = {
        ...state,
        scenarioEndTriggered: true,
        finalTurnsRemaining: 2, // Would normally have 2 more turns
        players: state.players.map(p => ({ ...p, fame: 15 })),
      };

      // End round command (e.g., all players passed early)
      const endRoundCommand = createEndRoundCommand();
      const result = endRoundCommand.execute(state);

      // Game should end immediately
      expect(result.state.gameEnded).toBe(true);
      expect(result.state.finalTurnsRemaining).toBe(0);
      expect(result.state.winningPlayerId).toBe("player1");

      // Should have both ROUND_ENDED and GAME_ENDED events
      const roundEndEvent = result.events.find(e => e.type === ROUND_ENDED);
      expect(roundEndEvent).toBeDefined();

      const gameEndEvent = result.events.find(e => e.type === GAME_ENDED);
      expect(gameEndEvent).toBeDefined();
      expect(gameEndEvent?.type === GAME_ENDED && gameEndEvent.winningPlayerId).toBe("player1");
      expect(gameEndEvent?.type === GAME_ENDED && gameEndEvent.finalScores).toEqual([
        { playerId: "player1", score: 15 },
      ]);
    });
  });

  describe("City entry restriction", () => {
    it("should prevent entering city in First Reconnaissance", () => {
      const state = createGameStateWithTileDeck();

      // Player needs to be adjacent to the city hex
      // Update player position to be adjacent to (2, -1)
      const stateWithPlayer: GameState = {
        ...state,
        players: state.players.map(p => ({
          ...p,
          position: { q: 1, r: -1 }, // Adjacent to (2, -1) via direction "E"
          movePoints: 10, // Enough move points
        })),
      };

      // Add a city hex to the map adjacent to player
      const cityHexKey = hexKey({ q: 2, r: -1 });
      const stateWithCity: GameState = {
        ...stateWithPlayer,
        map: {
          ...stateWithPlayer.map,
          hexes: {
            ...stateWithPlayer.map.hexes,
            [cityHexKey]: {
              coord: { q: 2, r: -1 },
              terrain: "plains",
              tileId: TileId.Core5GreenCity,
              site: {
                type: SiteType.City,
                owner: null,
                isConquered: false,
                isBurned: false,
                cityColor: CITY_COLOR_GREEN,
              },
              rampagingEnemies: [],
              enemies: [],
              shieldTokens: [],
            },
          },
        },
      };

      const moveAction = {
        type: MOVE_ACTION as const,
        target: { q: 2, r: -1 },
      };

      const result = validateAction(stateWithCity, "player1", moveAction);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(CANNOT_ENTER_CITY);
      }
    });

    it("should allow entering city in Full Conquest", () => {
      const state = createGameStateWithTileDeck(SCENARIO_FULL_CONQUEST);

      // Player needs to be adjacent to the city hex
      const stateWithPlayer: GameState = {
        ...state,
        players: state.players.map(p => ({
          ...p,
          position: { q: 1, r: -1 },
          movePoints: 10,
        })),
      };

      // Add a city hex to the map adjacent to player
      const cityHexKey = hexKey({ q: 2, r: -1 });
      const stateWithCity: GameState = {
        ...stateWithPlayer,
        map: {
          ...stateWithPlayer.map,
          hexes: {
            ...stateWithPlayer.map.hexes,
            [cityHexKey]: {
              coord: { q: 2, r: -1 },
              terrain: "plains",
              tileId: TileId.Core5GreenCity,
              site: {
                type: SiteType.City,
                owner: null,
                isConquered: false,
                isBurned: false,
                cityColor: CITY_COLOR_GREEN,
              },
              rampagingEnemies: [],
              enemies: [],
              shieldTokens: [],
            },
          },
        },
      };

      const moveAction = {
        type: MOVE_ACTION as const,
        target: { q: 2, r: -1 },
      };

      const result = validateAction(stateWithCity, "player1", moveAction);

      // Should pass the city entry check (may fail on other validators)
      // Check that if it fails, it's not due to city entry restriction
      if (!result.valid) {
        expect(result.error.code).not.toBe(CANNOT_ENTER_CITY);
      }
    });
  });

  describe("Tile definitions", () => {
    it("should correctly identify city tiles", () => {
      expect(TILE_DEFINITIONS[TileId.Core5GreenCity].hasCity).toBe(true);
      expect(TILE_DEFINITIONS[TileId.Core6BlueCity].hasCity).toBe(true);
      expect(TILE_DEFINITIONS[TileId.Core7WhiteCity].hasCity).toBe(true);
      expect(TILE_DEFINITIONS[TileId.Core8RedCity].hasCity).toBe(true);

      expect(TILE_DEFINITIONS[TileId.Countryside1].hasCity).toBe(false);
      expect(TILE_DEFINITIONS[TileId.Core1].hasCity).toBe(false);
    });
  });
});
