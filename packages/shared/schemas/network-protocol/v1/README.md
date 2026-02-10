# Network Protocol Schemas v1

Machine-readable JSON Schemas for the Mage Knight WebSocket protocol.

## Enforcement Scope

These deep schemas are **contract artifacts for external clients** (Python SDK,
RL harnesses, headless agents). They define the structural shape of every
payload type so external tooling can generate typed models and validate
messages without hand-maintained parsers.

**Server runtime validation is envelope + discriminant only.** The server
validates:
- Envelope fields (`protocolVersion`, `type`, required top-level keys)
- Action type discriminant against `KNOWN_ACTION_TYPES`

The server does **not** run Ajv / deep JSON Schema validation on inbound
payloads at the WebSocket boundary. Full semantic validation (field types,
legal values, game-state rules) is handled by the engine's validator layer
(`core/src/engine/validators/`), which returns typed `ValidationResult`
errors. This avoids duplicating validation logic and keeps the hot path
lightweight.

**What this means for external clients:**
- You can rely on these schemas for codegen, client-side validation, and
  contract testing.
- A structurally valid payload can still be rejected by engine validators
  (e.g., moving to an unreachable hex, playing a card not in hand).
- Engine validation errors are returned as `error` messages with specific
  `errorCode` values, not as protocol-level parse errors.

## Schema Files

| File | Description |
|------|-------------|
| `client-to-server.schema.json` | Envelope schema for client messages (action, lobby_subscribe) |
| `server-to-client.schema.json` | Envelope schema for server messages (state_update, error, lobby_state) |
| `player-action.schema.json` | Deep schema for all PlayerAction variants (~70 action types) |
| `game-event.schema.json` | Deep schema for all GameEvent variants (~130 event types) |
| `client-game-state.schema.json` | Deep schema for ClientGameState (full game state sent to clients) |
| `protocol.json` | Protocol metadata (version, file listing) |

## How Schemas Are Generated

Schemas are generated at build time from TypeScript types using `typescript-json-schema`.
The TypeScript types in `src/` are the single source of truth.

```bash
bun run generate:deep-schemas       # Generate deep payload schemas
bun run generate:network-schemas    # Generate envelope schemas (references deep schemas via $ref)
```

## Using These Schemas (External Clients)

Envelope schemas reference deep schemas via `$ref`. To validate a full message,
load all schemas into your validator:

### Python (jsonschema)

```python
import json
from pathlib import Path
from jsonschema import Draft7Validator, RefResolver

schema_dir = Path("schemas/network-protocol/v1")

# Load all schemas
schemas = {}
for f in schema_dir.glob("*.schema.json"):
    with open(f) as fh:
        schemas[f.name] = json.load(fh)

# Create resolver for $ref resolution
store = {s.get("$id", name): s for name, s in schemas.items()}
resolver = RefResolver.from_schema(schemas["server-to-client.schema.json"], store=store)

# Validate a server message
validator = Draft7Validator(schemas["server-to-client.schema.json"], resolver=resolver)
validator.validate(message)
```

## Agent-Stable Subset

The following fields in `ClientGameState` are considered stable for RL agents
and external automation. Breaking changes to these fields will bump the major
protocol version.

```
ClientGameState:
  phase               — "setup" | "round" | "end"
  currentPlayerId     — string
  round               — number
  timeOfDay           — "day" | "night"
  combat              — null | { ... }
  validActions.mode   — discriminant for what the player can do

ClientPlayer:
  id                  — string
  position            — { q, r } | null
  fame                — number
  level               — number
  hand                — CardId[] (own) | number (opponent count)
  units               — ClientPlayerUnit[]
  crystals            — { red, blue, green, white }
```

## Known Exclusions

- `DEBUG_ADD_FAME` and `DEBUG_TRIGGER_LEVEL_UP` actions are dev-only and not
  guaranteed stable across versions.
- Internal `definitions` within each schema may be restructured without notice;
  only top-level validation behavior is guaranteed.
