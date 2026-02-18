#!/usr/bin/env python3
"""End-to-end pipeline throughput benchmark with concurrency sweep.

Replaces benchmark_inference.py and benchmark_scaling.py with a single tool
that uses only the public run_simulations_batch_sync() API.

Usage:
    python3 scripts/bench_throughput.py --concurrency-levels 1,4,8,16
    python3 scripts/bench_throughput.py --concurrency-levels 1,4 --json /tmp/before.json
    python3 scripts/bench_throughput.py --concurrency-levels 1,4 --compare /tmp/before.json

Requires a Mage Knight server running on localhost:3001.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

from mage_knight_sdk.sim import RunnerConfig, StepTimings, run_simulations_batch_sync
from mage_knight_sdk.sim.rl.policy_gradient import PolicyGradientConfig, ReinforcePolicy
from mage_knight_sdk.sim.rl.rewards import RewardConfig
from mage_knight_sdk.sim.rl.trainer import PPOTrainer


def _make_configs(
    n_games: int, seed: int, max_steps: int,
) -> list[RunnerConfig]:
    return [
        RunnerConfig(
            bootstrap_api_base_url="http://localhost:3001",
            ws_server_url="ws://localhost:3001",
            player_count=1,
            runs=1,
            max_steps=max_steps,
            base_seed=seed + i,
            artifacts_dir="/tmp/benchmark-artifacts",
            write_failure_artifacts=False,
            allow_undo=False,
            skip_run_summary=True,
            collect_step_timings=True,
        )
        for i in range(n_games)
    ]


def _run_level(
    n_games: int, seed: int, max_steps: int,
    policy: ReinforcePolicy, reward_config: RewardConfig,
) -> dict[str, Any]:
    """Run n_games concurrently, return timing stats."""
    configs = _make_configs(n_games, seed, max_steps)
    trainers: list[PPOTrainer] = []
    coordinator_stats_holder: list[dict] = []

    def make_trainer() -> PPOTrainer:
        t = PPOTrainer(policy=policy, reward_config=reward_config)
        trainers.append(t)
        return t

    t0 = time.perf_counter()
    results = run_simulations_batch_sync(
        configs, policy,
        hooks_factory=make_trainer,
        concurrent=n_games > 1,
        coordinator_stats_callback=lambda s: coordinator_stats_holder.append(s),
    )
    elapsed = time.perf_counter() - t0

    # Aggregate timings
    agg = StepTimings()
    completed = 0
    for outcome, _hooks in results:
        if outcome.result.outcome == "ended":
            completed += 1
        t = outcome.result.step_timings
        if t is not None:
            agg.enumerate_ns += t.enumerate_ns
            agg.sort_ns += t.sort_ns
            agg.policy_ns += t.policy_ns
            agg.server_ns += t.server_ns
            agg.hooks_ns += t.hooks_ns
            agg.overhead_ns += t.overhead_ns
            agg.step_count += t.step_count

    return {
        "n_games": n_games,
        "elapsed_s": elapsed,
        "completed": completed,
        "total_steps": agg.step_count,
        "steps_per_sec": agg.step_count / elapsed if elapsed > 0 else 0,
        "games_per_sec": n_games / elapsed if elapsed > 0 else 0,
        "step_timings": agg.summary() if agg.step_count > 0 else None,
        "coordinator_stats": coordinator_stats_holder[0] if coordinator_stats_holder else None,
    }


def _print_level(stats: dict[str, Any]) -> None:
    n = stats["n_games"]
    elapsed = stats["elapsed_s"]
    steps = stats["total_steps"]

    print(f"\n{'='*60}")
    print(f"  {n} concurrent game(s)")
    print(f"{'='*60}")
    print(f"  Wall time:     {elapsed:.2f}s  ({stats['games_per_sec']:.2f} g/s)")
    print(f"  Total steps:   {steps}  ({stats['steps_per_sec']:.0f} steps/s)")
    print(f"  Completed:     {stats['completed']}/{n}")

    st = stats.get("step_timings")
    if st:
        print(f"\n  Per-step breakdown:")
        for name in ("enumerate", "sort", "policy", "server", "hooks", "overhead"):
            row = st[name]
            print(f"    {name:<14} {row['per_step_ms']:>8.2f} ms/step  ({row['pct']:>5.1f}%)")

    cs = stats.get("coordinator_stats")
    if cs:
        print(f"\n  Coordinator: {cs['batch_count']} batches, "
              f"avg size {cs['avg_batch_size']:.1f}")


def _print_scaling_table(all_results: list[dict[str, Any]]) -> None:
    print(f"\n{'='*70}")
    print(f"  SCALING SUMMARY")
    print(f"{'='*70}")
    print(f"  {'Games':>5}  {'Wall(s)':>7}  {'g/s':>6}  {'steps/s':>8}  {'ms/step':>8}  {'server%':>8}")
    print(f"  {'─'*5}  {'─'*7}  {'─'*6}  {'─'*8}  {'─'*8}  {'─'*8}")

    for s in all_results:
        n = s["n_games"]
        elapsed = s["elapsed_s"]
        steps = s["total_steps"]
        wall_ms = elapsed * 1000 / steps if steps else 0
        st = s.get("step_timings")
        server_pct = st["server"]["pct"] if st else 0
        print(f"  {n:>5}  {elapsed:>7.2f}  {s['games_per_sec']:>6.2f}  "
              f"{s['steps_per_sec']:>8.0f}  {wall_ms:>8.2f}  {server_pct:>7.1f}%")


def _print_comparison(current: list[dict[str, Any]], baseline: list[dict[str, Any]]) -> None:
    """Print delta table between current and baseline runs."""
    baseline_map = {b["n_games"]: b for b in baseline}

    print(f"\n{'='*70}")
    print(f"  COMPARISON vs BASELINE")
    print(f"{'='*70}")
    print(f"  {'Games':>5}  {'Baseline g/s':>12}  {'Current g/s':>11}  {'Delta':>8}  {'Change':>8}")
    print(f"  {'─'*5}  {'─'*12}  {'─'*11}  {'─'*8}  {'─'*8}")

    for c in current:
        n = c["n_games"]
        b = baseline_map.get(n)
        if b is None:
            print(f"  {n:>5}  {'N/A':>12}  {c['games_per_sec']:>10.2f}  {'N/A':>8}  {'N/A':>8}")
            continue
        b_gps = b["games_per_sec"]
        c_gps = c["games_per_sec"]
        delta = c_gps - b_gps
        pct = (delta / b_gps * 100) if b_gps > 0 else 0
        sign = "+" if delta >= 0 else ""
        print(f"  {n:>5}  {b_gps:>12.2f}  {c_gps:>11.2f}  {sign}{delta:>7.2f}  {sign}{pct:>6.1f}%")

    # Also compare steps/sec
    print()
    print(f"  {'Games':>5}  {'Baseline s/s':>12}  {'Current s/s':>11}  {'Delta':>8}  {'Change':>8}")
    print(f"  {'─'*5}  {'─'*12}  {'─'*11}  {'─'*8}  {'─'*8}")

    for c in current:
        n = c["n_games"]
        b = baseline_map.get(n)
        if b is None:
            continue
        b_sps = b["steps_per_sec"]
        c_sps = c["steps_per_sec"]
        delta = c_sps - b_sps
        pct = (delta / b_sps * 100) if b_sps > 0 else 0
        sign = "+" if delta >= 0 else ""
        print(f"  {n:>5}  {b_sps:>12.0f}  {c_sps:>11.0f}  {sign}{delta:>7.0f}  {sign}{pct:>6.1f}%")


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark end-to-end throughput with concurrency sweep")
    parser.add_argument("--concurrency-levels", default="1,4,8,16,24",
                        help="Comma-separated concurrency levels (default: 1,4,8,16,24)")
    parser.add_argument("--seed", type=int, default=100, help="Base seed")
    parser.add_argument("--max-steps", type=int, default=5000, help="Max steps per game")
    parser.add_argument("--json", metavar="PATH", help="Write results as JSON to PATH")
    parser.add_argument("--compare", metavar="PATH", help="Compare against baseline JSON")
    args = parser.parse_args()

    levels = [int(x) for x in args.concurrency_levels.split(",")]

    config = PolicyGradientConfig(
        hidden_size=128, embedding_dim=16, use_embeddings=True, device="cpu",
    )
    reward_config = RewardConfig()

    print(f"Throughput benchmark")
    print(f"Concurrency levels: {levels}")
    print(f"Max steps/game: {args.max_steps}")

    all_results: list[dict[str, Any]] = []
    for n in levels:
        policy = ReinforcePolicy(config)
        print(f"\n>>> Running {n} concurrent game(s)...")
        stats = _run_level(n, args.seed, args.max_steps, policy, reward_config)
        all_results.append(stats)
        _print_level(stats)

    _print_scaling_table(all_results)

    # JSON output
    if args.json:
        path = Path(args.json)
        path.parent.mkdir(parents=True, exist_ok=True)
        output = {
            "tool": "bench_throughput",
            "seed": args.seed,
            "max_steps": args.max_steps,
            "levels": all_results,
        }
        path.write_text(json.dumps(output, indent=2), encoding="utf-8")
        print(f"\nJSON output: {path}")

    # Comparison
    if args.compare:
        baseline_path = Path(args.compare)
        if not baseline_path.exists():
            print(f"\nBaseline file not found: {baseline_path}")
            return
        baseline_data = json.loads(baseline_path.read_text(encoding="utf-8"))
        _print_comparison(all_results, baseline_data["levels"])


if __name__ == "__main__":
    main()
