#!/usr/bin/env python3
"""
Run a single full game with high step limit to find edge cases.

Usage:
  mage-knight-run-game [--seed SEED] [--max-steps STEPS]
  python3 -m mage_knight_sdk.cli.run_game [--seed SEED] [--max-steps STEPS]
"""
from __future__ import annotations

import argparse

from mage_knight_sdk.sim import RunnerConfig, run_simulations_sync


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a single full game")
    parser.add_argument("--seed", type=int, default=1, help="Random seed (default: 1)")
    parser.add_argument("--max-steps", type=int, default=10000, help="Max steps (default: 10000)")
    parser.add_argument("--no-undo", action="store_true", help="Disable UNDO actions")
    parser.add_argument("--save-failure", action="store_true", help="Write full failure artifact if run fails/stalls (default: summary-only)")
    parser.add_argument("--save-artifact", action="store_true", help="Always write full run artifact (trace + message log) regardless of outcome")
    parser.add_argument("--bootstrap-url", default="http://127.0.0.1:3001", help="Bootstrap API base URL")
    parser.add_argument("--ws-url", default="ws://127.0.0.1:3001", help="WebSocket server URL")
    args = parser.parse_args()

    config = RunnerConfig(
        bootstrap_api_base_url=args.bootstrap_url,
        ws_server_url=args.ws_url,
        player_count=2,
        runs=1,
        max_steps=args.max_steps,
        base_seed=args.seed,
        artifacts_dir="./sim-artifacts",
        write_failure_artifacts=args.save_failure,
        write_full_artifact=args.save_artifact,
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

    return 0 if result.outcome == "ended" else 1


if __name__ == "__main__":
    raise SystemExit(main())
