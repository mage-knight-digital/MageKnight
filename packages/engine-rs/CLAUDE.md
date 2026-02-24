# Rust Engine — Agent Context

This is the primary Mage Knight game engine, a ground-up Rust implementation. The original TypeScript engine (`packages/core`, `packages/shared`, `packages/server`) is deprecated.

## Quick Start

```bash
cd packages/engine-rs
cargo check    # Verify compilation
cargo test     # Run all tests (~2100 tests)
cargo clippy   # Lint
```

## Architecture: 6-Crate Workspace + 2 Tool Binaries

```
packages/engine-rs/
  Cargo.toml              # Workspace root
  crates/
    mk-types/             # Core types, zero deps beyond serde
    mk-data/              # Static card/enemy/unit/skill data
    mk-engine/            # Game logic (validate, execute, effects, valid_actions)
    mk-features/          # RL feature extraction (state/action encoding)
    mk-env/               # Vectorized environment (Rayon parallelism)
    mk-python/            # PyO3 bindings (#[pymodule])
  tools/
    mk-cli/               # CLI game runner (random/human play modes)
    mk-server/            # WebSocket server for client communication
```

### Crate Dependency Graph

```
mk-types → mk-data → mk-engine → mk-features → mk-env → mk-python
```

## Current Status

**2100+ tests** across all crates (33 mk-types + 245 mk-data + ~1794 mk-engine + 45 mk-features).

All core game systems are implemented:
- 70+ card definitions (basic actions, advanced actions, artifacts, spells)
- 31 unit definitions with 16 ability variants
- 100+ enemy definitions
- 70/70 skills implemented
- 25/25 artifact cards
- 4-phase combat system with city defender bonuses
- Site interactions (commerce, monastery, ruins, cities)
- Cooperative assaults (multiplayer)
- RL feature encoding with PyO3 bindings
- Solo mode with dummy player

### mk-types Module Guide

| Module | What's in it |
|--------|-------------|
| `ids.rs` | 13 ID newtypes via `define_id!` macro (CardId, SkillId, UnitId, EnemyId, etc.) |
| `enums.rs` | All game enums (ManaColor, Element, Terrain, GamePhase, CombatPhase, Hero, EnemyColor, SiteType, TileId, etc.) |
| `hex.rs` | HexCoord {q,r}, HexDirection, tile placement offsets |
| `action.rs` | PlayerAction enum (~70 variants), helper structs (ManaSourceInfo, BlockSource, etc.) |
| `state.rs` | GameState, PlayerState, CombatState, MapState, PlayerFlags bitfield (17 bools → u32) |
| `pending.rs` | ActivePending (21 variants) + DeferredPending (4 variants) + PendingQueue |
| `effect.rs` | EffectType enum (100+ discriminants), CardEffect enum, EffectCondition, ScalingFactor |
| `modifier.rs` | ModifierEffect union (50+ variants), ActiveModifier, ModifierDuration/Scope/Source, RuleOverride (21 variants) |
| `rng.rs` | RngState + Mulberry32 PRNG (parity-verified against TS), shuffle, random_int, random_index |

### mk-engine Module Guide

| Module | What's in it |
|--------|-------------|
| `effect_queue.rs` | EffectQueue (VecDeque-based), all atomic resolvers, Compound/Choice/Conditional/Scaling handlers, `resolve_pending_choice()`, is_resolvable filter |
| `setup.rs` | `create_solo_game()`, `create_mana_source()`, `create_player()`, `place_starting_tile()` |
| `card_play.rs` | `play_card(basic/powered)`, `play_card_sideways()`, `consume_mana_payment()` (token > gold > crystal priority) |
| `movement.rs` | `evaluate_move_entry()`, `execute_move()`, `execute_explore()`, terrain costs, provocation, tile placement |
| `mana.rs` | `reroll_die()`, `return_die_without_reroll()`, `return_player_dice()`, `gain_crystal()`, depletion rules |
| `end_turn.rs` | `end_turn()`, `process_card_flow()`, `reset_player_turn()`, `advance_turn()`, `end_round()`, level-up processing, end-turn artifact steps |
| `legal_actions/` | `get_legal_actions()` top-level dispatch, card playability, move targets, combat actions, site interactions, rewards |
| `action_pipeline/` | Action handlers organized by domain (cards, combat, movement, sites, skills, turns) |
| `combat/` | Combat resolution, city bonuses, elemental calculations, enemy abilities |
| `undo.rs` | `UndoStack` (snapshot-based), save/undo/checkpoint/clear |

### mk-data Module Guide

| Module | What's in it |
|--------|-------------|
| `cards/` | Basic actions (by color), advanced actions, artifact cards, spell definitions |
| `heroes.rs` | Standard deck, per-hero replacements, `build_starting_deck()`, starting stats |
| `tiles.rs` | Tile hex layouts (starting, countryside, core), portals, rampaging enemies |
| `enemies.rs` | 100+ enemy definitions with abilities, resistances, attacks |
| `units.rs` | 31 unit definitions with recruitment costs, abilities, activation effects |
| `skills/` | 70 skill definitions with passive modifiers, effects, interactive behavior |
| `site_properties.rs` | Site types, combat contexts, reward mappings |
| `ruins_tokens.rs` | 15 ruins token definitions (altars + enemy encounters) |
| `levels.rs` | Fame thresholds, level stats (armor, hand limit, command slots) |
| `tactics.rs` | Day/night tactic IDs and effects |

## Key Design Decisions

### 1. Deterministic Containers
- **BTreeMap** everywhere instead of HashMap (deterministic iteration order)
- ManaColor derives `PartialOrd + Ord` for use as BTreeMap key

### 2. Consolidated Pending State
The TS `Player` had 20+ separate `pending*` Option fields. In Rust these are consolidated into:
- `ActivePending` — single blocking resolution (one at a time)
- `DeferredPending` — entries that accumulate (rewards, level-ups, fame trackers)
- `PendingQueue` — owns both, with `has_active()`, `is_empty()` helpers

### 3. PlayerFlags Bitfield
17 boolean fields packed into `PlayerFlags(u32)` using `bitflags!`. Manual serde implementation (serialize as u32).

### 4. Boxed CombatState
`GameState.combat` is `Option<Box<CombatState>>` — boxed because CombatState is large and combat is the uncommon path.

### 5. ArrayVec for Bounded Collections
Units (max 8), banners (max 4), kept enemies (max 4) use `ArrayVec` to avoid heap allocation for small, bounded collections.

### 6. Queue-Based Effect System
```
EffectQueue { queue: VecDeque<QueuedEffect> }
  drain() loop: pop front, resolve, repeat
    Atomic effects → mutate GameState directly
    Compound → decompose into sub-effects, push to front of queue
    Conditional → evaluate condition, push chosen branch to front
    Scaling → evaluate factor, push scaled effect to front
    Choice → filter resolvable options:
      0 options → skip
      1 option → auto-resolve (push to front)
      N options → return NeedsChoice { options, continuation }
```
The queue is ephemeral (created per-action, not persisted). When a choice pauses resolution, remaining queue entries become the "continuation" stored in player pending state.

### 7. Mulberry32 RNG (seed-for-seed parity with TS)
RngState { seed: u32, counter: u32 } with `next_f64()`, `next_int()`, `shuffle()`. Counter starts at 0, increments by 1 each call. Input to mulberry32 is `seed.wrapping_add(counter)`.

### 8. Snapshot-Based Undo
Replaces TS closure-based undo. `save()` stores full GameState clone. `set_checkpoint()` clears stack for irreversible actions (tile reveals, RNG, conquest). `undo()` returns `Option<GameState>`.

## Build Notes

- Workspace deps defined in root `Cargo.toml` under `[workspace.dependencies]`
- `serde` with `derive` feature, `arrayvec` with `serde` feature, `bitflags` with `serde` feature
- PyO3 crate (`mk-python`) is `cdylib` — won't produce tests binary, that's expected
- `proptest` available as dev-dependency for property-based testing
