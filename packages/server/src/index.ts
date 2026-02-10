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

// Single-player game
export { createGame, type GameInstance } from "./singlePlayerGame.js";

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
