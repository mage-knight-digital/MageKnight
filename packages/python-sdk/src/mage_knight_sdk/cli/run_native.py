#!/usr/bin/env python3
"""
Run games using the native Rust engine (no TS server required).

Usage:
  mage-knight-run-native [--seed SEED] [--max-steps STEPS]
  mage-knight-run-native --start-seed 1 --count 100
  mage-knight-run-native --runs 50 --no-undo
"""
from __future__ import annotations

import argparse
import random
import time

from mage_knight_sdk.sim.native_runner import run_native_game, run_native_sweep
from mage_knight_sdk.sim.reporting import OUTCOME_ENDED, RunResult, summarize


def _build_seed_list(
    runs: int | None,
    start_seed: int | None,
    end_seed: int | None,
    count: int | None,
    single_seed: int | None,
) -> list[int]:
    """Build list of seeds from CLI arguments."""
    # Single seed mode (--seed)
    if single_seed is not None:
        return [single_seed]

    # Random seeds mode (--runs)
    if runs is not None:
        return [random.randint(0, 2**31 - 1) for _ in range(runs)]

    # Deterministic range (--start-seed with --count or --end-seed)
    if start_seed is not None:
        if end_seed is not None:
            return list(range(start_seed, end_seed + 1))
        if count is not None:
            return list(range(start_seed, start_seed + count))
        return [start_seed]

    # Default: single seed
    return [1]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run games using the native Rust engine",
        epilog=(
            "Examples:\n"
            "  Single game:      mage-knight-run-native --seed 42\n"
            "  Sweep:            mage-knight-run-native --start-seed 1 --count 100\n"
            "  Random fuzzing:   mage-knight-run-native --runs 50 --no-undo\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument("--seed", type=int, help="Single seed to run")
    parser.add_argument("--runs", type=int, help="Number of runs with random seeds")
    parser.add_argument("--start-seed", type=int, help="First seed in deterministic range")
    parser.add_argument("--end-seed", type=int, help="Last seed in range (inclusive)")
    parser.add_argument("--count", type=int, help="Number of sequential seeds")
    parser.add_argument("--max-steps", type=int, default=10000, help="Max steps per game (default: 10000)")
    parser.add_argument("--hero", default="arythea", help="Hero name (default: arythea)")
    parser.add_argument("--no-undo", action="store_true", help="Disable UNDO actions")
    parser.add_argument("--stop-on-failure", action="store_true", help="Stop at first non-ended outcome")
    parser.add_argument("--quiet", action="store_true", help="Only print summary, not per-seed progress")
    args = parser.parse_args()

    seeds = _build_seed_list(args.runs, args.start_seed, args.end_seed, args.count, args.seed)

    t_start = time.perf_counter()

    if len(seeds) == 1:
        # Single game mode — more detailed output
        seed = seeds[0]
        rng = random.Random(seed)
        result = run_native_game(
            seed,
            hero=args.hero,
            max_steps=args.max_steps,
            allow_undo=not args.no_undo,
            rng=rng,
        )
        elapsed = time.perf_counter() - t_start
        sps = result.steps / elapsed if elapsed > 0 else 0

        print(f"\n{'=' * 60}")
        print(f"Engine: Rust (native, no server)")
        print(f"Hero: {args.hero}, Seed: {seed}")
        print(f"Outcome: {result.outcome}")
        print(f"Steps: {result.steps}")
        if result.reason:
            print(f"Reason: {result.reason}")
        print(f"Wall time: {elapsed:.3f}s ({sps:.0f} steps/sec)")
        print(f"{'=' * 60}")

        return 0 if result.outcome == OUTCOME_ENDED else 1
    else:
        # Sweep mode
        mode_desc = f"random seeds" if args.runs else f"seeds {seeds[0]}..{seeds[-1]}"
        print(f"Running {len(seeds)} games ({mode_desc}) with Rust engine")
        print(f"Hero: {args.hero}, max_steps={args.max_steps}, allow_undo={not args.no_undo}")
        print("-" * 72)

        results, summary = run_native_sweep(
            seeds,
            hero=args.hero,
            max_steps=args.max_steps,
            allow_undo=not args.no_undo,
            stop_on_failure=args.stop_on_failure,
            verbose=not args.quiet,
        )

        elapsed = time.perf_counter() - t_start
        total_steps = sum(r.steps for r in results)
        sps = total_steps / elapsed if elapsed > 0 else 0

        print("-" * 72)
        print(f"Completed {len(results)} games in {elapsed:.1f}s")
        print(f"  ended={summary.ended}  max_steps={summary.max_steps}  "
              f"invariant_failure={summary.invariant_failure}")
        print(f"  Throughput: {len(results) / elapsed:.1f} games/s, {sps:.0f} steps/s")

        return 1 if summary.invariant_failure > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
