import { randomUUID } from "node:crypto";

export const PLAYER_COUNT_TWO = 2 as const;
export const PLAYER_COUNT_THREE = 3 as const;
export const PLAYER_COUNT_FOUR = 4 as const;

export type PlayerCount =
  | typeof PLAYER_COUNT_TWO
  | typeof PLAYER_COUNT_THREE
  | typeof PLAYER_COUNT_FOUR;

export const ROOM_STATUS_LOBBY = "lobby" as const;
export const ROOM_STATUS_STARTED = "started" as const;

export type RoomStatus = typeof ROOM_STATUS_LOBBY | typeof ROOM_STATUS_STARTED;

export const ROOM_ERROR_INVALID_PLAYER_COUNT = "invalid_player_count" as const;
export const ROOM_ERROR_GAME_NOT_FOUND = "game_not_found" as const;
export const ROOM_ERROR_GAME_ALREADY_STARTED = "game_already_started" as const;
export const ROOM_ERROR_GAME_FULL = "game_full" as const;
export const ROOM_ERROR_INVALID_SESSION = "invalid_session" as const;

export type RoomProvisioningErrorCode =
  | typeof ROOM_ERROR_INVALID_PLAYER_COUNT
  | typeof ROOM_ERROR_GAME_NOT_FOUND
  | typeof ROOM_ERROR_GAME_ALREADY_STARTED
  | typeof ROOM_ERROR_GAME_FULL
  | typeof ROOM_ERROR_INVALID_SESSION;

export class RoomProvisioningError extends Error {
  readonly code: RoomProvisioningErrorCode;

  constructor(code: RoomProvisioningErrorCode, message: string) {
    super(message);
    this.name = "RoomProvisioningError";
    this.code = code;
  }
}

export interface CreateGameRequest {
  readonly playerCount: PlayerCount;
}

export interface CreateGameResponse {
  readonly gameId: string;
  readonly playerId: string;
  readonly sessionToken: string;
}

export interface JoinGameRequest {
  readonly sessionToken?: string;
}

export interface JoinGameResponse {
  readonly gameId: string;
  readonly playerId: string;
  readonly sessionToken: string;
}

export interface BootstrapSession {
  readonly gameId: string;
  readonly playerId: string;
  readonly sessionToken: string;
}

interface RoomPlayer {
  readonly playerId: string;
  readonly sessionToken: string;
}

interface GameRoom {
  readonly gameId: string;
  readonly playerCount: PlayerCount;
  status: RoomStatus;
  readonly players: RoomPlayer[];
}

interface SessionIndexEntry {
  readonly gameId: string;
  readonly playerId: string;
}

/**
 * In-memory room provisioning and player session bootstrap service.
 *
 * Contract:
 * - `createGame` provisions a room and allocates the creator's stable session.
 * - `joinGame` supports both first-time join (no token) and idempotent resume (token).
 * - Once `markGameStarted` is called, only existing sessions may rejoin.
 */
export class RoomProvisioningService {
  private readonly roomsById: Map<string, GameRoom> = new Map();
  private readonly sessionIndex: Map<string, SessionIndexEntry> = new Map();

  createGame(request: CreateGameRequest): CreateGameResponse {
    if (!isValidPlayerCount(request.playerCount)) {
      throw new RoomProvisioningError(
        ROOM_ERROR_INVALID_PLAYER_COUNT,
        `playerCount must be 2, 3, or 4 (received ${String(request.playerCount)})`
      );
    }

    const gameId = this.generateUniqueGameId();
    const creator = this.createRoomPlayer(1);

    const room: GameRoom = {
      gameId,
      playerCount: request.playerCount,
      status: ROOM_STATUS_LOBBY,
      players: [creator],
    };

    this.roomsById.set(gameId, room);
    this.sessionIndex.set(creator.sessionToken, {
      gameId,
      playerId: creator.playerId,
    });

    return {
      gameId,
      playerId: creator.playerId,
      sessionToken: creator.sessionToken,
    };
  }

  joinGame(gameId: string, request: JoinGameRequest = {}): JoinGameResponse {
    const room = this.roomsById.get(gameId);
    if (!room) {
      throw new RoomProvisioningError(
        ROOM_ERROR_GAME_NOT_FOUND,
        `Game ${gameId} does not exist`
      );
    }

    const sessionToken = request.sessionToken;

    if (sessionToken !== undefined) {
      const resumed = this.resumeSession(room, sessionToken);
      if (resumed) {
        return resumed;
      }

      throw new RoomProvisioningError(
        ROOM_ERROR_INVALID_SESSION,
        `Session token is invalid for game ${gameId}`
      );
    }

    if (room.status === ROOM_STATUS_STARTED) {
      throw new RoomProvisioningError(
        ROOM_ERROR_GAME_ALREADY_STARTED,
        `Game ${gameId} has already started`
      );
    }

    if (room.players.length >= room.playerCount) {
      throw new RoomProvisioningError(
        ROOM_ERROR_GAME_FULL,
        `Game ${gameId} is already full`
      );
    }

    const nextPlayerIndex = room.players.length + 1;
    const player = this.createRoomPlayer(nextPlayerIndex);
    room.players.push(player);

    this.sessionIndex.set(player.sessionToken, {
      gameId,
      playerId: player.playerId,
    });

    return {
      gameId,
      playerId: player.playerId,
      sessionToken: player.sessionToken,
    };
  }

  markGameStarted(gameId: string): void {
    const room = this.roomsById.get(gameId);
    if (!room) {
      throw new RoomProvisioningError(
        ROOM_ERROR_GAME_NOT_FOUND,
        `Game ${gameId} does not exist`
      );
    }

    room.status = ROOM_STATUS_STARTED;
  }

  validateSession(gameId: string, sessionToken: string): BootstrapSession {
    const room = this.roomsById.get(gameId);
    if (!room) {
      throw new RoomProvisioningError(
        ROOM_ERROR_GAME_NOT_FOUND,
        `Game ${gameId} does not exist`
      );
    }

    const resumed = this.resumeSession(room, sessionToken);
    if (!resumed) {
      throw new RoomProvisioningError(
        ROOM_ERROR_INVALID_SESSION,
        `Session token is invalid for game ${gameId}`
      );
    }

    return resumed;
  }

  getRoomStatus(gameId: string): RoomStatus {
    const room = this.roomsById.get(gameId);
    if (!room) {
      throw new RoomProvisioningError(
        ROOM_ERROR_GAME_NOT_FOUND,
        `Game ${gameId} does not exist`
      );
    }

    return room.status;
  }

  getRoomPlayerIds(gameId: string): readonly string[] {
    const room = this.roomsById.get(gameId);
    if (!room) {
      throw new RoomProvisioningError(
        ROOM_ERROR_GAME_NOT_FOUND,
        `Game ${gameId} does not exist`
      );
    }

    return room.players.map((player) => player.playerId);
  }

  private resumeSession(room: GameRoom, sessionToken: string): JoinGameResponse | null {
    const session = this.sessionIndex.get(sessionToken);
    if (!session || session.gameId !== room.gameId) {
      return null;
    }

    const existingPlayer = room.players.find((player) => player.playerId === session.playerId);
    if (!existingPlayer) {
      return null;
    }

    return {
      gameId: room.gameId,
      playerId: existingPlayer.playerId,
      sessionToken: existingPlayer.sessionToken,
    };
  }

  private generateUniqueGameId(): string {
    let candidate = createGameId();
    while (this.roomsById.has(candidate)) {
      candidate = createGameId();
    }
    return candidate;
  }

  private createRoomPlayer(playerNumber: number): RoomPlayer {
    return {
      playerId: `player-${playerNumber}`,
      sessionToken: randomUUID(),
    };
  }
}

function isValidPlayerCount(playerCount: number): playerCount is PlayerCount {
  return (
    playerCount === PLAYER_COUNT_TWO ||
    playerCount === PLAYER_COUNT_THREE ||
    playerCount === PLAYER_COUNT_FOUR
  );
}

function createGameId(): string {
  const id = randomUUID().replaceAll("-", "").slice(0, 10);
  return `g_${id}`;
}
