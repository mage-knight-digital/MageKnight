/**
 * Game connection abstraction for local and networked play
 */

import type { PlayerAction } from "./actions.js";
import type { GameEvent } from "./events.js";

export type EventCallback = (event: GameEvent) => void;

export interface GameConnection {
  sendAction(action: PlayerAction): void;
  onEvent(callback: EventCallback): void;
}

export interface GameEngine {
  processAction(action: PlayerAction): readonly GameEvent[];
}

export class LocalConnection implements GameConnection {
  private readonly engine: GameEngine;
  private eventCallbacks: EventCallback[] = [];

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  sendAction(action: PlayerAction): void {
    const events = this.engine.processAction(action);
    for (const event of events) {
      for (const callback of this.eventCallbacks) {
        callback(event);
      }
    }
  }

  onEvent(callback: EventCallback): void {
    this.eventCallbacks.push(callback);
  }
}
