#!/usr/bin/env python3
"""Benchmark inference throughput with concurrent game simulations.

Compares batched coordinator path vs serial choose_action path.

Usage:
    python3 scripts/benchmark_inference.py [--games 24] [--seed 42]

Requires a Mage Knight server running on localhost:3001.
"""
from __future__ import annotations

import argparse
import asyncio
import time
from typing import Any

from mage_knight_sdk.sim.config import RunnerConfig
from mage_knight_sdk.sim.rl.policy_gradient import PolicyGradientConfig, ReinforcePolicy
from mage_knight_sdk.sim.rl.rewards import RewardConfig
from mage_knight_sdk.sim.rl.trainer import PPOTrainer
from mage_knight_sdk.sim.runner import (
    _run_simulations_batch,
    run_simulations_batch_sync,
)


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
        )
        for i in range(n_games)
    ]


def _run_with_coordinator(
    configs: list[RunnerConfig],
    policy: ReinforcePolicy,
    reward_config: RewardConfig,
) -> dict[str, Any]:
    """Run with BatchInferenceCoordinator (batched path)."""
    trainers: list[PPOTrainer] = []

    def make_trainer() -> PPOTrainer:
        t = PPOTrainer(policy=policy, reward_config=reward_config)
        trainers.append(t)
        return t

    t0 = time.perf_counter()
    results = run_simulations_batch_sync(
        configs, policy, hooks_factory=make_trainer, concurrent=True,
    )
    elapsed = time.perf_counter() - t0

    completed = sum(1 for outcome, _ in results if outcome.result.outcome == "ended")
    total_steps = sum(outcome.result.steps for outcome, _ in results)
    total_transitions = sum(
        sum(len(ep) for ep in trainer._episodes) for trainer in trainers
    )
    return {
        "elapsed": elapsed,
        "completed": completed,
        "total_steps": total_steps,
        "total_transitions": total_transitions,
    }


def _run_without_coordinator(
    configs: list[RunnerConfig],
    policy: ReinforcePolicy,
    reward_config: RewardConfig,
) -> dict[str, Any]:
    """Run concurrent but WITHOUT coordinator (serial choose_action per game)."""
    trainers: list[PPOTrainer] = []

    def make_trainer() -> PPOTrainer:
        t = PPOTrainer(policy=policy, reward_config=reward_config)
        trainers.append(t)
        return t

    # Temporarily disable embeddings to prevent coordinator from activating,
    # then re-enable. Actually, simpler: just monkey-patch the import to skip.
    # Even simpler: run the async function directly with coordinator=None.
    from mage_knight_sdk.sim.bootstrap import BootstrapClient
    from mage_knight_sdk.sim.runner import _run_single_simulation

    async def _run_no_coordinator() -> list:
        client = BootstrapClient(configs[0].bootstrap_api_base_url)
        try:
            prepared = []
            for config in configs:
                hooks = make_trainer()
                prepared.append((config, hooks))

            tasks = [
                _run_single_simulation(
                    run_index=0,
                    seed=config.base_seed,
                    config=config,
                    policy=policy,
                    hooks=hooks,
                    bootstrap_client=client,
                    coordinator=None,  # Force no coordinator
                )
                for config, hooks in prepared
            ]
            outcomes = await asyncio.gather(*tasks)
            return [
                (outcome, hooks)
                for outcome, (_, hooks) in zip(outcomes, prepared)
            ]
        finally:
            client.close()

    t0 = time.perf_counter()
    results = asyncio.run(_run_no_coordinator())
    elapsed = time.perf_counter() - t0

    completed = sum(1 for outcome, _ in results if outcome.result.outcome == "ended")
    total_steps = sum(outcome.result.steps for outcome, _ in results)
    total_transitions = sum(
        sum(len(ep) for ep in trainer._episodes) for trainer in trainers
    )
    return {
        "elapsed": elapsed,
        "completed": completed,
        "total_steps": total_steps,
        "total_transitions": total_transitions,
    }


def _print_results(label: str, stats: dict[str, Any], n_games: int) -> None:
    print(f"\n{'='*50}")
    print(f"  {label}")
    print(f"{'='*50}")
    print(f"  Games:        {n_games}")
    print(f"  Completed:    {stats['completed']}/{n_games}")
    print(f"  Total steps:  {stats['total_steps']}")
    print(f"  Transitions:  {stats['total_transitions']}")
    print(f"  Elapsed:      {stats['elapsed']:.2f}s")
    print(f"  Games/sec:    {n_games / stats['elapsed']:.2f}")
    print(f"  Steps/sec:    {stats['total_steps'] / stats['elapsed']:.0f}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark batched vs serial inference")
    parser.add_argument("--games", type=int, default=24, help="Number of concurrent games")
    parser.add_argument("--seed", type=int, default=100, help="Base seed")
    parser.add_argument("--max-steps", type=int, default=5000, help="Max steps per game")
    parser.add_argument("--before-only", action="store_true", help="Only run without coordinator")
    parser.add_argument("--after-only", action="store_true", help="Only run with coordinator")
    args = parser.parse_args()

    config = PolicyGradientConfig(
        hidden_size=128,
        embedding_dim=16,
        use_embeddings=True,
        device="cpu",
    )
    reward_config = RewardConfig()

    if not args.after_only:
        # BEFORE: without coordinator
        policy = ReinforcePolicy(config)
        configs = _make_configs(args.games, args.seed, args.max_steps)
        print(f"Running {args.games} games WITHOUT coordinator...")
        before = _run_without_coordinator(configs, policy, reward_config)
        _print_results("WITHOUT BatchInferenceCoordinator", before, args.games)

    if not args.before_only:
        # AFTER: with coordinator
        policy = ReinforcePolicy(config)
        configs = _make_configs(args.games, args.seed, args.max_steps)
        print(f"\nRunning {args.games} games WITH coordinator...")
        after = _run_with_coordinator(configs, policy, reward_config)
        _print_results("WITH BatchInferenceCoordinator", after, args.games)

    if not args.before_only and not args.after_only:
        speedup = before["elapsed"] / after["elapsed"]
        print(f"\n{'='*50}")
        print(f"  SPEEDUP: {speedup:.2f}x")
        print(f"  Before: {before['elapsed']:.2f}s  After: {after['elapsed']:.2f}s")
        print(f"  Before: {args.games / before['elapsed']:.2f} g/s  After: {args.games / after['elapsed']:.2f} g/s")
        print(f"{'='*50}")


if __name__ == "__main__":
    main()
