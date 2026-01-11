# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**PRs should always target the `main` branch.**

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

- **@mage-knight/shared**: Types shared between client and server:
  - `PlayerAction` (discriminated union of player inputs)
  - `GameEvent` (discriminated union of engine outputs)
  - `ClientGameState` and related types (filtered state sent to clients)
  - Core types: `CardId`, `SkillId`, `ManaColor`, `HexCoord`, `Terrain`

- **@mage-knight/core**: Pure TypeScript game engine (server-side only, never imported by client):
  - `GameState` — full server-side state
  - Card effects, combat, validation, modifiers
  - Exports dual ESM/CJS builds

- **@mage-knight/server**: Connects engine to clients:
  - `GameServer` — multiplayer with per-player state filtering
  - `toClientState()` — filters state (hides other players' hands, deck contents)

- **@mage-knight/client**: React UI with hex map, card display, action menus

### Communication Pattern

1. Client sends `PlayerAction` → server
2. Server validates, executes command, returns `GameEvent[]`
3. Server filters state per-player via `toClientState()`
4. Events + filtered state sent to client

---

## Core Systems

### Card Effect System (`core/src/engine/effects/`)

Effects are a **discriminated union** with 20+ types. Key patterns:

- **Simple**: `GainMoveEffect`, `GainAttackEffect`, `GainBlockEffect`, `GainHealingEffect`
- **Compound**: `CompoundEffect` executes sub-effects in sequence
- **Choice**: `ChoiceEffect` presents options, creates `pendingChoice` on player
- **Conditional**: `ConditionalEffect` branches on game state (time of day, terrain, in combat)
- **Scaling**: `ScalingEffect` multiplies base effect (per enemy, per wound in hand)
- **Multi-step**: `ManaDrawPoweredEffect`, `CardBoostEffect` require multiple resolutions

**Resolution flow**: `resolveEffect()` → may create `pendingChoice` → player sends `RESOLVE_CHOICE` action → resolution continues

**Gotcha**: Effects can be nested. Always check if resolution creates a pending choice before assuming it's complete.

### Combat System (`core/src/engine/combat/`)

4-phase combat: **Ranged/Siege → Block → Assign Damage → Attack**

- `CombatState` tracks enemies, phase, damage, fortification
- `ElementalCalc` handles damage with elemental resistances (fire/ice/cold)
- Dungeons/Tombs: units cannot participate, gold mana unavailable

**Commands**: `enterCombatCommand`, `declareAttackCommand`, `declareBlockCommand`, `assignDamageCommand`, `endCombatPhaseCommand`

### Validation System (`core/src/engine/validators/`)

Every action goes through validators before execution:

```typescript
type Validator = (state, playerId, action) => ValidationResult;
```

- Validators are **composable** — each action type has a list of validators
- 100+ validation codes in `validationCodes.ts` (e.g., `NOT_YOUR_TURN`, `CARD_NOT_IN_HAND`)
- `validateAction()` runs all validators for an action type

**ValidActions**: Server computes what actions are legal and sends to client. UI uses this to enable/disable buttons.

### Mana System (`core/src/types/mana.ts`)

Three mana sources:
1. **Die Pool**: Shared dice (players + 2). Day: gold available, black depleted. Night: reversed.
2. **Tokens**: Temporary mana from card effects. Returned at end of turn.
3. **Crystals**: Permanent storage (max 3 per color). Can convert to/from tokens.

**Gotcha**: Mana Draw/Pull effects are multi-step — pick die, choose color, gain tokens. Die stays in pool (not removed) but marked with chosen color.

### Command Pattern (`core/src/engine/commands/`)

Commands implement `execute()` and `undo()`. Key concept: **reversibility**.

- `isReversible: true` — can undo (most card plays, movement)
- `isReversible: false` — sets undo checkpoint (tile reveals, RNG, conquest)

Undo works back to last checkpoint. Commands store state needed for undo in closure.

### Modifier System (`core/src/engine/modifiers.ts`)

Tracks active effects with duration (`turn`, `combat`, `round`, `permanent`) and scope.

Query functions: `getEffectiveTerrainCost()`, `getEffectiveSidewaysValue()`, `isRuleActive()`

Modifiers expire automatically via `expireModifiers(state, reason)` at phase boundaries.

### Reward System (`core/src/engine/helpers/rewardHelpers.ts`)

Site conquest queues rewards to `player.pendingRewards`. Player must select before ending turn.

- Choice rewards (spell, artifact, AA): queued, resolved via `SELECT_REWARD` action
- Immediate rewards (fame, crystals): granted instantly
- Selected cards go to **top of deed deck** (drawn next round)

---

## Key Gotchas

### Monorepo Build Order
Core/server consume shared via built outputs. When adding exports to shared:
```bash
pnpm -C packages/shared build  # Rebuild shared first
pnpm build                      # Then full build
```

### Client Running Stale Code
After changes to core/shared, kill dev server and rebuild:
```bash
pkill -f vite; pnpm build
```

### Effect Resolution Creates Pending State
Many effects don't complete immediately. Check for `pendingChoice`, `pendingRewards`, `pendingTacticDecision` before assuming resolution is done.

### Branded ID Types
`CardId`, `UnitId`, `EnemyId` are branded strings. Use them for type safety:
```typescript
const cardId = "march" as CardId;  // Correct
const cardId = "march";            // Type error in strict contexts
```

### RNG Threading
All randomness must thread through `RngState`:
```typescript
const { result, rng: newRng } = shuffleWithRng(cards, state.rng);
return { ...state, rng: newRng };
```

---

## No Magic Strings Policy

All identifiers use exported constants:
```typescript
export const SOME_KIND = "some_kind" as const;
export type SomeKind = typeof SOME_KIND | typeof OTHER_KIND;
```

Use constants in comparisons, object literals, switches. Never raw strings.

---

## Pre-Push Verification

**Always run before pushing:**
```bash
pnpm build && pnpm lint && pnpm test
```

Catches cross-package type mismatches that IDE won't see until full build.

---

## File Reference

| What | Where |
|------|-------|
| Card definitions | `core/src/data/cards/` |
| Effect types | `shared/src/effectTypes.ts` |
| Effect resolution | `core/src/engine/effects/resolveEffect.ts` |
| Combat commands | `core/src/engine/commands/combat/` |
| Validators | `core/src/engine/validators/` |
| Valid actions | `core/src/engine/validActions/` |
| Site properties | `core/src/data/siteProperties.ts` |
| Client state filter | `server/src/index.ts` (`toClientState`) |
| Mana source logic | `core/src/engine/mana/` |
