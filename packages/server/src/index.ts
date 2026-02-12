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
 * | `WebSocketServer.ts` | WebSocket transport with game-room management |
 * | `singlePlayerGame.ts` | Single-player game setup with LocalConnection |
 *
 * @module server
 */
import { createWebSocketGameServer } from "./WebSocketServer.js";

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
export {
  WebSocketGameServer,
  createWebSocketGameServer,
  GameRoomManager,
  CLIENT_MESSAGE_ACTION,
  SERVER_MESSAGE_STATE_UPDATE,
  SERVER_MESSAGE_ERROR,
} from "./WebSocketServer.js";

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

// Server-side simulation
export {
  ServerSideSimulation,
  createPolicy,
  RandomServerPolicy,
  enumerateActions,
  POLICY_TYPE_RANDOM,
  SIM_OUTCOME_ENDED,
  SIM_OUTCOME_MAX_STEPS,
  SIM_OUTCOME_STALLED,
} from "./simulation/index.js";
export type {
  RunSimulationRequest,
  RunSimulationResponse,
  ServerPolicy,
  PolicyType,
  SimOutcome,
} from "./simulation/index.js";

// Re-export types
export type { EventCallback } from "@mage-knight/shared";

const PORT_ENV = "PORT";
const DEFAULT_WEB_SOCKET_PORT = 3001;

if (import.meta.main) {
  const portFromEnv = Number.parseInt(Bun.env[PORT_ENV] ?? "", 10);
  const port = Number.isNaN(portFromEnv) ? DEFAULT_WEB_SOCKET_PORT : portFromEnv;

  const webSocketServer = createWebSocketGameServer({ port });
  webSocketServer.start();

  console.log(`WebSocket game server listening on port ${webSocketServer.getPort()}`);
}
