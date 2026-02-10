#!/usr/bin/env python3
"""
Run a range of simulation seeds in one command.

Examples:
  python3 run_seed_sweep.py --start-seed 1 --end-seed 100 --no-undo
  python3 run_seed_sweep.py --start-seed 1 --count 200 --no-undo --stop-on-failure
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SDK_SRC = REPO_ROOT / "packages/python-sdk/src"
sys.path.insert(0, str(SDK_SRC))

from mage_knight_sdk.sim.runner import RunnerConfig, run_simulations_sync


def _build_seed_list(start_seed: int, end_seed: int | None, count: int | None) -> list[int]:
    if end_seed is None and count is None:
        raise ValueError("Provide either --end-seed or --count")
    if end_seed is not None and count is not None:
        raise ValueError("Provide only one of --end-seed or --count")

    if end_seed is not None:
        if end_seed < start_seed:
            raise ValueError("--end-seed must be >= --start-seed")
        return list(range(start_seed, end_seed + 1))

    assert count is not None
    if count < 1:
        raise ValueError("--count must be >= 1")
    return list(range(start_seed, start_seed + count))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a seed range for full-game sim/fuzzer")
    parser.add_argument("--start-seed", type=int, required=True, help="First seed to run")
    parser.add_argument("--end-seed", type=int, help="Last seed to run (inclusive)")
    parser.add_argument("--count", type=int, help="Number of sequential seeds to run")
    parser.add_argument("--max-steps", type=int, default=10000, help="Max steps per run")
    parser.add_argument("--no-undo", action="store_true", help="Disable UNDO actions")
    parser.add_argument("--stop-on-failure", action="store_true", help="Stop at first non-ended outcome")
    parser.add_argument("--artifacts-dir", default="./sim-artifacts", help="Where to write failure artifacts")
    parser.add_argument("--bootstrap-url", default="http://127.0.0.1:3001", help="Bootstrap API base URL")
    parser.add_argument("--ws-url", default="ws://127.0.0.1:3001", help="WebSocket server URL")
    args = parser.parse_args()

    try:
        seeds = _build_seed_list(args.start_seed, args.end_seed, args.count)
    except ValueError as err:
        print(f"Argument error: {err}", file=sys.stderr)
        return 2

    failures = 0
    print(f"Running {len(seeds)} seed(s): {seeds[0]}..{seeds[-1]}")
    print(f"Options: max_steps={args.max_steps}, allow_undo={not args.no_undo}")
    print("-" * 72)

    for index, seed in enumerate(seeds, start=1):
        config = RunnerConfig(
            bootstrap_api_base_url=args.bootstrap_url,
            ws_server_url=args.ws_url,
            player_count=2,
            runs=1,
            max_steps=args.max_steps,
            base_seed=seed,
            artifacts_dir=args.artifacts_dir,
            allow_undo=not args.no_undo,
        )
        results, _ = run_simulations_sync(config)
        result = results[0]

        status = "OK" if result.outcome == "ended" else "FAIL"
        artifact = f" artifact={result.failure_artifact_path}" if result.failure_artifact_path else ""
        reason = f" reason={result.reason}" if result.reason else ""
        print(f"[{index}/{len(seeds)}] seed={seed} outcome={result.outcome} steps={result.steps} [{status}]{reason}{artifact}")

        if result.outcome != "ended":
            failures += 1
            if args.stop_on_failure:
                break

    print("-" * 72)
    print(f"Completed. failures={failures}")
    return 1 if failures > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
