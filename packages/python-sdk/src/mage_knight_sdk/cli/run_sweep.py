#!/usr/bin/env python3
"""
Run a range of simulation seeds in one command.

Examples:
  mage-knight-run-sweep --start-seed 1 --end-seed 100 --no-undo
  mage-knight-run-sweep --start-seed 1 --count 200 --no-undo --stop-on-failure
  mage-knight-run-sweep --start-seed 1 --count 20 --benchmark
  mage-knight-run-sweep --start-seed 1 --count 5 --profile
"""
from __future__ import annotations

import argparse
import sys
import time

from mage_knight_sdk.sim import RunnerConfig, run_simulations_sync


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
    parser.add_argument("--benchmark", action="store_true", help="Report timing: per-run, throughput, bottlenecks")
    parser.add_argument("--profile", action="store_true", help="Run with cProfile, print top 20 hotspots")
    parser.add_argument("--save-failures", action="store_true", help="Write full failure artifacts (action trace + messages); default is summary-only (reproducible by seed)")
    args = parser.parse_args()

    if args.profile:
        import cProfile
        import pstats
        prof = cProfile.Profile()
        prof.enable()
        try:
            return _run_sweep(args)
        finally:
            prof.disable()
            ps = pstats.Stats(prof)
            ps.sort_stats(pstats.SortKey.CUMULATIVE)
            ps.print_stats(20)

    return _run_sweep(args)


def _run_sweep(args: argparse.Namespace) -> int:
    try:
        seeds = _build_seed_list(args.start_seed, args.end_seed, args.count)
    except ValueError as err:
        print(f"Argument error: {err}", file=sys.stderr)
        return 2

    failures = 0
    timings: list[tuple[int, float, int, str]] = []  # (seed, sec, steps, outcome)
    t_start = time.perf_counter()

    print(f"Running {len(seeds)} seed(s): {seeds[0]}..{seeds[-1]}")
    print(f"Options: max_steps={args.max_steps}, allow_undo={not args.no_undo}")
    if args.benchmark:
        print("(Benchmark mode: timing each run)")
    print("-" * 72)

    for index, seed in enumerate(seeds, start=1):
        t0 = time.perf_counter()
        config = RunnerConfig(
            bootstrap_api_base_url=args.bootstrap_url,
            ws_server_url=args.ws_url,
            player_count=2,
            runs=1,
            max_steps=args.max_steps,
            base_seed=seed,
            artifacts_dir=args.artifacts_dir,
            write_failure_artifacts=args.save_failures,
            allow_undo=not args.no_undo,
        )
        results, _ = run_simulations_sync(config)
        result = results[0]
        elapsed = time.perf_counter() - t0
        if args.benchmark:
            timings.append((seed, elapsed, result.steps, result.outcome))

        status = "OK" if result.outcome == "ended" else "FAIL"
        artifact = f" artifact={result.failure_artifact_path}" if result.failure_artifact_path else ""
        reason = f" reason={result.reason}" if result.reason else ""
        print(f"[{index}/{len(seeds)}] seed={seed} outcome={result.outcome} steps={result.steps} [{status}]{reason}{artifact}")

        if result.outcome != "ended":
            failures += 1
            if args.stop_on_failure:
                break

    print("-" * 72)
    t_total = time.perf_counter() - t_start

    if args.benchmark and timings:
        _print_benchmark(timings, t_total)

    print(f"Completed. failures={failures}")
    return 1 if failures > 0 else 0


def _print_benchmark(
    timings: list[tuple[int, float, int, str]], t_total: float
) -> None:
    """Print timing breakdown for the sweep."""
    n = len(timings)
    total_steps = sum(t for _, _, t, _ in timings)
    elapsed = [e for _, e, _, _ in timings]
    elapsed.sort()

    print("\n--- Benchmark ---")
    print(f"Runs: {n}, Total wall time: {t_total:.1f}s")
    print(f"Throughput: {n / t_total:.1f} runs/s, {total_steps / t_total:.0f} steps/s")
    p50 = elapsed[n // 2] * 1000 if n else 0
    p95 = elapsed[min(int(n * 0.95), n - 1)] * 1000 if n > 1 else p50
    p99 = elapsed[min(int(n * 0.99), n - 1)] * 1000 if n > 1 else p50
    print(f"Per-run time: p50={p50:.0f}ms  p95={p95:.0f}ms  p99={p99:.0f}ms")
    # Slowest runs
    by_time = sorted(timings, key=lambda x: -x[1])
    print("Slowest 5 runs:")
    for seed, sec, steps, outcome in by_time[:5]:
        sps = steps / sec if sec > 0 else 0
        print(f"  {sec:.1f}s  {steps} steps  {sps:.0f} steps/s  seed={seed}  outcome={outcome}")
    print("\nBottlenecks (typical): network round-trips per step, artifact write on failure, enumerate_valid_actions")


if __name__ == "__main__":
    raise SystemExit(main())
