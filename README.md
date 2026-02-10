# Mage Knight

[![CI](https://github.com/eshaffer321/MageKnight/actions/workflows/ci.yml/badge.svg)](https://github.com/eshaffer321/MageKnight/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/eshaffer321/MageKnight/graph/badge.svg)](https://codecov.io/gh/eshaffer321/MageKnight)

A digital implementation of the Mage Knight board game.

## Structure

```
packages/
├── core/      # Game engine (server-side only)
├── server/    # Thin wrapper: actions → engine → events
├── client/    # UI: sends actions, receives events (scaffold only)
└── shared/    # Action types, event types, data types
```

## Development

### Prerequisites

- [Bun](https://bun.sh/) >= 1.0

### Setup

```bash
bun install
git config core.hooksPath .githooks
```

The hooks configuration enables automatic asset symlinking when using git worktrees.

### Scripts

```bash
bun run build   # Build all packages
bun run test    # Run tests
bun run lint    # Run linter
bun run dev:client   # Existing local embedded-server mode
bun run dev:server   # Standalone WebSocket server + dev room
bun run dev:network  # Run server + client together
```

### Local Network Multiplayer Dev Flow

`dev:client` behavior is unchanged and still starts the local in-memory flow.

For local multiplayer iteration:

1. Run `bun run dev:network` (or run `bun run dev:server` and `bun run dev:client` separately).
2. Copy the printed `http://localhost:3000/?...` URLs from `dev:server`.
3. Open one URL per player in separate browser tabs/windows.

The client runtime mode is selected from URL params:

- Local mode (default): no mode param, or anything except `?mode=network`
- Network mode: `?mode=network&gameId=...&playerId=...`
- Optional network params:
  - `serverUrl` (default: `ws://localhost:3001`)
  - `sessionToken` (if reconnect/auth flow requires it)

## Packages

### @mage-knight/shared

Shared types and utilities used by both client and server:
- Hex coordinate types and helpers
- Terrain types and movement costs
- Game events (discriminated union)
- Player actions (discriminated union)
- Connection abstraction (local/networked)

### @mage-knight/core

Pure TypeScript game engine. Server-side only, not imported by client.

### @mage-knight/server

Server wrapper that connects the game engine to clients via the connection abstraction.

### @mage-knight/client

Web UI package (scaffold only, not yet implemented).
