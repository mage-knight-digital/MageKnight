/**
 * Game connection abstraction for local and networked play
 */

import type { PlayerAction } from "./actions.js";
import type { GameEvent } from "./events/index.js";
import type { ClientGameState } from "./types/clientState.js";

// Callback receives all events from an action plus the resulting state
export type EventCallback = (
  events: readonly GameEvent[],
  state: ClientGameState
) => void;

// Result of processing an action
export interface ActionResult {
  readonly events: readonly GameEvent[];
  readonly state: ClientGameState;
}

export interface GameConnection {
  sendAction(action: PlayerAction): void;
  onEvent(callback: EventCallback): void;
}

export interface GameEngine {
  processAction(playerId: string, action: PlayerAction): ActionResult;
}

export class LocalConnection implements GameConnection {
  private readonly engine: GameEngine;
  private readonly playerId: string;
  private eventCallbacks: EventCallback[] = [];

  constructor(engine: GameEngine, playerId: string) {
    this.engine = engine;
    this.playerId = playerId;
  }

  sendAction(action: PlayerAction): void {
    const result = this.engine.processAction(this.playerId, action);
    for (const callback of this.eventCallbacks) {
      callback(result.events, result.state);
    }
  }

  onEvent(callback: EventCallback): void {
    this.eventCallbacks.push(callback);
  }
}
