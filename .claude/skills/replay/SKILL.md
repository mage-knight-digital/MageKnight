---
name: replay
description: "Generate UI-viewable replay artifacts from a trained RL checkpoint. Use when user asks to generate replays, view agent behavior, or step through games."
user-invocable: true
argument-hint: "[run-name or checkpoint-path] [--seeds 1-5] [--no-oracle]"
---

# Generate Replay Artifacts

Generate artifact JSON files from a trained RL checkpoint that can be viewed in the client replay viewer.

## Quick Reference

```bash
cd packages/python-sdk && source .venv/bin/activate
python scripts/generate_replays.py <checkpoint> --artifact --combat-oracle --seeds 1-5 --output-dir sim-artifacts/<run-name>
```

## Workflow

### 1. Resolve the Checkpoint

**If run name provided** (e.g., `/replay explore-fix-v1`):
```bash
# Find the latest checkpoint in the run
ls packages/python-sdk/training/runs/$1/checkpoints/ | sort | tail -1
```
Checkpoint path: `training/runs/$1/checkpoints/<latest>.pt`

**If full checkpoint path provided**: Use it directly.

**If no argument**: List available runs and ask which one.
```bash
ls packages/python-sdk/training/runs/
```

### 2. Parse Options

- `--seeds N-M` — Seed range (default: `1-5`)
- `--no-oracle` — Skip combat oracle (default: oracle enabled)
- Run name is derived from the checkpoint path or argument

### 3. Generate Artifacts

**IMPORTANT**: Output directory must use `sim-artifacts/` (hyphen, not underscore) to match the Vite server config.

```bash
cd packages/python-sdk && source .venv/bin/activate

python scripts/generate_replays.py \
  training/runs/<run-name>/checkpoints/<checkpoint>.pt \
  --artifact \
  --combat-oracle \
  --seeds 1-5 \
  --output-dir sim-artifacts/<run-name>
```

Omit `--combat-oracle` if `--no-oracle` was specified.

### 4. Report Results

Show a table of results:
- Seed, Hero, Steps, Fame, Level, Rounds, Outcome

Tell the user:
- Artifacts are in `packages/python-sdk/sim-artifacts/<run-name>/`
- To view: start UI with `bun run dev:rust`, open replay viewer, and select from the dropdown (or drag & drop any JSON file)

## Notes

- `set_rl_mode(True)` is already called by the script — this disables undo actions
- Combat oracle uses exhaustive tree search (1M node limit) for optimal combat play
- Artifact files contain full state snapshots at every step, viewable frame-by-frame in the UI
- The Vite dev server auto-discovers artifacts from `packages/python-sdk/sim-artifacts/` via the `/__artifacts` endpoint
- The `sim-artifacts/` directory is gitignored
