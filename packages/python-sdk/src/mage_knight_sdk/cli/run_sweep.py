#!/usr/bin/env python3
"""
Run a range of simulation seeds in one command.

Examples:
  # Random fuzzing (simple mode)
  mage-knight-run-sweep --runs 100 --no-undo

  # Deterministic seed ranges (for reproducibility)
  mage-knight-run-sweep --start-seed 1 --end-seed 100 --no-undo
  mage-knight-run-sweep --start-seed 1 --count 200 --no-undo --stop-on-failure
  mage-knight-run-sweep --start-seed 1 --count 20 --benchmark
"""
from __future__ import annotations

import argparse
import random
import sys
import time

from mage_knight_sdk.sim import RunnerConfig, StepTimings, run_simulations_sync


def _build_seed_list(
    runs: int | None,
    start_seed: int | None,
    end_seed: int | None,
    count: int | None,
) -> list[int]:
    """Build list of seeds to run.

    Args:
        runs: Number of random seeds to generate (mutually exclusive with start_seed)
        start_seed: First seed in deterministic range
        end_seed: Last seed in deterministic range
        count: Number of seeds in deterministic range

    Returns:
        List of seeds to run
    """
    # Mode 1: Random seeds (--runs)
    if runs is not None:
        if start_seed is not None or end_seed is not None or count is not None:
            raise ValueError("--runs cannot be combined with --start-seed, --end-seed, or --count")
        if runs < 1:
            raise ValueError("--runs must be >= 1")
        # Generate random seeds in a large range to avoid collisions
        return [random.randint(0, 2**31 - 1) for _ in range(runs)]

    # Mode 2: Deterministic seed range (--start-seed with --count or --end-seed)
    if start_seed is None:
        raise ValueError("Provide either --runs for random seeds, or --start-seed with --count/--end-seed for deterministic ranges")

    if end_seed is None and count is None:
        raise ValueError("When using --start-seed, provide either --end-seed or --count")
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
    parser = argparse.ArgumentParser(
        description="Run a seed range for full-game sim/fuzzer",
        epilog="Examples:\n"
               "  Random fuzzing: --runs 100 --no-undo --workers 8\n"
               "  Reproducible range: --start-seed 1000 --count 100 --no-undo\n"
               "  Single seed: use mage-knight-run-game --seed 1000",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # Simple mode: random seeds
    parser.add_argument("--runs", type=int, help="Number of runs with random seeds (simple mode)")

    # Deterministic mode: seed ranges
    parser.add_argument("--start-seed", type=int, help="First seed to run (deterministic mode)")
    parser.add_argument("--end-seed", type=int, help="Last seed to run (inclusive, use with --start-seed)")
    parser.add_argument("--count", type=int, help="Number of sequential seeds to run (use with --start-seed)")

    # Common options
    parser.add_argument("--max-steps", type=int, default=10000, help="Max steps per run")
    parser.add_argument("--no-undo", action="store_true", help="Disable UNDO actions")
    parser.add_argument("--stop-on-failure", action="store_true", help="Stop at first non-ended outcome")
    parser.add_argument("--artifacts-dir", default="./sim-artifacts", help="Where to write failure artifacts")
    parser.add_argument("--bootstrap-url", default="http://127.0.0.1:3001", help="Bootstrap API base URL (single server mode)")
    parser.add_argument("--ws-url", default="ws://127.0.0.1:3001", help="WebSocket server URL (single server mode)")
    parser.add_argument("--cluster-ports", type=str, help="Comma-separated ports for cluster mode (e.g., '3001,3002,3003,3004'). Overrides --bootstrap-url and --ws-url.")
    parser.add_argument("--benchmark", action="store_true", help="Report timing: per-run, throughput, bottlenecks")
    parser.add_argument("--profile", action="store_true", help="Run with cProfile, print top 20 hotspots")
    parser.add_argument("--save-failures", action="store_true", help="Write full failure artifacts (action trace + messages); default is summary-only (reproducible by seed)")
    parser.add_argument("--workers", type=int, default=1, help="Number of parallel workers (default=1 for sequential mode)")
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
        seeds = _build_seed_list(args.runs, args.start_seed, args.end_seed, args.count)
    except ValueError as err:
        print(f"Argument error: {err}", file=sys.stderr)
        return 2

    if args.workers > 1:
        return _run_sweep_parallel(args, seeds)
    return _run_sweep_sequential(args, seeds)


def _run_sweep_sequential(args: argparse.Namespace, seeds: list[int]) -> int:
    """Sequential execution (original implementation)."""
    failures = 0
    timings: list[tuple[int, float, int, str]] = []  # (seed, sec, steps, outcome)
    agg_step_timings = StepTimings() if args.benchmark else None
    t_start = time.perf_counter()

    mode = "random seeds" if args.runs else f"deterministic range {seeds[0]}..{seeds[-1]}"
    print(f"Running {len(seeds)} seed(s) ({mode})")
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
            collect_step_timings=args.benchmark,
        )
        results, _ = run_simulations_sync(config)
        result = results[0]
        elapsed = time.perf_counter() - t0
        if args.benchmark:
            timings.append((seed, elapsed, result.steps, result.outcome))
            if result.step_timings is not None and agg_step_timings is not None:
                agg_step_timings.enumerate_ns += result.step_timings.enumerate_ns
                agg_step_timings.sort_ns += result.step_timings.sort_ns
                agg_step_timings.policy_ns += result.step_timings.policy_ns
                agg_step_timings.server_ns += result.step_timings.server_ns
                agg_step_timings.hooks_ns += result.step_timings.hooks_ns
                agg_step_timings.overhead_ns += result.step_timings.overhead_ns
                agg_step_timings.step_count += result.step_timings.step_count

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
        if agg_step_timings is not None and agg_step_timings.step_count > 0:
            _print_step_timings(agg_step_timings, len(timings))

    print(f"Completed. failures={failures}")
    return 1 if failures > 0 else 0


def _run_sweep_parallel(args: argparse.Namespace, seeds: list[int]) -> int:
    """Parallel execution using ProcessPoolExecutor."""
    from concurrent.futures import ProcessPoolExecutor, as_completed
    from mage_knight_sdk.sim.parallel_runner import run_single_seed
    from mage_knight_sdk.sim.writer_process import start_writer_process, stop_writer_process

    failures = 0
    timings: list[tuple[int, float, int, str]] = []  # (seed, sec, steps, outcome)
    agg_step_timings = StepTimings() if args.benchmark else None
    t_start = time.perf_counter()

    # Parse cluster ports if provided
    server_urls: list[tuple[str, str]] | None = None
    if args.cluster_ports:
        ports = [int(p.strip()) for p in args.cluster_ports.split(",")]
        server_urls = [
            (f"http://127.0.0.1:{port}", f"ws://127.0.0.1:{port}")
            for port in ports
        ]
        cluster_info = f"cluster mode: {len(server_urls)} servers on ports {ports[0]}-{ports[-1]}"
    else:
        cluster_info = "single server"

    mode = "random seeds" if args.runs else f"deterministic range {seeds[0]}..{seeds[-1]}"
    print(f"Running {len(seeds)} seed(s) with {args.workers} workers ({mode}, {cluster_info})")
    print(f"Options: max_steps={args.max_steps}, allow_undo={not args.no_undo}")
    if args.benchmark:
        print("(Benchmark mode: timing each run)")
    print("-" * 72)

    # Start writer process
    writer_process, write_queue = start_writer_process(args.artifacts_dir)

    try:
        # Create base config (will be cloned per-seed in worker)
        base_config = RunnerConfig(
            bootstrap_api_base_url=args.bootstrap_url,
            ws_server_url=args.ws_url,
            player_count=2,
            runs=1,
            max_steps=args.max_steps,
            base_seed=0,  # Overridden per-seed
            artifacts_dir=args.artifacts_dir,
            write_failure_artifacts=args.save_failures,
            allow_undo=not args.no_undo,
            collect_step_timings=args.benchmark,
        )

        # Bounded submission: keep at most 2x workers in-flight to avoid
        # memory bloat from millions of Future objects.
        max_in_flight = args.workers * 2
        seed_iter = iter(enumerate(seeds))
        completed = 0
        stop_early = False

        with ProcessPoolExecutor(max_workers=args.workers) as executor:
            # Seed the pool with initial batch
            in_flight: dict[object, tuple[int, float]] = {}
            for _ in range(min(max_in_flight, len(seeds))):
                worker_idx, seed = next(seed_iter)
                fut = executor.submit(
                    run_single_seed, seed, base_config, None,
                    worker_idx % args.workers, server_urls,
                )
                in_flight[fut] = (seed, time.perf_counter())

            while in_flight and not stop_early:
                # Wait for the next future to complete
                done_set = as_completed(in_flight, timeout=None)
                for future in done_set:
                    seed, t0 = in_flight.pop(future)
                    completed += 1
                    elapsed = time.perf_counter() - t0

                    try:
                        result, summary_record = future.result()
                        write_queue.put(summary_record)

                        if args.benchmark:
                            timings.append((seed, elapsed, result.steps, result.outcome))
                            if result.step_timings is not None and agg_step_timings is not None:
                                agg_step_timings.enumerate_ns += result.step_timings.enumerate_ns
                                agg_step_timings.sort_ns += result.step_timings.sort_ns
                                agg_step_timings.policy_ns += result.step_timings.policy_ns
                                agg_step_timings.server_ns += result.step_timings.server_ns
                                agg_step_timings.hooks_ns += result.step_timings.hooks_ns
                                agg_step_timings.overhead_ns += result.step_timings.overhead_ns
                                agg_step_timings.step_count += result.step_timings.step_count

                        status = "OK" if result.outcome == "ended" else "FAIL"
                        artifact = f" artifact={result.failure_artifact_path}" if result.failure_artifact_path else ""
                        reason = f" reason={result.reason}" if result.reason else ""
                        print(f"[{completed}/{len(seeds)}] seed={seed} outcome={result.outcome} steps={result.steps} [{status}]{reason}{artifact}")

                        if result.outcome != "ended":
                            failures += 1
                            if args.stop_on_failure:
                                stop_early = True
                                for remaining in in_flight:
                                    remaining.cancel()
                                break

                    except Exception as err:
                        failures += 1
                        print(f"[{completed}/{len(seeds)}] seed={seed} EXCEPTION: {err}")
                        if args.stop_on_failure:
                            stop_early = True
                            for remaining in in_flight:
                                remaining.cancel()
                            break

                    # Submit next seed if available
                    try:
                        worker_idx, next_seed = next(seed_iter)
                        fut = executor.submit(
                            run_single_seed, next_seed, base_config, None,
                            worker_idx % args.workers, server_urls,
                        )
                        in_flight[fut] = (next_seed, time.perf_counter())
                    except StopIteration:
                        pass

                    # Only process one completion at a time to submit replacements promptly
                    break

    finally:
        # Stop writer process
        stop_writer_process(writer_process, write_queue)

    print("-" * 72)
    t_total = time.perf_counter() - t_start

    if args.benchmark and timings:
        _print_benchmark(timings, t_total)
        if agg_step_timings is not None and agg_step_timings.step_count > 0:
            _print_step_timings(agg_step_timings, len(timings))

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

def _print_step_timings(agg: StepTimings, num_games: int) -> None:
    """Print per-step component timing breakdown."""
    summary = agg.summary()
    print(f"\n--- Step Timing Breakdown (totals across {num_games} games, {agg.step_count} steps) ---")
    print(f"{'Component':<14} {'Total':>8}  {'Per-step':>10}  {'% of step':>9}")
    for name in ("enumerate", "sort", "policy", "server", "hooks", "overhead"):
        row = summary[name]
        total_s = row["total_ms"] / 1000
        print(f"{name:<14} {total_s:>7.1f}s  {row['per_step_ms']:>8.1f}ms  {row['pct']:>8.1f}%")
    print("\u2500" * 47)
    total_row = summary["total"]
    total_s = total_row["total_ms"] / 1000
    print(f"{'total':<14} {total_s:>7.1f}s  {total_row['per_step_ms']:>8.1f}ms  {total_row['pct']:>8.1f}%")


if __name__ == "__main__":
    raise SystemExit(main())
