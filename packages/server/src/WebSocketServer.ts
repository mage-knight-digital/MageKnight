import { createGameServer, type GameServer } from "./GameServer.js";
import type { EventCallback, GameConfig, HeroId, ScenarioId } from "@mage-knight/shared";
import {
  CLIENT_MESSAGE_ACTION,
  NETWORK_PROTOCOL_VERSION,
  SCENARIO_FIRST_RECONNAISSANCE,
  SERVER_MESSAGE_ERROR,
  SERVER_MESSAGE_STATE_UPDATE,
  parseClientMessage,
  type ErrorMessage,
  type StateUpdateMessage,
} from "@mage-knight/shared";
import {
  PLAYER_COUNT_FOUR,
  PLAYER_COUNT_THREE,
  PLAYER_COUNT_TWO,
  RoomProvisioningError,
  RoomProvisioningService,
  ROOM_ERROR_GAME_ALREADY_STARTED,
  ROOM_ERROR_GAME_FULL,
  ROOM_ERROR_GAME_NOT_FOUND,
  ROOM_ERROR_INVALID_PLAYER_COUNT,
  ROOM_ERROR_INVALID_SESSION,
} from "./RoomProvisioningService.js";

export {
  CLIENT_MESSAGE_ACTION,
  SERVER_MESSAGE_ERROR,
  SERVER_MESSAGE_STATE_UPDATE,
} from "@mage-knight/shared";
export type {
  ErrorMessage,
  ServerMessage,
  StateUpdateMessage,
} from "@mage-knight/shared";

export const CLOSE_CODE_INVALID_REQUEST = 1008 as const;
export const CLOSE_CODE_INTERNAL_ERROR = 1011 as const;
export const CLOSE_CODE_REPLACED_CONNECTION = 4001 as const;

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
const QUERY_SESSION_TOKEN = "sessionToken";
const UPGRADE_FAILED_MESSAGE = "Failed to upgrade to WebSocket";
const MISSING_CONNECTION_PARAMS_MESSAGE =
  "Missing required query params: gameId and one of sessionToken/playerId";
const UNKNOWN_MESSAGE_TYPE_ERROR = "Unknown message type";
const INVALID_JSON_ERROR = "Invalid JSON";
const INVALID_ACTION_MESSAGE_ERROR = "Invalid action message";
const INVALID_GAME_ID_ERROR = "Invalid game ID";
const GAME_FULL_ERROR = "Game is full";
const INVALID_PLAYER_ID_ERROR = "Invalid player ID for game";
const PLAYER_REPLACED_REASON = "Replaced by a new connection";
const ROUTE_GAMES = "/games";
const ROUTE_JOIN_SUFFIX = "/join";
const HTTP_METHOD_POST = "POST";
const JSON_CONTENT_TYPE = "application/json";
const RESPONSE_ERROR_METHOD_NOT_ALLOWED = "method_not_allowed";
const RESPONSE_ERROR_NOT_FOUND = "not_found";
const RESPONSE_ERROR_BAD_REQUEST = "bad_request";

interface CreateGameHttpRequest {
  playerCount: number;
  seed?: number;
}

interface JoinGameHttpRequest {
  sessionToken?: string;
}

interface HttpBootstrapResponse {
  gameId: string;
  playerId: string;
  sessionToken: string;
}

interface HttpErrorResponse {
  error: string;
  message?: string;
}

function buildStateUpdateMessage(events: StateUpdateMessage["events"], state: StateUpdateMessage["state"]): StateUpdateMessage {
  return {
    protocolVersion: NETWORK_PROTOCOL_VERSION,
    type: SERVER_MESSAGE_STATE_UPDATE,
    events,
    state,
  };
}

function buildErrorMessage(message: string, errorCode?: string): ErrorMessage {
  return {
    protocolVersion: NETWORK_PROTOCOL_VERSION,
    type: SERVER_MESSAGE_ERROR,
    message,
    errorCode,
  };
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
    const roomId = generateRoomId(new Set(this.rooms.keys()));
    this.createGameRoomWithId(roomId, options);
    return roomId;
  }

  createGameRoomWithId(roomId: string, options: CreateGameRoomOptions): void {
    if (this.rooms.has(roomId)) {
      return;
    }

    const gameServer = createGameServer(options.seed);
    const scenarioId = options.scenarioId ?? SCENARIO_FIRST_RECONNAISSANCE;
    gameServer.initializeGame(options.playerIds, options.heroIds, scenarioId, options.config);

    const room: GameRoom = {
      id: roomId,
      gameServer,
      playerIds: new Set(options.playerIds),
      maxPlayers: options.maxPlayers ?? options.playerIds.length,
      connections: new Map(),
    };

    this.rooms.set(roomId, room);
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

    const parsedMessage = parseClientMessage(parsed);
    if (!parsedMessage.ok) {
      this.sendError(connection, parsedMessage.error.message, parsedMessage.error.code);
      return;
    }

    if (parsedMessage.message.type !== CLIENT_MESSAGE_ACTION) {
      this.sendError(connection, UNKNOWN_MESSAGE_TYPE_ERROR);
      return;
    }

    try {
      room.gameServer.handleAction(context.playerId, parsedMessage.message.action);
    } catch (error) {
      console.error(`Action processing error for ${context.playerId}:`, error);
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

  private sendError(connection: ConnectionLike, message: string, errorCode?: string): void {
    connection.send(JSON.stringify(buildErrorMessage(message, errorCode)));
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
  private readonly provisioningService: RoomProvisioningService;
  private server?: BunServerInstance;

  constructor(options: WebSocketServerOptions = {}) {
    this.port = options.port ?? DEFAULT_PORT;
    this.host = options.host ?? DEFAULT_HOST;
    this.roomManager = new GameRoomManager(options.cleanupTimeoutMs);
    this.provisioningService = new RoomProvisioningService();
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
      fetch: async (request, server): Promise<Response | undefined> => {
        const bootstrapResponse = await this.handleBootstrapHttpRequest(request);
        if (bootstrapResponse) {
          return bootstrapResponse;
        }

        const url = new URL(request.url);
        const roomId = url.searchParams.get(QUERY_GAME_ID);
        const sessionToken = url.searchParams.get(QUERY_SESSION_TOKEN);
        const playerIdFromQuery = url.searchParams.get(QUERY_PLAYER_ID);

        if (!roomId || (!sessionToken && !playerIdFromQuery)) {
          return new Response(MISSING_CONNECTION_PARAMS_MESSAGE, { status: 400 });
        }

        let playerId = playerIdFromQuery;
        if (sessionToken) {
          try {
            const session = this.provisioningService.validateSession(roomId, sessionToken);
            playerId = session.playerId;
          } catch (error) {
            if (error instanceof RoomProvisioningError) {
              return this.json(
                {
                  error: error.code,
                  message: error.message,
                },
                this.statusCodeForProvisioningError(error)
              );
            }
            return this.json(
              {
                error: RESPONSE_ERROR_BAD_REQUEST,
                message: "Failed to validate session token",
              },
              400
            );
          }
        }

        if (!playerId) {
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

  private async handleBootstrapHttpRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const isBootstrapPath = url.pathname === ROUTE_GAMES || url.pathname.startsWith(`${ROUTE_GAMES}/`);

    if (!isBootstrapPath) {
      return null;
    }

    if (request.method !== HTTP_METHOD_POST) {
      return this.json({ error: RESPONSE_ERROR_METHOD_NOT_ALLOWED }, 405);
    }

    if (url.pathname === ROUTE_GAMES) {
      return this.handleCreateGameRequest(request);
    }

    if (!url.pathname.startsWith(`${ROUTE_GAMES}/`) || !url.pathname.endsWith(ROUTE_JOIN_SUFFIX)) {
      return this.json({ error: RESPONSE_ERROR_NOT_FOUND }, 404);
    }

    const gameId = url.pathname.slice(`${ROUTE_GAMES}/`.length, -ROUTE_JOIN_SUFFIX.length);
    if (!gameId) {
      return this.json({ error: RESPONSE_ERROR_BAD_REQUEST, message: "Missing gameId in route" }, 400);
    }

    return this.handleJoinGameRequest(request, gameId);
  }

  private async handleCreateGameRequest(request: Request): Promise<Response> {
    const body = await this.readJsonBody<CreateGameHttpRequest>(request);
    if (!body.ok) {
      return this.json(
        {
          error: RESPONSE_ERROR_BAD_REQUEST,
          message: body.message,
        },
        400
      );
    }

    const { playerCount, seed } = body.value;
    if (
      playerCount !== PLAYER_COUNT_TWO &&
      playerCount !== PLAYER_COUNT_THREE &&
      playerCount !== PLAYER_COUNT_FOUR
    ) {
      return this.json(
        {
          error: ROOM_ERROR_INVALID_PLAYER_COUNT,
          message: "playerCount must be 2, 3, or 4",
        },
        400
      );
    }

    try {
      const created = this.provisioningService.createGame({ playerCount });
      this.ensureRoomForProvisionedGame(created.gameId, playerCount, seed);
      return this.json(this.toBootstrapResponse(created), 200);
    } catch (error) {
      if (error instanceof RoomProvisioningError) {
        return this.json(
          {
            error: error.code,
            message: error.message,
          },
          this.statusCodeForProvisioningError(error)
        );
      }

      return this.json({ error: RESPONSE_ERROR_BAD_REQUEST, message: "Failed to create game" }, 400);
    }
  }

  private async handleJoinGameRequest(request: Request, gameId: string): Promise<Response> {
    const body = await this.readJsonBody<JoinGameHttpRequest>(request);
    if (!body.ok) {
      return this.json(
        {
          error: RESPONSE_ERROR_BAD_REQUEST,
          message: body.message,
        },
        400
      );
    }

    try {
      const joined = this.provisioningService.joinGame(gameId, {
        sessionToken: body.value.sessionToken,
      });
      return this.json(this.toBootstrapResponse(joined), 200);
    } catch (error) {
      if (error instanceof RoomProvisioningError) {
        return this.json(
          {
            error: error.code,
            message: error.message,
          },
          this.statusCodeForProvisioningError(error)
        );
      }
      return this.json({ error: RESPONSE_ERROR_BAD_REQUEST, message: "Failed to join game" }, 400);
    }
  }

  private ensureRoomForProvisionedGame(gameId: string, playerCount: 2 | 3 | 4, seed?: number): void {
    if (this.roomManager.hasRoom(gameId)) {
      return;
    }

    const playerIds = Array.from({ length: playerCount }, (_ignored, index) => `player-${index + 1}`);
    this.roomManager.createGameRoomWithId(gameId, {
      playerIds,
      maxPlayers: playerIds.length,
      seed,
    });
  }

  private async readJsonBody<TValue extends object>(
    request: Request
  ): Promise<{ ok: true; value: TValue } | { ok: false; message: string }> {
    try {
      const raw = await request.json();
      if (typeof raw === "object" && raw !== null) {
        return { ok: true, value: raw as TValue };
      }
      return { ok: false, message: "Request body must be a JSON object" };
    } catch {
      return { ok: false, message: "Request body must be valid JSON" };
    }
  }

  private statusCodeForProvisioningError(error: RoomProvisioningError): number {
    switch (error.code) {
      case ROOM_ERROR_INVALID_PLAYER_COUNT:
        return 400;
      case ROOM_ERROR_GAME_NOT_FOUND:
        return 404;
      case ROOM_ERROR_GAME_FULL:
      case ROOM_ERROR_GAME_ALREADY_STARTED:
        return 409;
      case ROOM_ERROR_INVALID_SESSION:
        return 401;
      default:
        return 400;
    }
  }

  private toBootstrapResponse(value: HttpBootstrapResponse): HttpBootstrapResponse {
    return {
      gameId: value.gameId,
      playerId: value.playerId,
      sessionToken: value.sessionToken,
    };
  }

  private json(body: HttpErrorResponse | HttpBootstrapResponse, status: number): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        "Content-Type": JSON_CONTENT_TYPE,
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
