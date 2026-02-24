# Mage Knight

[![CI](https://github.com/eshaffer321/MageKnight/actions/workflows/ci.yml/badge.svg)](https://github.com/eshaffer321/MageKnight/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/eshaffer321/MageKnight/graph/badge.svg)](https://codecov.io/gh/eshaffer321/MageKnight)

A digital implementation of the Mage Knight board game, built with a Rust game engine and React client.

## Structure

```
packages/
├── engine-rs/         # Rust game engine (primary — 6-crate workspace)
│   ├── crates/
│   │   ├── mk-types/      # Core types (IDs, enums, state, effects, modifiers)
│   │   ├── mk-data/       # Static card/enemy/unit/skill/site data
│   │   ├── mk-engine/     # Game logic (actions, combat, effects, validation)
│   │   ├── mk-features/   # RL feature extraction (state/action encoding, PyO3)
│   │   ├── mk-env/        # Vectorized RL environment (Rayon parallelism)
│   │   └── mk-python/     # PyO3 bindings
│   └── tools/
│       ├── mk-cli/        # CLI game runner (random/human play modes)
│       └── mk-server/     # WebSocket server for client communication
├── client/            # React UI (hex map, cards, action menus)
├── shared/            # TS types shared between client and server
├── python-sdk/        # RL training (PPO, REINFORCE, game viewer)
└── mage-dev/          # Dev tooling (trace generation, debugging)
```

## Development

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Bun](https://bun.sh/) >= 1.0 (for client and shared types)
- Python 3.10+ (for RL training, optional)

### Setup

```bash
bun install
git config core.hooksPath .githooks
```

### Rust Engine

```bash
cd packages/engine-rs
cargo check            # Verify compilation
cargo test             # Run all tests (~2100 tests)
cargo clippy           # Lint
```

### Client + Server

```bash
bun run dev            # Start Rust WebSocket server + React client
bun run cli            # Run CLI game (release mode)
```

### RL Training

```bash
cd packages/python-sdk
source .venv/bin/activate
bun run train-rl       # Start RL training
bun run tensorboard    # View training metrics
bun run viewer         # Game replay viewer
```

## Architecture

### Rust Engine (`packages/engine-rs/`)

The primary game engine is a 6-crate Rust workspace:

```
mk-types → mk-data → mk-engine → mk-features → mk-env → mk-python
```

- **mk-types**: Core types — IDs (branded newtypes), enums (terrain, mana, phases), game state, player state, combat state, effects, modifiers, hex coordinates, RNG (Mulberry32, seed-parity with TS)
- **mk-data**: Static game data — 70+ card definitions, 31 unit definitions, 100+ enemy definitions, 70 skill definitions, 25 artifact cards, 24 spells, site properties, tile layouts, ruins tokens
- **mk-engine**: Game logic — action pipeline, effect queue, combat (4-phase), movement, mana, undo, valid actions enumeration, card playability, site interactions, cooperative assaults
- **mk-features**: RL integration — state/action encoding, vocab tables, mode/source derivation, PyO3 `GameEngine` class
- **mk-env**: Vectorized environment for parallel RL training via Rayon
- **mk-python**: PyO3 module exposing the engine to Python

### Client Communication

1. Client sends `PlayerAction` → Rust WebSocket server (`mk-server`)
2. Server validates, executes action, computes legal actions
3. Filtered state + legal actions sent to client
4. Client renders React UI with hex map, card display, action menus
