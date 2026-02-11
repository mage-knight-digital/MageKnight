#!/usr/bin/env python3
"""
Run a single full game with high step limit to find edge cases.

Usage:
  python3 run_full_game.py [--seed SEED] [--max-steps STEPS]
"""
import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SDK_SRC = REPO_ROOT / "packages/python-sdk/src"
sys.path.insert(0, str(SDK_SRC))

from mage_knight_sdk.sim.runner import RunnerConfig, run_simulations_sync

parser = argparse.ArgumentParser(description="Run a single full game")
parser.add_argument("--seed", type=int, default=1, help="Random seed (default: 1)")
parser.add_argument("--max-steps", type=int, default=10000, help="Max steps (default: 10000)")
parser.add_argument("--no-undo", action="store_true", help="Disable UNDO actions")
parser.add_argument("--save-failure", action="store_true", help="Write full failure artifact if run fails/stalls (default: summary-only)")
args = parser.parse_args()

config = RunnerConfig(
    bootstrap_api_base_url="http://127.0.0.1:3001",
    ws_server_url="ws://127.0.0.1:3001",
    player_count=2,
    runs=1,
    max_steps=args.max_steps,
    base_seed=args.seed,
    artifacts_dir="./sim-artifacts",
    write_failure_artifacts=args.save_failure,
    allow_undo=not args.no_undo,
)

results, summary = run_simulations_sync(config)
result = results[0]

print(f"\n{'='*60}")
print(f"Game Result: {result.outcome}")
print(f"Steps: {result.steps}")
print(f"Reason: {result.reason}")
if result.failure_artifact_path:
    print(f"Artifact: {result.failure_artifact_path}")
print(f"{'='*60}")
