/**
 * Game event types - discriminated union for all events emitted by the engine
 */

import type { HexCoord } from "./hex.js";

export interface GameStartedEvent {
  readonly type: "GAME_STARTED";
  readonly playerCount: number;
  readonly scenario: string;
}

export interface RoundStartedEvent {
  readonly type: "ROUND_STARTED";
  readonly round: number;
  readonly isDay: boolean;
}

export interface TurnStartedEvent {
  readonly type: "TURN_STARTED";
  readonly playerIndex: number;
}

export interface PlayerMovedEvent {
  readonly type: "PLAYER_MOVED";
  readonly playerIndex: number;
  readonly from: HexCoord;
  readonly to: HexCoord;
}

export interface TileRevealedEvent {
  readonly type: "TILE_REVEALED";
  readonly position: HexCoord;
  readonly tileId: string;
}

export interface CombatStartedEvent {
  readonly type: "COMBAT_STARTED";
  readonly playerIndex: number;
  readonly position: HexCoord;
  readonly enemies: readonly string[];
}

export interface CombatEndedEvent {
  readonly type: "COMBAT_ENDED";
  readonly playerIndex: number;
  readonly victory: boolean;
}

export interface TurnEndedEvent {
  readonly type: "TURN_ENDED";
  readonly playerIndex: number;
}

export interface RoundEndedEvent {
  readonly type: "ROUND_ENDED";
  readonly round: number;
}

export interface GameEndedEvent {
  readonly type: "GAME_ENDED";
  readonly winner: number | null;
}

export type GameEvent =
  | GameStartedEvent
  | RoundStartedEvent
  | TurnStartedEvent
  | PlayerMovedEvent
  | TileRevealedEvent
  | CombatStartedEvent
  | CombatEndedEvent
  | TurnEndedEvent
  | RoundEndedEvent
  | GameEndedEvent;

export type GameEventType = GameEvent["type"];
