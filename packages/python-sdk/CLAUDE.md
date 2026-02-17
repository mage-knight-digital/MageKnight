# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The python-sdk is a Python WebSocket client for Mage Knight's multiplayer protocol. It's part of the larger MageKnight monorepo but operates as a standalone Python package with its own environment and build system.

## Setup & Development

### Initial Setup

```bash
cd packages/python-sdk
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
python3 -m pip install -e ".[rl,viewer]"
```

### Common Commands

```bash
# Run unit tests
python3 -m unittest discover -s tests -p 'test_*.py'

# Run a single test file
python3 -m unittest tests.test_client

# Run a specific test
python3 -m unittest tests.test_client.MageKnightClientUnitTest.test_send_lobby_subscribe_omits_null_session_token

# Regenerate protocol models from schemas (run when shared schemas change)
source .venv/bin/activate
python3 scripts/generate_protocol_models.py

# Check integration with server (requires local Mage Knight server running on port 3001)
python3 -m unittest discover -s tests/integration -p 'test_*.py'
```

### CLI Entry Points

After `pip install -e .`:

```bash
mage-knight-run-game --seed 42 --max-steps 5000 --no-undo
mage-knight-run-sweep --start-seed 1 --count 100 --benchmark --no-undo
mage-knight-scan-fame --artifacts-dir ./sim-artifacts
mage-knight-viewer  # Launch artifact viewer web server
mage-knight-train-rl --episodes 1000 --seed 1 --player-count 1 --no-undo
mage-knight-import-tb /path/to/training_log.ndjson
```

Or via module execution:

```bash
python3 -m mage_knight_sdk.cli.run_game --seed 42
python3 -m mage_knight_sdk.cli.run_sweep --start-seed 1 --count 100
python3 -m mage_knight_sdk.tools.scan_fame --artifacts-dir ./sim-artifacts
python3 -m mage_knight_sdk.cli.train_rl --episodes 1000 --seed 1
python3 -m mage_knight_sdk.tools.import_tensorboard /path/to/training_log.ndjson
```

## Architecture

### Package Layers

```
┌─────────────────────────────────────────┐
│  CLI / Tools                            │
│  cli/run_game.py, cli/run_sweep.py      │
│  tools/scan_fame.py                     │
├─────────────────────────────────────────┤
│  Simulation Harness                     │
│  sim/runner.py (orchestration)          │
│  sim/policy.py (Policy protocol)        │
│  sim/config.py, stall_detector.py,      │
│  diagnostics.py, state_utils.py,        │
│  invariants.py, reporting.py,           │
│  bootstrap.py, random_policy.py         │
├─────────────────────────────────────────┤
│  Core SDK                               │
│  client.py (WebSocket)                  │
│  protocol.py (message parsing)          │
│  protocol_models.py (generated types)   │
│  action_constants.py (generated)        │
├─────────────────────────────────────────┤
│  Viewer (optional Flask app)            │
│  viewer/server.py, ndjson_index.py,     │
│  states_index.py                        │
└─────────────────────────────────────────┘
```

### Core Components

**Client** (`src/mage_knight_sdk/client.py`):
- `MageKnightClient` — async WebSocket client with async context manager support
- Connection state management with `connecting`, `connected`, `reconnecting`, `disconnected`, `error` states
- Exponential backoff reconnection logic (configurable delays and max attempts)
- Two async iterators: `messages()` for server messages and `state_changes()` for connection state events

**Protocol** (`src/mage_knight_sdk/protocol.py`):
- Message parsing and serialization (client-to-server and server-to-client)
- Runtime validation against network protocol version
- Error types: `ProtocolParseError` (with error codes) and `ProtocolValidationError`
- Functions: `parse_server_message()`, `serialize_client_message()`, `validate_action_payload()`

**Protocol Models** (`src/mage_knight_sdk/protocol_models.py`):
- **Generated file** — do not edit manually
- Typed dataclasses for all message types
- `NETWORK_PROTOCOL_VERSION` constant (source of truth for protocol compatibility)

### Simulation Harness (`sim/`)

**Policy** (`sim/policy.py`):
- `Policy` — `typing.Protocol` for action selection (structural typing, no inheritance required)
- `RandomPolicy` — reference implementation, uniform random selection
- Interface: `choose_action(state, player_id, valid_actions, rng) -> CandidateAction | None`
- Custom policies (RL, heuristic) implement the same interface

**Runner** (`sim/runner.py`):
- `run_simulations(config, policy=None)` — main entry point (async)
- `run_simulations_sync(config, policy=None)` — sync wrapper
- Orchestrates multi-player games: bootstrap → connect → action loop → finalize
- Accepts any `Policy` implementation (defaults to `RandomPolicy`)

**Config** (`sim/config.py`):
- `RunnerConfig` — frozen dataclass with all simulation parameters
- `AgentRuntime` — mutable per-player state during a simulation
- `SimulationOutcome` — result + trace + messages

**Stall Detector** (`sim/stall_detector.py`):
- `StallDetector` — detects infinite loops (draw pile unchanged for N turns)
- Requires ALL players to be stalled before reporting (multiplayer-safe)

**Diagnostics** (`sim/diagnostics.py`):
- `build_timeout_diagnostics()` — structured timeout/stall diagnostic data
- Dual output: human-readable string + JSON for artifacts

**State Utilities** (`sim/state_utils.py`):
- `mode(state)` — extract validActions mode
- `action_key(action)` — stable JSON key for deduplication
- `draw_pile_count_for_player(state, player_id)` — extract deck count
- `player_ids_from_state(state)` — extract player IDs

**Action Enumeration** (`sim/random_policy.py`):
- `enumerate_valid_actions(state, player_id)` — wrapper around generated enumerator
- Used by runner, diagnostics, and tests

**Other modules**: `bootstrap.py` (HTTP game creation/joining), `invariants.py` (state validation), `reporting.py` (results, NDJSON summaries, artifact writing)

### CLI (`cli/`)

- `cli/run_game.py` — run a single full game (`mage-knight-run-game`)
- `cli/run_sweep.py` — run a seed range with benchmarking (`mage-knight-run-sweep`)
- `cli/train_rl.py` — train an RL agent via REINFORCE/Actor-Critic (`mage-knight-train-rl`)

### Tools (`tools/`)

- `tools/scan_fame.py` — scan artifacts for games with fame > 0 (`mage-knight-scan-fame`)
- `tools/import_tensorboard.py` — import existing NDJSON training logs into TensorBoard format (`mage-knight-import-tb`)

### RL Training (`sim/rl/`)

REINFORCE with Actor-Critic baseline for training a game-playing agent. Optional dependency (`pip install -e '.[rl]'`).

**Key modules:**
- `policy_gradient.py` — `ReinforcePolicy` (policy network + value head), `PolicyGradientConfig`
- `trainer.py` — `ReinforceTrainer` (per-episode hooks, optimization)
- `distributed_trainer.py` — `DistributedReinforceTrainer` (data-parallel gradient accumulation across worker processes)
- `features.py` — State/action feature encoding with optional entity embeddings
- `rewards.py` — `RewardConfig` for reward shaping components
- `vocabularies.py` — Entity ID vocabularies for embedding lookups

**Training:**
```bash
# Sequential training (single process)
mage-knight-train-rl --episodes 1000 --seed 1 --player-count 1 --no-undo \
  --checkpoint-dir /tmp/rl-run

# Distributed training (4 workers, 4 episodes each before gradient sync)
mage-knight-train-rl --episodes 100000 --seed 1 --player-count 1 --no-undo \
  --workers 4 --episodes-per-sync 4 --hidden-size 512 \
  --checkpoint-dir /tmp/rl-run

# Resume from checkpoint
mage-knight-train-rl --episodes 50000 --resume /tmp/rl-run/policy_final.pt \
  --player-count 1 --no-undo --workers 4 --episodes-per-sync 4

# Save replays for high-reward games
mage-knight-train-rl --episodes 100000 --save-top-games 5.0 ...
```

### TensorBoard

Training automatically logs to TensorBoard when `tensorboard` is installed (included in `.[rl]` extras).

**Metrics logged:** `reward/total`, `reward/fame`, `episode/steps`, `episode/fame_binary`, `optimization/loss`, `optimization/entropy`, `optimization/critic_loss`, `optimization/action_count`

```bash
# TensorBoard logs are at {checkpoint-dir}/tensorboard/
# Launch dashboard:
tensorboard --logdir /tmp/rl-run/tensorboard

# Import existing NDJSON training logs (for runs started before TB was added):
mage-knight-import-tb /tmp/rl-run/training_log.ndjson
# Writes to /tmp/rl-run/tensorboard/ by default, or specify --logdir
```

### Viewer (`viewer/`)

Flask web app for inspecting simulation artifacts. Optional dependency (`pip install -e '.[viewer]'`).

### Protocol Flow

1. Client connects via `MageKnightClient(server_url, game_id, player_id)`
2. Client can subscribe to lobby updates with `send_lobby_subscribe()`
3. Client sends game actions with `send_action(action_dict)`
4. Server responds with `state_update` (events + filtered game state) or `error` messages
5. Client streams messages via `async for msg in client.messages()` and state changes via `async for state in client.state_changes()`

### Generated Code

Three generators in `scripts/` produce code from shared JSON schemas:

| Generator | Output | Trigger |
|-----------|--------|---------|
| `generate_protocol_models.py` | `protocol_models.py` | Shared schemas change |
| `generate_actions.py` | `action_constants.py` | Player action schema changes |
| `generate_action_enumerator.py` | `sim/generated_action_enumerator.py` | ValidActions schema changes |

**Never manually edit generated files.** Regenerate after schema changes:
```bash
python3 scripts/generate_protocol_models.py
python3 scripts/generate_actions.py
python3 scripts/generate_action_enumerator.py
```

## Key Gotchas

### Virtual Environment
- Always activate the venv before running tests or scripts: `source .venv/bin/activate`
- Tests import from the monorepo root to access shared schemas for code generation

### Protocol Version Mismatch
- The client validates `protocolVersion` in all messages
- If the server uses a different version, parsing fails with `ProtocolParseError` (code: `unsupported_version`)
- `NETWORK_PROTOCOL_VERSION` in `protocol_models.py` is the source of truth — regenerate when shared schemas change

### Reconnection Backoff
- Default: `0.5s` base delay, exponential backoff (2^attempt), max 5 attempts
- Configurable via `MageKnightClient(reconnect_base_delay=..., max_reconnect_attempts=...)`
- Failed reconnection after max attempts emits `CONNECTION_STATUS_ERROR` state

### Null Session Tokens
- `session_token` is optional for resuming sessions
- When None, it's omitted from `lobby_subscribe` messages (not sent as null)

## Testing

### Unit Tests (`tests/`)
- `test_client.py` — client behavior with `_FakeWebSocket` mock
- `test_sim_stall_detector.py` — stall detection logic
- `test_sim_random_policy.py` — action enumeration from state

### Integration Tests (`tests/integration/`)
- Require running a test WebSocket server (`ws_test_server.ts`, `sim_harness_test_server.ts`)
- Test full message parsing, simulation runner, reconnection

## File Reference

| Path | Purpose |
|------|---------|
| `src/mage_knight_sdk/client.py` | WebSocket client and connection state management |
| `src/mage_knight_sdk/protocol.py` | Message parsing, serialization, and validation |
| `src/mage_knight_sdk/protocol_models.py` | **Generated** typed message dataclasses |
| `src/mage_knight_sdk/action_constants.py` | **Generated** action type constants |
| `src/mage_knight_sdk/sim/runner.py` | Simulation orchestration loop |
| `src/mage_knight_sdk/sim/policy.py` | Policy protocol + RandomPolicy |
| `src/mage_knight_sdk/sim/config.py` | RunnerConfig, AgentRuntime, SimulationOutcome |
| `src/mage_knight_sdk/sim/stall_detector.py` | Draw pile stall detection |
| `src/mage_knight_sdk/sim/diagnostics.py` | Timeout diagnostic reporting |
| `src/mage_knight_sdk/sim/state_utils.py` | State extraction helpers |
| `src/mage_knight_sdk/sim/random_policy.py` | enumerate_valid_actions wrapper |
| `src/mage_knight_sdk/sim/invariants.py` | State invariant checking |
| `src/mage_knight_sdk/sim/reporting.py` | Results, summaries, artifact writing |
| `src/mage_knight_sdk/sim/bootstrap.py` | HTTP game creation/joining |
| `src/mage_knight_sdk/sim/generated_action_enumerator.py` | **Generated** valid action enumeration |
| `src/mage_knight_sdk/sim/rl/policy_gradient.py` | ReinforcePolicy, Actor-Critic network |
| `src/mage_knight_sdk/sim/rl/trainer.py` | Per-episode training hooks |
| `src/mage_knight_sdk/sim/rl/distributed_trainer.py` | Data-parallel distributed training |
| `src/mage_knight_sdk/sim/rl/features.py` | State/action feature encoding |
| `src/mage_knight_sdk/sim/rl/rewards.py` | Reward configuration |
| `src/mage_knight_sdk/sim/rl/vocabularies.py` | Entity ID vocabularies for embeddings |
| `src/mage_knight_sdk/cli/run_game.py` | Single game CLI |
| `src/mage_knight_sdk/cli/run_sweep.py` | Seed sweep CLI |
| `src/mage_knight_sdk/cli/train_rl.py` | RL training CLI |
| `src/mage_knight_sdk/tools/scan_fame.py` | Fame analysis tool |
| `src/mage_knight_sdk/tools/import_tensorboard.py` | NDJSON→TensorBoard importer |
| `src/mage_knight_sdk/viewer/` | Artifact viewer (Flask app) |
| `scripts/generate_*.py` | Code generators |
| `pyproject.toml` | Package metadata and dependencies |

## No Magic Strings Policy

All connection status constants are exported from the public API:
- `CONNECTION_STATUS_CONNECTING`
- `CONNECTION_STATUS_CONNECTED`
- `CONNECTION_STATUS_RECONNECTING`
- `CONNECTION_STATUS_DISCONNECTED`
- `CONNECTION_STATUS_ERROR`

Use these constants, never hardcoded strings like `"connected"`.

Protocol parse error codes are also exported:
- `PROTOCOL_PARSE_ERROR_INVALID_ENVELOPE`
- `PROTOCOL_PARSE_ERROR_UNSUPPORTED_VERSION`
- `PROTOCOL_PARSE_ERROR_UNKNOWN_MESSAGE_TYPE`
- `PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD`

Access via `ProtocolParseError.code`.
