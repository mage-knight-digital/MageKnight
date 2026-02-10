# mage-knight-ws-client

Python async SDK for Mage Knight's WebSocket multiplayer protocol.

## Features

- Generated typed protocol models from shared JSON schema artifacts.
- Runtime parsing/validation for all server messages.
- Async WebSocket client with reconnect backoff.
- Connection state transition stream (`connecting`, `connected`, `reconnecting`, `disconnected`, `error`).
- Optional lobby subscribe/resume message support.

## Install

```bash
cd packages/python-sdk
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
        await client.send_action({"type": "end_turn"})

        async for message in client.messages():
            print(message)


asyncio.run(main())
```

## Generate Models

Protocol models are generated from:

- `packages/shared/schemas/network-protocol/v1/client-to-server.schema.json`
- `packages/shared/schemas/network-protocol/v1/server-to-client.schema.json`

Run:

```bash
python3 packages/python-sdk/scripts/generate_protocol_models.py
```

## Local Integration Tests

```bash
cd packages/python-sdk
python3 -m unittest discover -s tests -p 'test_*.py'
```
