import { describe, it, expect } from "vitest";
import {
  CLIENT_MESSAGE_ACTION,
  CLOSE_CODE_INVALID_REQUEST,
  GameRoomManager,
  SERVER_MESSAGE_ERROR,
  SERVER_MESSAGE_STATE_UPDATE,
  type ConnectionLike,
  type ErrorMessage,
  type ServerMessage,
  type StateUpdateMessage,
} from "../WebSocketServer.js";
import {
  END_TURN_ACTION,
  NETWORK_PROTOCOL_VERSION,
  PROTOCOL_PARSE_ERROR_UNSUPPORTED_VERSION,
  parseServerMessage,
} from "@mage-knight/shared";

class FakeConnection implements ConnectionLike {
  readonly sentMessages: string[] = [];
  readonly closeCalls: Array<{ code?: number; reason?: string }> = [];

  send(message: string): number {
    this.sentMessages.push(message);
    return message.length;
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
  }
}

function parseMessage(rawMessage: string): ServerMessage {
  const parsed = parseServerMessage(JSON.parse(rawMessage));
  if (!parsed.ok) {
    throw new Error(`Invalid server message in test: ${parsed.error.message}`);
  }

  return parsed.message;
}

function findLastMessageOfType<TMessage extends ServerMessage>(
  connection: FakeConnection,
  type: TMessage["type"]
): TMessage {
  for (let index = connection.sentMessages.length - 1; index >= 0; index -= 1) {
    const message = parseMessage(connection.sentMessages[index] as string);
    if (message.type === type) {
      return message as TMessage;
    }
  }

  throw new Error(`No message found for type: ${type}`);
}

describe("GameRoomManager", () => {
  it("creates a unique room id for each game", () => {
    const manager = new GameRoomManager();
    const roomIdOne = manager.createGameRoom({ playerIds: ["player1"] });
    const roomIdTwo = manager.createGameRoom({ playerIds: ["player1"] });

    expect(roomIdOne).not.toBe(roomIdTwo);
    expect(manager.hasRoom(roomIdOne)).toBe(true);
    expect(manager.hasRoom(roomIdTwo)).toBe(true);
  });

  it("routes actions in a room and broadcasts filtered state", () => {
    const manager = new GameRoomManager();
    const roomId = manager.createGameRoom({ playerIds: ["player1", "player2"] });
    const playerOneConnection = new FakeConnection();
    const playerTwoConnection = new FakeConnection();

    manager.handleConnectionOpen(playerOneConnection, roomId, "player1");
    manager.handleConnectionOpen(playerTwoConnection, roomId, "player2");

    playerOneConnection.sentMessages.length = 0;
    playerTwoConnection.sentMessages.length = 0;

    manager.handleConnectionMessage(
      playerOneConnection,
      JSON.stringify({
        protocolVersion: NETWORK_PROTOCOL_VERSION,
        type: CLIENT_MESSAGE_ACTION,
        action: { type: END_TURN_ACTION },
      })
    );

    const playerOneUpdate = findLastMessageOfType<StateUpdateMessage>(
      playerOneConnection,
      SERVER_MESSAGE_STATE_UPDATE
    );
    const playerTwoUpdate = findLastMessageOfType<StateUpdateMessage>(
      playerTwoConnection,
      SERVER_MESSAGE_STATE_UPDATE
    );

    const playerOneInOwnState = playerOneUpdate.state.players.find((player) => player.id === "player1");
    const playerTwoInOwnState = playerTwoUpdate.state.players.find((player) => player.id === "player2");
    const playerTwoInPlayerOneState = playerOneUpdate.state.players.find(
      (player) => player.id === "player2"
    );

    expect(Array.isArray(playerOneInOwnState?.hand)).toBe(true);
    expect(Array.isArray(playerTwoInOwnState?.hand)).toBe(true);
    expect(typeof playerTwoInPlayerOneState?.hand).toBe("number");
  });

  it("returns error and closes when room id is invalid", () => {
    const manager = new GameRoomManager();
    const connection = new FakeConnection();

    manager.handleConnectionOpen(connection, "bad-room", "player1");

    const message = findLastMessageOfType<ErrorMessage>(connection, SERVER_MESSAGE_ERROR);
    expect(message.message).toContain("Invalid game ID");
    expect(connection.closeCalls).toHaveLength(1);
    expect(connection.closeCalls[0]?.code).toBe(CLOSE_CODE_INVALID_REQUEST);
  });

  it("returns game full when room reaches capacity", () => {
    const manager = new GameRoomManager();
    const roomId = manager.createGameRoom({
      playerIds: ["player1", "player2"],
      maxPlayers: 1,
    });

    const playerOneConnection = new FakeConnection();
    const playerTwoConnection = new FakeConnection();

    manager.handleConnectionOpen(playerOneConnection, roomId, "player1");
    manager.handleConnectionOpen(playerTwoConnection, roomId, "player2");

    const errorMessage = findLastMessageOfType<ErrorMessage>(playerTwoConnection, SERVER_MESSAGE_ERROR);
    expect(errorMessage.message).toContain("Game is full");
    expect(playerTwoConnection.closeCalls).toHaveLength(1);
    expect(playerTwoConnection.closeCalls[0]?.code).toBe(CLOSE_CODE_INVALID_REQUEST);
  });

  it("returns error for invalid JSON", () => {
    const manager = new GameRoomManager();
    const roomId = manager.createGameRoom({ playerIds: ["player1"] });
    const connection = new FakeConnection();

    manager.handleConnectionOpen(connection, roomId, "player1");
    connection.sentMessages.length = 0;

    manager.handleConnectionMessage(connection, "not valid json");

    const errorMessage = findLastMessageOfType<ErrorMessage>(connection, SERVER_MESSAGE_ERROR);
    expect(errorMessage.message).toContain("Invalid JSON");
  });

  it("removes empty room after timeout", async () => {
    const manager = new GameRoomManager(10);
    const roomId = manager.createGameRoom({ playerIds: ["player1"] });
    const connection = new FakeConnection();

    manager.handleConnectionOpen(connection, roomId, "player1");
    manager.handleConnectionClose(connection);

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(manager.hasRoom(roomId)).toBe(false);
  });

  it("returns protocol error for unsupported protocol versions", () => {
    const manager = new GameRoomManager();
    const roomId = manager.createGameRoom({ playerIds: ["player1"] });
    const connection = new FakeConnection();

    manager.handleConnectionOpen(connection, roomId, "player1");
    connection.sentMessages.length = 0;

    manager.handleConnectionMessage(
      connection,
      JSON.stringify({
        protocolVersion: "9.9.9",
        type: CLIENT_MESSAGE_ACTION,
        action: { type: END_TURN_ACTION },
      })
    );

    const errorMessage = findLastMessageOfType<ErrorMessage>(connection, SERVER_MESSAGE_ERROR);
    expect(errorMessage.errorCode).toBe(PROTOCOL_PARSE_ERROR_UNSUPPORTED_VERSION);
  });
});
