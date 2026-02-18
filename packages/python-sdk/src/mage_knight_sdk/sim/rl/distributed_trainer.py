"""Data-parallel training with multiple worker processes (REINFORCE + PPO)."""

from __future__ import annotations

import json
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterator

import torch

from ..config import RunnerConfig
from ..reporting import MessageLogEntry
from ..runner import run_simulations_batch_sync, run_simulations_sync
from .policy_gradient import (
    PolicyGradientConfig,
    ReinforcePolicy,
    TensorizedTransition,
    Transition,
    compute_gae,
    detensorize_episodes,
    tensorize_episodes,
)
from .rewards import RewardConfig
from .trainer import EpisodeTrainingStats, PPOTrainer, ReinforceTrainer


# ---------------------------------------------------------------------------
# REINFORCE distributed (existing)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WorkerResult:
    """Collected output from a single REINFORCE worker process."""

    gradients: dict[str, torch.Tensor]
    episode_stats: list[EpisodeTrainingStats]


def run_worker_episodes(
    weights: dict[str, torch.Tensor],
    policy_config: PolicyGradientConfig,
    reward_config: RewardConfig,
    runner_config: RunnerConfig,
    seeds: list[int],
    replay_dir: str | None = None,
    replay_threshold: float | None = None,
    episode_offset: int = 0,
    bootstrap_url: str | None = None,
    ws_url: str | None = None,
) -> WorkerResult:
    """Run K episodes with given weights, return accumulated gradients + stats."""
    policy = _make_worker_policy(policy_config, weights)

    capture = replay_dir is not None and replay_threshold is not None
    accumulated_grads: dict[str, torch.Tensor] | None = None
    all_stats: list[EpisodeTrainingStats] = []

    configs = [_seed_config(runner_config, seed, bootstrap_url, ws_url) for seed in seeds]
    trainers: list[ReinforceTrainer] = []

    def make_trainer() -> ReinforceTrainer:
        t = ReinforceTrainer(
            policy=policy,
            reward_config=reward_config,
            compute_gradients_only=True,
        )
        trainers.append(t)
        return t

    results = run_simulations_batch_sync(
        configs, policy, hooks_factory=make_trainer, return_traces=capture,
    )

    for idx, (outcome, _hooks) in enumerate(results):
        trainer = trainers[idx]
        seed = seeds[idx]
        stats = trainer.last_stats
        if stats is None:
            continue

        if (capture
                and replay_threshold is not None
                and stats.total_reward >= replay_threshold):
            _save_worker_replay(
                Path(replay_dir), episode_offset + idx + 1, seed, stats,
                outcome.messages, outcome.trace,
            )

        grads = policy.extract_gradients()
        if accumulated_grads is None:
            accumulated_grads = grads
        else:
            for name in accumulated_grads:
                accumulated_grads[name] = accumulated_grads[name] + grads[name]

        all_stats.append(stats)

    n = len(all_stats)
    if accumulated_grads is not None and n > 1:
        for name in accumulated_grads:
            accumulated_grads[name] = accumulated_grads[name] / n

    return WorkerResult(
        gradients=accumulated_grads or {},
        episode_stats=all_stats,
    )


class DistributedReinforceTrainer:
    """Coordinator that distributes REINFORCE episodes across worker processes."""

    def __init__(
        self,
        policy: ReinforcePolicy,
        reward_config: RewardConfig,
        runner_config: RunnerConfig,
        num_workers: int = 4,
        episodes_per_sync: int = 1,
        replay_dir: Path | None = None,
        replay_threshold: float | None = None,
        server_urls: list[tuple[str, str]] | None = None,
    ) -> None:
        self._policy = policy
        self._reward_config = reward_config
        self._runner_config = runner_config
        self._num_workers = num_workers
        self._episodes_per_sync = episodes_per_sync
        self._replay_dir = replay_dir
        self._replay_threshold = replay_threshold
        self._server_urls = server_urls

    def train(
        self, total_episodes: int, start_seed: int
    ) -> Iterator[EpisodeTrainingStats]:
        """Yield stats for each episode, running batches in parallel."""
        batch_size = self._num_workers * self._episodes_per_sync
        seed_cursor = start_seed
        replay_dir_str = str(self._replay_dir) if self._replay_dir else None

        episodes_yielded = 0
        with ProcessPoolExecutor(max_workers=self._num_workers) as executor:
            while episodes_yielded < total_episodes:
                remaining = total_episodes - episodes_yielded
                current_batch = min(batch_size, remaining)

                worker_seeds, worker_offsets, assigned = _distribute_seeds(
                    self._num_workers, self._episodes_per_sync,
                    current_batch, seed_cursor, episodes_yielded,
                )
                seed_cursor += assigned
                weights = self._policy.get_weights()

                futures = {}
                for i, (seeds, ep_offset) in enumerate(
                    zip(worker_seeds, worker_offsets)
                ):
                    kwargs: dict[str, Any] = {}
                    if self._server_urls and i < len(self._server_urls):
                        kwargs["bootstrap_url"] = self._server_urls[i][0]
                        kwargs["ws_url"] = self._server_urls[i][1]
                    futures[executor.submit(
                        run_worker_episodes, weights, self._policy.config,
                        self._reward_config, self._runner_config, seeds,
                        replay_dir_str, self._replay_threshold, ep_offset,
                        **kwargs,
                    )] = i
                worker_results: list[WorkerResult] = []
                for future in as_completed(futures):
                    worker_results.append(future.result())

                gradient_dicts = [
                    wr.gradients for wr in worker_results if wr.gradients
                ]
                if gradient_dicts:
                    self._policy.apply_averaged_gradients(gradient_dicts)

                for wr in worker_results:
                    for stats in wr.episode_stats:
                        yield stats
                        episodes_yielded += 1
                        if episodes_yielded >= total_episodes:
                            return


# ---------------------------------------------------------------------------
# PPO distributed
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class WorkerPPOResult:
    """Collected output from a single PPO worker process."""

    episodes: list[list[TensorizedTransition]]
    episode_stats: list[EpisodeTrainingStats]
    step_timings_aggregate: dict[str, int] | None = None


def collect_worker_episodes(
    weights: dict[str, torch.Tensor],
    policy_config: PolicyGradientConfig,
    reward_config: RewardConfig,
    runner_config: RunnerConfig,
    seeds: list[int],
    replay_dir: str | None = None,
    replay_threshold: float | None = None,
    episode_offset: int = 0,
    bootstrap_url: str | None = None,
    ws_url: str | None = None,
) -> WorkerPPOResult:
    """Play K episodes, collecting transitions for PPO (no optimization)."""
    policy = _make_worker_policy(policy_config, weights)

    capture = replay_dir is not None and replay_threshold is not None
    raw_episodes: list[list[Transition]] = []
    all_stats: list[EpisodeTrainingStats] = []

    configs = [_seed_config(runner_config, seed, bootstrap_url, ws_url) for seed in seeds]
    trainers: list[PPOTrainer] = []

    def make_trainer() -> PPOTrainer:
        t = PPOTrainer(policy=policy, reward_config=reward_config)
        trainers.append(t)
        return t

    results = run_simulations_batch_sync(
        configs, policy, hooks_factory=make_trainer, return_traces=capture,
        concurrent=True,
    )

    agg_timings: dict[str, int] | None = None
    for idx, (outcome, _hooks) in enumerate(results):
        trainer = trainers[idx]
        seed = seeds[idx]
        episodes, stats = trainer.harvest()
        raw_episodes.extend(episodes)
        all_stats.extend(stats)

        # Aggregate step timings across episodes
        t = outcome.step_timings
        if t is not None:
            if agg_timings is None:
                agg_timings = {
                    "enumerate_ns": 0, "sort_ns": 0, "policy_ns": 0,
                    "server_ns": 0, "hooks_ns": 0, "overhead_ns": 0,
                    "step_count": 0,
                }
            agg_timings["enumerate_ns"] += t.enumerate_ns
            agg_timings["sort_ns"] += t.sort_ns
            agg_timings["policy_ns"] += t.policy_ns
            agg_timings["server_ns"] += t.server_ns
            agg_timings["hooks_ns"] += t.hooks_ns
            agg_timings["overhead_ns"] += t.overhead_ns
            agg_timings["step_count"] += t.step_count

        if (capture
                and replay_threshold is not None
                and stats
                and stats[-1].total_reward >= replay_threshold):
            _save_worker_replay(
                Path(replay_dir), episode_offset + idx + 1, seed,
                stats[-1], outcome.messages, outcome.trace,
            )

    # Tensorize for efficient IPC pickling
    tensorized = tensorize_episodes(raw_episodes)
    return WorkerPPOResult(
        episodes=tensorized, episode_stats=all_stats,
        step_timings_aggregate=agg_timings,
    )


class DistributedPPOTrainer:
    """Coordinator that distributes PPO data collection across workers.

    Workers play episodes and return transitions. The main process
    computes GAE advantages and runs PPO optimization.
    """

    def __init__(
        self,
        policy: ReinforcePolicy,
        reward_config: RewardConfig,
        runner_config: RunnerConfig,
        num_workers: int = 4,
        episodes_per_sync: int = 4,
        ppo_epochs: int = 4,
        clip_epsilon: float = 0.2,
        gae_lambda: float = 0.95,
        max_grad_norm: float = 0.5,
        mini_batch_size: int = 256,
        replay_dir: Path | None = None,
        replay_threshold: float | None = None,
        server_urls: list[tuple[str, str]] | None = None,
    ) -> None:
        self._policy = policy
        self._reward_config = reward_config
        self._runner_config = runner_config
        self._num_workers = num_workers
        self._episodes_per_sync = episodes_per_sync
        self._ppo_epochs = ppo_epochs
        self._clip_epsilon = clip_epsilon
        self._gae_lambda = gae_lambda
        self._max_grad_norm = max_grad_norm
        self._mini_batch_size = mini_batch_size
        self._replay_dir = replay_dir
        self._replay_threshold = replay_threshold
        self._server_urls = server_urls

    def _dispatch_batch(
        self,
        executor: ProcessPoolExecutor,
        seed_cursor: int,
        episodes_yielded: int,
        remaining: int,
        replay_dir_str: str | None,
    ) -> tuple[dict[Any, int], int]:
        """Dispatch a batch of workers. Returns (futures_dict, seeds_assigned)."""
        batch_size = self._num_workers * self._episodes_per_sync
        current_batch = min(batch_size, remaining)

        worker_seeds, worker_offsets, assigned = _distribute_seeds(
            self._num_workers, self._episodes_per_sync,
            current_batch, seed_cursor, episodes_yielded,
        )
        weights = self._policy.get_weights()

        futures: dict[Any, int] = {}
        for i, (seeds, ep_offset) in enumerate(
            zip(worker_seeds, worker_offsets)
        ):
            kwargs: dict[str, Any] = {}
            if self._server_urls and i < len(self._server_urls):
                kwargs["bootstrap_url"] = self._server_urls[i][0]
                kwargs["ws_url"] = self._server_urls[i][1]
            futures[executor.submit(
                collect_worker_episodes, weights, self._policy.config,
                self._reward_config, self._runner_config, seeds,
                replay_dir_str, self._replay_threshold, ep_offset,
                **kwargs,
            )] = i
        return futures, assigned

    @staticmethod
    def _collect_results(
        futures: dict[Any, int],
    ) -> tuple[list[list[TensorizedTransition]], list[EpisodeTrainingStats]]:
        """Wait for workers and collect their results."""
        tensorized_episodes: list[list[TensorizedTransition]] = []
        all_stats: list[EpisodeTrainingStats] = []
        for future in as_completed(futures):
            result = future.result()
            tensorized_episodes.extend(result.episodes)
            all_stats.extend(result.episode_stats)
        return tensorized_episodes, all_stats

    def _optimize_batch(
        self,
        tensorized_episodes: list[list[TensorizedTransition]],
    ) -> "OptimizationStats":
        from .policy_gradient import OptimizationStats as _OS

        if not tensorized_episodes:
            return _OS(
                loss=0.0, total_reward=0.0, mean_reward=0.0,
                entropy=0.0, action_count=0,
            )
        all_episodes = detensorize_episodes(tensorized_episodes)
        transitions, advantages, returns = compute_gae(
            all_episodes, self._policy.config.gamma, self._gae_lambda,
        )
        return self._policy.optimize_ppo(
            transitions, advantages, returns,
            clip_epsilon=self._clip_epsilon,
            ppo_epochs=self._ppo_epochs,
            max_grad_norm=self._max_grad_norm,
            mini_batch_size=self._mini_batch_size,
        )

    def train(
        self, total_episodes: int, start_seed: int
    ) -> Iterator[EpisodeTrainingStats]:
        """Yield stats for each episode, running PPO batches in parallel.

        Uses double-buffering: while optimizing batch N, workers are already
        collecting batch N+1. Workers use pre-optimization weights (1 batch
        stale), which PPO's importance sampling ratio handles correctly.
        """
        seed_cursor = start_seed
        replay_dir_str = str(self._replay_dir) if self._replay_dir else None

        episodes_yielded = 0
        with ProcessPoolExecutor(max_workers=self._num_workers) as executor:
            # Collect first batch (nothing to optimize yet)
            remaining = total_episodes - episodes_yielded
            futures, assigned = self._dispatch_batch(
                executor, seed_cursor, episodes_yielded, remaining,
                replay_dir_str,
            )
            seed_cursor += assigned
            pending_episodes, pending_stats = self._collect_results(futures)

            while episodes_yielded < total_episodes:
                # Dispatch next batch BEFORE optimizing current batch.
                # Workers use current (pre-optimization) weights. The
                # importance ratio in PPO corrects for the 1-batch staleness.
                remaining_after = total_episodes - episodes_yielded - len(pending_stats)
                next_futures = None
                next_assigned = 0
                if remaining_after > 0:
                    next_futures, next_assigned = self._dispatch_batch(
                        executor, seed_cursor, episodes_yielded + len(pending_stats),
                        remaining_after, replay_dir_str,
                    )
                    seed_cursor += next_assigned

                # Optimize current batch (overlaps with next batch collection)
                opt_stats = self._optimize_batch(pending_episodes)

                # Yield current batch stats
                for stats in pending_stats:
                    yield EpisodeTrainingStats(
                        outcome=stats.outcome,
                        steps=stats.steps,
                        total_reward=stats.total_reward,
                        optimization=opt_stats,
                        scenario_triggered=stats.scenario_triggered,
                        achievement_bonus=stats.achievement_bonus,
                    )
                    episodes_yielded += 1
                    if episodes_yielded >= total_episodes:
                        if next_futures is not None:
                            for f in next_futures:
                                f.cancel()
                        return

                # Wait for next batch (workers may already be done)
                if next_futures is not None:
                    pending_episodes, pending_stats = self._collect_results(
                        next_futures,
                    )
                else:
                    break


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _make_worker_policy(
    policy_config: PolicyGradientConfig,
    weights: dict[str, torch.Tensor],
) -> ReinforcePolicy:
    """Create a CPU-only policy with loaded weights for a worker process."""
    worker_config = PolicyGradientConfig(**{**asdict(policy_config), "device": "cpu"})
    policy = ReinforcePolicy(worker_config)
    policy.set_weights(weights)
    return policy


def _seed_config(
    runner_config: RunnerConfig,
    seed: int,
    bootstrap_url: str | None = None,
    ws_url: str | None = None,
) -> RunnerConfig:
    """Create a single-seed RunnerConfig from a template."""
    return RunnerConfig(
        bootstrap_api_base_url=bootstrap_url or runner_config.bootstrap_api_base_url,
        ws_server_url=ws_url or runner_config.ws_server_url,
        player_count=runner_config.player_count,
        runs=1,
        max_steps=runner_config.max_steps,
        base_seed=seed,
        artifacts_dir=runner_config.artifacts_dir,
        write_failure_artifacts=runner_config.write_failure_artifacts,
        allow_undo=runner_config.allow_undo,
        collect_step_timings=runner_config.collect_step_timings,
        skip_run_summary=runner_config.skip_run_summary,
    )


def _distribute_seeds(
    num_workers: int,
    episodes_per_sync: int,
    current_batch: int,
    seed_cursor: int,
    episodes_yielded: int,
) -> tuple[list[list[int]], list[int], int]:
    """Distribute seeds evenly across workers. Returns (seeds, offsets, total_assigned)."""
    worker_seeds: list[list[int]] = []
    worker_offsets: list[int] = []
    assigned = 0
    for _ in range(num_workers):
        count = min(episodes_per_sync, current_batch - assigned)
        if count <= 0:
            break
        worker_seeds.append(
            list(range(seed_cursor + assigned, seed_cursor + assigned + count))
        )
        worker_offsets.append(episodes_yielded + assigned)
        assigned += count
    return worker_seeds, worker_offsets, assigned


def _save_worker_replay(
    replay_dir: Path,
    episode: int,
    seed: int,
    stats: EpisodeTrainingStats,
    messages: list[MessageLogEntry],
    trace: list | None = None,
) -> None:
    """Save a game replay to disk in viewer-compatible format (called from worker process)."""
    from dataclasses import asdict

    record: dict = {
        "run": {
            "run_index": 0,
            "seed": seed,
            "outcome": stats.outcome,
            "steps": stats.steps,
            "game_id": f"rl_ep{episode}",
            "total_reward": stats.total_reward,
            "episode": episode,
        },
    }

    if trace is not None:
        record["actionTrace"] = [
            asdict(entry) if hasattr(entry, "__dataclass_fields__") else entry
            for entry in trace
        ]
    else:
        record["actionTrace"] = []

    record["messageLog"] = [
        asdict(msg) if hasattr(msg, "__dataclass_fields__") else msg
        for msg in messages
    ]

    path = replay_dir / f"replay_ep{episode:06d}_seed{seed}_r{stats.total_reward:.1f}.json"
    path.write_text(json.dumps(record, indent=2, sort_keys=True), encoding="utf-8")

    # Prune to keep only top 50 replays
    _prune_worker_replays(replay_dir, keep=50)


def _prune_worker_replays(replay_dir: Path, keep: int = 50) -> None:
    """Keep only the top N replays by reward."""
    files = list(replay_dir.glob("replay_*.json"))
    if len(files) <= keep:
        return

    def _reward_from_name(p: Path) -> float:
        try:
            return float(p.stem.rsplit("_r", 1)[1])
        except (IndexError, ValueError):
            return 0.0

    files.sort(key=_reward_from_name, reverse=True)
    for f in files[keep:]:
        f.unlink(missing_ok=True)
