import { describe, it, expect } from "vitest";
import {
  RoomProvisioningService,
  RoomProvisioningError,
  PLAYER_COUNT_TWO,
  PLAYER_COUNT_FOUR,
  ROOM_STATUS_LOBBY,
  ROOM_STATUS_STARTED,
  ROOM_ERROR_GAME_ALREADY_STARTED,
  ROOM_ERROR_GAME_FULL,
  ROOM_ERROR_GAME_NOT_FOUND,
  ROOM_ERROR_INVALID_PLAYER_COUNT,
  ROOM_ERROR_INVALID_SESSION,
} from "../index.js";

describe("RoomProvisioningService", () => {
  it("creates a game and returns creator bootstrap session", () => {
    const service = new RoomProvisioningService();

    const created = service.createGame({ playerCount: PLAYER_COUNT_TWO });

    expect(created.gameId).toMatch(/^g_[a-z0-9]{10}$/);
    expect(created.playerId).toBe("player-1");
    expect(created.sessionToken.length).toBeGreaterThan(0);
    expect(service.getRoomStatus(created.gameId)).toBe(ROOM_STATUS_LOBBY);
    expect(service.getRoomPlayerIds(created.gameId)).toEqual(["player-1"]);
  });

  it("rejects invalid player counts", () => {
    const service = new RoomProvisioningService();

    expect(() =>
      service.createGame({ playerCount: 5 as 2 | 3 | 4 })
    ).toThrowError(
      expect.objectContaining<Partial<RoomProvisioningError>>({
        code: ROOM_ERROR_INVALID_PLAYER_COUNT,
      })
    );
  });

  it("joins in lobby and returns stable resume identity for session token", () => {
    const service = new RoomProvisioningService();
    const created = service.createGame({ playerCount: PLAYER_COUNT_TWO });

    const joined = service.joinGame(created.gameId);
    const resumed = service.joinGame(created.gameId, {
      sessionToken: joined.sessionToken,
    });

    expect(joined.playerId).toBe("player-2");
    expect(resumed).toEqual(joined);
    expect(service.getRoomPlayerIds(created.gameId)).toEqual([
      "player-1",
      "player-2",
    ]);
  });

  it("is idempotent for repeated creator join with same token", () => {
    const service = new RoomProvisioningService();
    const created = service.createGame({ playerCount: PLAYER_COUNT_TWO });

    const joined = service.joinGame(created.gameId, {
      sessionToken: created.sessionToken,
    });
    const joinedAgain = service.joinGame(created.gameId, {
      sessionToken: created.sessionToken,
    });

    expect(joined.playerId).toBe("player-1");
    expect(joinedAgain).toEqual(joined);
    expect(service.getRoomPlayerIds(created.gameId)).toEqual(["player-1"]);
  });

  it("rejects late new join once room is full", () => {
    const service = new RoomProvisioningService();
    const created = service.createGame({ playerCount: PLAYER_COUNT_TWO });

    service.joinGame(created.gameId);

    expect(() => service.joinGame(created.gameId)).toThrowError(
      expect.objectContaining<Partial<RoomProvisioningError>>({
        code: ROOM_ERROR_GAME_FULL,
      })
    );
  });

  it("rejects late new join after game started, but allows resume by existing session", () => {
    const service = new RoomProvisioningService();
    const created = service.createGame({ playerCount: PLAYER_COUNT_FOUR });
    const joined = service.joinGame(created.gameId);

    service.markGameStarted(created.gameId);

    expect(service.getRoomStatus(created.gameId)).toBe(ROOM_STATUS_STARTED);

    expect(() => service.joinGame(created.gameId)).toThrowError(
      expect.objectContaining<Partial<RoomProvisioningError>>({
        code: ROOM_ERROR_GAME_ALREADY_STARTED,
      })
    );

    const resumedCreator = service.joinGame(created.gameId, {
      sessionToken: created.sessionToken,
    });
    const resumedJoiner = service.joinGame(created.gameId, {
      sessionToken: joined.sessionToken,
    });

    expect(resumedCreator.playerId).toBe("player-1");
    expect(resumedJoiner.playerId).toBe("player-2");
  });

  it("returns clear errors for invalid game id and invalid session token", () => {
    const service = new RoomProvisioningService();
    const created = service.createGame({ playerCount: PLAYER_COUNT_TWO });

    expect(() => service.joinGame("g_missing")).toThrowError(
      expect.objectContaining<Partial<RoomProvisioningError>>({
        code: ROOM_ERROR_GAME_NOT_FOUND,
      })
    );

    expect(() =>
      service.joinGame(created.gameId, { sessionToken: "not-a-valid-token" })
    ).toThrowError(
      expect.objectContaining<Partial<RoomProvisioningError>>({
        code: ROOM_ERROR_INVALID_SESSION,
      })
    );
  });

  it("validates ws/session bootstrap via validateSession", () => {
    const service = new RoomProvisioningService();
    const created = service.createGame({ playerCount: PLAYER_COUNT_TWO });

    const session = service.validateSession(created.gameId, created.sessionToken);

    expect(session).toEqual({
      gameId: created.gameId,
      playerId: created.playerId,
      sessionToken: created.sessionToken,
    });
  });
});
