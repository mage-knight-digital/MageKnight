from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from ..hooks import RunnerHooks, StepSample
from ..reporting import MessageLogEntry, RunResult
from .policy_gradient import OptimizationStats, ReinforcePolicy, Transition
from .rewards import (
    RewardConfig,
    VictoryRewardComponent,
    compute_step_reward,
    compute_terminal_reward,
)


@dataclass(frozen=True)
class EpisodeTrainingStats:
    outcome: str
    steps: int
    total_reward: float
    optimization: OptimizationStats
    scenario_triggered: bool = False
    achievement_bonus: float = 0.0


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
        victory = _find_victory_component(self.reward_config)
        triggered = victory.scenario_triggered if victory else False
        ach_bonus = victory.achievement_bonus if victory else 0.0

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
            scenario_triggered=triggered,
            achievement_bonus=ach_bonus,
        )

        self._episode_total_reward = 0.0


class PPOTrainer(RunnerHooks):
    """Runner hook that collects transitions for PPO optimization.

    Unlike ReinforceTrainer, this does NOT optimize after each episode.
    Transitions accumulate across episodes and are harvested in batches
    by the training loop, which then calls policy.optimize_ppo().
    """

    def __init__(
        self,
        policy: ReinforcePolicy,
        reward_config: RewardConfig | None = None,
    ) -> None:
        self.policy = policy
        self.reward_config = reward_config or RewardConfig()

        self._current_transitions: list[Transition] = []
        self._episodes: list[list[Transition]] = []
        self._episode_stats: list[EpisodeTrainingStats] = []
        self._episode_total_reward = 0.0
        self.last_episode_stats: EpisodeTrainingStats | None = None

    def on_step(self, sample: StepSample) -> None:
        reward = compute_step_reward(sample, self.reward_config)
        self._episode_total_reward += reward

        info = self.policy.last_step_info
        if info is not None:
            self._current_transitions.append(Transition(
                encoded_step=info.encoded_step,
                action_index=info.action_index,
                log_prob=info.log_prob,
                value=info.value,
                reward=reward,
            ))

    def on_run_end(self, result: RunResult, messages: list[MessageLogEntry]) -> None:
        del messages
        victory = _find_victory_component(self.reward_config)
        triggered = victory.scenario_triggered if victory else False
        ach_bonus = victory.achievement_bonus if victory else 0.0

        terminal_reward = compute_terminal_reward(result, self.reward_config)
        self._episode_total_reward += terminal_reward

        # Add terminal reward to last transition
        if self._current_transitions:
            last = self._current_transitions[-1]
            self._current_transitions[-1] = Transition(
                encoded_step=last.encoded_step,
                action_index=last.action_index,
                log_prob=last.log_prob,
                value=last.value,
                reward=last.reward + terminal_reward,
            )

        n_actions = len(self._current_transitions)
        stats = EpisodeTrainingStats(
            outcome=result.outcome,
            steps=result.steps,
            total_reward=self._episode_total_reward,
            optimization=OptimizationStats(
                loss=0.0,
                total_reward=self._episode_total_reward,
                mean_reward=self._episode_total_reward / max(n_actions, 1),
                entropy=0.0,
                action_count=n_actions,
            ),
            scenario_triggered=triggered,
            achievement_bonus=ach_bonus,
        )
        self.last_episode_stats = stats
        self._episode_stats.append(stats)
        self._episodes.append(self._current_transitions)
        self._current_transitions = []
        self._episode_total_reward = 0.0
        # Clear REINFORCE buffers to prevent memory leak
        self.policy._reset_episode_buffers()

    @property
    def episode_count(self) -> int:
        return len(self._episode_stats)

    def harvest(self) -> tuple[list[list[Transition]], list[EpisodeTrainingStats]]:
        """Return collected episodes and stats, clearing the buffer."""
        episodes = self._episodes
        stats = self._episode_stats
        self._episodes = []
        self._episode_stats = []
        return episodes, stats


def _find_victory_component(config: RewardConfig) -> VictoryRewardComponent | None:
    for comp in config.components:
        if isinstance(comp, VictoryRewardComponent):
            return comp
    return None
