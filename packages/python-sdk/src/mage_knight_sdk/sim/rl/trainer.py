from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..hooks import RunnerHooks, StepSample
from ..reporting import MessageLogEntry, RunResult
from .policy_gradient import OptimizationStats, ReinforcePolicy
from .rewards import RewardConfig, compute_step_reward, compute_terminal_reward


@dataclass(frozen=True)
class EpisodeTrainingStats:
    outcome: str
    steps: int
    total_reward: float
    optimization: OptimizationStats


class ReinforceTrainer(RunnerHooks):
    """Runner hook that turns simulation episodes into policy-gradient updates."""

    def __init__(
        self,
        policy: ReinforcePolicy,
        reward_config: RewardConfig | None = None,
        compute_gradients_only: bool = False,
    ) -> None:
        self.policy = policy
        self.reward_config = reward_config or RewardConfig()
        self._compute_gradients_only = compute_gradients_only

        self.last_stats: EpisodeTrainingStats | None = None
        self._episode_total_reward = 0.0

    def on_step(self, sample: StepSample) -> None:
        reward = compute_step_reward(sample, self.reward_config)
        self.policy.record_step_reward(reward)
        self._episode_total_reward += reward

    def on_run_end(self, result: RunResult, messages: list[MessageLogEntry]) -> None:
        del messages
        terminal_reward = compute_terminal_reward(result, self.reward_config)
        self.policy.add_terminal_reward(terminal_reward)
        self._episode_total_reward += terminal_reward

        optimization = self.policy.optimize_episode(
            compute_gradients_only=self._compute_gradients_only,
        )
        self.last_stats = EpisodeTrainingStats(
            outcome=result.outcome,
            steps=result.steps,
            total_reward=self._episode_total_reward,
            optimization=optimization,
        )

        self._episode_total_reward = 0.0
