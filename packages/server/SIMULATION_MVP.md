# Server-Side Simulation - MVP Implementation

## ✅ What's Working

We've successfully implemented a **server-side simulation system** that eliminates per-step WebSocket overhead by running entire games on the server.

### Architecture

```
┌─────────────────────────────────────────┐
│  HTTP POST /api/run-simulation          │
│  {seed, policyType, maxSteps, ...}      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  ServerSideSimulation                   │
│  - Creates game with GameServer         │
│  - Runs action loop without WebSocket   │
│  - Returns final result                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  RandomServerPolicy                     │
│  - Enumerates valid actions             │
│  - Chooses random action                │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Action Enumerator (MVP)                │
│  - Tactics selection: ✅ WORKS           │
│  - END_TURN: ✅ WORKS                    │
│  - Other actions: 🚧 TODO               │
└─────────────────────────────────────────┘
```

### Test Results

```bash
✓ runs a simple 2-player simulation
✓ respects max steps limit
✓ produces deterministic results with same seed
✓ handles 4-player games

4 pass, 0 fail
```

### API Usage

```bash
curl -X POST http://localhost:3001/api/run-simulation \
  -H "Content-Type: application/json" \
  -d '{
    "seed": 12345,
    "policyType": "random",
    "maxSteps": 1000,
    "playerCount": 2
  }'
```

Response:
```json
{
  "gameId": "g_abc123",
  "seed": 12345,
  "outcome": "max_steps",
  "steps": 4,
  "finalState": {...},
  "fame": { "player-1": 0, "player-2": 0 },
  "executionTimeMs": 15
}
```

## 🚧 Current Limitations

### MVP Scope

The action enumerator currently handles:
- ✅ **Tactics selection** - fully implemented
- ✅ **END_TURN** - allows games to progress
- ❌ **All other actions** - not yet implemented

This means simulations will:
1. Select tactics (works perfectly)
2. Immediately end turns (skips gameplay)
3. Terminate after a few steps

**This is intentional for the MVP** - it proves the architecture works without implementing the full action enumeration logic.

### Why Other Actions Aren't Implemented

The `ValidActions` structure contains **metadata**, not ready-made `PlayerAction` objects:

```typescript
// ValidActions provides metadata:
interface PlayCardOptions {
  cards: readonly PlayableCard[];  // Cards you CAN play
}

interface PlayableCard {
  cardId: CardId;
  canPlayBasic: boolean;
  canPlayPowered: boolean;
  requiredMana?: ManaColor;
}

// We must BUILD actions from this:
for (const card of playCardOptions.cards) {
  if (card.canPlayBasic) {
    actions.push({ type: PLAY_CARD_ACTION, cardId: card.cardId, powered: false });
  }
  if (card.canPlayPowered) {
    actions.push({ type: PLAY_CARD_ACTION, cardId: card.cardId, powered: true });
  }
}
```

This logic must be implemented for:
- Card play (basic/powered/sideways)
- Movement (hexes, paths)
- Exploration (directions)
- Combat (attacks, blocks, damage assignment)
- Site interaction (enter, interact, tribute)
- Unit recruitment & activation
- Mana source usage
- Skill activation
- And 15+ other action types

The Python SDK has a **1000+ line generated file** (`generated_action_enumerator.py`) that handles all these cases.

## 🎯 Next Steps for Production

### Option 1: Generate the Enumerator (Recommended)

Create a code generator that reads the ValidActions schema and generates TypeScript code to build actions from metadata.

**Pros:**
- Stays in sync with schema changes
- Handles all edge cases correctly
- Maintainable

**Cons:**
- Requires building a generator

**Effort:** 2-3 days

### Option 2: Manually Implement (Quick but Brittle)

Hand-code the action building logic for all ValidActions modes.

**Pros:**
- Can start immediately
- No tooling needed

**Cons:**
- 800-1000 lines of mapping code
- Will break when schema changes
- Hard to maintain

**Effort:** 1-2 days (but ongoing maintenance burden)

### Option 3: Use Python SDK's Enumerator (Hybrid)

Call the Python enumerator from TypeScript via a subprocess.

**Pros:**
- Reuses existing working code
- No duplication

**Cons:**
- Adds Python dependency to server
- Slower than native TypeScript
- Complex inter-process communication

**Effort:** 1 day

## 📊 Expected Performance (When Complete)

Based on profiling:

| Metric | Current (WebSocket) | Server-Side (Projected) |
|--------|---------------------|-------------------------|
| Per-step overhead | 0.41ms | 0.05ms |
| Throughput | 39 runs/s | 195-390 runs/s |
| 1M games (8 cores) | 7.1 hours | 42 min - 1.4 hours |

**Speedup: 5-10x**

## 🔧 For Developers

### Running Tests

```bash
cd packages/server
bun test src/__tests__/ServerSideSimulation.test.ts
```

### Key Files

| File | Purpose |
|------|---------|
| `src/simulation/ServerSideSimulation.ts` | Main simulation runner |
| `src/simulation/policies.ts` | Action selection policies |
| `src/simulation/actionEnumerator.ts` | ValidActions → PlayerActions (MVP) |
| `src/simulation/types.ts` | Request/response types |
| `src/WebSocketServer.ts` | HTTP endpoint integration |

### Adding New Action Types

To extend the action enumerator:

1. Find the ValidActions mode in `packages/shared/src/types/validActions.ts`
2. Understand the metadata structure
3. Add action building logic to `actionEnumerator.ts`
4. Test with a specific seed to verify correctness

Example:
```typescript
// In actionEnumerator.ts
if (validActions.mode === "normal_turn" && validActions.playCard) {
  for (const card of validActions.playCard.cards) {
    if (card.canPlayBasic) {
      actions.push({
        type: PLAY_CARD_ACTION,
        cardId: card.cardId,
        powered: false,
      });
    }
    if (card.canPlayPowered && card.requiredMana) {
      actions.push({
        type: PLAY_CARD_ACTION,
        cardId: card.cardId,
        powered: true,
      });
    }
  }
}
```

## 🎉 Summary

**What works:** The entire infrastructure for server-side simulation is complete and tested.

**What's missing:** Full action enumeration (converting ValidActions metadata to PlayerActions).

**Impact:** With full action enumeration, we'll achieve 5-10x speedup for batch simulations, reducing 1M game runs from 7 hours to under 2 hours.

**Recommendation:** Generate the action enumerator from the ValidActions schema to ensure correctness and maintainability.
