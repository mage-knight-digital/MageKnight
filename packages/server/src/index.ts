/**
 * @mage-knight/server
 *
 * Server wrapper that connects the game engine to clients.
 *
 * This package provides:
 * - State filtering (GameState -> ClientGameState for specific players)
 * - GameServer for multiplayer games
 * - Single-player game setup with LocalConnection
 *
 * ## Module Structure
 *
 * | Module | Purpose |
 * |--------|---------|
 * | `stateFilters.ts` | Converts GameState to filtered ClientGameState |
 * | `GameServer.ts` | Multiplayer game server with player connections |
 * | `singlePlayerGame.ts` | Single-player game setup with LocalConnection |
 *
 * @module server
 */

// State filtering
export {
  toClientState,
  toClientPlayer,
  toClientPendingChoice,
  toClientHexEnemy,
  toClientRuinsToken,
  toClientCombatState,
} from "./stateFilters.js";

// Multiplayer game server
export { GameServer, createGameServer } from "./GameServer.js";

// Room provisioning and session bootstrap
export {
  RoomProvisioningService,
  RoomProvisioningError,
  PLAYER_COUNT_TWO,
  PLAYER_COUNT_THREE,
  PLAYER_COUNT_FOUR,
  ROOM_STATUS_LOBBY,
  ROOM_STATUS_STARTED,
  ROOM_ERROR_INVALID_PLAYER_COUNT,
  ROOM_ERROR_GAME_NOT_FOUND,
  ROOM_ERROR_GAME_ALREADY_STARTED,
  ROOM_ERROR_GAME_FULL,
  ROOM_ERROR_INVALID_SESSION,
} from "./RoomProvisioningService.js";
export type {
  PlayerCount,
  RoomStatus,
  RoomProvisioningErrorCode,
  CreateGameRequest,
  CreateGameResponse,
  JoinGameRequest,
  JoinGameResponse,
  BootstrapSession,
} from "./RoomProvisioningService.js";

// Single-player game
export { createGame, type GameInstance } from "./singlePlayerGame.js";

// Re-export types
export type { EventCallback } from "@mage-knight/shared";
