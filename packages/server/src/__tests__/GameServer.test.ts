import { describe, it, expect, beforeEach, vi } from "vitest";
import { createGameServer, GameServer } from "../index.js";
import type { GameEvent, ClientGameState } from "@mage-knight/shared";
import {
  END_TURN_ACTION,
  GAME_STARTED,
  MOVE_ACTION,
  PLAYER_MOVED,
  TERRAIN_PLAINS,
  UNDO_ACTION,
  hexKey,
  ROUND_PHASE_TACTICS_SELECTION,
  ALL_DAY_TACTICS,
  SELECT_TACTIC_ACTION,
  TACTIC_EARLY_BIRD,
  TACTIC_SELECTED,
  ROUND_PHASE_PLAYER_TURNS,
} from "@mage-knight/shared";
import { SiteType, TileId } from "@mage-knight/core";
import type { HexState } from "@mage-knight/core";

describe("GameServer", () => {
  let server: GameServer;

  beforeEach(() => {
    server = createGameServer();
  });

  describe("connection", () => {
    it("should allow players to connect", () => {
      const callback = vi.fn();

      server.initializeGame(["player1"]);
      server.connect("player1", callback);

      // Should receive initial state
      expect(callback).toHaveBeenCalledTimes(1);
      const [, state] = callback.mock.calls[0] as [GameEvent[], ClientGameState];
      expect(state.players).toHaveLength(1);
      expect(state.players[0].id).toBe("player1");
    });

    it("should send filtered state to each player", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      server.initializeGame(["player1", "player2"]);
      server.connect("player1", callback1);
      server.connect("player2", callback2);

      const state1 = callback1.mock.calls[0][1] as ClientGameState;

      // Each player should see their own hand as array
      // and other player's hand as number
      const p1InState1 = state1.players.find((p) => p.id === "player1");
      const p2InState1 = state1.players.find((p) => p.id === "player2");

      expect(Array.isArray(p1InState1?.hand)).toBe(true);
      expect(typeof p2InState1?.hand).toBe("number");

      // Verify callback2 was also called (player2 receives state)
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe("action handling", () => {
    it("should process action and broadcast to all players", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      server.initializeGame(["player1", "player2"]);
      server.connect("player1", callback1);
      server.connect("player2", callback2);

      // Clear initial connection calls
      callback1.mockClear();
      callback2.mockClear();

      // Player1 sends an action (will fail validation since not on map, but that's ok)
      server.handleAction("player1", { type: END_TURN_ACTION });

      // Both players should receive the broadcast
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should update state after valid action", () => {
      server.initializeGame(["player1"]);

      // Manually set up state for a valid move
      const state = server.getState();
      const testHex: HexState = {
        coord: { q: 0, r: 0 },
        terrain: TERRAIN_PLAINS,
        tileId: TileId.StartingTileA,
        site: null,
        enemies: [],
        shieldTokens: [],
        rampagingEnemies: [],
      };
      const targetHex: HexState = {
        coord: { q: 1, r: 0 },
        terrain: TERRAIN_PLAINS,
        tileId: TileId.StartingTileA,
        site: null,
        enemies: [],
        shieldTokens: [],
        rampagingEnemies: [],
      };
      const updatedState = {
        ...state,
        players: [
          {
            ...state.players[0],
            position: { q: 0, r: 0 },
            movePoints: 4,
          },
        ],
        map: {
          ...state.map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: testHex,
            [hexKey({ q: 1, r: 0 })]: targetHex,
          },
        },
      };

      // Hacky but works for testing - directly set state
      (server as unknown as { state: typeof updatedState }).state =
        updatedState;

      const callback = vi.fn();
      server.connect("player1", callback);
      callback.mockClear();

      // Now move
      server.handleAction("player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      // Should have moved
      const newState = server.getState();
      expect(newState.players[0].position).toEqual({ q: 1, r: 0 });

      // Should have received PLAYER_MOVED event
      const [events] = callback.mock.calls[0] as [GameEvent[]];
      expect(events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_MOVED,
          playerId: "player1",
        })
      );
    });
  });

  describe("multiplayer broadcast", () => {
    it("should broadcast to all players when one acts", () => {
      const callbacks = [vi.fn(), vi.fn(), vi.fn()];

      server.initializeGame(["player1", "player2", "player3"]);
      server.connect("player1", callbacks[0]);
      server.connect("player2", callbacks[1]);
      server.connect("player3", callbacks[2]);

      callbacks.forEach((cb) => cb.mockClear());

      server.handleAction("player1", { type: UNDO_ACTION });

      // All three should receive broadcast
      expect(callbacks[0]).toHaveBeenCalledTimes(1);
      expect(callbacks[1]).toHaveBeenCalledTimes(1);
      expect(callbacks[2]).toHaveBeenCalledTimes(1);
    });
  });

  describe("game initialization", () => {
    it("should broadcast GAME_STARTED event on initialization", () => {
      const callback = vi.fn();

      server.connect("player1", callback);
      callback.mockClear();

      server.initializeGame(["player1", "player2"]);

      // Should have broadcast GAME_STARTED
      expect(callback).toHaveBeenCalledTimes(1);
      const [events] = callback.mock.calls[0] as [GameEvent[]];
      expect(events).toContainEqual(
        expect.objectContaining({
          type: GAME_STARTED,
          playerCount: 2,
        })
      );
    });

    it("should assign different heroes to players", () => {
      server.initializeGame(["player1", "player2", "player3", "player4"]);

      const state = server.getState();
      const heroIds = state.players.map((p) => p.hero);

      // All 4 players should have different heroes
      const uniqueHeroes = new Set(heroIds);
      expect(uniqueHeroes.size).toBe(4);
    });

    it("should place players on starting tile portal", () => {
      const callback = vi.fn();

      server.initializeGame(["player1", "player2"]);
      server.connect("player1", callback);

      const [, state] = callback.mock.calls[0] as [GameEvent[], ClientGameState];

      // Players should have positions on the portal (center of starting tile)
      expect(state.players[0].position).toEqual({ q: 0, r: 0 });
      expect(state.players[1].position).toEqual({ q: 0, r: 0 });

      // Map should have hexes from the starting tile
      expect(Object.keys(state.map.hexes).length).toBeGreaterThan(0);

      // Portal hex should exist at origin
      const originKey = hexKey({ q: 0, r: 0 });
      expect(state.map.hexes[originKey]).toBeDefined();
      expect(state.map.hexes[originKey].site?.type).toBe(SiteType.Portal);
    });

    it("should give players starting move points", () => {
      const callback = vi.fn();

      server.initializeGame(["player1"]);
      server.connect("player1", callback);

      const [, state] = callback.mock.calls[0] as [GameEvent[], ClientGameState];

      expect(state.players[0].movePoints).toBe(4);
    });
  });

  describe("getStateForPlayer", () => {
    it("should return filtered state for specific player", () => {
      server.initializeGame(["player1", "player2"]);

      const state1 = server.getStateForPlayer("player1");
      const state2 = server.getStateForPlayer("player2");

      // Player1's view should show their hand as array
      const p1InState1 = state1.players.find((p) => p.id === "player1");
      expect(Array.isArray(p1InState1?.hand)).toBe(true);

      // Player2's view should show player1's hand as number
      const p1InState2 = state2.players.find((p) => p.id === "player1");
      expect(typeof p1InState2?.hand).toBe("number");
    });
  });

  describe("tactics selection phase", () => {
    it("should start game in tactics selection phase", () => {
      server.initializeGame(["player1"]);

      const state = server.getState();

      // Should be in tactics selection phase
      expect(state.roundPhase).toBe(ROUND_PHASE_TACTICS_SELECTION);
    });

    it("should have all day tactics available at game start", () => {
      server.initializeGame(["player1"]);

      const state = server.getState();

      // All 6 day tactics should be available
      expect(state.availableTactics).toHaveLength(6);
      for (const tactic of ALL_DAY_TACTICS) {
        expect(state.availableTactics).toContain(tactic);
      }
    });

    it("should set current tactic selector to first player", () => {
      server.initializeGame(["player1"]);

      const state = server.getState();

      // Player should be able to select tactic
      expect(state.currentTacticSelector).toBe("player1");
    });

    it("should allow player to select tactic via action", () => {
      const callback = vi.fn();

      server.initializeGame(["player1"]);
      server.connect("player1", callback);
      callback.mockClear();

      // Select a tactic
      server.handleAction("player1", {
        type: SELECT_TACTIC_ACTION,
        tacticId: TACTIC_EARLY_BIRD,
      });

      // Should receive TACTIC_SELECTED event
      const [events] = callback.mock.calls[0] as [GameEvent[]];
      expect(events).toContainEqual(
        expect.objectContaining({
          type: TACTIC_SELECTED,
          playerId: "player1",
          tacticId: TACTIC_EARLY_BIRD,
        })
      );

      // Player should have tactic assigned
      const state = server.getState();
      const player = state.players.find((p) => p.id === "player1");
      expect(player?.selectedTactic).toBe(TACTIC_EARLY_BIRD);
    });

    it("should transition to player turns after solo player selects tactic", () => {
      server.initializeGame(["player1"]);

      // Select a tactic
      server.handleAction("player1", {
        type: SELECT_TACTIC_ACTION,
        tacticId: TACTIC_EARLY_BIRD,
      });

      const state = server.getState();

      // Should transition to player turns
      expect(state.roundPhase).toBe(ROUND_PHASE_PLAYER_TURNS);
    });

    it("should expose roundPhase in client state", () => {
      server.initializeGame(["player1"]);

      const clientState = server.getStateForPlayer("player1");

      // Client should see that we're in tactics selection
      expect(clientState).toHaveProperty("roundPhase");
      expect((clientState as { roundPhase: string }).roundPhase).toBe(
        ROUND_PHASE_TACTICS_SELECTION
      );
    });
  });

  describe("mana source initialization", () => {
    it("should initialize mana source with dice at game start", () => {
      server.initializeGame(["player1"]);

      const state = server.getState();

      // For 1 player, should have 1 + 2 = 3 dice
      expect(state.source.dice.length).toBe(3);
    });

    it("should have correct number of dice for player count", () => {
      server.initializeGame(["player1", "player2", "player3"]);

      const state = server.getState();

      // For 3 players, should have 3 + 2 = 5 dice
      expect(state.source.dice.length).toBe(5);
    });

    it("should have dice with valid mana colors", () => {
      server.initializeGame(["player1"]);

      const state = server.getState();
      const validColors = ["red", "blue", "green", "white", "gold", "black"];

      for (const die of state.source.dice) {
        expect(validColors).toContain(die.color);
        expect(die.id).toBeDefined();
        expect(typeof die.isDepleted).toBe("boolean");
      }
    });

    it("should expose dice in client state", () => {
      server.initializeGame(["player1"]);

      const clientState = server.getStateForPlayer("player1");

      // Client should see the dice
      expect(clientState.source.dice.length).toBeGreaterThan(0);
    });
  });

  describe("tile deck initialization", () => {
    it("should initialize tile deck based on scenario configuration", () => {
      server.initializeGame(["player1"]);

      const state = server.getState();

      // First Reconnaissance solo: 8 countryside, 2 core, 1 city
      // We place 2 countryside initially, so 6 should remain
      expect(state.map.tileDeck.countryside.length).toBe(6);
      // Core deck: 2 non-city + 1 city = 3 total
      expect(state.map.tileDeck.core.length).toBe(3);
    });

    it("should place starting tile + 2 initial countryside tiles", () => {
      server.initializeGame(["player1"]);

      const state = server.getState();

      // Should have 3 tiles placed
      expect(state.map.tiles.length).toBe(3);

      // First tile should be starting tile A
      expect(state.map.tiles[0].tileId).toBe(TileId.StartingTileA);
      expect(state.map.tiles[0].centerCoord).toEqual({ q: 0, r: 0 });

      // All tiles should be revealed
      for (const tile of state.map.tiles) {
        expect(tile.revealed).toBe(true);
      }
    });

    it("should have hexes from all 3 initial tiles", () => {
      server.initializeGame(["player1"]);

      const state = server.getState();

      // 3 tiles * 7 hexes = 21 unique hexes (tiles are adjacent but don't overlap)
      expect(Object.keys(state.map.hexes).length).toBe(21);
    });

    it("should allow explore action with tiles in deck", () => {
      const callback = vi.fn();

      server.initializeGame(["player1"]);
      server.connect("player1", callback);

      const state = server.getState();

      // Verify there are tiles available for exploration
      const totalTiles =
        state.map.tileDeck.countryside.length + state.map.tileDeck.core.length;
      expect(totalTiles).toBeGreaterThan(0);
    });
  });

  describe("pending choice exposure", () => {
    it("should expose pendingChoice in client player state", () => {
      server.initializeGame(["player1"]);

      const clientState = server.getStateForPlayer("player1");
      const player = clientState.players.find((p) => p.id === "player1");

      // pendingChoice should exist on player (null when no choice pending)
      expect(player).toHaveProperty("pendingChoice");
      expect(player?.pendingChoice).toBeNull();
    });

    it("should show pending choice when player has one", () => {
      server.initializeGame(["player1"]);

      // Manually set a pending choice on the server state for testing
      const state = server.getState();
      const playerWithChoice = {
        ...state.players[0],
        pendingChoice: {
          cardId: "rage" as const,
          options: [
            { type: "gain_attack" as const, value: 2 },
            { type: "gain_block" as const, value: 2 },
          ],
        },
      };
      (server as unknown as { state: typeof state }).state = {
        ...state,
        players: [playerWithChoice],
      };

      const clientState = server.getStateForPlayer("player1");
      const player = clientState.players.find((p) => p.id === "player1");

      expect(player?.pendingChoice).not.toBeNull();
      expect(player?.pendingChoice?.cardId).toBe("rage");
      expect(player?.pendingChoice?.options).toHaveLength(2);
    });
  });
});
