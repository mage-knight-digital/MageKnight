#!/usr/bin/env python3
"""Benchmark per-step latency scaling with concurrency.

Runs 1, 4, 8, 16, 24 concurrent games and reports per-step timing breakdown
at each level. This isolates true server latency from event loop contention.

Usage:
    python3 scripts/benchmark_scaling.py [--seed 100] [--max-steps 5000]

Requires a Mage Knight server running on localhost:3001.
"""
from __future__ import annotations

import argparse
import asyncio
import time

from mage_knight_sdk.sim.bootstrap import BootstrapClient
from mage_knight_sdk.sim.config import RunnerConfig
from mage_knight_sdk.sim.reporting import StepTimings
from mage_knight_sdk.sim.rl.batch_coordinator import BatchInferenceCoordinator
from mage_knight_sdk.sim.rl.policy_gradient import PolicyGradientConfig, ReinforcePolicy
from mage_knight_sdk.sim.rl.rewards import RewardConfig
from mage_knight_sdk.sim.rl.trainer import PPOTrainer
from mage_knight_sdk.sim.runner import _run_single_simulation


def _make_configs(n_games: int, seed: int, max_steps: int) -> list[RunnerConfig]:
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


async def _run_n_games(
    n_games: int,
    seed: int,
    max_steps: int,
    policy: ReinforcePolicy,
    reward_config: RewardConfig,
    use_coordinator: bool,
) -> dict:
    """Run n_games concurrently, return aggregated timing stats."""
    configs = _make_configs(n_games, seed, max_steps)
    client = BootstrapClient(configs[0].bootstrap_api_base_url)

    coordinator = None
    coordinator_task = None
    if use_coordinator and n_games > 1:
        coordinator = BatchInferenceCoordinator(policy)
        coordinator_task = asyncio.create_task(coordinator.run())

    try:
        prepared = []
        for config in configs:
            trainer = PPOTrainer(policy=policy, reward_config=reward_config)
            prepared.append((config, trainer))

        tasks = [
            _run_single_simulation(
                run_index=0,
                seed=config.base_seed,
                config=config,
                policy=policy,
                hooks=trainer,
                bootstrap_client=client,
                coordinator=coordinator,
            )
            for config, trainer in prepared
        ]

        t0 = time.perf_counter()
        outcomes = await asyncio.gather(*tasks)
        elapsed = time.perf_counter() - t0
    finally:
        if coordinator_task is not None:
            coordinator_task.cancel()
            try:
                await coordinator_task
            except asyncio.CancelledError:
                pass
        client.close()

    # Aggregate timings across all games
    total_steps = 0
    agg_enumerate = 0
    agg_sort = 0
    agg_policy = 0
    agg_server = 0
    agg_hooks = 0
    agg_overhead = 0
    completed = 0

    for outcome in outcomes:
        total_steps += outcome.result.steps
        if outcome.result.outcome == "ended":
            completed += 1
        t = outcome.step_timings
        if t is not None:
            agg_enumerate += t.enumerate_ns
            agg_sort += t.sort_ns
            agg_policy += t.policy_ns
            agg_server += t.server_ns
            agg_hooks += t.hooks_ns
            agg_overhead += t.overhead_ns

    coordinator_stats = coordinator.stats if coordinator else None

    return {
        "n_games": n_games,
        "elapsed": elapsed,
        "completed": completed,
        "total_steps": total_steps,
        "agg_enumerate_ms": agg_enumerate / 1e6,
        "agg_sort_ms": agg_sort / 1e6,
        "agg_policy_ms": agg_policy / 1e6,
        "agg_server_ms": agg_server / 1e6,
        "agg_hooks_ms": agg_hooks / 1e6,
        "agg_overhead_ms": agg_overhead / 1e6,
        "coordinator_stats": coordinator_stats,
    }


def _print_row(stats: dict) -> None:
    n = stats["n_games"]
    steps = stats["total_steps"]
    elapsed = stats["elapsed"]
    per_step = elapsed * 1000 / steps if steps else 0

    # Per-step averages in microseconds
    enum_us = stats["agg_enumerate_ms"] * 1000 / steps if steps else 0
    sort_us = stats["agg_sort_ms"] * 1000 / steps if steps else 0
    policy_us = stats["agg_policy_ms"] * 1000 / steps if steps else 0
    server_us = stats["agg_server_ms"] * 1000 / steps if steps else 0
    hooks_us = stats["agg_hooks_ms"] * 1000 / steps if steps else 0
    overhead_us = stats["agg_overhead_ms"] * 1000 / steps if steps else 0
    cpu_us = enum_us + sort_us + policy_us + hooks_us + overhead_us

    print(f"\n{'='*65}")
    print(f"  {n} concurrent game(s)")
    print(f"{'='*65}")
    print(f"  Wall time:       {elapsed:.2f}s  ({n / elapsed:.2f} g/s)")
    print(f"  Total steps:     {steps}  ({steps / elapsed:.0f} steps/s)")
    print(f"  Completed:       {stats['completed']}/{n}")
    print(f"  Wall per-step:   {per_step:.2f} ms")
    print(f"")
    print(f"  Per-step CPU breakdown (aggregate / steps):")
    print(f"    enumerate:     {enum_us:8.0f} us")
    print(f"    sort:          {sort_us:8.0f} us")
    print(f"    policy:        {policy_us:8.0f} us")
    print(f"    server await:  {server_us:8.0f} us")
    print(f"    hooks:         {hooks_us:8.0f} us")
    print(f"    overhead:      {overhead_us:8.0f} us")
    print(f"    ─────────────────────────")
    print(f"    total CPU:     {cpu_us:8.0f} us  (excl. server await)")
    print(f"    server await:  {server_us:8.0f} us")

    cs = stats.get("coordinator_stats")
    if cs:
        print(f"")
        print(f"  Coordinator: {cs['batch_count']} batches, "
              f"avg size {cs['avg_batch_size']:.1f}")


def _print_scaling_table(results: list[dict]) -> None:
    """Print a compact comparison table."""
    print(f"\n{'='*65}")
    print(f"  SCALING SUMMARY")
    print(f"{'='*65}")
    print(f"  {'Games':>5}  {'Wall(s)':>7}  {'g/s':>5}  {'steps':>6}  "
          f"{'server_us/step':>14}  {'cpu_us/step':>11}  {'wall_ms/step':>12}")
    print(f"  {'─'*5}  {'─'*7}  {'─'*5}  {'─'*6}  {'─'*14}  {'─'*11}  {'─'*12}")
    for s in results:
        n = s["n_games"]
        steps = s["total_steps"]
        elapsed = s["elapsed"]
        server_us = s["agg_server_ms"] * 1000 / steps if steps else 0
        enum_us = s["agg_enumerate_ms"] * 1000 / steps if steps else 0
        sort_us = s["agg_sort_ms"] * 1000 / steps if steps else 0
        policy_us = s["agg_policy_ms"] * 1000 / steps if steps else 0
        hooks_us = s["agg_hooks_ms"] * 1000 / steps if steps else 0
        overhead_us = s["agg_overhead_ms"] * 1000 / steps if steps else 0
        cpu_us = enum_us + sort_us + policy_us + hooks_us + overhead_us
        wall_ms = elapsed * 1000 / steps if steps else 0
        print(f"  {n:>5}  {elapsed:>7.2f}  {n/elapsed:>5.2f}  {steps:>6}  "
              f"{server_us:>14.0f}  {cpu_us:>11.0f}  {wall_ms:>12.2f}")

    # Key insight: if server_us scales linearly with N, the server is the bottleneck.
    # If server_us stays flat but wall time grows, event loop contention is the issue.
    if len(results) >= 2:
        base = results[0]
        base_server = base["agg_server_ms"] * 1000 / base["total_steps"]
        print(f"\n  Interpretation (vs 1-game baseline of {base_server:.0f} us/step server):")
        for s in results[1:]:
            n = s["n_games"]
            steps = s["total_steps"]
            server_us = s["agg_server_ms"] * 1000 / steps if steps else 0
            ratio = server_us / base_server if base_server > 0 else 0
            print(f"    {n} games: server_us/step = {server_us:.0f} "
                  f"({ratio:.1f}x baseline, {ratio/n:.2f}x per concurrent game)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark scaling with concurrency")
    parser.add_argument("--seed", type=int, default=100, help="Base seed")
    parser.add_argument("--max-steps", type=int, default=5000, help="Max steps per game")
    parser.add_argument("--coordinator", action="store_true",
                        help="Use BatchInferenceCoordinator (default: no coordinator)")
    args = parser.parse_args()

    concurrency_levels = [1, 4, 8, 16, 24]

    config = PolicyGradientConfig(
        hidden_size=128, embedding_dim=16, use_embeddings=True, device="cpu",
    )
    reward_config = RewardConfig()

    label = "WITH" if args.coordinator else "WITHOUT"
    print(f"Scaling benchmark {label} coordinator")
    print(f"Concurrency levels: {concurrency_levels}")
    print(f"Max steps/game: {args.max_steps}")

    all_results = []
    for n in concurrency_levels:
        policy = ReinforcePolicy(config)  # Fresh policy each round
        print(f"\n>>> Running {n} concurrent game(s)...")
        stats = asyncio.run(_run_n_games(
            n_games=n,
            seed=args.seed,
            max_steps=args.max_steps,
            policy=policy,
            reward_config=reward_config,
            use_coordinator=args.coordinator,
        ))
        all_results.append(stats)
        _print_row(stats)

    _print_scaling_table(all_results)


if __name__ == "__main__":
    main()
