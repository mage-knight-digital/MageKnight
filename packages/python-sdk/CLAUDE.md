# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The python-sdk provides RL training infrastructure and game simulation tools for Mage Knight, using the native Rust engine (via PyO3). It's part of the larger MageKnight monorepo but operates as a standalone Python package with its own environment and build system.

## Setup & Development

### Initial Setup

```bash
cd packages/python-sdk
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -e ".[rl,viewer]"
```

The native Rust engine must be built first:
```bash
cd packages/engine-rs
maturin develop --release
```

### Common Commands

```bash
# Run unit tests
python3 -m unittest discover -s tests -p 'test_*.py'

# Run a single test file
python3 -m unittest tests.test_rl_features

# Run a specific test
python3 -m unittest tests.test_rl_features.TestRlFeatures.test_some_method
```

### CLI Entry Points

After `pip install -e ".[rl]"`:

```bash
# Direct CLI (auto-generates run directory under training/runs/)
mage-knight-train-rl --episodes 100 --hero arythea

# PPO training
mage-knight-train-rl --ppo --episodes 1000 --batch-episodes 16

# Resume from checkpoint
mage-knight-train-rl --ppo --episodes 500 --resume training/runs/baseline/checkpoints/policy_final.pt

# Named run via session manager
./scripts/train start baseline -- --episodes 10000
./scripts/train stop
./scripts/train status
./scripts/train list

# Run a native game (no training)
mage-knight-run-native --seed 42 --hero arythea

# Seed sweep
mage-knight-run-native --start-seed 1 --count 100

# TensorBoard
./scripts/run-tensorboard

# Import existing NDJSON logs into TensorBoard
mage-knight-import-tb training/runs/baseline/training_log.ndjson
```

## Architecture

### Package Layers

```
┌─────────────────────────────────────────┐
│  CLI                                    │
│  cli/train_rl.py (RL training)          │
│  cli/run_native.py (game runner/sweep)  │
├─────────────────────────────────────────┤
│  RL Training                            │
│  sim/rl/policy_gradient.py (network)    │
│  sim/rl/native_rl_runner.py (game loop) │
│  sim/rl/features.py (feature encoding)  │
│  sim/rl/rewards.py (reward shaping)     │
│  sim/rl/vocabularies.py (entity vocabs) │
├─────────────────────────────────────────┤
│  Simulation                             │
│  sim/native_runner.py (single/sweep)    │
│  sim/reporting.py (RunResult, summary)  │
├─────────────────────────────────────────┤
│  Native Engine (PyO3)                   │
│  mage_knight_engine (Rust → Python)     │
│  GameEngine, encode_step(), etc.        │
├─────────────────────────────────────────┤
│  Tools                                  │
│  tools/import_tensorboard.py            │
├─────────────────────────────────────────┤
│  Viewer (optional Flask app)            │
│  viewer/server.py                       │
└─────────────────────────────────────────┘
```

### Public API

The top-level `mage_knight_sdk` package exports:
- `run_native_game(seed, hero, max_steps)` — run a single game with random policy
- `run_native_sweep(seeds, hero, max_steps)` — run multiple games
- `RunResult` — outcome, steps, fame, reason
- `RunSummary` — aggregated statistics

### Training Directory Layout

```
packages/python-sdk/
  training/                              ← gitignored
    runs/                                ← all named runs live here
      baseline/                          ← one directory per experiment
        run_config.json                  ← frozen config at training start
        training_log.ndjson              ← appended every episode (metrics)
        tensorboard/                     ← TensorBoard events
          events.out.tfevents.*
        checkpoints/                     ← model snapshots
          policy_ep_000100.pt
          policy_final.pt
        train.log                        ← stdout/stderr (scripts/train only)
      run-20260223T093000/               ← auto-generated name (direct CLI)
        ...same layout...
    .train.pid                           ← scripts/train process tracking
    .active_run
```

**Key principles:**
- Every run gets a name. Direct CLI auto-names `run-{timestamp}`.
- Checkpoints isolated in `checkpoints/` subdirectory.
- TensorBoard works via `tensorboard --logdir training/runs` for comparing all runs.
- Resume derives run directory from the checkpoint path (if parent is `checkpoints/`, goes one level up).

### RL Training (`sim/rl/`)

REINFORCE and PPO for training a game-playing agent. Optional dependency (`pip install -e '.[rl]'`).

**Key modules:**
- `policy_gradient.py` — `ReinforcePolicy` (policy network + value head), `PolicyGradientConfig`, PPO optimization (`optimize_ppo`), GAE computation
- `native_rl_runner.py` — `run_native_rl_game()` (REINFORCE), `run_native_rl_game_ppo()` (PPO with transitions), `EpisodeTrainingStats`
- `features.py` — State/action feature encoding (wraps Rust-side `encode_step()`)
- `rewards.py` — `RewardConfig` for reward shaping (fame deltas, step penalty, terminal bonuses)
- `vocabularies.py` — Entity ID vocabularies for embedding lookups

**Training flow:**
1. `train_rl.py` parses args, resolves run directory, creates policy + reward config
2. Each episode: Rust engine runs game → Python policy chooses actions via encoded features
3. REINFORCE: per-episode gradient update. PPO: batch episodes → compute GAE → clipped surrogate optimization
4. Checkpoints + NDJSON metrics + TensorBoard logged per episode/batch

### TensorBoard

Training automatically logs to TensorBoard when `tensorboard` is installed (included in `.[rl]` extras).

**Metrics logged:** `reward/total`, `reward/fame`, `reward/fame_max`, `episode/steps`, `episode/fame_binary`, `optimization/loss`, `optimization/entropy`, `optimization/critic_loss`, `optimization/action_count`

```bash
# Compare all runs side-by-side:
./scripts/run-tensorboard
# Or manually:
tensorboard --logdir training/runs

# Import existing NDJSON training logs:
mage-knight-import-tb training/runs/baseline/training_log.ndjson
```

### Viewer (`viewer/`)

Flask web app for inspecting simulation artifacts. Optional dependency (`pip install -e '.[viewer]'`).

## Key Gotchas

### Virtual Environment
- Always activate the venv before running tests or scripts: `source .venv/bin/activate`

### Rust Engine Must Be Built
- RL training and native game running require the Rust engine via PyO3
- Build with: `cd packages/engine-rs && maturin develop --release`
- If you see `ModuleNotFoundError: mage_knight_engine`, rebuild the Rust engine

### Feature Encoding
- State/action encoding happens in Rust (`mk-features` crate) for performance
- Python wraps this via `encode_step()` from the `mage_knight_engine` module
- Vocabularies for entity IDs are defined in Rust (`mk-features/src/vocab.rs`)

### Run Directory Resolution
- Explicit `--checkpoint-dir` takes priority
- On `--resume`: derived from checkpoint path (walks up past `checkpoints/`)
- Otherwise: auto-generated as `training/runs/run-{YYYYMMDDTHHMMSS}`

## Testing

### Unit Tests (`tests/`)
- `test_rl_features.py` — Feature encoding validation
- `test_rl_rewards.py` — Reward shaping logic
- `test_rl_embedding_network.py` — Network architecture tests
- `test_native_runner.py` — Native game runner
- `test_reporting.py` — Run result reporting

## File Reference

| Path | Purpose |
|------|---------|
| `src/mage_knight_sdk/__init__.py` | Public API (run_native_game, RunResult, etc.) |
| `src/mage_knight_sdk/cli/train_rl.py` | RL training CLI (REINFORCE + PPO) |
| `src/mage_knight_sdk/cli/run_native.py` | Native game runner / seed sweep CLI |
| `src/mage_knight_sdk/sim/native_runner.py` | Core game running logic |
| `src/mage_knight_sdk/sim/reporting.py` | RunResult, RunSummary, NDJSON output |
| `src/mage_knight_sdk/sim/rl/policy_gradient.py` | ReinforcePolicy, PPO optimization, GAE |
| `src/mage_knight_sdk/sim/rl/native_rl_runner.py` | Native engine game loop for RL |
| `src/mage_knight_sdk/sim/rl/features.py` | State/action feature encoding |
| `src/mage_knight_sdk/sim/rl/rewards.py` | Reward configuration |
| `src/mage_knight_sdk/sim/rl/vocabularies.py` | Entity ID vocabularies for embeddings |
| `src/mage_knight_sdk/tools/import_tensorboard.py` | NDJSON → TensorBoard importer |
| `src/mage_knight_sdk/viewer/` | Artifact viewer (Flask app) |
| `scripts/train` | Training session manager (start/stop/status/list) |
| `scripts/run-tensorboard` | TensorBoard launcher |
| `scripts/run-train-rl` | Convenience wrapper for train_rl |
| `pyproject.toml` | Package metadata and dependencies |
