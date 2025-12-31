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
  type GameEvent,
} from "@mage-knight/shared";

export interface GameInstance {
  readonly engine: GameEngine;
  readonly connection: GameConnection;
}

class PlaceholderEngine implements GameEngine {
  private state: GameState = createInitialGameState();

  getState(): GameState {
    return this.state;
  }

  processAction(_action: PlayerAction): readonly GameEvent[] {
    // Placeholder - no game logic yet
    return [];
  }
}

export function createGame(): GameInstance {
  const engine = new PlaceholderEngine();
  const connection = new LocalConnection(engine);

  return {
    engine,
    connection,
  };
}
