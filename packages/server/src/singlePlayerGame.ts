/**
 * Single-Player Game Module
 *
 * Provides the EngineAdapter and LocalConnection setup for single-player games.
 * Used when the client embeds the server for local play.
 */

import {
  type GameState,
  createInitialGameState,
  MageKnightEngine,
  createEngine,
} from "@mage-knight/core";
import {
  LocalConnection,
  type GameConnection,
  type GameEngine,
  type PlayerAction,
  type ActionResult,
} from "@mage-knight/shared";
import { toClientState } from "./stateFilters.js";

/**
 * A game instance combining an engine and connection for single-player use.
 */
export interface GameInstance {
  readonly engine: GameEngine;
  readonly connection: GameConnection;
}

/**
 * Adapter to make MageKnightEngine compatible with GameEngine interface.
 * Used for LocalConnection which expects GameEngine.
 */
class EngineAdapter implements GameEngine {
  private state: GameState;
  private readonly mageKnightEngine: MageKnightEngine;

  constructor(
    private readonly playerId: string,
    seed?: number
  ) {
    this.mageKnightEngine = createEngine();
    this.state = createInitialGameState(seed);
  }

  processAction(playerId: string, action: PlayerAction): ActionResult {
    const result = this.mageKnightEngine.processAction(
      this.state,
      playerId,
      action
    );
    this.state = result.state;
    return {
      events: result.events,
      state: toClientState(result.state, this.playerId),
    };
  }
}

/**
 * Create a single-player game instance with LocalConnection.
 * @param playerId - The player's ID
 * @param seed - Optional seed for reproducible RNG
 */
export function createGame(playerId: string, seed?: number): GameInstance {
  const engineAdapter = new EngineAdapter(playerId, seed);
  const connection = new LocalConnection(engineAdapter, playerId);

  return {
    engine: engineAdapter,
    connection,
  };
}
