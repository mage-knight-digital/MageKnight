import { createGameServer, type GameServer } from "./GameServer.js";
import type {
  ClientGameState,
  EventCallback,
  GameConfig,
  GameEvent,
  HeroId,
  PlayerAction,
  ScenarioId,
} from "@mage-knight/shared";
import { SCENARIO_FIRST_RECONNAISSANCE } from "@mage-knight/shared";

export const CLIENT_MESSAGE_ACTION = "action" as const;
export const SERVER_MESSAGE_STATE_UPDATE = "state_update" as const;
export const SERVER_MESSAGE_ERROR = "error" as const;

export const CLOSE_CODE_INVALID_REQUEST = 1008 as const;
export const CLOSE_CODE_INTERNAL_ERROR = 1011 as const;
export const CLOSE_CODE_REPLACED_CONNECTION = 4001 as const;

export interface ClientActionMessage {
  type: typeof CLIENT_MESSAGE_ACTION;
  action: PlayerAction;
}

export interface StateUpdateMessage {
  type: typeof SERVER_MESSAGE_STATE_UPDATE;
  events: readonly GameEvent[];
  state: ClientGameState;
}

export interface ErrorMessage {
  type: typeof SERVER_MESSAGE_ERROR;
  message: string;
}

export type ServerMessage = StateUpdateMessage | ErrorMessage;

export interface ConnectionLike {
  send(message: string): number;
  close(code?: number, reason?: string): void;
}

export interface CreateGameRoomOptions {
  playerIds: readonly string[];
  heroIds?: readonly HeroId[];
  scenarioId?: ScenarioId;
  config?: GameConfig;
  seed?: number;
  maxPlayers?: number;
}

export interface WebSocketServerOptions {
  port?: number;
  host?: string;
  cleanupTimeoutMs?: number;
}

interface GameRoom {
  id: string;
  gameServer: GameServer;
  playerIds: Set<string>;
  maxPlayers: number;
  connections: Map<string, ConnectionLike>;
  cleanupTimeout?: ReturnType<typeof setTimeout>;
}

interface ConnectionContext {
  roomId: string;
  playerId: string;
}

interface UpgradeData {
  roomId: string;
  playerId: string;
}

type BunServerInstance = ReturnType<typeof Bun.serve<UpgradeData>>;

const DEFAULT_PORT = 3001;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_CLEANUP_TIMEOUT_MS = 5 * 60 * 1000;
const QUERY_GAME_ID = "gameId";
const QUERY_PLAYER_ID = "playerId";
const UPGRADE_FAILED_MESSAGE = "Failed to upgrade to WebSocket";
const MISSING_CONNECTION_PARAMS_MESSAGE = "Missing required query params: gameId and playerId";
const UNKNOWN_MESSAGE_TYPE_ERROR = "Unknown message type";
const INVALID_JSON_ERROR = "Invalid JSON";
const INVALID_ACTION_MESSAGE_ERROR = "Invalid action message";
const INVALID_GAME_ID_ERROR = "Invalid game ID";
const GAME_FULL_ERROR = "Game is full";
const INVALID_PLAYER_ID_ERROR = "Invalid player ID for game";
const PLAYER_REPLACED_REASON = "Replaced by a new connection";

function buildStateUpdateMessage(
  events: readonly GameEvent[],
  state: ClientGameState
): StateUpdateMessage {
  return {
    type: SERVER_MESSAGE_STATE_UPDATE,
    events,
    state,
  };
}

function buildErrorMessage(message: string): ErrorMessage {
  return {
    type: SERVER_MESSAGE_ERROR,
    message,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isClientActionMessage(value: unknown): value is ClientActionMessage {
  if (!isObject(value)) {
    return false;
  }

  return value.type === CLIENT_MESSAGE_ACTION && "action" in value;
}

function createEventCallback(connection: ConnectionLike): EventCallback {
  return (events, state): void => {
    connection.send(JSON.stringify(buildStateUpdateMessage(events, state)));
  };
}

function generateRoomId(existingIds: Set<string>): string {
  let roomId = crypto.randomUUID().slice(0, 8);

  while (existingIds.has(roomId)) {
    roomId = crypto.randomUUID().slice(0, 8);
  }

  return roomId;
}

export class GameRoomManager {
  private readonly rooms = new Map<string, GameRoom>();
  private readonly connectionContexts = new Map<ConnectionLike, ConnectionContext>();
  private readonly cleanupTimeoutMs: number;

  constructor(cleanupTimeoutMs: number = DEFAULT_CLEANUP_TIMEOUT_MS) {
    this.cleanupTimeoutMs = cleanupTimeoutMs;
  }

  createGameRoom(options: CreateGameRoomOptions): string {
    const gameServer = createGameServer(options.seed);
    const scenarioId = options.scenarioId ?? SCENARIO_FIRST_RECONNAISSANCE;
    const roomId = generateRoomId(new Set(this.rooms.keys()));

    gameServer.initializeGame(options.playerIds, options.heroIds, scenarioId, options.config);

    const playerIds = new Set(options.playerIds);
    const maxPlayers = options.maxPlayers ?? options.playerIds.length;

    const room: GameRoom = {
      id: roomId,
      gameServer,
      playerIds,
      maxPlayers,
      connections: new Map(),
    };

    this.rooms.set(roomId, room);
    return roomId;
  }

  hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  deleteRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }

    if (room.cleanupTimeout) {
      clearTimeout(room.cleanupTimeout);
    }

    for (const [playerId, connection] of room.connections) {
      this.connectionContexts.delete(connection);
      room.gameServer.disconnect(playerId);
      connection.close();
    }

    this.rooms.delete(roomId);
  }

  handleConnectionOpen(connection: ConnectionLike, roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.sendErrorAndClose(connection, INVALID_GAME_ID_ERROR);
      return;
    }

    if (!room.playerIds.has(playerId)) {
      this.sendErrorAndClose(connection, INVALID_PLAYER_ID_ERROR);
      return;
    }

    const existingConnection = room.connections.get(playerId);
    if (!existingConnection && room.connections.size >= room.maxPlayers) {
      this.sendErrorAndClose(connection, GAME_FULL_ERROR);
      return;
    }

    if (room.cleanupTimeout) {
      clearTimeout(room.cleanupTimeout);
      room.cleanupTimeout = undefined;
    }

    if (existingConnection && existingConnection !== connection) {
      this.disconnectConnection(existingConnection, CLOSE_CODE_REPLACED_CONNECTION, PLAYER_REPLACED_REASON);
    }

    room.connections.set(playerId, connection);
    this.connectionContexts.set(connection, { roomId, playerId });
    room.gameServer.connect(playerId, createEventCallback(connection));
  }

  handleConnectionMessage(connection: ConnectionLike, rawMessage: string): void {
    const context = this.connectionContexts.get(connection);
    if (!context) {
      this.sendErrorAndClose(connection, INVALID_GAME_ID_ERROR);
      return;
    }

    const room = this.rooms.get(context.roomId);
    if (!room) {
      this.sendErrorAndClose(connection, INVALID_GAME_ID_ERROR);
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawMessage);
    } catch {
      this.sendError(connection, INVALID_JSON_ERROR);
      return;
    }

    if (!isClientActionMessage(parsed)) {
      this.sendError(connection, UNKNOWN_MESSAGE_TYPE_ERROR);
      return;
    }

    if (!isObject(parsed.action)) {
      this.sendError(connection, INVALID_ACTION_MESSAGE_ERROR);
      return;
    }

    try {
      room.gameServer.handleAction(context.playerId, parsed.action as PlayerAction);
    } catch {
      this.sendError(connection, INVALID_ACTION_MESSAGE_ERROR);
    }
  }

  handleConnectionClose(connection: ConnectionLike): void {
    this.disconnectConnection(connection);
  }

  dispose(): void {
    for (const roomId of this.rooms.keys()) {
      this.deleteRoom(roomId);
    }
  }

  private disconnectConnection(connection: ConnectionLike, code?: number, reason?: string): void {
    const context = this.connectionContexts.get(connection);
    if (!context) {
      if (code !== undefined || reason !== undefined) {
        connection.close(code, reason);
      }
      return;
    }

    const room = this.rooms.get(context.roomId);
    this.connectionContexts.delete(connection);

    if (!room) {
      if (code !== undefined || reason !== undefined) {
        connection.close(code, reason);
      }
      return;
    }

    room.connections.delete(context.playerId);
    room.gameServer.disconnect(context.playerId);

    if (code !== undefined || reason !== undefined) {
      connection.close(code, reason);
    }

    this.scheduleRoomCleanup(room);
  }

  private scheduleRoomCleanup(room: GameRoom): void {
    if (room.connections.size > 0 || this.cleanupTimeoutMs <= 0) {
      return;
    }

    room.cleanupTimeout = setTimeout(() => {
      const currentRoom = this.rooms.get(room.id);
      if (!currentRoom || currentRoom.connections.size > 0) {
        return;
      }

      this.deleteRoom(room.id);
    }, this.cleanupTimeoutMs);
  }

  private sendError(connection: ConnectionLike, message: string): void {
    connection.send(JSON.stringify(buildErrorMessage(message)));
  }

  private sendErrorAndClose(connection: ConnectionLike, message: string): void {
    this.sendError(connection, message);
    connection.close(CLOSE_CODE_INVALID_REQUEST, message);
  }
}

function toMessageString(message: string | Uint8Array): string {
  if (typeof message === "string") {
    return message;
  }

  return new TextDecoder().decode(message);
}

export class WebSocketGameServer {
  private readonly port: number;
  private readonly host: string;
  private readonly roomManager: GameRoomManager;
  private server?: BunServerInstance;

  constructor(options: WebSocketServerOptions = {}) {
    this.port = options.port ?? DEFAULT_PORT;
    this.host = options.host ?? DEFAULT_HOST;
    this.roomManager = new GameRoomManager(options.cleanupTimeoutMs);
  }

  getPort(): number {
    return this.server?.port ?? this.port;
  }

  createGameRoom(options: CreateGameRoomOptions): string {
    return this.roomManager.createGameRoom(options);
  }

  hasRoom(roomId: string): boolean {
    return this.roomManager.hasRoom(roomId);
  }

  start(): void {
    if (this.server) {
      return;
    }

    this.server = Bun.serve<UpgradeData>({
      port: this.port,
      hostname: this.host,
      fetch: (request, server): Response | undefined => {
        const url = new URL(request.url);
        const roomId = url.searchParams.get(QUERY_GAME_ID);
        const playerId = url.searchParams.get(QUERY_PLAYER_ID);

        if (!roomId || !playerId) {
          return new Response(MISSING_CONNECTION_PARAMS_MESSAGE, { status: 400 });
        }

        const upgraded = server.upgrade(request, {
          data: {
            roomId,
            playerId,
          },
        });

        if (!upgraded) {
          return new Response(UPGRADE_FAILED_MESSAGE, { status: 500 });
        }

        return undefined;
      },
      websocket: {
        open: (webSocket): void => {
          this.roomManager.handleConnectionOpen(webSocket, webSocket.data.roomId, webSocket.data.playerId);
        },
        message: (webSocket, message): void => {
          this.roomManager.handleConnectionMessage(webSocket, toMessageString(message));
        },
        close: (webSocket): void => {
          this.roomManager.handleConnectionClose(webSocket);
        },
      },
    });
  }

  stop(closeActiveConnections: boolean = true): void {
    this.server?.stop(closeActiveConnections);
    this.server = undefined;
    this.roomManager.dispose();
  }
}

export function createWebSocketGameServer(options?: WebSocketServerOptions): WebSocketGameServer {
  return new WebSocketGameServer(options);
}
