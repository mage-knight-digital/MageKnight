/**
 * @mage-knight/server
 * Server wrapper that connects the game engine to clients
 */

import { type GameState, createInitialGameState } from "@mage-knight/core";
import {
  LocalConnection,
  type GameConnection,
  type GameEngine,
  type PlayerAction,
  type ActionResult,
  type GameEvent,
  type ClientGameState,
  type EventCallback,
} from "@mage-knight/shared";

// ============================================================================
// Single-player game instance (uses LocalConnection)
// ============================================================================

export interface GameInstance {
  readonly engine: GameEngine;
  readonly connection: GameConnection;
}

/**
 * Convert full GameState to ClientGameState for a specific player.
 * For now this is a placeholder that returns minimal data.
 * TODO: Implement proper state filtering (hide other players' hands, deck contents, etc.)
 */
export function toClientState(
  _state: GameState,
  _forPlayerId: string
): ClientGameState {
  // Placeholder - return minimal valid ClientGameState
  return {
    phase: "setup",
    timeOfDay: "day",
    round: 1,
    turnOrder: [],
    currentPlayerId: "",
    endOfRoundAnnouncedBy: null,
    players: [],
    map: {
      hexes: {},
      tiles: [],
    },
    source: {
      dice: [],
    },
    offers: {
      units: [],
      advancedActions: { cards: [] },
      spells: { cards: [] },
      commonSkills: [],
      monasteryAdvancedActions: [],
    },
    combat: null,
    scenarioEndTriggered: false,
    deckCounts: {
      spells: 0,
      advancedActions: 0,
      artifacts: 0,
      regularUnits: 0,
      eliteUnits: 0,
    },
    woundPileCount: 10,
  };
}

// ============================================================================
// Server-side engine interface (returns full state, not filtered)
// ============================================================================

/**
 * Result of processing an action on the server.
 * Contains full GameState (not filtered) so server can filter per-player.
 */
export interface ServerActionResult {
  readonly events: readonly GameEvent[];
  readonly state: GameState;
}

/**
 * Server-side game engine interface.
 * Unlike GameEngine in shared (which returns ClientGameState),
 * this returns full GameState for the server to filter.
 */
export interface ServerGameEngine {
  getState(): GameState;
  processAction(playerId: string, action: PlayerAction): ServerActionResult;
}

// ============================================================================
// Multiplayer game server
// ============================================================================

/**
 * Manages the game and all connected players for multiplayer.
 * Broadcasts events and filtered state to all connected clients.
 */
export class GameServer {
  private readonly engine: ServerGameEngine;
  private readonly connections: Map<string, EventCallback> = new Map();

  constructor(engine: ServerGameEngine) {
    this.engine = engine;
  }

  /**
   * Player joins and provides their callback for receiving events/state.
   */
  connect(playerId: string, callback: EventCallback): void {
    this.connections.set(playerId, callback);
  }

  /**
   * Player disconnects.
   */
  disconnect(playerId: string): void {
    this.connections.delete(playerId);
  }

  /**
   * Get current state for a specific player (filtered).
   */
  getStateForPlayer(playerId: string): ClientGameState {
    return toClientState(this.engine.getState(), playerId);
  }

  /**
   * Player sends an action. Broadcasts result to ALL connected players.
   */
  handleAction(playerId: string, action: PlayerAction): void {
    const result = this.engine.processAction(playerId, action);

    // Broadcast to ALL connected players, each with their own filtered state
    for (const [pid, callback] of this.connections) {
      const filteredState = toClientState(result.state, pid);
      callback(result.events, filteredState);
    }
  }
}

// ============================================================================
// Placeholder engine implementation
// ============================================================================

class PlaceholderEngine implements ServerGameEngine {
  private state: GameState = createInitialGameState();

  getState(): GameState {
    return this.state;
  }

  processAction(_playerId: string, _action: PlayerAction): ServerActionResult {
    // Placeholder - no game logic yet
    return {
      events: [],
      state: this.state,
    };
  }
}

/**
 * Adapter to make ServerGameEngine compatible with GameEngine interface.
 * Used for LocalConnection which expects GameEngine.
 */
class EngineAdapter implements GameEngine {
  constructor(
    private readonly serverEngine: ServerGameEngine,
    private readonly playerId: string
  ) {}

  processAction(playerId: string, action: PlayerAction): ActionResult {
    const result = this.serverEngine.processAction(playerId, action);
    return {
      events: result.events,
      state: toClientState(result.state, this.playerId),
    };
  }
}

// ============================================================================
// Factory functions
// ============================================================================

/**
 * Create a single-player game instance with LocalConnection.
 */
export function createGame(playerId: string): GameInstance {
  const serverEngine = new PlaceholderEngine();
  const engineAdapter = new EngineAdapter(serverEngine, playerId);
  const connection = new LocalConnection(engineAdapter, playerId);

  return {
    engine: engineAdapter,
    connection,
  };
}

/**
 * Create a multiplayer game server.
 */
export function createGameServer(): GameServer {
  const engine = new PlaceholderEngine();
  return new GameServer(engine);
}
