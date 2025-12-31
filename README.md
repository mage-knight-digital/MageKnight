# Mage Knight

A digital implementation of the Mage Knight board game.

## Structure

```
packages/
├── core/    # Pure game logic, no UI dependencies
└── ui/      # Web UI (scaffold only)
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

### @mage-knight/core

Pure TypeScript game logic with no UI dependencies. Compiles to both ESM and CJS.

### @mage-knight/ui

Web UI package (scaffold only, not yet implemented).
