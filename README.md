# Mage Knight

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

- Node.js >= 20
- pnpm >= 9

### Setup

```bash
pnpm install
```

### Scripts

```bash
pnpm build   # Build all packages
pnpm test    # Run tests
pnpm lint    # Run linter
```

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
