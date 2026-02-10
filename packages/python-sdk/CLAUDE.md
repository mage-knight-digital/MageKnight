# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The python-sdk is a Python WebSocket client for Mage Knight's multiplayer protocol. It's part of the larger MageKnight monorepo but operates as a standalone Python package with its own environment and build system.

## Setup & Development

### Initial Setup

```bash
cd packages/python-sdk
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
python3 -m pip install -e .
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
source venv/bin/activate
python3 scripts/generate_protocol_models.py

# Check integration with server (requires local Mage Knight server running on port 3001)
python3 -m unittest discover -s tests/integration -p 'test_*.py'
```

## Architecture

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
- Message types: `ClientActionMessage`, `ClientLobbySubscribeMessage`, `StateUpdateMessage`, `ErrorMessage`, `LobbyStateMessage`

### Protocol Flow

1. Client connects via `MageKnightClient(server_url, game_id, player_id)`
2. Client can subscribe to lobby updates with `send_lobby_subscribe()`
3. Client sends game actions with `send_action(action_dict)`
4. Server responds with `state_update` (events + filtered game state) or `error` messages
5. Client streams messages via `async for msg in client.messages()` and state changes via `async for state in client.state_changes()`

### Generated Code

**Protocol models are generated** from:
- `packages/shared/schemas/network-protocol/v1/client-to-server.schema.json`
- `packages/shared/schemas/network-protocol/v1/server-to-client.schema.json`

**Regenerate after schema changes:**
```bash
python3 scripts/generate_protocol_models.py
```

The generator creates typed dataclasses with fields matching the JSON schema, ensuring type safety and IDE autocomplete. Never manually edit `protocol_models.py`.

## Key Gotchas

### Virtual Environment
- Always activate the venv before running tests or scripts: `source venv/bin/activate`
- Tests import from the monorepo root to access shared schemas for code generation

### Protocol Version Mismatch
- The client validates `protocolVersion` in all messages
- If the server uses a different version, parsing fails with `ProtocolParseError` (code: `unsupported_version`)
- `NETWORK_PROTOCOL_VERSION` in `protocol_models.py` is the source of truth — regenerate when shared schemas change

### Reconnection Backoff
- Default: `0.5s` base delay, exponential backoff (2^attempt), max 5 attempts
- Configurable via `MageKnightClient(reconnect_base_delay=..., max_reconnect_attempts=...)`
- Failed reconnection after max attempts emits `CONNECTION_STATUS_ERROR` state

### Lobby Subscribe Optional
- `send_lobby_subscribe()` is optional — only needed if subscribing to pre-game lobby state
- Set `subscribe_lobby_on_connect=True` to auto-subscribe on connection

### Action Validation
- `send_action()` validates that action has a non-empty `type` field
- Raises `ProtocolValidationError` if invalid before sending to server

### Null Session Tokens
- `session_token` is optional for resuming sessions
- When None, it's omitted from `lobby_subscribe` messages (not sent as null)

## Testing

### Unit Tests (`tests/test_client.py`)
- Test client behavior in isolation using `_FakeWebSocket` mock
- Fast, no external dependencies
- Cover connection state, message queueing, session token handling

### Integration Tests (`tests/integration/`)
- Require running a test WebSocket server (`ws_test_server.ts`)
- Test full message parsing, reconnection, and protocol compliance
- Run with: `python3 -m unittest discover -s tests/integration -p 'test_*.py'`

## File Reference

| Path | Purpose |
|------|---------|
| `src/mage_knight_sdk/client.py` | Main WebSocket client and connection state management |
| `src/mage_knight_sdk/protocol.py` | Message parsing, serialization, and validation |
| `src/mage_knight_sdk/protocol_models.py` | **Generated** typed message dataclasses |
| `src/mage_knight_sdk/__init__.py` | Public API exports |
| `scripts/generate_protocol_models.py` | Code generator for protocol models |
| `tests/test_client.py` | Unit tests for client behavior |
| `tests/integration/test_websocket_client.py` | End-to-end protocol tests |
| `examples/local_dev_client.py` | Example: basic client usage |
| `examples/reconnect_resume_client.py` | Example: session resumption with reconnect |
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
