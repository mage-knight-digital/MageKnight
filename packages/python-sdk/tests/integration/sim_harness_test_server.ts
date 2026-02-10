import { randomUUID } from "node:crypto";

import { createWebSocketGameServer } from "../../../server/src/WebSocketServer.ts";

interface RoomSession {
  playerId: string;
  sessionToken: string;
}

interface RoomRecord {
  gameId: string;
  playerCount: number;
  sessionsByToken: Map<string, RoomSession>;
  sessionsByPlayerId: Map<string, RoomSession>;
  nextPlayerNumber: number;
}

const host = "127.0.0.1";

const wsServer = createWebSocketGameServer({ host, port: 0 });
wsServer.start();

const roomsById = new Map<string, RoomRecord>();

const httpServer = Bun.serve({
  hostname: host,
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    if (url.pathname === "/games") {
      return handleCreateGame(request);
    }

    const joinMatch = url.pathname.match(/^\/games\/([^/]+)\/join$/);
    if (joinMatch) {
      return handleJoinGame(request, joinMatch[1]);
    }

    return json({ error: "not_found" }, 404);
  },
});

function parseJson(request: Request): Promise<Record<string, unknown>> {
  return request.json().catch(() => ({}));
}

async function handleCreateGame(request: Request): Promise<Response> {
  const body = await parseJson(request);
  const playerCount = body.playerCount;
  const seed = body.seed;

  if (playerCount !== 2 && playerCount !== 3 && playerCount !== 4) {
    return json({ error: "invalid_player_count" }, 400);
  }

  const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i + 1}`);
  const gameId = wsServer.createGameRoom({
    playerIds,
    maxPlayers: playerCount,
    seed: typeof seed === "number" ? seed : undefined,
  });

  const creatorSession: RoomSession = {
    playerId: playerIds[0],
    sessionToken: randomUUID(),
  };

  const room: RoomRecord = {
    gameId,
    playerCount,
    sessionsByToken: new Map([[creatorSession.sessionToken, creatorSession]]),
    sessionsByPlayerId: new Map([[creatorSession.playerId, creatorSession]]),
    nextPlayerNumber: 2,
  };
  roomsById.set(gameId, room);

  return json({
    gameId,
    playerId: creatorSession.playerId,
    sessionToken: creatorSession.sessionToken,
  });
}

async function handleJoinGame(request: Request, gameId: string): Promise<Response> {
  const room = roomsById.get(gameId);
  if (!room) {
    return json({ error: "game_not_found" }, 404);
  }

  const body = await parseJson(request);
  const sessionToken = body.sessionToken;

  if (typeof sessionToken === "string") {
    const resumed = room.sessionsByToken.get(sessionToken);
    if (!resumed) {
      return json({ error: "invalid_session" }, 400);
    }

    return json({
      gameId,
      playerId: resumed.playerId,
      sessionToken: resumed.sessionToken,
    });
  }

  if (room.nextPlayerNumber > room.playerCount) {
    return json({ error: "game_full" }, 409);
  }

  const session: RoomSession = {
    playerId: `player-${room.nextPlayerNumber}`,
    sessionToken: randomUUID(),
  };

  room.nextPlayerNumber += 1;
  room.sessionsByToken.set(session.sessionToken, session);
  room.sessionsByPlayerId.set(session.playerId, session);

  return json({
    gameId,
    playerId: session.playerId,
    sessionToken: session.sessionToken,
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

console.log(
  JSON.stringify({
    wsPort: wsServer.getPort(),
    apiPort: httpServer.port,
  })
);

const shutdown = (): void => {
  httpServer.stop();
  wsServer.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

setInterval(() => {
  // Keep process alive for integration tests.
}, 1000);
