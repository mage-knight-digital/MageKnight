#!/usr/bin/env python3
"""Profile per-step bottlenecks in the RL training loop.

Runs a short training session with fine-grained sub-timings to identify
exactly where wall-clock time is spent. Does NOT modify production code.

Usage:
    source .venv/bin/activate
    python3 scripts/profile_step.py [--episodes 20] [--seed 99999]
"""

from __future__ import annotations

import argparse
import random
import statistics
from time import perf_counter_ns
from typing import Any

from mage_knight_sdk.sim import RunnerConfig, run_simulations_sync
from mage_knight_sdk.sim.rl.features import encode_step
from mage_knight_sdk.sim.rl.policy_gradient import (
    PolicyGradientConfig,
    ReinforcePolicy,
    StepInfo,
)
from mage_knight_sdk.sim.rl.rewards import RewardConfig, VictoryRewardComponent
from mage_knight_sdk.sim.rl.trainer import ReinforceTrainer
from mage_knight_sdk.sim.generated_action_enumerator import CandidateAction
from mage_knight_sdk.sim.hooks import StepSample

import torch


class ProfilingPolicy:
    """Wraps ReinforcePolicy to capture fine-grained sub-timings."""

    def __init__(self, inner: ReinforcePolicy) -> None:
        self._inner = inner
        self.timings: dict[str, list[int]] = {
            "encode_features": [],
            "network_forward": [],
            "action_selection": [],
            "bookkeeping": [],
        }

    def choose_action(
        self,
        state: dict[str, Any],
        player_id: str,
        valid_actions: list[CandidateAction],
        rng: random.Random,
    ) -> CandidateAction | None:
        if not valid_actions:
            return None

        self._inner._network.train()

        t0 = perf_counter_ns()
        encoded_step = encode_step(state, player_id, valid_actions)
        t1 = perf_counter_ns()
        self.timings["encode_features"].append(t1 - t0)

        logits, value = self._inner._network(encoded_step, self._inner._device)
        t2 = perf_counter_ns()
        self.timings["network_forward"].append(t2 - t1)

        log_probs = torch.log_softmax(logits, dim=0)
        selected_index = int(torch.multinomial(log_probs.exp(), 1).item())
        t3 = perf_counter_ns()
        self.timings["action_selection"].append(t3 - t2)

        self._inner._episode_log_probs.append(log_probs[selected_index])
        probs = log_probs.exp()
        self._inner._episode_entropies.append(-(probs * log_probs).sum())
        self._inner._episode_rewards.append(0.0)
        if value is not None:
            self._inner._episode_values.append(value)
        self._inner.last_step_info = StepInfo(
            encoded_step=encoded_step,
            action_index=selected_index,
            log_prob=float(log_probs[selected_index].detach().cpu().item()),
            value=float(value.detach().cpu().item()) if value is not None else 0.0,
        )
        t4 = perf_counter_ns()
        self.timings["bookkeeping"].append(t4 - t3)

        return valid_actions[selected_index]

    def __getattr__(self, name: str) -> Any:
        return getattr(self._inner, name)


class ProfilingHooks:
    """Wraps ReinforceTrainer hooks to measure on_step overhead."""

    def __init__(self, inner: ReinforceTrainer) -> None:
        self._inner = inner
        self.hook_timings: list[int] = []

    def on_step(self, sample: StepSample) -> None:
        t0 = perf_counter_ns()
        self._inner.on_step(sample)
        self.hook_timings.append(perf_counter_ns() - t0)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._inner, name)


def _fmt(ns_vals: list[int]) -> tuple[float, float, float]:
    """Return (mean_ms, median_ms, p99_ms) from a list of nanosecond values."""
    if not ns_vals:
        return 0.0, 0.0, 0.0
    mean = sum(ns_vals) / len(ns_vals) / 1e6
    med = statistics.median(ns_vals) / 1e6
    p99 = sorted(ns_vals)[min(int(len(ns_vals) * 0.99), len(ns_vals) - 1)] / 1e6
    return mean, med, p99


def run_sequential_profile(
    args: argparse.Namespace,
    hidden_size: int,
    num_layers: int,
    label: str,
) -> dict[str, Any]:
    """Run sequential profiling and return results dict."""
    config = PolicyGradientConfig(
        hidden_size=hidden_size,
        embedding_dim=args.embedding_dim,
        num_hidden_layers=num_layers,
        device="cpu",
    )
    inner_policy = ReinforcePolicy(config)
    profiling_policy = ProfilingPolicy(inner_policy)

    reward_config = RewardConfig(
        step_penalty=0.0,
        components=(VictoryRewardComponent(),),
    )
    trainer = ReinforceTrainer(policy=inner_policy, reward_config=reward_config)
    profiling_hooks = ProfilingHooks(trainer)

    all_coarse: dict[str, int] = {
        "enumerate_ns": 0, "sort_ns": 0, "policy_ns": 0,
        "server_ns": 0, "hooks_ns": 0, "overhead_ns": 0,
    }
    total_steps = 0
    wall_start = perf_counter_ns()

    for ep in range(args.episodes):
        seed = args.seed + ep
        runner_config = RunnerConfig(
            bootstrap_api_base_url="http://127.0.0.1:3001",
            ws_server_url="ws://127.0.0.1:3001",
            player_count=1,
            runs=1,
            max_steps=10000,
            base_seed=seed,
            artifacts_dir="/tmp/profile-artifacts",
            write_failure_artifacts=False,
            allow_undo=False,
            collect_step_timings=True,
        )

        results, _ = run_simulations_sync(
            runner_config, policy=profiling_policy, hooks=profiling_hooks,
        )
        result = results[0]
        if result.step_timings:
            all_coarse["enumerate_ns"] += result.step_timings.enumerate_ns
            all_coarse["sort_ns"] += result.step_timings.sort_ns
            all_coarse["policy_ns"] += result.step_timings.policy_ns
            all_coarse["server_ns"] += result.step_timings.server_ns
            all_coarse["hooks_ns"] += result.step_timings.hooks_ns
            all_coarse["overhead_ns"] += result.step_timings.overhead_ns
            total_steps += result.step_timings.step_count

    wall_total_ns = perf_counter_ns() - wall_start

    return {
        "label": label,
        "hidden_size": hidden_size,
        "num_layers": num_layers,
        "episodes": args.episodes,
        "total_steps": total_steps,
        "wall_ns": wall_total_ns,
        "coarse": all_coarse,
        "policy_timings": profiling_policy.timings,
        "hook_timings": profiling_hooks.hook_timings,
    }


def run_ppo_profile(args: argparse.Namespace, num_workers: int) -> dict[str, Any]:
    """Profile the distributed PPO pipeline with per-phase timing.

    Manually replicates DistributedPPOTrainer.train() to insert
    perf_counter_ns around each phase.
    """
    from concurrent.futures import ProcessPoolExecutor, as_completed
    from mage_knight_sdk.sim.rl.distributed_trainer import (
        WorkerPPOResult,
        collect_worker_episodes,
        _distribute_seeds,
    )
    from mage_knight_sdk.sim.rl.policy_gradient import (
        compute_gae,
        detensorize_episodes,
    )

    config = PolicyGradientConfig(
        hidden_size=args.hidden_size,
        embedding_dim=args.embedding_dim,
        num_hidden_layers=args.num_hidden_layers,
        device="cpu",
    )
    policy = ReinforcePolicy(config)
    reward_config = RewardConfig(
        step_penalty=0.0,
        components=(VictoryRewardComponent(),),
    )

    base_port = getattr(args, "base_port", None) or 3001
    runner_config = RunnerConfig(
        bootstrap_api_base_url=f"http://127.0.0.1:{base_port}",
        ws_server_url=f"ws://127.0.0.1:{base_port}",
        player_count=1,
        runs=1,
        max_steps=10000,
        base_seed=args.seed,
        artifacts_dir="/tmp/profile-artifacts",
        write_failure_artifacts=False,
        allow_undo=False,
    )

    server_urls: list[tuple[str, str]] | None = None
    if getattr(args, "multi_server", False):
        server_urls = [
            (f"http://127.0.0.1:{base_port + i}", f"ws://127.0.0.1:{base_port + i}")
            for i in range(num_workers)
        ]

    episodes_per_sync = getattr(args, "episodes_per_sync", 4) or 4
    ppo_epochs = 4
    batch_size = num_workers * episodes_per_sync
    seed_cursor = args.seed

    # Phase accumulators (nanoseconds)
    phase_ns: dict[str, int] = {
        "get_weights": 0,
        "worker_collection": 0,
        "detensorize": 0,
        "compute_gae": 0,
        "optimize_ppo": 0,
    }
    batch_count = 0
    total_steps = 0
    total_episodes = 0
    batch_details: list[dict[str, Any]] = []

    wall_start = perf_counter_ns()

    with ProcessPoolExecutor(max_workers=num_workers) as executor:
        while total_episodes < args.episodes:
            remaining = args.episodes - total_episodes
            current_batch = min(batch_size, remaining)

            worker_seeds, worker_offsets, assigned = _distribute_seeds(
                num_workers, episodes_per_sync,
                current_batch, seed_cursor, total_episodes,
            )
            seed_cursor += assigned

            # --- Phase 1: Weight serialization ---
            t0 = perf_counter_ns()
            weights = policy.get_weights()
            t_weights = perf_counter_ns() - t0
            phase_ns["get_weights"] += t_weights

            # --- Phase 2: Worker dispatch + collection ---
            t0 = perf_counter_ns()
            futures = {}
            for i, (seeds, ep_offset) in enumerate(zip(worker_seeds, worker_offsets)):
                kwargs: dict[str, Any] = {}
                if server_urls and i < len(server_urls):
                    kwargs["bootstrap_url"] = server_urls[i][0]
                    kwargs["ws_url"] = server_urls[i][1]
                futures[executor.submit(
                    collect_worker_episodes, weights, policy.config,
                    reward_config, runner_config, seeds,
                    None, None, ep_offset,
                    **kwargs,
                )] = i

            worker_results: list[WorkerPPOResult] = []
            for future in as_completed(futures):
                worker_results.append(future.result())
            t_workers = perf_counter_ns() - t0
            phase_ns["worker_collection"] += t_workers

            # --- Phase 3: Detensorize ---
            t0 = perf_counter_ns()
            tensorized_episodes = []
            all_stats = []
            for wr in worker_results:
                tensorized_episodes.extend(wr.episodes)
                all_stats.extend(wr.episode_stats)

            if tensorized_episodes:
                all_episodes = detensorize_episodes(tensorized_episodes)
            else:
                all_episodes = []
            t_detensor = perf_counter_ns() - t0
            phase_ns["detensorize"] += t_detensor

            # --- Phase 4: GAE ---
            t0 = perf_counter_ns()
            if all_episodes:
                transitions, advantages, returns = compute_gae(
                    all_episodes, config.gamma, 0.95,
                )
            t_gae = perf_counter_ns() - t0
            phase_ns["compute_gae"] += t_gae

            # --- Phase 5: PPO optimization ---
            t0 = perf_counter_ns()
            if all_episodes:
                policy.optimize_ppo(
                    transitions, advantages, returns,
                    clip_epsilon=0.2, ppo_epochs=ppo_epochs,
                    max_grad_norm=0.5, mini_batch_size=256,
                )
            t_opt = perf_counter_ns() - t0
            phase_ns["optimize_ppo"] += t_opt

            batch_steps = sum(s.steps for s in all_stats)
            n_transitions = len(transitions) if all_episodes else 0
            batch_details.append({
                "batch": batch_count,
                "episodes": len(all_stats),
                "steps": batch_steps,
                "transitions": n_transitions,
                "get_weights_ms": t_weights / 1e6,
                "worker_collection_ms": t_workers / 1e6,
                "detensorize_ms": t_detensor / 1e6,
                "compute_gae_ms": t_gae / 1e6,
                "optimize_ppo_ms": t_opt / 1e6,
            })

            total_steps += batch_steps
            total_episodes += len(all_stats)
            batch_count += 1

    wall_total_ns = perf_counter_ns() - wall_start

    return {
        "workers": num_workers,
        "episodes_per_sync": episodes_per_sync,
        "episodes": total_episodes,
        "total_steps": total_steps,
        "batches": batch_count,
        "wall_ns": wall_total_ns,
        "phase_ns": phase_ns,
        "batch_details": batch_details,
    }


def print_ppo_results(r: dict[str, Any]) -> None:
    """Print distributed PPO phase breakdown."""
    wall_ns = r["wall_ns"]
    wall_ms = wall_ns / 1e6
    phase_ns = r["phase_ns"]
    accounted = sum(phase_ns.values())
    unaccounted = wall_ns - accounted

    print(f"\n{'=' * 70}")
    print(f"DISTRIBUTED PPO PROFILE")
    print(f"  workers={r['workers']}  eps_per_sync={r['episodes_per_sync']}  "
          f"batches={r['batches']}  episodes={r['episodes']}  steps={r['total_steps']}")
    print(f"{'=' * 70}")

    # Phase breakdown
    print(f"\n--- Per-Batch Phase Breakdown ---")
    print(f"  {'Phase':<22} {'Mean':>10} {'Total':>10} {'% wall':>8}")
    n_batches = max(r["batches"], 1)
    for phase_name in ("get_weights", "worker_collection", "detensorize", "compute_gae", "optimize_ppo"):
        ns = phase_ns[phase_name]
        mean_ms = ns / n_batches / 1e6
        total_ms = ns / 1e6
        pct = ns / wall_ns * 100 if wall_ns > 0 else 0
        print(f"  {phase_name:<22} {mean_ms:>8.1f}ms {total_ms:>8.0f}ms {pct:>7.1f}%")
    # Unaccounted
    ua_mean = unaccounted / n_batches / 1e6
    ua_pct = unaccounted / wall_ns * 100 if wall_ns > 0 else 0
    print(f"  {'unaccounted':<22} {ua_mean:>8.1f}ms {unaccounted/1e6:>8.0f}ms {ua_pct:>7.1f}%")
    print(f"  {'─' * 52}")
    print(f"  {'TOTAL':<22} {wall_ms/n_batches:>8.1f}ms {wall_ms:>8.0f}ms {100.0:>7.1f}%")

    # Per-batch details
    if r["batch_details"]:
        print(f"\n--- Batch Details ---")
        print(f"  {'Batch':>5} {'Eps':>4} {'Steps':>6} {'Trans':>6} "
              f"{'Weights':>8} {'Workers':>8} {'Detens':>8} {'GAE':>8} {'PPO':>8} {'Total':>8}")
        for bd in r["batch_details"]:
            total_ms = (bd["get_weights_ms"] + bd["worker_collection_ms"] +
                       bd["detensorize_ms"] + bd["compute_gae_ms"] + bd["optimize_ppo_ms"])
            print(f"  {bd['batch']:>5} {bd['episodes']:>4} {bd['steps']:>6} {bd['transitions']:>6} "
                  f"{bd['get_weights_ms']:>6.1f}ms {bd['worker_collection_ms']:>6.0f}ms "
                  f"{bd['detensorize_ms']:>6.1f}ms {bd['compute_gae_ms']:>6.1f}ms "
                  f"{bd['optimize_ppo_ms']:>6.0f}ms {total_ms:>6.0f}ms")

    # Throughput
    wall_sec = wall_ns / 1e9
    print(f"\n--- Throughput ---")
    print(f"  {r['episodes']/wall_sec:.2f} games/sec  |  {r['total_steps']/wall_sec:.0f} steps/sec")


def print_sequential_results(r: dict[str, Any]) -> None:
    label = r["label"]
    total_steps = r["total_steps"]
    episodes = r["episodes"]
    wall_ns = r["wall_ns"]
    coarse = r["coarse"]
    policy_timings = r["policy_timings"]
    hook_timings = r["hook_timings"]

    coarse_total = sum(coarse.values())

    print(f"\n{'=' * 70}")
    print(f"{label}: {total_steps} steps, {episodes} episodes")
    print(f"{'=' * 70}")

    # Wall clock vs in-step time
    wall_ms = wall_ns / 1e6
    coarse_ms = coarse_total / 1e6
    overhead_ms = wall_ms - coarse_ms
    print(f"\n--- Wall Clock ---")
    print(f"  Total wall time:     {wall_ms:>10.0f}ms")
    print(f"  In-step time:        {coarse_ms:>10.0f}ms ({coarse_ms/wall_ms*100:.1f}%)")
    print(f"  Between-step:        {overhead_ms:>10.0f}ms ({overhead_ms/wall_ms*100:.1f}%)")
    print(f"    (game bootstrap, WS connect, optimize_episode, asyncio loop)")

    # Coarse per-step
    print(f"\n--- Per-Step Breakdown ---")
    print(f"  {'Component':<16} {'Per-step':>10} {'Total':>10} {'%':>7}")
    for name in ("enumerate", "sort", "policy", "server", "hooks", "overhead"):
        ns = coarse[f"{name}_ns"]
        per_step = ns / total_steps / 1e6 if total_steps else 0
        pct = ns / coarse_total * 100 if coarse_total else 0
        print(f"  {name:<16} {per_step:>8.3f}ms {ns/1e6:>8.0f}ms {pct:>6.1f}%")
    per_step_total = coarse_total / total_steps / 1e6 if total_steps else 0
    print(f"  {'TOTAL':<16} {per_step_total:>8.3f}ms {coarse_total/1e6:>8.0f}ms {100.0:>6.1f}%")

    # Policy sub-breakdown
    print(f"\n--- Policy Sub-Breakdown ---")
    print(f"  {'Component':<22} {'Mean':>8} {'Median':>8} {'P99':>8} {'% of policy':>12}")
    for name in ("encode_features", "network_forward", "action_selection", "bookkeeping"):
        vals = policy_timings[name]
        if not vals:
            continue
        mean, med, p99 = _fmt(vals)
        total_ns = sum(vals)
        pct = total_ns / coarse["policy_ns"] * 100 if coarse["policy_ns"] else 0
        print(f"  {name:<22} {mean:>6.3f}ms {med:>6.3f}ms {p99:>6.3f}ms {pct:>10.1f}%")

    # Hooks
    if hook_timings:
        mean, med, p99 = _fmt(hook_timings)
        print(f"\n--- Hooks ---")
        print(f"  on_step: mean={mean:.3f}ms  median={med:.3f}ms  p99={p99:.3f}ms")

    # Throughput
    games_per_sec = episodes / (wall_ns / 1e9)
    steps_per_sec = total_steps / (wall_ns / 1e9)
    print(f"\n--- Throughput ---")
    print(f"  {games_per_sec:.2f} games/sec  |  {steps_per_sec:.0f} steps/sec")


def main() -> None:
    parser = argparse.ArgumentParser(description="Profile RL step bottlenecks")
    parser.add_argument("--episodes", type=int, default=20)
    parser.add_argument("--seed", type=int, default=99999)
    parser.add_argument("--hidden-size", type=int, default=512)
    parser.add_argument("--num-hidden-layers", type=int, default=2)
    parser.add_argument("--embedding-dim", type=int, default=16)
    parser.add_argument("--compare-sizes", action="store_true",
                        help="Also profile smaller network configs for comparison")
    parser.add_argument("--ppo", action="store_true",
                        help="Profile the distributed PPO pipeline (skip sequential REINFORCE profiling)")
    parser.add_argument("--workers", type=int, default=4,
                        help="Number of workers for PPO profiling (default: 4)")
    parser.add_argument("--episodes-per-sync", type=int, default=4,
                        help="Episodes per worker per sync (default: 4)")
    parser.add_argument("--base-port", type=int, default=3001,
                        help="Base port for game servers (default: 3001)")
    parser.add_argument("--multi-server", action="store_true",
                        help="Use per-worker dedicated servers on sequential ports (requires cluster mode)")
    args = parser.parse_args()

    print("=" * 70)
    print("COMPREHENSIVE RL TRAINING PROFILER")
    print("=" * 70)

    if args.ppo:
        # --- PPO distributed pipeline profile ---
        for workers in ([1, args.workers] if args.workers > 1 else [1]):
            print(f"\nRunning distributed PPO profile with {workers} workers ({args.episodes} eps)...")
            try:
                r = run_ppo_profile(args, num_workers=workers)
                print_ppo_results(r)
            except Exception as e:
                import traceback
                print(f"  FAILED: {e}")
                traceback.print_exc()
        return

    # --- Sequential profile with current config ---
    print(f"\nRunning sequential profile ({args.episodes} eps)...")
    main_result = run_sequential_profile(
        args,
        hidden_size=args.hidden_size,
        num_layers=args.num_hidden_layers,
        label=f"Current config (h={args.hidden_size}, L={args.num_hidden_layers})",
    )
    print_sequential_results(main_result)

    # --- Compare network sizes ---
    if args.compare_sizes:
        configs = [
            (256, 1, "Small (h=256, L=1)"),
            (256, 2, "Medium (h=256, L=2)"),
            (512, 1, "Large-shallow (h=512, L=1)"),
        ]
        for h, layers, label in configs:
            if h == args.hidden_size and layers == args.num_hidden_layers:
                continue
            print(f"\nRunning sequential profile for {label}...")
            r = run_sequential_profile(args, hidden_size=h, num_layers=layers, label=label)
            print_sequential_results(r)

    # --- Final summary ---
    print(f"\n{'=' * 70}")
    print("KEY FINDINGS")
    print(f"{'=' * 70}")
    coarse = main_result["coarse"]
    coarse_total = sum(coarse.values())
    wall_ns = main_result["wall_ns"]
    total_steps = main_result["total_steps"]
    episodes = main_result["episodes"]

    net_ns = sum(main_result["policy_timings"]["network_forward"])
    enc_ns = sum(main_result["policy_timings"]["encode_features"])
    srv_ns = coarse["server_ns"]
    between_ns = wall_ns - coarse_total

    total = wall_ns
    print(f"\n  Where does wall-clock time go? ({episodes} sequential episodes)")
    print(f"  {'Network forward':.<30} {net_ns/total*100:>5.1f}%  ({net_ns/1e6:.0f}ms)")
    print(f"  {'Server round-trip':.<30} {srv_ns/total*100:>5.1f}%  ({srv_ns/1e6:.0f}ms)")
    print(f"  {'Between-step overhead':.<30} {between_ns/total*100:>5.1f}%  ({between_ns/1e6:.0f}ms)")
    print(f"  {'Feature encoding':.<30} {enc_ns/total*100:>5.1f}%  ({enc_ns/1e6:.0f}ms)")
    other = total - net_ns - srv_ns - between_ns - enc_ns
    print(f"  {'Other (enum/sort/select/etc)':.<30} {other/total*100:>5.1f}%  ({other/1e6:.0f}ms)")


if __name__ == "__main__":
    main()
