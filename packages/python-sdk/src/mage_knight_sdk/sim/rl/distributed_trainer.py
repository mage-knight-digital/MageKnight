"""Data-parallel REINFORCE training with multiple worker processes."""

from __future__ import annotations

from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Iterator

import torch

from ..config import RunnerConfig
from ..runner import run_simulations_sync
from .policy_gradient import PolicyGradientConfig, ReinforcePolicy
from .rewards import RewardConfig
from .trainer import EpisodeTrainingStats, ReinforceTrainer


@dataclass(frozen=True)
class WorkerResult:
    """Collected output from a single worker process."""

    gradients: dict[str, torch.Tensor]
    episode_stats: list[EpisodeTrainingStats]


def run_worker_episodes(
    weights: dict[str, torch.Tensor],
    policy_config: PolicyGradientConfig,
    reward_config: RewardConfig,
    runner_config: RunnerConfig,
    seeds: list[int],
) -> WorkerResult:
    """Run K episodes with given weights, return accumulated gradients + stats.

    Runs in a subprocess via ProcessPoolExecutor. Each call creates a fresh
    ReinforcePolicy, loads the provided weights, plays episodes, and
    accumulates gradients across all episodes.
    """
    # Force CPU in workers to avoid GPU contention
    worker_policy_config = PolicyGradientConfig(
        gamma=policy_config.gamma,
        learning_rate=policy_config.learning_rate,
        entropy_coefficient=policy_config.entropy_coefficient,
        hidden_size=policy_config.hidden_size,
        normalize_returns=policy_config.normalize_returns,
        device="cpu",
        embedding_dim=policy_config.embedding_dim,
        use_embeddings=policy_config.use_embeddings,
    )
    policy = ReinforcePolicy(worker_policy_config)
    policy.set_weights(weights)

    accumulated_grads: dict[str, torch.Tensor] | None = None
    all_stats: list[EpisodeTrainingStats] = []

    for seed in seeds:
        config = RunnerConfig(
            bootstrap_api_base_url=runner_config.bootstrap_api_base_url,
            ws_server_url=runner_config.ws_server_url,
            player_count=runner_config.player_count,
            runs=1,
            max_steps=runner_config.max_steps,
            base_seed=seed,
            artifacts_dir=runner_config.artifacts_dir,
            write_failure_artifacts=runner_config.write_failure_artifacts,
            allow_undo=runner_config.allow_undo,
        )
        # compute_gradients_only=True: backward populates .grad but skips optimizer.step()
        trainer = ReinforceTrainer(
            policy=policy,
            reward_config=reward_config,
            compute_gradients_only=True,
        )
        run_simulations_sync(config, policy=policy, hooks=trainer)

        stats = trainer.last_stats
        if stats is None:
            continue

        # Gradients are already on parameters from trainer's optimize_episode call
        grads = policy.extract_gradients()

        if accumulated_grads is None:
            accumulated_grads = grads
        else:
            for name in accumulated_grads:
                accumulated_grads[name] = accumulated_grads[name] + grads[name]

        all_stats.append(stats)

    # Average accumulated gradients across episodes
    n = len(all_stats)
    if accumulated_grads is not None and n > 1:
        for name in accumulated_grads:
            accumulated_grads[name] = accumulated_grads[name] / n

    return WorkerResult(
        gradients=accumulated_grads or {},
        episode_stats=all_stats,
    )


class DistributedReinforceTrainer:
    """Coordinator that distributes episodes across worker processes."""

    def __init__(
        self,
        policy: ReinforcePolicy,
        reward_config: RewardConfig,
        runner_config: RunnerConfig,
        num_workers: int = 4,
        episodes_per_sync: int = 1,
    ) -> None:
        self._policy = policy
        self._reward_config = reward_config
        self._runner_config = runner_config
        self._num_workers = num_workers
        self._episodes_per_sync = episodes_per_sync

    def train(
        self, total_episodes: int, start_seed: int
    ) -> Iterator[EpisodeTrainingStats]:
        """Yield stats for each episode, running batches in parallel.

        Each batch dispatches num_workers workers, each running
        episodes_per_sync episodes. After all workers complete, gradients
        are averaged and applied to the main policy.

        The process pool is created once and reused across all batches
        to avoid ~500-1000ms spawn overhead per batch.
        """
        batch_size = self._num_workers * self._episodes_per_sync
        seed_cursor = start_seed

        episodes_yielded = 0
        with ProcessPoolExecutor(max_workers=self._num_workers) as executor:
            while episodes_yielded < total_episodes:
                remaining = total_episodes - episodes_yielded
                current_batch = min(batch_size, remaining)

                # Distribute seeds across workers
                worker_seeds: list[list[int]] = []
                assigned = 0
                for _ in range(self._num_workers):
                    count = min(self._episodes_per_sync, current_batch - assigned)
                    if count <= 0:
                        break
                    worker_seeds.append(
                        list(range(seed_cursor + assigned, seed_cursor + assigned + count))
                    )
                    assigned += count
                seed_cursor += assigned

                weights = self._policy.get_weights()

                # Dispatch workers
                worker_results: list[WorkerResult] = []
                futures = {
                    executor.submit(
                        run_worker_episodes,
                        weights,
                        self._policy.config,
                        self._reward_config,
                        self._runner_config,
                        seeds,
                    ): i
                    for i, seeds in enumerate(worker_seeds)
                }
                for future in as_completed(futures):
                    worker_results.append(future.result())

                # Collect all gradient dicts from workers with non-empty gradients
                gradient_dicts = [
                    wr.gradients for wr in worker_results if wr.gradients
                ]
                if gradient_dicts:
                    self._policy.apply_averaged_gradients(gradient_dicts)

                # Yield individual episode stats
                for wr in worker_results:
                    for stats in wr.episode_stats:
                        yield stats
                        episodes_yielded += 1
                        if episodes_yielded >= total_episodes:
                            return
