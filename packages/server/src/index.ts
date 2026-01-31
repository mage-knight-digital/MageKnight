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

// Single-player game
export { createGame, type GameInstance } from "./singlePlayerGame.js";

// Re-export types
export type { EventCallback } from "@mage-knight/shared";
