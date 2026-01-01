# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm lint             # Lint all packages

# Package-specific (run from package directory)
pnpm test:watch       # Watch mode for tests (core, shared)
pnpm build:esm        # Build ESM only
pnpm build:cjs        # Build CJS only
```

## Architecture

This is a pnpm monorepo implementing the Mage Knight board game with a client/server architecture.

### Package Dependency Graph

```
client → shared
server → core → shared
```

### Packages

- **@mage-knight/shared**: Types shared between client and server. Defines `PlayerAction` (discriminated union of player inputs) and `GameEvent` (discriminated union of engine outputs). Also provides `GameConnection` abstraction for local/networked play.

- **@mage-knight/core**: Pure TypeScript game engine (server-side only, never imported by client). Contains game state and rules. Exports dual ESM/CJS builds.

- **@mage-knight/server**: Thin wrapper connecting the game engine to clients via the connection abstraction. Processes actions through the engine and emits events.

- **@mage-knight/client**: Web UI (scaffold only). Sends actions, receives events through GameConnection.

### Communication Pattern

Client ↔ Server communication uses a simple action/event model:
1. Client sends `PlayerAction` to server via `GameConnection.sendAction()`
2. Server's engine processes action, returns `GameEvent[]`
3. Events are dispatched to clients via `EventCallback`

The `LocalConnection` class implements this for single-process play; networked play will implement the same `GameConnection` interface.

### Dependency Rules

- **@mage-knight/shared is the foundation** — defines types used by both client and server (`CardId`, `SkillId`, `ManaColor`, `HexCoord`, actions, events)
- **@mage-knight/core imports from shared, never the reverse**
- **Don't re-export shared types through core files** — import directly from shared where needed
- **Within core, keep import chains shallow** — one level deep is fine, avoid A → B → C → D chains
- **Branded ID types live with their domain** — `EnemyTokenId` with enemy types, `TileId` with map types, etc.
- **When in doubt, check: "if I delete this file, what breaks?"** — minimize blast radius
