# mage-knight-ws-client

Python async SDK for Mage Knight's WebSocket multiplayer protocol.

## Features

- Generated typed protocol models from shared JSON schema artifacts.
- Runtime parsing/validation for all server messages.
- Async WebSocket client with reconnect backoff.
- Connection state transition stream (`connecting`, `connected`, `reconnecting`, `disconnected`, `error`).
- Optional lobby subscribe/resume message support.

## Install

First, create and activate a virtual environment:

```bash
cd packages/python-sdk
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Then install the SDK in editable mode:

```bash
python3 -m pip install -e .
```

## Quick Start

```python
import asyncio

from mage_knight_sdk import MageKnightClient


async def main() -> None:
    async with MageKnightClient(
        server_url="ws://127.0.0.1:3001",
        game_id="g_example123",
        player_id="player-1",
    ) as client:
        await client.send_action({"type": "END_TURN"})

        async for message in client.messages():
            print(message)


asyncio.run(main())
```

This example requires a Mage Knight server running locally. See `examples/local_dev_client.py` for a more complete example.

## Random-Policy Simulation Harness

The SDK includes a headless integration harness for running multiplayer games over bootstrap + WebSocket APIs without the React client.

### What It Validates

- Agent always selects from server-advertised `validActions`.
- Server does not reject actions advertised as valid.
- Turn ownership invariants stay coherent (`currentPlayerId` is always in `turnOrder`).
- Per-run outcomes are tracked: `ended`, `max_steps`, `disconnect`, `protocol_error`, `invariant_failure`.
- A lightweight `run_summary.ndjson` is always written (seed, outcome, steps, fame).
- Full failure artifacts (action trace + message log) are optional—runs are reproducible by seed.

### Programmatic Usage

```python
from mage_knight_sdk import RunnerConfig, run_simulations_sync, save_summary

config = RunnerConfig(
    bootstrap_api_base_url="http://127.0.0.1:3002",
    ws_server_url="ws://127.0.0.1:3001",
    player_count=2,
    runs=5,
    base_seed=42,
    max_steps=200,
    artifacts_dir="sim_artifacts",
    write_failure_artifacts=False,  # default: summary-only; set True to dump full trace on failures
)

results, summary = run_simulations_sync(config)
save_summary("sim_artifacts/summary.json", results, summary)
print(summary)
```

### Deterministic Failure Reproduction

Use the same `base_seed`, `player_count`, and API/WS endpoints to replay the same random decision stream.
For validation testing, you can force an invalid action via `forced_invalid_action_step` and assert it is reported as `protocol_error`.

### Sim Artifact Viewer

Full failure artifacts (e.g. `sim-artifacts/run_*_seed_*.json`) are written only when `--save-failures` / `write_failure_artifacts=True`. They can be inspected with a local streaming viewer.

**One-time setup** (from repo root or `packages/python-sdk`):

```bash
cd packages/python-sdk
pip install -e ".[viewer]"   # or create a venv first, then install
```

**Start the viewer:**

```bash
# From repo root (easiest):
bun run viewer

# From packages/python-sdk (uses .venv if present):
./scripts/run-viewer

# Or with the installed CLI:
mage-knight-viewer
```

Then open http://127.0.0.1:8765. Choose an artifact; on first open it is converted to NDJSON + index (one-time, may take a while for huge files). After that you can scroll through the action trace; only the visible range is loaded.

## Generate Models

Protocol models are generated from:

- `packages/shared/schemas/network-protocol/v1/client-to-server.schema.json`
- `packages/shared/schemas/network-protocol/v1/server-to-client.schema.json`

To regenerate after updating protocol schemas:

```bash
cd packages/python-sdk
source venv/bin/activate  # On Windows: venv\Scripts\activate
python3 scripts/generate_protocol_models.py
```

## Local Integration Tests

```bash
cd packages/python-sdk
source venv/bin/activate  # On Windows: venv\Scripts\activate
python3 -m unittest discover -s tests -p 'test_*.py'

# Harness integration tests (includes CI-friendly smoke run)
python3 -m unittest discover -s tests/integration -p 'test_sim_runner.py'
```
