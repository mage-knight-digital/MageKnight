import { createWebSocketGameServer } from "../../../server/src/WebSocketServer.ts";

const server = createWebSocketGameServer({ host: "127.0.0.1", port: 0 });
server.start();

const gameId = server.createGameRoom({
  playerIds: ["player-1", "player-2"],
  maxPlayers: 2,
});

const payload = {
  port: server.getPort(),
  gameId,
  playerId: "player-1",
};

console.log(JSON.stringify(payload));

const shutdown = (): void => {
  server.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

setInterval(() => {
  // Keep process alive for integration tests.
}, 1000);
