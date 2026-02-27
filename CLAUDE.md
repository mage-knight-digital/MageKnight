# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**PRs should always target the `main` branch.**

## Git Worktrees

When working in a git worktree:
- Commit to the worktree branch
- When asked to "commit to main" or "merge to main", commit on worktree branch first, then merge into `main` from the main repo
- The worktree branch is temporary — `main` is the source of truth

The `packages/client/public/` folder is gitignored (contains large binary assets). A post-checkout hook in `.githooks/` automatically symlinks it from the main repo when you create a worktree.

If the symlink wasn't created automatically, run from the worktree:
```bash
MAIN_REPO="$(git worktree list --porcelain | head -1 | sed 's/worktree //')"
ln -s "$MAIN_REPO/packages/client/public" packages/client/public
```

## GitHub Project Management

Issues are tracked in [GitHub Projects](https://github.com/users/eshaffer321/projects/1). Use the skills below to manage work.

### Skills

| Skill | Purpose | Example |
|-------|---------|---------|
| `/ticket` | Create new issue from investigation | `/ticket wounds don't shuffle properly` |
| `/link` | Link issues as sub-issues or blockers | `/link #45 to #103` or `/link #45 blocked by #108` |
| `/work` | Start working on an issue | `/work #32` or `/work` (picks next) |
| `/done` | Complete work, create PR | `/done` |
| `/board` | View project board status | `/board` |
| `/next` | Get recommendation for next issue | `/next` or `/next quick` |

### Labels

**Priority:** `P0-critical`, `P1-high`, `P2-medium`, `P3-low`
**Type:** `bug`, `feature`, `edge-case`, `tech-debt`, `docs`
**Area:** `area:combat`, `area:cards`, `area:mana`, `area:turn`, `area:rest`, `area:movement`, `area:units`, `area:sites`, `area:ui`
**Complexity:** `complexity:low`, `complexity:medium`, `complexity:high`
**Status:** `needs-refinement` (stub tickets needing details)
**Scope:** `epic` (parent issue tracking a large feature via sub-issues)

### Workflow

1. **Find work**: `/next` recommends highest priority, or `/board` for overview
2. **Start work**: `/work #XX` moves issue to In Progress, gathers context
3. **Implement**: Follow issue acceptance criteria, update todos
4. **Complete**: `/done` creates PR with `Closes #XX`, moves to In Review

### Commit Messages

Reference issues in commits: `feat: implement mandatory card play (#32)`

PRs auto-close issues when merged via `Closes #XX` in PR body.

---

## Build & Test Commands

### Rust Engine (primary)

```bash
cd packages/engine-rs
cargo check              # Verify compilation
cargo test               # Run all tests (~2100 tests)
cargo clippy             # Lint
cargo test -p mk-engine  # Test specific crate
```

### Client + Server

```bash
bun run dev:rust         # Rust WebSocket server + React client
bun run cli              # CLI game runner (release mode)
```

### RL Training

```bash
cd packages/python-sdk && source .venv/bin/activate
bun run train-rl         # Start training
bun run tensorboard      # View metrics
```

---

## Architecture

The game engine is a Rust workspace at `packages/engine-rs/` with 6 crates and 2 tool binaries.

### Crate Dependency Graph

```
mk-types → mk-data → mk-engine → mk-features → mk-env → mk-python
                                                    tools: mk-cli, mk-server
```

### Crates

- **mk-types**: Core types — 13 branded ID newtypes (`CardId`, `SkillId`, `UnitId`, `EnemyId`, etc.), all game enums (`ManaColor`, `Element`, `Terrain`, `GamePhase`, `CombatPhase`, `Hero`, etc.), hex coordinates, `PlayerAction` enum (~70 variants), `GameState`/`PlayerState`/`CombatState`/`MapState`, `PlayerFlags` bitfield (u32), `ActivePending` (21 variants) + `DeferredPending` (4 variants), `EffectType` (100+ discriminants), `CardEffect` enum, `ModifierEffect` (50+ variants), `ActiveModifier`, Mulberry32 RNG (seed-parity with TS)

- **mk-data**: Static game data — 70+ card definitions (basic actions, advanced actions, artifacts, spells), 31 unit definitions with 16 ability variants, 100+ enemy definitions, 70 skill definitions with passive modifiers, 25 artifact cards, tile layouts (starting tiles + countryside + core), site properties, ruins tokens, hero decks, fame/level thresholds, tactic IDs

- **mk-engine**: Game logic — action pipeline (`apply_action()` → validate → execute → compute legal actions), effect queue (VecDeque-based, replaces TS recursive resolution), combat system (4-phase: Ranged/Siege → Block → Assign Damage → Attack), movement (terrain costs, provocation, tile exploration), mana operations (die pool, tokens, crystals), card play (basic/powered/sideways with mana payment), end turn/round, valid actions enumeration, card playability evaluation, site interactions (commerce, monastery, ruins), cooperative assaults, modifier system, reward system, undo (snapshot-based)

- **mk-features**: RL integration — state encoder (76 scalars + entity pools), action encoder (6 IDs + 34 scalars per action), 9 vocab tables, mode/source derivation, PyO3 `GameEngine` class with `encode_step()`

- **mk-env**: Vectorized RL environment for parallel training via Rayon

- **mk-python**: PyO3 module (`#[pymodule]`) exposing engine to Python

### Tool Binaries

- **mk-cli** (`tools/mk-cli/`): CLI game runner with random and human play modes
- **mk-server** (`tools/mk-server/`): WebSocket server bridging Rust engine to React client

### Other Packages

- **client** (`packages/client/`): React UI with hex map, card display, action menus
- **python-sdk** (`packages/python-sdk/`): RL training (PPO, REINFORCE), game viewer, tensorboard integration
- **mage-dev** (`packages/mage-dev/`): Dev tooling for trace generation and debugging
- **shared** (`packages/shared/`): TypeScript types shared between client and server (action types, event types, client state)

---

## Core Systems (Rust Engine)

### Effect Queue (`mk-engine/src/effect_queue.rs`)

Queue-based (VecDeque), not recursive. Replaces the TS recursive resolution pattern.

```
EffectQueue::drain() loop:
  Atomic effects → mutate GameState directly
  Compound → decompose, push sub-effects to front
  Conditional → evaluate condition, push chosen branch to front
  Scaling → evaluate factor, push scaled effect to front
  Choice → filter resolvable options:
    0 → skip, 1 → auto-resolve, N → return NeedsChoice
```

When a choice pauses resolution, remaining queue entries become the "continuation" stored in player pending state. On `ResolveChoice`, the chosen option + continuation are pushed to a new queue and draining resumes.

**ChoiceResolution variants**: Standard, CrystallizeConsume, DiscardThenContinue, ManaDrawTakeDie, BoostTarget, UniversalPowerMana, SecretWaysLake, RegenerateMana, DuelingTarget, InvocationDiscard, PolarizationConvert, CurseTarget, CurseMode, CurseAttackIndex, ForkedLightningTarget, KnowYourPreyTarget, KnowYourPreyOption, PuppetMasterSelectToken, PuppetMasterUseMode, ShapeshiftCardSelect, ShapeshiftTypeSelect, RitualOfPainDiscard, NaturesVengeanceTarget, ManaOverloadColorSelect, SourceOpeningDieSelect, MasterOfChaosGoldChoice

### Combat System

4-phase combat: **Ranged/Siege → Block → Assign Damage → Attack**

- `CombatState` (boxed — large, uncommon) tracks enemies, phase, damage, fortification, city_color, enemy_assignments (cooperative)
- City defender bonuses by color: White (+1 Armor), Blue (+2 Attack Ice/Fire), Red (Brutal on Physical), Green (Poison on Physical)
- Dungeons/Tombs: units cannot participate, night mana rules apply
- Enemy abilities: Vampiric, Defend, Cumbersome, Paralyze, Summon, ArcaneImmunity, Brutal, Poison, Swift, Fortified, Elusive, Poison
- Instance IDs: `"enemy_0"`, `"enemy_1"` (not token-based)

### Action Pipeline

Every action flows through: validate → execute → compute valid actions.

`LegalActionSet` is computed after each action and sent to the client. The client uses it to enable/disable UI elements.

### Mana System

Three mana sources:
1. **Die Pool**: Shared dice (players + 2). Day: gold available, black depleted. Night: reversed.
2. **Tokens**: Temporary mana from card effects. Returned at end of turn.
3. **Crystals**: Permanent storage (max 3 per color). Can convert to/from tokens.

Payment priority: matching-color token → gold token (wild) → matching-color crystal.

### Modifier System

Tracks active effects with duration (`Turn`, `Combat`, `Round`, `Permanent`) and scope.

Query functions: `get_effective_terrain_cost()`, `get_effective_sideways_value()`, `is_rule_active()`, `find_replace_cost_for_terrain()`

Modifiers expire automatically at phase boundaries.

### Undo System

Snapshot-based (replaces TS closure-based undo):
- `save()` = reversible checkpoint (most card plays, movement)
- `set_checkpoint()` = irreversible (tile reveals, RNG, conquest) — clears stack
- `undo()` returns `Option<GameState>` — assign result, don't pass `&mut state`

### Pending State

Consolidated from 20+ TS fields into:
- `ActivePending` — single blocking resolution (one at a time)
- `DeferredPending` — entries that accumulate (rewards, level-ups, fame trackers)
- `PendingQueue` — owns both, with `has_active()`, `is_empty()` helpers

### Reward System

Site conquest queues rewards to `player.pending`. Player must select before ending turn.

- Choice rewards (spell, artifact, AA): queued, resolved via `SelectReward` action
- Immediate rewards (fame, crystals): granted instantly
- Selected cards go to **top of deed deck** (drawn next round)

---

## Key Patterns & Gotchas

### RNG Threading
All randomness must thread through `RngState`:
```rust
let (result, new_rng) = shuffle_with_rng(cards, state.rng);
state.rng = new_rng;
```
Mulberry32 PRNG with seed-for-seed parity with the TS engine.

### Branded ID Types
`CardId`, `UnitId`, `EnemyId` are newtype wrappers around `Box<str>`. Use the `define_id!` macro.

### Deterministic Containers
**BTreeMap** everywhere instead of HashMap for deterministic iteration order. `ManaColor` derives `PartialOrd + Ord` for use as BTreeMap key.

### PlayerFlags Bitfield
17 boolean fields packed into `PlayerFlags(u32)` using `bitflags!`. Manual serde (serialize as u32).

### Boxed CombatState
`GameState.combat` is `Option<Box<CombatState>>` — boxed because CombatState is large and combat is uncommon.

### ArrayVec for Bounded Collections
Units (max 8), banners (max 4), kept enemies (max 4) use `ArrayVec` to avoid heap allocation.

### PoweredBy Enum
- `PoweredBy::None` (wounds), `PoweredBy::Single(color)` (most cards), `PoweredBy::AnyBasic` (Crystal Joy)
- `.primary_color()` → `Option<BasicManaColor>` (Single→Some, else None)
- AnyBasic cards emit up to 4 PlayCardPowered legal actions (one per affordable basic color)
- `play_card()` accepts `override_mana_color: Option<BasicManaColor>` for AnyBasic powered plays

### Skills
- `apply_use_skill()` does NOT set `HAS_TAKEN_ACTION` or `PLAYED_CARD_FROM_HAND`
- Custom handlers return early (sideways skills, etc.), generic path uses EffectQueue
- `push_passive_skill_modifiers()` called when skill acquired (Permanent duration)
- Interactive skills: `place_skill_in_center()` (flip + Round/OtherPlayers markers), `ReturnInteractiveSkill` for returner benefits
- Motivation cross-player cooldown: scan all players' `used_this_round`
- SIDEWAYS_SKILLS mutual exclusivity: check `active_modifiers` for conflicting sources

### Sites
- Dungeon/Tomb: `units_allowed=false`, `night_mana_rules=true`, re-enterable
- Plunder: burns site + rep -1
- Commerce: BuySpell (7 influence), LearnAA (6 influence), BurnMonastery (-3 rep, violet enemy, artifact reward)
- Conquest rewards: `queue_site_reward` → auto-grant or defer → `promote_site_reward`
- City-color commerce: Blue (spells), Green (AA from offer or deck), Red (artifact blind draw), White (elite unit + all types)

### Dummy Player (Solo Mode)
In turn_order but NOT in `state.players`. Auto-executes turns.

### Borrow Checker Patterns
When processing effects that read and mutate state: collect from read-only → process draws → apply mutations (3 phases).

### Volkare/Entity Support (Future)
The Lost Legion expansion adds Volkare, an AI-controlled antagonist. When implementing new features:
- Avoid hardcoding player index where a generic actor ID could work
- Keep combat state extensible (initiator/defender tracking may be needed)
- Don't assume `Player` object exists without considering entity case

---

## Red-Green-Refactor for Bug Fixes

**Always use red-green-refactor when fixing bugs:**

1. **RED**: Write a single failing test that reproduces the bug. Run it, confirm it fails.
2. **GREEN**: Implement the minimal fix. Run the test, confirm it passes.
3. **REFACTOR**: Clean up if needed. Add additional regression tests for related edge cases.

Do not mix failing and already-passing tests in the RED phase. Tests that confirm existing behavior are regression tests — add them after the fix, not before.

---

## No Magic Strings Policy

All identifiers use exported constants or const strings. Use constants in comparisons, match arms, struct literals. Never raw strings.

---

## Pre-Push Verification

**Always run before pushing:**
```bash
cd packages/engine-rs && cargo test && cargo clippy
```

For changes touching the client or shared types:
```bash
bun run build && bun run lint
```

---

## Lint Error Policy

**Always fix the root cause of lint errors — never bypass them.**

- Do not use `#[allow(...)]`, `// eslint-disable`, `@ts-ignore`, `@ts-expect-error`, or similar suppression comments
- Do not modify linter config to weaken rules
- If a lint error seems incorrect, investigate the underlying issue first

**Bypass is only acceptable with strong justification:**
1. Perform a web search to confirm the bypass aligns with established best practices
2. Document the justification in a comment explaining why the bypass is necessary
3. The justification must be a genuine edge case (e.g., library type definitions are wrong, rule conflicts with framework requirements)

When in doubt, fix the code to satisfy the linter rather than silencing the warning.

---

## File Reference (Rust Engine)

| What | Where |
|------|-------|
| Core types (IDs, enums, state) | `engine-rs/crates/mk-types/src/` |
| Card definitions (basic + AA) | `engine-rs/crates/mk-data/src/cards/` |
| Artifact card definitions | `engine-rs/crates/mk-data/src/artifacts.rs` |
| Spell definitions | `engine-rs/crates/mk-data/src/spells.rs` |
| Skill definitions | `engine-rs/crates/mk-data/src/skills/` |
| Enemy definitions | `engine-rs/crates/mk-data/src/enemies.rs` |
| Unit definitions | `engine-rs/crates/mk-data/src/units.rs` |
| Site properties | `engine-rs/crates/mk-data/src/site_properties.rs` |
| Tile layouts | `engine-rs/crates/mk-data/src/tiles.rs` |
| Ruins tokens | `engine-rs/crates/mk-data/src/ruins_tokens.rs` |
| Effect queue / resolvers | `engine-rs/crates/mk-engine/src/effect_queue.rs` |
| Action pipeline | `engine-rs/crates/mk-engine/src/action_pipeline/` |
| Combat logic | `engine-rs/crates/mk-engine/src/combat/` |
| Movement | `engine-rs/crates/mk-engine/src/movement.rs` |
| Valid actions / legal actions | `engine-rs/crates/mk-engine/src/legal_actions/` |
| Card playability | `engine-rs/crates/mk-engine/src/legal_actions/card_playability.rs` |
| End turn / round | `engine-rs/crates/mk-engine/src/end_turn.rs` |
| Mana operations | `engine-rs/crates/mk-engine/src/mana.rs` |
| Undo system | `engine-rs/crates/mk-engine/src/undo.rs` |
| RL feature encoding | `engine-rs/crates/mk-features/src/` |
| CLI game runner | `engine-rs/tools/mk-cli/` |
| WebSocket server | `engine-rs/tools/mk-server/` |
| Claude Code skills | `.claude/skills/` |



Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
