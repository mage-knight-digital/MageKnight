#!/usr/bin/env bun

import { createWebSocketGameServer } from "./src/index.js";

const PORT_ENV = "PORT";
const HOST_ENV = "HOST";
const CLIENT_HOST_ENV = "CLIENT_HOST";
const PLAYER_IDS_ENV = "PLAYER_IDS";
const DEFAULT_PORT = 3001;
const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_CLIENT_HOST = "localhost";
const DEFAULT_PLAYER_IDS = ["player1", "player2"];

function parsePlayerIds(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [...DEFAULT_PLAYER_IDS];
  }

  const ids = rawValue
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return ids.length > 0 ? ids : [...DEFAULT_PLAYER_IDS];
}

const portFromEnv = Number.parseInt(Bun.env[PORT_ENV] ?? "", 10);
const port = Number.isNaN(portFromEnv) ? DEFAULT_PORT : portFromEnv;
const host = Bun.env[HOST_ENV] ?? DEFAULT_HOST;
const clientHost = Bun.env[CLIENT_HOST_ENV] ?? DEFAULT_CLIENT_HOST;
const playerIds = parsePlayerIds(Bun.env[PLAYER_IDS_ENV]);

const webSocketServer = createWebSocketGameServer({ host, port });
webSocketServer.start();

const gameId = webSocketServer.createGameRoom({
  playerIds,
  maxPlayers: playerIds.length,
});
const serverUrl = `ws://${clientHost}:${webSocketServer.getPort()}`;

console.log(`WebSocket dev server listening on ws://${host}:${webSocketServer.getPort()}`);
console.log(`Created local dev room gameId=${gameId} players=${playerIds.join(",")}`);
console.log("Open one URL per player:");
for (const playerId of playerIds) {
  const params = new URLSearchParams({
    mode: "network",
    serverUrl,
    gameId,
    playerId,
  });
  console.log(`http://localhost:3000/?${params.toString()}`);
}

const shutdown = (): void => {
  webSocketServer.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

