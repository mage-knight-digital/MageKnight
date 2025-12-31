/**
 * @mage-knight/shared
 * Shared types and utilities for client and server
 */

// Hex coordinates
export type { HexCoord, HexDirection } from "./hex.js";
export { HEX_DIRECTIONS, hexKey, getNeighbor, getAllNeighbors } from "./hex.js";

// Terrain
export type { Terrain, MovementCost, MovementCosts } from "./terrain.js";
export { DEFAULT_MOVEMENT_COSTS } from "./terrain.js";

// Events
export type {
  GameEvent,
  GameEventType,
  GameStartedEvent,
  RoundStartedEvent,
  TurnStartedEvent,
  PlayerMovedEvent,
  TileRevealedEvent,
  CombatStartedEvent,
  CombatEndedEvent,
  TurnEndedEvent,
  RoundEndedEvent,
  GameEndedEvent,
} from "./events.js";

// Actions
export type {
  PlayerAction,
  PlayerActionType,
  MoveAction,
  ExploreAction,
  EndTurnAction,
  RestAction,
} from "./actions.js";

// Connection
export type { GameConnection, GameEngine, EventCallback } from "./connection.js";
export { LocalConnection } from "./connection.js";
