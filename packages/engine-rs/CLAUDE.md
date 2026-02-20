# Rust Engine Rewrite — Agent Context

This is a ground-up Rust rewrite of the Mage Knight game engine (currently ~260K lines TypeScript across `packages/core`, `packages/shared`, `packages/server`). The goal is faster RL training simulations via PyO3, eliminating the JSON/WebSocket IPC bottleneck.

## Quick Start

```bash
cd packages/engine-rs
cargo check    # Verify compilation
cargo test     # Run all tests (18 currently in mk-types)
```

## Architecture: 6-Crate Workspace

```
packages/engine-rs/
  Cargo.toml              # Workspace root
  crates/
    mk-types/             # Core types, zero deps beyond serde — DONE (Phase 1)
    mk-data/              # Static card/enemy/unit/skill data — skeleton only
    mk-engine/            # Game logic (validate, execute, effects, valid_actions) — skeleton only
    mk-features/          # RL feature extraction (state/action encoding) — skeleton only
    mk-env/               # Vectorized environment (Rayon parallelism) — skeleton only
    mk-python/            # PyO3 bindings (#[pymodule]) — skeleton only
  tools/
    codegen/              # Schema generators: vocab tables, action enums — skeleton only
```

### Crate Dependency Graph

```
mk-types → mk-data → mk-engine → mk-features → mk-env → mk-python
```

## Current Status: Phase 2 In Progress

**mk-types** is fully implemented (~2500 lines, 29 tests). **mk-data** has hero decks, tile layouts, 24 card definitions, level system, and tactic IDs (30 tests). **mk-engine** has effect queue (with P0 card resolvers + choice wiring), game setup, card play (with mana payment), movement (with edge validation), mana operations, end turn/round management, valid actions enumeration (normal + combat), and snapshot undo (199 tests). Total: 258 tests.

### mk-types Module Guide

| Module | What's in it | Lines | TS Source |
|--------|-------------|-------|-----------|
| `ids.rs` | 13 ID newtypes via `define_id!` macro (CardId, SkillId, UnitId, EnemyId, etc.) | ~115 | `shared/src/ids.ts` |
| `enums.rs` | All game enums (ManaColor, Element, Terrain, GamePhase, CombatPhase, Hero, EnemyColor, SiteType, TileId, etc.) | ~570 | `shared/src/*.ts`, `core/src/types/map.ts` |
| `hex.rs` | HexCoord {q,r}, HexDirection, tile placement offsets, 4 tests | ~140 | `shared/src/hex.ts` |
| `action.rs` | PlayerAction enum (~70 variants), helper structs (ManaSourceInfo, BlockSource, etc.) | ~600 | `shared/src/actions.ts` |
| `state.rs` | GameState, PlayerState, CombatState, MapState, PlayerFlags bitfield (17 bools → u32) | ~550 | `core/src/state/GameState.ts`, `core/src/types/player.ts`, `core/src/types/combat.ts`, `core/src/types/map.ts` |
| `pending.rs` | ActivePending (21 variants) + DeferredPending (4 variants) + PendingQueue | ~300 | `core/src/types/player.ts` (20+ separate `pending*` fields consolidated) |
| `effect.rs` | EffectType enum (100+ discriminants), CardEffect enum (core + Other catch-all), EffectCondition, ScalingFactor | ~350 | `core/src/types/effectTypes.ts`, `core/src/types/conditions.ts`, `core/src/types/scaling.ts` |
| `modifier.rs` | ModifierEffect union (50+ variants), ActiveModifier, ModifierDuration/Scope/Source, RuleOverride (21 variants) | ~400 | `core/src/types/modifiers.ts` |
| `rng.rs` | RngState + Mulberry32 PRNG (parity-verified against TS), shuffle, random_int, random_index | ~160 | `core/src/utils/rng.ts` |

### mk-engine Module Guide

| Module | What's in it | Lines | TS Source |
|--------|-------------|-------|-----------|
| `effect_queue.rs` | EffectQueue (VecDeque-based), DrainResult, all atomic resolvers (GainMove/Attack/Block/Influence/Healing/Fame/Mana/DrawCards/TakeWound + ConvertManaToCrystal/CardBoost/ManaDrawPowered/ApplyModifier/DiscardCost), Compound/Choice/Conditional/Scaling handlers, condition evaluator (14 types), scaling evaluator (9 types), `resolve_pending_choice()` (NeedsChoice→pending wiring + continuation replay), is_resolvable filter | ~1700 | `core/src/engine/effects/` |
| `setup.rs` | `create_solo_game(seed, hero)`, `create_mana_source()`, `create_player()`, `place_starting_tile()` — full solo game initialization | ~310 | `server/src/GameServer.ts` |
| `card_play.rs` | `play_card(basic/powered)`, `play_card_sideways(move/influence/attack/block)`, `consume_mana_payment()` (token > gold > crystal priority), card→effect queue integration, NeedsChoice→pending wiring | ~500 | `core/src/engine/commands/playCardCommand.ts`, `playCardSidewaysCommand.ts` |
| `movement.rs` | `evaluate_move_entry()` (single source of truth), `execute_move()` (position/cost/provocation), `execute_explore()` (tile placement + edge validation), terrain costs, `find_provoked_rampaging_enemies()`, `find_tile_center()`, `calculate_tile_placement()`, `is_player_near_explore_edge()` | ~480 | `core/src/engine/commands/moveCommand.ts`, `exploreCommand.ts`, `core/src/engine/rules/movement.ts` |
| `mana.rs` | `reroll_die()`, `return_die_without_reroll()`, `return_player_dice()`, `gain_crystal()` with overflow, `is_depleted_for_time()` | ~200 | `core/src/engine/mana/manaSource.ts`, `core/src/engine/commands/endTurn/diceManagement.ts` |
| `end_turn.rs` | `end_turn()` (main flow), `process_card_flow()` (draw up), `reset_player_turn()`, `advance_turn()`, `check_round_end()`, `end_round()` (day/night toggle, mana reset, reshuffle), `reset_player_round()`, `process_level_ups()` | ~430 | `core/src/engine/commands/endTurn/`, `core/src/engine/commands/endRound/` |
| `valid_actions.rs` | `get_valid_actions()` (top-level dispatch: CannotAct/TacticsSelection/PendingChoice/NormalTurn/CombatTurn), `get_playable_cards()` + `get_combat_playable_cards()` (per-card basic/powered/sideways), `is_effect_playable()` (recursive resolvability), `get_move_targets()` (adjacent passable hexes), `get_explore_directions()` (unexplored tile slots), `get_turn_options()` (end turn/rest/undo), `get_sideways_options()` (normal: move/influence, combat: attack/block) | ~600 | `core/src/engine/validActions/` |
| `undo.rs` | `UndoStack` (snapshot-based undo), `save()`, `undo()`, `set_checkpoint()` (clears stack for irreversible actions), `clear()` (reset at turn start) | ~130 | N/A (new design replacing TS closure-based undo) |

### mk-data Module Guide

| Module | What's in it | Lines | TS Source |
|--------|-------------|-------|-----------|
| `heroes.rs` | STANDARD_DECK (16 cards), per-hero replacements (7 heroes), `build_starting_deck()`, starting stat constants | ~170 | `core/src/types/hero.ts` |
| `tiles.rs` | TileHex (with rampaging/mine_color), Starting Tile A/B + Countryside 1-5 hex layouts, `get_tile_hexes()`, `find_portal()` | ~280 | `core/src/data/tiles/` |
| `cards.rs` | 12 standard + 11 hero-specific basic action card definitions, `get_card()` registry | ~520 | `core/src/data/basicActions/` |
| `levels.rs` | Fame thresholds (10 levels), `LevelStats` (armor/hand_limit/command_slots), `get_level_from_fame()`, `get_levels_crossed()`, `get_level_stats()` | ~160 | `shared/src/levels.ts` |
| `tactics.rs` | DAY_TACTIC_IDS, NIGHT_TACTIC_IDS, `get_tactics_for_time()` | ~40 | `shared/src/tacticIds/` |

## Key Design Decisions

### 1. Serde Parity with TypeScript
- `#[serde(rename_all = "snake_case")]` everywhere to match TS string constants
- `#[serde(tag = "type")]` for discriminated unions (PlayerAction, ActivePending, ModifierEffect, etc.)
- AttackElement uses `#[serde(rename = "coldFire")]` (camelCase) to match TS serialization quirk

### 2. Deterministic Containers
- **BTreeMap** everywhere instead of HashMap (deterministic iteration order)
- ManaColor derives `PartialOrd + Ord` for use as BTreeMap key

### 3. Consolidated Pending State
The TS `Player` has 20+ separate `pending*` Option fields. In Rust these are consolidated into:
- `ActivePending` — single blocking resolution (one at a time)
- `DeferredPending` — entries that accumulate (rewards, level-ups, fame trackers)
- `PendingQueue` — owns both, with `has_active()`, `is_empty()` helpers

### 4. PlayerFlags Bitfield
17 boolean fields from TS Player packed into `PlayerFlags(u32)` using `bitflags!` crate. Manual serde implementation (serialize as u32) because bitflags derive doesn't work cleanly with serde.

### 5. Boxed CombatState
`GameState.combat` is `Option<Box<CombatState>>` — boxed because CombatState is large and combat is the uncommon path. Keeps GameState small on the stack.

### 6. ArrayVec for Bounded Collections
Units (max 8), banners (max 4), kept enemies (max 4) use `ArrayVec` to avoid heap allocation for small, bounded collections.

### 7. Queue-Based Effect System (replaces TS recursive resolution)
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
The queue is ephemeral (created per-action, not persisted). When a choice pauses resolution, the remaining queue entries become the "continuation" stored in player pending state. On RESOLVE_CHOICE, the chosen option + continuation are pushed to a new queue and draining resumes.

### 8. Mulberry32 RNG (seed-for-seed parity with TS)
RngState { seed: u32, counter: u32 } with `next_f64()`, `next_int()`, `shuffle()`. Counter starts at 0, increments by 1 each call. Input to mulberry32 is `seed.wrapping_add(counter)`. Verified with golden values from TS engine (seeds 0, 42, shuffle parity).

## Phase 2: Core Engine (In Progress)

The next phase implements basic game logic in `mk-engine`:

1. ~~**Seeded RNG**~~ — DONE: Mulberry32 in `mk-types/src/rng.rs`, parity-verified
2. ~~**Game setup**~~ — DONE: `mk-engine/src/setup.rs` + `mk-data/src/heroes.rs` + `mk-data/src/tiles.rs`, 21 tests
3. ~~**Effect queue**~~ — DONE: `mk-engine/src/effect_queue.rs`, 26 tests, all core atomics + structural
4. ~~**Basic card play**~~ — DONE: `mk-engine/src/card_play.rs` + `mk-data/src/cards.rs`, 19+7 tests
5. ~~**Movement**~~ — DONE: `mk-engine/src/movement.rs`, terrain costs, evaluate_move_entry, execute_move (provocation), execute_explore (tile placement), 5 countryside tiles in `mk-data/src/tiles.rs`, 35 tests
6. ~~**End turn**~~ — DONE: `mk-engine/src/end_turn.rs`, card flow (draw up), player reset, turn advance, round end (day/night toggle, reshuffle, mana reset), level-up processing, `mk-data/src/levels.rs` (fame thresholds, level stats), 26 tests
7. ~~**Mana source**~~ — DONE: `mk-engine/src/mana.rs`, reroll die, return dice (used=reroll, draw=preserve color), crystal gain with overflow, depletion rules, `mk-data/src/tactics.rs` (night tactic IDs), 10 tests
8. ~~**Valid actions enumeration**~~ — DONE: `mk-engine/src/valid_actions.rs`, top-level dispatch (CannotAct/TacticsSelection/PendingChoice/NormalTurn), card playability (basic/powered/sideways with effect resolvability), move targets, explore directions, turn options, 27 tests
9. ~~**Snapshot undo**~~ — DONE: `mk-engine/src/undo.rs`, save/undo/checkpoint/clear, 7 tests
10. **Parity tests** — compare against TS golden fixtures

### Parity Testing Strategy

Record golden traces from TS engine: `(seed, action_sequence) → (valid_actions_at_each_step, events, terminal_state)`. Rust replays same seeds/actions and compares outputs.

## TypeScript Source Reference

When implementing new Rust code, these are the key TS files to reference:

| What | TS File |
|------|---------|
| All action variants | `packages/shared/src/actions.ts` |
| Player state (80+ fields) | `packages/core/src/types/player.ts` |
| GameState | `packages/core/src/state/GameState.ts` |
| CombatState | `packages/core/src/types/combat.ts` |
| Effect types (100+) | `packages/core/src/types/effectTypes.ts` |
| CardEffect union | `packages/core/src/types/cards.ts` |
| Modifier types (50+) | `packages/core/src/types/modifiers.ts` |
| Conditions (14) | `packages/core/src/types/conditions.ts` |
| Scaling factors (9) | `packages/core/src/types/scaling.ts` |
| Map/hex types | `packages/core/src/types/map.ts` |
| Mana types | `packages/core/src/types/mana.ts` |
| Enemy types | `packages/core/src/types/enemy.ts` |
| Effect resolution | `packages/core/src/engine/effects/` |
| Combat commands | `packages/core/src/engine/commands/combat/` |
| Validators | `packages/core/src/engine/validators/` |
| Valid actions | `packages/core/src/engine/validActions/` |
| Game rules (shared logic) | `packages/core/src/engine/rules/` |

## Build Notes

- Workspace deps defined in root `Cargo.toml` under `[workspace.dependencies]`
- `serde` with `derive` feature, `arrayvec` with `serde` feature, `bitflags` with `serde` feature
- PyO3 crate (`mk-python`) is `cdylib` — won't produce tests binary, that's expected
- `proptest` available as dev-dependency for property-based testing
